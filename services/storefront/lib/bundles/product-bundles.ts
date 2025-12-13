// Product Bundles Service

import { Product } from '@/lib/mock-data';

export interface ProductBundle {
    id: string;
    name: string;
    slug: string;
    description: string;
    items: BundleItem[];
    bundleType: 'fixed' | 'mix_match' | 'bogo' | 'tiered';
    pricing: BundlePricing;
    discountType: 'percentage' | 'fixed_amount' | 'fixed_price';
    discountValue: number;
    originalPrice: number;
    bundlePrice: number;
    savings: number;
    savingsPercentage: number;
    minQuantity?: number;
    maxQuantity?: number;
    startDate?: string;
    endDate?: string;
    status: 'active' | 'inactive' | 'scheduled' | 'expired';
    image?: string;
    badge?: string;
    tags?: string[];
    soldCount: number;
    stockLimit?: number;
    createdAt: string;
    updatedAt: string;
}

export interface BundleItem {
    productId: string;
    product: Product;
    quantity: number;
    isRequired: boolean;
    discount?: number;
    originalPrice: number;
    bundlePrice: number;
}

export interface BundlePricing {
    type: 'sum_discounted' | 'fixed_bundle_price' | 'cheapest_free' | 'tiered';
    tiers?: PriceTier[];
}

export interface PriceTier {
    minQuantity: number;
    discountPercentage: number;
}

export interface BundleCartItem {
    bundleId: string;
    bundle: ProductBundle;
    quantity: number;
    selectedItems: {
        productId: string;
        quantity: number;
    }[];
    totalPrice: number;
}

// Mock bundles for development
const mockBundles: ProductBundle[] = [
    {
        id: '1',
        name: 'Комплект геймера',
        slug: 'gamer-kit',
        description: 'Ідеальний набір для початківця геймера: клавіатура, миша та килимок',
        items: [],
        bundleType: 'fixed',
        pricing: { type: 'sum_discounted' },
        discountType: 'percentage',
        discountValue: 20,
        originalPrice: 3500,
        bundlePrice: 2800,
        savings: 700,
        savingsPercentage: 20,
        status: 'active',
        badge: 'Хіт продажів',
        soldCount: 156,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: '2',
        name: 'Смартфон + Аксесуари',
        slug: 'phone-accessories',
        description: 'Смартфон з чохлом та захисним склом за вигідною ціною',
        items: [],
        bundleType: 'fixed',
        pricing: { type: 'sum_discounted' },
        discountType: 'percentage',
        discountValue: 15,
        originalPrice: 15000,
        bundlePrice: 12750,
        savings: 2250,
        savingsPercentage: 15,
        status: 'active',
        soldCount: 89,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: '3',
        name: 'Офісний набір',
        slug: 'office-kit',
        description: 'Все необхідне для домашнього офісу',
        items: [],
        bundleType: 'mix_match',
        pricing: { type: 'sum_discounted' },
        discountType: 'percentage',
        discountValue: 10,
        originalPrice: 25000,
        bundlePrice: 22500,
        savings: 2500,
        savingsPercentage: 10,
        minQuantity: 3,
        status: 'active',
        soldCount: 45,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
];

class ProductBundleService {
    private bundles: Map<string, ProductBundle> = new Map();

    constructor() {
        // Load mock bundles
        mockBundles.forEach((bundle) => this.bundles.set(bundle.id, bundle));
    }

    // Get all active bundles
    getActiveBundles(): ProductBundle[] {
        return Array.from(this.bundles.values())
            .filter((bundle) => bundle.status === 'active')
            .sort((a, b) => b.soldCount - a.soldCount);
    }

    // Get bundle by ID
    getBundle(bundleId: string): ProductBundle | undefined {
        return this.bundles.get(bundleId);
    }

    // Get bundle by slug
    getBundleBySlug(slug: string): ProductBundle | undefined {
        return Array.from(this.bundles.values()).find((b) => b.slug === slug);
    }

    // Get bundles for product
    getBundlesForProduct(productId: string): ProductBundle[] {
        return Array.from(this.bundles.values()).filter((bundle) =>
            bundle.items.some((item) => item.productId === productId) && bundle.status === 'active'
        );
    }

    // Calculate bundle price
    calculateBundlePrice(bundle: ProductBundle, selectedItems?: BundleItem[]): {
        originalPrice: number;
        bundlePrice: number;
        savings: number;
        savingsPercentage: number;
    } {
        const items = selectedItems || bundle.items;
        let originalPrice = 0;
        let bundlePrice = 0;

        items.forEach((item) => {
            originalPrice += item.originalPrice * item.quantity;
        });

        switch (bundle.pricing.type) {
            case 'sum_discounted':
                if (bundle.discountType === 'percentage') {
                    bundlePrice = originalPrice * (1 - bundle.discountValue / 100);
                } else if (bundle.discountType === 'fixed_amount') {
                    bundlePrice = originalPrice - bundle.discountValue;
                } else {
                    bundlePrice = bundle.discountValue;
                }
                break;

            case 'fixed_bundle_price':
                bundlePrice = bundle.discountValue;
                break;

            case 'cheapest_free':
                const prices = items.flatMap((item) =>
                    Array(item.quantity).fill(item.originalPrice)
                ).sort((a, b) => a - b);
                // Remove cheapest item
                bundlePrice = prices.slice(1).reduce((sum, p) => sum + p, 0);
                break;

            case 'tiered':
                const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
                const tier = bundle.pricing.tiers
                    ?.sort((a, b) => b.minQuantity - a.minQuantity)
                    .find((t) => totalQuantity >= t.minQuantity);
                if (tier) {
                    bundlePrice = originalPrice * (1 - tier.discountPercentage / 100);
                } else {
                    bundlePrice = originalPrice;
                }
                break;

            default:
                bundlePrice = originalPrice;
        }

        bundlePrice = Math.round(bundlePrice * 100) / 100;
        const savings = originalPrice - bundlePrice;
        const savingsPercentage = Math.round((savings / originalPrice) * 100);

        return { originalPrice, bundlePrice, savings, savingsPercentage };
    }

    // Validate bundle selection
    validateBundleSelection(bundle: ProductBundle, selectedItems: BundleItem[]): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        // Check required items
        const requiredItems = bundle.items.filter((item) => item.isRequired);
        for (const required of requiredItems) {
            const selected = selectedItems.find((s) => s.productId === required.productId);
            if (!selected || selected.quantity < required.quantity) {
                errors.push(`${required.product.name} є обов'язковим товаром`);
            }
        }

        // Check minimum quantity
        if (bundle.minQuantity) {
            const totalQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
            if (totalQuantity < bundle.minQuantity) {
                errors.push(`Мінімальна кількість товарів: ${bundle.minQuantity}`);
            }
        }

        // Check maximum quantity
        if (bundle.maxQuantity) {
            const totalQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
            if (totalQuantity > bundle.maxQuantity) {
                errors.push(`Максимальна кількість товарів: ${bundle.maxQuantity}`);
            }
        }

        // Check stock
        for (const item of selectedItems) {
            if (item.product.stock < item.quantity) {
                errors.push(`${item.product.name}: недостатньо на складі`);
            }
        }

        return { valid: errors.length === 0, errors };
    }

    // Create bundle cart item
    createBundleCartItem(
        bundle: ProductBundle,
        selectedItems: BundleItem[],
        quantity: number = 1
    ): BundleCartItem | null {
        const validation = this.validateBundleSelection(bundle, selectedItems);
        if (!validation.valid) return null;

        const pricing = this.calculateBundlePrice(bundle, selectedItems);

        return {
            bundleId: bundle.id,
            bundle,
            quantity,
            selectedItems: selectedItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
            })),
            totalPrice: pricing.bundlePrice * quantity,
        };
    }

    // Get recommended bundles based on cart
    getRecommendedBundles(cartProductIds: string[]): ProductBundle[] {
        const bundles = this.getActiveBundles();

        return bundles.filter((bundle) => {
            // Check if any cart product is in this bundle
            const hasCartProduct = bundle.items.some((item) =>
                cartProductIds.includes(item.productId)
            );

            // Check if bundle is not fully in cart
            const allInCart = bundle.items.every((item) =>
                cartProductIds.includes(item.productId)
            );

            return hasCartProduct && !allInCart;
        }).slice(0, 3);
    }

    // Admin: Create bundle
    async createBundle(data: Omit<ProductBundle, 'id' | 'createdAt' | 'updatedAt' | 'soldCount'>): Promise<ProductBundle> {
        const bundle: ProductBundle = {
            ...data,
            id: Date.now().toString(),
            soldCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        // Calculate pricing
        const pricing = this.calculateBundlePrice(bundle);
        bundle.originalPrice = pricing.originalPrice;
        bundle.bundlePrice = pricing.bundlePrice;
        bundle.savings = pricing.savings;
        bundle.savingsPercentage = pricing.savingsPercentage;

        this.bundles.set(bundle.id, bundle);

        // Save to server
        await this.saveToServer(bundle);

        return bundle;
    }

    // Admin: Update bundle
    async updateBundle(bundleId: string, updates: Partial<ProductBundle>): Promise<ProductBundle | null> {
        const bundle = this.bundles.get(bundleId);
        if (!bundle) return null;

        const updatedBundle = {
            ...bundle,
            ...updates,
            updatedAt: new Date().toISOString(),
        };

        // Recalculate pricing if items changed
        if (updates.items || updates.discountType || updates.discountValue) {
            const pricing = this.calculateBundlePrice(updatedBundle);
            updatedBundle.originalPrice = pricing.originalPrice;
            updatedBundle.bundlePrice = pricing.bundlePrice;
            updatedBundle.savings = pricing.savings;
            updatedBundle.savingsPercentage = pricing.savingsPercentage;
        }

        this.bundles.set(bundleId, updatedBundle);
        await this.saveToServer(updatedBundle);

        return updatedBundle;
    }

    // Admin: Delete bundle
    async deleteBundle(bundleId: string): Promise<boolean> {
        const deleted = this.bundles.delete(bundleId);
        if (deleted) {
            await this.deleteFromServer(bundleId);
        }
        return deleted;
    }

    // Record purchase
    async recordPurchase(bundleId: string, quantity: number = 1): Promise<void> {
        const bundle = this.bundles.get(bundleId);
        if (bundle) {
            bundle.soldCount += quantity;
            this.bundles.set(bundleId, bundle);
        }
    }

    // Private methods
    private async saveToServer(bundle: ProductBundle): Promise<void> {
        try {
            await fetch('/api/bundles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bundle),
            });
        } catch {
            // Ignore errors
        }
    }

    private async deleteFromServer(bundleId: string): Promise<void> {
        try {
            await fetch(`/api/bundles/${bundleId}`, {
                method: 'DELETE',
            });
        } catch {
            // Ignore errors
        }
    }
}

// Singleton instance
export const productBundles = new ProductBundleService();

// React hook
export function useProductBundles() {
    return productBundles;
}
