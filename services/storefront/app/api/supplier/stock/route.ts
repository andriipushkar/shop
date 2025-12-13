/**
 * Supplier Stock Management API
 * API управління залишками постачальника
 */

import { NextRequest, NextResponse } from 'next/server';
import { StockUpdate } from '@/lib/dropshipping/supplier-service';
import { SupplierProduct } from '@/lib/dropshipping/supplier-service';

// Mock database
const products: Map<string, SupplierProduct> = new Map();

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { supplierId, updates } = data as { supplierId: string; updates: StockUpdate[] };

    if (!supplierId || !updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'ID постачальника та масив оновлень обов\'язкові' },
        { status: 400 }
      );
    }

    const results = {
      updated: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const update of updates) {
      try {
        // Find product by SKU and supplier
        const product = Array.from(products.values()).find(
          p => p.supplierId === supplierId && p.sku === update.sku
        );

        if (!product) {
          results.failed++;
          results.errors.push(`SKU ${update.sku}: Товар не знайдено`);
          continue;
        }

        // Update stock
        product.stock = update.stock;

        // Update price if provided
        if (update.price !== undefined) {
          product.price = update.price;
        }

        product.lastStockUpdate = new Date();

        products.set(product.id, product);
        results.updated++;
      } catch (error) {
        results.failed++;
        results.errors.push(`SKU ${update.sku}: ${error}`);
      }
    }

    return NextResponse.json({
      success: results.failed === 0,
      ...results,
      message: `Оновлено: ${results.updated}, Помилок: ${results.failed}`,
    });
  } catch (error) {
    console.error('Stock update error:', error);
    return NextResponse.json(
      { error: 'Помилка оновлення залишків' },
      { status: 500 }
    );
  }
}
