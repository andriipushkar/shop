package erp

import (
	"context"
	"fmt"
	"time"
)

// BASClient implements BAS (Business Automation Software) integration
// BAS is Ukrainian localization of 1C with specific requirements for Ukrainian accounting
type BASClient struct {
	odata  *ODataClient
	config BASConfig
}

// BASConfig represents BAS configuration
type BASConfig struct {
	BaseURL          string `json:"base_url"`
	Username         string `json:"username"`
	Password         string `json:"password"`
	OrganizationRef  string `json:"organization_ref"`
	WarehouseRef     string `json:"warehouse_ref"`
	PriceTypeRef     string `json:"price_type_ref"`
	CashAccountRef   string `json:"cash_account_ref"`   // Каса для оплат
	BankAccountRef   string `json:"bank_account_ref"`   // Банківський рахунок
	ContractTemplate string `json:"contract_template"`  // Шаблон договору
}

// NewBASClient creates BAS client
func NewBASClient(config BASConfig) *BASClient {
	return &BASClient{
		odata:  NewODataClient(config.BaseURL, config.Username, config.Password),
		config: config,
	}
}

// Name returns provider name
func (c *BASClient) Name() string { return "bas" }

// GetProducts returns products from BAS catalog
func (c *BASClient) GetProducts(ctx context.Context, updatedSince *time.Time) ([]Product, error) {
	filter := "ЕтоГрупа eq false"
	if updatedSince != nil {
		filter += fmt.Sprintf(" and ДатаЗміни gt datetime'%s'", FormatDateTime(*updatedSince))
	}

	// Catalog_Номенклатура - products catalog in BAS
	data, err := c.odata.Get(ctx, "Catalog_Номенклатура", filter,
		"Ref_Key,Код,Найменування,Артикул,ОдиницяВиміру_Key,ВидНоменклатури,НоменклатурнаГрупа,Виробник,Вага,ПозначкаВидалення,СтавкаПДВ",
		"")
	if err != nil {
		return nil, err
	}

	products := make([]Product, 0, len(data))
	for _, item := range data {
		if item["ПозначкаВидалення"] == true {
			continue
		}

		product := Product{
			ExternalID: getString(item, "Ref_Key"),
			SKU:        getString(item, "Код"),
			Name:       getString(item, "Найменування"),
			IsActive:   true,
		}

		if sku := getString(item, "Артикул"); sku != "" {
			product.SKU = sku
		}

		if weight, ok := item["Вага"].(float64); ok {
			product.Weight = weight
		}

		// VAT rate
		vatRate := getString(item, "СтавкаПДВ")
		switch vatRate {
		case "ПДВ20":
			product.VATRate = 20
		case "ПДВ7":
			product.VATRate = 7
		case "БезПДВ":
			product.VATRate = 0
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
func (c *BASClient) GetProduct(ctx context.Context, id string) (*Product, error) {
	data, err := c.odata.GetByID(ctx, "Catalog_Номенклатура", id)
	if err != nil {
		return nil, err
	}

	product := &Product{
		ExternalID: getString(data, "Ref_Key"),
		SKU:        getString(data, "Код"),
		Name:       getString(data, "Найменування"),
		IsActive:   data["ПозначкаВидалення"] != true,
	}

	if sku := getString(data, "Артикул"); sku != "" {
		product.SKU = sku
	}

	return product, nil
}

// CreateProduct creates product in BAS
func (c *BASClient) CreateProduct(ctx context.Context, product *Product) (*Product, error) {
	data := map[string]interface{}{
		"Код":          product.SKU,
		"Найменування": product.Name,
		"Артикул":      product.SKU,
		"ЕтоГрупа":     false,
	}

	// Set VAT rate
	switch {
	case product.VATRate >= 20:
		data["СтавкаПДВ"] = "ПДВ20"
	case product.VATRate >= 7:
		data["СтавкаПДВ"] = "ПДВ7"
	default:
		data["СтавкаПДВ"] = "БезПДВ"
	}

	result, err := c.odata.Create(ctx, "Catalog_Номенклатура", data)
	if err != nil {
		return nil, err
	}

	product.ExternalID = getString(result, "Ref_Key")
	return product, nil
}

// UpdateProduct updates product in BAS
func (c *BASClient) UpdateProduct(ctx context.Context, product *Product) error {
	data := map[string]interface{}{
		"Найменування": product.Name,
		"Артикул":      product.SKU,
	}

	return c.odata.Update(ctx, "Catalog_Номенклатура", product.ExternalID, data)
}

// UpdateStock updates stock in BAS
func (c *BASClient) UpdateStock(ctx context.Context, productID string, warehouseID string, quantity int) error {
	if warehouseID == "" {
		warehouseID = c.config.WarehouseRef
	}

	data := map[string]interface{}{
		"Дата":         FormatDateTime(time.Now()),
		"Організація":  c.config.OrganizationRef,
		"Склад":        warehouseID,
		"Товари": []map[string]interface{}{
			{
				"Номенклатура": productID,
				"Кількість":    quantity,
			},
		},
	}

	_, err := c.odata.Create(ctx, "Document_КоригуванняЗалишків", data)
	return err
}

// GetOrders returns orders from BAS
func (c *BASClient) GetOrders(ctx context.Context, updatedSince *time.Time) ([]Order, error) {
	filter := ""
	if updatedSince != nil {
		filter = fmt.Sprintf("Дата gt datetime'%s'", FormatDateTime(*updatedSince))
	}

	data, err := c.odata.Get(ctx, "Document_ЗамовленняКлієнта", filter,
		"Ref_Key,Номер,Дата,Контрагент_Key,СумаДокумента,Статус,Склад_Key,Коментар,ПозначкаВидалення",
		"Товари")
	if err != nil {
		return nil, err
	}

	orders := make([]Order, 0, len(data))
	for _, item := range data {
		if item["ПозначкаВидалення"] == true {
			continue
		}

		order := Order{
			ExternalID:  getString(item, "Ref_Key"),
			Number:      getString(item, "Номер"),
			Status:      getString(item, "Статус"),
			Notes:       getString(item, "Коментар"),
			WarehouseID: getString(item, "Склад_Key"),
			Currency:    "UAH",
		}

		if date := ParseDateTime(item["Дата"]); date != nil {
			order.Date = *date
		}

		if total, ok := item["СумаДокумента"].(float64); ok {
			order.Total = total
		}

		// Parse items
		if items, ok := item["Товари"].([]interface{}); ok {
			order.Items = make([]OrderItem, 0, len(items))
			for _, itemData := range items {
				if itemMap, ok := itemData.(map[string]interface{}); ok {
					orderItem := OrderItem{
						ExternalID: getString(itemMap, "Номенклатура_Key"),
						Quantity:   getInt(itemMap, "Кількість"),
						Price:      getFloat(itemMap, "Ціна"),
						Total:      getFloat(itemMap, "Сума"),
						VATRate:    getFloat(itemMap, "СтавкаПДВ"),
						VATAmount:  getFloat(itemMap, "СумаПДВ"),
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
func (c *BASClient) GetOrder(ctx context.Context, id string) (*Order, error) {
	data, err := c.odata.GetByID(ctx, "Document_ЗамовленняКлієнта", id)
	if err != nil {
		return nil, err
	}

	order := &Order{
		ExternalID: getString(data, "Ref_Key"),
		Number:     getString(data, "Номер"),
		Status:     getString(data, "Статус"),
		Notes:      getString(data, "Коментар"),
		Currency:   "UAH",
	}

	if date := ParseDateTime(data["Дата"]); date != nil {
		order.Date = *date
	}

	if total, ok := data["СумаДокумента"].(float64); ok {
		order.Total = total
	}

	return order, nil
}

// CreateOrder creates order in BAS
func (c *BASClient) CreateOrder(ctx context.Context, order *Order) (*Order, error) {
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

	// Prepare items with Ukrainian VAT handling
	items := make([]map[string]interface{}, len(order.Items))
	for i, item := range order.Items {
		vatRate := item.VATRate
		if vatRate == 0 {
			vatRate = 20 // Default 20% VAT for Ukraine
		}
		vatAmount := item.Total * vatRate / (100 + vatRate)

		items[i] = map[string]interface{}{
			"Номенклатура_Key": item.ExternalID,
			"Кількість":        item.Quantity,
			"Ціна":             item.Price,
			"Сума":             item.Total,
			"СтавкаПДВ":        fmt.Sprintf("ПДВ%.0f", vatRate),
			"СумаПДВ":          vatAmount,
		}
	}

	data := map[string]interface{}{
		"Дата":            FormatDateTime(order.Date),
		"Номер":           order.Number,
		"Організація":     c.config.OrganizationRef,
		"Контрагент_Key":  customerRef,
		"Склад_Key":       c.config.WarehouseRef,
		"СумаДокумента":   order.Total,
		"Коментар":        order.Notes,
		"Товари":          items,
		"Валюта":          "UAH",
	}

	result, err := c.odata.Create(ctx, "Document_ЗамовленняКлієнта", data)
	if err != nil {
		return nil, err
	}

	order.ExternalID = getString(result, "Ref_Key")
	return order, nil
}

// UpdateOrderStatus updates order status
func (c *BASClient) UpdateOrderStatus(ctx context.Context, orderID string, status string) error {
	data := map[string]interface{}{
		"Статус": status,
	}
	return c.odata.Update(ctx, "Document_ЗамовленняКлієнта", orderID, data)
}

// GetCustomers returns customers from BAS
func (c *BASClient) GetCustomers(ctx context.Context, updatedSince *time.Time) ([]Customer, error) {
	filter := "ЕтоГрупа eq false"
	if updatedSince != nil {
		filter += fmt.Sprintf(" and ДатаЗміни gt datetime'%s'", FormatDateTime(*updatedSince))
	}

	data, err := c.odata.Get(ctx, "Catalog_Контрагенти", filter,
		"Ref_Key,Код,Найменування,ЄДРПОУ,ІПН,Телефон,Email,ПозначкаВидалення,ТипКонтрагента,ПлатникПДВ",
		"")
	if err != nil {
		return nil, err
	}

	customers := make([]Customer, 0, len(data))
	for _, item := range data {
		if item["ПозначкаВидалення"] == true {
			continue
		}

		customer := Customer{
			ExternalID: getString(item, "Ref_Key"),
			Name:       getString(item, "Найменування"),
			Phone:      getString(item, "Телефон"),
			Email:      getString(item, "Email"),
			EDRPOU:     getString(item, "ЄДРПОУ"),
			IPN:        getString(item, "ІПН"),
			IsVATPayer: item["ПлатникПДВ"] == true,
		}

		if item["ТипКонтрагента"] == "ЮридичнаОсоба" {
			customer.Type = "company"
			customer.CompanyName = customer.Name
		} else {
			customer.Type = "individual"
		}

		customers = append(customers, customer)
	}

	return customers, nil
}

// GetCustomer returns single customer
func (c *BASClient) GetCustomer(ctx context.Context, id string) (*Customer, error) {
	data, err := c.odata.GetByID(ctx, "Catalog_Контрагенти", id)
	if err != nil {
		return nil, err
	}

	customer := &Customer{
		ExternalID: getString(data, "Ref_Key"),
		Name:       getString(data, "Найменування"),
		Phone:      getString(data, "Телефон"),
		Email:      getString(data, "Email"),
		EDRPOU:     getString(data, "ЄДРПОУ"),
		IPN:        getString(data, "ІПН"),
	}

	return customer, nil
}

// CreateCustomer creates customer in BAS
func (c *BASClient) CreateCustomer(ctx context.Context, customer *Customer) (*Customer, error) {
	data := map[string]interface{}{
		"Найменування": customer.Name,
		"Телефон":      customer.Phone,
		"Email":        customer.Email,
		"ЕтоГрупа":     false,
	}

	if customer.Type == "company" {
		data["ТипКонтрагента"] = "ЮридичнаОсоба"
		data["ЄДРПОУ"] = customer.EDRPOU
		data["Найменування"] = customer.CompanyName
		data["ПлатникПДВ"] = customer.IsVATPayer
	} else {
		data["ТипКонтрагента"] = "ФізичнаОсоба"
		if customer.IPN != "" {
			data["ІПН"] = customer.IPN
		}
	}

	result, err := c.odata.Create(ctx, "Catalog_Контрагенти", data)
	if err != nil {
		return nil, err
	}

	customer.ExternalID = getString(result, "Ref_Key")
	return customer, nil
}

// UpdateCustomer updates customer in BAS
func (c *BASClient) UpdateCustomer(ctx context.Context, customer *Customer) error {
	data := map[string]interface{}{
		"Найменування": customer.Name,
		"Телефон":      customer.Phone,
		"Email":        customer.Email,
	}

	if customer.EDRPOU != "" {
		data["ЄДРПОУ"] = customer.EDRPOU
	}
	if customer.IPN != "" {
		data["ІПН"] = customer.IPN
	}

	return c.odata.Update(ctx, "Catalog_Контрагенти", customer.ExternalID, data)
}

// GetStock returns stock from BAS
func (c *BASClient) GetStock(ctx context.Context, warehouseID string) ([]ProductStock, error) {
	if warehouseID == "" {
		warehouseID = c.config.WarehouseRef
	}

	filter := fmt.Sprintf("Склад_Key eq guid'%s'", warehouseID)

	data, err := c.odata.Get(ctx, "AccumulationRegister_ЗалишкиТоварів/Balance", filter,
		"Номенклатура_Key,КількістьЗалишок",
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

		if qty, ok := item["КількістьЗалишок"].(float64); ok {
			stock.Quantity = int(qty)
			stock.Available = int(qty)
		}

		stocks = append(stocks, stock)
	}

	return stocks, nil
}

// GetWarehouses returns warehouses from BAS
func (c *BASClient) GetWarehouses(ctx context.Context) ([]Warehouse, error) {
	data, err := c.odata.Get(ctx, "Catalog_Склади", "ПозначкаВидалення eq false",
		"Ref_Key,Код,Найменування",
		"")
	if err != nil {
		return nil, err
	}

	warehouses := make([]Warehouse, 0, len(data))
	for _, item := range data {
		warehouse := Warehouse{
			ExternalID: getString(item, "Ref_Key"),
			Code:       getString(item, "Код"),
			Name:       getString(item, "Найменування"),
			IsActive:   true,
		}

		warehouses = append(warehouses, warehouse)
	}

	return warehouses, nil
}

// CreateInvoice creates sales invoice (Видаткова накладна)
func (c *BASClient) CreateInvoice(ctx context.Context, invoice *Invoice) (*Invoice, error) {
	items := make([]map[string]interface{}, len(invoice.Items))
	for i, item := range invoice.Items {
		vatRate := item.VATRate
		if vatRate == 0 {
			vatRate = 20
		}

		items[i] = map[string]interface{}{
			"Номенклатура_Key": item.ExternalID,
			"Кількість":        item.Quantity,
			"Ціна":             item.Price,
			"Сума":             item.Total,
			"СтавкаПДВ":        fmt.Sprintf("ПДВ%.0f", vatRate),
			"СумаПДВ":          item.VATAmount,
		}
	}

	data := map[string]interface{}{
		"Дата":           FormatDateTime(invoice.Date),
		"Номер":          invoice.Number,
		"Організація":    c.config.OrganizationRef,
		"Контрагент_Key": invoice.CustomerID,
		"Склад_Key":      c.config.WarehouseRef,
		"СумаДокумента":  invoice.Total,
		"СумаПДВ":        invoice.VATAmount,
		"Товари":         items,
		"Валюта":         invoice.Currency,
	}

	if invoice.OrderID != "" {
		data["ЗамовленняКлієнта_Key"] = invoice.OrderID
	}

	result, err := c.odata.Create(ctx, "Document_ВидатковаНакладна", data)
	if err != nil {
		return nil, err
	}

	invoice.ExternalID = getString(result, "Ref_Key")
	return invoice, nil
}

// CreatePayment creates payment document
func (c *BASClient) CreatePayment(ctx context.Context, orderID string, amount float64, paymentMethod string) error {
	documentType := "Document_ПрибутковийКасовийОрдер"
	accountRef := c.config.CashAccountRef

	if paymentMethod == "card" || paymentMethod == "bank" {
		documentType = "Document_ПлатіжнеДоручення"
		accountRef = c.config.BankAccountRef
	}

	data := map[string]interface{}{
		"Дата":               FormatDateTime(time.Now()),
		"Організація":        c.config.OrganizationRef,
		"СумаДокумента":      amount,
		"Валюта":             "UAH",
	}

	if accountRef != "" {
		if paymentMethod == "cash" {
			data["Каса_Key"] = accountRef
		} else {
			data["БанківськийРахунок_Key"] = accountRef
		}
	}

	_, err := c.odata.Create(ctx, documentType, data)
	return err
}

func (c *BASClient) getProductPrice(ctx context.Context, productID string) (float64, error) {
	filter := fmt.Sprintf("Номенклатура_Key eq guid'%s' and ТипЦін_Key eq guid'%s'",
		productID, c.config.PriceTypeRef)

	data, err := c.odata.Get(ctx, "InformationRegister_ЦіниНоменклатури/SliceLast", filter,
		"Ціна", "")
	if err != nil {
		return 0, err
	}

	if len(data) > 0 {
		if price, ok := data[0]["Ціна"].(float64); ok {
			return price, nil
		}
	}

	return 0, nil
}

func (c *BASClient) getProductStock(ctx context.Context, productID, warehouseID string) (int, error) {
	filter := fmt.Sprintf("Номенклатура_Key eq guid'%s'", productID)
	if warehouseID != "" {
		filter += fmt.Sprintf(" and Склад_Key eq guid'%s'", warehouseID)
	}

	data, err := c.odata.Get(ctx, "AccumulationRegister_ЗалишкиТоварів/Balance", filter,
		"КількістьЗалишок", "")
	if err != nil {
		return 0, err
	}

	total := 0
	for _, item := range data {
		if qty, ok := item["КількістьЗалишок"].(float64); ok {
			total += int(qty)
		}
	}

	return total, nil
}
