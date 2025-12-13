/**
 * Supplier Product Detail API
 * API деталей товару постачальника
 */

import { NextRequest, NextResponse } from 'next/server';
import { SupplierProduct } from '@/lib/dropshipping/supplier-service';

// Mock database
const products: Map<string, SupplierProduct> = new Map();

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id;
    const data = await request.json();

    const product = products.get(productId);

    if (!product) {
      return NextResponse.json(
        { error: 'Товар не знайдено' },
        { status: 404 }
      );
    }

    // Update allowed fields
    const allowedFields = [
      'name',
      'description',
      'price',
      'retailPrice',
      'stock',
      'category',
      'brand',
      'images',
      'attributes',
    ];

    const updatedProduct = { ...product };

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        (updatedProduct as any)[field] = data[field];
      }
    }

    // If stock was updated, update timestamp
    if (data.stock !== undefined) {
      updatedProduct.lastStockUpdate = new Date();
    }

    // If product was rejected, reset to pending on update
    if (updatedProduct.status === 'rejected') {
      updatedProduct.status = 'pending';
      updatedProduct.rejectionReason = undefined;
    }

    products.set(productId, updatedProduct);

    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json(
      { error: 'Помилка оновлення товару' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id;

    const product = products.get(productId);

    if (!product) {
      return NextResponse.json(
        { error: 'Товар не знайдено' },
        { status: 404 }
      );
    }

    products.delete(productId);

    return NextResponse.json({ message: 'Товар успішно видалено' });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json(
      { error: 'Помилка видалення товару' },
      { status: 500 }
    );
  }
}
