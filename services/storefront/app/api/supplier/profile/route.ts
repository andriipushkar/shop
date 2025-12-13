/**
 * Supplier Profile API
 * API профілю постачальника
 */

import { NextRequest, NextResponse } from 'next/server';
import { Supplier } from '@/lib/dropshipping/supplier-service';

// Mock database (replace with actual database in production)
const suppliers: Map<string, Supplier> = new Map();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const supplierId = searchParams.get('id');

    if (!supplierId) {
      return NextResponse.json(
        { error: 'ID постачальника обов\'язковий' },
        { status: 400 }
      );
    }

    const supplier = suppliers.get(supplierId);

    if (!supplier) {
      return NextResponse.json(
        { error: 'Постачальника не знайдено' },
        { status: 404 }
      );
    }

    // Remove sensitive data
    const { apiKey, ...supplierData } = supplier;

    return NextResponse.json(supplierData);
  } catch (error) {
    console.error('Get supplier error:', error);
    return NextResponse.json(
      { error: 'Помилка отримання даних постачальника' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const { supplierId, ...updateData } = data;

    if (!supplierId) {
      return NextResponse.json(
        { error: 'ID постачальника обов\'язковий' },
        { status: 400 }
      );
    }

    const supplier = suppliers.get(supplierId);

    if (!supplier) {
      return NextResponse.json(
        { error: 'Постачальника не знайдено' },
        { status: 404 }
      );
    }

    // Update allowed fields only
    const allowedFields = ['companyName', 'contactPerson', 'phone', 'edrpou', 'webhookUrl'];
    const updatedSupplier = { ...supplier };

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        (updatedSupplier as any)[field] = updateData[field];
      }
    }

    suppliers.set(supplierId, updatedSupplier);

    const { apiKey, ...supplierResponse } = updatedSupplier;

    return NextResponse.json(supplierResponse);
  } catch (error) {
    console.error('Update supplier error:', error);
    return NextResponse.json(
      { error: 'Помилка оновлення даних постачальника' },
      { status: 500 }
    );
  }
}
