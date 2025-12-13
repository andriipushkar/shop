/**
 * Supplier Products API
 * API товарів постачальника
 */

import { NextRequest, NextResponse } from 'next/server';
import { SupplierProduct, ProductFilters } from '@/lib/dropshipping/supplier-service';

// Mock database
const products: Map<string, SupplierProduct> = new Map();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const supplierId = searchParams.get('supplierId');

    if (!supplierId) {
      return NextResponse.json(
        { error: 'ID постачальника обов\'язковий' },
        { status: 400 }
      );
    }

    // Get all products for this supplier
    let supplierProducts = Array.from(products.values()).filter(
      p => p.supplierId === supplierId
    );

    // Apply filters
    const filters: ProductFilters = {
      category: searchParams.get('category') || undefined,
      status: (searchParams.get('status') as any) || undefined,
      search: searchParams.get('search') || undefined,
      minPrice: searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined,
      maxPrice: searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined,
      inStock: searchParams.get('inStock') === 'true' ? true : undefined,
    };

    if (filters.category) {
      supplierProducts = supplierProducts.filter(p => p.category === filters.category);
    }

    if (filters.status) {
      supplierProducts = supplierProducts.filter(p => p.status === filters.status);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      supplierProducts = supplierProducts.filter(
        p => p.name.toLowerCase().includes(searchLower) ||
             p.sku.toLowerCase().includes(searchLower)
      );
    }

    if (filters.minPrice !== undefined) {
      supplierProducts = supplierProducts.filter(p => p.price >= filters.minPrice!);
    }

    if (filters.maxPrice !== undefined) {
      supplierProducts = supplierProducts.filter(p => p.price <= filters.maxPrice!);
    }

    if (filters.inStock) {
      supplierProducts = supplierProducts.filter(p => p.stock > 0);
    }

    return NextResponse.json(supplierProducts);
  } catch (error) {
    console.error('Get products error:', error);
    return NextResponse.json(
      { error: 'Помилка отримання товарів' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { supplierId, ...productData } = data;

    if (!supplierId) {
      return NextResponse.json(
        { error: 'ID постачальника обов\'язковий' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!productData.sku || !productData.name || !productData.price) {
      return NextResponse.json(
        { error: 'SKU, назва та ціна є обов\'язковими полями' },
        { status: 400 }
      );
    }

    // Check if SKU already exists for this supplier
    const existingProduct = Array.from(products.values()).find(
      p => p.supplierId === supplierId && p.sku === productData.sku
    );

    if (existingProduct) {
      return NextResponse.json(
        { error: 'Товар з таким SKU вже існує' },
        { status: 409 }
      );
    }

    const newProduct: SupplierProduct = {
      id: `PROD-${Date.now()}`,
      supplierId,
      sku: productData.sku,
      name: productData.name,
      description: productData.description || '',
      price: productData.price,
      retailPrice: productData.retailPrice,
      stock: productData.stock || 0,
      category: productData.category || 'Uncategorized',
      brand: productData.brand,
      images: productData.images || [],
      attributes: productData.attributes || {},
      status: 'pending', // Requires admin approval
      lastStockUpdate: new Date(),
    };

    products.set(newProduct.id, newProduct);

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json(
      { error: 'Помилка створення товару' },
      { status: 500 }
    );
  }
}
