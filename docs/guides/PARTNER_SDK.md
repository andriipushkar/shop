# Partner SDK - Quick Start Guide

Офіційні SDK для інтеграції партнерів з Shop Platform. Інтеграція за 10 хвилин!

## Доступні SDK

| Мова | Пакет | Документація |
|------|-------|--------------|
| Go | `go get github.com/shop/sdk-go` | [Go SDK](#go-sdk) |
| Node.js | `npm install @shop/sdk` | [Node.js SDK](#nodejs-sdk) |
| Python | `pip install shop-sdk` | [Python SDK](#python-sdk) |

## Отримання API ключа

1. Зареєструйтесь як партнер на [partners.shop.com](https://partners.shop.com)
2. Створіть додаток в Dashboard
3. Скопіюйте API ключ

## Go SDK

### Встановлення

```bash
go get github.com/shop/sdk-go/shop
```

### Базове використання

```go
package main

import (
    "context"
    "fmt"
    "log"

    "github.com/shop/sdk-go/shop"
)

func main() {
    // Ініціалізація клієнта
    client := shop.NewClient("sk_your_api_key")

    ctx := context.Background()

    // Створення товару
    product, err := client.Products().Create(ctx, shop.CreateProductInput{
        SKU:         "TSHIRT-001",
        Name:        "Футболка чоловіча",
        Description: "100% бавовна, розмір M",
        Price:       599.00,
        CategoryID:  "cat_clothing",
        Images:      []string{"https://example.com/image.jpg"},
        Inventory:   100,
    })
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Створено товар: %s\n", product.ID)

    // Отримання замовлень
    orders, err := client.Orders().List(ctx, &shop.ListOrdersParams{
        Status: shop.OrderStatusPaid,
        Limit:  10,
    })
    if err != nil {
        log.Fatal(err)
    }

    for _, order := range orders.Items {
        fmt.Printf("Замовлення %s: %s - %.2f %s\n",
            order.OrderNumber, order.Status, order.Total, order.Currency)

        // Оновити статус на "відправлено"
        client.Orders().UpdateStatus(ctx, order.ID, shop.OrderStatusShipped)
        client.Orders().AddTracking(ctx, order.ID, "nova_poshta", "59000000000001")
    }

    // Налаштування webhook
    webhook, err := client.Webhooks().Create(ctx,
        "https://your-site.com/webhooks/shop",
        []string{shop.WebhookEventOrderCreated, shop.WebhookEventOrderPaid},
    )
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Webhook створено: %s (secret: %s)\n", webhook.ID, webhook.Secret)
}
```

## Node.js SDK

### Встановлення

```bash
npm install @shop/sdk
# або
yarn add @shop/sdk
```

### Базове використання

```typescript
import ShopClient, { WebhookEvents, OrderStatus } from '@shop/sdk';

// Ініціалізація клієнта
const client = new ShopClient({
  apiKey: 'sk_your_api_key',
});

async function main() {
  // Створення товару
  const product = await client.products.create({
    sku: 'TSHIRT-001',
    name: 'Футболка чоловіча',
    description: '100% бавовна, розмір M',
    price: 599.00,
    categoryId: 'cat_clothing',
    images: ['https://example.com/image.jpg'],
    inventory: 100,
  });
  console.log(`Створено товар: ${product.id}`);

  // Отримання замовлень
  const orders = await client.orders.list({
    status: 'paid',
    limit: 10,
  });

  for (const order of orders.items) {
    console.log(`Замовлення ${order.orderNumber}: ${order.status} - ${order.total} ${order.currency}`);

    // Оновити статус на "відправлено"
    await client.orders.updateStatus(order.id, 'shipped');
    await client.orders.addTracking(order.id, 'nova_poshta', '59000000000001');
  }

  // Налаштування webhook
  const webhook = await client.webhooks.create(
    'https://your-site.com/webhooks/shop',
    [WebhookEvents.ORDER_CREATED, WebhookEvents.ORDER_PAID]
  );
  console.log(`Webhook створено: ${webhook.id}`);
}

main();
```

### Express.js Webhook Handler

```typescript
import express from 'express';
import { WebhooksAPI } from '@shop/sdk';

const app = express();
const WEBHOOK_SECRET = 'whsec_xxx';

app.post('/webhooks/shop', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-shop-signature'] as string;
  const payload = req.body.toString();

  // Перевірка підпису
  if (!WebhooksAPI.verifySignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(payload);

  switch (event.type) {
    case 'order.created':
      console.log('Нове замовлення:', event.data.order_number);
      break;
    case 'order.paid':
      console.log('Замовлення оплачено:', event.data.order_number);
      // Запустити обробку замовлення
      break;
    case 'inventory.low':
      console.log('Низький запас:', event.data.product_sku);
      // Сповістити менеджера
      break;
  }

  res.status(200).send('OK');
});
```

## Python SDK

### Встановлення

```bash
pip install shop-sdk
```

### Базове використання

```python
from shop import ShopClient, OrderStatus, WebhookEvent

# Ініціалізація клієнта
client = ShopClient(api_key="sk_your_api_key")

# Створення товару
product = client.products.create(
    sku="TSHIRT-001",
    name="Футболка чоловіча",
    description="100% бавовна, розмір M",
    price=599.00,
    category_id="cat_clothing",
    images=["https://example.com/image.jpg"],
    inventory=100,
)
print(f"Створено товар: {product.id}")

# Отримання замовлень
orders = client.orders.list(status=OrderStatus.PAID, limit=10)

for order in orders.items:
    print(f"Замовлення {order.order_number}: {order.status} - {order.total} {order.currency}")

    # Оновити статус на "відправлено"
    client.orders.update_status(order.id, OrderStatus.SHIPPED)
    client.orders.add_tracking(order.id, "nova_poshta", "59000000000001")

# Налаштування webhook
webhook = client.webhooks.create(
    url="https://your-site.com/webhooks/shop",
    events=[WebhookEvent.ORDER_CREATED, WebhookEvent.ORDER_PAID],
)
print(f"Webhook створено: {webhook.id}")
```

### Flask Webhook Handler

```python
from flask import Flask, request, jsonify
from shop import WebhooksAPI

app = Flask(__name__)
WEBHOOK_SECRET = "whsec_xxx"

@app.route("/webhooks/shop", methods=["POST"])
def handle_webhook():
    signature = request.headers.get("X-Shop-Signature")
    payload = request.get_data(as_text=True)

    # Перевірка підпису
    if not WebhooksAPI.verify_signature(payload, signature, WEBHOOK_SECRET):
        return jsonify({"error": "Invalid signature"}), 401

    event = request.get_json()

    if event["type"] == "order.created":
        print(f"Нове замовлення: {event['data']['order_number']}")
    elif event["type"] == "order.paid":
        print(f"Замовлення оплачено: {event['data']['order_number']}")
        # Запустити обробку замовлення
    elif event["type"] == "inventory.low":
        print(f"Низький запас: {event['data']['product_sku']}")
        # Сповістити менеджера

    return jsonify({"status": "ok"}), 200
```

## Типові сценарії інтеграції

### 1. Синхронізація товарів з ERP

```python
# Python приклад
from shop import ShopClient

client = ShopClient(api_key="sk_xxx")

def sync_products_from_erp(erp_products):
    """Синхронізація товарів з ERP системи"""

    for erp_product in erp_products:
        try:
            # Спробувати оновити існуючий товар
            client.products.update(
                erp_product["shop_id"],
                price=erp_product["price"],
                inventory=erp_product["stock"],
            )
        except ShopAPIError as e:
            if e.code == "not_found":
                # Створити новий товар
                client.products.create(
                    sku=erp_product["sku"],
                    name=erp_product["name"],
                    description=erp_product["description"],
                    price=erp_product["price"],
                    category_id=erp_product["category"],
                    inventory=erp_product["stock"],
                )
```

### 2. Автоматична обробка замовлень

```typescript
// Node.js приклад
async function processNewOrders() {
  const orders = await client.orders.list({ status: 'paid' });

  for (const order of orders.items) {
    // Перевірити наявність товарів
    const allAvailable = await checkInventory(order.items);

    if (allAvailable) {
      // Створити відправлення в службі доставки
      const tracking = await createShipment(order);

      // Оновити статус і додати трекінг
      await client.orders.updateStatus(order.id, 'processing');
      await client.orders.addTracking(order.id, tracking.carrier, tracking.number);
    } else {
      // Сповістити про проблему
      await notifyStockIssue(order);
    }
  }
}

// Запускати кожні 5 хвилин
setInterval(processNewOrders, 5 * 60 * 1000);
```

### 3. Інтеграція з маркетплейсом

```go
// Go приклад
func syncToMarketplace(ctx context.Context, client *shop.Client) error {
    products, err := client.Products().List(ctx, &shop.ListProductsParams{
        Status: "active",
        Limit:  100,
    })
    if err != nil {
        return err
    }

    for _, product := range products.Items {
        // Синхронізувати з зовнішнім маркетплейсом (Rozetka, Prom, etc.)
        err := externalMarketplace.UpdateProduct(product.SKU, map[string]any{
            "price":     product.Price,
            "inventory": product.Inventory,
            "available": product.Inventory > 0,
        })
        if err != nil {
            log.Printf("Failed to sync product %s: %v", product.SKU, err)
        }
    }

    return nil
}
```

## Webhook Events

| Event | Опис |
|-------|------|
| `order.created` | Нове замовлення створено |
| `order.paid` | Замовлення оплачено |
| `order.shipped` | Замовлення відправлено |
| `order.delivered` | Замовлення доставлено |
| `order.cancelled` | Замовлення скасовано |
| `product.created` | Товар створено |
| `product.updated` | Товар оновлено |
| `product.deleted` | Товар видалено |
| `inventory.low` | Низький запас товару |

## Rate Limits

| Plan | Requests/minute | Requests/day |
|------|-----------------|--------------|
| Starter | 60 | 10,000 |
| Pro | 300 | 100,000 |
| Enterprise | Custom | Custom |

## Підтримка

- Документація: [docs.shop.com/sdk](https://docs.shop.com/sdk)
- Email: partners@shop.com
- Slack: [shop-partners.slack.com](https://shop-partners.slack.com)
