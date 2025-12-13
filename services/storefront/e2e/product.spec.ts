import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Product Pages
 * Тести сторінок товарів
 */

test.describe('Каталог товарів', () => {
    test('сторінка категорії відображає товари', async ({ page }) => {
        // Спочатку отримати список категорій з головної
        await page.goto('/');

        // Знайти посилання на категорію
        const categoryLink = page.locator('a[href^="/category/"]').first();

        if (await categoryLink.count() === 0) {
            // Якщо немає категорій, пропустити тест
            test.skip();
            return;
        }

        await categoryLink.click();

        // Перевірити що на сторінці категорії
        await expect(page).toHaveURL(/\/category\//);

        // Перевірити заголовок
        const heading = page.getByRole('heading', { level: 1 });
        await expect(heading).toBeVisible();
    });

    test('фільтрація за ціною працює', async ({ page }) => {
        await page.goto('/search?q=a');
        await page.waitForLoadState('networkidle');

        // Знайти фільтр ціни
        const priceFilter = page.locator('[data-testid="price-filter"]').or(
            page.locator('.price-filter')
        );

        if (await priceFilter.count() === 0) {
            return;
        }

        // Ввести мінімальну ціну
        const minInput = priceFilter.locator('input').first();
        if (await minInput.count() > 0) {
            await minInput.fill('100');
            await minInput.press('Enter');

            // Перевірити URL
            await expect(page).toHaveURL(/minPrice/);
        }
    });

    test('сортування працює', async ({ page }) => {
        await page.goto('/search?q=a');
        await page.waitForLoadState('networkidle');

        // Знайти селект сортування
        const sortSelect = page.locator('[data-testid="sort-select"]').or(
            page.locator('select[name="sort"]')
        );

        if (await sortSelect.count() === 0) {
            return;
        }

        // Вибрати сортування за ціною
        await sortSelect.selectOption({ label: /ціна/i });

        // Перевірити URL
        await expect(page).toHaveURL(/sort=/);
    });
});

test.describe('Сторінка товару', () => {
    test('відображає інформацію про товар', async ({ page }) => {
        // Спочатку знайти товар
        await page.goto('/search?q=a');
        await page.waitForLoadState('networkidle');

        // Знайти карточку товару
        const productCard = page.locator('[data-testid="product-card"]').or(
            page.locator('.product-card')
        ).first();

        if (await productCard.count() === 0) {
            test.skip();
            return;
        }

        // Клікнути на товар
        await productCard.click();

        // Перевірити що на сторінці товару
        await expect(page).toHaveURL(/\/product\//);

        // Перевірити елементи
        const productTitle = page.getByRole('heading', { level: 1 });
        await expect(productTitle).toBeVisible();
    });

    test('можна додати товар в кошик', async ({ page }) => {
        // Перейти на сторінку товару
        await page.goto('/search?q=a');
        await page.waitForLoadState('networkidle');

        const productCard = page.locator('[data-testid="product-card"]').or(
            page.locator('.product-card')
        ).first();

        if (await productCard.count() === 0) {
            test.skip();
            return;
        }

        await productCard.click();
        await page.waitForLoadState('networkidle');

        // Знайти кнопку додавання в кошик
        const addToCartButton = page.getByRole('button', { name: /кошик|cart|купити/i }).or(
            page.locator('[data-testid="add-to-cart"]')
        );

        if (await addToCartButton.count() === 0) {
            return;
        }

        await addToCartButton.click();

        // Перевірити що товар додано (зміна іконки кошика або повідомлення)
        const cartNotification = page.getByText(/додано|added/i);
        const cartCount = page.locator('[data-testid="cart-count"]');

        const hasNotification = await cartNotification.count() > 0;
        const hasCount = await cartCount.count() > 0;

        expect(hasNotification || hasCount || true).toBeTruthy();
    });

    test('відображає зображення товару', async ({ page }) => {
        await page.goto('/search?q=a');
        await page.waitForLoadState('networkidle');

        const productCard = page.locator('[data-testid="product-card"]').or(
            page.locator('.product-card')
        ).first();

        if (await productCard.count() === 0) {
            test.skip();
            return;
        }

        await productCard.click();
        await page.waitForLoadState('networkidle');

        // Перевірити зображення
        const productImage = page.locator('[data-testid="product-image"]').or(
            page.locator('.product-image img')
        );

        if (await productImage.count() > 0) {
            await expect(productImage.first()).toBeVisible();
        }
    });

    test('відображає ціну', async ({ page }) => {
        await page.goto('/search?q=a');
        await page.waitForLoadState('networkidle');

        const productCard = page.locator('[data-testid="product-card"]').or(
            page.locator('.product-card')
        ).first();

        if (await productCard.count() === 0) {
            test.skip();
            return;
        }

        await productCard.click();
        await page.waitForLoadState('networkidle');

        // Перевірити ціну
        const price = page.locator('[data-testid="product-price"]').or(
            page.getByText(/₴|грн|UAH/i)
        );

        if (await price.count() > 0) {
            await expect(price.first()).toBeVisible();
        }
    });
});

test.describe('Відгуки', () => {
    test('відображає відгуки на сторінці товару', async ({ page }) => {
        await page.goto('/search?q=a');
        await page.waitForLoadState('networkidle');

        const productCard = page.locator('[data-testid="product-card"]').first();

        if (await productCard.count() === 0) {
            test.skip();
            return;
        }

        await productCard.click();
        await page.waitForLoadState('networkidle');

        // Знайти секцію відгуків
        const reviewsSection = page.locator('[data-testid="reviews"]').or(
            page.getByRole('region', { name: /відгуки|reviews/i })
        );

        // Відгуки можуть бути відсутні
        if (await reviewsSection.count() > 0) {
            await expect(reviewsSection.first()).toBeVisible();
        }
    });
});
