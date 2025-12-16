# Load Testing

Документація з навантажувального тестування Shop Platform.

## Інструменти

- **k6** - основний інструмент для load testing
- **Grafana** - візуалізація результатів
- **InfluxDB** - зберігання метрик
- **Locust** - альтернатива для Python-based тестів

## Структура тестів

```
tests/
├── load/
│   ├── scenarios/
│   │   ├── browse.js
│   │   ├── search.js
│   │   ├── checkout.js
│   │   ├── api.js
│   │   └── mixed.js
│   ├── helpers/
│   │   ├── auth.js
│   │   ├── data.js
│   │   └── metrics.js
│   ├── config/
│   │   ├── thresholds.js
│   │   └── options.js
│   └── run.sh
```

## k6 Сценарії

### Browse Scenario

```javascript
// tests/load/scenarios/browse.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const homepageTime = new Trend('homepage_duration');
const categoryTime = new Trend('category_duration');
const productTime = new Trend('product_duration');

// Test configuration
export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },  // Ramp up
        { duration: '5m', target: 100 },  // Stay at 100
        { duration: '2m', target: 200 },  // Ramp up more
        { duration: '5m', target: 200 },  // Stay at 200
        { duration: '2m', target: 0 },    // Ramp down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.05'],
    homepage_duration: ['p(95)<300'],
    category_duration: ['p(95)<400'],
    product_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TENANT_ID = __ENV.TENANT_ID || 'default';

const headers = {
  'Content-Type': 'application/json',
  'X-Tenant-ID': TENANT_ID,
};

// Test data
const categories = ['electronics', 'clothing', 'home', 'sports', 'beauty'];
const products = JSON.parse(open('../data/products.json'));

export default function () {
  group('Homepage', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/v1/homepage`, { headers });
    homepageTime.add(Date.now() - start);

    check(res, {
      'homepage status 200': (r) => r.status === 200,
      'homepage has featured products': (r) => {
        const body = JSON.parse(r.body);
        return body.featured && body.featured.length > 0;
      },
    }) || errorRate.add(1);
  });

  sleep(randomIntBetween(1, 3));

  group('Category Browse', () => {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/v1/categories/${category}/products?page=1&limit=20`, { headers });
    categoryTime.add(Date.now() - start);

    check(res, {
      'category status 200': (r) => r.status === 200,
      'category has products': (r) => {
        const body = JSON.parse(r.body);
        return body.data && body.data.length > 0;
      },
    }) || errorRate.add(1);
  });

  sleep(randomIntBetween(2, 5));

  group('Product Detail', () => {
    const product = products[Math.floor(Math.random() * products.length)];
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/v1/products/${product.slug}`, { headers });
    productTime.add(Date.now() - start);

    check(res, {
      'product status 200': (r) => r.status === 200,
      'product has name': (r) => {
        const body = JSON.parse(r.body);
        return body.name && body.name.length > 0;
      },
    }) || errorRate.add(1);
  });

  sleep(randomIntBetween(3, 8));
}

function randomIntBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
```

### Search Scenario

```javascript
// tests/load/scenarios/search.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const searchTime = new Trend('search_duration');
const filterTime = new Trend('filter_duration');
const suggestTime = new Trend('suggest_duration');
const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    search: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 100,
      maxVUs: 200,
    },
  },
  thresholds: {
    search_duration: ['p(95)<300', 'p(99)<500'],
    suggest_duration: ['p(95)<100', 'p(99)<200'],
    filter_duration: ['p(95)<400', 'p(99)<600'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TENANT_ID = __ENV.TENANT_ID || 'default';

const headers = {
  'Content-Type': 'application/json',
  'X-Tenant-ID': TENANT_ID,
};

const searchTerms = [
  'iPhone', 'Samsung', 'laptop', 'headphones', 'camera',
  'shoes', 'dress', 'jacket', 'watch', 'bag',
  'sofa', 'lamp', 'table', 'chair', 'rug',
];

const filters = [
  { minPrice: 100, maxPrice: 500 },
  { minPrice: 500, maxPrice: 1000 },
  { brand: 'Apple' },
  { brand: 'Samsung' },
  { category: 'electronics' },
  { inStock: true },
];

export default function () {
  const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];

  // Autocomplete suggestions
  group('Autocomplete', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/v1/search/suggest?q=${term.substring(0, 3)}`, { headers });
    suggestTime.add(Date.now() - start);

    check(res, {
      'suggest status 200': (r) => r.status === 200,
      'suggest has results': (r) => {
        const body = JSON.parse(r.body);
        return body.suggestions && Array.isArray(body.suggestions);
      },
    }) || errorRate.add(1);
  });

  sleep(0.5);

  // Full search
  group('Search', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/v1/search?q=${encodeURIComponent(term)}&page=1&limit=20`, { headers });
    searchTime.add(Date.now() - start);

    check(res, {
      'search status 200': (r) => r.status === 200,
      'search has results': (r) => {
        const body = JSON.parse(r.body);
        return body.data !== undefined;
      },
      'search has facets': (r) => {
        const body = JSON.parse(r.body);
        return body.facets !== undefined;
      },
    }) || errorRate.add(1);
  });

  sleep(1);

  // Search with filters
  if (Math.random() > 0.5) {
    group('Filtered Search', () => {
      const filter = filters[Math.floor(Math.random() * filters.length)];
      const params = new URLSearchParams({
        q: term,
        page: '1',
        limit: '20',
        ...filter,
      });

      const start = Date.now();
      const res = http.get(`${BASE_URL}/api/v1/search?${params.toString()}`, { headers });
      filterTime.add(Date.now() - start);

      check(res, {
        'filtered search status 200': (r) => r.status === 200,
      }) || errorRate.add(1);
    });
  }

  sleep(randomIntBetween(1, 3));
}

function randomIntBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
```

### Checkout Scenario

```javascript
// tests/load/scenarios/checkout.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const addToCartTime = new Trend('add_to_cart_duration');
const viewCartTime = new Trend('view_cart_duration');
const checkoutTime = new Trend('checkout_duration');
const orderTime = new Trend('order_duration');
const errorRate = new Rate('errors');
const ordersCreated = new Counter('orders_created');

export const options = {
  scenarios: {
    checkout: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 100,
      stages: [
        { duration: '2m', target: 5 },
        { duration: '5m', target: 10 },
        { duration: '5m', target: 10 },
        { duration: '2m', target: 0 },
      ],
    },
  },
  thresholds: {
    add_to_cart_duration: ['p(95)<300'],
    view_cart_duration: ['p(95)<200'],
    checkout_duration: ['p(95)<500'],
    order_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.02'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TENANT_ID = __ENV.TENANT_ID || 'default';

const headers = {
  'Content-Type': 'application/json',
  'X-Tenant-ID': TENANT_ID,
};

const products = JSON.parse(open('../data/products.json'));
const testUsers = JSON.parse(open('../data/users.json'));

export default function () {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  let cartId = null;
  let authToken = null;

  // Login
  group('Login', () => {
    const res = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
      email: user.email,
      password: user.password,
    }), { headers });

    check(res, {
      'login successful': (r) => r.status === 200,
    });

    if (res.status === 200) {
      const body = JSON.parse(res.body);
      authToken = body.token;
    }
  });

  if (!authToken) {
    errorRate.add(1);
    return;
  }

  const authHeaders = {
    ...headers,
    'Authorization': `Bearer ${authToken}`,
  };

  sleep(1);

  // Add items to cart
  group('Add to Cart', () => {
    const numItems = randomIntBetween(1, 3);

    for (let i = 0; i < numItems; i++) {
      const product = products[Math.floor(Math.random() * products.length)];

      const start = Date.now();
      const res = http.post(`${BASE_URL}/api/v1/cart/items`, JSON.stringify({
        product_id: product.id,
        quantity: randomIntBetween(1, 2),
      }), { headers: authHeaders });
      addToCartTime.add(Date.now() - start);

      check(res, {
        'item added to cart': (r) => r.status === 200 || r.status === 201,
      }) || errorRate.add(1);

      if (res.status === 200 || res.status === 201) {
        const body = JSON.parse(res.body);
        cartId = body.cart_id;
      }

      sleep(0.5);
    }
  });

  sleep(2);

  // View cart
  group('View Cart', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/v1/cart`, { headers: authHeaders });
    viewCartTime.add(Date.now() - start);

    check(res, {
      'cart retrieved': (r) => r.status === 200,
      'cart has items': (r) => {
        const body = JSON.parse(r.body);
        return body.items && body.items.length > 0;
      },
    }) || errorRate.add(1);
  });

  sleep(2);

  // Apply shipping
  group('Select Shipping', () => {
    const res = http.put(`${BASE_URL}/api/v1/cart/shipping`, JSON.stringify({
      shipping_method_id: 'standard',
      address: {
        first_name: user.first_name,
        last_name: user.last_name,
        address_line1: '123 Test Street',
        city: 'Kyiv',
        postal_code: '01001',
        country_code: 'UA',
        phone: '+380501234567',
      },
    }), { headers: authHeaders });

    check(res, {
      'shipping applied': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(1);

  // Checkout
  group('Checkout', () => {
    const start = Date.now();
    const res = http.post(`${BASE_URL}/api/v1/checkout`, JSON.stringify({
      payment_method: 'test_card',
      billing_address: {
        first_name: user.first_name,
        last_name: user.last_name,
        address_line1: '123 Test Street',
        city: 'Kyiv',
        postal_code: '01001',
        country_code: 'UA',
      },
    }), { headers: authHeaders });
    checkoutTime.add(Date.now() - start);

    const success = check(res, {
      'checkout initiated': (r) => r.status === 200 || r.status === 201,
    });

    if (!success) {
      errorRate.add(1);
      return;
    }
  });

  sleep(1);

  // Create order
  group('Create Order', () => {
    const start = Date.now();
    const res = http.post(`${BASE_URL}/api/v1/orders`, JSON.stringify({
      payment_token: 'test_token_' + Date.now(),
    }), { headers: authHeaders });
    orderTime.add(Date.now() - start);

    const success = check(res, {
      'order created': (r) => r.status === 200 || r.status === 201,
      'order has number': (r) => {
        if (r.status !== 200 && r.status !== 201) return false;
        const body = JSON.parse(r.body);
        return body.order_number !== undefined;
      },
    });

    if (success) {
      ordersCreated.add(1);
    } else {
      errorRate.add(1);
    }
  });

  sleep(randomIntBetween(2, 5));
}

function randomIntBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
```

### API Stress Test

```javascript
// tests/load/scenarios/api.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    // Smoke test
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      startTime: '0s',
    },
    // Load test
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 100 },
        { duration: '10m', target: 100 },
        { duration: '5m', target: 0 },
      ],
      startTime: '1m',
    },
    // Stress test
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 300 },
        { duration: '5m', target: 300 },
        { duration: '2m', target: 400 },
        { duration: '5m', target: 400 },
        { duration: '5m', target: 0 },
      ],
      startTime: '21m',
    },
    // Spike test
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 500 },
        { duration: '1m', target: 500 },
        { duration: '10s', target: 0 },
      ],
      startTime: '47m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TENANT_ID = __ENV.TENANT_ID || 'default';

const headers = {
  'Content-Type': 'application/json',
  'X-Tenant-ID': TENANT_ID,
};

const endpoints = [
  { method: 'GET', path: '/api/v1/products?page=1&limit=20', weight: 30 },
  { method: 'GET', path: '/api/v1/categories', weight: 20 },
  { method: 'GET', path: '/api/v1/search?q=test', weight: 25 },
  { method: 'GET', path: '/api/v1/products/sample-product', weight: 15 },
  { method: 'GET', path: '/health', weight: 10 },
];

export default function () {
  const endpoint = weightedRandom(endpoints);

  const res = http.request(endpoint.method, `${BASE_URL}${endpoint.path}`, null, { headers });

  check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'response time OK': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(Math.random() * 2);
}

function weightedRandom(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  return items[items.length - 1];
}
```

### Mixed Scenario (Production-like)

```javascript
// tests/load/scenarios/mixed.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { SharedArray } from 'k6/data';

export const options = {
  scenarios: {
    browsers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 200 },
        { duration: '20m', target: 200 },
        { duration: '5m', target: 0 },
      ],
      exec: 'browserFlow',
    },
    searchers: {
      executor: 'constant-arrival-rate',
      rate: 30,
      timeUnit: '1s',
      duration: '30m',
      preAllocatedVUs: 50,
      maxVUs: 100,
      exec: 'searchFlow',
    },
    buyers: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 50,
      stages: [
        { duration: '5m', target: 5 },
        { duration: '20m', target: 5 },
        { duration: '5m', target: 0 },
      ],
      exec: 'checkoutFlow',
    },
    api_clients: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '30m',
      preAllocatedVUs: 30,
      maxVUs: 50,
      exec: 'apiFlow',
    },
  },
  thresholds: {
    'http_req_duration{scenario:browsers}': ['p(95)<600'],
    'http_req_duration{scenario:searchers}': ['p(95)<300'],
    'http_req_duration{scenario:buyers}': ['p(95)<1000'],
    'http_req_duration{scenario:api_clients}': ['p(95)<200'],
    http_req_failed: ['rate<0.02'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TENANT_ID = __ENV.TENANT_ID || 'default';

const headers = {
  'Content-Type': 'application/json',
  'X-Tenant-ID': TENANT_ID,
};

// Shared test data
const products = new SharedArray('products', () => JSON.parse(open('../data/products.json')));
const searchTerms = new SharedArray('terms', () => ['phone', 'laptop', 'shoes', 'watch', 'camera']);

export function browserFlow() {
  // Homepage
  http.get(`${BASE_URL}/api/v1/homepage`, { headers, tags: { name: 'homepage' } });
  sleep(randomBetween(2, 5));

  // Category
  http.get(`${BASE_URL}/api/v1/categories/electronics/products`, { headers, tags: { name: 'category' } });
  sleep(randomBetween(3, 8));

  // Product
  const product = products[Math.floor(Math.random() * products.length)];
  http.get(`${BASE_URL}/api/v1/products/${product.slug}`, { headers, tags: { name: 'product' } });
  sleep(randomBetween(5, 15));
}

export function searchFlow() {
  const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];

  // Suggest
  http.get(`${BASE_URL}/api/v1/search/suggest?q=${term.substring(0, 2)}`, { headers, tags: { name: 'suggest' } });
  sleep(0.3);

  // Search
  http.get(`${BASE_URL}/api/v1/search?q=${term}`, { headers, tags: { name: 'search' } });
  sleep(randomBetween(1, 3));
}

export function checkoutFlow() {
  // Simplified checkout flow
  const product = products[Math.floor(Math.random() * products.length)];

  // Add to cart
  http.post(`${BASE_URL}/api/v1/cart/items`, JSON.stringify({
    product_id: product.id,
    quantity: 1,
  }), { headers, tags: { name: 'add_to_cart' } });

  sleep(2);

  // View cart
  http.get(`${BASE_URL}/api/v1/cart`, { headers, tags: { name: 'view_cart' } });

  sleep(randomBetween(3, 5));
}

export function apiFlow() {
  const endpoints = [
    '/api/v1/products?limit=10',
    '/api/v1/categories',
    '/health',
    '/api/v1/shipping/methods',
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  http.get(`${BASE_URL}${endpoint}`, { headers, tags: { name: 'api' } });

  sleep(randomBetween(0.1, 0.5));
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}
```

## Helpers

### Authentication Helper

```javascript
// tests/load/helpers/auth.js
import http from 'k6/http';
import { check } from 'k6';

export function login(baseUrl, email, password, headers) {
  const res = http.post(`${baseUrl}/api/v1/auth/login`, JSON.stringify({
    email,
    password,
  }), { headers });

  if (check(res, { 'login successful': (r) => r.status === 200 })) {
    const body = JSON.parse(res.body);
    return body.token;
  }
  return null;
}

export function getAuthHeaders(baseUrl, email, password, baseHeaders) {
  const token = login(baseUrl, email, password, baseHeaders);
  if (token) {
    return {
      ...baseHeaders,
      'Authorization': `Bearer ${token}`,
    };
  }
  return baseHeaders;
}
```

### Data Generator

```javascript
// tests/load/helpers/data.js
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export function generateUser() {
  return {
    email: `test_${randomString(8)}@example.com`,
    password: 'TestPassword123!',
    first_name: `Test${randomString(4)}`,
    last_name: `User${randomString(4)}`,
  };
}

export function generateAddress() {
  return {
    first_name: 'Test',
    last_name: 'User',
    address_line1: `${randomIntBetween(1, 999)} Test Street`,
    city: 'Kyiv',
    postal_code: '0' + randomIntBetween(1000, 9999),
    country_code: 'UA',
    phone: '+38050' + randomIntBetween(1000000, 9999999),
  };
}

export function generateProduct() {
  return {
    name: `Test Product ${randomString(8)}`,
    sku: `SKU-${randomString(10).toUpperCase()}`,
    price: randomIntBetween(100, 10000),
    inventory_quantity: randomIntBetween(1, 100),
  };
}
```

## Запуск тестів

### Локальний запуск

```bash
#!/bin/bash
# tests/load/run.sh

# Environment
export BASE_URL=${BASE_URL:-"http://localhost:8080"}
export TENANT_ID=${TENANT_ID:-"default"}

# Run specific scenario
run_scenario() {
    local scenario=$1
    local output_dir="results/$(date +%Y%m%d_%H%M%S)"
    mkdir -p $output_dir

    k6 run \
        --out json=$output_dir/results.json \
        --out influxdb=http://localhost:8086/k6 \
        --summary-export=$output_dir/summary.json \
        scenarios/${scenario}.js

    echo "Results saved to $output_dir"
}

# Run all scenarios
run_all() {
    for scenario in browse search checkout api mixed; do
        echo "Running $scenario scenario..."
        run_scenario $scenario
        sleep 60  # Cool down between tests
    done
}

# Parse arguments
case "${1:-all}" in
    browse|search|checkout|api|mixed)
        run_scenario $1
        ;;
    all)
        run_all
        ;;
    *)
        echo "Usage: $0 {browse|search|checkout|api|mixed|all}"
        exit 1
        ;;
esac
```

### Docker Compose для тестового середовища

```yaml
# docker-compose.loadtest.yml
version: '3.8'

services:
  k6:
    image: grafana/k6:latest
    volumes:
      - ./tests/load:/scripts
      - ./tests/load/results:/results
    environment:
      - BASE_URL=http://core:8080
      - TENANT_ID=loadtest
      - K6_OUT=influxdb=http://influxdb:8086/k6
    command: run /scripts/scenarios/mixed.js
    depends_on:
      - influxdb

  influxdb:
    image: influxdb:1.8
    environment:
      - INFLUXDB_DB=k6
      - INFLUXDB_HTTP_AUTH_ENABLED=false
    ports:
      - "8086:8086"
    volumes:
      - influxdb_data:/var/lib/influxdb

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./tests/load/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./tests/load/grafana/datasources:/etc/grafana/provisioning/datasources
    depends_on:
      - influxdb

volumes:
  influxdb_data:
  grafana_data:
```

### CI/CD Pipeline

```yaml
# .github/workflows/load-test.yml
name: Load Test

on:
  workflow_dispatch:
    inputs:
      scenario:
        description: 'Test scenario'
        required: true
        default: 'mixed'
        type: choice
        options:
          - browse
          - search
          - checkout
          - api
          - mixed
      duration:
        description: 'Test duration'
        required: false
        default: '10m'

jobs:
  load-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup k6
        uses: grafana/setup-k6-action@v1

      - name: Run load test
        run: |
          k6 run \
            -e BASE_URL=${{ secrets.STAGING_URL }} \
            -e TENANT_ID=loadtest \
            --duration ${{ github.event.inputs.duration }} \
            --summary-export=summary.json \
            tests/load/scenarios/${{ github.event.inputs.scenario }}.js

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: load-test-results
          path: summary.json

      - name: Check thresholds
        run: |
          if jq -e '.metrics.http_req_failed.values.rate > 0.05' summary.json > /dev/null; then
            echo "Error rate exceeded threshold!"
            exit 1
          fi
```

## Grafana Dashboard

```json
{
  "dashboard": {
    "title": "k6 Load Test Results",
    "panels": [
      {
        "title": "Virtual Users",
        "type": "graph",
        "targets": [
          {
            "query": "SELECT mean(\"value\") FROM \"vus\" WHERE $timeFilter GROUP BY time($__interval)",
            "refId": "A"
          }
        ]
      },
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "query": "SELECT sum(\"value\") FROM \"http_reqs\" WHERE $timeFilter GROUP BY time($__interval)",
            "refId": "A"
          }
        ]
      },
      {
        "title": "Response Time (p95)",
        "type": "graph",
        "targets": [
          {
            "query": "SELECT percentile(\"value\", 95) FROM \"http_req_duration\" WHERE $timeFilter GROUP BY time($__interval)",
            "refId": "A"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "singlestat",
        "targets": [
          {
            "query": "SELECT mean(\"value\") * 100 FROM \"http_req_failed\" WHERE $timeFilter",
            "refId": "A"
          }
        ],
        "format": "percent"
      }
    ]
  }
}
```

## Performance Baselines

| Metric | Smoke | Load | Stress | Spike |
|--------|-------|------|--------|-------|
| VUs | 1 | 100 | 400 | 500 |
| Duration | 1m | 20m | 26m | 1m |
| p95 Response | <200ms | <500ms | <1000ms | <2000ms |
| Error Rate | <0.1% | <1% | <5% | <10% |
| Throughput | 10 rps | 500 rps | 1000 rps | 2000 rps |

## Див. також

- [Monitoring](../operations/MONITORING.md)
- [Performance Optimization](../guides/PERFORMANCE.md)
- [Infrastructure](./TERRAFORM.md)
