package erp

import (
	"context"
	"fmt"
	"time"
)

// OneCClient implements 1C:Enterprise integration via OData
// Supports 1C:Підприємство 8.3, 1C:Управління торгівлею, 1C:Бухгалтерія
type OneCClient struct {
	odata       *ODataClient
	config      OneCConfig
}

// OneCConfig represents 1C configuration
type OneCConfig struct {
	BaseURL         string `json:"base_url"`          // http://server/base/odata/standard.odata
	Username        string `json:"username"`
	Password        string `json:"password"`
	DatabaseName    string `json:"database_name"`
	OrganizationRef string `json:"organization_ref"`  // Ref_Key організації
	WarehouseRef    string `json:"warehouse_ref"`     // Ref_Key складу за замовчуванням
	PriceTypeRef    string `json:"price_type_ref"`    // Ref_Key типу цін
}

// NewOneCClient creates 1C client
func NewOneCClient(config OneCConfig) *OneCClient {
	return &OneCClient{
		odata:  NewODataClient(config.BaseURL, config.Username, config.Password),
		config: config,
	}
}

// Name returns provider name
func (c *OneCClient) Name() string { return "1c" }

// GetProducts returns products from 1C catalog
func (c *OneCClient) GetProducts(ctx context.Context, updatedSince *time.Time) ([]Product, error) {
	filter := ""
	if updatedSince != nil {
		filter = fmt.Sprintf("ДатаИзменения gt datetime'%s'", FormatDateTime(*updatedSince))
	}

	// Catalog_Номенклатура - standard 1C products catalog
	data, err := c.odata.Get(ctx, "Catalog_Номенклатура", filter,
		"Ref_Key,Code,Description,Артикул,ЕдиницаИзмерения_Key,ВидНоменклатуры,НоменклатурнаяГруппа,Производитель,Вес,ПометкаУдаления",
		"")
	if err != nil {
		return nil, err
	}

	products := make([]Product, 0, len(data))
	for _, item := range data {
		if item["ПометкаУдаления"] == true {
			continue
		}

		product := Product{
			ExternalID:  getString(item, "Ref_Key"),
			SKU:         getString(item, "Code"),
			Name:        getString(item, "Description"),
			IsActive:    true,
		}

		if sku := getString(item, "Артикул"); sku != "" {
			product.SKU = sku
		}

		if weight, ok := item["Вес"].(float64); ok {
			product.Weight = weight
		}

		// Get price
		if c.config.PriceTypeRef != "" {
			price, _ := c.getProductPrice(ctx, product.ExternalID)
			product.Price = price
		}

		// Get stock
		stock, _ := c.getProductStock(ctx, product.ExternalID, c.config.WarehouseRef)
		product.Stock = stock

		products = append(products, product)
	}

	return products, nil
}

// GetProduct returns single product
func (c *OneCClient) GetProduct(ctx context.Context, id string) (*Product, error) {
	data, err := c.odata.GetByID(ctx, "Catalog_Номенклатура", id)
	if err != nil {
		return nil, err
	}

	product := &Product{
		ExternalID: getString(data, "Ref_Key"),
		SKU:        getString(data, "Code"),
		Name:       getString(data, "Description"),
		IsActive:   data["ПометкаУдаления"] != true,
	}

	if sku := getString(data, "Артикул"); sku != "" {
		product.SKU = sku
	}

	return product, nil
}

// CreateProduct creates product in 1C
func (c *OneCClient) CreateProduct(ctx context.Context, product *Product) (*Product, error) {
	data := map[string]interface{}{
		"Code":        product.SKU,
		"Description": product.Name,
		"Артикул":     product.SKU,
	}

	result, err := c.odata.Create(ctx, "Catalog_Номенклатура", data)
	if err != nil {
		return nil, err
	}

	product.ExternalID = getString(result, "Ref_Key")
	return product, nil
}

// UpdateProduct updates product in 1C
func (c *OneCClient) UpdateProduct(ctx context.Context, product *Product) error {
	data := map[string]interface{}{
		"Description": product.Name,
		"Артикул":     product.SKU,
	}

	return c.odata.Update(ctx, "Catalog_Номенклатура", product.ExternalID, data)
}

// UpdateStock updates stock in 1C (creates adjustment document)
func (c *OneCClient) UpdateStock(ctx context.Context, productID string, warehouseID string, quantity int) error {
	if warehouseID == "" {
		warehouseID = c.config.WarehouseRef
	}

	// This would typically create a stock adjustment document
	// Document_КорректировкаЗапасов
	data := map[string]interface{}{
		"Date":        FormatDateTime(time.Now()),
		"Организация": c.config.OrganizationRef,
		"Склад":       warehouseID,
		"Товары": []map[string]interface{}{
			{
				"Номенклатура": productID,
				"Количество":   quantity,
			},
		},
	}

	_, err := c.odata.Create(ctx, "Document_КорректировкаЗапасов", data)
	return err
}

// GetOrders returns orders from 1C
func (c *OneCClient) GetOrders(ctx context.Context, updatedSince *time.Time) ([]Order, error) {
	filter := ""
	if updatedSince != nil {
		filter = fmt.Sprintf("Date gt datetime'%s'", FormatDateTime(*updatedSince))
	}

	// Document_ЗаказКлиента - Customer order document
	data, err := c.odata.Get(ctx, "Document_ЗаказКлиента", filter,
		"Ref_Key,Number,Date,Контрагент_Key,СуммаДокумента,Статус,Склад_Key,Комментарий,ПометкаУдаления",
		"Товары")
	if err != nil {
		return nil, err
	}

	orders := make([]Order, 0, len(data))
	for _, item := range data {
		if item["ПометкаУдаления"] == true {
			continue
		}

		order := Order{
			ExternalID:  getString(item, "Ref_Key"),
			Number:      getString(item, "Number"),
			Status:      getString(item, "Статус"),
			Notes:       getString(item, "Комментарий"),
			WarehouseID: getString(item, "Склад_Key"),
		}

		if date := ParseDateTime(item["Date"]); date != nil {
			order.Date = *date
		}

		if total, ok := item["СуммаДокумента"].(float64); ok {
			order.Total = total
		}

		// Parse items
		if items, ok := item["Товары"].([]interface{}); ok {
			order.Items = make([]OrderItem, 0, len(items))
			for _, itemData := range items {
				if itemMap, ok := itemData.(map[string]interface{}); ok {
					orderItem := OrderItem{
						ExternalID: getString(itemMap, "Номенклатура_Key"),
						Quantity:   getInt(itemMap, "Количество"),
						Price:      getFloat(itemMap, "Цена"),
						Total:      getFloat(itemMap, "Сумма"),
					}
					order.Items = append(order.Items, orderItem)
				}
			}
		}

		orders = append(orders, order)
	}

	return orders, nil
}

// GetOrder returns single order
func (c *OneCClient) GetOrder(ctx context.Context, id string) (*Order, error) {
	data, err := c.odata.GetByID(ctx, "Document_ЗаказКлиента", id)
	if err != nil {
		return nil, err
	}

	order := &Order{
		ExternalID:  getString(data, "Ref_Key"),
		Number:      getString(data, "Number"),
		Status:      getString(data, "Статус"),
		Notes:       getString(data, "Комментарий"),
	}

	if date := ParseDateTime(data["Date"]); date != nil {
		order.Date = *date
	}

	if total, ok := data["СуммаДокумента"].(float64); ok {
		order.Total = total
	}

	return order, nil
}

// CreateOrder creates order in 1C
func (c *OneCClient) CreateOrder(ctx context.Context, order *Order) (*Order, error) {
	// First, ensure customer exists
	customerRef := ""
	if order.Customer != nil {
		if order.Customer.ExternalID != "" {
			customerRef = order.Customer.ExternalID
		} else {
			customer, err := c.CreateCustomer(ctx, order.Customer)
			if err != nil {
				return nil, err
			}
			customerRef = customer.ExternalID
		}
	}

	// Prepare items
	items := make([]map[string]interface{}, len(order.Items))
	for i, item := range order.Items {
		items[i] = map[string]interface{}{
			"Номенклатура_Key": item.ExternalID,
			"Количество":       item.Quantity,
			"Цена":             item.Price,
			"Сумма":            item.Total,
		}
	}

	data := map[string]interface{}{
		"Date":           FormatDateTime(order.Date),
		"Number":         order.Number,
		"Организация":    c.config.OrganizationRef,
		"Контрагент_Key": customerRef,
		"Склад_Key":      c.config.WarehouseRef,
		"СуммаДокумента": order.Total,
		"Комментарий":    order.Notes,
		"Товары":         items,
	}

	result, err := c.odata.Create(ctx, "Document_ЗаказКлиента", data)
	if err != nil {
		return nil, err
	}

	order.ExternalID = getString(result, "Ref_Key")
	return order, nil
}

// UpdateOrderStatus updates order status
func (c *OneCClient) UpdateOrderStatus(ctx context.Context, orderID string, status string) error {
	data := map[string]interface{}{
		"Статус": status,
	}
	return c.odata.Update(ctx, "Document_ЗаказКлиента", orderID, data)
}

// GetCustomers returns customers from 1C
func (c *OneCClient) GetCustomers(ctx context.Context, updatedSince *time.Time) ([]Customer, error) {
	filter := "ЭтоГруппа eq false"
	if updatedSince != nil {
		filter += fmt.Sprintf(" and ДатаИзменения gt datetime'%s'", FormatDateTime(*updatedSince))
	}

	data, err := c.odata.Get(ctx, "Catalog_Контрагенты", filter,
		"Ref_Key,Code,Description,ИНН,КПП,Телефон,Email,ПометкаУдаления,ЮрФизЛицо",
		"")
	if err != nil {
		return nil, err
	}

	customers := make([]Customer, 0, len(data))
	for _, item := range data {
		if item["ПометкаУдаления"] == true {
			continue
		}

		customer := Customer{
			ExternalID: getString(item, "Ref_Key"),
			Name:       getString(item, "Description"),
			Phone:      getString(item, "Телефон"),
			Email:      getString(item, "Email"),
		}

		if item["ЮрФизЛицо"] == "ЮридическоеЛицо" {
			customer.Type = "company"
			customer.CompanyName = customer.Name
			customer.EDRPOU = getString(item, "ИНН")
		} else {
			customer.Type = "individual"
			customer.IPN = getString(item, "ИНН")
		}

		customers = append(customers, customer)
	}

	return customers, nil
}

// GetCustomer returns single customer
func (c *OneCClient) GetCustomer(ctx context.Context, id string) (*Customer, error) {
	data, err := c.odata.GetByID(ctx, "Catalog_Контрагенты", id)
	if err != nil {
		return nil, err
	}

	customer := &Customer{
		ExternalID: getString(data, "Ref_Key"),
		Name:       getString(data, "Description"),
		Phone:      getString(data, "Телефон"),
		Email:      getString(data, "Email"),
	}

	return customer, nil
}

// CreateCustomer creates customer in 1C
func (c *OneCClient) CreateCustomer(ctx context.Context, customer *Customer) (*Customer, error) {
	data := map[string]interface{}{
		"Description": customer.Name,
		"Телефон":     customer.Phone,
		"Email":       customer.Email,
		"ЭтоГруппа":   false,
	}

	if customer.Type == "company" {
		data["ЮрФизЛицо"] = "ЮридическоеЛицо"
		data["ИНН"] = customer.EDRPOU
		data["Description"] = customer.CompanyName
	} else {
		data["ЮрФизЛицо"] = "ФизическоеЛицо"
		if customer.IPN != "" {
			data["ИНН"] = customer.IPN
		}
	}

	result, err := c.odata.Create(ctx, "Catalog_Контрагенты", data)
	if err != nil {
		return nil, err
	}

	customer.ExternalID = getString(result, "Ref_Key")
	return customer, nil
}

// UpdateCustomer updates customer in 1C
func (c *OneCClient) UpdateCustomer(ctx context.Context, customer *Customer) error {
	data := map[string]interface{}{
		"Description": customer.Name,
		"Телефон":     customer.Phone,
		"Email":       customer.Email,
	}

	return c.odata.Update(ctx, "Catalog_Контрагенты", customer.ExternalID, data)
}

// GetStock returns stock from 1C
func (c *OneCClient) GetStock(ctx context.Context, warehouseID string) ([]ProductStock, error) {
	if warehouseID == "" {
		warehouseID = c.config.WarehouseRef
	}

	// AccumulationRegister_ТоварыНаСкладах - stock register
	filter := fmt.Sprintf("Склад_Key eq guid'%s'", warehouseID)

	data, err := c.odata.Get(ctx, "AccumulationRegister_ТоварыНаСкладах/Balance", filter,
		"Номенклатура_Key,КоличествоBalance",
		"")
	if err != nil {
		return nil, err
	}

	stocks := make([]ProductStock, 0, len(data))
	for _, item := range data {
		stock := ProductStock{
			ProductID:   getString(item, "Номенклатура_Key"),
			WarehouseID: warehouseID,
		}

		if qty, ok := item["КоличествоBalance"].(float64); ok {
			stock.Quantity = int(qty)
			stock.Available = int(qty)
		}

		stocks = append(stocks, stock)
	}

	return stocks, nil
}

// GetWarehouses returns warehouses from 1C
func (c *OneCClient) GetWarehouses(ctx context.Context) ([]Warehouse, error) {
	data, err := c.odata.Get(ctx, "Catalog_Склады", "ПометкаУдаления eq false",
		"Ref_Key,Code,Description",
		"")
	if err != nil {
		return nil, err
	}

	warehouses := make([]Warehouse, 0, len(data))
	for _, item := range data {
		warehouse := Warehouse{
			ExternalID: getString(item, "Ref_Key"),
			Code:       getString(item, "Code"),
			Name:       getString(item, "Description"),
			IsActive:   true,
		}

		warehouses = append(warehouses, warehouse)
	}

	return warehouses, nil
}

// GetPrices returns prices for all products
func (c *OneCClient) GetPrices(ctx context.Context) (map[string]float64, error) {
	filter := fmt.Sprintf("ТипЦен_Key eq guid'%s'", c.config.PriceTypeRef)

	data, err := c.odata.Get(ctx, "InformationRegister_ЦеныНоменклатуры/SliceLast", filter,
		"Номенклатура_Key,Цена",
		"")
	if err != nil {
		return nil, err
	}

	prices := make(map[string]float64)
	for _, item := range data {
		productID := getString(item, "Номенклатура_Key")
		if price, ok := item["Цена"].(float64); ok {
			prices[productID] = price
		}
	}

	return prices, nil
}

func (c *OneCClient) getProductPrice(ctx context.Context, productID string) (float64, error) {
	filter := fmt.Sprintf("Номенклатура_Key eq guid'%s' and ТипЦен_Key eq guid'%s'",
		productID, c.config.PriceTypeRef)

	data, err := c.odata.Get(ctx, "InformationRegister_ЦеныНоменклатуры/SliceLast", filter,
		"Цена", "")
	if err != nil {
		return 0, err
	}

	if len(data) > 0 {
		if price, ok := data[0]["Цена"].(float64); ok {
			return price, nil
		}
	}

	return 0, nil
}

func (c *OneCClient) getProductStock(ctx context.Context, productID, warehouseID string) (int, error) {
	filter := fmt.Sprintf("Номенклатура_Key eq guid'%s'", productID)
	if warehouseID != "" {
		filter += fmt.Sprintf(" and Склад_Key eq guid'%s'", warehouseID)
	}

	data, err := c.odata.Get(ctx, "AccumulationRegister_ТоварыНаСкладах/Balance", filter,
		"КоличествоBalance", "")
	if err != nil {
		return 0, err
	}

	total := 0
	for _, item := range data {
		if qty, ok := item["КоличествоBalance"].(float64); ok {
			total += int(qty)
		}
	}

	return total, nil
}

// Helper functions
func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getFloat(m map[string]interface{}, key string) float64 {
	if v, ok := m[key].(float64); ok {
		return v
	}
	return 0
}

func getInt(m map[string]interface{}, key string) int {
	if v, ok := m[key].(float64); ok {
		return int(v)
	}
	return 0
}
