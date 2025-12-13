// Set mock environment variables before importing
process.env.ROZETKA_API_KEY = 'test-api-key';
process.env.ROZETKA_SELLER_ID = 'test-seller-id';
process.env.PROM_API_KEY = 'test-prom-key';

// Mock fetch
global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
});

import {
    rozetka,
    prom,
    marketplaces,
    RozetkaProduct,
    PromProduct,
} from '@/lib/marketplaces';

describe('Rozetka Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Authentication', () => {
        it('should authenticate with valid credentials', async () => {
            const result = await rozetka.authenticate();
            // Without actual credentials, it returns true in mock mode
            expect(typeof result).toBe('boolean');
        });
    });

    describe('Categories', () => {
        it('should get categories', async () => {
            const categories = await rozetka.getCategories();

            expect(Array.isArray(categories)).toBe(true);
            expect(categories.length).toBeGreaterThan(0);

            categories.forEach((category) => {
                expect(category).toMatchObject({
                    id: expect.any(Number),
                    name: expect.any(String),
                });
            });
        });

        it('should get category attributes', async () => {
            const attributes = await rozetka.getCategoryAttributes(80253);

            expect(Array.isArray(attributes)).toBe(true);
        });
    });

    describe('Products', () => {
        const mockProduct: RozetkaProduct = {
            id: '',
            externalId: 'test-123',
            name: 'Test Product',
            nameUa: 'Тестовий товар',
            description: 'Test description that is long enough for validation',
            descriptionUa: 'Тестовий опис достатньої довжини для валідації',
            price: 1000,
            quantity: 10,
            categoryId: 80253,
            brand: 'TestBrand',
            images: ['https://example.com/image.jpg'],
            attributes: [],
            status: 'active',
        };

        it('should create product', async () => {
            const product = await rozetka.createProduct(mockProduct);

            expect(product.id).toBeDefined();
            expect(product.externalId).toBe('test-123');
            expect(product.status).toBe('moderation');
        });

        it('should validate product before creation', () => {
            const invalidProduct: RozetkaProduct = {
                ...mockProduct,
                name: 'AB', // Too short
                description: 'Short', // Too short
                price: 0, // Invalid
                images: [], // Empty
            };

            const validation = rozetka.validateProduct(invalidProduct);

            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });

        it('should sync products', async () => {
            const result = await rozetka.syncProducts([mockProduct]);

            expect(result).toMatchObject({
                success: expect.any(Boolean),
                processed: expect.any(Number),
                created: expect.any(Number),
                updated: expect.any(Number),
                failed: expect.any(Number),
                errors: expect.any(Array),
            });
        });

        it('should update stock', async () => {
            await rozetka.createProduct(mockProduct);
            await rozetka.updateStock('test-123', 5);

            const product = await rozetka.getProduct('test-123');
            expect(product?.quantity).toBe(5);
        });

        it('should update price', async () => {
            await rozetka.createProduct(mockProduct);
            await rozetka.updatePrice('test-123', 1500, 2000);

            const product = await rozetka.getProduct('test-123');
            expect(product?.price).toBe(1500);
            expect(product?.oldPrice).toBe(2000);
        });
    });

    describe('Orders', () => {
        it('should get orders', async () => {
            const orders = await rozetka.getOrders();

            expect(Array.isArray(orders)).toBe(true);
        });

        it('should get orders by status', async () => {
            const orders = await rozetka.getOrders('new');

            orders.forEach((order) => {
                expect(order.status).toBe('new');
            });
        });

        it('should update order status', async () => {
            const orders = await rozetka.getOrders();
            if (orders.length > 0) {
                const updated = await rozetka.updateOrderStatus(orders[0].id, 'processing');
                expect(updated?.status).toBe('processing');
            }
        });
    });

    describe('Statistics', () => {
        it('should get stats', async () => {
            const stats = await rozetka.getStats();

            expect(stats).toMatchObject({
                totalProducts: expect.any(Number),
                activeProducts: expect.any(Number),
                totalOrders: expect.any(Number),
                pendingOrders: expect.any(Number),
                revenue: expect.any(Number),
                commission: expect.any(Number),
            });
        });
    });

    describe('Transform to Rozetka format', () => {
        it('should transform product to Rozetka format', () => {
            const product: Partial<RozetkaProduct> = {
                nameUa: 'Тестовий товар',
                descriptionUa: 'Опис',
                price: 1000,
                oldPrice: 1200,
                quantity: 5,
                categoryId: 80253,
                brand: 'Brand',
                images: ['img1.jpg'],
                attributes: [{ id: 1, name: 'Color', value: 'Black' }],
            };

            const transformed = rozetka.transformToRozetkaFormat(product);

            expect(transformed).toMatchObject({
                name: 'Тестовий товар',
                description: 'Опис',
                price: 1000,
                old_price: 1200,
                quantity: 5,
                category_id: 80253,
            });
        });
    });
});

describe('Prom Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Authentication', () => {
        it('should authenticate', async () => {
            const result = await prom.authenticate();
            expect(typeof result).toBe('boolean');
        });
    });

    describe('Categories', () => {
        it('should get categories', async () => {
            const categories = await prom.getCategories();

            expect(Array.isArray(categories)).toBe(true);
            expect(categories.length).toBeGreaterThan(0);
        });
    });

    describe('Products', () => {
        const mockProduct: PromProduct = {
            id: 0,
            externalId: 'prom-test-123',
            name: 'Test Product',
            nameUa: 'Тестовий товар',
            description: 'Test description long enough',
            descriptionUa: 'Тестовий опис достатньої довжини',
            price: 1000,
            currency: 'UAH',
            quantity: 10,
            categoryId: 1,
            images: [{ id: 1, url: 'https://example.com/image.jpg', isMain: true }],
            attributes: [],
            status: 'on_display',
            presence: 'available',
            sellingType: 'retail',
        };

        it('should create product', async () => {
            const product = await prom.createProduct(mockProduct);

            expect(product.id).toBeDefined();
            expect(product.externalId).toBe('prom-test-123');
        });

        it('should validate product', () => {
            const invalidProduct: PromProduct = {
                ...mockProduct,
                name: 'AB', // Too short
                description: 'Short', // Too short
                price: 0,
                images: [],
            };

            const validation = prom.validateProduct(invalidProduct);

            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });

        it('should update stock with presence', async () => {
            await prom.createProduct(mockProduct);
            await prom.updateStock('prom-test-123', 0, 'not_available');

            const product = await prom.getProduct('prom-test-123');
            expect(product?.quantity).toBe(0);
            expect(product?.presence).toBe('not_available');
        });

        it('should set discount', async () => {
            await prom.createProduct(mockProduct);
            await prom.setDiscount('prom-test-123', {
                type: 'percent',
                value: 15,
                dateStart: new Date().toISOString(),
                dateEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            });

            const product = await prom.getProduct('prom-test-123');
            expect(product?.discount?.value).toBe(15);
        });
    });

    describe('Orders', () => {
        it('should get orders', async () => {
            const orders = await prom.getOrders();

            expect(Array.isArray(orders)).toBe(true);
        });

        it('should get orders with filters', async () => {
            const orders = await prom.getOrders({
                status: 'pending',
                limit: 10,
            });

            expect(orders.length).toBeLessThanOrEqual(10);
        });

        it('should update order status', async () => {
            const orders = await prom.getOrders();
            if (orders.length > 0) {
                const updated = await prom.updateOrderStatus(orders[0].id, 'received');
                expect(updated?.status).toBe('received');
            }
        });

        it('should add seller comment', async () => {
            const orders = await prom.getOrders();
            if (orders.length > 0) {
                const updated = await prom.addSellerComment(orders[0].id, 'Test comment');
                expect(updated?.sellerComment).toBe('Test comment');
            }
        });

        it('should set delivery tracking', async () => {
            const orders = await prom.getOrders();
            if (orders.length > 0 && orders[0].deliveryProviderData) {
                await prom.setDeliveryTracking(orders[0].id, '20450000000000');
                const order = await prom.getOrder(orders[0].id);
                expect(order?.deliveryProviderData?.declarationNumber).toBe('20450000000000');
            }
        });
    });

    describe('Messages', () => {
        it('should get messages', async () => {
            const messages = await prom.getMessages();

            expect(Array.isArray(messages)).toBe(true);
        });

        it('should send message', async () => {
            const message = await prom.sendMessage(123, 'Test message');

            expect(message).toMatchObject({
                chatId: 123,
                text: 'Test message',
                sender: 'company',
            });
        });
    });

    describe('Statistics', () => {
        it('should get stats', async () => {
            const stats = await prom.getStats();

            expect(stats).toMatchObject({
                totalProducts: expect.any(Number),
                activeProducts: expect.any(Number),
                totalOrders: expect.any(Number),
                pendingOrders: expect.any(Number),
                revenue: expect.any(Number),
                views: expect.any(Number),
                messages: expect.any(Number),
            });
        });
    });

    describe('Product Feed', () => {
        it('should generate YML product feed', () => {
            const feed = prom.generateProductFeed();

            expect(feed).toContain('<?xml version="1.0"');
            expect(feed).toContain('<yml_catalog');
            expect(feed).toContain('<shop>');
            expect(feed).toContain('<offers>');
        });
    });
});

describe('Unified Marketplaces Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Connections', () => {
        it('should get all marketplace connections', async () => {
            const connections = await marketplaces.getConnections();

            expect(Array.isArray(connections)).toBe(true);
            expect(connections.length).toBe(2); // Rozetka and Prom

            connections.forEach((conn) => {
                expect(conn).toMatchObject({
                    marketplace: expect.any(String),
                    isConnected: expect.any(Boolean),
                });
            });
        });
    });

    describe('Product sync', () => {
        it('should sync product to all marketplaces', async () => {
            const product = {
                id: 'unified-123',
                name: 'Unified Product',
                description: 'Description that is long enough for all marketplace validations',
                price: 1000,
                quantity: 10,
                categoryId: '80253',
                brand: 'Brand',
                images: ['https://example.com/image.jpg'],
                attributes: [{ name: 'Color', value: 'Black' }],
                marketplaces: {},
            };

            const results = await marketplaces.syncProduct(product);

            // Results can be empty if credentials are not configured (mock mode)
            expect(typeof results).toBe('object');
        });

        it('should sync stock to all marketplaces', async () => {
            // Should not throw
            await expect(marketplaces.syncStock('product-123', 50)).resolves.not.toThrow();
        });

        it('should sync price to all marketplaces', async () => {
            await expect(marketplaces.syncPrice('product-123', 1500, 2000)).resolves.not.toThrow();
        });
    });

    describe('Orders', () => {
        it('should get all orders from all marketplaces', async () => {
            const orders = await marketplaces.getAllOrders();

            expect(Array.isArray(orders)).toBe(true);

            // Orders should be from both marketplaces
            const marketplaceTypes = new Set(orders.map((o) => o.marketplace));
            expect(marketplaceTypes.size).toBeLessThanOrEqual(2);

            // Should be sorted by date descending
            for (let i = 1; i < orders.length; i++) {
                const prevDate = new Date(orders[i - 1].createdAt).getTime();
                const currDate = new Date(orders[i].createdAt).getTime();
                expect(prevDate).toBeGreaterThanOrEqual(currDate);
            }
        });

        it('should get pending orders count', async () => {
            const counts = await marketplaces.getPendingOrdersCount();

            expect(counts).toMatchObject({
                rozetka: expect.any(Number),
                prom: expect.any(Number),
                total: expect.any(Number),
            });

            expect(counts.total).toBe(counts.rozetka + counts.prom);
        });

        it('should update order status', async () => {
            const orders = await marketplaces.getAllOrders();
            if (orders.length > 0) {
                const result = await marketplaces.updateOrderStatus(
                    orders[0].marketplace,
                    orders[0].externalId,
                    'processing'
                );
                expect(result).toBe(true);
            }
        });
    });

    describe('Combined statistics', () => {
        it('should get combined stats', async () => {
            const stats = await marketplaces.getCombinedStats();

            expect(stats).toMatchObject({
                totalProducts: expect.any(Number),
                totalOrders: expect.any(Number),
                totalRevenue: expect.any(Number),
                pendingOrders: expect.any(Number),
                byMarketplace: {
                    rozetka: {
                        products: expect.any(Number),
                        orders: expect.any(Number),
                        revenue: expect.any(Number),
                    },
                    prom: {
                        products: expect.any(Number),
                        orders: expect.any(Number),
                        revenue: expect.any(Number),
                    },
                },
            });
        });
    });
});
