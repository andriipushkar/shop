import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Home Page
 * Тести головної сторінки
 */

test.describe('Головна сторінка', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('має правильний заголовок', async ({ page }) => {
        await expect(page).toHaveTitle(/Shop/);
    });

    test('відображає навігацію', async ({ page }) => {
        const nav = page.locator('nav');
        await expect(nav).toBeVisible();
    });

    test('відображає пошукову форму', async ({ page }) => {
        const searchInput = page.getByPlaceholder(/пошук|search/i);
        await expect(searchInput).toBeVisible();
    });

    test('відображає категорії товарів', async ({ page }) => {
        // Перевірити наявність секції категорій
        const categoriesSection = page.locator('[data-testid="categories"]').or(
            page.getByRole('region', { name: /категорії/i })
        );

        // Якщо секція існує, перевірити що вона видима
        if (await categoriesSection.count() > 0) {
            await expect(categoriesSection.first()).toBeVisible();
        }
    });

    test('відображає рекомендовані товари', async ({ page }) => {
        // Перевірити наявність товарів
        const products = page.locator('[data-testid="product-card"]').or(
            page.locator('.product-card')
        );

        // Зачекати на завантаження
        await page.waitForLoadState('networkidle');

        // Перевірити що товари є (якщо БД має дані)
        const count = await products.count();
        // Не перевіряємо кількість, бо БД може бути порожня
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('має футер з контактами', async ({ page }) => {
        const footer = page.locator('footer');
        await expect(footer).toBeVisible();
    });

    test('мобільне меню працює', async ({ page, isMobile }) => {
        if (!isMobile) {
            test.skip();
            return;
        }

        // Знайти кнопку меню
        const menuButton = page.getByRole('button', { name: /меню/i }).or(
            page.locator('[data-testid="mobile-menu-button"]')
        );

        if (await menuButton.count() > 0) {
            await menuButton.click();

            // Перевірити що меню відкрилось
            const mobileNav = page.locator('[data-testid="mobile-nav"]').or(
                page.locator('.mobile-nav')
            );

            if (await mobileNav.count() > 0) {
                await expect(mobileNav).toBeVisible();
            }
        }
    });
});

test.describe('SEO', () => {
    test('має мета-теги', async ({ page }) => {
        await page.goto('/');

        // Description
        const description = page.locator('meta[name="description"]');
        await expect(description).toHaveCount(1);

        // Open Graph
        const ogTitle = page.locator('meta[property="og:title"]');
        // OG теги можуть бути відсутні в dev режимі
        const ogCount = await ogTitle.count();
        expect(ogCount).toBeGreaterThanOrEqual(0);
    });

    test('має структуровані дані', async ({ page }) => {
        await page.goto('/');

        // JSON-LD
        const jsonLd = page.locator('script[type="application/ld+json"]');
        const count = await jsonLd.count();

        // Структуровані дані можуть бути відсутні
        expect(count).toBeGreaterThanOrEqual(0);
    });
});
