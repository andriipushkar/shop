export interface Category {
    id: string;
    name: string;
}

export interface Product {
    id: string;
    name: string;
    price: number;
    sku: string;
    stock: number;
    image_url?: string;
    category_id?: string;
    category?: Category;
}

export interface Order {
    id: string;
    product_id: string;
    quantity: number;
    status: string;
    user_id: number;
    created_at: string;
    product?: Product;
}

export interface CartItem {
    product: Product;
    quantity: number;
}

const CORE_URL = process.env.CORE_SERVICE_URL || 'http://core:8080';
const OMS_URL = process.env.OMS_SERVICE_URL || 'http://oms:8081';

export interface ProductFilter {
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    categoryId?: string;
}

export async function getProducts(filter?: ProductFilter): Promise<Product[]> {
    console.log('Fetching products from:', CORE_URL);
    try {
        const params = new URLSearchParams();
        if (filter?.search) params.set('search', filter.search);
        if (filter?.minPrice !== undefined) params.set('min_price', String(filter.minPrice));
        if (filter?.maxPrice !== undefined) params.set('max_price', String(filter.maxPrice));
        if (filter?.categoryId) params.set('category_id', filter.categoryId);

        const queryString = params.toString();
        const url = `${CORE_URL}/products${queryString ? '?' + queryString : ''}`;

        const res = await fetch(url, {
            cache: 'no-store',
            next: { revalidate: 0 }
        });

        if (!res.ok) {
            console.error('Failed to fetch:', res.status, res.statusText);
            return [];
        }

        return res.json();
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
}

export async function getCategories(): Promise<Category[]> {
    try {
        const res = await fetch(`${CORE_URL}/categories`, {
            cache: 'no-store',
            next: { revalidate: 0 }
        });

        if (!res.ok) {
            console.error('Failed to fetch categories:', res.status, res.statusText);
            return [];
        }

        return res.json();
    } catch (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
}

export async function createOrder(productId: string, quantity: number, userId: number): Promise<Order | null> {
    try {
        const res = await fetch(`${OMS_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                product_id: productId,
                quantity: quantity,
                user_id: userId,
            }),
        });

        if (!res.ok) {
            console.error('Failed to create order:', res.status, res.statusText);
            return null;
        }

        return res.json();
    } catch (error) {
        console.error('Error creating order:', error);
        return null;
    }
}

export async function getProduct(id: string): Promise<Product | null> {
    try {
        const res = await fetch(`${CORE_URL}/products/${id}`, {
            cache: 'no-store',
        });

        if (!res.ok) {
            return null;
        }

        return res.json();
    } catch (error) {
        console.error('Error fetching product:', error);
        return null;
    }
}

export async function getOrders(userId: number): Promise<Order[]> {
    try {
        const res = await fetch(`${OMS_URL}/orders/user/${userId}`, {
            cache: 'no-store',
        });

        if (!res.ok) {
            console.error('Failed to fetch orders:', res.status, res.statusText);
            return [];
        }

        const orders: Order[] = await res.json();

        // Enrich orders with product data
        const enrichedOrders = await Promise.all(
            orders.map(async (order) => {
                const product = await getProduct(order.product_id);
                return { ...order, product: product || undefined };
            })
        );

        return enrichedOrders;
    } catch (error) {
        console.error('Error fetching orders:', error);
        return [];
    }
}

// Cart API functions
export interface ApiCartItem {
    user_id: number;
    product_id: string;
    name: string;
    price: number;
    quantity: number;
    image_url?: string;
}

export async function getCart(userId: number): Promise<ApiCartItem[]> {
    try {
        const res = await fetch(`${CORE_URL}/cart/${userId}`, {
            cache: 'no-store',
        });

        if (!res.ok) {
            console.error('Failed to fetch cart:', res.status);
            return [];
        }

        return res.json();
    } catch (error) {
        console.error('Error fetching cart:', error);
        return [];
    }
}

export async function addToCartApi(userId: number, productId: string, quantity: number = 1): Promise<boolean> {
    try {
        const res = await fetch(`${CORE_URL}/cart/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: productId, quantity }),
        });

        return res.ok;
    } catch (error) {
        console.error('Error adding to cart:', error);
        return false;
    }
}

export async function clearCartApi(userId: number): Promise<boolean> {
    try {
        const res = await fetch(`${CORE_URL}/cart/${userId}`, {
            method: 'DELETE',
        });

        return res.ok;
    } catch (error) {
        console.error('Error clearing cart:', error);
        return false;
    }
}

export async function removeFromCartApi(userId: number, productId: string): Promise<boolean> {
    try {
        const res = await fetch(`${CORE_URL}/cart/${userId}/item/${productId}`, {
            method: 'DELETE',
        });

        return res.ok;
    } catch (error) {
        console.error('Error removing from cart:', error);
        return false;
    }
}

export async function updateCartQuantityApi(userId: number, productId: string, quantity: number): Promise<boolean> {
    try {
        const res = await fetch(`${CORE_URL}/cart/${userId}/item/${productId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity }),
        });

        return res.ok;
    } catch (error) {
        console.error('Error updating cart:', error);
        return false;
    }
}

// Promo code API
export interface PromoValidation {
    valid: boolean;
    discount: number;
    code?: string;
}

export async function validatePromoCode(code: string): Promise<PromoValidation> {
    try {
        const res = await fetch(`${OMS_URL}/promo/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        });

        if (!res.ok) {
            return { valid: false, discount: 0 };
        }

        const data = await res.json();
        return { valid: true, discount: data.discount, code: data.code };
    } catch (error) {
        console.error('Error validating promo:', error);
        return { valid: false, discount: 0 };
    }
}

export async function usePromoCode(code: string): Promise<boolean> {
    try {
        const res = await fetch(`${OMS_URL}/promo/use`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        });

        return res.ok;
    } catch (error) {
        console.error('Error using promo:', error);
        return false;
    }
}
