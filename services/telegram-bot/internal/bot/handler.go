package bot

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	tele "gopkg.in/telebot.v3"
)

type Category struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Product struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Price      float64   `json:"price"`
	SKU        string    `json:"sku"`
	Stock      int       `json:"stock"`
	ImageURL   string    `json:"image_url,omitempty"`
	CategoryID string    `json:"category_id,omitempty"`
	Category   *Category `json:"category,omitempty"`
}

type Order struct {
	ID           string `json:"id"`
	ProductID    string `json:"product_id"`
	ProductName  string `json:"product_name,omitempty"`
	Quantity     int    `json:"quantity"`
	Status       string `json:"status"`
	UserID       int64  `json:"user_id"`
	Phone        string `json:"phone,omitempty"`
	Address      string `json:"address,omitempty"`
	TrackingNum  string `json:"tracking_num,omitempty"`
	DeliveryNote string `json:"delivery_note,omitempty"`
}

// FSM states for checkout
type CheckoutState int

const (
	StateNone CheckoutState = iota
	StateAwaitingPhone
	StateAwaitingAddress
	StateAwaitingPromoCode
	StateAwaitingConfirm
	StateAwaitingSearch
	StateAwaitingReviewRating
	StateAwaitingReviewComment
	StateAwaitingImportCSV
)

type CheckoutSession struct {
	State     CheckoutState
	Phone     string
	Address   string
	Items     []CartItem
	ProductID string    // for review
	Rating    int       // for review
	PromoCode string    // applied promo code
	Discount  float64   // discount percentage
	CreatedAt time.Time // session creation time for timeout
}

type Review struct {
	ProductID string
	UserID    int64
	UserName  string
	Rating    int
	Comment   string
}

type Handler struct {
	Bot      *tele.Bot
	CoreURL  string
	OMSURL   string
	CRMURL   string
	Client   *http.Client
	AdminIDs []int64
	// Track messages for pagination cleanup
	PageMessages   map[int64][]int // userID -> message IDs
	PageMessagesMu sync.RWMutex
	// Checkout FSM sessions
	CheckoutSessions   map[int64]*CheckoutSession
	CheckoutSessionsMu sync.RWMutex
	// Product subscriptions (notify when back in stock)
	Subscriptions   map[string][]int64 // productID -> userIDs
	SubscriptionsMu sync.RWMutex
	// Product reviews
	Reviews   map[string][]Review // productID -> reviews
	ReviewsMu sync.RWMutex
}

type CartItem struct {
	ProductID string  `json:"product_id"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Quantity  int     `json:"quantity"`
	ImageURL  string  `json:"image_url,omitempty"`
}

const SessionTimeout = 15 * time.Minute

func NewHandler(b *tele.Bot, coreURL, omsURL, crmURL string, adminIDs []int64) *Handler {
	h := &Handler{
		Bot:              b,
		CoreURL:          coreURL,
		OMSURL:           omsURL,
		CRMURL:           crmURL,
		Client:           &http.Client{Timeout: 5 * time.Second},
		AdminIDs:         adminIDs,
		PageMessages:     make(map[int64][]int),
		CheckoutSessions: make(map[int64]*CheckoutSession),
		Subscriptions:    make(map[string][]int64),
		Reviews:          make(map[string][]Review),
	}

	// Start session cleanup goroutine
	go h.cleanupExpiredSessions()

	return h
}

// cleanupExpiredSessions removes sessions that have been idle for too long
func (h *Handler) cleanupExpiredSessions() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		h.CheckoutSessionsMu.Lock()
		now := time.Now()
		for userID, session := range h.CheckoutSessions {
			if now.Sub(session.CreatedAt) > SessionTimeout {
				delete(h.CheckoutSessions, userID)
				// Notify user about session expiration
				go func(uid int64) {
					user := &tele.User{ID: uid}
					h.Bot.Send(user, "⏰ Ваша сесія оформлення замовлення закінчилася через неактивність. Почніть знову з /checkout")
				}(userID)
			}
		}
		h.CheckoutSessionsMu.Unlock()
	}
}

// Cart API helpers

func (h *Handler) getCartFromAPI(userID int64) ([]CartItem, error) {
	resp, err := h.Client.Get(fmt.Sprintf("%s/cart/%d", h.CoreURL, userID))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get cart: status %d", resp.StatusCode)
	}

	var items []CartItem
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return nil, err
	}
	return items, nil
}

func (h *Handler) addToCartAPI(userID int64, productID string, quantity int) error {
	body, _ := json.Marshal(map[string]interface{}{
		"product_id": productID,
		"quantity":   quantity,
	})
	req, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/cart/%d", h.CoreURL, userID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := h.Client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to add to cart: %s", string(bodyBytes))
	}
	return nil
}

func (h *Handler) clearCartAPI(userID int64) error {
	req, _ := http.NewRequest(http.MethodDelete, fmt.Sprintf("%s/cart/%d", h.CoreURL, userID), nil)
	resp, err := h.Client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

// isAdmin checks if user is in admin list
func (h *Handler) isAdmin(userID int64) bool {
	for _, id := range h.AdminIDs {
		if id == userID {
			return true
		}
	}
	return false
}

// MainMenu returns the persistent reply keyboard for navigation
func (h *Handler) MainMenu() *tele.ReplyMarkup {
	menu := &tele.ReplyMarkup{ResizeKeyboard: true}
	menu.Reply(
		menu.Row(
			menu.Text("🛍 Товари"),
			menu.Text("📁 Категорії"),
		),
		menu.Row(
			menu.Text("🔍 Пошук"),
			menu.Text("🛒 Кошик"),
		),
		menu.Row(
			menu.Text("📦 Мої замовлення"),
			menu.Text("ℹ️ Допомога"),
		),
	)
	return menu
}

func (h *Handler) RegisterRoutes() {
	// Slash commands
	h.Bot.Handle("/start", h.OnStart)
	h.Bot.Handle("/info", h.OnInfo)
	h.Bot.Handle("/products", h.OnListProducts)
	h.Bot.Handle("/search", h.OnSearch)
	h.Bot.Handle("/categories", h.OnCategories)
	h.Bot.Handle("/myorders", h.OnMyOrders)
	h.Bot.Handle("/create", h.OnCreate)
	h.Bot.Handle("/buy", h.OnBuy)
	h.Bot.Handle("/orders", h.OnListOrders)
	h.Bot.Handle("/cart", h.OnCart)
	h.Bot.Handle("/stock", h.OnStock)
	h.Bot.Handle("/setimage", h.OnSetImage)
	h.Bot.Handle("/stats", h.OnStats)
	h.Bot.Handle("/promo", h.OnPromo)
	h.Bot.Handle("/newpromo", h.OnNewPromo)
	h.Bot.Handle("/track", h.OnTrack)
	h.Bot.Handle("/import", h.OnImport)
	h.Bot.Handle("/export", h.OnExport)
	h.Bot.Handle("/newcat", h.OnNewCategory)
	h.Bot.Handle("/delcat", h.OnDeleteCategory)

	// Main menu text buttons
	h.Bot.Handle("🛍 Товари", h.OnListProducts)
	h.Bot.Handle("📁 Категорії", h.OnCategories)
	h.Bot.Handle("🔍 Пошук", h.OnSearchButton)
	h.Bot.Handle("🛒 Кошик", h.OnCart)
	h.Bot.Handle("📦 Мої замовлення", h.OnMyOrders)
	h.Bot.Handle("ℹ️ Допомога", h.OnInfo)

	// Register callbacks
	btnAdd := tele.Btn{Unique: "add"}
	h.Bot.Handle(&btnAdd, h.OnAddToCart)

	btnBuy := tele.Btn{Unique: "buy"}
	h.Bot.Handle(&btnBuy, h.OnBuyCallback)

	btnSubscribe := tele.Btn{Unique: "subscribe"}
	h.Bot.Handle(&btnSubscribe, h.OnSubscribe)

	btnReview := tele.Btn{Unique: "review"}
	h.Bot.Handle(&btnReview, h.OnReviewStart)

	btnStatus := tele.Btn{Unique: "status"}
	h.Bot.Handle(&btnStatus, h.OnStatusCallback)

	btnCheckout := tele.Btn{Unique: "checkout"}
	h.Bot.Handle(&btnCheckout, h.OnCheckout)

	btnClear := tele.Btn{Unique: "clear"}
	h.Bot.Handle(&btnClear, h.OnClearCart)

	btnCategory := tele.Btn{Unique: "category"}
	h.Bot.Handle(&btnCategory, h.OnCategoryCallback)

	// Pagination callbacks
	btnPage := tele.Btn{Unique: "page"}
	h.Bot.Handle(&btnPage, h.OnPageCallback)

	btnCatPage := tele.Btn{Unique: "catpage"}
	h.Bot.Handle(&btnCatPage, h.OnCategoryPageCallback)

	// Back to main menu callback
	btnBack := tele.Btn{Unique: "back"}
	h.Bot.Handle(&btnBack, h.OnBackToMenu)

	// Checkout confirmation callbacks
	btnConfirmOrder := tele.Btn{Unique: "confirm_order"}
	h.Bot.Handle(&btnConfirmOrder, h.OnConfirmOrder)

	btnCancelOrder := tele.Btn{Unique: "cancel_order"}
	h.Bot.Handle(&btnCancelOrder, h.OnCancelOrder)

	// Handle all text messages for FSM
	h.Bot.Handle(tele.OnText, h.OnTextMessage)

	// Handle location for address
	h.Bot.Handle(tele.OnLocation, h.OnLocation)

	// Handle documents for CSV import
	h.Bot.Handle(tele.OnDocument, h.OnDocument)
}

func (h *Handler) OnBackToMenu(c tele.Context) error {
	h.clearPageMessages(c)
	c.Respond(&tele.CallbackResponse{Text: "🏠 Головне меню"})
	return c.Send("🏠 *Головне меню*\n\nОберіть дію:", tele.ModeMarkdown, h.MainMenu())
}

type OrderRequest struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
	UserID    int64  `json:"user_id"`
}

type OrderResponse struct {
	ID string `json:"id"`
}

func (h *Handler) OnBuy(c tele.Context) error {
	args := c.Args()
	if len(args) < 2 {
		return c.Send("Використання: /buy [ID_товару] [кількість]\nПриклад: /buy d23cbc... 1")
	}

	productID := args[0]
	quantity := 1
	fmt.Sscanf(args[1], "%d", &quantity)

	req := OrderRequest{
		ProductID: productID,
		Quantity:  quantity,
		UserID:    c.Chat().ID,
	}

	data, err := json.Marshal(req)
	if err != nil {
		return c.Send("Помилка підготовки даних.")
	}

	resp, err := h.Client.Post(h.OMSURL+"/orders", "application/json", bytes.NewBuffer(data))
	if err != nil {
		return c.Send("Помилка з'єднання з OMS: " + err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return c.Send("Не вдалося створити замовлення.")
	}

	var orderResp OrderResponse
	if err := json.NewDecoder(resp.Body).Decode(&orderResp); err != nil {
		return c.Send("Помилка обробки відповіді OMS.")
	}

	return c.Send(fmt.Sprintf("✅ Замовлення створено! Номер: *%s*", orderResp.ID), tele.ModeMarkdown)
}

func (h *Handler) OnStart(c tele.Context) error {
	// Register customer in CRM
	go h.registerCustomer(c.Sender())
	return c.Send("👋 Привіт! Я бот магазину.\n\nОберіть дію з меню нижче:", h.MainMenu())
}

func (h *Handler) registerCustomer(u *tele.User) {
	if h.CRMURL == "" {
		return
	}

	req := map[string]interface{}{
		"telegram_id": u.ID,
		"first_name":  u.FirstName,
		"last_name":   u.LastName,
	}

	data, _ := json.Marshal(req)
	h.Client.Post(h.CRMURL+"/customers", "application/json", bytes.NewBuffer(data))
}

func (h *Handler) OnInfo(c tele.Context) error {
	msg := "ℹ️ *Доступні команди:*\n\n" +
		"🛍 *Клієнт:*\n" +
		"/products — Переглянути товари\n" +
		"/categories — Переглянути категорії\n" +
		"/search [запит] — Пошук товарів\n" +
		"/cart — Мій кошик\n" +
		"/myorders — Мої замовлення\n\n" +
		"🛠 *Адмін:*\n" +
		"/orders — Керування замовленнями\n" +
		"/create [назва] [ціна] [sku] — Додати товар\n" +
		"/stock [ID] [кількість] — Встановити залишок\n" +
		"/setimage [ID] [URL] — Встановити фото\n" +
		"/track [ID] [номер] — Трекінг доставки\n" +
		"/stats — Статистика продажів\n" +
		"/promo — Список промокодів\n" +
		"/newpromo [код] [%] — Створити промокод\n" +
		"/import — Імпорт товарів з CSV\n" +
		"/export — Експорт замовлень в CSV\n" +
		"/newcat [назва] — Створити категорію\n" +
		"/delcat [ID] — Видалити категорію\n\n" +
		"❓ *Інше:*\n" +
		"/info — Ця довідка"
	return c.Send(msg, tele.ModeMarkdown)
}

func (h *Handler) OnMyOrders(c tele.Context) error {
	userID := c.Chat().ID
	url := fmt.Sprintf("%s/orders/user/%d", h.OMSURL, userID)

	resp, err := h.Client.Get(url)
	if err != nil {
		return c.Send("Помилка з'єднання з OMS: " + err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Send("Не вдалося отримати ваші замовлення.")
	}

	var orders []Order
	if err := json.NewDecoder(resp.Body).Decode(&orders); err != nil {
		return c.Send("Помилка обробки даних.")
	}

	if len(orders) == 0 {
		return c.Send("У вас поки немає замовлень.")
	}

	msg := "📋 *Ваші останні замовлення:*\n\n"
	for _, o := range orders {
		statusEmoji := map[string]string{
			"NEW":        "🆕",
			"PROCESSING": "⏳",
			"DELIVERED":  "✅",
		}
		emoji := statusEmoji[o.Status]
		if emoji == "" {
			emoji = "📦"
		}
		productDisplay := o.ProductName
		if productDisplay == "" {
			productDisplay = o.ProductID
		}
		msg += fmt.Sprintf("%s *%s*\n📦 Товар: %s\n📊 Кількість: %d\n📍 Статус: %s", emoji, o.ID, productDisplay, o.Quantity, o.Status)
		if o.TrackingNum != "" {
			msg += fmt.Sprintf("\n📮 Трекінг: `%s`", o.TrackingNum)
			if o.DeliveryNote != "" {
				msg += fmt.Sprintf("\n📝 %s", o.DeliveryNote)
			}
		}
		msg += "\n\n"
	}

	return c.Send(msg, tele.ModeMarkdown)
}

func (h *Handler) OnCreate(c tele.Context) error {
	if !h.isAdmin(c.Chat().ID) {
		return c.Send("⛔ Ця команда доступна тільки адміністраторам.")
	}

	args := c.Args()
	if len(args) < 3 {
		return c.Send("Використання: /create [назва] [ціна] [sku]\nПриклад: /create Phone 1000 PH-001")
	}

	name := args[0]
	price := 0.0
	sku := args[2]

	if _, err := fmt.Sscanf(args[1], "%f", &price); err != nil {
		return c.Send("Ціна має бути числом.")
	}

	product := Product{
		Name:  name,
		Price: price,
		SKU:   sku,
	}

	data, err := json.Marshal(product)
	if err != nil {
		return c.Send("Помилка підготовки даних.")
	}

	resp, err := h.Client.Post(h.CoreURL+"/products", "application/json", bytes.NewBuffer(data))
	if err != nil {
		return c.Send("Помилка з'єднання з магазином: " + err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return c.Send("Магазин не зміг створити товар.")
	}

	return c.Send(fmt.Sprintf("✅ Товар *%s* створено!", name), tele.ModeMarkdown)
}

const PageSize = 5

func (h *Handler) OnListProducts(c tele.Context) error {
	// Clear any old page messages first
	h.clearPageMessages(c)
	return h.showProductsPage(c, 0, "", false)
}

// clearPageMessages deletes all tracked pagination messages for this user
func (h *Handler) clearPageMessages(c tele.Context) {
	userID := c.Chat().ID

	h.PageMessagesMu.Lock()
	msgIDs := h.PageMessages[userID]
	h.PageMessages[userID] = nil
	h.PageMessagesMu.Unlock()

	// Delete messages in background
	for _, msgID := range msgIDs {
		msg := &tele.Message{ID: msgID, Chat: c.Chat()}
		h.Bot.Delete(msg)
	}
}

// trackMessage saves a message ID for later deletion
func (h *Handler) trackMessage(userID int64, msgID int) {
	h.PageMessagesMu.Lock()
	h.PageMessages[userID] = append(h.PageMessages[userID], msgID)
	h.PageMessagesMu.Unlock()
}

func (h *Handler) showProductsPage(c tele.Context, page int, categoryID string, deleteOld bool) error {
	userID := c.Chat().ID

	// Delete old messages if navigating
	if deleteOld {
		h.clearPageMessages(c)
	}

	url := h.CoreURL + "/products"
	if categoryID != "" {
		url += "?category_id=" + categoryID
	}

	resp, err := h.Client.Get(url)
	if err != nil {
		return c.Send("Помилка з'єднання з магазином: " + err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Send("Магазин повернув помилку.")
	}

	var products []Product
	if err := json.NewDecoder(resp.Body).Decode(&products); err != nil {
		return c.Send("Помилка обробки даних.")
	}

	if len(products) == 0 {
		return c.Send("Товарів поки немає.")
	}

	totalPages := (len(products) + PageSize - 1) / PageSize
	if page < 0 {
		page = 0
	}
	if page >= totalPages {
		page = totalPages - 1
	}

	start := page * PageSize
	end := start + PageSize
	if end > len(products) {
		end = len(products)
	}

	// Send header with page info
	categoryName := "Всі товари"
	if categoryID != "" && len(products) > 0 && products[0].Category != nil {
		categoryName = products[0].Category.Name
	}
	header := fmt.Sprintf("📦 *%s*\nСторінка %d з %d (всього: %d)", categoryName, page+1, totalPages, len(products))
	headerMsg, _ := h.Bot.Send(c.Chat(), header, tele.ModeMarkdown)
	if headerMsg != nil {
		h.trackMessage(userID, headerMsg.ID)
	}

	// Send products for current page
	for _, p := range products[start:end] {
		msg, err := h.sendProductMessageTracked(c, p)
		if err != nil {
			return err
		}
		if msg != nil {
			h.trackMessage(userID, msg.ID)
		}
	}

	// Send navigation buttons
	keyboard := &tele.ReplyMarkup{}
	var navBtns []tele.Btn

	// Format: "page|categoryID" (categoryID can be empty for all products)
	if page > 0 {
		prevData := fmt.Sprintf("%d|%s", page-1, categoryID)
		navBtns = append(navBtns, keyboard.Data("◀️", "page", prevData))
	}

	if page < totalPages-1 {
		nextData := fmt.Sprintf("%d|%s", page+1, categoryID)
		navBtns = append(navBtns, keyboard.Data("▶️", "page", nextData))
	}

	// Back to menu button
	btnBack := keyboard.Data("🏠 Меню", "back", "")

	var rows []tele.Row
	if len(navBtns) > 0 {
		rows = append(rows, keyboard.Row(navBtns...))
	}
	rows = append(rows, keyboard.Row(btnBack))
	keyboard.Inline(rows...)

	navMsg, _ := h.Bot.Send(c.Chat(), "Навігація:", keyboard)
	if navMsg != nil {
		h.trackMessage(userID, navMsg.ID)
	}

	return nil
}

func (h *Handler) OnPageCallback(c tele.Context) error {
	data := c.Callback().Data
	// Parse "page|categoryID"
	parts := strings.Split(data, "|")
	page := 0
	categoryID := ""

	if len(parts) >= 1 {
		fmt.Sscanf(parts[0], "%d", &page)
	}
	if len(parts) >= 2 {
		categoryID = parts[1]
	}

	c.Respond(&tele.CallbackResponse{Text: fmt.Sprintf("Сторінка %d", page+1)})
	return h.showProductsPage(c, page, categoryID, true)
}

func (h *Handler) sendProductMessage(c tele.Context, p Product) error {
	_, err := h.sendProductMessageTracked(c, p)
	return err
}

func (h *Handler) sendProductMessageTracked(c tele.Context, p Product) (*tele.Message, error) {
	// Stock status
	var stockStatus string
	if p.Stock <= 0 {
		stockStatus = "❌ Немає в наявності"
	} else if p.Stock < 5 {
		stockStatus = fmt.Sprintf("⚠️ Залишилось: %d шт.", p.Stock)
	} else {
		stockStatus = fmt.Sprintf("✅ В наявності: %d шт.", p.Stock)
	}

	categoryName := ""
	if p.Category != nil {
		categoryName = fmt.Sprintf("\n📁 Категорія: %s", p.Category.Name)
	}

	msg := fmt.Sprintf("📦 *%s*\n💰 Ціна: %.2f грн\n🔖 SKU: %s%s\n%s", p.Name, p.Price, p.SKU, categoryName, stockStatus)

	keyboard := &tele.ReplyMarkup{}

	btnReview := keyboard.Data("⭐ Відгук", "review", p.ID)
	if p.Stock > 0 {
		// Only pass product ID to avoid BUTTON_DATA_INVALID (64 byte limit)
		btnAdd := keyboard.Data("🛒 В кошик", "add", p.ID)
		btnBuy := keyboard.Data("💳 Купити", "buy", p.ID)
		keyboard.Inline(
			keyboard.Row(btnAdd, btnBuy),
			keyboard.Row(btnReview),
		)
	} else {
		// Out of stock - show subscribe button
		btnSubscribe := keyboard.Data("🔔 Повідомити", "subscribe", p.ID)
		keyboard.Inline(
			keyboard.Row(btnSubscribe, btnReview),
		)
	}

	// Try to send with photo if image_url is available
	if p.ImageURL != "" {
		photo := &tele.Photo{File: tele.FromURL(p.ImageURL), Caption: msg}
		sentMsg, err := h.Bot.Send(c.Chat(), photo, tele.ModeMarkdown, keyboard)
		if err == nil {
			return sentMsg, nil
		}
		// Photo failed, fall through to send text only
	}

	// Send text message (no photo or photo failed)
	sentMsg, err := h.Bot.Send(c.Chat(), msg, tele.ModeMarkdown, keyboard)
	return sentMsg, err
}

// OnSearchButton handles the search menu button - enters search mode
func (h *Handler) OnSearchButton(c tele.Context) error {
	userID := c.Chat().ID

	h.CheckoutSessionsMu.Lock()
	h.CheckoutSessions[userID] = &CheckoutSession{
		State:     StateAwaitingSearch,
		CreatedAt: time.Now(),
	}
	h.CheckoutSessionsMu.Unlock()

	cancelBtn := &tele.ReplyMarkup{ResizeKeyboard: true}
	cancelBtn.Reply(cancelBtn.Row(cancelBtn.Text("❌ Скасувати")))

	return c.Send("🔍 *Пошук товарів*\n\nВведіть назву товару або ключове слово:", tele.ModeMarkdown, cancelBtn)
}

func (h *Handler) OnSearch(c tele.Context) error {
	args := c.Args()
	if len(args) == 0 {
		return c.Send("Використання: /search [запит]\nПриклад: /search Phone")
	}

	searchQuery := strings.Join(args, " ")
	return h.performSearch(c, searchQuery)
}

func (h *Handler) performSearch(c tele.Context, searchQuery string) error {
	url := fmt.Sprintf("%s/products?search=%s", h.CoreURL, searchQuery)

	resp, err := h.Client.Get(url)
	if err != nil {
		return c.Send("Помилка з'єднання з магазином: " + err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Send("Магазин повернув помилку.")
	}

	var products []Product
	if err := json.NewDecoder(resp.Body).Decode(&products); err != nil {
		return c.Send("Помилка обробки даних.")
	}

	if len(products) == 0 {
		return c.Send(fmt.Sprintf("🔍 За запитом *%s* нічого не знайдено.\n\nСпробуйте інший запит або поверніться в меню.", searchQuery), tele.ModeMarkdown, h.MainMenu())
	}

	c.Send(fmt.Sprintf("🔍 Знайдено *%d* товар(ів) за запитом *%s*:", len(products), searchQuery), tele.ModeMarkdown, h.MainMenu())

	for _, p := range products {
		if err := h.sendProductMessage(c, p); err != nil {
			return err
		}
	}

	return nil
}

func (h *Handler) OnBuyCallback(c tele.Context) error {
	productID := c.Callback().Data
	return h.buyProduct(c, productID)
}

func (h *Handler) buyProduct(c tele.Context, productID string) error {
	req := OrderRequest{
		ProductID: productID,
		Quantity:  1,
		UserID:    c.Chat().ID,
	}

	data, err := json.Marshal(req)
	if err != nil {
		return c.Respond(&tele.CallbackResponse{Text: "Помилка"})
	}

	resp, err := h.Client.Post(h.OMSURL+"/orders", "application/json", bytes.NewBuffer(data))
	if err != nil {
		return c.Respond(&tele.CallbackResponse{Text: "Помилка з'єднання"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		// Read error message
		var errBody []byte
		errBody, _ = io.ReadAll(resp.Body)
		errMsg := string(errBody)
		if strings.Contains(errMsg, "insufficient stock") {
			c.Respond(&tele.CallbackResponse{Text: "❌ Товару немає в наявності"})
			return c.Send("❌ На жаль, цього товару вже немає в наявності.")
		}
		return c.Respond(&tele.CallbackResponse{Text: "Не вдалося створити замовлення"})
	}

	var orderResp OrderResponse
	if err := json.NewDecoder(resp.Body).Decode(&orderResp); err != nil {
		return c.Respond(&tele.CallbackResponse{Text: "Помилка"})
	}

	c.Respond(&tele.CallbackResponse{Text: "✅ Замовлення створено!"})
	return c.Send(fmt.Sprintf("✅ Замовлення *%s* створено!", orderResp.ID), tele.ModeMarkdown)
}

func (h *Handler) OnListOrders(c tele.Context) error {
	if !h.isAdmin(c.Chat().ID) {
		return c.Send("⛔ Ця команда доступна тільки адміністраторам.")
	}

	resp, err := h.Client.Get(h.OMSURL + "/orders")
	if err != nil {
		return c.Send("Помилка з'єднання з OMS: " + err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Send("Не вдалося отримати замовлення.")
	}

	var orders []Order
	if err := json.NewDecoder(resp.Body).Decode(&orders); err != nil {
		return c.Send("Помилка обробки даних.")
	}

	if len(orders) == 0 {
		return c.Send("Замовлень поки немає.")
	}

	for _, o := range orders {
		statusEmoji := map[string]string{
			"NEW":        "🆕",
			"PROCESSING": "⏳",
			"DELIVERED":  "✅",
		}
		emoji := statusEmoji[o.Status]
		if emoji == "" {
			emoji = "📦"
		}

		productDisplay := o.ProductName
		if productDisplay == "" {
			productDisplay = o.ProductID
		}

		msg := fmt.Sprintf("%s *%s*\n📦 Товар: %s\n📊 Кількість: %d\n📍 Статус: *%s*",
			emoji, o.ID, productDisplay, o.Quantity, o.Status)
		if o.Phone != "" {
			msg += fmt.Sprintf("\n📱 Тел: %s", o.Phone)
		}
		if o.Address != "" {
			msg += fmt.Sprintf("\n🏠 Адреса: %s", o.Address)
		}

		keyboard := &tele.ReplyMarkup{}

		var btns []tele.Btn
		if o.Status != "PROCESSING" {
			btns = append(btns, keyboard.Data("⏳ PROCESSING", "status", o.ID+"|PROCESSING"))
		}
		if o.Status != "DELIVERED" {
			btns = append(btns, keyboard.Data("✅ DELIVERED", "status", o.ID+"|DELIVERED"))
		}

		if len(btns) > 0 {
			keyboard.Inline(keyboard.Row(btns...))
		}

		if err := c.Send(msg, tele.ModeMarkdown, keyboard); err != nil {
			return err
		}
	}

	return nil
}

func (h *Handler) OnStatusCallback(c tele.Context) error {
	if !h.isAdmin(c.Sender().ID) {
		return c.Respond(&tele.CallbackResponse{Text: "⛔ Тільки для адміністраторів"})
	}

	data := c.Callback().Data

	// Parse "orderID|status"
	var orderID, newStatus string
	for i := len(data) - 1; i >= 0; i-- {
		if data[i] == '|' {
			orderID = data[:i]
			newStatus = data[i+1:]
			break
		}
	}

	if orderID == "" || newStatus == "" {
		return c.Respond(&tele.CallbackResponse{Text: "Помилка"})
	}

	// Send PATCH request
	body := fmt.Sprintf(`{"status":"%s"}`, newStatus)
	req, _ := http.NewRequest(http.MethodPatch, h.OMSURL+"/orders/"+orderID, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := h.Client.Do(req)
	if err != nil {
		return c.Respond(&tele.CallbackResponse{Text: "Помилка з'єднання"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Respond(&tele.CallbackResponse{Text: "Не вдалося оновити статус"})
	}

	c.Respond(&tele.CallbackResponse{Text: "✅ Статус оновлено!"})
	return c.Send(fmt.Sprintf("✅ Замовлення *%s* → *%s*", orderID, newStatus), tele.ModeMarkdown)
}

func (h *Handler) OnAddToCart(c tele.Context) error {
	productID := c.Callback().Data
	userID := c.Chat().ID

	// Add to cart via Core API
	if err := h.addToCartAPI(userID, productID, 1); err != nil {
		return c.Respond(&tele.CallbackResponse{Text: "Помилка: " + err.Error()})
	}

	// Get updated cart to show count
	items, err := h.getCartFromAPI(userID)
	if err != nil {
		items = []CartItem{}
	}

	// Get product name for message
	resp, err := h.Client.Get(h.CoreURL + "/products/" + productID)
	productName := "Товар"
	if err == nil {
		defer resp.Body.Close()
		var product Product
		if json.NewDecoder(resp.Body).Decode(&product) == nil {
			productName = product.Name
		}
	}

	c.Respond(&tele.CallbackResponse{Text: "✅ Додано в кошик!"})
	return c.Send(fmt.Sprintf("🛒 *%s* додано в кошик!\nВ кошику: %d товар(ів)\n\n/cart — переглянути кошик", productName, len(items)), tele.ModeMarkdown)
}

func (h *Handler) OnCart(c tele.Context) error {
	userID := c.Chat().ID

	// Get cart from API
	items, err := h.getCartFromAPI(userID)
	if err != nil {
		return c.Send("❌ Помилка завантаження кошика")
	}

	if len(items) == 0 {
		return c.Send("🛒 Кошик порожній.\n\n/products — переглянути товари")
	}

	var total float64
	msg := "🛒 *Ваш кошик:*\n\n"
	for _, item := range items {
		itemTotal := item.Price * float64(item.Quantity)
		total += itemTotal
		msg += fmt.Sprintf("• %s × %d = %.2f грн\n", item.Name, item.Quantity, itemTotal)
	}
	msg += fmt.Sprintf("\n💰 *Разом: %.2f грн*", total)

	keyboard := &tele.ReplyMarkup{}
	btnCheckout := keyboard.Data("✅ Оформити замовлення", "checkout", "")
	btnClear := keyboard.Data("🗑 Очистити", "clear", "")
	keyboard.Inline(
		keyboard.Row(btnCheckout),
		keyboard.Row(btnClear),
	)

	return c.Send(msg, tele.ModeMarkdown, keyboard)
}

func (h *Handler) OnCheckout(c tele.Context) error {
	userID := c.Chat().ID

	// Get cart from API
	items, err := h.getCartFromAPI(userID)
	if err != nil || len(items) == 0 {
		return c.Respond(&tele.CallbackResponse{Text: "Кошик порожній"})
	}

	// Start checkout FSM
	h.CheckoutSessionsMu.Lock()
	h.CheckoutSessions[userID] = &CheckoutSession{
		State:     StateAwaitingPhone,
		Items:     items,
		CreatedAt: time.Now(),
	}
	h.CheckoutSessionsMu.Unlock()

	c.Respond(&tele.CallbackResponse{Text: "📝 Оформлення замовлення"})

	// Hide main menu during checkout
	hideMenu := &tele.ReplyMarkup{RemoveKeyboard: true}
	return c.Send("📱 *Крок 1/2: Контактні дані*\n\nВведіть ваш номер телефону:", tele.ModeMarkdown, hideMenu)
}

// OnTextMessage handles all text messages (for FSM)
func (h *Handler) OnTextMessage(c tele.Context) error {
	userID := c.Chat().ID
	text := strings.TrimSpace(c.Text())

	// Handle cancel button
	if text == "❌ Скасувати" {
		h.CheckoutSessionsMu.Lock()
		delete(h.CheckoutSessions, userID)
		h.CheckoutSessionsMu.Unlock()
		return c.Send("🏠 Повернення в головне меню", h.MainMenu())
	}

	// Check if user is in checkout/search flow
	h.CheckoutSessionsMu.RLock()
	session, exists := h.CheckoutSessions[userID]
	h.CheckoutSessionsMu.RUnlock()

	if !exists || session.State == StateNone {
		// No active session - ignore (menu buttons are handled separately)
		return nil
	}

	switch session.State {
	case StateAwaitingPhone:
		return h.handlePhoneInput(c, text)
	case StateAwaitingAddress:
		return h.handleAddressInput(c, text)
	case StateAwaitingPromoCode:
		return h.handlePromoCodeInput(c, text)
	case StateAwaitingSearch:
		return h.handleSearchInput(c, text)
	case StateAwaitingReviewRating:
		return h.handleReviewRating(c, text)
	case StateAwaitingReviewComment:
		return h.handleReviewComment(c, text)
	}

	return nil
}

func (h *Handler) handleSearchInput(c tele.Context, query string) error {
	userID := c.Chat().ID

	// Clear the search state
	h.CheckoutSessionsMu.Lock()
	delete(h.CheckoutSessions, userID)
	h.CheckoutSessionsMu.Unlock()

	// Perform search
	return h.performSearch(c, query)
}

func (h *Handler) handlePhoneInput(c tele.Context, phone string) error {
	userID := c.Chat().ID

	// Basic phone validation
	if len(phone) < 10 {
		return c.Send("❌ Невірний номер телефону. Введіть коректний номер (мін. 10 цифр):")
	}

	h.CheckoutSessionsMu.Lock()
	session := h.CheckoutSessions[userID]
	session.Phone = phone
	session.State = StateAwaitingAddress
	h.CheckoutSessionsMu.Unlock()

	// Show location button
	locationMenu := &tele.ReplyMarkup{ResizeKeyboard: true}
	locationBtn := locationMenu.Location("📍 Надіслати локацію")
	locationMenu.Reply(locationMenu.Row(locationBtn))

	return c.Send("📍 *Крок 2/2: Доставка*\n\nВведіть адресу доставки або надішліть локацію:", tele.ModeMarkdown, locationMenu)
}

func (h *Handler) OnLocation(c tele.Context) error {
	userID := c.Chat().ID
	loc := c.Message().Location

	// Check if user is in address input state
	h.CheckoutSessionsMu.RLock()
	session, exists := h.CheckoutSessions[userID]
	h.CheckoutSessionsMu.RUnlock()

	if !exists || session.State != StateAwaitingAddress {
		return nil // Ignore location if not in checkout
	}

	// Format address from coordinates
	address := fmt.Sprintf("📍 Координати: %.6f, %.6f", loc.Lat, loc.Lng)
	return h.handleAddressInput(c, address)
}

func (h *Handler) handleAddressInput(c tele.Context, address string) error {
	userID := c.Chat().ID

	if len(address) < 10 {
		return c.Send("❌ Адреса занадто коротка. Введіть повну адресу доставки:")
	}

	h.CheckoutSessionsMu.Lock()
	session := h.CheckoutSessions[userID]
	session.Address = address
	session.State = StateAwaitingPromoCode
	h.CheckoutSessionsMu.Unlock()

	// Ask for promo code
	keyboard := &tele.ReplyMarkup{ResizeKeyboard: true}
	keyboard.Reply(keyboard.Row(keyboard.Text("⏭ Пропустити")))

	return c.Send("🏷️ *Крок 3/3: Промокод*\n\nВведіть промокод для знижки або натисніть \"Пропустити\":", tele.ModeMarkdown, keyboard)
}

func (h *Handler) handlePromoCodeInput(c tele.Context, code string) error {
	userID := c.Chat().ID

	h.CheckoutSessionsMu.Lock()
	session := h.CheckoutSessions[userID]
	h.CheckoutSessionsMu.Unlock()

	if session == nil {
		return c.Send("❌ Сесія закінчилась. Почніть замовлення знову.", h.MainMenu())
	}

	// Skip promo code
	if code == "⏭ Пропустити" || code == "" {
		return h.showOrderSummary(c, session)
	}

	// Validate promo code via OMS
	promoReq := fmt.Sprintf(`{"code":"%s"}`, strings.ToUpper(code))
	resp, err := h.Client.Post(h.OMSURL+"/promo/validate", "application/json", bytes.NewBufferString(promoReq))
	if err != nil {
		return c.Send("❌ Помилка перевірки промокоду. Спробуйте ще раз або пропустіть:")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Send("❌ Недійсний промокод. Спробуйте інший або натисніть \"Пропустити\":")
	}

	var promoResp struct {
		Valid    bool    `json:"valid"`
		Discount float64 `json:"discount"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&promoResp); err != nil || !promoResp.Valid {
		return c.Send("❌ Промокод не діє. Спробуйте інший або натисніть \"Пропустити\":")
	}

	// Apply promo code
	h.CheckoutSessionsMu.Lock()
	session.PromoCode = strings.ToUpper(code)
	session.Discount = promoResp.Discount
	h.CheckoutSessionsMu.Unlock()

	c.Send(fmt.Sprintf("✅ Промокод *%s* застосовано! Знижка: *%.0f%%*", session.PromoCode, session.Discount), tele.ModeMarkdown)

	return h.showOrderSummary(c, session)
}

func (h *Handler) showOrderSummary(c tele.Context, session *CheckoutSession) error {
	h.CheckoutSessionsMu.Lock()
	session.State = StateAwaitingConfirm
	h.CheckoutSessionsMu.Unlock()

	// Calculate totals
	var subtotal float64
	itemsMsg := ""
	for _, item := range session.Items {
		itemTotal := item.Price * float64(item.Quantity)
		subtotal += itemTotal
		itemsMsg += fmt.Sprintf("• %s × %d = %.2f грн\n", item.Name, item.Quantity, itemTotal)
	}

	total := subtotal
	discountMsg := ""
	if session.Discount > 0 {
		discountAmount := subtotal * session.Discount / 100
		total = subtotal - discountAmount
		discountMsg = fmt.Sprintf("\n🏷️ *Промокод:* %s (-%.0f%%)\n💸 *Знижка:* -%.2f грн", session.PromoCode, session.Discount, discountAmount)
	}

	msg := fmt.Sprintf("📋 *Підтвердження замовлення*\n\n"+
		"*Товари:*\n%s"+
		"💰 *Сума:* %.2f грн%s\n"+
		"💵 *До сплати: %.2f грн*\n\n"+
		"📱 *Телефон:* %s\n"+
		"📍 *Адреса:* %s\n\n"+
		"Підтвердити замовлення?",
		itemsMsg, subtotal, discountMsg, total, session.Phone, session.Address)

	keyboard := &tele.ReplyMarkup{}
	btnConfirm := keyboard.Data("✅ Підтвердити", "confirm_order", "")
	btnCancel := keyboard.Data("❌ Скасувати", "cancel_order", "")
	keyboard.Inline(
		keyboard.Row(btnConfirm, btnCancel),
	)

	hideKeyboard := &tele.ReplyMarkup{RemoveKeyboard: true}
	c.Send(".", hideKeyboard)
	h.Bot.Delete(c.Message())

	return c.Send(msg, tele.ModeMarkdown, keyboard)
}

func (h *Handler) OnConfirmOrder(c tele.Context) error {
	userID := c.Chat().ID

	h.CheckoutSessionsMu.Lock()
	session := h.CheckoutSessions[userID]
	if session == nil || session.State != StateAwaitingConfirm {
		h.CheckoutSessionsMu.Unlock()
		return c.Respond(&tele.CallbackResponse{Text: "Сесія закінчилась"})
	}
	// Copy session data and clear
	items := session.Items
	phone := session.Phone
	address := session.Address
	promoCode := session.PromoCode
	discount := session.Discount
	delete(h.CheckoutSessions, userID)
	h.CheckoutSessionsMu.Unlock()

	// Clear cart via API
	h.clearCartAPI(userID)

	c.Respond(&tele.CallbackResponse{Text: "⏳ Оформлюємо..."})

	// Create orders for each item
	var orderIDs []string
	var failedItems []string
	for _, item := range items {
		req := map[string]interface{}{
			"product_id": item.ProductID,
			"quantity":   item.Quantity,
			"user_id":    userID,
			"phone":      phone,
			"address":    address,
		}

		data, _ := json.Marshal(req)
		resp, err := h.Client.Post(h.OMSURL+"/orders", "application/json", bytes.NewBuffer(data))
		if err != nil {
			failedItems = append(failedItems, item.Name)
			continue
		}

		if resp.StatusCode != http.StatusCreated {
			errBody, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			if strings.Contains(string(errBody), "insufficient stock") {
				failedItems = append(failedItems, fmt.Sprintf("%s (немає в наявності)", item.Name))
			} else {
				failedItems = append(failedItems, item.Name)
			}
			continue
		}

		var orderResp OrderResponse
		json.NewDecoder(resp.Body).Decode(&orderResp)
		resp.Body.Close()

		if orderResp.ID != "" {
			orderIDs = append(orderIDs, orderResp.ID)
			// Notify admins about new order
			go h.NotifyAdminsNewOrder(Order{
				ID:          orderResp.ID,
				ProductID:   item.ProductID,
				ProductName: item.Name,
				Quantity:    item.Quantity,
				UserID:      userID,
				Phone:       phone,
				Address:     address,
			})
		}
	}

	// Increment promo code usage if order was successful and promo was applied
	if len(orderIDs) > 0 && promoCode != "" {
		go h.incrementPromoUsage(promoCode)
	}

	var msg string
	if len(orderIDs) > 0 {
		msg = fmt.Sprintf("✅ *Замовлення оформлено!*\n\nСтворено замовлень: %d\n📱 Телефон: %s\n📍 Адреса: %s", len(orderIDs), phone, address)
		if discount > 0 {
			msg += fmt.Sprintf("\n🏷️ Промокод: %s (-%.0f%%)", promoCode, discount)
		}
	}
	if len(failedItems) > 0 {
		if msg != "" {
			msg += "\n\n"
		}
		msg += "❌ Не вдалося замовити:\n"
		for _, item := range failedItems {
			msg += "• " + item + "\n"
		}
	}

	if msg == "" {
		msg = "❌ Не вдалося оформити замовлення."
	}

	return c.Send(msg, tele.ModeMarkdown, h.MainMenu())
}

func (h *Handler) OnCancelOrder(c tele.Context) error {
	userID := c.Chat().ID

	h.CheckoutSessionsMu.Lock()
	delete(h.CheckoutSessions, userID)
	h.CheckoutSessionsMu.Unlock()

	c.Respond(&tele.CallbackResponse{Text: "❌ Скасовано"})
	return c.Send("❌ Замовлення скасовано.\n\nВаш кошик залишився без змін.", h.MainMenu())
}

func (h *Handler) OnClearCart(c tele.Context) error {
	userID := c.Chat().ID

	// Clear cart via API
	h.clearCartAPI(userID)

	c.Respond(&tele.CallbackResponse{Text: "🗑 Кошик очищено"})
	return c.Send("🗑 Кошик очищено.\n\n/products — переглянути товари")
}

func splitByPipe(s string) []string {
	var result []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '|' {
			result = append(result, s[start:i])
			start = i + 1
		}
	}
	result = append(result, s[start:])
	return result
}

func (h *Handler) OnStock(c tele.Context) error {
	if !h.isAdmin(c.Chat().ID) {
		return c.Send("⛔ Ця команда доступна тільки адміністраторам.")
	}

	args := c.Args()
	if len(args) < 2 {
		return c.Send("Використання: /stock [ID_товару] [кількість]\nПриклад: /stock abc123 50")
	}

	productID := args[0]
	stock := 0
	if _, err := fmt.Sscanf(args[1], "%d", &stock); err != nil {
		return c.Send("Кількість має бути числом.")
	}

	if stock < 0 {
		return c.Send("Кількість не може бути від'ємною.")
	}

	body := fmt.Sprintf(`{"stock":%d}`, stock)
	req, _ := http.NewRequest(http.MethodPatch, h.CoreURL+"/products/"+productID+"/stock", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := h.Client.Do(req)
	if err != nil {
		return c.Send("Помилка з'єднання з магазином: " + err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Send("Не вдалося оновити залишок. Перевірте ID товару.")
	}

	// Notify subscribers if stock was restored
	if stock > 0 {
		go h.NotifySubscribers(productID, "товар") // TODO: get product name
	}

	return c.Send(fmt.Sprintf("✅ Залишок товару оновлено: *%d* шт.", stock), tele.ModeMarkdown)
}

func (h *Handler) OnSetImage(c tele.Context) error {
	if !h.isAdmin(c.Chat().ID) {
		return c.Send("⛔ Ця команда доступна тільки адміністраторам.")
	}

	args := c.Args()
	if len(args) < 2 {
		return c.Send("Використання: /setimage [ID_товару] [URL_зображення]\nПриклад: /setimage abc123 https://example.com/image.jpg")
	}

	productID := args[0]
	imageURL := args[1]

	body := fmt.Sprintf(`{"image_url":"%s"}`, imageURL)
	req, _ := http.NewRequest(http.MethodPatch, h.CoreURL+"/products/"+productID+"/image", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := h.Client.Do(req)
	if err != nil {
		return c.Send("Помилка з'єднання з магазином: " + err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Send("Не вдалося оновити зображення. Перевірте ID товару.")
	}

	return c.Send("✅ Зображення товару оновлено!")
}

func (h *Handler) OnSubscribe(c tele.Context) error {
	productID := c.Callback().Data
	userID := c.Sender().ID

	h.SubscriptionsMu.Lock()
	// Check if already subscribed
	subscribers := h.Subscriptions[productID]
	for _, id := range subscribers {
		if id == userID {
			h.SubscriptionsMu.Unlock()
			return c.Respond(&tele.CallbackResponse{Text: "🔔 Ви вже підписані на цей товар"})
		}
	}
	h.Subscriptions[productID] = append(subscribers, userID)
	h.SubscriptionsMu.Unlock()

	return c.Respond(&tele.CallbackResponse{Text: "✅ Ви отримаєте сповіщення коли товар з'явиться"})
}

// NotifySubscribers notifies all subscribers when product is back in stock
func (h *Handler) NotifySubscribers(productID, productName string) {
	h.SubscriptionsMu.Lock()
	subscribers := h.Subscriptions[productID]
	delete(h.Subscriptions, productID) // Clear subscriptions after notifying
	h.SubscriptionsMu.Unlock()

	if len(subscribers) == 0 {
		return
	}

	msg := fmt.Sprintf("🔔 *Товар знову в наявності!*\n\n📦 %s\n\nПоспішайте замовити!", productName)
	for _, userID := range subscribers {
		h.Bot.Send(&tele.User{ID: userID}, msg, tele.ModeMarkdown)
	}
}

// Review handlers
func (h *Handler) OnReviewStart(c tele.Context) error {
	productID := c.Callback().Data
	userID := c.Sender().ID

	// Show existing reviews first
	h.ReviewsMu.RLock()
	reviews := h.Reviews[productID]
	h.ReviewsMu.RUnlock()

	msg := "⭐ *Відгуки про товар*\n\n"
	if len(reviews) > 0 {
		var totalRating float64
		for _, r := range reviews {
			totalRating += float64(r.Rating)
			stars := strings.Repeat("⭐", r.Rating)
			msg += fmt.Sprintf("%s\n👤 %s: %s\n\n", stars, r.UserName, r.Comment)
		}
		avg := totalRating / float64(len(reviews))
		msg += fmt.Sprintf("📊 *Середня оцінка: %.1f* (%d відгуків)\n\n", avg, len(reviews))
	} else {
		msg += "Ще немає відгуків.\n\n"
	}
	msg += "Щоб залишити відгук, оберіть оцінку:"

	// Start review FSM
	h.CheckoutSessionsMu.Lock()
	h.CheckoutSessions[userID] = &CheckoutSession{
		State:     StateAwaitingReviewRating,
		ProductID: productID,
		CreatedAt: time.Now(),
	}
	h.CheckoutSessionsMu.Unlock()

	keyboard := &tele.ReplyMarkup{ResizeKeyboard: true}
	keyboard.Reply(
		keyboard.Row(
			keyboard.Text("⭐ 1"), keyboard.Text("⭐⭐ 2"), keyboard.Text("⭐⭐⭐ 3"),
		),
		keyboard.Row(
			keyboard.Text("⭐⭐⭐⭐ 4"), keyboard.Text("⭐⭐⭐⭐⭐ 5"),
		),
		keyboard.Row(keyboard.Text("❌ Скасувати")),
	)

	c.Respond(&tele.CallbackResponse{})
	return c.Send(msg, tele.ModeMarkdown, keyboard)
}

func (h *Handler) handleReviewRating(c tele.Context, text string) error {
	userID := c.Chat().ID

	// Parse rating from button text
	var rating int
	switch {
	case strings.Contains(text, "⭐⭐⭐⭐⭐"):
		rating = 5
	case strings.Contains(text, "⭐⭐⭐⭐"):
		rating = 4
	case strings.Contains(text, "⭐⭐⭐"):
		rating = 3
	case strings.Contains(text, "⭐⭐"):
		rating = 2
	case strings.Contains(text, "⭐"):
		rating = 1
	default:
		return c.Send("Оберіть оцінку від 1 до 5 зірок:")
	}

	h.CheckoutSessionsMu.Lock()
	session := h.CheckoutSessions[userID]
	session.Rating = rating
	session.State = StateAwaitingReviewComment
	h.CheckoutSessionsMu.Unlock()

	hideMenu := &tele.ReplyMarkup{RemoveKeyboard: true}
	return c.Send(fmt.Sprintf("Ви обрали: %s\n\nТепер напишіть ваш відгук:", strings.Repeat("⭐", rating)), hideMenu)
}

func (h *Handler) handleReviewComment(c tele.Context, comment string) error {
	userID := c.Chat().ID
	userName := c.Sender().FirstName

	h.CheckoutSessionsMu.Lock()
	session := h.CheckoutSessions[userID]
	productID := session.ProductID
	rating := session.Rating
	delete(h.CheckoutSessions, userID)
	h.CheckoutSessionsMu.Unlock()

	// Save review
	review := Review{
		ProductID: productID,
		UserID:    userID,
		UserName:  userName,
		Rating:    rating,
		Comment:   comment,
	}

	h.ReviewsMu.Lock()
	h.Reviews[productID] = append(h.Reviews[productID], review)
	h.ReviewsMu.Unlock()

	return c.Send(fmt.Sprintf("✅ Дякуємо за відгук!\n\n%s\n%s", strings.Repeat("⭐", rating), comment), h.MainMenu())
}

type Stats struct {
	TotalOrders     int            `json:"total_orders"`
	OrdersByStatus  map[string]int `json:"orders_by_status"`
	TopProducts     []ProductStat  `json:"top_products"`
	OrdersToday     int            `json:"orders_today"`
	OrdersThisWeek  int            `json:"orders_this_week"`
	OrdersThisMonth int            `json:"orders_this_month"`
}

type ProductStat struct {
	ProductID   string `json:"product_id"`
	ProductName string `json:"product_name"`
	TotalSold   int    `json:"total_sold"`
}

func (h *Handler) OnStats(c tele.Context) error {
	if !h.isAdmin(c.Chat().ID) {
		return c.Send("⛔ Ця команда доступна тільки адміністраторам.")
	}

	resp, err := h.Client.Get(h.OMSURL + "/stats")
	if err != nil {
		return c.Send("Помилка з'єднання з сервісом: " + err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Send("Помилка отримання статистики.")
	}

	var stats Stats
	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		return c.Send("Помилка обробки даних.")
	}

	// Format message
	msg := "📊 *Статистика магазину*\n\n"
	msg += fmt.Sprintf("📦 *Всього замовлень:* %d\n", stats.TotalOrders)
	msg += fmt.Sprintf("📅 Сьогодні: %d\n", stats.OrdersToday)
	msg += fmt.Sprintf("📅 За тиждень: %d\n", stats.OrdersThisWeek)
	msg += fmt.Sprintf("📅 За місяць: %d\n\n", stats.OrdersThisMonth)

	msg += "*По статусах:*\n"
	statusEmoji := map[string]string{"NEW": "🆕", "PROCESSING": "⏳", "DELIVERED": "✅"}
	for status, count := range stats.OrdersByStatus {
		emoji := statusEmoji[status]
		if emoji == "" {
			emoji = "📋"
		}
		msg += fmt.Sprintf("%s %s: %d\n", emoji, status, count)
	}

	if len(stats.TopProducts) > 0 {
		msg += "\n*🏆 Топ товарів:*\n"
		for i, p := range stats.TopProducts {
			name := p.ProductName
			if name == "" {
				name = p.ProductID[:8] + "..."
			}
			msg += fmt.Sprintf("%d. %s — %d шт.\n", i+1, name, p.TotalSold)
		}
	}

	return c.Send(msg, tele.ModeMarkdown)
}

type PromoCode struct {
	Code      string  `json:"code"`
	Discount  float64 `json:"discount"`
	MaxUses   int     `json:"max_uses"`
	UsedCount int     `json:"used_count"`
	Active    bool    `json:"active"`
}

func (h *Handler) OnPromo(c tele.Context) error {
	if !h.isAdmin(c.Chat().ID) {
		return c.Send("⛔ Ця команда доступна тільки адміністраторам.")
	}

	resp, err := h.Client.Get(h.OMSURL + "/promo")
	if err != nil {
		return c.Send("Помилка з'єднання з сервісом: " + err.Error())
	}
	defer resp.Body.Close()

	var promos []PromoCode
	json.NewDecoder(resp.Body).Decode(&promos)

	if len(promos) == 0 {
		return c.Send("🏷️ *Промокоди*\n\nНемає активних промокодів.\n\nСтворити: `/newpromo CODE 10`\n(CODE - код, 10 - знижка %)", tele.ModeMarkdown)
	}

	msg := "🏷️ *Промокоди*\n\n"
	for _, p := range promos {
		status := "✅"
		if !p.Active {
			status = "❌"
		}
		uses := "∞"
		if p.MaxUses > 0 {
			uses = fmt.Sprintf("%d/%d", p.UsedCount, p.MaxUses)
		}
		msg += fmt.Sprintf("%s `%s` — %.0f%% (викор: %s)\n", status, p.Code, p.Discount, uses)
	}
	msg += "\nСтворити: `/newpromo CODE 10`"

	return c.Send(msg, tele.ModeMarkdown)
}

func (h *Handler) OnNewPromo(c tele.Context) error {
	if !h.isAdmin(c.Chat().ID) {
		return c.Send("⛔ Ця команда доступна тільки адміністраторам.")
	}

	args := c.Args()
	if len(args) < 2 {
		return c.Send("Використання: /newpromo [КОД] [ЗНИЖКА%] [макс_використань]\nПриклад: /newpromo SALE20 20\nПриклад: /newpromo VIP50 50 10")
	}

	code := strings.ToUpper(args[0])
	var discount float64
	fmt.Sscanf(args[1], "%f", &discount)

	if discount <= 0 || discount > 100 {
		return c.Send("Знижка має бути від 1 до 100%")
	}

	maxUses := 0
	if len(args) >= 3 {
		fmt.Sscanf(args[2], "%d", &maxUses)
	}

	body := fmt.Sprintf(`{"code":"%s","discount":%f,"max_uses":%d}`, code, discount, maxUses)
	resp, err := h.Client.Post(h.OMSURL+"/promo", "application/json", bytes.NewBufferString(body))
	if err != nil {
		return c.Send("Помилка з'єднання з сервісом: " + err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return c.Send("Не вдалося створити промокод (можливо вже існує)")
	}

	uses := "необмежено"
	if maxUses > 0 {
		uses = fmt.Sprintf("%d разів", maxUses)
	}
	return c.Send(fmt.Sprintf("✅ Промокод `%s` створено!\n\n🏷️ Знижка: %.0f%%\n📊 Використань: %s", code, discount, uses), tele.ModeMarkdown)
}

func (h *Handler) OnCategories(c tele.Context) error {
	resp, err := h.Client.Get(h.CoreURL + "/categories")
	if err != nil {
		return c.Send("Помилка з'єднання з магазином: " + err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Send("Магазин повернув помилку.")
	}

	var categories []Category
	if err := json.NewDecoder(resp.Body).Decode(&categories); err != nil {
		return c.Send("Помилка обробки даних.")
	}

	if len(categories) == 0 {
		return c.Send("📁 Категорій поки немає.\n\n/products — переглянути всі товари")
	}

	msg := "📁 *Категорії товарів:*\n\nОберіть категорію щоб переглянути товари:"
	keyboard := &tele.ReplyMarkup{}

	var rows []tele.Row
	for _, cat := range categories {
		btn := keyboard.Data("📁 "+cat.Name, "category", cat.ID)
		rows = append(rows, keyboard.Row(btn))
	}
	// Back to menu button
	btnBack := keyboard.Data("🏠 Меню", "back", "")
	rows = append(rows, keyboard.Row(btnBack))
	keyboard.Inline(rows...)

	return c.Send(msg, tele.ModeMarkdown, keyboard)
}

func (h *Handler) OnCategoryCallback(c tele.Context) error {
	categoryID := c.Callback().Data
	c.Respond(&tele.CallbackResponse{Text: "Завантажую товари..."})
	return h.showProductsPage(c, 0, categoryID, true)
}

func (h *Handler) OnCategoryPageCallback(c tele.Context) error {
	// Same as OnPageCallback, kept for backwards compatibility
	return h.OnPageCallback(c)
}

// OnTrack sets tracking number for an order (admin only)
func (h *Handler) OnTrack(c tele.Context) error {
	if !h.isAdmin(c.Chat().ID) {
		return c.Send("⛔ Ця команда доступна тільки адміністраторам.")
	}

	args := c.Args()
	if len(args) < 2 {
		return c.Send("Використання: /track [ID_замовлення] [номер_відстеження] [примітка]\nПриклад: /track abc123 NP20450123456789\nПриклад: /track abc123 NP20450123456789 Нова Пошта, відділення 5")
	}

	orderID := args[0]
	trackingNum := args[1]
	deliveryNote := ""
	if len(args) > 2 {
		deliveryNote = strings.Join(args[2:], " ")
	}

	body := fmt.Sprintf(`{"tracking_num":"%s","delivery_note":"%s"}`, trackingNum, deliveryNote)
	req, _ := http.NewRequest(http.MethodPatch, h.OMSURL+"/orders/"+orderID+"/tracking", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := h.Client.Do(req)
	if err != nil {
		return c.Send("Помилка з'єднання з сервісом: " + err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Send("Не вдалося оновити трекінг. Перевірте ID замовлення.")
	}

	// Get order details to notify customer
	orderResp, err := h.Client.Get(h.OMSURL + "/orders/" + orderID)
	if err == nil && orderResp.StatusCode == http.StatusOK {
		var order struct {
			UserID int64 `json:"user_id"`
		}
		json.NewDecoder(orderResp.Body).Decode(&order)
		orderResp.Body.Close()

		// Notify customer
		if order.UserID > 0 {
			notifyMsg := fmt.Sprintf("📦 *Ваше замовлення відправлено!*\n\n🔖 Номер: `%s`\n📮 Трекінг: `%s`", orderID, trackingNum)
			if deliveryNote != "" {
				notifyMsg += fmt.Sprintf("\n📝 %s", deliveryNote)
			}
			h.Bot.Send(&tele.User{ID: order.UserID}, notifyMsg, tele.ModeMarkdown)
		}
	}

	msg := fmt.Sprintf("✅ Трекінг оновлено!\n\n🔖 Замовлення: `%s`\n📮 Трекінг: `%s`", orderID, trackingNum)
	if deliveryNote != "" {
		msg += fmt.Sprintf("\n📝 Примітка: %s", deliveryNote)
	}
	return c.Send(msg, tele.ModeMarkdown)
}

// OnImport starts CSV import flow (admin only)
func (h *Handler) OnImport(c tele.Context) error {
	if !h.isAdmin(c.Chat().ID) {
		return c.Send("⛔ Ця команда доступна тільки адміністраторам.")
	}

	userID := c.Chat().ID

	h.CheckoutSessionsMu.Lock()
	h.CheckoutSessions[userID] = &CheckoutSession{
		State:     StateAwaitingImportCSV,
		CreatedAt: time.Now(),
	}
	h.CheckoutSessionsMu.Unlock()

	cancelBtn := &tele.ReplyMarkup{ResizeKeyboard: true}
	cancelBtn.Reply(cancelBtn.Row(cancelBtn.Text("❌ Скасувати")))

	msg := "📥 *Імпорт товарів з CSV*\n\n" +
		"Надішліть CSV файл з товарами.\n\n" +
		"*Формат CSV:*\n" +
		"`name,price,sku,stock,category_id`\n\n" +
		"*Приклад:*\n" +
		"```\n" +
		"iPhone 15,35000,IP15-001,10,\n" +
		"MacBook Pro,75000,MBP-001,5,cat-uuid\n" +
		"```"

	return c.Send(msg, tele.ModeMarkdown, cancelBtn)
}

// OnDocument handles document uploads (CSV import)
func (h *Handler) OnDocument(c tele.Context) error {
	userID := c.Chat().ID

	// Check if awaiting import
	h.CheckoutSessionsMu.RLock()
	session, exists := h.CheckoutSessions[userID]
	h.CheckoutSessionsMu.RUnlock()

	if !exists || session.State != StateAwaitingImportCSV {
		return nil // Ignore document if not in import mode
	}

	if !h.isAdmin(userID) {
		return c.Send("⛔ Ця команда доступна тільки адміністраторам.")
	}

	doc := c.Message().Document
	if doc == nil {
		return c.Send("❌ Не вдалося отримати файл.")
	}

	// Check file extension
	if !strings.HasSuffix(strings.ToLower(doc.FileName), ".csv") {
		return c.Send("❌ Будь ласка, надішліть файл у форматі CSV.")
	}

	// Clear import state
	h.CheckoutSessionsMu.Lock()
	delete(h.CheckoutSessions, userID)
	h.CheckoutSessionsMu.Unlock()

	c.Send("⏳ Обробляю файл...", h.MainMenu())

	// Download file
	file, err := h.Bot.File(&doc.File)
	if err != nil {
		return c.Send("❌ Помилка завантаження файлу: " + err.Error())
	}

	// Read file content
	reader := file
	content, err := io.ReadAll(reader)
	if err != nil {
		return c.Send("❌ Помилка читання файлу: " + err.Error())
	}

	// Parse CSV
	lines := strings.Split(string(content), "\n")
	var imported, failed int
	var errors []string

	for i, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Skip header if present
		if i == 0 && strings.Contains(strings.ToLower(line), "name") {
			continue
		}

		parts := strings.Split(line, ",")
		if len(parts) < 3 {
			failed++
			errors = append(errors, fmt.Sprintf("Рядок %d: недостатньо полів", i+1))
			continue
		}

		name := strings.TrimSpace(parts[0])
		priceStr := strings.TrimSpace(parts[1])
		sku := strings.TrimSpace(parts[2])

		var price float64
		if _, err := fmt.Sscanf(priceStr, "%f", &price); err != nil {
			failed++
			errors = append(errors, fmt.Sprintf("Рядок %d: невірна ціна", i+1))
			continue
		}

		stock := 0
		if len(parts) > 3 {
			fmt.Sscanf(strings.TrimSpace(parts[3]), "%d", &stock)
		}

		categoryID := ""
		if len(parts) > 4 {
			categoryID = strings.TrimSpace(parts[4])
		}

		// Create product
		product := map[string]interface{}{
			"name":  name,
			"price": price,
			"sku":   sku,
			"stock": stock,
		}
		if categoryID != "" {
			product["category_id"] = categoryID
		}

		data, _ := json.Marshal(product)
		resp, err := h.Client.Post(h.CoreURL+"/products", "application/json", bytes.NewBuffer(data))
		if err != nil {
			failed++
			errors = append(errors, fmt.Sprintf("Рядок %d: помилка з'єднання", i+1))
			continue
		}
		resp.Body.Close()

		if resp.StatusCode == http.StatusCreated {
			imported++
		} else {
			failed++
			errors = append(errors, fmt.Sprintf("Рядок %d: %s - не вдалося створити", i+1, sku))
		}
	}

	// Send result
	msg := fmt.Sprintf("📥 *Імпорт завершено*\n\n✅ Імпортовано: %d\n❌ Помилок: %d", imported, failed)
	if len(errors) > 0 && len(errors) <= 5 {
		msg += "\n\n*Деталі помилок:*\n"
		for _, e := range errors {
			msg += "• " + e + "\n"
		}
	} else if len(errors) > 5 {
		msg += fmt.Sprintf("\n\n⚠️ Показано перші 5 помилок з %d", len(errors))
		for _, e := range errors[:5] {
			msg += "\n• " + e
		}
	}

	return c.Send(msg, tele.ModeMarkdown)
}

// OnExport exports orders to CSV (admin only)
func (h *Handler) OnExport(c tele.Context) error {
	if !h.isAdmin(c.Chat().ID) {
		return c.Send("⛔ Ця команда доступна тільки адміністраторам.")
	}

	c.Send("⏳ Генерую експорт замовлень...")

	// Fetch all orders
	resp, err := h.Client.Get(h.OMSURL + "/orders")
	if err != nil {
		return c.Send("❌ Помилка з'єднання з OMS: " + err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Send("❌ Не вдалося отримати замовлення.")
	}

	var orders []struct {
		ID           string  `json:"id"`
		ProductID    string  `json:"product_id"`
		ProductName  string  `json:"product_name"`
		Quantity     int     `json:"quantity"`
		Status       string  `json:"status"`
		UserID       int64   `json:"user_id"`
		Phone        string  `json:"phone"`
		Address      string  `json:"address"`
		TrackingNum  string  `json:"tracking_num"`
		DeliveryNote string  `json:"delivery_note"`
		CreatedAt    string  `json:"created_at"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&orders); err != nil {
		return c.Send("❌ Помилка обробки даних.")
	}

	if len(orders) == 0 {
		return c.Send("📋 Немає замовлень для експорту.")
	}

	// Generate CSV
	var csv strings.Builder
	csv.WriteString("ID,Product,Quantity,Status,Phone,Address,Tracking,Created\n")

	for _, o := range orders {
		productName := o.ProductName
		if productName == "" {
			productName = o.ProductID
		}
		// Escape commas in address
		address := strings.ReplaceAll(o.Address, ",", ";")
		csv.WriteString(fmt.Sprintf("%s,%s,%d,%s,%s,%s,%s,%s\n",
			o.ID, productName, o.Quantity, o.Status, o.Phone, address, o.TrackingNum, o.CreatedAt))
	}

	// Send as document
	fileName := fmt.Sprintf("orders_%s.csv", time.Now().Format("2006-01-02"))
	doc := &tele.Document{
		File:     tele.FromReader(strings.NewReader(csv.String())),
		FileName: fileName,
		Caption:  fmt.Sprintf("📊 Експорт %d замовлень", len(orders)),
	}

	return c.Send(doc)
}

// OnNewCategory creates a new category (admin only)
func (h *Handler) OnNewCategory(c tele.Context) error {
	if !h.isAdmin(c.Chat().ID) {
		return c.Send("⛔ Ця команда доступна тільки адміністраторам.")
	}

	args := c.Args()
	if len(args) == 0 {
		return c.Send("Використання: /newcat [назва категорії]\nПриклад: /newcat Електроніка")
	}

	name := strings.Join(args, " ")

	body := fmt.Sprintf(`{"name":"%s"}`, name)
	resp, err := h.Client.Post(h.CoreURL+"/categories", "application/json", bytes.NewBufferString(body))
	if err != nil {
		return c.Send("❌ Помилка з'єднання з магазином: " + err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return c.Send("❌ Не вдалося створити категорію.")
	}

	var cat Category
	json.NewDecoder(resp.Body).Decode(&cat)

	return c.Send(fmt.Sprintf("✅ Категорію *%s* створено!\n\nID: `%s`", name, cat.ID), tele.ModeMarkdown)
}

// OnDeleteCategory deletes a category (admin only)
func (h *Handler) OnDeleteCategory(c tele.Context) error {
	if !h.isAdmin(c.Chat().ID) {
		return c.Send("⛔ Ця команда доступна тільки адміністраторам.")
	}

	args := c.Args()
	if len(args) == 0 {
		return c.Send("Використання: /delcat [ID категорії]\nПриклад: /delcat abc123-uuid")
	}

	categoryID := args[0]

	req, _ := http.NewRequest(http.MethodDelete, h.CoreURL+"/categories/"+categoryID, nil)
	resp, err := h.Client.Do(req)
	if err != nil {
		return c.Send("❌ Помилка з'єднання з магазином: " + err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return c.Send("❌ Не вдалося видалити категорію. Перевірте ID.")
	}

	return c.Send("✅ Категорію видалено!")
}

// NotifyAdminsNewOrder sends notification to all admins about new order
func (h *Handler) NotifyAdminsNewOrder(order Order) {
	if len(h.AdminIDs) == 0 {
		return
	}

	productName := order.ProductName
	if productName == "" {
		productName = order.ProductID
	}

	msg := fmt.Sprintf("🆕 *Нове замовлення!*\n\n"+
		"🔖 ID: `%s`\n"+
		"📦 Товар: %s\n"+
		"📊 Кількість: %d\n"+
		"👤 User ID: %d",
		order.ID, productName, order.Quantity, order.UserID)

	if order.Phone != "" {
		msg += fmt.Sprintf("\n📱 Телефон: %s", order.Phone)
	}
	if order.Address != "" {
		msg += fmt.Sprintf("\n📍 Адреса: %s", order.Address)
	}

	for _, adminID := range h.AdminIDs {
		h.Bot.Send(&tele.User{ID: adminID}, msg, tele.ModeMarkdown)
	}
}

// incrementPromoUsage increments the usage count of a promo code
func (h *Handler) incrementPromoUsage(code string) {
	body := fmt.Sprintf(`{"code":"%s"}`, code)
	req, _ := http.NewRequest(http.MethodPost, h.OMSURL+"/promo/use", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := h.Client.Do(req)
	if err != nil {
		return
	}
	resp.Body.Close()
}
