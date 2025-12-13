import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to homepage
        await page.goto('/');
    });

    test('should complete full checkout flow', async ({ page }) => {
        // 1. Browse products
        await page.click('text=0B0;>3');
        await expect(page).toHaveURL(/\/catalog/);

        // 2. Select a product
        await page.click('.product-card:first-child');
        await expect(page.locator('h1')).toBeVisible();

        // 3. Add to cart
        await page.click('text=>40B8 2 :>H8:');
        await expect(page.locator('.cart-count')).toHaveText('1');

        // 4. Go to cart
        await page.click('[data-testid="cart-icon"]');
        await expect(page).toHaveURL('/cart');

        // 5. Verify cart items
        await expect(page.locator('.cart-item')).toHaveCount(1);
        await expect(page.locator('[data-testid="cart-total"]')).toBeVisible();

        // 6. Proceed to checkout
        await page.click('text=D>@<8B8 70<>2;5==O');
        await expect(page).toHaveURL('/checkout');

        // 7. Fill shipping info
        await page.fill('[name="firstName"]', '20=');
        await page.fill('[name="lastName"]', '5B@5=:>');
        await page.fill('[name="phone"]', '+380501234567');
        await page.fill('[name="email"]', 'ivan@example.com');

        // 8. Select delivery method
        await page.click('text=>20 >HB0');
        await page.fill('[name="city"]', '8W2');
        await page.click('.city-suggestion:first-child');
        await page.selectOption('[name="warehouse"]', { index: 1 });

        // 9. Select payment method
        await page.click('text=?;0B0 ?@8 >B@8<0==V');

        // 10. Place order
        await page.click('text=V4B25@48B8 70<>2;5==O');

        // 11. Verify order confirmation
        await expect(page).toHaveURL(/\/order-confirmation/);
        await expect(page.locator('text=O:CT<> 70 70<>2;5==O!')).toBeVisible();
        await expect(page.locator('[data-testid="order-number"]')).toBeVisible();
    });

    test('should show validation errors for empty fields', async ({ page }) => {
        // Navigate directly to checkout
        await page.goto('/checkout');

        // Try to submit without filling required fields
        await page.click('text=V4B25@48B8 70<>2;5==O');

        // Verify validation errors
        await expect(page.locator('text=254VBL V<\'O')).toBeVisible();
        await expect(page.locator('text=254VBL ?@V728I5')).toBeVisible();
        await expect(page.locator('text=254VBL B5;5D>=')).toBeVisible();
    });

    test('should apply promo code', async ({ page }) => {
        // Add product to cart first
        await page.goto('/product/test-product');
        await page.click('text=>40B8 2 :>H8:');

        // Go to cart
        await page.goto('/cart');

        // Apply promo code
        await page.fill('[data-testid="promo-input"]', 'TESTCODE10');
        await page.click('text=0AB>AC20B8');

        // Verify discount applied
        await expect(page.locator('[data-testid="discount-amount"]')).toBeVisible();
        await expect(page.locator('text=-10%')).toBeVisible();
    });

    test('should update cart quantities', async ({ page }) => {
        // Add product to cart
        await page.goto('/product/test-product');
        await page.click('text=>40B8 2 :>H8:');

        // Go to cart
        await page.goto('/cart');

        // Increase quantity
        await page.click('[data-testid="qty-increase"]');
        await expect(page.locator('[data-testid="qty-input"]')).toHaveValue('2');

        // Decrease quantity
        await page.click('[data-testid="qty-decrease"]');
        await expect(page.locator('[data-testid="qty-input"]')).toHaveValue('1');
    });

    test('should remove item from cart', async ({ page }) => {
        // Add product to cart
        await page.goto('/product/test-product');
        await page.click('text=>40B8 2 :>H8:');

        // Go to cart
        await page.goto('/cart');

        // Remove item
        await page.click('[data-testid="remove-item"]');

        // Verify empty cart
        await expect(page.locator('text=>H8: ?>@>6=V9')).toBeVisible();
    });

    test('should persist cart across sessions', async ({ page, context }) => {
        // Add product to cart
        await page.goto('/product/test-product');
        await page.click('text=>40B8 2 :>H8:');

        // Get cart cookie/storage
        const cookies = await context.cookies();
        const cartCookie = cookies.find(c => c.name === 'cart');

        // Create new page (simulating new session)
        const newPage = await context.newPage();
        await newPage.goto('/cart');

        // Verify cart is preserved
        await expect(newPage.locator('.cart-item')).toHaveCount(1);

        await newPage.close();
    });
});

test.describe('Guest Checkout', () => {
    test('should allow guest checkout', async ({ page }) => {
        // Add product and go to checkout
        await page.goto('/product/test-product');
        await page.click('text=>40B8 2 :>H8:');
        await page.goto('/checkout');

        // Verify guest checkout option
        await expect(page.locator('text=@>4>268B8 157 @5TAB@0FVW')).toBeVisible();

        // Continue as guest
        await page.click('text=@>4>268B8 157 @5TAB@0FVW');

        // Fill guest info
        await page.fill('[name="firstName"]', 'VABL');
        await page.fill('[name="lastName"]', '>@8ABC20G');
        await page.fill('[name="phone"]', '+380501234567');
        await page.fill('[name="email"]', 'guest@example.com');

        // Verify checkout form is accessible
        await expect(page.locator('[name="city"]')).toBeEnabled();
    });
});

test.describe('Payment Integration', () => {
    test('should show available payment methods', async ({ page }) => {
        await page.goto('/checkout');

        // Verify payment options
        await expect(page.locator('text=?;0B0 ?@8 >B@8<0==V')).toBeVisible();
        await expect(page.locator('text=0@B:>N >=;09=')).toBeVisible();
        await expect(page.locator('text=?;0B0 G0AB8=0<8')).toBeVisible();
    });

    test('should show LiqPay form for card payment', async ({ page }) => {
        await page.goto('/checkout');

        // Select card payment
        await page.click('text=0@B:>N >=;09=');

        // Verify LiqPay integration shows
        await expect(page.locator('[data-testid="liqpay-form"]')).toBeVisible();
    });
});

test.describe('Mobile Checkout', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should work on mobile devices', async ({ page }) => {
        await page.goto('/checkout');

        // Verify mobile layout
        await expect(page.locator('.checkout-mobile')).toBeVisible();

        // Verify touch-friendly elements
        const buttons = page.locator('button');
        for (let i = 0; i < await buttons.count(); i++) {
            const box = await buttons.nth(i).boundingBox();
            if (box) {
                // Minimum touch target size (44x44 recommended)
                expect(box.height).toBeGreaterThanOrEqual(40);
            }
        }
    });
});
