/**
 * Product Label Print API
 * API для друку етикеток товарів
 */

import { NextRequest, NextResponse } from 'next/server';
import { ThermalPrinterService } from '@/lib/hardware/thermal-printer';

interface ProductLabelRequest {
  printerName?: string;
  product: {
    name: string;
    sku: string;
    barcode: string;
    price: number;
    location?: string;
  };
  copies?: number;
}

/**
 * POST /api/hardware/print/product-label
 * Print product label
 */
export async function POST(request: NextRequest) {
  try {
    const body: ProductLabelRequest = await request.json();

    // Validate product data
    if (!body.product) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: product',
        },
        { status: 400 }
      );
    }

    const { product } = body;

    // Validate required fields
    if (!product.name || !product.sku || !product.barcode || product.price === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required product fields: name, sku, barcode, price',
        },
        { status: 400 }
      );
    }

    // Get printer configuration
    const printerName = body.printerName || 'default';
    const copies = body.copies || 1;

    // In production:
    // 1. Load printer config from database
    // 2. Initialize printer service
    // 3. Generate and send label to printer

    // For demo, just generate ZPL
    const printer = new ThermalPrinterService({
      type: 'network',
      width: 60,
      height: 40,
      dpi: 203,
      model: 'zebra',
    });

    // Print labels (handle multiple copies)
    for (let i = 0; i < copies; i++) {
      await printer.printProductLabel(product);
    }

    const jobId = generateJobId();

    return NextResponse.json(
      {
        success: true,
        jobId,
        status: 'queued',
        copies,
        message: `Product label queued for printing (${copies} ${copies === 1 ? 'copy' : 'copies'})`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to print product label:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to print product label',
      },
      { status: 500 }
    );
  }
}

/**
 * Helper: Generate job ID
 */
function generateJobId(): string {
  return `product_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
