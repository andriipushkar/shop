import { NextRequest, NextResponse } from 'next/server';
import { verifyCallback, parseCallbackData, isPaymentSuccessful, isPaymentFailed } from '@/lib/liqpay';
import { sendShippingNotification } from '@/lib/email';

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
      console.error('LiqPay callback: Invalid signature');
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

    console.log('LiqPay callback received:', {
      order_id,
      status,
      amount,
      payment_id,
    });

    // Handle payment status
    if (isPaymentSuccessful(status)) {
      // Update order status in database
      // In production, this would call your order service
      console.log(`Payment successful for order ${order_id}`);

      // TODO: Update order payment_status to 'paid' in database
      // await updateOrderPaymentStatus(order_id, 'paid', payment_id);

      // Send notification email
      // Note: In production, you'd fetch order details from database
      // and send proper email notification

    } else if (isPaymentFailed(status)) {
      console.log(`Payment failed for order ${order_id}`);
      // TODO: Update order payment_status to 'failed' in database
      // await updateOrderPaymentStatus(order_id, 'failed', payment_id);
    } else {
      // Payment is pending or in other intermediate state
      console.log(`Payment status ${status} for order ${order_id}`);
      // TODO: Update order payment_status accordingly
      // await updateOrderPaymentStatus(order_id, status, payment_id);
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('LiqPay callback error:', error);
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
