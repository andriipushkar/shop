/**
 * B2B Invoices API
 * GET /api/b2b/invoices - Get invoices
 */

import { NextRequest, NextResponse } from 'next/server';
import { creditService } from '@/lib/b2b/credit';

export async function GET(request: NextRequest) {
  try {
    // TODO: Get authenticated customer ID from session
    const customerId = 'customer-1'; // Mock for now

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status'); // 'outstanding' or 'all'

    let invoices;
    if (status === 'outstanding') {
      invoices = creditService.getOutstandingInvoices(customerId);
    } else {
      invoices = creditService.getAllInvoices(customerId);
    }

    // Calculate summary
    const summary = {
      totalInvoices: invoices.length,
      totalAmount: invoices.reduce((sum, inv) => sum + inv.amount, 0),
      totalPaid: invoices.reduce((sum, inv) => sum + inv.paidAmount, 0),
      totalOutstanding: invoices.reduce((sum, inv) => sum + inv.remainingAmount, 0),
      overdueInvoices: invoices.filter(inv => inv.isOverdue).length,
      overdueAmount: invoices
        .filter(inv => inv.isOverdue)
        .reduce((sum, inv) => sum + inv.remainingAmount, 0)
    };

    return NextResponse.json({
      invoices,
      summary
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
