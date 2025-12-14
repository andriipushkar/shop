# Testing Guide

Керівництво з тестування платформи.

## Огляд

| Тип тестів | Технологія |
|------------|------------|
| Unit Tests (Go) | `go test` |
| Unit Tests (Frontend) | Jest + React Testing Library |
| Integration Tests | Testcontainers |
| E2E Tests | Playwright |
| Load Tests | k6 |

## Unit Tests (Go)

### Структура

```
services/core/
├── internal/
│   ├── product/
│   │   ├── service.go
│   │   ├── service_test.go
│   │   ├── repository.go
│   │   └── repository_test.go
│   └── order/
│       ├── service.go
│       └── service_test.go
└── pkg/
    └── utils/
        ├── helpers.go
        └── helpers_test.go
```

### Написання тестів

```go
// service_test.go
package product

import (
    "context"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"
    "github.com/stretchr/testify/require"
)

// Мок репозиторію
type MockRepository struct {
    mock.Mock
}

func (m *MockRepository) FindByID(ctx context.Context, id string) (*Product, error) {
    args := m.Called(ctx, id)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*Product), args.Error(1)
}

func (m *MockRepository) Create(ctx context.Context, product *Product) error {
    args := m.Called(ctx, product)
    return args.Error(0)
}

// Тести
func TestProductService_GetByID(t *testing.T) {
    t.Run("success", func(t *testing.T) {
        mockRepo := new(MockRepository)
        service := NewService(mockRepo)

        expected := &Product{ID: "prod_123", Name: "Test Product"}
        mockRepo.On("FindByID", mock.Anything, "prod_123").Return(expected, nil)

        result, err := service.GetByID(context.Background(), "prod_123")

        require.NoError(t, err)
        assert.Equal(t, expected.ID, result.ID)
        assert.Equal(t, expected.Name, result.Name)
        mockRepo.AssertExpectations(t)
    })

    t.Run("not found", func(t *testing.T) {
        mockRepo := new(MockRepository)
        service := NewService(mockRepo)

        mockRepo.On("FindByID", mock.Anything, "not_exists").Return(nil, ErrNotFound)

        result, err := service.GetByID(context.Background(), "not_exists")

        assert.Nil(t, result)
        assert.ErrorIs(t, err, ErrNotFound)
    })
}

func TestProductService_Create(t *testing.T) {
    tests := []struct {
        name    string
        input   CreateProductInput
        wantErr bool
        errType error
    }{
        {
            name: "valid product",
            input: CreateProductInput{
                Name:  "New Product",
                SKU:   "SKU-001",
                Price: 100.00,
            },
            wantErr: false,
        },
        {
            name: "missing name",
            input: CreateProductInput{
                SKU:   "SKU-001",
                Price: 100.00,
            },
            wantErr: true,
            errType: ErrValidation,
        },
        {
            name: "negative price",
            input: CreateProductInput{
                Name:  "Product",
                SKU:   "SKU-001",
                Price: -10.00,
            },
            wantErr: true,
            errType: ErrValidation,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            mockRepo := new(MockRepository)
            service := NewService(mockRepo)

            if !tt.wantErr {
                mockRepo.On("Create", mock.Anything, mock.AnythingOfType("*product.Product")).Return(nil)
            }

            result, err := service.Create(context.Background(), tt.input)

            if tt.wantErr {
                assert.Error(t, err)
                if tt.errType != nil {
                    assert.ErrorIs(t, err, tt.errType)
                }
            } else {
                assert.NoError(t, err)
                assert.NotEmpty(t, result.ID)
            }
        })
    }
}
```

### Table-Driven Tests

```go
func TestCalculateDiscount(t *testing.T) {
    tests := []struct {
        name     string
        price    float64
        discount float64
        expected float64
    }{
        {"no discount", 100, 0, 100},
        {"10% discount", 100, 10, 90},
        {"50% discount", 200, 50, 100},
        {"100% discount", 100, 100, 0},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := CalculateDiscount(tt.price, tt.discount)
            assert.Equal(t, tt.expected, result)
        })
    }
}
```

### Запуск тестів

```bash
# Всі тести
go test ./...

# З покриттям
go test -cover ./...

# Детальне покриття
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html

# Конкретний пакет
go test ./internal/product/...

# Конкретний тест
go test -run TestProductService_Create ./internal/product/

# Verbose
go test -v ./...

# Race detector
go test -race ./...

# Benchmark
go test -bench=. ./...
```

## Integration Tests

### Testcontainers

```go
// integration_test.go
package integration

import (
    "context"
    "testing"
    "time"

    "github.com/testcontainers/testcontainers-go"
    "github.com/testcontainers/testcontainers-go/modules/postgres"
    "github.com/testcontainers/testcontainers-go/modules/redis"
)

type TestEnvironment struct {
    PostgresContainer testcontainers.Container
    RedisContainer    testcontainers.Container
    DB                *gorm.DB
    Redis             *redis.Client
}

func SetupTestEnvironment(t *testing.T) *TestEnvironment {
    ctx := context.Background()

    // PostgreSQL
    postgresContainer, err := postgres.RunContainer(ctx,
        testcontainers.WithImage("postgres:15"),
        postgres.WithDatabase("testdb"),
        postgres.WithUsername("test"),
        postgres.WithPassword("test"),
    )
    require.NoError(t, err)

    postgresHost, _ := postgresContainer.Host(ctx)
    postgresPort, _ := postgresContainer.MappedPort(ctx, "5432")

    dsn := fmt.Sprintf("host=%s port=%s user=test password=test dbname=testdb sslmode=disable",
        postgresHost, postgresPort.Port())

    db, err := gorm.Open(gormpostgres.Open(dsn), &gorm.Config{})
    require.NoError(t, err)

    // Run migrations
    db.AutoMigrate(&Product{}, &Order{}, &Customer{})

    // Redis
    redisContainer, err := redis.RunContainer(ctx,
        testcontainers.WithImage("redis:7"),
    )
    require.NoError(t, err)

    redisHost, _ := redisContainer.Host(ctx)
    redisPort, _ := redisContainer.MappedPort(ctx, "6379")

    redisClient := redis.NewClient(&redis.Options{
        Addr: fmt.Sprintf("%s:%s", redisHost, redisPort.Port()),
    })

    return &TestEnvironment{
        PostgresContainer: postgresContainer,
        RedisContainer:    redisContainer,
        DB:                db,
        Redis:             redisClient,
    }
}

func (e *TestEnvironment) Cleanup(t *testing.T) {
    ctx := context.Background()
    e.PostgresContainer.Terminate(ctx)
    e.RedisContainer.Terminate(ctx)
}

func TestOrderCreation(t *testing.T) {
    env := SetupTestEnvironment(t)
    defer env.Cleanup(t)

    // Create services with real dependencies
    productRepo := NewProductRepository(env.DB)
    orderRepo := NewOrderRepository(env.DB)
    orderService := NewOrderService(orderRepo, productRepo, env.Redis)

    // Create test product
    product := &Product{
        Name:  "Test Product",
        SKU:   "SKU-001",
        Price: 100.00,
        Stock: 10,
    }
    env.DB.Create(product)

    // Test order creation
    order, err := orderService.Create(context.Background(), CreateOrderInput{
        CustomerID: "cust_123",
        Items: []OrderItem{
            {ProductID: product.ID, Quantity: 2},
        },
    })

    require.NoError(t, err)
    assert.NotEmpty(t, order.ID)
    assert.Equal(t, 200.00, order.Total)

    // Verify stock was reduced
    var updatedProduct Product
    env.DB.First(&updatedProduct, product.ID)
    assert.Equal(t, 8, updatedProduct.Stock)
}
```

## Frontend Tests (Jest)

### Налаштування

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

// jest.setup.js
import '@testing-library/jest-dom';
```

### Component Tests

```tsx
// components/ProductCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductCard } from './ProductCard';

const mockProduct = {
  id: 'prod_123',
  name: 'Test Product',
  price: 100,
  image: '/test.jpg',
  inStock: true,
};

describe('ProductCard', () => {
  it('renders product information', () => {
    render(<ProductCard product={mockProduct} />);

    expect(screen.getByText('Test Product')).toBeInTheDocument();
    expect(screen.getByText('100 ₴')).toBeInTheDocument();
  });

  it('shows add to cart button when in stock', () => {
    render(<ProductCard product={mockProduct} />);

    expect(screen.getByRole('button', { name: /додати в кошик/i })).toBeInTheDocument();
  });

  it('shows out of stock message when not available', () => {
    render(<ProductCard product={{ ...mockProduct, inStock: false }} />);

    expect(screen.getByText(/немає в наявності/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /додати в кошик/i })).not.toBeInTheDocument();
  });

  it('calls onAddToCart when button clicked', () => {
    const onAddToCart = jest.fn();
    render(<ProductCard product={mockProduct} onAddToCart={onAddToCart} />);

    fireEvent.click(screen.getByRole('button', { name: /додати в кошик/i }));

    expect(onAddToCart).toHaveBeenCalledWith(mockProduct.id);
  });
});
```

### Hook Tests

```tsx
// hooks/useCart.test.tsx
import { renderHook, act } from '@testing-library/react';
import { useCart } from './useCart';
import { CartProvider } from '../contexts/CartContext';

const wrapper = ({ children }) => (
  <CartProvider>{children}</CartProvider>
);

describe('useCart', () => {
  it('adds item to cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem({ productId: 'prod_123', quantity: 1 });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].productId).toBe('prod_123');
  });

  it('updates quantity', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem({ productId: 'prod_123', quantity: 1 });
    });

    act(() => {
      result.current.updateQuantity('prod_123', 3);
    });

    expect(result.current.items[0].quantity).toBe(3);
  });

  it('calculates total correctly', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem({ productId: 'prod_1', quantity: 2, price: 100 });
      result.current.addItem({ productId: 'prod_2', quantity: 1, price: 50 });
    });

    expect(result.current.total).toBe(250);
  });
});
```

### API Mocking (MSW)

```typescript
// mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/products', (req, res, ctx) => {
    return res(
      ctx.json({
        products: [
          { id: 'prod_1', name: 'Product 1', price: 100 },
          { id: 'prod_2', name: 'Product 2', price: 200 },
        ],
        total: 2,
      })
    );
  }),

  rest.post('/api/orders', async (req, res, ctx) => {
    const body = await req.json();
    return res(
      ctx.json({
        id: 'order_123',
        orderNumber: 'ORD-2024-001',
        ...body,
      })
    );
  }),

  rest.get('/api/products/:id', (req, res, ctx) => {
    const { id } = req.params;

    if (id === 'not_found') {
      return res(ctx.status(404), ctx.json({ error: 'Not found' }));
    }

    return res(
      ctx.json({
        id,
        name: 'Test Product',
        price: 100,
      })
    );
  }),
];

// mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// jest.setup.js
import { server } from './mocks/server';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## E2E Tests (Playwright)

### Налаштування

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Page Objects

```typescript
// e2e/pages/ProductPage.ts
import { Page, Locator } from '@playwright/test';

export class ProductPage {
  readonly page: Page;
  readonly addToCartButton: Locator;
  readonly quantityInput: Locator;
  readonly priceDisplay: Locator;
  readonly cartNotification: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addToCartButton = page.getByRole('button', { name: /додати в кошик/i });
    this.quantityInput = page.getByLabel(/кількість/i);
    this.priceDisplay = page.getByTestId('product-price');
    this.cartNotification = page.getByRole('alert');
  }

  async goto(productId: string) {
    await this.page.goto(`/products/${productId}`);
  }

  async addToCart(quantity: number = 1) {
    await this.quantityInput.fill(quantity.toString());
    await this.addToCartButton.click();
    await this.cartNotification.waitFor();
  }

  async getPrice(): Promise<number> {
    const text = await this.priceDisplay.textContent();
    return parseFloat(text?.replace(/[^\d.]/g, '') || '0');
  }
}
```

### E2E Tests

```typescript
// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';
import { ProductPage } from './pages/ProductPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';

test.describe('Checkout Flow', () => {
  test('complete checkout', async ({ page }) => {
    // Add product to cart
    const productPage = new ProductPage(page);
    await productPage.goto('prod_123');
    await productPage.addToCart(2);

    // Go to cart
    const cartPage = new CartPage(page);
    await cartPage.goto();
    expect(await cartPage.getItemCount()).toBe(1);
    await cartPage.proceedToCheckout();

    // Fill checkout form
    const checkoutPage = new CheckoutPage(page);
    await checkoutPage.fillContactInfo({
      firstName: 'Іван',
      lastName: 'Петренко',
      email: 'ivan@example.com',
      phone: '+380991234567',
    });

    await checkoutPage.selectShipping('nova_poshta');
    await checkoutPage.selectCity('Київ');
    await checkoutPage.selectWarehouse('Відділення №1');

    await checkoutPage.selectPayment('card');
    await checkoutPage.submitOrder();

    // Verify success
    await expect(page.getByText(/замовлення успішно/i)).toBeVisible();
    await expect(page.getByText(/ORD-/)).toBeVisible();
  });

  test('shows validation errors', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);
    await checkoutPage.goto();
    await checkoutPage.submitOrder();

    await expect(page.getByText(/обов'язкове поле/i)).toBeVisible();
  });
});

test.describe('Product Search', () => {
  test('search and filter products', async ({ page }) => {
    await page.goto('/products');

    // Search
    await page.getByPlaceholder(/пошук/i).fill('iPhone');
    await page.keyboard.press('Enter');

    // Wait for results
    await page.waitForSelector('[data-testid="product-card"]');

    // Apply filters
    await page.getByLabel(/ціна від/i).fill('10000');
    await page.getByLabel(/ціна до/i).fill('50000');
    await page.getByRole('button', { name: /застосувати/i }).click();

    // Verify filtered results
    const products = await page.locator('[data-testid="product-card"]').all();
    expect(products.length).toBeGreaterThan(0);

    for (const product of products) {
      const priceText = await product.locator('[data-testid="price"]').textContent();
      const price = parseFloat(priceText?.replace(/[^\d]/g, '') || '0');
      expect(price).toBeGreaterThanOrEqual(10000);
      expect(price).toBeLessThanOrEqual(50000);
    }
  });
});
```

### Запуск E2E

```bash
# Всі тести
npx playwright test

# UI режим
npx playwright test --ui

# Конкретний файл
npx playwright test checkout.spec.ts

# Конкретний браузер
npx playwright test --project=chromium

# Debug mode
npx playwright test --debug

# Generate report
npx playwright show-report
```

## Load Tests (k6)

### Сценарії

```javascript
// load-tests/checkout.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const checkoutDuration = new Trend('checkout_duration');

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 100 },  // Spike to 100
    { duration: '3m', target: 100 },  // Stay at 100
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% requests < 500ms
    errors: ['rate<0.1'],               // Error rate < 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  // Get products
  const productsRes = http.get(`${BASE_URL}/api/v1/products?limit=10`);
  check(productsRes, {
    'products status 200': (r) => r.status === 200,
  });

  const products = JSON.parse(productsRes.body).products;

  // Add to cart
  const cartRes = http.post(`${BASE_URL}/api/v1/cart/items`, JSON.stringify({
    product_id: products[0].id,
    quantity: 1,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(cartRes, {
    'add to cart status 200': (r) => r.status === 200,
  });

  // Checkout
  const startTime = Date.now();

  const checkoutRes = http.post(`${BASE_URL}/api/v1/orders`, JSON.stringify({
    customer: {
      first_name: 'Test',
      last_name: 'User',
      email: `test${Date.now()}@example.com`,
      phone: '+380991234567',
    },
    shipping: {
      method: 'nova_poshta',
      city: 'Київ',
      warehouse: 'Відділення №1',
    },
    payment_method: 'cash',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  checkoutDuration.add(Date.now() - startTime);

  const checkoutSuccess = check(checkoutRes, {
    'checkout status 200': (r) => r.status === 200,
    'order id present': (r) => JSON.parse(r.body).order_id !== undefined,
  });

  errorRate.add(!checkoutSuccess);

  sleep(1);
}
```

### Запуск

```bash
# Локально
k6 run load-tests/checkout.js

# З ENV
k6 run -e BASE_URL=https://staging.yourstore.com load-tests/checkout.js

# Output to InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 load-tests/checkout.js

# Cloud
k6 cloud load-tests/checkout.js
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests-go:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v4
        with:
          go-version: '1.24'

      - name: Run tests
        run: go test -race -coverprofile=coverage.out ./...

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.out

  unit-tests-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci
      - run: npm test -- --coverage

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v4
        with:
          go-version: '1.24'

      - name: Run integration tests
        run: go test -tags=integration ./...
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci
      - run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npx playwright test

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Coverage Requirements

| Компонент | Мінімум |
|-----------|---------|
| Core Services | 80% |
| API Handlers | 70% |
| Utils | 90% |
| Frontend Components | 70% |

## Best Practices

1. **Ізоляція** - Кожен тест незалежний
2. **Швидкість** - Unit тести < 100ms
3. **Детермінізм** - Однаковий результат при повторах
4. **Читабельність** - Зрозумілі назви тестів
5. **AAA Pattern** - Arrange, Act, Assert
6. **Без side effects** - Очищення після тестів
