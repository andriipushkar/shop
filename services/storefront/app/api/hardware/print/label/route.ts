/**
 * Shipping Label Print API
 * API для друку накладних
 */

import { NextRequest, NextResponse } from 'next/server';
import { ThermalPrinterService, ShippingLabel } from '@/lib/hardware/thermal-printer';

/**
 * POST /api/hardware/print/label
 * Print shipping label
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate label data
    if (!body.label) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: label',
        },
        { status: 400 }
      );
    }

    const label: ShippingLabel = body.label;

    // Validate required fields
    if (!label.sender || !label.recipient || !label.trackingNumber || !label.barcode) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required label fields',
        },
        { status: 400 }
      );
    }

    // Get printer configuration
    const printerName = body.printerName || 'default';

    // In production:
    // 1. Load printer config from database
    // 2. Initialize printer service
    // 3. Generate and send label to printer

    // For demo, just generate ZPL
    const printer = new ThermalPrinterService({
      type: 'network',
      width: 100,
      height: 150,
      dpi: 203,
      model: 'zebra',
    });

    await printer.printShippingLabel(label);

    const jobId = generateJobId();

    return NextResponse.json(
      {
        success: true,
        jobId,
        status: 'queued',
        message: 'Shipping label queued for printing',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to print shipping label:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to print shipping label',
      },
      { status: 500 }
    );
  }
}

/**
 * Helper: Generate job ID
 */
function generateJobId(): string {
  return `label_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
