// Prom.ua Marketplace Integration

export interface PromConfig {
    apiKey: string;
    apiUrl: string;
}

export interface PromProduct {
    id: number;
    externalId: string; // Our product ID
    name: string;
    nameUa: string;
    description: string;
    descriptionUa: string;
    price: number;
    priceOld?: number;
    currency: 'UAH';
    quantity: number;
    categoryId: number;
    groupId?: number;
    images: PromImage[];
    attributes: PromAttribute[];
    status: 'on_display' | 'draft' | 'deleted' | 'not_on_display' | 'editing_required';
    presence: 'available' | 'not_available' | 'order' | 'waiting' | 'service';
    discount?: PromDiscount;
    keywords?: string;
    sku?: string;
    sellingType: 'retail' | 'wholesale' | 'universal';
}

export interface PromImage {
    id: number;
    url: string;
    isMain: boolean;
}

export interface PromAttribute {
    id: number;
    name: string;
    value: string;
    unit?: string;
}

export interface PromDiscount {
    type: 'percent' | 'amount';
    value: number;
    dateStart?: string;
    dateEnd?: string;
}

export interface PromCategory {
    id: number;
    name: string;
    caption: string;
    parentId?: number;
    children?: PromCategory[];
}

export interface PromOrder {
    id: number;
    externalId?: string;
    status: PromOrderStatus;
    dateCreated: string;
    source: 'portal' | 'company_site' | 'bigl' | 'kabanchik' | 'zakupki_prom';
    client: {
        id: number;
        name: string;
        phones: string[];
        emails: string[];
    };
    deliveryOption: {
        id: number;
        name: string;
    };
    deliveryAddress?: string;
    deliveryProviderData?: {
        provider: 'nova_poshta' | 'ukrposhta' | 'justin' | 'meest';
        type: 'to_warehouse' | 'to_address';
        senderWarehouseId?: string;
        recipientWarehouseId?: string;
        declarationNumber?: string;
    };
    paymentOption: {
        id: number;
        name: string;
    };
    paymentData?: {
        type: 'cash' | 'cashless' | 'card';
        status: 'not_paid' | 'paid' | 'refunded';
    };
    products: PromOrderProduct[];
    price: number;
    fullPrice: number;
    discount?: number;
    clientNotes?: string;
    sellerComment?: string;
}

export type PromOrderStatus =
    | 'pending'
    | 'received'
    | 'delivered'
    | 'canceled'
    | 'draft'
    | 'paid';

export interface PromOrderProduct {
    id: number;
    externalId: string;
    image: string;
    name: string;
    nameUa: string;
    price: number;
    totalPrice: number;
    quantity: number;
    sku?: string;
}

export interface PromSyncResult {
    success: boolean;
    processed: number;
    created: number;
    updated: number;
    failed: number;
    errors: { productId: string; error: string }[];
}

export interface PromStats {
    totalProducts: number;
    activeProducts: number;
    totalOrders: number;
    pendingOrders: number;
    revenue: number;
    views: number;
    messages: number;
}

export interface PromMessage {
    id: number;
    chatId: number;
    text: string;
    sender: 'client' | 'company';
    dateCreated: string;
    isRead: boolean;
    attachments?: { url: string; name: string }[];
}

class PromService {
    private config: PromConfig;
    private products: Map<string, PromProduct> = new Map();
    private orders: Map<number, PromOrder> = new Map();

    constructor(config?: Partial<PromConfig>) {
        this.config = {
            apiKey: process.env.PROM_API_KEY || '',
            apiUrl: process.env.PROM_API_URL || 'https://my.prom.ua/api/v1',
            ...config,
        };
    }

    // Authentication
    async authenticate(): Promise<boolean> {
        if (!this.config.apiKey) {
            console.warn('Prom: Missing API key');
            return false;
        }

        try {
            // In production, verify API key with Prom API
            return true;
        } catch {
            return false;
        }
    }

    // Categories
    async getCategories(): Promise<PromCategory[]> {
        // In production, fetch from Prom API
        return [
            {
                id: 1,
                name: 'Електроніка',
                caption: 'electronics',
                children: [
                    { id: 11, name: 'Смартфони', caption: 'smartphones', parentId: 1 },
                    { id: 12, name: 'Ноутбуки', caption: 'laptops', parentId: 1 },
                    { id: 13, name: 'Планшети', caption: 'tablets', parentId: 1 },
                ],
            },
            {
                id: 2,
                name: 'Побутова техніка',
                caption: 'appliances',
                children: [
                    { id: 21, name: 'Холодильники', caption: 'refrigerators', parentId: 2 },
                    { id: 22, name: 'Пральні машини', caption: 'washing-machines', parentId: 2 },
                ],
            },
        ];
    }

    async getCategoryAttributes(categoryId: number): Promise<PromAttribute[]> {
        return [
            { id: 1, name: 'Бренд', value: '' },
            { id: 2, name: 'Модель', value: '' },
            { id: 3, name: 'Колір', value: '' },
            { id: 4, name: 'Гарантія', value: '', unit: 'міс' },
        ];
    }

    // Products
    async syncProducts(products: PromProduct[]): Promise<PromSyncResult> {
        const result: PromSyncResult = {
            success: true,
            processed: 0,
            created: 0,
            updated: 0,
            failed: 0,
            errors: [],
        };

        for (const product of products) {
            try {
                const existing = this.products.get(product.externalId);

                if (existing) {
                    await this.updateProduct(product);
                    result.updated++;
                } else {
                    await this.createProduct(product);
                    result.created++;
                }

                result.processed++;
            } catch (error) {
                result.failed++;
                result.errors.push({
                    productId: product.externalId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        result.success = result.failed === 0;
        return result;
    }

    async createProduct(product: PromProduct): Promise<PromProduct> {
        const validation = this.validateProduct(product);
        if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const newProduct: PromProduct = {
            ...product,
            id: Date.now(),
            status: 'on_display',
        };

        this.products.set(product.externalId, newProduct);
        return newProduct;
    }

    async updateProduct(product: PromProduct): Promise<PromProduct> {
        const existing = this.products.get(product.externalId);
        if (!existing) {
            throw new Error('Product not found');
        }

        const updatedProduct: PromProduct = {
            ...existing,
            ...product,
            id: existing.id,
        };

        this.products.set(product.externalId, updatedProduct);
        return updatedProduct;
    }

    async updateStock(productId: string, quantity: number, presence?: PromProduct['presence']): Promise<void> {
        const product = this.products.get(productId);
        if (product) {
            product.quantity = quantity;
            if (presence) {
                product.presence = presence;
            } else {
                product.presence = quantity > 0 ? 'available' : 'not_available';
            }
            this.products.set(productId, product);
        }
    }

    async updatePrice(productId: string, price: number, priceOld?: number): Promise<void> {
        const product = this.products.get(productId);
        if (product) {
            product.price = price;
            product.priceOld = priceOld;
            this.products.set(productId, product);
        }
    }

    async setDiscount(productId: string, discount: PromDiscount | null): Promise<void> {
        const product = this.products.get(productId);
        if (product) {
            product.discount = discount || undefined;
            this.products.set(productId, product);
        }
    }

    async getProducts(): Promise<PromProduct[]> {
        return Array.from(this.products.values());
    }

    async getProduct(productId: string): Promise<PromProduct | null> {
        return this.products.get(productId) || null;
    }

    async deleteProduct(productId: string): Promise<boolean> {
        return this.products.delete(productId);
    }

    // Orders
    async getOrders(params?: {
        status?: PromOrderStatus;
        dateFrom?: string;
        dateTo?: string;
        limit?: number;
    }): Promise<PromOrder[]> {
        // Mock orders for development
        const mockOrders: PromOrder[] = [
            {
                id: 123456,
                status: 'pending',
                dateCreated: new Date().toISOString(),
                source: 'portal',
                client: {
                    id: 1,
                    name: 'Олена Коваленко',
                    phones: ['+380671234567'],
                    emails: ['olena@example.com'],
                },
                deliveryOption: {
                    id: 1,
                    name: 'Нова Пошта',
                },
                deliveryAddress: 'Київ, Хрещатик 1',
                deliveryProviderData: {
                    provider: 'nova_poshta',
                    type: 'to_warehouse',
                    recipientWarehouseId: '1',
                },
                paymentOption: {
                    id: 1,
                    name: 'Накладений платіж',
                },
                paymentData: {
                    type: 'cash',
                    status: 'not_paid',
                },
                products: [
                    {
                        id: 1,
                        externalId: '123',
                        image: '/images/product.jpg',
                        name: 'Samsung Galaxy S24',
                        nameUa: 'Samsung Galaxy S24',
                        price: 28000,
                        totalPrice: 28000,
                        quantity: 1,
                    },
                ],
                price: 28000,
                fullPrice: 28000,
            },
        ];

        mockOrders.forEach((order) => this.orders.set(order.id, order));

        let orders = Array.from(this.orders.values());

        if (params?.status) {
            orders = orders.filter((o) => o.status === params.status);
        }

        if (params?.dateFrom) {
            const from = new Date(params.dateFrom);
            orders = orders.filter((o) => new Date(o.dateCreated) >= from);
        }

        if (params?.dateTo) {
            const to = new Date(params.dateTo);
            orders = orders.filter((o) => new Date(o.dateCreated) <= to);
        }

        return orders
            .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())
            .slice(0, params?.limit || 100);
    }

    async getOrder(orderId: number): Promise<PromOrder | null> {
        return this.orders.get(orderId) || null;
    }

    async updateOrderStatus(orderId: number, status: PromOrderStatus): Promise<PromOrder | null> {
        const order = this.orders.get(orderId);
        if (!order) return null;

        order.status = status;
        this.orders.set(orderId, order);

        return order;
    }

    async addSellerComment(orderId: number, comment: string): Promise<PromOrder | null> {
        const order = this.orders.get(orderId);
        if (!order) return null;

        order.sellerComment = comment;
        this.orders.set(orderId, order);

        return order;
    }

    // Delivery tracking
    async setDeliveryTracking(orderId: number, trackingNumber: string): Promise<void> {
        const order = this.orders.get(orderId);
        if (order && order.deliveryProviderData) {
            order.deliveryProviderData.declarationNumber = trackingNumber;
            this.orders.set(orderId, order);
        }
    }

    // Messages
    async getMessages(orderId?: number): Promise<PromMessage[]> {
        // Mock messages
        return [
            {
                id: 1,
                chatId: 123,
                text: 'Добрий день! Чи є в наявності?',
                sender: 'client',
                dateCreated: new Date(Date.now() - 3600000).toISOString(),
                isRead: true,
            },
            {
                id: 2,
                chatId: 123,
                text: 'Так, є в наявності. Готові відправити сьогодні.',
                sender: 'company',
                dateCreated: new Date(Date.now() - 1800000).toISOString(),
                isRead: true,
            },
        ];
    }

    async sendMessage(chatId: number, text: string): Promise<PromMessage> {
        return {
            id: Date.now(),
            chatId,
            text,
            sender: 'company',
            dateCreated: new Date().toISOString(),
            isRead: false,
        };
    }

    // Statistics
    async getStats(): Promise<PromStats> {
        const products = Array.from(this.products.values());
        const orders = Array.from(this.orders.values());

        return {
            totalProducts: products.length,
            activeProducts: products.filter((p) => p.status === 'on_display').length,
            totalOrders: orders.length,
            pendingOrders: orders.filter((o) => o.status === 'pending' || o.status === 'received').length,
            revenue: orders.filter((o) => o.status !== 'canceled').reduce((sum, o) => sum + o.price, 0),
            views: Math.floor(Math.random() * 10000) + 5000,
            messages: Math.floor(Math.random() * 50) + 10,
        };
    }

    // Product feed export (YML format for Prom)
    generateProductFeed(): string {
        const products = Array.from(this.products.values()).filter((p) => p.status === 'on_display');

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<yml_catalog date="' + new Date().toISOString() + '">\n';
        xml += '  <shop>\n';
        xml += '    <name>My Shop</name>\n';
        xml += '    <company>My Company</company>\n';
        xml += '    <url>https://myshop.ua</url>\n';
        xml += '    <currencies>\n';
        xml += '      <currency id="UAH" rate="1"/>\n';
        xml += '    </currencies>\n';
        xml += '    <categories>\n';
        // Add categories here
        xml += '    </categories>\n';
        xml += '    <offers>\n';

        for (const product of products) {
            xml += '      <offer id="' + product.externalId + '" available="' + (product.quantity > 0) + '">\n';
            xml += '        <name>' + this.escapeXml(product.nameUa || product.name) + '</name>\n';
            xml += '        <price>' + product.price + '</price>\n';
            if (product.priceOld) {
                xml += '        <price_old>' + product.priceOld + '</price_old>\n';
            }
            xml += '        <currencyId>UAH</currencyId>\n';
            xml += '        <categoryId>' + product.categoryId + '</categoryId>\n';
            for (const image of product.images) {
                xml += '        <picture>' + this.escapeXml(image.url) + '</picture>\n';
            }
            xml += '        <description><![CDATA[' + (product.descriptionUa || product.description) + ']]></description>\n';
            xml += '        <quantity_in_stock>' + product.quantity + '</quantity_in_stock>\n';
            for (const attr of product.attributes) {
                xml += '        <param name="' + this.escapeXml(attr.name) + '">' + this.escapeXml(attr.value) + '</param>\n';
            }
            xml += '      </offer>\n';
        }

        xml += '    </offers>\n';
        xml += '  </shop>\n';
        xml += '</yml_catalog>';

        return xml;
    }

    // Validation
    validateProduct(product: PromProduct): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!product.name || product.name.length < 3) {
            errors.push('Назва товару має бути не менше 3 символів');
        }

        if (product.name && product.name.length > 200) {
            errors.push('Назва товару не може перевищувати 200 символів');
        }

        if (!product.description || product.description.length < 20) {
            errors.push('Опис товару має бути не менше 20 символів');
        }

        if (!product.price || product.price <= 0) {
            errors.push('Ціна має бути більше 0');
        }

        if (!product.categoryId) {
            errors.push('Категорія обов\'язкова');
        }

        if (!product.images || product.images.length === 0) {
            errors.push('Потрібно хоча б одне зображення');
        }

        return { valid: errors.length === 0, errors };
    }

    // Import order to our system
    async importOrder(promOrder: PromOrder): Promise<{ success: boolean; orderId?: string; error?: string }> {
        try {
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: 'prom',
                    externalId: promOrder.id.toString(),
                    customer: {
                        name: promOrder.client.name,
                        phone: promOrder.client.phones[0],
                        email: promOrder.client.emails[0],
                    },
                    delivery: {
                        method: promOrder.deliveryOption.name,
                        address: promOrder.deliveryAddress,
                        provider: promOrder.deliveryProviderData?.provider,
                    },
                    payment: {
                        method: promOrder.paymentOption.name,
                        status: promOrder.paymentData?.status,
                    },
                    items: promOrder.products.map((p) => ({
                        productId: p.externalId,
                        name: p.name,
                        price: p.price,
                        quantity: p.quantity,
                    })),
                    total: promOrder.price,
                    notes: promOrder.clientNotes,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                return { success: true, orderId: data.id };
            }

            return { success: false, error: 'Failed to import order' };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    private escapeXml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}

// Singleton instance
export const prom = new PromService();

// React hook
export function useProm() {
    return prom;
}
