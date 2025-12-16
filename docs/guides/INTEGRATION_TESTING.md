# Integration Testing

Інтеграційне тестування сервісів та компонентів.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       INTEGRATION TESTING                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │ Test Suite   │────▶│ Application  │────▶│ Real         │                │
│  │              │     │ Services     │     │ Dependencies │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│                                                   │                         │
│                                            ┌──────┴──────┐                  │
│                                            │             │                  │
│                                     ┌──────┴───┐  ┌──────┴───┐             │
│                                     │ Database │  │ Redis    │             │
│                                     │ (testdb) │  │ (testdb) │             │
│                                     └──────────┘  └──────────┘             │
│                                                                              │
│  Scope:                                                                     │
│  ├── API endpoints                                                         │
│  ├── Database operations                                                   │
│  ├── Cache interactions                                                    │
│  └── External service mocks                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Setup

### Test Database

```yaml
# docker-compose.test.yml
version: '3.8'

services:
  postgres-test:
    image: postgres:15
    environment:
      POSTGRES_DB: shop_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data

  redis-test:
    image: redis:7
    ports:
      - "6380:6379"
```

### Go Test Configuration

```go
// internal/testutil/setup.go
package testutil

import (
    "context"
    "database/sql"
    "testing"

    "github.com/testcontainers/testcontainers-go"
    "github.com/testcontainers/testcontainers-go/wait"
)

type TestDB struct {
    Container testcontainers.Container
    DB        *sql.DB
    DSN       string
}

func SetupTestDB(t *testing.T) *TestDB {
    ctx := context.Background()

    req := testcontainers.ContainerRequest{
        Image:        "postgres:15",
        ExposedPorts: []string{"5432/tcp"},
        Env: map[string]string{
            "POSTGRES_DB":       "test",
            "POSTGRES_USER":     "test",
            "POSTGRES_PASSWORD": "test",
        },
        WaitingFor: wait.ForLog("database system is ready to accept connections"),
    }

    container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
        ContainerRequest: req,
        Started:          true,
    })
    if err != nil {
        t.Fatalf("failed to start container: %v", err)
    }

    host, _ := container.Host(ctx)
    port, _ := container.MappedPort(ctx, "5432")

    dsn := fmt.Sprintf("postgres://test:test@%s:%s/test?sslmode=disable", host, port.Port())

    db, err := sql.Open("postgres", dsn)
    if err != nil {
        t.Fatalf("failed to connect to database: %v", err)
    }

    // Run migrations
    runMigrations(db)

    return &TestDB{
        Container: container,
        DB:        db,
        DSN:       dsn,
    }
}

func (tdb *TestDB) Cleanup(t *testing.T) {
    tdb.DB.Close()
    tdb.Container.Terminate(context.Background())
}
```

## API Integration Tests

### HTTP Handler Tests

```go
// internal/api/handler_test.go
package api

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestProductHandler_Create(t *testing.T) {
    // Setup
    testDB := testutil.SetupTestDB(t)
    defer testDB.Cleanup(t)

    repo := repository.NewProductRepository(testDB.DB)
    service := service.NewProductService(repo)
    handler := NewProductHandler(service)

    router := chi.NewRouter()
    router.Post("/products", handler.Create)

    // Test cases
    tests := []struct {
        name       string
        payload    map[string]interface{}
        wantStatus int
        wantErr    bool
    }{
        {
            name: "valid product",
            payload: map[string]interface{}{
                "name":        "Test Product",
                "sku":         "TEST-001",
                "price":       99.99,
                "description": "Test description",
            },
            wantStatus: http.StatusCreated,
            wantErr:    false,
        },
        {
            name: "missing required field",
            payload: map[string]interface{}{
                "name": "Test Product",
            },
            wantStatus: http.StatusBadRequest,
            wantErr:    true,
        },
        {
            name: "duplicate SKU",
            payload: map[string]interface{}{
                "name":  "Another Product",
                "sku":   "TEST-001", // Already exists
                "price": 49.99,
            },
            wantStatus: http.StatusConflict,
            wantErr:    true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            body, _ := json.Marshal(tt.payload)
            req := httptest.NewRequest("POST", "/products", bytes.NewReader(body))
            req.Header.Set("Content-Type", "application/json")

            rec := httptest.NewRecorder()
            router.ServeHTTP(rec, req)

            assert.Equal(t, tt.wantStatus, rec.Code)

            if !tt.wantErr {
                var response map[string]interface{}
                err := json.Unmarshal(rec.Body.Bytes(), &response)
                require.NoError(t, err)
                assert.NotEmpty(t, response["id"])
            }
        })
    }
}

func TestOrderHandler_Checkout(t *testing.T) {
    testDB := testutil.SetupTestDB(t)
    defer testDB.Cleanup(t)

    // Setup services
    productRepo := repository.NewProductRepository(testDB.DB)
    orderRepo := repository.NewOrderRepository(testDB.DB)
    paymentService := mocks.NewMockPaymentService()
    shippingService := mocks.NewMockShippingService()

    orderService := service.NewOrderService(orderRepo, productRepo, paymentService, shippingService)
    handler := NewOrderHandler(orderService)

    // Create test product
    product := &model.Product{
        Name:  "Test Product",
        SKU:   "TEST-001",
        Price: 100.00,
        Stock: 10,
    }
    productRepo.Create(context.Background(), product)

    router := chi.NewRouter()
    router.Post("/checkout", handler.Checkout)

    t.Run("successful checkout", func(t *testing.T) {
        payload := map[string]interface{}{
            "items": []map[string]interface{}{
                {"product_id": product.ID, "quantity": 2},
            },
            "customer": map[string]interface{}{
                "email":      "test@example.com",
                "phone":      "+380501234567",
                "first_name": "Test",
                "last_name":  "User",
            },
            "shipping": map[string]interface{}{
                "method":        "nova_poshta",
                "city_ref":      "city-ref",
                "warehouse_ref": "warehouse-ref",
            },
            "payment": map[string]interface{}{
                "method": "liqpay",
            },
        }

        body, _ := json.Marshal(payload)
        req := httptest.NewRequest("POST", "/checkout", bytes.NewReader(body))
        req.Header.Set("Content-Type", "application/json")

        rec := httptest.NewRecorder()
        router.ServeHTTP(rec, req)

        assert.Equal(t, http.StatusCreated, rec.Code)

        var response map[string]interface{}
        json.Unmarshal(rec.Body.Bytes(), &response)
        assert.NotEmpty(t, response["order_id"])
        assert.NotEmpty(t, response["payment_url"])
    })

    t.Run("insufficient stock", func(t *testing.T) {
        payload := map[string]interface{}{
            "items": []map[string]interface{}{
                {"product_id": product.ID, "quantity": 100}, // More than available
            },
            "customer": map[string]interface{}{
                "email": "test@example.com",
            },
        }

        body, _ := json.Marshal(payload)
        req := httptest.NewRequest("POST", "/checkout", bytes.NewReader(body))
        req.Header.Set("Content-Type", "application/json")

        rec := httptest.NewRecorder()
        router.ServeHTTP(rec, req)

        assert.Equal(t, http.StatusBadRequest, rec.Code)
    })
}
```

### Database Integration Tests

```go
// internal/repository/product_repository_test.go
package repository

import (
    "context"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestProductRepository_CRUD(t *testing.T) {
    testDB := testutil.SetupTestDB(t)
    defer testDB.Cleanup(t)

    repo := NewProductRepository(testDB.DB)
    ctx := context.Background()

    t.Run("Create", func(t *testing.T) {
        product := &model.Product{
            Name:        "Test Product",
            SKU:         "TEST-001",
            Price:       99.99,
            Description: "Test description",
        }

        err := repo.Create(ctx, product)
        require.NoError(t, err)
        assert.NotZero(t, product.ID)
        assert.NotZero(t, product.CreatedAt)
    })

    t.Run("GetByID", func(t *testing.T) {
        product, err := repo.GetByID(ctx, 1)
        require.NoError(t, err)
        assert.Equal(t, "Test Product", product.Name)
    })

    t.Run("GetBySKU", func(t *testing.T) {
        product, err := repo.GetBySKU(ctx, "TEST-001")
        require.NoError(t, err)
        assert.Equal(t, "Test Product", product.Name)
    })

    t.Run("Update", func(t *testing.T) {
        product, _ := repo.GetByID(ctx, 1)
        product.Price = 149.99

        err := repo.Update(ctx, product)
        require.NoError(t, err)

        updated, _ := repo.GetByID(ctx, 1)
        assert.Equal(t, 149.99, updated.Price)
    })

    t.Run("List with filters", func(t *testing.T) {
        // Create more products
        repo.Create(ctx, &model.Product{Name: "Product 2", SKU: "TEST-002", Price: 50.00})
        repo.Create(ctx, &model.Product{Name: "Product 3", SKU: "TEST-003", Price: 200.00})

        filter := &ProductFilter{
            MinPrice: 100,
            MaxPrice: 200,
            Limit:    10,
        }

        products, total, err := repo.List(ctx, filter)
        require.NoError(t, err)
        assert.Equal(t, 2, total)
        assert.Len(t, products, 2)
    })

    t.Run("Delete", func(t *testing.T) {
        err := repo.Delete(ctx, 1)
        require.NoError(t, err)

        _, err = repo.GetByID(ctx, 1)
        assert.Error(t, err)
    })
}
```

## Frontend Integration Tests

### API Client Tests

```typescript
// tests/integration/api-client.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApiClient } from '@/lib/api-client';

describe('API Client Integration', () => {
  let apiClient: ReturnType<typeof createApiClient>;

  beforeAll(async () => {
    apiClient = createApiClient({
      baseUrl: process.env.TEST_API_URL || 'http://localhost:8080',
    });
  });

  describe('Products API', () => {
    it('should fetch products', async () => {
      const response = await apiClient.products.list({ limit: 10 });

      expect(response.data).toBeInstanceOf(Array);
      expect(response.meta.total).toBeGreaterThanOrEqual(0);
    });

    it('should fetch single product', async () => {
      const products = await apiClient.products.list({ limit: 1 });
      if (products.data.length === 0) return;

      const product = await apiClient.products.get(products.data[0].id);

      expect(product.id).toBeDefined();
      expect(product.name).toBeDefined();
      expect(product.price).toBeDefined();
    });

    it('should search products', async () => {
      const response = await apiClient.products.search({
        query: 'test',
        limit: 10,
      });

      expect(response.data).toBeInstanceOf(Array);
    });
  });

  describe('Cart API', () => {
    let cartId: string;

    it('should create cart', async () => {
      const cart = await apiClient.cart.create();

      expect(cart.id).toBeDefined();
      cartId = cart.id;
    });

    it('should add item to cart', async () => {
      const products = await apiClient.products.list({ limit: 1 });
      if (products.data.length === 0) return;

      const cart = await apiClient.cart.addItem(cartId, {
        productId: products.data[0].id,
        quantity: 2,
      });

      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(2);
    });

    it('should update cart item', async () => {
      const cart = await apiClient.cart.get(cartId);
      const itemId = cart.items[0].id;

      const updated = await apiClient.cart.updateItem(cartId, itemId, {
        quantity: 5,
      });

      expect(updated.items[0].quantity).toBe(5);
    });

    it('should remove cart item', async () => {
      const cart = await apiClient.cart.get(cartId);
      const itemId = cart.items[0].id;

      const updated = await apiClient.cart.removeItem(cartId, itemId);

      expect(updated.items).toHaveLength(0);
    });
  });

  describe('Auth API', () => {
    const testUser = {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
    };

    it('should register user', async () => {
      const response = await apiClient.auth.register(testUser);

      expect(response.user.email).toBe(testUser.email);
    });

    it('should login user', async () => {
      const response = await apiClient.auth.login({
        email: testUser.email,
        password: testUser.password,
      });

      expect(response.accessToken).toBeDefined();
      expect(response.refreshToken).toBeDefined();
    });

    it('should refresh token', async () => {
      const loginResponse = await apiClient.auth.login({
        email: testUser.email,
        password: testUser.password,
      });

      const response = await apiClient.auth.refreshToken({
        refreshToken: loginResponse.refreshToken,
      });

      expect(response.accessToken).toBeDefined();
    });
  });
});
```

### Component Integration Tests

```typescript
// tests/integration/checkout-flow.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { CheckoutPage } from '@/pages/checkout';

const server = setupServer(
  http.get('/api/cart', () => {
    return HttpResponse.json({
      id: 'cart-1',
      items: [
        {
          id: 'item-1',
          productId: 'prod-1',
          name: 'Test Product',
          price: 100,
          quantity: 2,
        },
      ],
      total: 200,
    });
  }),

  http.post('/api/orders', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: 'order-123',
      ...body,
      status: 'pending',
    });
  }),

  http.get('/api/shipping/cities', () => {
    return HttpResponse.json({
      data: [
        { ref: 'kyiv-ref', name: 'Київ' },
        { ref: 'lviv-ref', name: 'Львів' },
      ],
    });
  }),

  http.get('/api/shipping/warehouses', () => {
    return HttpResponse.json({
      data: [
        { ref: 'wh-1', description: 'Відділення №1' },
        { ref: 'wh-2', description: 'Відділення №2' },
      ],
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Checkout Flow', () => {
  it('should complete checkout successfully', async () => {
    const user = userEvent.setup();
    render(<CheckoutPage />);

    // Wait for cart to load
    await waitFor(() => {
      expect(screen.getByText('Test Product')).toBeInTheDocument();
    });

    // Fill contact info
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Телефон'), '+380501234567');
    await user.type(screen.getByLabelText("Ім'я"), 'Іван');
    await user.type(screen.getByLabelText('Прізвище'), 'Петренко');

    // Select city
    await user.click(screen.getByLabelText('Місто'));
    await waitFor(() => {
      expect(screen.getByText('Київ')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Київ'));

    // Select warehouse
    await user.click(screen.getByLabelText('Відділення'));
    await waitFor(() => {
      expect(screen.getByText('Відділення №1')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Відділення №1'));

    // Select payment method
    await user.click(screen.getByLabelText('Оплата при отриманні'));

    // Submit order
    await user.click(screen.getByRole('button', { name: /оформити замовлення/i }));

    // Verify success
    await waitFor(() => {
      expect(screen.getByText(/замовлення оформлено/i)).toBeInTheDocument();
      expect(screen.getByText('order-123')).toBeInTheDocument();
    });
  });
});
```

## Running Tests

```bash
# Start test dependencies
docker-compose -f docker-compose.test.yml up -d

# Run Go integration tests
go test -v -tags=integration ./internal/...

# Run frontend integration tests
npm run test:integration

# Run all integration tests
make test-integration
```

## CI Configuration

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'

      - name: Run Go integration tests
        run: go test -v -tags=integration ./...
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/test?sslmode=disable
          REDIS_URL: redis://localhost:6379

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Install dependencies
        run: npm ci

      - name: Run frontend integration tests
        run: npm run test:integration
        env:
          TEST_API_URL: http://localhost:8080
```

## See Also

- [Unit Testing](./TESTING.md)
- [E2E Testing](./E2E_TESTING.md)
- [Test Coverage](./TEST_COVERAGE.md)
