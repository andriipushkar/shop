package bot

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	tele "gopkg.in/telebot.v3"
)

type Product struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
	SKU   string  `json:"sku"`
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
	Client  *http.Client
}

func NewHandler(b *tele.Bot, coreURL, omsURL string) *Handler {
	return &Handler{
		Bot:     b,
		CoreURL: coreURL,
		OMSURL:  omsURL,
		Client:  &http.Client{Timeout: 5 * time.Second},
	}
}

func (h *Handler) RegisterRoutes() {
	h.Bot.Handle("/start", h.OnStart)
	h.Bot.Handle("/products", h.OnListProducts)
	h.Bot.Handle("/create", h.OnCreate)
	h.Bot.Handle("/buy", h.OnBuy)
	h.Bot.Handle("/orders", h.OnListOrders)
	
	// Register callbacks
	btnBuy := tele.Btn{Unique: "buy"}
	h.Bot.Handle(&btnBuy, h.OnBuyCallback)
	
	btnStatus := tele.Btn{Unique: "status"}
	h.Bot.Handle(&btnStatus, h.OnStatusCallback)
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
	return c.Send("Привіт! Я бот магазину.\n\nКоманди:\n/products - список товарів\n/create [назва] [ціна] [sku] - додати товар\n/buy [id] [к-сть] - купити товар")
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

func (h *Handler) OnListProducts(c tele.Context) error {
	resp, err := h.Client.Get(h.CoreURL + "/products")
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

	for _, p := range products {
		msg := fmt.Sprintf("📦 *%s*\n💰 Ціна: %.2f грн\n🔖 SKU: %s", p.Name, p.Price, p.SKU)
		
		keyboard := &tele.ReplyMarkup{}
		btnBuy := keyboard.Data("🛒 Купити", "buy", p.ID)
		keyboard.Inline(
			keyboard.Row(btnBuy),
		)
		
		if err := c.Send(msg, tele.ModeMarkdown, keyboard); err != nil {
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
