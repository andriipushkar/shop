

// Mock fetch
global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
});

import {
    productBundles,
    ProductBundle,
    BundleItem,
} from '@/lib/bundles/product-bundles';

describe('ProductBundleService', () => {
    const mockProduct = {
        id: '1',
        name: 'iPhone 15 Pro',
        slug: 'iphone-15-pro',
        price: 45000,
        salePrice: null,
        images: ['/images/iphone.jpg'],
        category: 'smartphones',
        description: 'Latest iPhone',
        stock: 10,
        rating: 4.8,
        reviewCount: 120,
        isNew: true,
        isBestseller: true,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getActiveBundles', () => {
        it('should return active bundles sorted by sold count', () => {
            const bundles = productBundles.getActiveBundles();

            expect(Array.isArray(bundles)).toBe(true);
            bundles.forEach((bundle) => {
                expect(bundle.status).toBe('active');
            });

            // Check sorted by soldCount descending
            for (let i = 1; i < bundles.length; i++) {
                expect(bundles[i - 1].soldCount).toBeGreaterThanOrEqual(bundles[i].soldCount);
            }
        });
    });

    describe('getBundle', () => {
        it('should return bundle by ID', () => {
            const bundles = productBundles.getActiveBundles();
            if (bundles.length > 0) {
                const bundle = productBundles.getBundle(bundles[0].id);
                expect(bundle).toBeDefined();
                expect(bundle?.id).toBe(bundles[0].id);
            }
        });

        it('should return undefined for non-existent ID', () => {
            const bundle = productBundles.getBundle('non-existent');
            expect(bundle).toBeUndefined();
        });
    });

    describe('getBundleBySlug', () => {
        it('should return bundle by slug', () => {
            const bundle = productBundles.getBundleBySlug('gamer-kit');
            expect(bundle).toBeDefined();
            expect(bundle?.slug).toBe('gamer-kit');
        });

        it('should return undefined for non-existent slug', () => {
            const bundle = productBundles.getBundleBySlug('non-existent-slug');
            expect(bundle).toBeUndefined();
        });
    });

    describe('calculateBundlePrice', () => {
        it('should calculate percentage discount', () => {
            const bundle: ProductBundle = {
                id: 'test',
                name: 'Test Bundle',
                slug: 'test',
                description: 'Test',
                items: [
                    {
                        productId: '1',
                        product: mockProduct,
                        quantity: 1,
                        isRequired: true,
                        originalPrice: 1000,
                        bundlePrice: 900,
                    },
                    {
                        productId: '2',
                        product: { ...mockProduct, id: '2' },
                        quantity: 1,
                        isRequired: true,
                        originalPrice: 500,
                        bundlePrice: 450,
                    },
                ],
                bundleType: 'fixed',
                pricing: { type: 'sum_discounted' },
                discountType: 'percentage',
                discountValue: 20,
                originalPrice: 1500,
                bundlePrice: 1200,
                savings: 300,
                savingsPercentage: 20,
                status: 'active',
                soldCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const result = productBundles.calculateBundlePrice(bundle);

            expect(result.originalPrice).toBe(1500);
            expect(result.bundlePrice).toBe(1200);
            expect(result.savings).toBe(300);
            expect(result.savingsPercentage).toBe(20);
        });

        it('should calculate fixed amount discount', () => {
            const bundle: ProductBundle = {
                id: 'test',
                name: 'Test Bundle',
                slug: 'test',
                description: 'Test',
                items: [
                    {
                        productId: '1',
                        product: mockProduct,
                        quantity: 1,
                        isRequired: true,
                        originalPrice: 1000,
                        bundlePrice: 800,
                    },
                ],
                bundleType: 'fixed',
                pricing: { type: 'sum_discounted' },
                discountType: 'fixed_amount',
                discountValue: 200,
                originalPrice: 1000,
                bundlePrice: 800,
                savings: 200,
                savingsPercentage: 20,
                status: 'active',
                soldCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const result = productBundles.calculateBundlePrice(bundle);

            expect(result.bundlePrice).toBe(800);
            expect(result.savings).toBe(200);
        });

        it('should calculate cheapest free pricing', () => {
            const bundle: ProductBundle = {
                id: 'test',
                name: 'Buy 2 Get 1 Free',
                slug: 'test',
                description: 'Test',
                items: [
                    {
                        productId: '1',
                        product: mockProduct,
                        quantity: 1,
                        isRequired: true,
                        originalPrice: 1000,
                        bundlePrice: 1000,
                    },
                    {
                        productId: '2',
                        product: { ...mockProduct, id: '2' },
                        quantity: 1,
                        isRequired: true,
                        originalPrice: 800,
                        bundlePrice: 800,
                    },
                    {
                        productId: '3',
                        product: { ...mockProduct, id: '3' },
                        quantity: 1,
                        isRequired: true,
                        originalPrice: 500,
                        bundlePrice: 0,
                    },
                ],
                bundleType: 'bogo',
                pricing: { type: 'cheapest_free' },
                discountType: 'percentage',
                discountValue: 0,
                originalPrice: 2300,
                bundlePrice: 1800,
                savings: 500,
                savingsPercentage: 22,
                status: 'active',
                soldCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const result = productBundles.calculateBundlePrice(bundle);

            // Cheapest item (500) should be free
            expect(result.bundlePrice).toBe(1800);
            expect(result.savings).toBe(500);
        });

        it('should calculate tiered pricing', () => {
            const bundle: ProductBundle = {
                id: 'test',
                name: 'Tiered Bundle',
                slug: 'test',
                description: 'Test',
                items: [
                    {
                        productId: '1',
                        product: mockProduct,
                        quantity: 3,
                        isRequired: true,
                        originalPrice: 100,
                        bundlePrice: 85,
                    },
                ],
                bundleType: 'tiered',
                pricing: {
                    type: 'tiered',
                    tiers: [
                        { minQuantity: 2, discountPercentage: 10 },
                        { minQuantity: 3, discountPercentage: 15 },
                        { minQuantity: 5, discountPercentage: 20 },
                    ],
                },
                discountType: 'percentage',
                discountValue: 15,
                originalPrice: 300,
                bundlePrice: 255,
                savings: 45,
                savingsPercentage: 15,
                status: 'active',
                soldCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const result = productBundles.calculateBundlePrice(bundle);

            // 3 items should get 15% discount
            expect(result.bundlePrice).toBe(255);
            expect(result.savingsPercentage).toBe(15);
        });
    });

    describe('validateBundleSelection', () => {
        it('should validate required items', () => {
            const bundle: ProductBundle = {
                id: 'test',
                name: 'Test',
                slug: 'test',
                description: 'Test',
                items: [
                    {
                        productId: '1',
                        product: mockProduct,
                        quantity: 1,
                        isRequired: true,
                        originalPrice: 1000,
                        bundlePrice: 900,
                    },
                ],
                bundleType: 'fixed',
                pricing: { type: 'sum_discounted' },
                discountType: 'percentage',
                discountValue: 10,
                originalPrice: 1000,
                bundlePrice: 900,
                savings: 100,
                savingsPercentage: 10,
                status: 'active',
                soldCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            // Empty selection should fail
            const result = productBundles.validateBundleSelection(bundle, []);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should validate minimum quantity', () => {
            const bundle: ProductBundle = {
                id: 'test',
                name: 'Test',
                slug: 'test',
                description: 'Test',
                items: [],
                bundleType: 'mix_match',
                pricing: { type: 'sum_discounted' },
                discountType: 'percentage',
                discountValue: 10,
                originalPrice: 0,
                bundlePrice: 0,
                savings: 0,
                savingsPercentage: 0,
                minQuantity: 3,
                status: 'active',
                soldCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const selectedItems: BundleItem[] = [
                {
                    productId: '1',
                    product: mockProduct,
                    quantity: 1,
                    isRequired: false,
                    originalPrice: 1000,
                    bundlePrice: 900,
                },
            ];

            const result = productBundles.validateBundleSelection(bundle, selectedItems);

            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('Мінімальна кількість'))).toBe(true);
        });

        it('should validate stock availability', () => {
            const bundle: ProductBundle = {
                id: 'test',
                name: 'Test',
                slug: 'test',
                description: 'Test',
                items: [],
                bundleType: 'fixed',
                pricing: { type: 'sum_discounted' },
                discountType: 'percentage',
                discountValue: 10,
                originalPrice: 0,
                bundlePrice: 0,
                savings: 0,
                savingsPercentage: 0,
                status: 'active',
                soldCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const outOfStockProduct = { ...mockProduct, stock: 0 };
            const selectedItems: BundleItem[] = [
                {
                    productId: '1',
                    product: outOfStockProduct,
                    quantity: 5,
                    isRequired: false,
                    originalPrice: 1000,
                    bundlePrice: 900,
                },
            ];

            const result = productBundles.validateBundleSelection(bundle, selectedItems);

            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('недостатньо на складі'))).toBe(true);
        });
    });

    describe('createBundleCartItem', () => {
        it('should create cart item for valid bundle selection', () => {
            const bundle: ProductBundle = {
                id: 'test',
                name: 'Test',
                slug: 'test',
                description: 'Test',
                items: [
                    {
                        productId: '1',
                        product: mockProduct,
                        quantity: 1,
                        isRequired: true,
                        originalPrice: 1000,
                        bundlePrice: 900,
                    },
                ],
                bundleType: 'fixed',
                pricing: { type: 'sum_discounted' },
                discountType: 'percentage',
                discountValue: 10,
                originalPrice: 1000,
                bundlePrice: 900,
                savings: 100,
                savingsPercentage: 10,
                status: 'active',
                soldCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const selectedItems = bundle.items;

            const cartItem = productBundles.createBundleCartItem(bundle, selectedItems, 2);

            expect(cartItem).not.toBeNull();
            expect(cartItem?.bundleId).toBe('test');
            expect(cartItem?.quantity).toBe(2);
            expect(cartItem?.totalPrice).toBe(1800); // 900 * 2
        });

        it('should return null for invalid selection', () => {
            const bundle: ProductBundle = {
                id: 'test',
                name: 'Test',
                slug: 'test',
                description: 'Test',
                items: [
                    {
                        productId: '1',
                        product: mockProduct,
                        quantity: 1,
                        isRequired: true,
                        originalPrice: 1000,
                        bundlePrice: 900,
                    },
                ],
                bundleType: 'fixed',
                pricing: { type: 'sum_discounted' },
                discountType: 'percentage',
                discountValue: 10,
                originalPrice: 1000,
                bundlePrice: 900,
                savings: 100,
                savingsPercentage: 10,
                status: 'active',
                soldCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            // Empty selection should fail validation
            const cartItem = productBundles.createBundleCartItem(bundle, [], 1);

            expect(cartItem).toBeNull();
        });
    });

    describe('getRecommendedBundles', () => {
        it('should return bundles containing cart products', () => {
            // This depends on mock bundles setup
            const recommendations = productBundles.getRecommendedBundles(['1', '2']);

            expect(Array.isArray(recommendations)).toBe(true);
            expect(recommendations.length).toBeLessThanOrEqual(3);
        });
    });

    describe('CRUD operations', () => {
        it('should create new bundle', async () => {
            const newBundle = await productBundles.createBundle({
                name: 'New Test Bundle',
                slug: 'new-test-bundle',
                description: 'Test description',
                items: [],
                bundleType: 'fixed',
                pricing: { type: 'sum_discounted' },
                discountType: 'percentage',
                discountValue: 15,
                originalPrice: 0,
                bundlePrice: 0,
                savings: 0,
                savingsPercentage: 0,
                status: 'active',
            });

            expect(newBundle.id).toBeDefined();
            expect(newBundle.name).toBe('New Test Bundle');
        });

        it('should update bundle', async () => {
            const bundles = productBundles.getActiveBundles();
            if (bundles.length > 0) {
                const updated = await productBundles.updateBundle(bundles[0].id, {
                    name: 'Updated Name',
                });

                expect(updated?.name).toBe('Updated Name');
            }
        });

        it('should delete bundle', async () => {
            const newBundle = await productBundles.createBundle({
                name: 'To Delete',
                slug: 'to-delete',
                description: 'Test',
                items: [],
                bundleType: 'fixed',
                pricing: { type: 'sum_discounted' },
                discountType: 'percentage',
                discountValue: 10,
                originalPrice: 0,
                bundlePrice: 0,
                savings: 0,
                savingsPercentage: 0,
                status: 'active',
            });

            const deleted = await productBundles.deleteBundle(newBundle.id);
            expect(deleted).toBe(true);

            const found = productBundles.getBundle(newBundle.id);
            expect(found).toBeUndefined();
        });
    });

    describe('recordPurchase', () => {
        it('should increment sold count', async () => {
            const bundles = productBundles.getActiveBundles();
            if (bundles.length > 0) {
                const originalCount = bundles[0].soldCount;

                await productBundles.recordPurchase(bundles[0].id, 2);

                const updated = productBundles.getBundle(bundles[0].id);
                expect(updated?.soldCount).toBe(originalCount + 2);
            }
        });
    });
});
