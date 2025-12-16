# End-to-End Testing

E2E тестування з використанням Playwright.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           E2E TESTING STACK                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │ Playwright   │────▶│ Browser      │────▶│ Application  │                │
│  │ Tests        │     │ (Chromium,   │     │ Under Test   │                │
│  │              │     │  Firefox,    │     │              │                │
│  │              │     │  WebKit)     │     │              │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│                                                                              │
│  Test Types:                                                                │
│  ├── Critical User Journeys (checkout, auth)                               │
│  ├── Visual Regression                                                      │
│  ├── API Integration                                                        │
│  └── Cross-browser compatibility                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Setup

### Installation

```bash
# Install Playwright
npm install -D @playwright/test

# Install browsers
npx playwright install

# Install with dependencies (CI)
npx playwright install --with-deps
```

### Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
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
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

## Test Structure

```
tests/e2e/
├── fixtures/
│   ├── auth.fixture.ts      # Authentication fixtures
│   ├── cart.fixture.ts      # Cart fixtures
│   └── test-data.ts         # Test data
├── pages/
│   ├── home.page.ts         # Page objects
│   ├── product.page.ts
│   ├── cart.page.ts
│   ├── checkout.page.ts
│   └── account.page.ts
├── specs/
│   ├── auth.spec.ts         # Auth tests
│   ├── catalog.spec.ts      # Product catalog
│   ├── cart.spec.ts         # Cart functionality
│   ├── checkout.spec.ts     # Checkout flow
│   └── account.spec.ts      # Account management
└── utils/
    ├── api.ts               # API helpers
    └── helpers.ts           # Common helpers
```

## Page Objects

```typescript
// tests/e2e/pages/product.page.ts
import { Page, Locator } from '@playwright/test';

export class ProductPage {
  readonly page: Page;
  readonly addToCartButton: Locator;
  readonly quantityInput: Locator;
  readonly priceDisplay: Locator;
  readonly variantSelector: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addToCartButton = page.getByRole('button', { name: /додати в кошик/i });
    this.quantityInput = page.getByLabel('Кількість');
    this.priceDisplay = page.getByTestId('product-price');
    this.variantSelector = page.getByTestId('variant-selector');
  }

  async goto(slug: string) {
    await this.page.goto(`/products/${slug}`);
  }

  async addToCart(quantity: number = 1) {
    if (quantity > 1) {
      await this.quantityInput.fill(String(quantity));
    }
    await this.addToCartButton.click();
    await this.page.waitForSelector('[data-testid="cart-notification"]');
  }

  async selectVariant(option: string) {
    await this.variantSelector.selectOption(option);
  }

  async getPrice(): Promise<number> {
    const priceText = await this.priceDisplay.textContent();
    return parseFloat(priceText?.replace(/[^\d.]/g, '') || '0');
  }
}
```

```typescript
// tests/e2e/pages/checkout.page.ts
import { Page, Locator, expect } from '@playwright/test';

export class CheckoutPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly phoneInput: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly citySelect: Locator;
  readonly warehouseSelect: Locator;
  readonly paymentMethod: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.phoneInput = page.getByLabel('Телефон');
    this.firstNameInput = page.getByLabel("Ім'я");
    this.lastNameInput = page.getByLabel('Прізвище');
    this.citySelect = page.getByLabel('Місто');
    this.warehouseSelect = page.getByLabel('Відділення');
    this.paymentMethod = page.getByTestId('payment-method');
    this.submitButton = page.getByRole('button', { name: /оформити замовлення/i });
  }

  async fillContactInfo(data: { email: string; phone: string; firstName: string; lastName: string }) {
    await this.emailInput.fill(data.email);
    await this.phoneInput.fill(data.phone);
    await this.firstNameInput.fill(data.firstName);
    await this.lastNameInput.fill(data.lastName);
  }

  async selectDelivery(city: string, warehouse: string) {
    await this.citySelect.fill(city);
    await this.page.getByRole('option', { name: city }).first().click();

    await this.warehouseSelect.click();
    await this.page.getByRole('option', { name: new RegExp(warehouse) }).first().click();
  }

  async selectPaymentMethod(method: 'liqpay' | 'cod' | 'card') {
    await this.paymentMethod.getByRole('radio', { name: method }).check();
  }

  async submit() {
    await this.submitButton.click();
  }

  async expectOrderConfirmation() {
    await expect(this.page.getByText(/замовлення оформлено/i)).toBeVisible();
  }
}
```

## Test Fixtures

```typescript
// tests/e2e/fixtures/auth.fixture.ts
import { test as base, Page } from '@playwright/test';

type AuthFixtures = {
  authenticatedPage: Page;
  adminPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Login as regular user
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Пароль').fill('password123');
    await page.getByRole('button', { name: /увійти/i }).click();
    await page.waitForURL('/');

    await use(page);
  },

  adminPage: async ({ page }, use) => {
    // Login as admin
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill('admin@shop.ua');
    await page.getByLabel('Пароль').fill('admin_password');
    await page.getByRole('button', { name: /увійти/i }).click();
    await page.waitForURL('/admin/dashboard');

    await use(page);
  },
});

export { expect } from '@playwright/test';
```

## Test Examples

### Checkout Flow

```typescript
// tests/e2e/specs/checkout.spec.ts
import { test, expect } from '../fixtures/auth.fixture';
import { ProductPage } from '../pages/product.page';
import { CartPage } from '../pages/cart.page';
import { CheckoutPage } from '../pages/checkout.page';

test.describe('Checkout Flow', () => {
  test('should complete checkout as guest', async ({ page }) => {
    const productPage = new ProductPage(page);
    const cartPage = new CartPage(page);
    const checkoutPage = new CheckoutPage(page);

    // Add product to cart
    await productPage.goto('iphone-15-pro');
    await productPage.addToCart(1);

    // Go to cart
    await page.goto('/cart');
    await expect(cartPage.itemsCount).toHaveText('1');

    // Proceed to checkout
    await cartPage.proceedToCheckout();

    // Fill checkout form
    await checkoutPage.fillContactInfo({
      email: 'test@example.com',
      phone: '+380501234567',
      firstName: 'Іван',
      lastName: 'Петренко',
    });

    await checkoutPage.selectDelivery('Київ', 'Відділення №1');
    await checkoutPage.selectPaymentMethod('cod');

    // Submit order
    await checkoutPage.submit();

    // Verify confirmation
    await checkoutPage.expectOrderConfirmation();
    await expect(page.getByTestId('order-number')).toBeVisible();
  });

  test('should apply promo code', async ({ page }) => {
    const cartPage = new CartPage(page);

    // Add product
    await page.goto('/products/test-product');
    await page.getByRole('button', { name: /додати в кошик/i }).click();

    // Go to cart
    await page.goto('/cart');

    // Apply promo code
    await cartPage.applyPromoCode('DISCOUNT10');

    // Verify discount applied
    await expect(cartPage.discountAmount).toContainText('-10%');
  });

  test('should validate required fields', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    // Add product and go to checkout
    await page.goto('/products/test-product');
    await page.getByRole('button', { name: /додати в кошик/i }).click();
    await page.goto('/checkout');

    // Try to submit empty form
    await checkoutPage.submit();

    // Verify validation errors
    await expect(page.getByText(/email обов'язковий/i)).toBeVisible();
    await expect(page.getByText(/телефон обов'язковий/i)).toBeVisible();
  });
});
```

### Authentication Tests

```typescript
// tests/e2e/specs/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/auth/login');

    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Пароль').fill('password123');
    await page.getByRole('button', { name: /увійти/i }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('user-menu')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Пароль').fill('wrongpassword');
    await page.getByRole('button', { name: /увійти/i }).click();

    await expect(page.getByText(/невірний email або пароль/i)).toBeVisible();
  });

  test('should register new user', async ({ page }) => {
    await page.goto('/auth/register');

    await page.getByLabel('Email').fill(`test${Date.now()}@example.com`);
    await page.getByLabel('Пароль').fill('SecurePass123!');
    await page.getByLabel('Підтвердіть пароль').fill('SecurePass123!');
    await page.getByLabel("Ім'я").fill('Тест');
    await page.getByLabel('Прізвище').fill('Юзер');

    await page.getByRole('button', { name: /зареєструватися/i }).click();

    await expect(page.getByText(/реєстрація успішна/i)).toBeVisible();
  });
});
```

### Visual Testing

```typescript
// tests/e2e/specs/visual.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('homepage should match snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      mask: [page.locator('[data-testid="dynamic-content"]')],
    });
  });

  test('product page should match snapshot', async ({ page }) => {
    await page.goto('/products/test-product');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('product-page.png');
  });

  test('checkout page should match snapshot', async ({ page }) => {
    // Setup cart
    await page.goto('/products/test-product');
    await page.getByRole('button', { name: /додати в кошик/i }).click();
    await page.goto('/checkout');

    await expect(page).toHaveScreenshot('checkout.png', {
      mask: [page.locator('[data-testid="cart-total"]')],
    });
  });
});
```

## CI Integration

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps

      - name: Build application
        run: npm run build

      - name: Run E2E tests
        run: npx playwright test
        env:
          BASE_URL: http://localhost:3000

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## Running Tests

```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test tests/e2e/specs/checkout.spec.ts

# Run in headed mode
npx playwright test --headed

# Run specific browser
npx playwright test --project=chromium

# Run with UI mode
npx playwright test --ui

# Update snapshots
npx playwright test --update-snapshots

# Generate report
npx playwright show-report
```

## See Also

- [Testing Guide](./TESTING.md)
- [Load Testing](./LOAD_TESTING.md)
- [CI/CD Pipeline](./CI_CD_PIPELINE.md)
