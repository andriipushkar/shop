// k6 Load Testing Configuration for Shop API
// Run: k6 run tests/load/k6-config.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const productLatency = new Trend('product_latency');
const orderLatency = new Trend('order_latency');
const cartLatency = new Trend('cart_latency');
const successfulOrders = new Counter('successful_orders');

// Test configuration
export const options = {
  scenarios: {
    // Smoke test - quick sanity check
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      startTime: '0s',
      tags: { test_type: 'smoke' },
    },
    // Load test - normal load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up
        { duration: '5m', target: 50 },   // Stay at 50 users
        { duration: '2m', target: 100 },  // Ramp up to 100
        { duration: '5m', target: 100 },  // Stay at 100 users
        { duration: '2m', target: 0 },    // Ramp down
      ],
      startTime: '1m',
      tags: { test_type: 'load' },
    },
    // Stress test - find breaking point
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 300 },
        { duration: '5m', target: 300 },
        { duration: '5m', target: 0 },
      ],
      startTime: '20m',
      tags: { test_type: 'stress' },
    },
    // Spike test - sudden traffic spike
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 },  // Fast ramp up
        { duration: '1m', target: 100 },
        { duration: '10s', target: 500 },  // Spike!
        { duration: '3m', target: 500 },
        { duration: '10s', target: 100 },  // Scale down
        { duration: '3m', target: 100 },
        { duration: '10s', target: 0 },
      ],
      startTime: '50m',
      tags: { test_type: 'spike' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],  // 95% < 500ms, 99% < 1.5s
    http_req_failed: ['rate<0.01'],                   // Error rate < 1%
    errors: ['rate<0.05'],                            // Custom error rate < 5%
    product_latency: ['p(95)<300'],                   // Product API 95% < 300ms
    order_latency: ['p(95)<1000'],                    // Order API 95% < 1s
    cart_latency: ['p(95)<200'],                      // Cart API 95% < 200ms
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:8080/api/v1';

// Test data
const testProducts = [];
const testCategories = [];
let authToken = null;

// Setup function - runs once before test
export function setup() {
  // Get categories for testing
  const categoriesRes = http.get(`${BASE_URL}/categories`);
  if (categoriesRes.status === 200) {
    const data = JSON.parse(categoriesRes.body);
    testCategories.push(...(data.items || data || []).slice(0, 5));
  }

  // Get products for testing
  const productsRes = http.get(`${BASE_URL}/products?limit=20`);
  if (productsRes.status === 200) {
    const data = JSON.parse(productsRes.body);
    testProducts.push(...(data.items || data || []).slice(0, 20));
  }

  return { products: testProducts, categories: testCategories };
}

// Main test function
export default function(data) {
  const products = data.products || [];
  const categories = data.categories || [];

  group('Browse Products', () => {
    // List products
    let start = Date.now();
    let res = http.get(`${BASE_URL}/products?limit=20`);
    productLatency.add(Date.now() - start);

    check(res, {
      'products list status 200': (r) => r.status === 200,
      'products list has items': (r) => {
        const body = JSON.parse(r.body);
        return (body.items || body || []).length > 0;
      },
    }) || errorRate.add(1);

    sleep(0.5);

    // View random product
    if (products.length > 0) {
      const product = products[Math.floor(Math.random() * products.length)];
      start = Date.now();
      res = http.get(`${BASE_URL}/products/${product.id}`);
      productLatency.add(Date.now() - start);

      check(res, {
        'product detail status 200': (r) => r.status === 200,
      }) || errorRate.add(1);
    }

    sleep(0.3);
  });

  group('Browse Categories', () => {
    let res = http.get(`${BASE_URL}/categories`);

    check(res, {
      'categories list status 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    // Browse products by category
    if (categories.length > 0) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      res = http.get(`${BASE_URL}/categories/${category.id}/products`);

      check(res, {
        'category products status 200': (r) => r.status === 200 || r.status === 404,
      }) || errorRate.add(1);
    }

    sleep(0.3);
  });

  group('Search Products', () => {
    const searchTerms = ['phone', 'laptop', 'shirt', 'shoes', 'watch'];
    const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];

    const start = Date.now();
    const res = http.get(`${BASE_URL}/products/search?q=${term}`);
    productLatency.add(Date.now() - start);

    check(res, {
      'search status 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    sleep(0.3);
  });

  group('Cart Operations', () => {
    if (products.length === 0) return;

    const product = products[Math.floor(Math.random() * products.length)];
    const headers = { 'Content-Type': 'application/json' };

    // Add to cart
    let start = Date.now();
    let res = http.post(
      `${BASE_URL}/cart/items`,
      JSON.stringify({
        product_id: product.id,
        quantity: 1,
      }),
      { headers }
    );
    cartLatency.add(Date.now() - start);

    check(res, {
      'add to cart status ok': (r) => r.status === 200 || r.status === 201,
    }) || errorRate.add(1);

    sleep(0.2);

    // Get cart
    start = Date.now();
    res = http.get(`${BASE_URL}/cart`);
    cartLatency.add(Date.now() - start);

    check(res, {
      'get cart status 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    sleep(0.2);
  });

  // Simulate user thinking time
  sleep(Math.random() * 2 + 1);
}

// Teardown function - runs once after test
export function teardown(data) {
  console.log(`Test completed with ${data.products?.length || 0} test products`);
}

// Handle summary
export function handleSummary(data) {
  return {
    'tests/load/summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const metrics = data.metrics;
  const lines = [
    '\n========== Load Test Summary ==========\n',
    `Total Requests: ${metrics.http_reqs?.values?.count || 0}`,
    `Failed Requests: ${metrics.http_req_failed?.values?.passes || 0}`,
    `Avg Response Time: ${(metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms`,
    `95th Percentile: ${(metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms`,
    `99th Percentile: ${(metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(2)}ms`,
    `Error Rate: ${((metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%`,
    '\n',
    'Custom Metrics:',
    `  Product API p95: ${(metrics.product_latency?.values?.['p(95)'] || 0).toFixed(2)}ms`,
    `  Cart API p95: ${(metrics.cart_latency?.values?.['p(95)'] || 0).toFixed(2)}ms`,
    `  Order API p95: ${(metrics.order_latency?.values?.['p(95)'] || 0).toFixed(2)}ms`,
    '\n========================================\n',
  ];
  return lines.join('\n');
}
