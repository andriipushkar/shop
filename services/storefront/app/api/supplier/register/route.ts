/**
 * Supplier Registration API
 * API реєстрації постачальників
 */

import { NextRequest, NextResponse } from 'next/server';
import { Supplier, SupplierRegistration } from '@/lib/dropshipping/supplier-service';

// Mock database (replace with actual database in production)
const suppliers: Supplier[] = [];

export async function POST(request: NextRequest) {
  try {
    const data: SupplierRegistration = await request.json();

    // Validate required fields
    if (!data.companyName || !data.contactPerson || !data.email || !data.phone) {
      return NextResponse.json(
        { error: 'Всі обов\'язкові поля повинні бути заповнені' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingSupplier = suppliers.find(s => s.email === data.email);
    if (existingSupplier) {
      return NextResponse.json(
        { error: 'Постачальник з таким email вже зареєстрований' },
        { status: 409 }
      );
    }

    // Create new supplier
    const newSupplier: Supplier = {
      id: `SUP-${Date.now()}`,
      companyName: data.companyName,
      contactPerson: data.contactPerson,
      email: data.email,
      phone: data.phone,
      edrpou: data.edrpou,
      status: 'pending', // Requires admin approval
      commissionRate: 15, // Default 15%
      paymentTermDays: 14, // Default 14 days
      autoApprove: false,
      apiKey: generateApiKey(),
      createdAt: new Date(),
    };

    suppliers.push(newSupplier);

    // Don't send API key in response (send via email instead)
    const { apiKey, ...supplierResponse } = newSupplier;

    return NextResponse.json({
      ...supplierResponse,
      message: 'Заявка на реєстрацію надіслана. Очікуйте підтвердження адміністратора.',
    }, { status: 201 });
  } catch (error) {
    console.error('Supplier registration error:', error);
    return NextResponse.json(
      { error: 'Помилка реєстрації постачальника' },
      { status: 500 }
    );
  }
}

function generateApiKey(): string {
  return `sk_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
}
