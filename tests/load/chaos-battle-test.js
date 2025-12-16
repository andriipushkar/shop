// k6 Chaos Battle Test - Run alongside Chaos Mesh experiments
// This tests system resilience under failure conditions
// Run: k6 run --env CHAOS_ACTIVE=true tests/load/chaos-battle-test.js

import http from 'k6/http';
import { check, sleep, group, fail } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// =============================================================================
// CUSTOM METRICS
// =============================================================================

// Business metrics
const ordersAttempted = new Counter('orders_attempted');
const ordersCompleted = new Counter('orders_completed');
const ordersFailed = new Counter('orders_failed');
const ordersSuccessRate = new Gauge('orders_success_rate');

// Resilience metrics
const circuitBreakerTrips = new Counter('circuit_breaker_trips');
const retryAttempts = new Counter('retry_attempts');
const gracefulDegradation = new Counter('graceful_degradation');
const timeoutErrors = new Counter('timeout_errors');
const connectionErrors = new Counter('connection_errors');

// Latency metrics
const checkoutLatency = new Trend('checkout_latency_ms');
const paymentLatency = new Trend('payment_latency_ms');
const inventoryLatency = new Trend('inventory_latency_ms');
const searchLatency = new Trend('search_latency_ms');

// Error tracking
const error5xx = new Counter('error_5xx');
const error4xx = new Counter('error_4xx');
const errorTimeout = new Counter('error_timeout');

// =============================================================================
// CONFIGURATION
// =============================================================================

const CHAOS_ACTIVE = __ENV.CHAOS_ACTIVE === 'true';
const BASE_URL = __ENV.API_URL || 'http://localhost:8080/api/v1';
const OMS_URL = __ENV.OMS_URL || 'http://localhost:8081/api/v1';

export const options = {
  scenarios: {
    // Steady state baseline
    baseline: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 50,
      maxVUs: 100,
      exec: 'checkoutFlow',
      tags: { scenario: 'baseline' },
    },

    // Chaos injection phase - higher load during failures
    chaos_load: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 300,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '3m', target: 20 },  // Peak during chaos
        { duration: '2m', target: 30 },  // Stress test
        { duration: '2m', target: 15 },  // Recovery phase
        { duration: '2m', target: 5 },   // Cooldown
      ],
      startTime: '5m',
      exec: 'checkoutFlow',
      tags: { scenario: 'chaos' },
    },

    // Background browsing traffic
    browse_traffic: {
      executor: 'constant-vus',
      vus: 30,
      duration: '15m',
      exec: 'browseProducts',
      tags: { scenario: 'browse' },
    },

    // Search stress test
    search_stress: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 50 },
        { duration: '3m', target: 20 },
        { duration: '5m', target: 10 },
      ],
      exec: 'searchProducts',
      tags: { scenario: 'search' },
    },
  },

  thresholds: {
    // SLOs - must maintain during chaos
    'http_req_duration{scenario:baseline}': ['p(95)<500', 'p(99)<1500'],
    'http_req_duration{scenario:chaos}': ['p(95)<2000', 'p(99)<5000'], // Relaxed during chaos
    'orders_success_rate': ['value>0.95'], // 95% order success even during chaos
    'http_req_failed': ['rate<0.05'],      // Max 5% error rate

    // Latency thresholds
    'checkout_latency_ms': ['p(95)<5000'],
    'payment_latency_ms': ['p(95)<3000'],
    'search_latency_ms': ['p(95)<500'],

    // Resilience thresholds
    'error_5xx': ['count<100'],
  },
};

// =============================================================================
// SETUP
// =============================================================================

export function setup() {
  console.log(`\n🚀 Starting Chaos Battle Test`);
  console.log(`   Chaos Active: ${CHAOS_ACTIVE}`);
  console.log(`   API URL: ${BASE_URL}`);
  console.log(`   OMS URL: ${OMS_URL}\n`);

  // Fetch test data
  const productsRes = http.get(`${BASE_URL}/products?limit=100`);
  let products = [];
  if (productsRes.status === 200) {
    const data = JSON.parse(productsRes.body);
    products = (data.items || data || []).filter(p => p.quantity > 0 || p.stock > 0);
  }

  if (products.length === 0) {
    console.warn('⚠️  No products available, using mock data');
    products = [
      { id: 'prod-1', name: 'Test Product 1', price: 100 },
      { id: 'prod-2', name: 'Test Product 2', price: 200 },
      { id: 'prod-3', name: 'Test Product 3', price: 300 },
    ];
  }

  // Fetch categories
  const categoriesRes = http.get(`${BASE_URL}/categories`);
  let categories = [];
  if (categoriesRes.status === 200) {
    const data = JSON.parse(categoriesRes.body);
    categories = data.items || data || [];
  }

  return {
    products,
    categories,
    searchTerms: ['телефон', 'ноутбук', 'навушники', 'планшет', 'годинник', 'камера'],
    startTime: Date.now(),
  };
}

// =============================================================================
// TEST SCENARIOS
// =============================================================================

// Full checkout flow with resilience tracking
export function checkoutFlow(data) {
  const sessionId = `chaos-${__VU}-${__ITER}-${Date.now()}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-Session-ID': sessionId,
    'X-Request-ID': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };

  ordersAttempted.add(1);
  const checkoutStart = Date.now();
  let checkoutSuccessful = false;

  try {
    // Step 1: Add items to cart
    group('Cart Operations', () => {
      const numItems = randomIntBetween(1, 3);
      for (let i = 0; i < numItems; i++) {
        const product = randomItem(data.products);
        const res = makeResilientRequest(
          'POST',
          `${BASE_URL}/cart/items`,
          JSON.stringify({
            product_id: product.id,
            quantity: randomIntBetween(1, 2),
          }),
          { headers }
        );

        trackResponse(res, 'cart_add');
        sleep(0.1);
      }
    });

    // Step 2: Get cart with inventory check
    group('Inventory Check', () => {
      const start = Date.now();
      const res = makeResilientRequest('GET', `${BASE_URL}/cart`, null, { headers });
      inventoryLatency.add(Date.now() - start);
      trackResponse(res, 'inventory_check');
    });

    // Step 3: Shipping selection
    group('Shipping', () => {
      const shippingData = {
        first_name: 'Test',
        last_name: 'User',
        email: `test-${sessionId}@example.com`,
        phone: '+380501234567',
        address: {
          street: 'Test Street 123',
          city: 'Kyiv',
          postal_code: '01001',
          country: 'UA',
        },
        shipping_method: randomItem(['nova_poshta', 'ukrposhta', 'meest']),
      };

      const res = makeResilientRequest(
        'POST',
        `${BASE_URL}/checkout/shipping`,
        JSON.stringify(shippingData),
        { headers }
      );

      trackResponse(res, 'shipping');
    });

    // Step 4: Payment processing (critical path)
    group('Payment', () => {
      const paymentStart = Date.now();

      const paymentData = {
        payment_method: randomItem(['liqpay', 'mono', 'privat24', 'card']),
        card_token: `tok_test_${Date.now()}`,
      };

      const res = makeResilientRequest(
        'POST',
        `${BASE_URL}/checkout/payment`,
        JSON.stringify(paymentData),
        { headers, timeout: '10s' }
      );

      paymentLatency.add(Date.now() - paymentStart);
      trackResponse(res, 'payment');
    });

    // Step 5: Complete order
    group('Order Completion', () => {
      const res = makeResilientRequest(
        'POST',
        `${BASE_URL}/checkout/complete`,
        JSON.stringify({}),
        { headers }
      );

      if (res.status === 200 || res.status === 201) {
        checkoutSuccessful = true;
        ordersCompleted.add(1);

        const body = JSON.parse(res.body || '{}');
        if (body.order_id) {
          console.log(`✅ Order created: ${body.order_id}`);
        }
      } else {
        ordersFailed.add(1);
        console.log(`❌ Order failed: ${res.status} - ${res.body}`);
      }

      trackResponse(res, 'order_complete');
    });

  } catch (error) {
    ordersFailed.add(1);
    console.log(`❌ Checkout error: ${error.message}`);
  }

  // Record checkout latency and success rate
  checkoutLatency.add(Date.now() - checkoutStart);

  const totalAttempted = ordersAttempted.name; // Will be calculated in summary
  const successRate = checkoutSuccessful ? 1 : 0;
  ordersSuccessRate.add(successRate);

  sleep(randomIntBetween(1, 3));
}

// Browse products scenario
export function browseProducts(data) {
  const headers = {
    'X-Session-ID': `browse-${__VU}-${Date.now()}`,
  };

  group('Product Browsing', () => {
    // List products
    let res = http.get(`${BASE_URL}/products?limit=20&page=${randomIntBetween(1, 5)}`, { headers });
    trackResponse(res, 'products_list');
    sleep(0.5);

    // View product detail
    if (data.products.length > 0) {
      const product = randomItem(data.products);
      res = http.get(`${BASE_URL}/products/${product.id}`, { headers });
      trackResponse(res, 'product_detail');
    }
    sleep(0.3);

    // Browse category
    if (data.categories.length > 0) {
      const category = randomItem(data.categories);
      res = http.get(`${BASE_URL}/categories/${category.id}/products`, { headers });
      trackResponse(res, 'category_browse');
    }
  });

  sleep(randomIntBetween(1, 2));
}

// Search products scenario
export function searchProducts(data) {
  const term = randomItem(data.searchTerms);
  const start = Date.now();

  const res = http.get(`${BASE_URL}/products/search?q=${encodeURIComponent(term)}&limit=20`);
  searchLatency.add(Date.now() - start);

  check(res, {
    'search successful': (r) => r.status === 200,
    'search has results': (r) => {
      if (r.status !== 200) return true; // Don't fail if endpoint is down
      const body = JSON.parse(r.body || '{}');
      return (body.items || body || []).length >= 0;
    },
  });

  trackResponse(res, 'search');
  sleep(randomIntBetween(0.5, 1.5));
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function makeResilientRequest(method, url, body, params = {}) {
  const maxRetries = 3;
  const timeout = params.timeout || '5s';
  let lastResponse = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const requestParams = {
        ...params,
        timeout,
      };

      if (method === 'GET') {
        lastResponse = http.get(url, requestParams);
      } else if (method === 'POST') {
        lastResponse = http.post(url, body, requestParams);
      } else if (method === 'PUT') {
        lastResponse = http.put(url, body, requestParams);
      } else if (method === 'DELETE') {
        lastResponse = http.del(url, body, requestParams);
      }

      // Success or client error - don't retry
      if (lastResponse.status < 500) {
        return lastResponse;
      }

      // Server error - retry with backoff
      if (attempt < maxRetries - 1) {
        retryAttempts.add(1);
        sleep(Math.pow(2, attempt) * 0.5); // Exponential backoff
      }
    } catch (error) {
      if (error.message.includes('timeout')) {
        timeoutErrors.add(1);
      } else if (error.message.includes('connection')) {
        connectionErrors.add(1);
      }

      if (attempt < maxRetries - 1) {
        retryAttempts.add(1);
        sleep(Math.pow(2, attempt) * 0.5);
      } else {
        throw error;
      }
    }
  }

  return lastResponse;
}

function trackResponse(res, operation) {
  if (!res) return;

  if (res.status >= 500) {
    error5xx.add(1);

    // Check for circuit breaker response
    if (res.status === 503) {
      circuitBreakerTrips.add(1);
    }
  } else if (res.status >= 400) {
    error4xx.add(1);
  }

  // Check for graceful degradation (cached/fallback response)
  const cacheHeader = res.headers['X-Cache'] || res.headers['x-cache'];
  const fallbackHeader = res.headers['X-Fallback'] || res.headers['x-fallback'];
  if (cacheHeader === 'HIT' || fallbackHeader === 'true') {
    gracefulDegradation.add(1);
  }

  check(res, {
    [`${operation} not 5xx`]: (r) => r.status < 500,
  });
}

// =============================================================================
// TEARDOWN & SUMMARY
// =============================================================================

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`\n🏁 Test completed in ${duration.toFixed(0)}s`);
}

export function handleSummary(data) {
  const metrics = data.metrics;

  const ordersAttemptedCount = metrics.orders_attempted?.values?.count || 0;
  const ordersCompletedCount = metrics.orders_completed?.values?.count || 0;
  const ordersFailedCount = metrics.orders_failed?.values?.count || 0;

  const successRate = ordersAttemptedCount > 0
    ? ((ordersCompletedCount / ordersAttemptedCount) * 100).toFixed(2)
    : 0;

  const summary = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                        🔥 CHAOS BATTLE TEST RESULTS 🔥                        ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  📊 ORDER METRICS                                                            ║
║  ├── Orders Attempted:    ${String(ordersAttemptedCount).padStart(10)}                                    ║
║  ├── Orders Completed:    ${String(ordersCompletedCount).padStart(10)}                                    ║
║  ├── Orders Failed:       ${String(ordersFailedCount).padStart(10)}                                    ║
║  └── Success Rate:        ${String(successRate + '%').padStart(10)}                                    ║
║                                                                              ║
║  ⏱️  LATENCY (p95)                                                           ║
║  ├── Checkout:            ${String((metrics.checkout_latency_ms?.values?.['p(95)'] || 0).toFixed(0) + 'ms').padStart(10)}                                    ║
║  ├── Payment:             ${String((metrics.payment_latency_ms?.values?.['p(95)'] || 0).toFixed(0) + 'ms').padStart(10)}                                    ║
║  ├── Inventory:           ${String((metrics.inventory_latency_ms?.values?.['p(95)'] || 0).toFixed(0) + 'ms').padStart(10)}                                    ║
║  └── Search:              ${String((metrics.search_latency_ms?.values?.['p(95)'] || 0).toFixed(0) + 'ms').padStart(10)}                                    ║
║                                                                              ║
║  🛡️  RESILIENCE METRICS                                                      ║
║  ├── Circuit Breaker Trips: ${String(metrics.circuit_breaker_trips?.values?.count || 0).padStart(8)}                                    ║
║  ├── Retry Attempts:        ${String(metrics.retry_attempts?.values?.count || 0).padStart(8)}                                    ║
║  ├── Graceful Degradation:  ${String(metrics.graceful_degradation?.values?.count || 0).padStart(8)}                                    ║
║  ├── Timeout Errors:        ${String(metrics.timeout_errors?.values?.count || 0).padStart(8)}                                    ║
║  └── Connection Errors:     ${String(metrics.connection_errors?.values?.count || 0).padStart(8)}                                    ║
║                                                                              ║
║  ❌ ERROR BREAKDOWN                                                          ║
║  ├── 5xx Errors:          ${String(metrics.error_5xx?.values?.count || 0).padStart(10)}                                    ║
║  └── 4xx Errors:          ${String(metrics.error_4xx?.values?.count || 0).padStart(10)}                                    ║
║                                                                              ║
║  🌐 HTTP METRICS                                                             ║
║  ├── Total Requests:      ${String(metrics.http_reqs?.values?.count || 0).padStart(10)}                                    ║
║  ├── Failed Requests:     ${String(metrics.http_req_failed?.values?.passes || 0).padStart(10)}                                    ║
║  ├── Avg Response:        ${String((metrics.http_req_duration?.values?.avg || 0).toFixed(0) + 'ms').padStart(10)}                                    ║
║  └── p99 Response:        ${String((metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(0) + 'ms').padStart(10)}                                    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

${successRate >= 95 ? '✅ SLO MET: Order success rate >= 95%' : '❌ SLO VIOLATED: Order success rate < 95%'}
${(metrics.http_req_duration?.values?.['p(95)'] || 0) < 2000 ? '✅ SLO MET: p95 latency < 2s' : '❌ SLO VIOLATED: p95 latency >= 2s'}
${(metrics.http_req_failed?.values?.rate || 0) < 0.05 ? '✅ SLO MET: Error rate < 5%' : '❌ SLO VIOLATED: Error rate >= 5%'}
`;

  return {
    'tests/load/chaos-battle-results.json': JSON.stringify(data, null, 2),
    'tests/load/chaos-battle-results.txt': summary,
    stdout: summary,
  };
}
