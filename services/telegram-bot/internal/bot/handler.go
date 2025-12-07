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
	ID        string `json:"id"`
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
	Status    string `json:"status"`
	UserID    int64  `json:"user_id"`
}

type Handler struct {
	Bot     *tele.Bot
	CoreURL string
	OMSURL  string
	CRMURL  string
	Client  *http.Client
	Carts   map[int64][]CartItem
	CartMu  sync.RWMutex
	// Track messages for pagination cleanup
	PageMessages   map[int64][]int // userID -> message IDs
	PageMessagesMu sync.RWMutex
}

type CartItem struct {
	ProductID string
	Name      string
	Price     float64
	Quantity  int
}

func NewHandler(b *tele.Bot, coreURL, omsURL, crmURL string) *Handler {
	return &Handler{
		Bot:          b,
		CoreURL:      coreURL,
		OMSURL:       omsURL,
		CRMURL:       crmURL,
		Client:       &http.Client{Timeout: 5 * time.Second},
		Carts:        make(map[int64][]CartItem),
		PageMessages: make(map[int64][]int),
	}
}

func (h *Handler) RegisterRoutes() {
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

	// Register callbacks
	btnAdd := tele.Btn{Unique: "add"}
	h.Bot.Handle(&btnAdd, h.OnAddToCart)

	btnBuy := tele.Btn{Unique: "buy"}
	h.Bot.Handle(&btnBuy, h.OnBuyCallback)

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
	return c.Send("Привіт! Я бот магазину.\n\nНапишіть /info щоб побачити список команд.")
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
		"/stock [ID] [кількість] — Встановити залишок\n\n" +
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
		msg += fmt.Sprintf("%s *%s*\nТовар: %s\nСтатус: %s\n\n", emoji, o.ID, o.ProductID, o.Status)
	}

	return c.Send(msg, tele.ModeMarkdown)
}

func (h *Handler) OnCreate(c tele.Context) error {
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
	var btns []tele.Btn

	// Format: "page|categoryID" (categoryID can be empty for all products)
	if page > 0 {
		prevData := fmt.Sprintf("%d|%s", page-1, categoryID)
		btns = append(btns, keyboard.Data("◀️ Назад", "page", prevData))
	}

	if page < totalPages-1 {
		nextData := fmt.Sprintf("%d|%s", page+1, categoryID)
		btns = append(btns, keyboard.Data("Вперед ▶️", "page", nextData))
	}

	if len(btns) > 0 {
		keyboard.Inline(keyboard.Row(btns...))
		navMsg, _ := h.Bot.Send(c.Chat(), "Навігація:", keyboard)
		if navMsg != nil {
			h.trackMessage(userID, navMsg.ID)
		}
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

	if p.Stock > 0 {
		// Only pass product ID to avoid BUTTON_DATA_INVALID (64 byte limit)
		btnAdd := keyboard.Data("🛒 В кошик", "add", p.ID)
		btnBuy := keyboard.Data("💳 Купити", "buy", p.ID)
		keyboard.Inline(
			keyboard.Row(btnAdd, btnBuy),
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

func (h *Handler) OnSearch(c tele.Context) error {
	args := c.Args()
	if len(args) == 0 {
		return c.Send("Використання: /search [запит]\nПриклад: /search Phone")
	}

	searchQuery := strings.Join(args, " ")
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
		return c.Send(fmt.Sprintf("🔍 За запитом *%s* нічого не знайдено.", searchQuery), tele.ModeMarkdown)
	}

	c.Send(fmt.Sprintf("🔍 Знайдено *%d* товар(ів) за запитом *%s*:", len(products), searchQuery), tele.ModeMarkdown)

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

		msg := fmt.Sprintf("%s *%s*\nТовар: %s\nКількість: %d\nСтатус: *%s*",
			emoji, o.ID, o.ProductID, o.Quantity, o.Status)

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

	// Fetch product details from Core API
	resp, err := h.Client.Get(h.CoreURL + "/products/" + productID)
	if err != nil {
		return c.Respond(&tele.CallbackResponse{Text: "Помилка з'єднання"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Respond(&tele.CallbackResponse{Text: "Товар не знайдено"})
	}

	var product Product
	if err := json.NewDecoder(resp.Body).Decode(&product); err != nil {
		return c.Respond(&tele.CallbackResponse{Text: "Помилка"})
	}

	userID := c.Chat().ID

	h.CartMu.Lock()
	// Check if already in cart
	found := false
	for i, item := range h.Carts[userID] {
		if item.ProductID == productID {
			h.Carts[userID][i].Quantity++
			found = true
			break
		}
	}
	if !found {
		h.Carts[userID] = append(h.Carts[userID], CartItem{
			ProductID: productID,
			Name:      product.Name,
			Price:     product.Price,
			Quantity:  1,
		})
	}
	cartLen := len(h.Carts[userID])
	h.CartMu.Unlock()

	c.Respond(&tele.CallbackResponse{Text: "✅ Додано в кошик!"})
	return c.Send(fmt.Sprintf("🛒 *%s* додано в кошик!\nВ кошику: %d товар(ів)\n\n/cart — переглянути кошик", product.Name, cartLen), tele.ModeMarkdown)
}

func (h *Handler) OnCart(c tele.Context) error {
	userID := c.Chat().ID

	h.CartMu.RLock()
	items := h.Carts[userID]
	h.CartMu.RUnlock()

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

	h.CartMu.Lock()
	items := h.Carts[userID]
	if len(items) == 0 {
		h.CartMu.Unlock()
		return c.Respond(&tele.CallbackResponse{Text: "Кошик порожній"})
	}
	// Copy items and clear cart
	itemsCopy := make([]CartItem, len(items))
	copy(itemsCopy, items)
	h.Carts[userID] = nil
	h.CartMu.Unlock()

	c.Respond(&tele.CallbackResponse{Text: "⏳ Оформлюємо..."})

	// Create orders for each item
	var orderIDs []string
	var failedItems []string
	for _, item := range itemsCopy {
		req := OrderRequest{
			ProductID: item.ProductID,
			Quantity:  item.Quantity,
			UserID:    userID,
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
		}
	}

	var msg string
	if len(orderIDs) > 0 {
		msg = fmt.Sprintf("✅ Замовлення оформлено!\nСтворено замовлень: %d", len(orderIDs))
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
		return c.Send("❌ Не вдалося оформити замовлення.")
	}
	return c.Send(msg)
}

func (h *Handler) OnClearCart(c tele.Context) error {
	userID := c.Chat().ID

	h.CartMu.Lock()
	h.Carts[userID] = nil
	h.CartMu.Unlock()

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

	return c.Send(fmt.Sprintf("✅ Залишок товару оновлено: *%d* шт.", stock), tele.ModeMarkdown)
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
