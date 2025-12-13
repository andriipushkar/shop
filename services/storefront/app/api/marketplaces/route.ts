import { NextRequest, NextResponse } from 'next/server';
import { marketplaces, rozetka, prom } from '@/lib/marketplaces';
import { apiLogger } from '@/lib/logger';

// GET /api/marketplaces - Get marketplace connections and stats
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const action = searchParams.get('action');

        if (action === 'connections') {
            const connections = await marketplaces.getConnections();
            return NextResponse.json({
                success: true,
                data: connections,
            });
        }

        if (action === 'stats') {
            const stats = await marketplaces.getCombinedStats();
            return NextResponse.json({
                success: true,
                data: stats,
            });
        }

        if (action === 'orders') {
            const orders = await marketplaces.getAllOrders();
            return NextResponse.json({
                success: true,
                data: orders,
            });
        }

        if (action === 'pending-orders') {
            const counts = await marketplaces.getPendingOrdersCount();
            return NextResponse.json({
                success: true,
                data: counts,
            });
        }

        // Default: return all info
        const [connections, stats, pendingOrders] = await Promise.all([
            marketplaces.getConnections(),
            marketplaces.getCombinedStats(),
            marketplaces.getPendingOrdersCount(),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                connections,
                stats,
                pendingOrders,
            },
        });
    } catch (error) {
        apiLogger.error('Marketplaces API error', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

// POST /api/marketplaces - Perform marketplace actions
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, marketplace, data } = body;

        switch (action) {
            case 'sync-product': {
                const result = await marketplaces.syncProduct(data.product);
                return NextResponse.json({
                    success: true,
                    data: result,
                });
            }

            case 'sync-stock': {
                await marketplaces.syncStock(data.productId, data.quantity);
                return NextResponse.json({
                    success: true,
                    message: 'Stock synced successfully',
                });
            }

            case 'sync-price': {
                await marketplaces.syncPrice(data.productId, data.price, data.oldPrice);
                return NextResponse.json({
                    success: true,
                    message: 'Price synced successfully',
                });
            }

            case 'update-order-status': {
                const result = await marketplaces.updateOrderStatus(
                    marketplace,
                    data.orderId,
                    data.status
                );
                return NextResponse.json({
                    success: result,
                    message: result ? 'Order status updated' : 'Failed to update order status',
                });
            }

            case 'connect': {
                if (marketplace === 'rozetka') {
                    const authenticated = await rozetka.authenticate();
                    return NextResponse.json({
                        success: authenticated,
                        message: authenticated
                            ? 'Connected to Rozetka'
                            : 'Failed to connect to Rozetka',
                    });
                }
                if (marketplace === 'prom') {
                    const authenticated = await prom.authenticate();
                    return NextResponse.json({
                        success: authenticated,
                        message: authenticated
                            ? 'Connected to Prom.ua'
                            : 'Failed to connect to Prom.ua',
                    });
                }
                return NextResponse.json(
                    { success: false, error: 'Unknown marketplace' },
                    { status: 400 }
                );
            }

            default:
                return NextResponse.json(
                    { success: false, error: 'Unknown action' },
                    { status: 400 }
                );
        }
    } catch (error) {
        apiLogger.error('Marketplaces API error', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
