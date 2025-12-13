// Marketplaces Integration

export * from './rozetka';
export * from './prom';

import { rozetka, RozetkaProduct, RozetkaOrder, RozetkaSyncResult } from './rozetka';
import { prom, PromProduct, PromOrder, PromSyncResult } from './prom';

export type MarketplaceType = 'rozetka' | 'prom';

export interface MarketplaceConnection {
    marketplace: MarketplaceType;
    isConnected: boolean;
    lastSync?: string;
    stats?: {
        products: number;
        orders: number;
        revenue: number;
    };
}

export interface UnifiedProduct {
    id: string;
    name: string;
    description: string;
    price: number;
    oldPrice?: number;
    quantity: number;
    categoryId: string;
    brand?: string;
    images: string[];
    attributes: { name: string; value: string }[];
    marketplaces: {
        rozetka?: { id: string; status: string };
        prom?: { id: number; status: string };
    };
}

export interface UnifiedOrder {
    id: string;
    marketplace: MarketplaceType;
    externalId: string;
    status: string;
    customer: {
        name: string;
        phone: string;
        email?: string;
    };
    delivery: {
        method: string;
        address: string;
    };
    items: {
        productId: string;
        name: string;
        quantity: number;
        price: number;
    }[];
    total: number;
    createdAt: string;
}

class MarketplacesService {
    // Get all marketplace connections
    async getConnections(): Promise<MarketplaceConnection[]> {
        const [rozetkaAuth, promAuth] = await Promise.all([
            rozetka.authenticate(),
            prom.authenticate(),
        ]);

        const connections: MarketplaceConnection[] = [];

        if (rozetkaAuth) {
            const stats = await rozetka.getStats();
            connections.push({
                marketplace: 'rozetka',
                isConnected: true,
                lastSync: new Date().toISOString(),
                stats: {
                    products: stats.totalProducts,
                    orders: stats.totalOrders,
                    revenue: stats.revenue,
                },
            });
        } else {
            connections.push({
                marketplace: 'rozetka',
                isConnected: false,
            });
        }

        if (promAuth) {
            const stats = await prom.getStats();
            connections.push({
                marketplace: 'prom',
                isConnected: true,
                lastSync: new Date().toISOString(),
                stats: {
                    products: stats.totalProducts,
                    orders: stats.totalOrders,
                    revenue: stats.revenue,
                },
            });
        } else {
            connections.push({
                marketplace: 'prom',
                isConnected: false,
            });
        }

        return connections;
    }

    // Sync product to all connected marketplaces
    async syncProduct(product: UnifiedProduct): Promise<{
        rozetka?: RozetkaSyncResult;
        prom?: PromSyncResult;
    }> {
        const results: {
            rozetka?: RozetkaSyncResult;
            prom?: PromSyncResult;
        } = {};

        // Sync to Rozetka
        if (await rozetka.authenticate()) {
            const rozetkaProduct: RozetkaProduct = {
                id: product.marketplaces.rozetka?.id || '',
                externalId: product.id,
                name: product.name,
                nameUa: product.name,
                description: product.description,
                descriptionUa: product.description,
                price: product.price,
                oldPrice: product.oldPrice,
                quantity: product.quantity,
                categoryId: parseInt(product.categoryId) || 0,
                brand: product.brand || '',
                images: product.images,
                attributes: product.attributes.map((a, i) => ({
                    id: i + 1,
                    name: a.name,
                    value: a.value,
                })),
                status: 'active',
            };

            results.rozetka = await rozetka.syncProducts([rozetkaProduct]);
        }

        // Sync to Prom
        if (await prom.authenticate()) {
            const promProduct: PromProduct = {
                id: product.marketplaces.prom?.id || 0,
                externalId: product.id,
                name: product.name,
                nameUa: product.name,
                description: product.description,
                descriptionUa: product.description,
                price: product.price,
                priceOld: product.oldPrice,
                currency: 'UAH',
                quantity: product.quantity,
                categoryId: parseInt(product.categoryId) || 0,
                images: product.images.map((url, i) => ({
                    id: i + 1,
                    url,
                    isMain: i === 0,
                })),
                attributes: product.attributes.map((a, i) => ({
                    id: i + 1,
                    name: a.name,
                    value: a.value,
                })),
                status: 'on_display',
                presence: product.quantity > 0 ? 'available' : 'not_available',
                sellingType: 'retail',
            };

            results.prom = await prom.syncProducts([promProduct]);
        }

        return results;
    }

    // Sync stock to all marketplaces
    async syncStock(productId: string, quantity: number): Promise<void> {
        await Promise.all([
            rozetka.updateStock(productId, quantity),
            prom.updateStock(productId, quantity),
        ]);
    }

    // Sync price to all marketplaces
    async syncPrice(productId: string, price: number, oldPrice?: number): Promise<void> {
        await Promise.all([
            rozetka.updatePrice(productId, price, oldPrice),
            prom.updatePrice(productId, price, oldPrice),
        ]);
    }

    // Get all orders from all marketplaces
    async getAllOrders(): Promise<UnifiedOrder[]> {
        const [rozetkaOrders, promOrders] = await Promise.all([
            rozetka.getOrders(),
            prom.getOrders(),
        ]);

        const unifiedOrders: UnifiedOrder[] = [];

        // Transform Rozetka orders
        for (const order of rozetkaOrders) {
            unifiedOrders.push({
                id: `rozetka_${order.id}`,
                marketplace: 'rozetka',
                externalId: order.id,
                status: order.status,
                customer: order.customer,
                delivery: {
                    method: order.delivery.method,
                    address: `${order.delivery.city}, ${order.delivery.address}`,
                },
                items: order.items,
                total: order.total,
                createdAt: order.createdAt,
            });
        }

        // Transform Prom orders
        for (const order of promOrders) {
            unifiedOrders.push({
                id: `prom_${order.id}`,
                marketplace: 'prom',
                externalId: order.id.toString(),
                status: order.status,
                customer: {
                    name: order.client.name,
                    phone: order.client.phones[0] || '',
                    email: order.client.emails[0],
                },
                delivery: {
                    method: order.deliveryOption.name,
                    address: order.deliveryAddress || '',
                },
                items: order.products.map((p) => ({
                    productId: p.externalId,
                    name: p.name,
                    quantity: p.quantity,
                    price: p.price,
                })),
                total: order.price,
                createdAt: order.dateCreated,
            });
        }

        // Sort by date descending
        return unifiedOrders.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    // Get pending orders count
    async getPendingOrdersCount(): Promise<{ rozetka: number; prom: number; total: number }> {
        const [rozetkaStats, promStats] = await Promise.all([
            rozetka.getStats(),
            prom.getStats(),
        ]);

        return {
            rozetka: rozetkaStats.pendingOrders,
            prom: promStats.pendingOrders,
            total: rozetkaStats.pendingOrders + promStats.pendingOrders,
        };
    }

    // Import order from marketplace to our system
    async importOrder(marketplace: MarketplaceType, orderId: string): Promise<{ success: boolean; orderId?: string; error?: string }> {
        if (marketplace === 'rozetka') {
            const order = await rozetka.getOrder(orderId);
            if (order) {
                return rozetka.importOrder(order);
            }
        } else if (marketplace === 'prom') {
            const order = await prom.getOrder(parseInt(orderId));
            if (order) {
                return prom.importOrder(order);
            }
        }

        return { success: false, error: 'Order not found' };
    }

    // Update order status on marketplace
    async updateOrderStatus(
        marketplace: MarketplaceType,
        orderId: string,
        status: string,
        trackingNumber?: string
    ): Promise<boolean> {
        if (marketplace === 'rozetka') {
            const result = await rozetka.updateOrderStatus(
                orderId,
                status as RozetkaOrder['status'],
                trackingNumber
            );
            return !!result;
        } else if (marketplace === 'prom') {
            const result = await prom.updateOrderStatus(
                parseInt(orderId),
                status as PromOrder['status']
            );
            if (result && trackingNumber) {
                await prom.setDeliveryTracking(parseInt(orderId), trackingNumber);
            }
            return !!result;
        }

        return false;
    }

    // Get combined statistics
    async getCombinedStats(): Promise<{
        totalProducts: number;
        totalOrders: number;
        totalRevenue: number;
        pendingOrders: number;
        byMarketplace: {
            rozetka: { products: number; orders: number; revenue: number };
            prom: { products: number; orders: number; revenue: number };
        };
    }> {
        const [rozetkaStats, promStats] = await Promise.all([
            rozetka.getStats(),
            prom.getStats(),
        ]);

        return {
            totalProducts: rozetkaStats.totalProducts + promStats.totalProducts,
            totalOrders: rozetkaStats.totalOrders + promStats.totalOrders,
            totalRevenue: rozetkaStats.revenue + promStats.revenue,
            pendingOrders: rozetkaStats.pendingOrders + promStats.pendingOrders,
            byMarketplace: {
                rozetka: {
                    products: rozetkaStats.totalProducts,
                    orders: rozetkaStats.totalOrders,
                    revenue: rozetkaStats.revenue,
                },
                prom: {
                    products: promStats.totalProducts,
                    orders: promStats.totalOrders,
                    revenue: promStats.revenue,
                },
            },
        };
    }
}

// Singleton instance
export const marketplaces = new MarketplacesService();

// React hook
export function useMarketplaces() {
    return marketplaces;
}
