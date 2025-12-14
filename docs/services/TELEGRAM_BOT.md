# Telegram Bot Service

Telegram бот для замовлень, сповіщень та взаємодії з клієнтами.

## Огляд

| Властивість | Значення |
|-------------|----------|
| Технологія | Go 1.24 |
| Бібліотека | telebot.v3 |
| База | PostgreSQL (users), Redis (sessions) |

## Функціонал

- Каталог товарів з пошуком
- Кошик та оформлення замовлень
- Відстеження замовлень
- Сповіщення про статус
- Адмін-панель для менеджерів

## Архітектура

```
┌─────────────────────────────────────────────────────────────────┐
│                      TELEGRAM BOT                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Telegram API ◄──────────────────────────────────► Bot Server   │
│       │                                                │         │
│       │  Webhooks / Long Polling                       │         │
│       ▼                                                ▼         │
│  ┌──────────────┐                            ┌──────────────┐   │
│  │   Updates    │                            │   Handlers   │   │
│  │   Handler    │                            │              │   │
│  └──────┬───────┘                            │  /start      │   │
│         │                                    │  /products   │   │
│         ▼                                    │  /cart       │   │
│  ┌──────────────┐                            │  /orders     │   │
│  │     FSM      │◄───────────────────────────│  /admin      │   │
│  │   (States)   │                            └──────────────┘   │
│  └──────┬───────┘                                    │          │
│         │                                            │          │
│         ▼                                            ▼          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │    Redis     │  │  PostgreSQL  │  │   Core/OMS Services  │  │
│  │  (Sessions)  │  │   (Users)    │  │      (HTTP API)      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Команди

### Користувацькі команди

| Команда | Опис |
|---------|------|
| `/start` | Головне меню |
| `/products` | Каталог товарів |
| `/categories` | Категорії |
| `/search` | Пошук товарів |
| `/cart` | Кошик |
| `/orders` | Мої замовлення |
| `/track` | Відстежити замовлення |
| `/help` | Допомога |
| `/settings` | Налаштування |

### Адмін команди

| Команда | Опис |
|---------|------|
| `/admin` | Адмін панель |
| `/stats` | Статистика |
| `/broadcast` | Розсилка |
| `/order [id]` | Деталі замовлення |
| `/user [id]` | Інфо про користувача |

## FSM (Finite State Machine)

### Стани

```go
const (
    StateIdle           = "idle"
    StateBrowsing       = "browsing"
    StateSearching      = "searching"
    StateViewingProduct = "viewing_product"
    StateCart           = "cart"
    StateCheckout       = "checkout"
    StateEnteringPhone  = "entering_phone"
    StateEnteringName   = "entering_name"
    StateSelectingCity  = "selecting_city"
    StateSelectingNP    = "selecting_np"
    StateConfirmOrder   = "confirm_order"
    StateAwaitingPayment = "awaiting_payment"
)
```

### Checkout Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      CHECKOUT FSM                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Cart ──▶ Enter Phone ──▶ Enter Name ──▶ Select City            │
│                                              │                   │
│                                              ▼                   │
│                            Select NP Warehouse ──▶ Confirm      │
│                                                       │          │
│                                                       ▼          │
│                                              Payment / COD       │
│                                                       │          │
│                                                       ▼          │
│                                                Order Created     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Реалізація FSM

```go
type UserState struct {
    State       string                 `json:"state"`
    Data        map[string]interface{} `json:"data"`
    UpdatedAt   time.Time              `json:"updated_at"`
}

// Redis storage
func (b *Bot) GetState(userID int64) (*UserState, error) {
    key := fmt.Sprintf("bot:state:%d", userID)
    data, err := b.redis.Get(ctx, key).Bytes()
    if err == redis.Nil {
        return &UserState{State: StateIdle}, nil
    }
    var state UserState
    json.Unmarshal(data, &state)
    return &state, nil
}

func (b *Bot) SetState(userID int64, state *UserState) error {
    key := fmt.Sprintf("bot:state:%d", userID)
    data, _ := json.Marshal(state)
    return b.redis.Set(ctx, key, data, 24*time.Hour).Err()
}
```

## Inline Keyboards

### Головне меню

```go
func MainMenuKeyboard() *telebot.ReplyMarkup {
    menu := &telebot.ReplyMarkup{}
    menu.Inline(
        menu.Row(
            menu.Data("🛍 Каталог", "catalog"),
            menu.Data("🔍 Пошук", "search"),
        ),
        menu.Row(
            menu.Data("🛒 Кошик", "cart"),
            menu.Data("📦 Замовлення", "orders"),
        ),
        menu.Row(
            menu.Data("⚙️ Налаштування", "settings"),
            menu.Data("❓ Допомога", "help"),
        ),
    )
    return menu
}
```

### Картка товару

```go
func ProductKeyboard(productID string, inCart bool) *telebot.ReplyMarkup {
    menu := &telebot.ReplyMarkup{}

    cartBtn := menu.Data("🛒 Додати в кошик", "add_to_cart", productID)
    if inCart {
        cartBtn = menu.Data("✅ В кошику", "view_cart")
    }

    menu.Inline(
        menu.Row(
            menu.Data("➖", "qty_minus", productID),
            menu.Data("1", "qty_display"),
            menu.Data("➕", "qty_plus", productID),
        ),
        menu.Row(cartBtn),
        menu.Row(
            menu.Data("◀️ Назад", "back_to_category"),
            menu.Data("🏠 Меню", "main_menu"),
        ),
    )
    return menu
}
```

### Пагінація

```go
func PaginationKeyboard(page, totalPages int, prefix string) *telebot.ReplyMarkup {
    menu := &telebot.ReplyMarkup{}

    var buttons []telebot.Btn

    if page > 1 {
        buttons = append(buttons, menu.Data("◀️", prefix+"_page", fmt.Sprint(page-1)))
    }

    buttons = append(buttons, menu.Data(fmt.Sprintf("%d/%d", page, totalPages), "noop"))

    if page < totalPages {
        buttons = append(buttons, menu.Data("▶️", prefix+"_page", fmt.Sprint(page+1)))
    }

    menu.Inline(menu.Row(buttons...))
    return menu
}
```

## Handlers

### Command Handler

```go
func (b *Bot) HandleStart(c telebot.Context) error {
    user := c.Sender()

    // Register or update user
    if err := b.registerUser(user); err != nil {
        log.Error("Failed to register user", "error", err)
    }

    // Reset state
    b.SetState(user.ID, &UserState{State: StateIdle})

    // Send welcome message
    text := fmt.Sprintf("Вітаємо, %s! 👋\n\nОберіть дію:", user.FirstName)
    return c.Send(text, MainMenuKeyboard())
}
```

### Callback Handler

```go
func (b *Bot) HandleCallback(c telebot.Context) error {
    data := c.Callback().Data

    switch {
    case data == "catalog":
        return b.showCategories(c)
    case data == "cart":
        return b.showCart(c)
    case strings.HasPrefix(data, "category_"):
        categoryID := strings.TrimPrefix(data, "category_")
        return b.showProducts(c, categoryID)
    case strings.HasPrefix(data, "product_"):
        productID := strings.TrimPrefix(data, "product_")
        return b.showProduct(c, productID)
    case strings.HasPrefix(data, "add_to_cart_"):
        productID := strings.TrimPrefix(data, "add_to_cart_")
        return b.addToCart(c, productID)
    }

    return c.Respond()
}
```

### Text Handler (FSM)

```go
func (b *Bot) HandleText(c telebot.Context) error {
    user := c.Sender()
    state, _ := b.GetState(user.ID)

    switch state.State {
    case StateSearching:
        return b.handleSearch(c, c.Text())
    case StateEnteringPhone:
        return b.handlePhoneInput(c, c.Text())
    case StateEnteringName:
        return b.handleNameInput(c, c.Text())
    case StateSelectingCity:
        return b.handleCitySearch(c, c.Text())
    default:
        return b.HandleStart(c)
    }
}
```

## Checkout Process

### 1. Запит телефону

```go
func (b *Bot) startCheckout(c telebot.Context) error {
    userID := c.Sender().ID

    // Set state
    b.SetState(userID, &UserState{
        State: StateEnteringPhone,
        Data:  map[string]interface{}{"cart": cart},
    })

    // Request phone with button
    menu := &telebot.ReplyMarkup{ResizeKeyboard: true}
    menu.Reply(
        menu.Row(menu.Contact("📱 Надіслати номер телефону")),
        menu.Row(menu.Text("❌ Скасувати")),
    )

    return c.Send("Введіть або надішліть ваш номер телефону:", menu)
}
```

### 2. Вибір міста (Nova Poshta)

```go
func (b *Bot) handleCitySearch(c telebot.Context, query string) error {
    cities, err := b.novaposhta.SearchCity(query)
    if err != nil {
        return c.Send("Помилка пошуку. Спробуйте ще раз.")
    }

    menu := &telebot.ReplyMarkup{}
    var rows []telebot.Row

    for _, city := range cities {
        btn := menu.Data(city.Description, "select_city", city.Ref)
        rows = append(rows, menu.Row(btn))
    }

    menu.Inline(rows...)
    return c.Send("Оберіть місто:", menu)
}
```

### 3. Вибір відділення

```go
func (b *Bot) showWarehouses(c telebot.Context, cityRef string) error {
    warehouses, _ := b.novaposhta.GetWarehouses(cityRef)

    menu := &telebot.ReplyMarkup{}
    var rows []telebot.Row

    for _, wh := range warehouses[:10] { // First 10
        btn := menu.Data(wh.Description, "select_warehouse", wh.Ref)
        rows = append(rows, menu.Row(btn))
    }

    if len(warehouses) > 10 {
        rows = append(rows, menu.Row(
            menu.Data("Показати більше...", "more_warehouses", cityRef),
        ))
    }

    menu.Inline(rows...)
    return c.Send("Оберіть відділення Нової Пошти:", menu)
}
```

### 4. Підтвердження

```go
func (b *Bot) showOrderConfirmation(c telebot.Context) error {
    state, _ := b.GetState(c.Sender().ID)
    data := state.Data

    text := fmt.Sprintf(`
📋 *Підтвердження замовлення*

👤 *Отримувач:* %s
📱 *Телефон:* %s
🏙 *Місто:* %s
📦 *Відділення:* %s

🛒 *Товари:*
%s

💰 *Всього:* %s ₴

Оберіть спосіб оплати:
    `, data["name"], data["phone"], data["city"], data["warehouse"],
        formatCartItems(data["cart"]), data["total"])

    menu := &telebot.ReplyMarkup{}
    menu.Inline(
        menu.Row(
            menu.Data("💳 Оплатити онлайн", "pay_online"),
            menu.Data("💵 При отриманні", "pay_cod"),
        ),
        menu.Row(menu.Data("❌ Скасувати", "cancel_checkout")),
    )

    return c.Send(text, menu, telebot.ModeMarkdown)
}
```

## Сповіщення

### Order Updates

```go
func (b *Bot) NotifyOrderStatus(userID int64, order *Order) error {
    var text string
    var emoji string

    switch order.Status {
    case "confirmed":
        emoji = "✅"
        text = fmt.Sprintf("%s Замовлення #%s підтверджено!", emoji, order.Number)
    case "shipped":
        emoji = "🚚"
        text = fmt.Sprintf("%s Замовлення #%s відправлено!\n\nТТН: %s",
            emoji, order.Number, order.TrackingNumber)
    case "delivered":
        emoji = "📦"
        text = fmt.Sprintf("%s Замовлення #%s доставлено!", emoji, order.Number)
    }

    menu := &telebot.ReplyMarkup{}
    menu.Inline(
        menu.Row(menu.Data("📋 Деталі замовлення", "order_details", order.ID)),
    )

    _, err := b.bot.Send(&telebot.User{ID: userID}, text, menu)
    return err
}
```

### Event Consumer

```go
func (b *Bot) ConsumeNotifications() {
    consumer.Subscribe("notification.telegram", func(event Event) error {
        var msg TelegramMessage
        json.Unmarshal(event.Data, &msg)

        _, err := b.bot.Send(&telebot.User{ID: msg.ChatID}, msg.Text,
            telebot.ModeMarkdown)
        return err
    })
}
```

## Адмін панель

### Статистика

```go
func (b *Bot) HandleAdminStats(c telebot.Context) error {
    if !b.isAdmin(c.Sender().ID) {
        return c.Send("⛔ Доступ заборонено")
    }

    stats, _ := b.getStats()

    text := fmt.Sprintf(`
📊 *Статистика*

👥 Користувачів: %d
📦 Замовлень сьогодні: %d
💰 Виручка сьогодні: %s ₴

📈 За тиждень:
- Замовлень: %d
- Виручка: %s ₴
    `, stats.Users, stats.OrdersToday, formatMoney(stats.RevenueToday),
        stats.OrdersWeek, formatMoney(stats.RevenueWeek))

    return c.Send(text, telebot.ModeMarkdown)
}
```

### Broadcast

```go
func (b *Bot) HandleBroadcast(c telebot.Context) error {
    if !b.isAdmin(c.Sender().ID) {
        return c.Send("⛔ Доступ заборонено")
    }

    b.SetState(c.Sender().ID, &UserState{State: "admin_broadcast"})
    return c.Send("Введіть повідомлення для розсилки:")
}

func (b *Bot) sendBroadcast(message string) error {
    users, _ := b.getAllActiveUsers()

    var sent, failed int
    for _, user := range users {
        _, err := b.bot.Send(&telebot.User{ID: user.TelegramID}, message)
        if err != nil {
            failed++
        } else {
            sent++
        }
        time.Sleep(50 * time.Millisecond) // Rate limiting
    }

    return nil
}
```

## База даних

### Users Table

```sql
CREATE TABLE telegram_users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(100),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    language_code VARCHAR(10),
    is_blocked BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    customer_id UUID REFERENCES customers(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## Конфігурація

```bash
# Bot
TELEGRAM_BOT_TOKEN=123456:ABC-DEF
TELEGRAM_WEBHOOK_URL=https://api.yourstore.com/telegram/webhook
TELEGRAM_ADMIN_IDS=12345678,87654321

# Services
CORE_SERVICE_URL=http://core:8080
OMS_SERVICE_URL=http://oms:8081

# Nova Poshta
NOVAPOSHTA_API_KEY=your_api_key

# Redis (sessions)
REDIS_URL=redis://localhost:6379
```

## Запуск

```bash
cd services/telegram-bot

# Webhook mode
go run cmd/bot/main.go --mode=webhook

# Long polling mode (development)
go run cmd/bot/main.go --mode=polling
```
