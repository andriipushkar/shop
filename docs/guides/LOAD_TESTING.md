# Load Testing

Навантажувальне тестування з k6.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOAD TESTING STACK                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │ k6           │────▶│ Application  │────▶│ Metrics      │                │
│  │ Test Scripts │     │ Under Test   │     │ Collection   │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│                                                   │                         │
│                                                   ▼                         │
│                                            ┌──────────────┐                │
│                                            │ Grafana      │                │
│                                            │ Dashboard    │                │
│                                            └──────────────┘                │
│                                                                              │
│  Test Types:                                                                │
│  ├── Smoke Test (baseline)                                                 │
│  ├── Load Test (expected traffic)                                          │
│  ├── Stress Test (breaking point)                                          │
│  └── Soak Test (endurance)                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Setup

### Installation

```bash
# macOS
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker pull grafana/k6
```

### Project Structure

```
tests/load/
├── scenarios/
│   ├── smoke.js           # Smoke tests
│   ├── load.js            # Load tests
│   ├── stress.js          # Stress tests
│   └── soak.js            # Soak tests
├── scripts/
│   ├── checkout.js        # Checkout flow
│   ├── catalog.js         # Catalog browsing
│   ├── search.js          # Search functionality
│   └── auth.js            # Authentication
├── utils/
│   ├── helpers.js         # Helper functions
│   └── data.js            # Test data
└── config.js              # Configuration
```

## Test Scripts

### Smoke Test

```javascript
// tests/load/scenarios/smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(99)<1500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Homepage
  let res = http.get(`${BASE_URL}/`);
  check(res, {
    'homepage status is 200': (r) => r.status === 200,
    'homepage loads fast': (r) => r.timings.duration < 1000,
  });

  sleep(1);

  // API health
  res = http.get(`${BASE_URL}/api/health`);
  check(res, {
    'API health is 200': (r) => r.status === 200,
  });

  sleep(1);

  // Product catalog
  res = http.get(`${BASE_URL}/api/products?limit=10`);
  check(res, {
    'catalog status is 200': (r) => r.status === 200,
    'catalog has products': (r) => JSON.parse(r.body).data.length > 0,
  });

  sleep(1);
}
```

### Load Test

```javascript
// tests/load/scenarios/load.js
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const checkoutDuration = new Trend('checkout_duration');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up more
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  group('Browse Catalog', () => {
    // Homepage
    let res = http.get(`${BASE_URL}/`);
    check(res, { 'homepage OK': (r) => r.status === 200 });

    // Category page
    res = http.get(`${BASE_URL}/categories/electronics`);
    check(res, { 'category OK': (r) => r.status === 200 });

    // Product listing
    res = http.get(`${BASE_URL}/api/products?category=electronics&limit=20`);
    check(res, { 'products OK': (r) => r.status === 200 });

    sleep(2);
  });

  group('Product Details', () => {
    const productId = Math.floor(Math.random() * 100) + 1;
    const res = http.get(`${BASE_URL}/api/products/${productId}`);

    const success = check(res, {
      'product detail OK': (r) => r.status === 200 || r.status === 404,
    });

    errorRate.add(!success);
    sleep(3);
  });

  group('Search', () => {
    const queries = ['iphone', 'laptop', 'телефон', 'навушники'];
    const query = queries[Math.floor(Math.random() * queries.length)];

    const res = http.get(`${BASE_URL}/api/search?q=${encodeURIComponent(query)}`);
    check(res, {
      'search OK': (r) => r.status === 200,
      'search has results': (r) => JSON.parse(r.body).total >= 0,
    });

    sleep(2);
  });

  group('Add to Cart', () => {
    const productId = Math.floor(Math.random() * 100) + 1;

    const payload = JSON.stringify({
      productId: productId,
      quantity: 1,
    });

    const params = {
      headers: { 'Content-Type': 'application/json' },
    };

    const res = http.post(`${BASE_URL}/api/cart/items`, payload, params);
    check(res, {
      'add to cart OK': (r) => r.status === 200 || r.status === 201,
    });

    sleep(1);
  });
}
```

### Stress Test

```javascript
// tests/load/scenarios/stress.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Below normal
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },   // Normal load
    { duration: '5m', target: 200 },
    { duration: '2m', target: 300 },   // Around breaking point
    { duration: '5m', target: 300 },
    { duration: '2m', target: 400 },   // Beyond breaking point
    { duration: '5m', target: 400 },
    { duration: '10m', target: 0 },    // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(99)<3000'],
    http_req_failed: ['rate<0.15'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const res = http.get(`${BASE_URL}/api/products`);

  check(res, {
    'status is 200 or 503': (r) => r.status === 200 || r.status === 503,
  });

  sleep(1);
}
```

### Checkout Flow Test

```javascript
// tests/load/scripts/checkout.js
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const checkoutTrend = new Trend('checkout_flow_duration');

export const options = {
  scenarios: {
    checkout: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: 20 },
        { duration: '5m', target: 20 },
        { duration: '2m', target: 0 },
      ],
    },
  },
  thresholds: {
    checkout_flow_duration: ['p(95)<10000'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const startTime = Date.now();
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  group('1. Add Products to Cart', () => {
    // Add first product
    http.post(`${BASE_URL}/api/cart/items`, JSON.stringify({
      productId: 1,
      quantity: 2,
    }), params);

    // Add second product
    http.post(`${BASE_URL}/api/cart/items`, JSON.stringify({
      productId: 5,
      quantity: 1,
    }), params);

    sleep(1);
  });

  group('2. View Cart', () => {
    const res = http.get(`${BASE_URL}/api/cart`);
    check(res, {
      'cart has items': (r) => JSON.parse(r.body).items.length > 0,
    });
    sleep(1);
  });

  group('3. Apply Promo Code', () => {
    const res = http.post(`${BASE_URL}/api/cart/promo`, JSON.stringify({
      code: 'DISCOUNT10',
    }), params);

    check(res, {
      'promo applied or invalid': (r) => r.status === 200 || r.status === 400,
    });
    sleep(1);
  });

  group('4. Calculate Shipping', () => {
    const res = http.post(`${BASE_URL}/api/shipping/calculate`, JSON.stringify({
      cityRef: 'db5c88e0-391c-11dd-90d9-001a92567626',
      warehouseRef: '1ec09d88-e1c2-11e3-8c4a-0050568002cf',
    }), params);

    check(res, {
      'shipping calculated': (r) => r.status === 200,
    });
    sleep(1);
  });

  group('5. Create Order', () => {
    const res = http.post(`${BASE_URL}/api/orders`, JSON.stringify({
      customer: {
        email: `test${Date.now()}@example.com`,
        phone: '+380501234567',
        firstName: 'Test',
        lastName: 'User',
      },
      shipping: {
        method: 'nova_poshta',
        cityRef: 'db5c88e0-391c-11dd-90d9-001a92567626',
        warehouseRef: '1ec09d88-e1c2-11e3-8c4a-0050568002cf',
      },
      payment: {
        method: 'cod',
      },
    }), params);

    check(res, {
      'order created': (r) => r.status === 201 || r.status === 200,
    });
  });

  const duration = Date.now() - startTime;
  checkoutTrend.add(duration);

  sleep(5);
}
```

## Configuration

```javascript
// tests/load/config.js
export const config = {
  environments: {
    local: {
      baseUrl: 'http://localhost:3000',
      apiUrl: 'http://localhost:8080',
    },
    staging: {
      baseUrl: 'https://staging.shop.ua',
      apiUrl: 'https://staging-api.shop.ua',
    },
    production: {
      baseUrl: 'https://shop.ua',
      apiUrl: 'https://api.shop.ua',
    },
  },

  thresholds: {
    api: {
      http_req_duration: ['p(95)<200', 'p(99)<500'],
      http_req_failed: ['rate<0.01'],
    },
    web: {
      http_req_duration: ['p(95)<1000', 'p(99)<2000'],
      http_req_failed: ['rate<0.05'],
    },
  },

  scenarios: {
    smoke: { vus: 1, duration: '1m' },
    load: { vus: 100, duration: '15m' },
    stress: { vus: 500, duration: '30m' },
    soak: { vus: 50, duration: '4h' },
  },
};
```

## Running Tests

```bash
# Run smoke test
k6 run tests/load/scenarios/smoke.js

# Run load test against staging
k6 run -e BASE_URL=https://staging.shop.ua tests/load/scenarios/load.js

# Run with more VUs
k6 run --vus 200 --duration 10m tests/load/scenarios/load.js

# Output to InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 tests/load/scenarios/load.js

# Output JSON results
k6 run --out json=results.json tests/load/scenarios/load.js
```

## CI Integration

```yaml
# .github/workflows/load-test.yml
name: Load Tests

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:
    inputs:
      scenario:
        description: 'Test scenario'
        required: true
        default: 'smoke'
        type: choice
        options:
          - smoke
          - load
          - stress

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run k6 test
        uses: grafana/k6-action@v0.3.1
        with:
          filename: tests/load/scenarios/${{ github.event.inputs.scenario || 'smoke' }}.js
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: k6-results
          path: results/
```

## Grafana Dashboard

```json
{
  "dashboard": {
    "title": "k6 Load Testing",
    "panels": [
      {
        "title": "Virtual Users",
        "targets": [
          {
            "query": "SELECT mean(\"value\") FROM \"k6_vus\" WHERE $timeFilter GROUP BY time($__interval)"
          }
        ]
      },
      {
        "title": "Request Duration",
        "targets": [
          {
            "query": "SELECT percentile(\"value\", 95) FROM \"k6_http_req_duration\" WHERE $timeFilter GROUP BY time($__interval)"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "query": "SELECT mean(\"value\") FROM \"k6_http_req_failed\" WHERE $timeFilter GROUP BY time($__interval)"
          }
        ]
      }
    ]
  }
}
```

## Performance Targets

| Метрика | Target | Critical |
|---------|--------|----------|
| Response Time (p95) | < 500ms | > 2000ms |
| Response Time (p99) | < 1000ms | > 3000ms |
| Error Rate | < 1% | > 5% |
| Throughput | > 1000 rps | < 500 rps |

## See Also

- [E2E Testing](./E2E_TESTING.md)
- [Performance Monitoring](../operations/PERFORMANCE_MONITORING.md)
- [Capacity Planning](../operations/CAPACITY_PLANNING.md)
