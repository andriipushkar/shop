/**
 * Printer Management API
 * API для управління принтерами
 */

import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for demo (use database in production)
let printers: PrinterConfig[] = [];

interface PrinterConfig {
  id: string;
  name: string;
  type: 'thermal' | 'receipt' | 'label';
  connection: 'usb' | 'network' | 'bluetooth';
  address?: string;
  port?: number;
  width: number;
  height: number;
  dpi: 203 | 300;
  model?: string;
  default?: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/hardware/printers
 * List all configured printers
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const enabled = searchParams.get('enabled');

    let filtered = [...printers];

    if (type) {
      filtered = filtered.filter((p) => p.type === type);
    }

    if (enabled !== null) {
      const isEnabled = enabled === 'true';
      filtered = filtered.filter((p) => p.enabled === isEnabled);
    }

    return NextResponse.json({
      success: true,
      printers: filtered,
      count: filtered.length,
    });
  } catch (error) {
    console.error('Failed to get printers:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get printers',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hardware/printers
 * Add new printer configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.type || !body.connection) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: name, type, connection',
        },
        { status: 400 }
      );
    }

    // Check if name already exists
    if (printers.some((p) => p.name === body.name)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Printer with this name already exists',
        },
        { status: 409 }
      );
    }

    const printer: PrinterConfig = {
      id: generateId(),
      name: body.name,
      type: body.type,
      connection: body.connection,
      address: body.address,
      port: body.port,
      width: body.width || 100,
      height: body.height || 150,
      dpi: body.dpi || 203,
      model: body.model,
      default: body.default || false,
      enabled: body.enabled !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // If this is set as default, unset other defaults
    if (printer.default) {
      printers.forEach((p) => (p.default = false));
    }

    printers.push(printer);

    return NextResponse.json(
      {
        success: true,
        printer,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to add printer:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to add printer',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hardware/printers
 * Delete all printers (for reset)
 */
export async function DELETE(request: NextRequest) {
  try {
    const count = printers.length;
    printers = [];

    return NextResponse.json({
      success: true,
      message: `Deleted ${count} printers`,
      count,
    });
  } catch (error) {
    console.error('Failed to delete printers:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete printers',
      },
      { status: 500 }
    );
  }
}

/**
 * Helper: Generate unique ID
 */
function generateId(): string {
  return `printer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
