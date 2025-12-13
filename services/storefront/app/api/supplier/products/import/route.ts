/**
 * Supplier Products Import API
 * API імпорту товарів постачальника
 */

import { NextRequest, NextResponse } from 'next/server';
import { ImportResult } from '@/lib/dropshipping/supplier-service';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const supplierId = formData.get('supplierId') as string;
    const format = formData.get('format') as 'csv' | 'xlsx' | 'xml';

    if (!file || !supplierId || !format) {
      return NextResponse.json(
        { error: 'Файл, ID постачальника та формат є обов\'язковими' },
        { status: 400 }
      );
    }

    // Read file content
    const content = await file.text();

    let result: ImportResult;

    switch (format) {
      case 'csv':
        result = await importCSV(content, supplierId);
        break;
      case 'xlsx':
        result = await importXLSX(content, supplierId);
        break;
      case 'xml':
        result = await importXML(content, supplierId);
        break;
      default:
        return NextResponse.json(
          { error: 'Непідтримуваний формат файлу' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Помилка імпорту товарів' },
      { status: 500 }
    );
  }
}

async function importCSV(content: string, supplierId: string): Promise<ImportResult> {
  const lines = content.trim().split('\n');
  const errors: string[] = [];
  let imported = 0;

  if (lines.length < 2) {
    return {
      success: false,
      imported: 0,
      failed: 0,
      errors: ['CSV файл порожній або не містить даних'],
    };
  }

  // Expected format: SKU,Name,Description,Price,RetailPrice,Stock,Category,Brand
  const header = lines[0].toLowerCase();

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = lines[i].split(',');

      if (values.length < 4) {
        errors.push(`Рядок ${i + 1}: Недостатньо даних`);
        continue;
      }

      const [sku, name, description, price, retailPrice, stock, category, brand] = values;

      // Validate required fields
      if (!sku || !name || !price) {
        errors.push(`Рядок ${i + 1}: SKU, назва та ціна обов'язкові`);
        continue;
      }

      // Create product (would save to database in production)
      imported++;
    } catch (error) {
      errors.push(`Рядок ${i + 1}: ${error}`);
    }
  }

  return {
    success: errors.length === 0,
    imported,
    failed: lines.length - 1 - imported,
    errors,
  };
}

async function importXLSX(content: string, supplierId: string): Promise<ImportResult> {
  // In production, use a library like 'xlsx' to parse Excel files
  // For now, return placeholder
  return {
    success: false,
    imported: 0,
    failed: 0,
    errors: ['XLSX імпорт ще не реалізовано. Використовуйте CSV формат.'],
  };
}

async function importXML(content: string, supplierId: string): Promise<ImportResult> {
  // In production, parse XML using xml2js or similar
  return {
    success: false,
    imported: 0,
    failed: 0,
    errors: ['XML імпорт ще не реалізовано. Використовуйте CSV формат.'],
  };
}
