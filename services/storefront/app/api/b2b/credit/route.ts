/**
 * B2B Credit API
 * GET /api/b2b/credit - Get credit account info
 */

import { NextRequest, NextResponse } from 'next/server';
import { creditService } from '@/lib/b2b/credit';

export async function GET(request: NextRequest) {
  try {
    // TODO: Get authenticated customer ID from session
    const customerId = 'customer-1'; // Mock for now

    const account = creditService.getAccount(customerId);
    const outstandingInvoices = creditService.getOutstandingInvoices(customerId);
    const recentTransactions = creditService.getPaymentHistory(customerId).slice(0, 10);

    return NextResponse.json({
      account,
      outstandingInvoices,
      recentTransactions,
      summary: {
        totalOutstanding: outstandingInvoices.reduce((sum, inv) => sum + inv.remainingAmount, 0),
        overdueInvoices: outstandingInvoices.filter(inv => inv.isOverdue).length,
        creditUtilization: account.creditLimit > 0
          ? ((account.usedCredit / account.creditLimit) * 100).toFixed(2)
          : '0'
      }
    });
  } catch (error) {
    console.error('Error fetching credit info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
