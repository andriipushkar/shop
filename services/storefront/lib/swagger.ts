/**
 * OpenAPI/Swagger Configuration
 * Документація API для Shop Storefront
 */

import { createSwaggerSpec } from 'next-swagger-doc';

export const getApiDocs = () => {
    const spec = createSwaggerSpec({
        apiFolder: 'app/api',
        definition: {
            openapi: '3.0.0',
            info: {
                title: 'Shop Storefront API',
                version: '1.0.0',
                description: `
# Shop Storefront API

API для українського e-commerce магазину.

## Автентифікація

API використовує JWT токени через NextAuth.js. Для доступу до адмін-ендпоінтів потрібна роль ADMIN, MANAGER або WAREHOUSE.

## Ролі користувачів

- **ADMIN** - Повний доступ до всіх ресурсів
- **MANAGER** - Управління товарами, замовленнями, клієнтами
- **WAREHOUSE** - Доступ до складських операцій та замовлень (тільки читання)
- **SUPPORT** - Доступ до клієнтів та замовлень
- **CUSTOMER** - Публічний доступ + особистий кабінет

## Кешування

API використовує Redis для кешування. Заголовок \`X-Cache\` вказує на статус кешу:
- \`HIT\` - Дані з кешу
- \`MISS\` - Свіжі дані з БД
                `,
                contact: {
                    name: 'Shop Support',
                    email: 'support@shop.ua',
                },
                license: {
                    name: 'MIT',
                    url: 'https://opensource.org/licenses/MIT',
                },
            },
            servers: [
                {
                    url: 'http://localhost:3000',
                    description: 'Development server',
                },
                {
                    url: 'https://api.shop.ua',
                    description: 'Production server',
                },
            ],
            tags: [
                {
                    name: 'Products',
                    description: 'Операції з товарами',
                },
                {
                    name: 'Categories',
                    description: 'Операції з категоріями',
                },
                {
                    name: 'Orders',
                    description: 'Операції з замовленнями',
                },
                {
                    name: 'Customers',
                    description: 'Операції з клієнтами',
                },
                {
                    name: 'Search',
                    description: 'Пошук товарів',
                },
                {
                    name: 'Webhooks',
                    description: 'Вебхуки платіжних систем та маркетплейсів',
                },
                {
                    name: 'Admin',
                    description: 'Адміністративні ендпоінти',
                },
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                    },
                    cookieAuth: {
                        type: 'apiKey',
                        in: 'cookie',
                        name: 'next-auth.session-token',
                    },
                },
                schemas: {
                    Error: {
                        type: 'object',
                        properties: {
                            error: {
                                type: 'string',
                                description: 'Повідомлення про помилку',
                            },
                        },
                        required: ['error'],
                    },
                    Pagination: {
                        type: 'object',
                        properties: {
                            page: {
                                type: 'integer',
                                description: 'Поточна сторінка',
                                example: 1,
                            },
                            pageSize: {
                                type: 'integer',
                                description: 'Кількість елементів на сторінці',
                                example: 20,
                            },
                            total: {
                                type: 'integer',
                                description: 'Загальна кількість елементів',
                            },
                            totalPages: {
                                type: 'integer',
                                description: 'Загальна кількість сторінок',
                            },
                        },
                    },
                    Product: {
                        type: 'object',
                        properties: {
                            id: {
                                type: 'string',
                                format: 'uuid',
                            },
                            sku: {
                                type: 'string',
                                description: 'Артикул товару',
                                example: 'SKU-001',
                            },
                            name: {
                                type: 'string',
                                description: 'Назва англійською',
                            },
                            nameUa: {
                                type: 'string',
                                description: 'Назва українською',
                            },
                            slug: {
                                type: 'string',
                                description: 'URL-friendly ідентифікатор',
                            },
                            description: {
                                type: 'string',
                                nullable: true,
                            },
                            descriptionUa: {
                                type: 'string',
                                nullable: true,
                            },
                            price: {
                                type: 'number',
                                format: 'decimal',
                                description: 'Ціна в гривнях',
                            },
                            compareAtPrice: {
                                type: 'number',
                                format: 'decimal',
                                nullable: true,
                                description: 'Стара ціна для відображення знижки',
                            },
                            status: {
                                type: 'string',
                                enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
                            },
                            categoryId: {
                                type: 'string',
                                format: 'uuid',
                            },
                            brandId: {
                                type: 'string',
                                format: 'uuid',
                                nullable: true,
                            },
                            images: {
                                type: 'array',
                                items: {
                                    type: 'string',
                                },
                            },
                            viewCount: {
                                type: 'integer',
                            },
                            soldCount: {
                                type: 'integer',
                            },
                            isFeatured: {
                                type: 'boolean',
                            },
                            isNew: {
                                type: 'boolean',
                            },
                            createdAt: {
                                type: 'string',
                                format: 'date-time',
                            },
                            updatedAt: {
                                type: 'string',
                                format: 'date-time',
                            },
                        },
                        required: ['id', 'sku', 'name', 'nameUa', 'slug', 'price', 'status', 'categoryId'],
                    },
                    ProductCreateInput: {
                        type: 'object',
                        properties: {
                            sku: {
                                type: 'string',
                            },
                            name: {
                                type: 'string',
                            },
                            nameUa: {
                                type: 'string',
                            },
                            slug: {
                                type: 'string',
                            },
                            description: {
                                type: 'string',
                            },
                            descriptionUa: {
                                type: 'string',
                            },
                            price: {
                                type: 'number',
                            },
                            compareAtPrice: {
                                type: 'number',
                            },
                            categoryId: {
                                type: 'string',
                            },
                            brandId: {
                                type: 'string',
                            },
                            images: {
                                type: 'array',
                                items: {
                                    type: 'string',
                                },
                            },
                            isFeatured: {
                                type: 'boolean',
                            },
                            isNew: {
                                type: 'boolean',
                            },
                        },
                        required: ['sku', 'name', 'nameUa', 'slug', 'price', 'categoryId'],
                    },
                    Category: {
                        type: 'object',
                        properties: {
                            id: {
                                type: 'string',
                                format: 'uuid',
                            },
                            name: {
                                type: 'string',
                            },
                            nameUa: {
                                type: 'string',
                            },
                            slug: {
                                type: 'string',
                            },
                            description: {
                                type: 'string',
                                nullable: true,
                            },
                            image: {
                                type: 'string',
                                nullable: true,
                            },
                            parentId: {
                                type: 'string',
                                format: 'uuid',
                                nullable: true,
                            },
                            isActive: {
                                type: 'boolean',
                            },
                            sortOrder: {
                                type: 'integer',
                            },
                        },
                        required: ['id', 'name', 'nameUa', 'slug'],
                    },
                    Order: {
                        type: 'object',
                        properties: {
                            id: {
                                type: 'string',
                                format: 'uuid',
                            },
                            orderNumber: {
                                type: 'string',
                                description: 'Номер замовлення у форматі YYYYMM-XXXXX',
                                example: '202401-00001',
                            },
                            status: {
                                type: 'string',
                                enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'],
                            },
                            paymentStatus: {
                                type: 'string',
                                enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
                            },
                            paymentMethod: {
                                type: 'string',
                                enum: ['CARD', 'CASH', 'LIQPAY', 'PRIVAT24'],
                                nullable: true,
                            },
                            shippingMethod: {
                                type: 'string',
                                enum: ['NOVA_POSHTA', 'UKR_POSHTA', 'SELF_PICKUP', 'COURIER'],
                                nullable: true,
                            },
                            subtotal: {
                                type: 'number',
                            },
                            discount: {
                                type: 'number',
                            },
                            shippingCost: {
                                type: 'number',
                            },
                            total: {
                                type: 'number',
                            },
                            customerName: {
                                type: 'string',
                            },
                            customerEmail: {
                                type: 'string',
                                format: 'email',
                            },
                            customerPhone: {
                                type: 'string',
                            },
                            items: {
                                type: 'array',
                                items: {
                                    $ref: '#/components/schemas/OrderItem',
                                },
                            },
                            createdAt: {
                                type: 'string',
                                format: 'date-time',
                            },
                            updatedAt: {
                                type: 'string',
                                format: 'date-time',
                            },
                        },
                    },
                    OrderItem: {
                        type: 'object',
                        properties: {
                            id: {
                                type: 'string',
                            },
                            productId: {
                                type: 'string',
                            },
                            sku: {
                                type: 'string',
                            },
                            name: {
                                type: 'string',
                            },
                            price: {
                                type: 'number',
                            },
                            quantity: {
                                type: 'integer',
                            },
                            total: {
                                type: 'number',
                            },
                        },
                    },
                    Customer: {
                        type: 'object',
                        properties: {
                            id: {
                                type: 'string',
                            },
                            email: {
                                type: 'string',
                                format: 'email',
                            },
                            firstName: {
                                type: 'string',
                            },
                            lastName: {
                                type: 'string',
                            },
                            phone: {
                                type: 'string',
                            },
                            isActive: {
                                type: 'boolean',
                            },
                            totalOrders: {
                                type: 'integer',
                            },
                            totalSpent: {
                                type: 'number',
                            },
                            createdAt: {
                                type: 'string',
                                format: 'date-time',
                            },
                        },
                    },
                    SearchResult: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                            },
                            products: {
                                type: 'array',
                                items: {
                                    $ref: '#/components/schemas/Product',
                                },
                            },
                            total: {
                                type: 'integer',
                            },
                            page: {
                                type: 'integer',
                            },
                            pageSize: {
                                type: 'integer',
                            },
                            totalPages: {
                                type: 'integer',
                            },
                        },
                    },
                },
                responses: {
                    Unauthorized: {
                        description: 'Не авторизовано',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error',
                                },
                                example: {
                                    error: 'Unauthorized',
                                },
                            },
                        },
                    },
                    NotFound: {
                        description: 'Ресурс не знайдено',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error',
                                },
                                example: {
                                    error: 'Not found',
                                },
                            },
                        },
                    },
                    BadRequest: {
                        description: 'Невірний запит',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error',
                                },
                            },
                        },
                    },
                    InternalError: {
                        description: 'Внутрішня помилка сервера',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error',
                                },
                                example: {
                                    error: 'Internal server error',
                                },
                            },
                        },
                    },
                },
            },
            security: [
                {
                    bearerAuth: [],
                },
                {
                    cookieAuth: [],
                },
            ],
        },
    });

    return spec;
};

/**
 * API Paths Documentation
 * Можна додати в коментарі до route handlers
 */
export const apiPaths = {
    // Products
    '/api/products': {
        get: {
            tags: ['Products'],
            summary: 'Отримати список товарів',
            description: 'Повертає пагінований список активних товарів з можливістю фільтрації',
            parameters: [
                { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
                { name: 'categoryId', in: 'query', schema: { type: 'string' } },
                { name: 'brandId', in: 'query', schema: { type: 'string' } },
                { name: 'minPrice', in: 'query', schema: { type: 'number' } },
                { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
                { name: 'sort', in: 'query', schema: { type: 'string', enum: ['price', 'name', 'createdAt'] } },
                { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
            ],
            responses: {
                200: {
                    description: 'Список товарів',
                    headers: {
                        'X-Cache': { schema: { type: 'string', enum: ['HIT', 'MISS'] } },
                    },
                },
            },
        },
    },
    '/api/products/{id}': {
        get: {
            tags: ['Products'],
            summary: 'Отримати товар за ID або slug',
            parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: {
                200: { description: 'Інформація про товар' },
                404: { $ref: '#/components/responses/NotFound' },
            },
        },
    },
    '/api/products/featured': {
        get: {
            tags: ['Products'],
            summary: 'Отримати рекомендовані товари',
            parameters: [
                { name: 'type', in: 'query', schema: { type: 'string', enum: ['featured', 'bestsellers', 'new'] } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, maximum: 50 } },
            ],
        },
    },
    '/api/search': {
        get: {
            tags: ['Search'],
            summary: 'Пошук товарів',
            parameters: [
                { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2 } },
                { name: 'page', in: 'query', schema: { type: 'integer' } },
                { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
                { name: 'categoryId', in: 'query', schema: { type: 'string' } },
                { name: 'brandId', in: 'query', schema: { type: 'string' } },
                { name: 'minPrice', in: 'query', schema: { type: 'number' } },
                { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
                { name: 'sort', in: 'query', schema: { type: 'string' } },
                { name: 'order', in: 'query', schema: { type: 'string' } },
            ],
            responses: {
                200: { description: 'Результати пошуку' },
                400: { description: 'Запит повинен містити мінімум 2 символи' },
            },
        },
    },
    // Admin endpoints
    '/api/admin/products': {
        get: {
            tags: ['Admin', 'Products'],
            summary: 'Отримати всі товари (адмін)',
            security: [{ bearerAuth: [] }],
        },
        post: {
            tags: ['Admin', 'Products'],
            summary: 'Створити новий товар',
            security: [{ bearerAuth: [] }],
            requestBody: {
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ProductCreateInput' },
                    },
                },
            },
            responses: {
                201: { description: 'Товар створено' },
                400: { description: 'Помилка валідації' },
                401: { $ref: '#/components/responses/Unauthorized' },
            },
        },
    },
    '/api/admin/orders': {
        get: {
            tags: ['Admin', 'Orders'],
            summary: 'Отримати всі замовлення',
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: 'status', in: 'query', schema: { type: 'string' } },
                { name: 'paymentStatus', in: 'query', schema: { type: 'string' } },
                { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date' } },
                { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date' } },
                { name: 'search', in: 'query', schema: { type: 'string' } },
            ],
        },
        post: {
            tags: ['Admin', 'Orders'],
            summary: 'Створити нове замовлення',
            security: [{ bearerAuth: [] }],
        },
    },
    '/api/liqpay/callback': {
        post: {
            tags: ['Webhooks'],
            summary: 'LiqPay payment callback',
            description: 'Обробляє callback від LiqPay після оплати',
            requestBody: {
                content: {
                    'application/x-www-form-urlencoded': {
                        schema: {
                            type: 'object',
                            properties: {
                                data: { type: 'string' },
                                signature: { type: 'string' },
                            },
                        },
                    },
                },
            },
            responses: {
                200: { description: 'OK' },
                400: { description: 'Missing data or signature' },
                403: { description: 'Invalid signature' },
            },
        },
    },
};
