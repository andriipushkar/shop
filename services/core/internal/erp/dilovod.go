package erp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const dilovodAPIURL = "https://dilovod.com/api/v1"

// DilovodClient implements Dilovod.com integration
// Dilovod is Ukrainian cloud-based accounting/ERP system
type DilovodClient struct {
	apiKey     string
	companyID  string
	httpClient *http.Client
}

// NewDilovodClient creates Dilovod client
func NewDilovodClient(apiKey, companyID string) *DilovodClient {
	return &DilovodClient{
		apiKey:     apiKey,
		companyID:  companyID,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Name returns provider name
func (c *DilovodClient) Name() string { return "dilovod" }

// GetProducts returns products from Dilovod
func (c *DilovodClient) GetProducts(ctx context.Context, updatedSince *time.Time) ([]Product, error) {
	params := map[string]interface{}{
		"limit": 1000,
	}

	if updatedSince != nil {
		params["modified_after"] = updatedSince.Format("2006-01-02T15:04:05")
	}

	resp, err := c.doRequest(ctx, "GET", "/products", params)
	if err != nil {
		return nil, err
	}

	products := make([]Product, 0)

	if data, ok := resp["data"].([]interface{}); ok {
		for _, item := range data {
			itemMap := item.(map[string]interface{})

			product := Product{
				ExternalID: getString(itemMap, "id"),
				SKU:        getString(itemMap, "sku"),
				Name:       getString(itemMap, "name"),
				Barcode:    getString(itemMap, "barcode"),
				Unit:       getString(itemMap, "unit"),
				IsActive:   itemMap["is_active"] != false,
			}

			if price, ok := itemMap["price"].(float64); ok {
				product.Price = price
			}
			if costPrice, ok := itemMap["cost_price"].(float64); ok {
				product.CostPrice = costPrice
			}
			if stock, ok := itemMap["stock"].(float64); ok {
				product.Stock = int(stock)
			}
			if vatRate, ok := itemMap["vat_rate"].(float64); ok {
				product.VATRate = vatRate
			}
			if weight, ok := itemMap["weight"].(float64); ok {
				product.Weight = weight
			}

			if category, ok := itemMap["category"].(map[string]interface{}); ok {
				product.Category = getString(category, "name")
			}

			products = append(products, product)
		}
	}

	return products, nil
}

// GetProduct returns single product
func (c *DilovodClient) GetProduct(ctx context.Context, id string) (*Product, error) {
	resp, err := c.doRequest(ctx, "GET", "/products/"+id, nil)
	if err != nil {
		return nil, err
	}

	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		return nil, ErrNotFound
	}

	product := &Product{
		ExternalID: getString(data, "id"),
		SKU:        getString(data, "sku"),
		Name:       getString(data, "name"),
		Barcode:    getString(data, "barcode"),
		Unit:       getString(data, "unit"),
		IsActive:   data["is_active"] != false,
	}

	if price, ok := data["price"].(float64); ok {
		product.Price = price
	}
	if stock, ok := data["stock"].(float64); ok {
		product.Stock = int(stock)
	}

	return product, nil
}

// CreateProduct creates product in Dilovod
func (c *DilovodClient) CreateProduct(ctx context.Context, product *Product) (*Product, error) {
	payload := map[string]interface{}{
		"name":     product.Name,
		"sku":      product.SKU,
		"barcode":  product.Barcode,
		"price":    product.Price,
		"unit":     product.Unit,
		"vat_rate": product.VATRate,
	}

	if product.Weight > 0 {
		payload["weight"] = product.Weight
	}
	if product.Category != "" {
		payload["category_name"] = product.Category
	}

	resp, err := c.doRequest(ctx, "POST", "/products", payload)
	if err != nil {
		return nil, err
	}

	if data, ok := resp["data"].(map[string]interface{}); ok {
		product.ExternalID = getString(data, "id")
	}

	return product, nil
}

// UpdateProduct updates product in Dilovod
func (c *DilovodClient) UpdateProduct(ctx context.Context, product *Product) error {
	payload := map[string]interface{}{
		"name":    product.Name,
		"sku":     product.SKU,
		"barcode": product.Barcode,
		"price":   product.Price,
	}

	_, err := c.doRequest(ctx, "PUT", "/products/"+product.ExternalID, payload)
	return err
}

// UpdateStock updates stock in Dilovod
func (c *DilovodClient) UpdateStock(ctx context.Context, productID string, warehouseID string, quantity int) error {
	payload := map[string]interface{}{
		"product_id":   productID,
		"warehouse_id": warehouseID,
		"quantity":     quantity,
		"type":         "adjustment",
		"date":         time.Now().Format("2006-01-02"),
	}

	_, err := c.doRequest(ctx, "POST", "/stock/movements", payload)
	return err
}

// GetOrders returns orders from Dilovod
func (c *DilovodClient) GetOrders(ctx context.Context, updatedSince *time.Time) ([]Order, error) {
	params := map[string]interface{}{
		"limit": 1000,
	}

	if updatedSince != nil {
		params["modified_after"] = updatedSince.Format("2006-01-02T15:04:05")
	}

	resp, err := c.doRequest(ctx, "GET", "/orders", params)
	if err != nil {
		return nil, err
	}

	orders := make([]Order, 0)

	if data, ok := resp["data"].([]interface{}); ok {
		for _, item := range data {
			itemMap := item.(map[string]interface{})

			order := Order{
				ExternalID:    getString(itemMap, "id"),
				Number:        getString(itemMap, "number"),
				Status:        getString(itemMap, "status"),
				PaymentStatus: getString(itemMap, "payment_status"),
				Notes:         getString(itemMap, "notes"),
				Currency:      "UAH",
			}

			if dateStr := getString(itemMap, "date"); dateStr != "" {
				if t, err := time.Parse("2006-01-02", dateStr); err == nil {
					order.Date = t
				}
			}

			if total, ok := itemMap["total"].(float64); ok {
				order.Total = total
			}
			if subtotal, ok := itemMap["subtotal"].(float64); ok {
				order.Subtotal = subtotal
			}
			if discount, ok := itemMap["discount"].(float64); ok {
				order.Discount = discount
			}
			if vat, ok := itemMap["vat_amount"].(float64); ok {
				order.VATAmount = vat
			}

			// Customer
			if customer, ok := itemMap["customer"].(map[string]interface{}); ok {
				order.Customer = &Customer{
					ExternalID: getString(customer, "id"),
					Name:       getString(customer, "name"),
					Phone:      getString(customer, "phone"),
					Email:      getString(customer, "email"),
				}
			}

			// Items
			if items, ok := itemMap["items"].([]interface{}); ok {
				order.Items = make([]OrderItem, 0, len(items))
				for _, lineItem := range items {
					if lineMap, ok := lineItem.(map[string]interface{}); ok {
						orderItem := OrderItem{
							ExternalID: getString(lineMap, "product_id"),
							SKU:        getString(lineMap, "sku"),
							Name:       getString(lineMap, "name"),
							Quantity:   getInt(lineMap, "quantity"),
							Price:      getFloat(lineMap, "price"),
							Total:      getFloat(lineMap, "total"),
							VATRate:    getFloat(lineMap, "vat_rate"),
							VATAmount:  getFloat(lineMap, "vat_amount"),
						}
						order.Items = append(order.Items, orderItem)
					}
				}
			}

			orders = append(orders, order)
		}
	}

	return orders, nil
}

// GetOrder returns single order
func (c *DilovodClient) GetOrder(ctx context.Context, id string) (*Order, error) {
	resp, err := c.doRequest(ctx, "GET", "/orders/"+id, nil)
	if err != nil {
		return nil, err
	}

	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		return nil, ErrNotFound
	}

	order := &Order{
		ExternalID: getString(data, "id"),
		Number:     getString(data, "number"),
		Status:     getString(data, "status"),
		Currency:   "UAH",
	}

	if total, ok := data["total"].(float64); ok {
		order.Total = total
	}

	return order, nil
}

// CreateOrder creates order in Dilovod
func (c *DilovodClient) CreateOrder(ctx context.Context, order *Order) (*Order, error) {
	// Ensure customer exists
	customerID := ""
	if order.Customer != nil {
		if order.Customer.ExternalID != "" {
			customerID = order.Customer.ExternalID
		} else {
			customer, err := c.CreateCustomer(ctx, order.Customer)
			if err != nil {
				return nil, err
			}
			customerID = customer.ExternalID
		}
	}

	// Prepare items
	items := make([]map[string]interface{}, len(order.Items))
	for i, item := range order.Items {
		items[i] = map[string]interface{}{
			"product_id": item.ExternalID,
			"quantity":   item.Quantity,
			"price":      item.Price,
		}
		if item.Discount > 0 {
			items[i]["discount"] = item.Discount
		}
	}

	payload := map[string]interface{}{
		"number":      order.Number,
		"date":        order.Date.Format("2006-01-02"),
		"customer_id": customerID,
		"items":       items,
		"notes":       order.Notes,
	}

	if order.Discount > 0 {
		payload["discount"] = order.Discount
	}
	if order.ShippingCost > 0 {
		payload["shipping_cost"] = order.ShippingCost
	}

	resp, err := c.doRequest(ctx, "POST", "/orders", payload)
	if err != nil {
		return nil, err
	}

	if data, ok := resp["data"].(map[string]interface{}); ok {
		order.ExternalID = getString(data, "id")
	}

	return order, nil
}

// UpdateOrderStatus updates order status
func (c *DilovodClient) UpdateOrderStatus(ctx context.Context, orderID string, status string) error {
	payload := map[string]interface{}{
		"status": status,
	}

	_, err := c.doRequest(ctx, "PUT", "/orders/"+orderID, payload)
	return err
}

// GetCustomers returns customers from Dilovod
func (c *DilovodClient) GetCustomers(ctx context.Context, updatedSince *time.Time) ([]Customer, error) {
	params := map[string]interface{}{
		"limit": 1000,
	}

	if updatedSince != nil {
		params["modified_after"] = updatedSince.Format("2006-01-02T15:04:05")
	}

	resp, err := c.doRequest(ctx, "GET", "/customers", params)
	if err != nil {
		return nil, err
	}

	customers := make([]Customer, 0)

	if data, ok := resp["data"].([]interface{}); ok {
		for _, item := range data {
			itemMap := item.(map[string]interface{})

			customer := Customer{
				ExternalID:  getString(itemMap, "id"),
				Name:        getString(itemMap, "name"),
				Phone:       getString(itemMap, "phone"),
				Email:       getString(itemMap, "email"),
				EDRPOU:      getString(itemMap, "edrpou"),
				IPN:         getString(itemMap, "ipn"),
				CompanyName: getString(itemMap, "company_name"),
				IsVATPayer:  itemMap["is_vat_payer"] == true,
			}

			if customer.CompanyName != "" {
				customer.Type = "company"
			} else {
				customer.Type = "individual"
			}

			customers = append(customers, customer)
		}
	}

	return customers, nil
}

// GetCustomer returns single customer
func (c *DilovodClient) GetCustomer(ctx context.Context, id string) (*Customer, error) {
	resp, err := c.doRequest(ctx, "GET", "/customers/"+id, nil)
	if err != nil {
		return nil, err
	}

	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		return nil, ErrNotFound
	}

	customer := &Customer{
		ExternalID:  getString(data, "id"),
		Name:        getString(data, "name"),
		Phone:       getString(data, "phone"),
		Email:       getString(data, "email"),
		EDRPOU:      getString(data, "edrpou"),
		IPN:         getString(data, "ipn"),
		CompanyName: getString(data, "company_name"),
		IsVATPayer:  data["is_vat_payer"] == true,
	}

	return customer, nil
}

// CreateCustomer creates customer in Dilovod
func (c *DilovodClient) CreateCustomer(ctx context.Context, customer *Customer) (*Customer, error) {
	payload := map[string]interface{}{
		"name":  customer.Name,
		"phone": customer.Phone,
		"email": customer.Email,
	}

	if customer.Type == "company" {
		payload["company_name"] = customer.CompanyName
		payload["edrpou"] = customer.EDRPOU
		payload["is_vat_payer"] = customer.IsVATPayer
	} else {
		if customer.IPN != "" {
			payload["ipn"] = customer.IPN
		}
	}

	if customer.Address != nil {
		payload["address"] = map[string]interface{}{
			"city":        customer.Address.City,
			"street":      customer.Address.Street,
			"postal_code": customer.Address.PostalCode,
		}
	}

	resp, err := c.doRequest(ctx, "POST", "/customers", payload)
	if err != nil {
		return nil, err
	}

	if data, ok := resp["data"].(map[string]interface{}); ok {
		customer.ExternalID = getString(data, "id")
	}

	return customer, nil
}

// UpdateCustomer updates customer in Dilovod
func (c *DilovodClient) UpdateCustomer(ctx context.Context, customer *Customer) error {
	payload := map[string]interface{}{
		"name":  customer.Name,
		"phone": customer.Phone,
		"email": customer.Email,
	}

	if customer.EDRPOU != "" {
		payload["edrpou"] = customer.EDRPOU
	}
	if customer.IPN != "" {
		payload["ipn"] = customer.IPN
	}

	_, err := c.doRequest(ctx, "PUT", "/customers/"+customer.ExternalID, payload)
	return err
}

// GetStock returns stock from Dilovod
func (c *DilovodClient) GetStock(ctx context.Context, warehouseID string) ([]ProductStock, error) {
	params := map[string]interface{}{
		"limit": 10000,
	}

	if warehouseID != "" {
		params["warehouse_id"] = warehouseID
	}

	resp, err := c.doRequest(ctx, "GET", "/stock", params)
	if err != nil {
		return nil, err
	}

	stocks := make([]ProductStock, 0)

	if data, ok := resp["data"].([]interface{}); ok {
		for _, item := range data {
			itemMap := item.(map[string]interface{})

			stock := ProductStock{
				ProductID:   getString(itemMap, "product_id"),
				SKU:         getString(itemMap, "sku"),
				WarehouseID: getString(itemMap, "warehouse_id"),
			}

			if qty, ok := itemMap["quantity"].(float64); ok {
				stock.Quantity = int(qty)
			}
			if reserved, ok := itemMap["reserved"].(float64); ok {
				stock.Reserved = int(reserved)
			}

			stock.Available = stock.Quantity - stock.Reserved

			stocks = append(stocks, stock)
		}
	}

	return stocks, nil
}

// GetWarehouses returns warehouses from Dilovod
func (c *DilovodClient) GetWarehouses(ctx context.Context) ([]Warehouse, error) {
	resp, err := c.doRequest(ctx, "GET", "/warehouses", nil)
	if err != nil {
		return nil, err
	}

	warehouses := make([]Warehouse, 0)

	if data, ok := resp["data"].([]interface{}); ok {
		for _, item := range data {
			itemMap := item.(map[string]interface{})

			warehouse := Warehouse{
				ExternalID: getString(itemMap, "id"),
				Name:       getString(itemMap, "name"),
				Code:       getString(itemMap, "code"),
				IsActive:   itemMap["is_active"] != false,
				IsDefault:  itemMap["is_default"] == true,
			}

			warehouses = append(warehouses, warehouse)
		}
	}

	return warehouses, nil
}

// CreateInvoice creates invoice in Dilovod
func (c *DilovodClient) CreateInvoice(ctx context.Context, invoice *Invoice) (*Invoice, error) {
	items := make([]map[string]interface{}, len(invoice.Items))
	for i, item := range invoice.Items {
		items[i] = map[string]interface{}{
			"product_id": item.ExternalID,
			"quantity":   item.Quantity,
			"price":      item.Price,
			"vat_rate":   item.VATRate,
		}
	}

	payload := map[string]interface{}{
		"number":      invoice.Number,
		"date":        invoice.Date.Format("2006-01-02"),
		"customer_id": invoice.CustomerID,
		"items":       items,
		"currency":    invoice.Currency,
	}

	if invoice.OrderID != "" {
		payload["order_id"] = invoice.OrderID
	}
	if invoice.DueDate != nil {
		payload["due_date"] = invoice.DueDate.Format("2006-01-02")
	}

	resp, err := c.doRequest(ctx, "POST", "/invoices", payload)
	if err != nil {
		return nil, err
	}

	if data, ok := resp["data"].(map[string]interface{}); ok {
		invoice.ExternalID = getString(data, "id")
	}

	return invoice, nil
}

// CreatePayment creates payment in Dilovod
func (c *DilovodClient) CreatePayment(ctx context.Context, invoiceID string, amount float64, paymentMethod string) error {
	payload := map[string]interface{}{
		"invoice_id":     invoiceID,
		"amount":         amount,
		"date":           time.Now().Format("2006-01-02"),
		"payment_method": paymentMethod,
	}

	_, err := c.doRequest(ctx, "POST", "/payments", payload)
	return err
}

// GetReports returns available reports
func (c *DilovodClient) GetReports(ctx context.Context, reportType string, dateFrom, dateTo time.Time) (map[string]interface{}, error) {
	params := map[string]interface{}{
		"type":      reportType,
		"date_from": dateFrom.Format("2006-01-02"),
		"date_to":   dateTo.Format("2006-01-02"),
	}

	resp, err := c.doRequest(ctx, "GET", "/reports", params)
	if err != nil {
		return nil, err
	}

	if data, ok := resp["data"].(map[string]interface{}); ok {
		return data, nil
	}

	return nil, nil
}

func (c *DilovodClient) doRequest(ctx context.Context, method, path string, payload interface{}) (map[string]interface{}, error) {
	var body io.Reader
	if payload != nil {
		data, _ := json.Marshal(payload)
		body = bytes.NewReader(data)
	}

	req, _ := http.NewRequestWithContext(ctx, method, dilovodAPIURL+path, body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("X-Company-ID", c.companyID)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("Dilovod error %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	if errMsg, ok := result["error"].(string); ok && errMsg != "" {
		return nil, fmt.Errorf("Dilovod error: %s", errMsg)
	}

	return result, nil
}
