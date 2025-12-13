/**
 * B2B Price List API
 * GET /api/b2b/price-list - Download price list (xlsx/csv/xml)
 */

import { NextRequest, NextResponse } from 'next/server';
import { priceListGenerator } from '@/lib/b2b/price-list-generator';
import type { PriceListProduct } from '@/lib/b2b/types';

export async function GET(request: NextRequest) {
  try {
    // TODO: Get authenticated customer ID from session
    const customerId = 'customer-1'; // Mock for now

    const searchParams = request.nextUrl.searchParams;
    const format = (searchParams.get('format') || 'csv') as 'xlsx' | 'csv' | 'xml' | 'yml';
    const includeImages = searchParams.get('includeImages') === 'true';
    const includeStock = searchParams.get('includeStock') === 'true';
    const categories = searchParams.get('categories')?.split(',');

    // Mock product data - in real app, fetch from database
    const products: PriceListProduct[] = [
      {
        sku: 'PROD-001',
        name: 'Premium Laptop',
        nameUk: 'Преміум ноутбук',
        description: 'High-performance laptop for professionals',
        descriptionUk: 'Високопродуктивний ноутбук для професіоналів',
        category: 'Electronics',
        categoryUk: 'Електроніка',
        brand: 'TechBrand',
        price: 25000,
        oldPrice: 30000,
        stock: 15,
        imageUrl: 'https://example.com/laptop.jpg',
        barcode: '1234567890123',
        weight: 2.5,
        dimensions: { length: 35, width: 25, height: 2 }
      },
      {
        sku: 'PROD-002',
        name: 'Wireless Mouse',
        nameUk: 'Бездротова миша',
        description: 'Ergonomic wireless mouse',
        descriptionUk: 'Ергономічна бездротова миша',
        category: 'Accessories',
        categoryUk: 'Аксесуари',
        brand: 'TechBrand',
        price: 500,
        stock: 50,
        imageUrl: 'https://example.com/mouse.jpg',
        barcode: '1234567890124',
        weight: 0.1,
        dimensions: { length: 12, width: 7, height: 4 }
      },
      {
        sku: 'PROD-003',
        name: 'Mechanical Keyboard',
        nameUk: 'Механічна клавіатура',
        description: 'RGB mechanical gaming keyboard',
        descriptionUk: 'RGB механічна ігрова клавіатура',
        category: 'Accessories',
        categoryUk: 'Аксесуари',
        brand: 'TechBrand',
        price: 2500,
        oldPrice: 3000,
        stock: 30,
        imageUrl: 'https://example.com/keyboard.jpg',
        barcode: '1234567890125',
        weight: 0.8,
        dimensions: { length: 45, width: 15, height: 4 }
      }
    ];

    const config = {
      customerId,
      format,
      includeImages,
      includeStock,
      categories
    };

    const result = await priceListGenerator.generate(products, config);

    // Set appropriate headers based on format
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'xlsx':
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `price-list-${Date.now()}.xlsx`;
        break;
      case 'csv':
        contentType = 'text/csv';
        filename = `price-list-${Date.now()}.csv`;
        break;
      case 'xml':
        contentType = 'application/xml';
        filename = `price-list-${Date.now()}.xml`;
        break;
      case 'yml':
        contentType = 'application/xml';
        filename = `price-list-${Date.now()}.yml`;
        break;
      default:
        contentType = 'text/plain';
        filename = `price-list-${Date.now()}.txt`;
    }

    return new NextResponse(result, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating price list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
