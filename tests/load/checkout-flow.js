// k6 Checkout Flow Test
// Run: k6 run tests/load/checkout-flow.js

import http from 'k6/http';
import { check, sleep, group, fail } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const checkoutSuccess = new Counter('checkout_success');
const checkoutFailed = new Counter('checkout_failed');
const checkoutDuration = new Trend('checkout_duration');
const paymentDuration = new Trend('payment_duration');

export const options = {
  scenarios: {
    checkout_flow: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '2m', target: 5 },   // 5 checkouts/sec
        { duration: '5m', target: 10 },  // 10 checkouts/sec
        { duration: '3m', target: 20 },  // 20 checkouts/sec
        { duration: '5m', target: 10 },  // Back to 10
        { duration: '2m', target: 0 },   // Ramp down
      ],
    },
  },
  thresholds: {
    'checkout_success': ['count>100'],
    'checkout_duration': ['p(95)<5000'],  // 95% checkout < 5s
    'http_req_failed': ['rate<0.02'],     // Error rate < 2%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:8080/api/v1';

// Test user credentials
const testUsers = [
  { email: 'test1@example.com', password: 'testpass123' },
  { email: 'test2@example.com', password: 'testpass123' },
  { email: 'test3@example.com', password: 'testpass123' },
];

// Test shipping addresses
const shippingAddresses = [
  {
    first_name: 'John',
    last_name: 'Doe',
    street: '123 Main St',
    city: 'Kyiv',
    state: 'Kyiv',
    postal_code: '01001',
    country: 'Ukraine',
    phone: '+380501234567',
  },
  {
    first_name: 'Jane',
    last_name: 'Smith',
    street: '456 Oak Ave',
    city: 'Lviv',
    state: 'Lviv',
    postal_code: '79000',
    country: 'Ukraine',
    phone: '+380672345678',
  },
];

export function setup() {
  // Get available products
  const res = http.get(`${BASE_URL}/products?limit=50`);
  if (res.status !== 200) {
    fail('Could not fetch products for test setup');
  }

  const data = JSON.parse(res.body);
  const products = (data.items || data || []).filter(p => p.quantity > 0);

  if (products.length === 0) {
    fail('No available products for checkout test');
  }

  return { products };
}

export default function(data) {
  const products = data.products;
  const headers = { 'Content-Type': 'application/json' };
  const checkoutStart = Date.now();

  let sessionId = `test-session-${__VU}-${__ITER}`;

  group('1. Browse and Add to Cart', () => {
    // Select 1-3 random products
    const numProducts = Math.floor(Math.random() * 3) + 1;
    const selectedProducts = [];

    for (let i = 0; i < numProducts; i++) {
      const product = products[Math.floor(Math.random() * products.length)];
      selectedProducts.push({
        product_id: product.id,
        quantity: Math.floor(Math.random() * 2) + 1,
      });
    }

    // Add each product to cart
    for (const item of selectedProducts) {
      const res = http.post(
        `${BASE_URL}/cart/items`,
        JSON.stringify(item),
        {
          headers: {
            ...headers,
            'X-Session-ID': sessionId,
          }
        }
      );

      check(res, {
        'add to cart successful': (r) => r.status === 200 || r.status === 201,
      });

      sleep(0.2);
    }
  });

  group('2. View Cart', () => {
    const res = http.get(`${BASE_URL}/cart`, {
      headers: { 'X-Session-ID': sessionId }
    });

    check(res, {
      'cart retrieved': (r) => r.status === 200,
      'cart has items': (r) => {
        const body = JSON.parse(r.body);
        return (body.items || []).length > 0;
      },
    });

    sleep(0.5);
  });

  group('3. Apply Promo Code', () => {
    // Try applying a promo code (may or may not exist)
    const res = http.post(
      `${BASE_URL}/cart/promo`,
      JSON.stringify({ code: 'TESTPROMO10' }),
      {
        headers: {
          ...headers,
          'X-Session-ID': sessionId,
        }
      }
    );

    // Promo might not exist, so we just check it doesn't error badly
    check(res, {
      'promo code handled': (r) => r.status === 200 || r.status === 400 || r.status === 404,
    });

    sleep(0.3);
  });

  group('4. Checkout - Shipping Info', () => {
    const address = shippingAddresses[Math.floor(Math.random() * shippingAddresses.length)];

    const res = http.post(
      `${BASE_URL}/checkout/shipping`,
      JSON.stringify({
        ...address,
        email: `test-${__VU}-${Date.now()}@example.com`,
      }),
      {
        headers: {
          ...headers,
          'X-Session-ID': sessionId,
        }
      }
    );

    check(res, {
      'shipping info saved': (r) => r.status === 200 || r.status === 201,
    });

    sleep(0.3);
  });

  group('5. Checkout - Payment', () => {
    const paymentStart = Date.now();

    const res = http.post(
      `${BASE_URL}/checkout/payment`,
      JSON.stringify({
        payment_method: 'card',
        // Mock card data for testing
        card_token: 'tok_test_' + Date.now(),
      }),
      {
        headers: {
          ...headers,
          'X-Session-ID': sessionId,
        }
      }
    );

    paymentDuration.add(Date.now() - paymentStart);

    check(res, {
      'payment processed': (r) => r.status === 200 || r.status === 201,
    });

    sleep(0.3);
  });

  group('6. Complete Order', () => {
    const res = http.post(
      `${BASE_URL}/checkout/complete`,
      JSON.stringify({}),
      {
        headers: {
          ...headers,
          'X-Session-ID': sessionId,
        }
      }
    );

    const success = check(res, {
      'order created': (r) => r.status === 200 || r.status === 201,
      'order has ID': (r) => {
        if (r.status !== 200 && r.status !== 201) return false;
        const body = JSON.parse(r.body);
        return body.order_id || body.id;
      },
    });

    if (success) {
      checkoutSuccess.add(1);
    } else {
      checkoutFailed.add(1);
    }
  });

  checkoutDuration.add(Date.now() - checkoutStart);

  // Think time between checkouts
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  const success = data.metrics.checkout_success?.values?.count || 0;
  const failed = data.metrics.checkout_failed?.values?.count || 0;
  const total = success + failed;
  const successRate = total > 0 ? ((success / total) * 100).toFixed(2) : 0;

  return {
    'tests/load/checkout-summary.json': JSON.stringify(data, null, 2),
    stdout: `
========== Checkout Flow Summary ==========

Total Checkouts Attempted: ${total}
Successful Checkouts: ${success}
Failed Checkouts: ${failed}
Success Rate: ${successRate}%

Checkout Duration (p95): ${(data.metrics.checkout_duration?.values?.['p(95)'] || 0).toFixed(2)}ms
Payment Duration (p95): ${(data.metrics.payment_duration?.values?.['p(95)'] || 0).toFixed(2)}ms

HTTP Metrics:
  Total Requests: ${data.metrics.http_reqs?.values?.count || 0}
  Failed Requests: ${data.metrics.http_req_failed?.values?.passes || 0}
  Avg Response: ${(data.metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms

===========================================
`,
  };
}
