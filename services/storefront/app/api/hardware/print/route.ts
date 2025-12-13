/**
 * Print Job API
 * API для друку документів
 */

import { NextRequest, NextResponse } from 'next/server';

interface PrintJobRequest {
  printerId?: string;
  printerName?: string;
  content: string;
  type: 'zpl' | 'tspl' | 'escpos' | 'pdf' | 'raw';
  copies?: number;
}

/**
 * POST /api/hardware/print
 * Send print job
 */
export async function POST(request: NextRequest) {
  try {
    const body: PrintJobRequest = await request.json();

    // Validate request
    if (!body.content) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: content',
        },
        { status: 400 }
      );
    }

    if (!body.printerId && !body.printerName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Must specify either printerId or printerName',
        },
        { status: 400 }
      );
    }

    // In production, this would:
    // 1. Validate printer exists and is enabled
    // 2. Queue the print job
    // 3. Send to print server or local printer
    // 4. Return job ID for tracking

    const jobId = generateJobId();

    // Simulate async printing
    setTimeout(() => {
      console.log(`Print job ${jobId} completed`);
    }, 2000);

    return NextResponse.json(
      {
        success: true,
        jobId,
        status: 'queued',
        message: 'Print job queued successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create print job:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create print job',
      },
      { status: 500 }
    );
  }
}

/**
 * Helper: Generate job ID
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
