import { NextRequest, NextResponse } from 'next/server';
import { rozetka, prom, marketplaces } from '@/lib/marketplaces';
import { apiLogger } from '@/lib/logger';

// POST /api/marketplaces/sync - Full sync with marketplaces
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { marketplace, syncType = 'full', productIds } = body;

        const results: {
            marketplace: string;
            success: boolean;
            processed: number;
            created: number;
            updated: number;
            failed: number;
            errors: string[];
        }[] = [];

        // Sync with Rozetka
        if (!marketplace || marketplace === 'rozetka') {
            try {
                // Get products to sync (mock implementation)
                const productsToSync = productIds
                    ? await getProductsByIds(productIds)
                    : await getAllProducts();

                const rozetkaProducts = productsToSync.map((p) => ({
                    id: '',
                    externalId: p.id,
                    name: p.name,
                    nameUa: p.nameUa || p.name,
                    description: p.description,
                    descriptionUa: p.descriptionUa || p.description,
                    price: p.price,
                    quantity: p.stock,
                    categoryId: Number(p.categoryId) || 80253,
                    brand: p.brand || '',
                    images: p.images || [],
                    attributes: p.attributes || [],
                    status: 'active' as const,
                }));

                const result = await rozetka.syncProducts(rozetkaProducts);
                results.push({
                    marketplace: 'rozetka',
                    success: result.success,
                    processed: result.processed,
                    created: result.created,
                    updated: result.updated,
                    failed: result.failed,
                    errors: result.errors.map((e) => e.error),
                });
            } catch (error) {
                results.push({
                    marketplace: 'rozetka',
                    success: false,
                    processed: 0,
                    created: 0,
                    updated: 0,
                    failed: 0,
                    errors: [error instanceof Error ? error.message : 'Unknown error'],
                });
            }
        }

        // Sync with Prom.ua
        if (!marketplace || marketplace === 'prom') {
            try {
                const productsToSync = productIds
                    ? await getProductsByIds(productIds)
                    : await getAllProducts();

                let created = 0;
                let updated = 0;
                let failed = 0;
                const errors: string[] = [];

                for (const p of productsToSync) {
                    try {
                        const promProduct = {
                            id: 0,
                            externalId: p.id,
                            name: p.name,
                            nameUa: p.nameUa || p.name,
                            description: p.description,
                            descriptionUa: p.descriptionUa || p.description,
                            price: p.price,
                            currency: 'UAH' as const,
                            quantity: p.stock,
                            categoryId: Number(p.categoryId) || 1,
                            images: (p.images || []).map((url, i) => ({
                                id: i + 1,
                                url,
                                isMain: i === 0,
                            })),
                            attributes: p.attributes || [],
                            status: 'on_display' as const,
                            presence: p.stock > 0 ? ('available' as const) : ('not_available' as const),
                            sellingType: 'retail' as const,
                        };

                        const existing = await prom.getProduct(p.id);
                        if (existing) {
                            await prom.updateProduct(promProduct);
                            updated++;
                        } else {
                            await prom.createProduct(promProduct);
                            created++;
                        }
                    } catch (error) {
                        failed++;
                        errors.push(`Product ${p.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }

                results.push({
                    marketplace: 'prom',
                    success: failed === 0,
                    processed: productsToSync.length,
                    created,
                    updated,
                    failed,
                    errors,
                });
            } catch (error) {
                results.push({
                    marketplace: 'prom',
                    success: false,
                    processed: 0,
                    created: 0,
                    updated: 0,
                    failed: 0,
                    errors: [error instanceof Error ? error.message : 'Unknown error'],
                });
            }
        }

        const allSuccess = results.every((r) => r.success);
        const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
        const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
        const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
        const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

        return NextResponse.json({
            success: allSuccess,
            summary: {
                processed: totalProcessed,
                created: totalCreated,
                updated: totalUpdated,
                failed: totalFailed,
            },
            results,
        });
    } catch (error) {
        apiLogger.error('Sync API error', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

// Mock functions - replace with actual database calls
async function getAllProducts() {
    // In real implementation, fetch from database
    return [
        {
            id: 'prod-1',
            name: 'iPhone 15 Pro',
            nameUa: 'iPhone 15 Pro',
            description: 'Latest Apple smartphone with powerful features',
            descriptionUa: '09=>2VH89 A<0@BD>= Apple 7 ?>BC6=8<8 DC=:FVO<8',
            price: 54999,
            stock: 25,
            categoryId: '80253',
            brand: 'Apple',
            images: ['https://example.com/iphone.jpg'],
            attributes: [],
        },
        {
            id: 'prod-2',
            name: 'Samsung Galaxy S24',
            nameUa: 'Samsung Galaxy S24',
            description: 'Premium Android smartphone',
            descriptionUa: '@5<V0;L=89 Android A<0@BD>=',
            price: 42999,
            stock: 30,
            categoryId: '80253',
            brand: 'Samsung',
            images: ['https://example.com/samsung.jpg'],
            attributes: [],
        },
    ];
}

async function getProductsByIds(ids: string[]) {
    const allProducts = await getAllProducts();
    return allProducts.filter((p) => ids.includes(p.id));
}
