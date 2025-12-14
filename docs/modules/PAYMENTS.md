# Payment Processing

Comprehensive payment integration supporting multiple Ukrainian and international payment providers.

## Supported Providers

| Provider | Type | Region | Features |
|----------|------|--------|----------|
| LiqPay | Gateway | Ukraine | Card, Apple Pay, Google Pay, Privat24 |
| Monobank Acquiring | Gateway | Ukraine | Card, Apple Pay, MonoPay |
| PrivatBank | Gateway | Ukraine | Card, Installments |
| Stripe | Gateway | Global | Card, Apple Pay, Google Pay, Klarna |
| Fondy | Gateway | Ukraine | Card, Apple Pay, Google Pay |
| WayForPay | Gateway | Ukraine | Card, Apple Pay |

## Payment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      PAYMENT FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Customer ──▶ Select Payment Method ──▶ Initialize Payment      │
│                                              │                   │
│                    ┌─────────────────────────┼──────────────┐   │
│                    │                         │              │   │
│                    ▼                         ▼              ▼   │
│              ┌──────────┐            ┌──────────┐    ┌─────────┐│
│              │ Redirect │            │  Widget  │    │   API   ││
│              │ (LiqPay) │            │ (Stripe) │    │  (Mono) ││
│              └────┬─────┘            └────┬─────┘    └────┬────┘│
│                   │                       │               │     │
│                   └───────────────────────┼───────────────┘     │
│                                           ▼                     │
│                                   Payment Provider              │
│                                           │                     │
│                                           ▼                     │
│                                   Webhook Callback              │
│                                           │                     │
│                                           ▼                     │
│                            Verify Signature & Update Order      │
│                                           │                     │
│                                           ▼                     │
│                                   Send Confirmation             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Provider Integrations

### LiqPay

Official PrivatBank payment gateway.

**Configuration:**
```bash
LIQPAY_PUBLIC_KEY=your_public_key
LIQPAY_PRIVATE_KEY=your_private_key
LIQPAY_SANDBOX=false
```

**Create Payment:**
```typescript
import { LiqPay } from '@/lib/payments/liqpay';

const liqpay = new LiqPay(publicKey, privateKey);

const payment = await liqpay.createPayment({
  orderId: order.id,
  amount: order.total,
  currency: 'UAH',
  description: `Order #${order.id}`,
  resultUrl: `${SITE_URL}/order-success`,
  serverUrl: `${API_URL}/webhooks/liqpay`,
  language: 'uk',
});

// Redirect customer to payment.checkoutUrl
```

**Verify Webhook:**
```typescript
app.post('/webhooks/liqpay', async (req, res) => {
  const { data, signature } = req.body;

  if (!liqpay.verifySignature(data, signature)) {
    return res.status(400).send('Invalid signature');
  }

  const decoded = liqpay.decodeData(data);

  if (decoded.status === 'success' || decoded.status === 'sandbox') {
    await updateOrderStatus(decoded.order_id, 'paid');
  }

  res.send('OK');
});
```

**Supported Actions:**
- `pay` - Standard payment
- `hold` - Pre-authorization
- `subscribe` - Recurring payments
- `paydonate` - Donations
- `refund` - Full/partial refund

### Monobank Acquiring

Direct integration with Monobank.

**Configuration:**
```bash
MONO_TOKEN=your_merchant_token
MONO_WEBHOOK_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...
```

**Create Invoice:**
```typescript
import { MonoAcquiring } from '@/lib/payments/mono';

const mono = new MonoAcquiring(token);

const invoice = await mono.createInvoice({
  amount: Math.round(order.total * 100), // kopecks
  ccy: 980, // UAH ISO code
  merchantPaymInfo: {
    reference: order.id,
    destination: `Payment for order #${order.id}`,
    basketOrder: order.items.map(item => ({
      name: item.name,
      qty: item.quantity,
      sum: Math.round(item.price * 100),
      code: item.sku,
    })),
  },
  redirectUrl: `${SITE_URL}/order-success`,
  webHookUrl: `${API_URL}/webhooks/mono`,
  validity: 3600, // 1 hour
});

// Redirect to invoice.pageUrl
```

**Verify Webhook:**
```typescript
import { verifyMonoSignature } from '@/lib/payments/mono';

app.post('/webhooks/mono', async (req, res) => {
  const signature = req.headers['x-sign'];
  const pubKey = process.env.MONO_WEBHOOK_PUBLIC_KEY;

  if (!verifyMonoSignature(req.body, signature, pubKey)) {
    return res.status(400).send('Invalid signature');
  }

  const { invoiceId, status, reference } = req.body;

  if (status === 'success') {
    await updateOrderStatus(reference, 'paid');
  }

  res.send('OK');
});
```

### PrivatBank Installments (Оплата частинами)

Pay in installments without credit.

**Configuration:**
```bash
PRIVATBANK_MERCHANT_ID=your_merchant_id
PRIVATBANK_PASSWORD=your_password
PRIVATBANK_STORE_ID=your_store_id
```

**Create Installment Payment:**
```typescript
import { PrivatBank } from '@/lib/payments/privatbank';

const privat = new PrivatBank(merchantId, password, storeId);

// Get available parts count options
const options = await privat.getPartsOptions(order.total);
// Returns: [{ parts: 2, monthlyPayment: 500 }, { parts: 3, ... }]

const payment = await privat.createInstallment({
  orderId: order.id,
  amount: order.total,
  partsCount: 3, // Number of installments
  products: order.items.map(item => ({
    name: item.name,
    count: item.quantity,
    price: item.price,
  })),
  recipientId: customer.phone,
  responseUrl: `${API_URL}/webhooks/privatbank`,
  redirectUrl: `${SITE_URL}/order-success`,
});

// Redirect to payment.checkoutUrl
```

### Stripe

Global payment processing.

**Configuration:**
```bash
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PUBLIC_KEY=pk_live_xxx
```

**Create Checkout Session:**
```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: order.items.map(item => ({
    price_data: {
      currency: 'uah',
      product_data: {
        name: item.name,
        images: [item.image],
      },
      unit_amount: Math.round(item.price * 100),
    },
    quantity: item.quantity,
  })),
  mode: 'payment',
  success_url: `${SITE_URL}/order-success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${SITE_URL}/checkout`,
  metadata: {
    orderId: order.id,
  },
});

// Redirect to session.url
```

**Webhook Handler:**
```typescript
app.post('/webhooks/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      await updateOrderStatus(session.metadata.orderId, 'paid');
      break;
    case 'payment_intent.payment_failed':
      // Handle failure
      break;
  }

  res.json({ received: true });
});
```

## Payment Methods

### Card Payment

Standard credit/debit card payment:
- Visa, Mastercard, Maestro
- 3D Secure verification
- PCI DSS compliance (via provider)

### Apple Pay / Google Pay

One-tap mobile payments:
```typescript
// Check availability
const applePayAvailable = window.ApplePaySession?.canMakePayments();
const googlePayAvailable = await checkGooglePayAvailability();

// Initialize
if (applePayAvailable) {
  showApplePayButton();
}
```

### Installments

Interest-free installments (Оплата частинами):
- PrivatBank: 2-24 months
- Monobank: 3-12 months
- Payment schedule displayed at checkout

### Bank Transfer

Direct bank transfer (prepayment):
```typescript
const bankDetails = {
  bankName: 'ПриватБанк',
  iban: 'UA123456789012345678901234567',
  recipient: 'ТОВ "Компанія"',
  edrpou: '12345678',
  purpose: `Оплата за замовлення #${order.id}`,
};
```

### Cash on Delivery (COD)

Payment upon delivery:
```typescript
const codOrder = {
  paymentMethod: 'cod',
  codAmount: order.total,
  codFee: 20.00, // Extra fee for COD
};
```

## Refunds

### Full Refund

```typescript
// LiqPay
await liqpay.refund({
  orderId: order.id,
  amount: order.total,
});

// Stripe
await stripe.refunds.create({
  payment_intent: paymentIntentId,
});

// Mono
await mono.cancelInvoice(invoiceId);
```

### Partial Refund

```typescript
await stripe.refunds.create({
  payment_intent: paymentIntentId,
  amount: 5000, // Partial amount in cents
});
```

## Payment Status

| Status | Description |
|--------|-------------|
| `pending` | Awaiting payment |
| `processing` | Payment in progress |
| `success` | Payment completed |
| `failed` | Payment failed |
| `cancelled` | Cancelled by user |
| `refunded` | Full refund |
| `partially_refunded` | Partial refund |
| `hold` | Pre-authorized |
| `expired` | Payment link expired |

## Security

### Webhook Verification

All webhooks must be verified:
```typescript
// Always verify signatures
if (!verifyWebhookSignature(payload, signature, secret)) {
  throw new Error('Invalid webhook signature');
}

// Validate expected fields
if (!payload.orderId || !payload.amount) {
  throw new Error('Missing required fields');
}

// Check order exists and amount matches
const order = await getOrder(payload.orderId);
if (order.total !== payload.amount) {
  throw new Error('Amount mismatch');
}
```

### PCI DSS Compliance

Card data handling:
- Never store full card numbers
- Use provider's hosted payment pages
- Tokenize cards for recurring payments
- Use HTTPS for all payment pages

### Fraud Prevention

```typescript
// Check for suspicious activity
const fraudScore = await checkFraud({
  email: customer.email,
  ip: request.ip,
  amount: order.total,
  cardCountry: paymentDetails.country,
  billingCountry: order.billingAddress.country,
});

if (fraudScore > 0.8) {
  await flagForReview(order.id);
}
```

## Testing

### Test Cards

| Provider | Card Number | Result |
|----------|-------------|--------|
| LiqPay (sandbox) | 4242424242424242 | Success |
| Stripe | 4242424242424242 | Success |
| Stripe | 4000000000000002 | Decline |
| Stripe | 4000002500003155 | 3D Secure |

### Sandbox/Test Mode

```bash
# Enable test mode
LIQPAY_SANDBOX=true
STRIPE_SECRET_KEY=sk_test_xxx
MONO_TEST_MODE=true
```

## Reporting

### Payment Report

```typescript
const report = await payments.getReport({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  groupBy: 'provider',
});

// Returns:
// {
//   total: 150000.00,
//   count: 1250,
//   byProvider: {
//     liqpay: { total: 80000, count: 700 },
//     mono: { total: 50000, count: 400 },
//     stripe: { total: 20000, count: 150 },
//   },
//   byStatus: {
//     success: 1200,
//     failed: 35,
//     refunded: 15,
//   }
// }
```

### Reconciliation

Daily reconciliation with providers:
```typescript
const reconciliation = await payments.reconcile({
  date: '2024-01-15',
  provider: 'liqpay',
});

// Check for discrepancies
for (const discrepancy of reconciliation.discrepancies) {
  console.log(`Order ${discrepancy.orderId}: ours=${discrepancy.ourAmount}, theirs=${discrepancy.providerAmount}`);
}
```

## Configuration Summary

```bash
# LiqPay
LIQPAY_PUBLIC_KEY=
LIQPAY_PRIVATE_KEY=
LIQPAY_SANDBOX=false

# Monobank
MONO_TOKEN=
MONO_WEBHOOK_PUBLIC_KEY=

# PrivatBank Installments
PRIVATBANK_MERCHANT_ID=
PRIVATBANK_PASSWORD=
PRIVATBANK_STORE_ID=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLIC_KEY=
STRIPE_WEBHOOK_SECRET=

# Fondy
FONDY_MERCHANT_ID=
FONDY_PASSWORD=

# General
PAYMENT_WEBHOOK_BASE_URL=https://api.yourstore.com/webhooks
PAYMENT_SUCCESS_URL=https://yourstore.com/order-success
PAYMENT_CANCEL_URL=https://yourstore.com/checkout
```
