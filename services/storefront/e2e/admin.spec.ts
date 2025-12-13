import { test, expect } from '@playwright/test';

test.describe('Admin Panel', () => {
    test.beforeEach(async ({ page }) => {
        // Login as admin (assuming auth setup)
        await page.goto('/admin');
    });

    test.describe('Dashboard', () => {
        test('should display dashboard stats', async ({ page }) => {
            await page.goto('/admin');

            // Verify dashboard elements
            await expect(page.locator('text=0H1>@4')).toBeVisible();
            await expect(page.locator('[data-testid="total-revenue"]')).toBeVisible();
            await expect(page.locator('[data-testid="total-orders"]')).toBeVisible();
            await expect(page.locator('[data-testid="new-customers"]')).toBeVisible();
        });

        test('should show revenue chart', async ({ page }) => {
            await page.goto('/admin');

            await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible();
        });

        test('should show recent orders', async ({ page }) => {
            await page.goto('/admin');

            await expect(page.locator('[data-testid="recent-orders"]')).toBeVisible();
            await expect(page.locator('.order-row')).toHaveCount(5);
        });
    });

    test.describe('Products Management', () => {
        test('should list products', async ({ page }) => {
            await page.goto('/admin/products');

            await expect(page.locator('h1')).toContainText('">20@8');
            await expect(page.locator('[data-testid="products-table"]')).toBeVisible();
        });

        test('should search products', async ({ page }) => {
            await page.goto('/admin/products');

            await page.fill('[data-testid="search-input"]', 'iPhone');
            await page.press('[data-testid="search-input"]', 'Enter');

            await expect(page.locator('.product-row')).toHaveCount(1);
            await expect(page.locator('.product-row')).toContainText('iPhone');
        });

        test('should filter by category', async ({ page }) => {
            await page.goto('/admin/products');

            await page.selectOption('[data-testid="category-filter"]', 'electronics');

            await expect(page.locator('.product-row')).toBeVisible();
        });

        test('should create new product', async ({ page }) => {
            await page.goto('/admin/products/new');

            // Fill product form
            await page.fill('[name="name"]', 'Test Product');
            await page.fill('[name="nameUa"]', '"5AB>289 B>20@');
            await page.fill('[name="price"]', '1000');
            await page.fill('[name="sku"]', 'TEST-001');
            await page.selectOption('[name="categoryId"]', { index: 1 });

            // Add description
            await page.fill('[name="description"]', 'Test description');

            // Upload image
            const fileInput = page.locator('input[type="file"]');
            await fileInput.setInputFiles('./e2e/fixtures/test-image.jpg');

            // Save product
            await page.click('text=15@53B8');

            // Verify redirect to products list
            await expect(page).toHaveURL('/admin/products');
            await expect(page.locator('text=">20@ CA?VH=> AB2>@5=>')).toBeVisible();
        });

        test('should edit product', async ({ page }) => {
            await page.goto('/admin/products');

            // Click edit on first product
            await page.click('.product-row:first-child [data-testid="edit-button"]');

            // Modify product
            await page.fill('[name="price"]', '2000');

            // Save
            await page.click('text=15@53B8');

            await expect(page.locator('text=">20@ CA?VH=> >=>2;5=>')).toBeVisible();
        });

        test('should delete product', async ({ page }) => {
            await page.goto('/admin/products');

            // Click delete on first product
            await page.click('.product-row:first-child [data-testid="delete-button"]');

            // Confirm deletion
            await page.click('text=V4B25@48B8');

            await expect(page.locator('text=">20@ CA?VH=> 2840;5=>')).toBeVisible();
        });
    });

    test.describe('Orders Management', () => {
        test('should list orders', async ({ page }) => {
            await page.goto('/admin/orders');

            await expect(page.locator('h1')).toContainText('0<>2;5==O');
            await expect(page.locator('[data-testid="orders-table"]')).toBeVisible();
        });

        test('should filter orders by status', async ({ page }) => {
            await page.goto('/admin/orders');

            await page.click('[data-testid="status-filter-new"]');

            await expect(page.locator('.order-row')).toBeVisible();
            await expect(page.locator('.order-row .status-badge')).toContainText('>289');
        });

        test('should view order details', async ({ page }) => {
            await page.goto('/admin/orders');

            await page.click('.order-row:first-child [data-testid="view-button"]');

            await expect(page.locator('[data-testid="order-details"]')).toBeVisible();
            await expect(page.locator('[data-testid="customer-info"]')).toBeVisible();
            await expect(page.locator('[data-testid="order-items"]')).toBeVisible();
        });

        test('should update order status', async ({ page }) => {
            await page.goto('/admin/orders');

            await page.click('.order-row:first-child [data-testid="view-button"]');

            await page.selectOption('[data-testid="status-select"]', 'processing');
            await page.click('text==>28B8 AB0BCA');

            await expect(page.locator('text=!B0BCA >=>2;5=>')).toBeVisible();
        });
    });

    test.describe('Analytics', () => {
        test('should display analytics page', async ({ page }) => {
            await page.goto('/admin/analytics');

            await expect(page.locator('h1')).toContainText('=0;VB8:0');
        });

        test('should show period selector', async ({ page }) => {
            await page.goto('/admin/analytics');

            await page.selectOption('[data-testid="period-select"]', 'month');

            // Verify charts update
            await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible();
        });

        test('should export analytics report', async ({ page }) => {
            await page.goto('/admin/analytics');

            // Start download
            const [download] = await Promise.all([
                page.waitForEvent('download'),
                page.click('text=:A?>@BC20B8'),
            ]);

            // Verify download
            expect(download.suggestedFilename()).toContain('analytics');
        });
    });

    test.describe('Marketplaces', () => {
        test('should display marketplace connections', async ({ page }) => {
            await page.goto('/admin/marketplaces');

            await expect(page.locator('h1')).toContainText('0@:5B?;59A8');
            await expect(page.locator('text=Rozetka')).toBeVisible();
            await expect(page.locator('text=Prom.ua')).toBeVisible();
        });

        test('should show sync status', async ({ page }) => {
            await page.goto('/admin/marketplaces');

            await expect(page.locator('[data-testid="rozetka-status"]')).toBeVisible();
            await expect(page.locator('[data-testid="prom-status"]')).toBeVisible();
        });

        test('should trigger manual sync', async ({ page }) => {
            await page.goto('/admin/marketplaces');

            await page.click('[data-testid="sync-rozetka"]');

            await expect(page.locator('text=!8=E@>=V70FVO ?>G0;0AL')).toBeVisible();
        });

        test('should show marketplace orders', async ({ page }) => {
            await page.goto('/admin/marketplaces');

            await page.click('text=0<>2;5==O');

            await expect(page.locator('[data-testid="marketplace-orders"]')).toBeVisible();
        });
    });

    test.describe('CMS', () => {
        test('should list CMS pages', async ({ page }) => {
            await page.goto('/admin/cms');

            await expect(page.locator('h1')).toContainText('>=B5=B');
            await expect(page.locator('[data-testid="pages-table"]')).toBeVisible();
        });

        test('should create new page', async ({ page }) => {
            await page.goto('/admin/cms');

            await page.click('text=>40B8 AB>@V=:C');

            await page.fill('[name="title"]', 'Test Page');
            await page.fill('[name="slug"]', 'test-page');
            await page.fill('[name="content"]', 'Test content');

            await page.click('text=15@53B8');

            await expect(page.locator('text=!B>@V=:C AB2>@5=>')).toBeVisible();
        });

        test('should manage banners', async ({ page }) => {
            await page.goto('/admin/cms');

            await page.click('text=0=5@8');

            await expect(page.locator('[data-testid="banners-grid"]')).toBeVisible();
        });
    });

    test.describe('Bulk Operations', () => {
        test('should display bulk operations page', async ({ page }) => {
            await page.goto('/admin/bulk');

            await expect(page.locator('h1')).toContainText('0A>2V >?5@0FVW');
        });

        test('should show import form', async ({ page }) => {
            await page.goto('/admin/bulk');

            await expect(page.locator('[data-testid="import-dropzone"]')).toBeVisible();
        });

        test('should show export options', async ({ page }) => {
            await page.goto('/admin/bulk');

            await page.click('text=:A?>@B');

            await expect(page.locator('[data-testid="export-form"]')).toBeVisible();
            await expect(page.locator('[data-testid="entity-select"]')).toBeVisible();
        });

        test('should download export template', async ({ page }) => {
            await page.goto('/admin/bulk');

            const [download] = await Promise.all([
                page.waitForEvent('download'),
                page.click('text=020=B068B8 H01;>='),
            ]);

            expect(download.suggestedFilename()).toContain('template');
        });
    });
});

test.describe('Admin Authentication', () => {
    test('should redirect to login when not authenticated', async ({ page }) => {
        // Clear auth state
        await page.context().clearCookies();

        await page.goto('/admin');

        await expect(page).toHaveURL(/\/login/);
    });

    test('should login with valid credentials', async ({ page }) => {
        await page.goto('/admin/login');

        await page.fill('[name="email"]', 'admin@example.com');
        await page.fill('[name="password"]', 'admin123');
        await page.click('text=#2V9B8');

        await expect(page).toHaveURL('/admin');
    });

    test('should show error with invalid credentials', async ({ page }) => {
        await page.goto('/admin/login');

        await page.fill('[name="email"]', 'wrong@example.com');
        await page.fill('[name="password"]', 'wrongpass');
        await page.click('text=#2V9B8');

        await expect(page.locator('text=52V@=V 40=V 4;O 2E>4C')).toBeVisible();
    });

    test('should logout', async ({ page }) => {
        await page.goto('/admin');

        await page.click('[data-testid="user-menu"]');
        await page.click('text=89B8');

        await expect(page).toHaveURL(/\/login/);
    });
});

test.describe('Admin Responsive', () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test('should show mobile menu on tablet', async ({ page }) => {
        await page.goto('/admin');

        await expect(page.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible();
    });

    test('should toggle sidebar on mobile', async ({ page }) => {
        await page.goto('/admin');

        await page.click('[data-testid="mobile-menu-toggle"]');

        await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    });
});
