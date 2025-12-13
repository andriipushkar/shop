/**
 * Supplier Products Export API
 * API експорту товарів постачальника
 */

import { NextRequest, NextResponse } from 'next/server';
import { SupplierProduct } from '@/lib/dropshipping/supplier-service';

// Mock database
const products: Map<string, SupplierProduct> = new Map();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const supplierId = searchParams.get('supplierId');
    const format = searchParams.get('format') || 'csv';

    if (!supplierId) {
      return NextResponse.json(
        { error: 'ID постачальника обов\'язковий' },
        { status: 400 }
      );
    }

    // Get all products for this supplier
    const supplierProducts = Array.from(products.values()).filter(
      p => p.supplierId === supplierId
    );

    if (format === 'csv') {
      const csv = exportToCSV(supplierProducts);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="products-${supplierId}-${Date.now()}.csv"`,
        },
      });
    } else if (format === 'xlsx') {
      // In production, use a library like 'xlsx' to generate Excel files
      return NextResponse.json(
        { error: 'XLSX експорт ще не реалізовано' },
        { status: 501 }
      );
    } else {
      return NextResponse.json(
        { error: 'Непідтримуваний формат експорту' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Помилка експорту товарів' },
      { status: 500 }
    );
  }
}

function exportToCSV(products: SupplierProduct[]): string {
  const headers = [
    'SKU',
    'Назва',
    'Опис',
    'Ціна',
    'Роздрібна ціна',
    'Залишок',
    'Категорія',
    'Бренд',
    'Статус',
  ];

  const rows = products.map(p => [
    p.sku,
    `"${p.name}"`,
    `"${p.description}"`,
    p.price,
    p.retailPrice || '',
    p.stock,
    p.category,
    p.brand || '',
    p.status,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');

  return csvContent;
}
