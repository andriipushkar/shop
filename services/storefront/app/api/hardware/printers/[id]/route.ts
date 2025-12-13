/**
 * Individual Printer Operations API
 * API для операцій з окремим принтером
 */

import { NextRequest, NextResponse } from 'next/server';

// This would be shared with main route in production
let printers: any[] = [];

/**
 * GET /api/hardware/printers/[id]
 * Get printer by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const printer = printers.find((p) => p.id === params.id);

    if (!printer) {
      return NextResponse.json(
        {
          success: false,
          error: 'Printer not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      printer,
    });
  } catch (error) {
    console.error('Failed to get printer:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get printer',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/hardware/printers/[id]
 * Update printer configuration
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const index = printers.findIndex((p) => p.id === params.id);

    if (index === -1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Printer not found',
        },
        { status: 404 }
      );
    }

    // Check if name is being changed to existing name
    if (body.name && body.name !== printers[index].name) {
      if (printers.some((p) => p.name === body.name && p.id !== params.id)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Printer with this name already exists',
          },
          { status: 409 }
        );
      }
    }

    // Update printer
    printers[index] = {
      ...printers[index],
      ...body,
      id: params.id, // Prevent ID change
      updatedAt: new Date().toISOString(),
    };

    // If this is set as default, unset other defaults
    if (body.default === true) {
      printers.forEach((p, i) => {
        if (i !== index) {
          p.default = false;
        }
      });
    }

    return NextResponse.json({
      success: true,
      printer: printers[index],
    });
  } catch (error) {
    console.error('Failed to update printer:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update printer',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hardware/printers/[id]
 * Delete printer
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const index = printers.findIndex((p) => p.id === params.id);

    if (index === -1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Printer not found',
        },
        { status: 404 }
      );
    }

    const deleted = printers.splice(index, 1)[0];

    return NextResponse.json({
      success: true,
      message: 'Printer deleted',
      printer: deleted,
    });
  } catch (error) {
    console.error('Failed to delete printer:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete printer',
      },
      { status: 500 }
    );
  }
}
