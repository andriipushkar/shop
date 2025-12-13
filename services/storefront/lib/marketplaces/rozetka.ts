// Rozetka Marketplace Integration

export interface RozetkaConfig {
    apiKey: string;
    sellerId: string;
    apiUrl: string;
}

export interface RozetkaProduct {
    id: string;
    externalId: string; // Our product ID
    name: string;
    nameUa: string;
    description: string;
    descriptionUa: string;
    price: number;
    oldPrice?: number;
    quantity: number;
    categoryId: number;
    brand: string;
    images: string[];
    attributes: RozetkaAttribute[];
    status: 'active' | 'inactive' | 'moderation' | 'rejected';
    url?: string;
    ean?: string;
    upc?: string;
}

export interface RozetkaAttribute {
    id: number;
    name: string;
    value: string;
}

export interface RozetkaCategory {
    id: number;
    name: string;
    parentId?: number;
    children?: RozetkaCategory[];
}

export interface RozetkaOrder {
    id: string;
    externalId?: string;
    status: RozetkaOrderStatus;
    customer: {
        name: string;
        phone: string;
        email?: string;
    };
    delivery: {
        method: string;
        address: string;
        city: string;
        warehouse?: string;
    };
    payment: {
        method: string;
        status: 'pending' | 'paid' | 'failed';
    };
    items: {
        productId: string;
        name: string;
        quantity: number;
        price: number;
    }[];
    total: number;
    commission: number;
    createdAt: string;
    updatedAt: string;
}

export type RozetkaOrderStatus =
    | 'new'
    | 'processing'
    | 'ready_to_ship'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'returned';

export interface RozetkaSyncResult {
    success: boolean;
    processed: number;
    created: number;
    updated: number;
    failed: number;
    errors: { productId: string; error: string }[];
}

export interface RozetkaStats {
    totalProducts: number;
    activeProducts: number;
    totalOrders: number;
    pendingOrders: number;
    revenue: number;
    commission: number;
}

class RozetkaService {
    private config: RozetkaConfig;
    private products: Map<string, RozetkaProduct> = new Map();
    private orders: Map<string, RozetkaOrder> = new Map();

    constructor(config?: Partial<RozetkaConfig>) {
        this.config = {
            apiKey: process.env.ROZETKA_API_KEY || '',
            sellerId: process.env.ROZETKA_SELLER_ID || '',
            apiUrl: process.env.ROZETKA_API_URL || 'https://api.seller.rozetka.com.ua/v1',
            ...config,
        };
    }

    // Authentication
    async authenticate(): Promise<boolean> {
        if (!this.config.apiKey || !this.config.sellerId) {
            console.warn('Rozetka: Missing API credentials');
            return false;
        }

        try {
            // In production, verify token with Rozetka API
            // const response = await fetch(`${this.config.apiUrl}/auth/verify`, {
            //     headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
            // });
            return true;
        } catch {
            return false;
        }
    }

    // Categories
    async getCategories(): Promise<RozetkaCategory[]> {
        // In production, fetch from Rozetka API
        return [
            {
                id: 80253,
                name: 'Смартфони',
                children: [
                    { id: 80254, name: 'Apple', parentId: 80253 },
                    { id: 80255, name: 'Samsung', parentId: 80253 },
                    { id: 80256, name: 'Xiaomi', parentId: 80253 },
                ],
            },
            {
                id: 80257,
                name: 'Ноутбуки',
                children: [
                    { id: 80258, name: 'Apple MacBook', parentId: 80257 },
                    { id: 80259, name: 'Asus', parentId: 80257 },
                    { id: 80260, name: 'Lenovo', parentId: 80257 },
                ],
            },
            {
                id: 80261,
                name: 'Планшети',
                children: [
                    { id: 80262, name: 'Apple iPad', parentId: 80261 },
                    { id: 80263, name: 'Samsung Galaxy Tab', parentId: 80261 },
                ],
            },
        ];
    }

    async getCategoryAttributes(categoryId: number): Promise<RozetkaAttribute[]> {
        // Return required attributes for category
        return [
            { id: 1, name: 'Бренд', value: '' },
            { id: 2, name: 'Модель', value: '' },
            { id: 3, name: 'Колір', value: '' },
            { id: 4, name: "Об'єм пам'яті", value: '' },
        ];
    }

    // Products
    async syncProducts(products: RozetkaProduct[]): Promise<RozetkaSyncResult> {
        const result: RozetkaSyncResult = {
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
                    // Update existing product
                    await this.updateProduct(product);
                    result.updated++;
                } else {
                    // Create new product
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

    async createProduct(product: RozetkaProduct): Promise<RozetkaProduct> {
        // Validate product
        const validation = this.validateProduct(product);
        if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        // In production, send to Rozetka API
        // const response = await fetch(`${this.config.apiUrl}/products`, {
        //     method: 'POST',
        //     headers: {
        //         'Authorization': `Bearer ${this.config.apiKey}`,
        //         'Content-Type': 'application/json',
        //     },
        //     body: JSON.stringify(this.transformToRozetkaFormat(product)),
        // });

        const newProduct: RozetkaProduct = {
            ...product,
            id: Date.now().toString(),
            status: 'moderation',
        };

        this.products.set(product.externalId, newProduct);
        return newProduct;
    }

    async updateProduct(product: RozetkaProduct): Promise<RozetkaProduct> {
        const existing = this.products.get(product.externalId);
        if (!existing) {
            throw new Error('Product not found');
        }

        const updatedProduct: RozetkaProduct = {
            ...existing,
            ...product,
            id: existing.id,
        };

        this.products.set(product.externalId, updatedProduct);
        return updatedProduct;
    }

    async updateStock(productId: string, quantity: number): Promise<void> {
        const product = this.products.get(productId);
        if (product) {
            product.quantity = quantity;
            this.products.set(productId, product);
        }

        // In production, update via API
        // await fetch(`${this.config.apiUrl}/products/${productId}/stock`, {
        //     method: 'PATCH',
        //     headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
        //     body: JSON.stringify({ quantity }),
        // });
    }

    async updatePrice(productId: string, price: number, oldPrice?: number): Promise<void> {
        const product = this.products.get(productId);
        if (product) {
            product.price = price;
            product.oldPrice = oldPrice;
            this.products.set(productId, product);
        }
    }

    async getProducts(): Promise<RozetkaProduct[]> {
        return Array.from(this.products.values());
    }

    async getProduct(productId: string): Promise<RozetkaProduct | null> {
        return this.products.get(productId) || null;
    }

    async deleteProduct(productId: string): Promise<boolean> {
        return this.products.delete(productId);
    }

    // Orders
    async getOrders(status?: RozetkaOrderStatus): Promise<RozetkaOrder[]> {
        // In production, fetch from Rozetka API
        const mockOrders: RozetkaOrder[] = [
            {
                id: 'RZ-123456',
                status: 'new',
                customer: {
                    name: 'Іван Петренко',
                    phone: '+380501234567',
                    email: 'ivan@example.com',
                },
                delivery: {
                    method: 'nova_poshta',
                    address: 'Київ',
                    city: 'Київ',
                    warehouse: 'Відділення №1',
                },
                payment: {
                    method: 'cash_on_delivery',
                    status: 'pending',
                },
                items: [
                    { productId: '1', name: 'iPhone 15', quantity: 1, price: 35000 },
                ],
                total: 35000,
                commission: 1750,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        ];

        // Store mock orders
        mockOrders.forEach((order) => this.orders.set(order.id, order));

        let orders = Array.from(this.orders.values());
        if (status) {
            orders = orders.filter((o) => o.status === status);
        }

        return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    async getOrder(orderId: string): Promise<RozetkaOrder | null> {
        return this.orders.get(orderId) || null;
    }

    async updateOrderStatus(orderId: string, status: RozetkaOrderStatus, trackingNumber?: string): Promise<RozetkaOrder | null> {
        const order = this.orders.get(orderId);
        if (!order) return null;

        order.status = status;
        order.updatedAt = new Date().toISOString();

        this.orders.set(orderId, order);

        // In production, update via Rozetka API
        // await fetch(`${this.config.apiUrl}/orders/${orderId}/status`, {
        //     method: 'PATCH',
        //     headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
        //     body: JSON.stringify({ status, trackingNumber }),
        // });

        return order;
    }

    // Statistics
    async getStats(): Promise<RozetkaStats> {
        const products = Array.from(this.products.values());
        const orders = Array.from(this.orders.values());

        return {
            totalProducts: products.length,
            activeProducts: products.filter((p) => p.status === 'active').length,
            totalOrders: orders.length,
            pendingOrders: orders.filter((o) => o.status === 'new' || o.status === 'processing').length,
            revenue: orders.reduce((sum, o) => sum + o.total, 0),
            commission: orders.reduce((sum, o) => sum + o.commission, 0),
        };
    }

    // Validation
    validateProduct(product: RozetkaProduct): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!product.name || product.name.length < 3) {
            errors.push('Назва товару має бути не менше 3 символів');
        }

        if (!product.description || product.description.length < 50) {
            errors.push('Опис товару має бути не менше 50 символів');
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

    // Transform our product to Rozetka format
    transformToRozetkaFormat(product: Partial<RozetkaProduct>): Record<string, unknown> {
        return {
            name: product.nameUa || product.name,
            description: product.descriptionUa || product.description,
            price: product.price,
            old_price: product.oldPrice,
            quantity: product.quantity,
            category_id: product.categoryId,
            brand: product.brand,
            images: product.images,
            attributes: product.attributes?.map((a) => ({
                attribute_id: a.id,
                value: a.value,
            })),
            ean: product.ean,
            upc: product.upc,
        };
    }

    // Import order to our system
    async importOrder(rozetkaOrder: RozetkaOrder): Promise<{ success: boolean; orderId?: string; error?: string }> {
        try {
            // Create order in our system
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: 'rozetka',
                    externalId: rozetkaOrder.id,
                    customer: rozetkaOrder.customer,
                    delivery: rozetkaOrder.delivery,
                    payment: rozetkaOrder.payment,
                    items: rozetkaOrder.items,
                    total: rozetkaOrder.total,
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
}

// Singleton instance
export const rozetka = new RozetkaService();

// React hook
export function useRozetka() {
    return rozetka;
}
