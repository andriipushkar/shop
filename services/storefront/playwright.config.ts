import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * Конфігурація для E2E тестування Shop Storefront
 * @see https://playwright.dev/docs/test-configuration
 */

const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

export default defineConfig({
    // Директорія з тестами
    testDir: './e2e',

    // Таймаут для кожного тесту
    timeout: 30 * 1000,

    // Очікувати assertion
    expect: {
        timeout: 5000,
    },

    // Виконання тестів паралельно
    fullyParallel: true,

    // Зупинитись на першій помилці в CI
    forbidOnly: !!process.env.CI,

    // Кількість повторів при падінні
    retries: process.env.CI ? 2 : 0,

    // Кількість паралельних workers
    workers: process.env.CI ? 1 : undefined,

    // Reporter для звітів
    reporter: [
        ['html', { outputFolder: 'playwright-report' }],
        ['json', { outputFile: 'playwright-report/results.json' }],
        ['list'],
    ],

    // Глобальні налаштування
    use: {
        // Базова URL
        baseURL,

        // Робити скріншоти при падінні
        screenshot: 'only-on-failure',

        // Записувати trace при повторі
        trace: 'on-first-retry',

        // Записувати відео при падінні
        video: 'on-first-retry',

        // Ігнорувати HTTPS помилки
        ignoreHTTPSErrors: true,

        // Локаль
        locale: 'uk-UA',

        // Таймзона
        timezoneId: 'Europe/Kyiv',
    },

    // Конфігурація для різних браузерів
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
            },
        },
        {
            name: 'firefox',
            use: {
                ...devices['Desktop Firefox'],
            },
        },
        {
            name: 'webkit',
            use: {
                ...devices['Desktop Safari'],
            },
        },
        // Мобільні пристрої
        {
            name: 'mobile-chrome',
            use: {
                ...devices['Pixel 5'],
            },
        },
        {
            name: 'mobile-safari',
            use: {
                ...devices['iPhone 12'],
            },
        },
    ],

    // Запустити dev сервер перед тестами
    webServer: {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});
