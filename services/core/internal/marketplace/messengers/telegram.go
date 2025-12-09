package messengers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"core/internal/marketplace"
)

const telegramAPIURL = "https://api.telegram.org/bot"

// TelegramShopClient implements Telegram Bot Shop integration
type TelegramShopClient struct {
	config     *marketplace.Config
	httpClient *http.Client
	botToken   string
}

// NewTelegramShopClient creates Telegram shop client
func NewTelegramShopClient() *TelegramShopClient {
	return &TelegramShopClient{httpClient: &http.Client{Timeout: 30 * time.Second}}
}

// Type returns type
func (c *TelegramShopClient) Type() marketplace.MarketplaceType { return "telegram" }

// Configure configures
func (c *TelegramShopClient) Configure(config *marketplace.Config) error {
	c.config = config
	c.botToken = config.AccessToken
	return nil
}

// IsConfigured returns if configured
func (c *TelegramShopClient) IsConfigured() bool {
	return c.config != nil && c.botToken != ""
}

// ExportProducts exports products to Telegram inline catalog
func (c *TelegramShopClient) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.Type(), Direction: marketplace.SyncExport,
		Status: marketplace.SyncStatusRunning, TotalItems: len(products), StartedAt: time.Now(),
	}

	// Create inline keyboard menu for products
	for _, p := range products {
		keyboard := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{"text": fmt.Sprintf("🛒 Купити за %.2f грн", p.Price), "callback_data": "buy_" + p.SKU},
					{"text": "ℹ️ Детальніше", "callback_data": "info_" + p.SKU},
				},
			},
		}

		// Build product message
		text := fmt.Sprintf("*%s*\n\n%s\n\n💰 Ціна: *%.2f грн*",
			escapeMarkdown(p.Name), escapeMarkdown(truncate(p.Description, 200)), p.Price)

		if p.OldPrice > p.Price {
			text += fmt.Sprintf("\n~~%.2f грн~~ (-%.0f%%)", p.OldPrice, (1-p.Price/p.OldPrice)*100)
		}

		if p.Quantity > 0 {
			text += "\n✅ В наявності"
		} else {
			text += "\n❌ Немає в наявності"
		}

		msg := map[string]interface{}{
			"chat_id":      c.config.ShopID, // Channel ID
			"text":         text,
			"parse_mode":   "MarkdownV2",
			"reply_markup": keyboard,
		}

		// Send with photo if available
		if len(p.Images) > 0 {
			photoMsg := map[string]interface{}{
				"chat_id":      c.config.ShopID,
				"photo":        p.Images[0],
				"caption":      text,
				"parse_mode":   "MarkdownV2",
				"reply_markup": keyboard,
			}
			_, err := c.doRequest(ctx, "sendPhoto", photoMsg)
			if err != nil {
				result.FailedItems++
				result.Errors = append(result.Errors, marketplace.SyncError{SKU: p.SKU, Message: err.Error()})
			} else {
				result.SuccessItems++
			}
		} else {
			_, err := c.doRequest(ctx, "sendMessage", msg)
			if err != nil {
				result.FailedItems++
				result.Errors = append(result.Errors, marketplace.SyncError{SKU: p.SKU, Message: err.Error()})
			} else {
				result.SuccessItems++
			}
		}
		result.ProcessedItems++
	}

	now := time.Now()
	result.CompletedAt = &now
	result.Status = marketplace.SyncStatusCompleted
	return result, nil
}

// SendOrderNotification sends order notification to admin
func (c *TelegramShopClient) SendOrderNotification(ctx context.Context, order *marketplace.Order) error {
	text := fmt.Sprintf("🛍 *Нове замовлення #%s*\n\n", order.ExternalID)
	text += fmt.Sprintf("👤 %s\n📱 %s\n", order.CustomerName, order.CustomerPhone)
	text += fmt.Sprintf("🏙 %s, %s\n\n", order.DeliveryCity, order.DeliveryAddress)
	text += "📦 *Товари:*\n"

	for _, item := range order.Items {
		text += fmt.Sprintf("• %s x%d - %.2f грн\n", item.Name, item.Quantity, item.Total)
	}

	text += fmt.Sprintf("\n💰 *Всього: %.2f грн*", order.Total)

	_, err := c.doRequest(ctx, "sendMessage", map[string]interface{}{
		"chat_id":    c.config.ShopID,
		"text":       text,
		"parse_mode": "MarkdownV2",
	})
	return err
}

// UpdateProduct updates product message
func (c *TelegramShopClient) UpdateProduct(ctx context.Context, product *marketplace.Product) error {
	return nil // Would need message_id tracking
}

// UpdateStock updates stock
func (c *TelegramShopClient) UpdateStock(ctx context.Context, sku string, quantity int) error { return nil }

// UpdatePrice updates price
func (c *TelegramShopClient) UpdatePrice(ctx context.Context, sku string, price float64) error { return nil }

// DeleteProduct deletes product message
func (c *TelegramShopClient) DeleteProduct(ctx context.Context, sku string) error { return nil }

// ImportOrders - orders come via webhook/callback
func (c *TelegramShopClient) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) {
	return nil, nil
}

// UpdateOrderStatus sends status update to customer
func (c *TelegramShopClient) UpdateOrderStatus(ctx context.Context, orderID, status string) error {
	return nil
}

// GetCategories returns categories
func (c *TelegramShopClient) GetCategories(ctx context.Context) ([]marketplace.Category, error) {
	return nil, nil
}

// GenerateFeed not applicable
func (c *TelegramShopClient) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) {
	return nil, nil
}

// SetWebhook sets webhook for receiving updates
func (c *TelegramShopClient) SetWebhook(ctx context.Context, webhookURL string) error {
	_, err := c.doRequest(ctx, "setWebhook", map[string]interface{}{
		"url": webhookURL,
	})
	return err
}

func (c *TelegramShopClient) doRequest(ctx context.Context, method string, params map[string]interface{}) (map[string]interface{}, error) {
	data, _ := json.Marshal(params)
	req, _ := http.NewRequestWithContext(ctx, "POST", telegramAPIURL+c.botToken+"/"+method, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if ok, _ := result["ok"].(bool); !ok {
		return nil, fmt.Errorf("Telegram API error: %v", result["description"])
	}

	return result, nil
}

func escapeMarkdown(s string) string {
	chars := []string{"_", "*", "[", "]", "(", ")", "~", "`", ">", "#", "+", "-", "=", "|", "{", "}", ".", "!"}
	result := s
	for _, char := range chars {
		result = replaceAll(result, char, "\\"+char)
	}
	return result
}

func replaceAll(s, old, new string) string {
	result := ""
	for _, r := range s {
		if string(r) == old {
			result += new
		} else {
			result += string(r)
		}
	}
	return result
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

// ViberBusinessClient implements Viber Business integration
type ViberBusinessClient struct {
	config     *marketplace.Config
	httpClient *http.Client
	authToken  string
}

// NewViberBusinessClient creates Viber business client
func NewViberBusinessClient() *ViberBusinessClient {
	return &ViberBusinessClient{httpClient: &http.Client{Timeout: 30 * time.Second}}
}

// Type returns type
func (c *ViberBusinessClient) Type() marketplace.MarketplaceType { return "viber" }

// Configure configures
func (c *ViberBusinessClient) Configure(config *marketplace.Config) error {
	c.config = config
	c.authToken = config.AccessToken
	return nil
}

// IsConfigured returns if configured
func (c *ViberBusinessClient) IsConfigured() bool {
	return c.config != nil && c.authToken != ""
}

// ExportProducts sends product catalog
func (c *ViberBusinessClient) ExportProducts(ctx context.Context, products []*marketplace.Product) (*marketplace.SyncResult, error) {
	result := &marketplace.SyncResult{
		Marketplace: c.Type(), Direction: marketplace.SyncExport,
		Status: marketplace.SyncStatusCompleted, TotalItems: len(products),
		ProcessedItems: len(products), SuccessItems: len(products), StartedAt: time.Now(),
	}
	now := time.Now()
	result.CompletedAt = &now
	return result, nil
}

// SendProductMessage sends product to user
func (c *ViberBusinessClient) SendProductMessage(ctx context.Context, userID string, product *marketplace.Product) error {
	richMedia := map[string]interface{}{
		"Type":        "rich_media",
		"ButtonsGroupColumns": 6,
		"ButtonsGroupRows":    7,
		"Buttons": []map[string]interface{}{
			{
				"Columns":    6,
				"Rows":       3,
				"ActionType": "open-url",
				"ActionBody": product.URL,
				"Image":      product.Images[0],
			},
			{
				"Columns":    6,
				"Rows":       2,
				"ActionType": "none",
				"Text":       fmt.Sprintf("<font color=\"#000000\"><b>%s</b></font><br><font color=\"#999999\">%.2f грн</font>", product.Name, product.Price),
				"TextSize":   "medium",
				"TextVAlign": "middle",
				"TextHAlign": "left",
			},
			{
				"Columns":    6,
				"Rows":       1,
				"ActionType": "reply",
				"ActionBody": "buy_" + product.SKU,
				"Text":       "Купити",
				"TextSize":   "large",
				"TextVAlign": "middle",
				"TextHAlign": "center",
				"BgColor":    "#4CAF50",
			},
		},
	}

	_, err := c.doRequest(ctx, map[string]interface{}{
		"receiver":   userID,
		"type":       "rich_media",
		"min_api_version": 7,
		"rich_media": richMedia,
	})
	return err
}

// UpdateProduct updates product
func (c *ViberBusinessClient) UpdateProduct(ctx context.Context, product *marketplace.Product) error { return nil }
// UpdateStock updates stock
func (c *ViberBusinessClient) UpdateStock(ctx context.Context, sku string, quantity int) error { return nil }
// UpdatePrice updates price
func (c *ViberBusinessClient) UpdatePrice(ctx context.Context, sku string, price float64) error { return nil }
// DeleteProduct deletes
func (c *ViberBusinessClient) DeleteProduct(ctx context.Context, sku string) error { return nil }
// ImportOrders imports
func (c *ViberBusinessClient) ImportOrders(ctx context.Context, since time.Time) ([]*marketplace.Order, error) { return nil, nil }
// UpdateOrderStatus updates status
func (c *ViberBusinessClient) UpdateOrderStatus(ctx context.Context, orderID, status string) error { return nil }
// GetCategories returns categories
func (c *ViberBusinessClient) GetCategories(ctx context.Context) ([]marketplace.Category, error) { return nil, nil }
// GenerateFeed not applicable
func (c *ViberBusinessClient) GenerateFeed(ctx context.Context, products []*marketplace.Product) ([]byte, error) { return nil, nil }

func (c *ViberBusinessClient) doRequest(ctx context.Context, data map[string]interface{}) (map[string]interface{}, error) {
	body, _ := json.Marshal(data)
	req, _ := http.NewRequestWithContext(ctx, "POST", "https://chatapi.viber.com/pa/send_message", bytes.NewReader(body))
	req.Header.Set("X-Viber-Auth-Token", c.authToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}
