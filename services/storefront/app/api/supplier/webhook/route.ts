/**
 * Supplier Webhook API
 * API вебхуків для оновлень від постачальників
 */

import { NextRequest, NextResponse } from 'next/server';
import { StockUpdate } from '@/lib/dropshipping/supplier-service';
import { StockSyncService } from '@/lib/dropshipping/stock-sync';

const stockSyncService = new StockSyncService();

export async function POST(request: NextRequest) {
  try {
    // Get API key from header
    const apiKey = request.headers.get('X-API-Key');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API ключ обов\'язковий' },
        { status: 401 }
      );
    }

    // Validate API key and get supplier ID
    // In production, validate against database
    const supplierId = validateApiKey(apiKey);

    if (!supplierId) {
      return NextResponse.json(
        { error: 'Невірний API ключ' },
        { status: 401 }
      );
    }

    const data = await request.json();
    const { type, updates } = data;

    switch (type) {
      case 'stock_update':
        if (!Array.isArray(updates)) {
          return NextResponse.json(
            { error: 'Updates повинен бути масивом' },
            { status: 400 }
          );
        }

        await stockSyncService.handleStockWebhook(supplierId, updates as StockUpdate[]);

        return NextResponse.json({
          success: true,
          message: `Оновлено ${updates.length} товарів`,
        });

      case 'order_status':
        // Handle order status updates from supplier
        return NextResponse.json({
          success: true,
          message: 'Order status webhook received',
        });

      default:
        return NextResponse.json(
          { error: 'Невідомий тип webhook' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Помилка обробки webhook' },
      { status: 500 }
    );
  }
}

function validateApiKey(apiKey: string): string | null {
  // In production, validate against database
  // For now, just extract supplier ID from key format: sk_SUPPLIER_ID_randomstring
  const match = apiKey.match(/^sk_(.+?)_/);
  return match ? match[1] : null;
}
