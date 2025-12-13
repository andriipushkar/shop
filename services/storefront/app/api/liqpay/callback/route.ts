import { NextRequest, NextResponse } from 'next/server';
import { verifyCallback, parseCallbackData, isPaymentSuccessful, isPaymentFailed, type LiqPayStatus } from '@/lib/liqpay';
import { prisma } from '@/lib/db/prisma';
import type { PaymentStatus } from '@prisma/client';
import { apiLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const data = formData.get('data') as string;
    const signature = formData.get('signature') as string;

    if (!data || !signature) {
      return NextResponse.json(
        { error: 'Missing data or signature' },
        { status: 400 }
      );
    }

    // Verify the callback signature
    const isValid = verifyCallback(data, signature);
    if (!isValid) {
      apiLogger.error('LiqPay callback: Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      );
    }

    // Parse the callback data
    const callbackData = parseCallbackData(data);
    if (!callbackData) {
      return NextResponse.json(
        { error: 'Invalid callback data' },
        { status: 400 }
      );
    }

    const { order_id, status, amount, payment_id } = callbackData;

    apiLogger.info('LiqPay callback received:', {
      order_id,
      status,
      amount,
      payment_id,
    });

    // Map LiqPay status to our payment status
    const mapPaymentStatus = (liqpayStatus: LiqPayStatus): PaymentStatus => {
      if (isPaymentSuccessful(liqpayStatus)) return 'PAID';
      if (isPaymentFailed(liqpayStatus)) return 'FAILED';
      return 'PENDING';
    };

    const paymentStatus = mapPaymentStatus(status);

    // Find order by order number
    const order = await prisma.order.findUnique({
      where: { orderNumber: order_id },
    });

    if (!order) {
      apiLogger.error(`Order not found: ${order_id}`);
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Convert payment_id to string
    const paymentIdStr = payment_id ? String(payment_id) : null;

    // Update order payment status
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus,
        paymentId: paymentIdStr,
        // If paid, confirm the order
        ...(paymentStatus === 'PAID' && order.status === 'PENDING'
          ? { status: 'CONFIRMED' }
          : {}),
      },
    });

    // Create or update payment record
    const paymentRecordId = paymentIdStr || `liqpay-${order_id}`;
    await prisma.payment.upsert({
      where: {
        id: paymentRecordId,
      },
      create: {
        id: paymentRecordId,
        orderId: order.id,
        amount: amount,
        method: 'liqpay',
        status: paymentStatus,
        transactionId: paymentIdStr,
        metadata: callbackData as object,
      },
      update: {
        status: paymentStatus,
        transactionId: paymentIdStr,
        metadata: callbackData as object,
      },
    });

    // Create order history entry
    await prisma.orderHistory.create({
      data: {
        orderId: order.id,
        status: order.status,
        comment: `Статус оплати: ${paymentStatus}. LiqPay ID: ${paymentIdStr || 'N/A'}`,
      },
    });

    apiLogger.info(`Order ${order_id} payment status updated to ${paymentStatus}`);

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    apiLogger.error('LiqPay callback error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// LiqPay also sends GET requests for redirects
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const orderId = searchParams.get('order_id');

  // Redirect to orders page with success message
  const redirectUrl = new URL('/orders', request.nextUrl.origin);
  if (orderId) {
    redirectUrl.searchParams.set('payment', 'success');
    redirectUrl.searchParams.set('order', orderId);
  }

  return NextResponse.redirect(redirectUrl);
}
