/**
 * OpenAPI 3.0 Specification for Storefront API
 * Документація API для інтернет-магазину
 */

export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Storefront API',
    version: '1.0.0',
    description: 'API для інтернет-магазину з підтримкою адміністративних функцій, управління замовленнями, продуктами та користувачами',
    contact: {
      name: 'API Support',
      email: 'support@example.com',
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
      url: 'https://api.example.com',
      description: 'Production server',
    },
  ],
  tags: [
    { name: 'Products', description: 'Операції з продуктами' },
    { name: 'Categories', description: 'Категорії товарів' },
    { name: 'Cart', description: 'Кошик покупок' },
    { name: 'Orders', description: 'Замовлення' },
    { name: 'Search', description: 'Пошук товарів' },
    { name: 'Auth', description: 'Автентифікація та авторизація' },
    { name: 'Admin - Products', description: 'Адміністрування продуктів' },
    { name: 'Admin - Categories', description: 'Адміністрування категорій' },
    { name: 'Admin - Orders', description: 'Адміністрування замовлень' },
    { name: 'Admin - Customers', description: 'Управління клієнтами' },
  ],
  paths: {
    '/api/products': {
      get: {
        tags: ['Products'],
        summary: 'Отримати список продуктів',
        description: 'Повертає пагіновану колекцію активних продуктів з можливістю фільтрації',
        operationId: 'getProducts',
        parameters: [
          {
            name: 'page',
            in: 'query',
            description: 'Номер сторінки',
            schema: { type: 'integer', default: 1, minimum: 1 },
          },
          {
            name: 'pageSize',
            in: 'query',
            description: 'Кількість елементів на сторінці',
            schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
          },
          {
            name: 'categoryId',
            in: 'query',
            description: 'ID категорії для фільтрації',
            schema: { type: 'string' },
          },
          {
            name: 'brandId',
            in: 'query',
            description: 'ID бренду для фільтрації',
            schema: { type: 'string' },
          },
          {
            name: 'minPrice',
            in: 'query',
            description: 'Мінімальна ціна',
            schema: { type: 'number', format: 'decimal' },
          },
          {
            name: 'maxPrice',
            in: 'query',
            description: 'Максимальна ціна',
            schema: { type: 'number', format: 'decimal' },
          },
          {
            name: 'isNew',
            in: 'query',
            description: 'Тільки нові товари',
            schema: { type: 'boolean' },
          },
          {
            name: 'isBestseller',
            in: 'query',
            description: 'Тільки бестселери',
            schema: { type: 'boolean' },
          },
          {
            name: 'isFeatured',
            in: 'query',
            description: 'Тільки рекомендовані товари',
            schema: { type: 'boolean' },
          },
          {
            name: 'sort',
            in: 'query',
            description: 'Поле для сортування',
            schema: {
              type: 'string',
              enum: ['createdAt', 'price', 'name', 'soldCount', 'rating'],
              default: 'createdAt',
            },
          },
          {
            name: 'order',
            in: 'query',
            description: 'Напрямок сортування',
            schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
        ],
        responses: {
          200: {
            description: 'Успішна відповідь',
            headers: {
              'X-Cache': {
                description: 'Статус кешу (HIT або MISS)',
                schema: { type: 'string' },
              },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProductListResponse' },
              },
            },
          },
          500: {
            description: 'Внутрішня помилка сервера',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Отримати продукт за ID',
        description: 'Повертає детальну інформацію про продукт',
        operationId: 'getProductById',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'ID продукту',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Успішна відповідь',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' },
              },
            },
          },
          404: {
            description: 'Продукт не знайдено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/products/featured': {
      get: {
        tags: ['Products'],
        summary: 'Отримати рекомендовані продукти',
        description: 'Повертає список рекомендованих продуктів',
        operationId: 'getFeaturedProducts',
        responses: {
          200: {
            description: 'Успішна відповідь',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Product' },
                },
              },
            },
          },
        },
      },
    },
    '/api/categories': {
      get: {
        tags: ['Categories'],
        summary: 'Отримати категорії',
        description: 'Повертає список категорій у вигляді дерева або плоского списку',
        operationId: 'getCategories',
        parameters: [
          {
            name: 'tree',
            in: 'query',
            description: 'Повернути у вигляді дерева',
            schema: { type: 'boolean', default: true },
          },
        ],
        responses: {
          200: {
            description: 'Успішна відповідь',
            headers: {
              'X-Cache': {
                description: 'Статус кешу (HIT або MISS)',
                schema: { type: 'string' },
              },
            },
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Category' },
                },
              },
            },
          },
          500: {
            description: 'Внутрішня помилка сервера',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/categories/{slug}': {
      get: {
        tags: ['Categories'],
        summary: 'Отримати категорію за slug',
        description: 'Повертає детальну інформацію про категорію',
        operationId: 'getCategoryBySlug',
        parameters: [
          {
            name: 'slug',
            in: 'path',
            required: true,
            description: 'Slug категорії',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Успішна відповідь',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Category' },
              },
            },
          },
          404: {
            description: 'Категорію не знайдено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/search': {
      get: {
        tags: ['Search'],
        summary: 'Пошук продуктів',
        description: 'Повнотекстовий пошук продуктів з фільтрацією',
        operationId: 'searchProducts',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            description: 'Пошуковий запит (мінімум 2 символи)',
            schema: { type: 'string', minLength: 2 },
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', default: 20, maximum: 100 },
          },
          {
            name: 'categoryId',
            in: 'query',
            schema: { type: 'string' },
          },
          {
            name: 'brandId',
            in: 'query',
            schema: { type: 'string' },
          },
          {
            name: 'minPrice',
            in: 'query',
            schema: { type: 'number' },
          },
          {
            name: 'maxPrice',
            in: 'query',
            schema: { type: 'number' },
          },
          {
            name: 'sort',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['relevance', 'price', 'name', 'rating', 'newest', 'bestselling'],
              default: 'relevance',
            },
          },
          {
            name: 'order',
            in: 'query',
            schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
        ],
        responses: {
          200: {
            description: 'Успішна відповідь',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SearchResponse' },
              },
            },
          },
          400: {
            description: 'Невалідний запит',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/search/suggestions': {
      get: {
        tags: ['Search'],
        summary: 'Підказки для пошуку',
        description: 'Повертає підказки для автодоповнення пошуку',
        operationId: 'getSearchSuggestions',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            description: 'Пошуковий запит',
            schema: { type: 'string', minLength: 2 },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Максимальна кількість підказок',
            schema: { type: 'integer', default: 10, maximum: 20 },
          },
        ],
        responses: {
          200: {
            description: 'Успішна відповідь',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    '/api/cart/{userId}': {
      get: {
        tags: ['Cart'],
        summary: 'Отримати кошик користувача',
        description: 'Повертає вміст кошика для вказаного користувача',
        operationId: 'getCart',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            description: 'ID користувача',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Успішна відповідь',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/CartItem' },
                },
              },
            },
          },
          500: {
            description: 'Внутрішня помилка сервера',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Cart'],
        summary: 'Додати товар до кошика',
        description: 'Додає товар до кошика користувача',
        operationId: 'addToCart',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            description: 'ID користувача',
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AddToCartRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Товар додано до кошика',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CartItem' },
              },
            },
          },
          400: {
            description: 'Невалідний запит',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Cart'],
        summary: 'Очистити кошик',
        description: 'Видаляє всі товари з кошика користувача',
        operationId: 'clearCart',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            description: 'ID користувача',
            schema: { type: 'string' },
          },
        ],
        responses: {
          204: {
            description: 'Кошик очищено',
          },
          500: {
            description: 'Внутрішня помилка сервера',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/cart/{userId}/item/{productId}': {
      delete: {
        tags: ['Cart'],
        summary: 'Видалити товар з кошика',
        description: 'Видаляє конкретний товар з кошика користувача',
        operationId: 'removeFromCart',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            description: 'ID користувача',
            schema: { type: 'string' },
          },
          {
            name: 'productId',
            in: 'path',
            required: true,
            description: 'ID продукту',
            schema: { type: 'string' },
          },
        ],
        responses: {
          204: {
            description: 'Товар видалено',
          },
          500: {
            description: 'Внутрішня помилка сервера',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/orders': {
      post: {
        tags: ['Orders'],
        summary: 'Створити замовлення',
        description: 'Створює нове замовлення',
        operationId: 'createOrder',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateOrderRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Замовлення створено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Order' },
              },
            },
          },
          400: {
            description: 'Невалідний запит',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          500: {
            description: 'Внутрішня помилка сервера',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/admin/products': {
      get: {
        tags: ['Admin - Products'],
        summary: 'Отримати список продуктів (адмін)',
        description: 'Повертає всі продукти з можливістю фільтрації (включаючи чернетки та архівні)',
        operationId: 'adminGetProducts',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', default: 20, maximum: 100 },
          },
          {
            name: 'search',
            in: 'query',
            description: 'Пошук за назвою або SKU',
            schema: { type: 'string' },
          },
          {
            name: 'categoryId',
            in: 'query',
            schema: { type: 'string' },
          },
          {
            name: 'brandId',
            in: 'query',
            schema: { type: 'string' },
          },
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['DRAFT', 'ACTIVE', 'ARCHIVED', 'OUT_OF_STOCK'],
            },
          },
        ],
        responses: {
          200: {
            description: 'Успішна відповідь',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProductListResponse' },
              },
            },
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Admin - Products'],
        summary: 'Створити продукт',
        description: 'Створює новий продукт',
        operationId: 'adminCreateProduct',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateProductRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Продукт створено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' },
              },
            },
          },
          400: {
            description: 'Невалідний запит',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          409: {
            description: 'Продукт з таким SKU вже існує',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/admin/products/{id}': {
      get: {
        tags: ['Admin - Products'],
        summary: 'Отримати продукт за ID (адмін)',
        operationId: 'adminGetProduct',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Успішна відповідь',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' },
              },
            },
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          404: {
            description: 'Продукт не знайдено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      put: {
        tags: ['Admin - Products'],
        summary: 'Оновити продукт',
        operationId: 'adminUpdateProduct',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateProductRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Продукт оновлено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' },
              },
            },
          },
          400: {
            description: 'Невалідний запит',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          404: {
            description: 'Продукт не знайдено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Admin - Products'],
        summary: 'Видалити продукт',
        operationId: 'adminDeleteProduct',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          204: {
            description: 'Продукт видалено',
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          404: {
            description: 'Продукт не знайдено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/admin/categories': {
      get: {
        tags: ['Admin - Categories'],
        summary: 'Отримати категорії (адмін)',
        operationId: 'adminGetCategories',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'tree',
            in: 'query',
            schema: { type: 'boolean', default: false },
          },
          {
            name: 'includeInactive',
            in: 'query',
            schema: { type: 'boolean', default: false },
          },
        ],
        responses: {
          200: {
            description: 'Успішна відповідь',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Category' },
                },
              },
            },
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Admin - Categories'],
        summary: 'Створити категорію',
        operationId: 'adminCreateCategory',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateCategoryRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Категорію створено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Category' },
              },
            },
          },
          400: {
            description: 'Невалідний запит',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          409: {
            description: 'Категорія з таким slug вже існує',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/admin/categories/{id}': {
      get: {
        tags: ['Admin - Categories'],
        summary: 'Отримати категорію за ID',
        operationId: 'adminGetCategory',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Успішна відповідь',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Category' },
              },
            },
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          404: {
            description: 'Категорію не знайдено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      put: {
        tags: ['Admin - Categories'],
        summary: 'Оновити категорію',
        operationId: 'adminUpdateCategory',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateCategoryRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Категорію оновлено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Category' },
              },
            },
          },
          400: {
            description: 'Невалідний запит',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          404: {
            description: 'Категорію не знайдено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Admin - Categories'],
        summary: 'Видалити категорію',
        operationId: 'adminDeleteCategory',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          204: {
            description: 'Категорію видалено',
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          404: {
            description: 'Категорію не знайдено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/admin/orders': {
      get: {
        tags: ['Admin - Orders'],
        summary: 'Отримати список замовлень',
        operationId: 'adminGetOrders',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', default: 20, maximum: 100 },
          },
          {
            name: 'search',
            in: 'query',
            description: 'Пошук за номером замовлення або іменем клієнта',
            schema: { type: 'string' },
          },
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'],
            },
          },
          {
            name: 'paymentStatus',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'],
            },
          },
          {
            name: 'shippingStatus',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['PENDING', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'],
            },
          },
          {
            name: 'marketplace',
            in: 'query',
            description: 'Фільтр за маркетплейсом',
            schema: { type: 'string' },
          },
          {
            name: 'dateFrom',
            in: 'query',
            schema: { type: 'string', format: 'date-time' },
          },
          {
            name: 'dateTo',
            in: 'query',
            schema: { type: 'string', format: 'date-time' },
          },
        ],
        responses: {
          200: {
            description: 'Успішна відповідь',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OrderListResponse' },
              },
            },
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Admin - Orders'],
        summary: 'Створити замовлення (вручну)',
        operationId: 'adminCreateOrder',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateOrderRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Замовлення створено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Order' },
              },
            },
          },
          400: {
            description: 'Невалідний запит',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/admin/orders/{id}': {
      get: {
        tags: ['Admin - Orders'],
        summary: 'Отримати замовлення за ID',
        operationId: 'adminGetOrder',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Успішна відповідь',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Order' },
              },
            },
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          404: {
            description: 'Замовлення не знайдено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      put: {
        tags: ['Admin - Orders'],
        summary: 'Оновити замовлення',
        operationId: 'adminUpdateOrder',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateOrderRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Замовлення оновлено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Order' },
              },
            },
          },
          400: {
            description: 'Невалідний запит',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          404: {
            description: 'Замовлення не знайдено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/admin/orders/stats': {
      get: {
        tags: ['Admin - Orders'],
        summary: 'Отримати статистику замовлень',
        operationId: 'adminGetOrderStats',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Успішна відповідь',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OrderStats' },
              },
            },
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/admin/customers': {
      get: {
        tags: ['Admin - Customers'],
        summary: 'Отримати список клієнтів',
        operationId: 'adminGetCustomers',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', default: 20, maximum: 100 },
          },
          {
            name: 'search',
            in: 'query',
            description: 'Пошук за email, телефоном або іменем',
            schema: { type: 'string' },
          },
          {
            name: 'role',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['CUSTOMER', 'ADMIN', 'MANAGER', 'SUPPORT', 'WAREHOUSE'],
            },
          },
          {
            name: 'isVerified',
            in: 'query',
            schema: { type: 'boolean' },
          },
          {
            name: 'isActive',
            in: 'query',
            schema: { type: 'boolean' },
          },
        ],
        responses: {
          200: {
            description: 'Успішна відповідь',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CustomerListResponse' },
              },
            },
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Admin - Customers'],
        summary: 'Створити клієнта',
        operationId: 'adminCreateCustomer',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateCustomerRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Клієнта створено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Customer' },
              },
            },
          },
          400: {
            description: 'Невалідний запит',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          409: {
            description: 'Користувач з таким email вже існує',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/admin/customers/{id}': {
      get: {
        tags: ['Admin - Customers'],
        summary: 'Отримати клієнта за ID',
        operationId: 'adminGetCustomer',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Успішна відповідь',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Customer' },
              },
            },
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          404: {
            description: 'Клієнта не знайдено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      put: {
        tags: ['Admin - Customers'],
        summary: 'Оновити клієнта',
        operationId: 'adminUpdateCustomer',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateCustomerRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Клієнта оновлено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Customer' },
              },
            },
          },
          400: {
            description: 'Невалідний запит',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          404: {
            description: 'Клієнта не знайдено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Admin - Customers'],
        summary: 'Видалити клієнта',
        operationId: 'adminDeleteCustomer',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          204: {
            description: 'Клієнта видалено',
          },
          401: {
            description: 'Не авторизовано',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          404: {
            description: 'Клієнта не знайдено',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT токен отриманий через NextAuth',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'string',
            description: 'Повідомлення про помилку',
          },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          sku: { type: 'string' },
          name: { type: 'string' },
          nameUa: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string', nullable: true },
          descriptionUa: { type: 'string', nullable: true },
          price: { type: 'number', format: 'decimal' },
          compareAtPrice: { type: 'number', format: 'decimal', nullable: true },
          costPrice: { type: 'number', format: 'decimal', nullable: true },
          categoryId: { type: 'string' },
          brandId: { type: 'string', nullable: true },
          status: {
            type: 'string',
            enum: ['DRAFT', 'ACTIVE', 'ARCHIVED', 'OUT_OF_STOCK'],
          },
          isNew: { type: 'boolean' },
          isBestseller: { type: 'boolean' },
          isFeatured: { type: 'boolean' },
          weight: { type: 'number', nullable: true },
          length: { type: 'number', nullable: true },
          width: { type: 'number', nullable: true },
          height: { type: 'number', nullable: true },
          metaTitle: { type: 'string', nullable: true },
          metaDescription: { type: 'string', nullable: true },
          viewCount: { type: 'integer' },
          soldCount: { type: 'integer' },
          rating: { type: 'number' },
          reviewCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ProductListResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Product' },
          },
          total: { type: 'integer' },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          nameUa: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string', nullable: true },
          image: { type: 'string', nullable: true },
          parentId: { type: 'string', nullable: true },
          order: { type: 'integer' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          children: {
            type: 'array',
            items: { $ref: '#/components/schemas/Category' },
            nullable: true,
          },
        },
      },
      CartItem: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          cartId: { type: 'string' },
          productId: { type: 'string' },
          variantId: { type: 'string', nullable: true },
          quantity: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          product: { $ref: '#/components/schemas/Product' },
        },
      },
      AddToCartRequest: {
        type: 'object',
        required: ['productId', 'quantity'],
        properties: {
          productId: { type: 'string' },
          variantId: { type: 'string', nullable: true },
          quantity: { type: 'integer', minimum: 1 },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          orderNumber: { type: 'string' },
          userId: { type: 'string', nullable: true },
          status: {
            type: 'string',
            enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED'],
          },
          paymentStatus: {
            type: 'string',
            enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
          },
          shippingStatus: {
            type: 'string',
            enum: ['PENDING', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED'],
          },
          subtotal: { type: 'number', format: 'decimal' },
          discount: { type: 'number', format: 'decimal' },
          shippingCost: { type: 'number', format: 'decimal' },
          tax: { type: 'number', format: 'decimal' },
          total: { type: 'number', format: 'decimal' },
          currency: { type: 'string', default: 'UAH' },
          customerEmail: { type: 'string' },
          customerPhone: { type: 'string' },
          customerName: { type: 'string' },
          addressId: { type: 'string', nullable: true },
          shippingMethod: { type: 'string', nullable: true },
          shippingCarrier: { type: 'string', nullable: true },
          trackingNumber: { type: 'string', nullable: true },
          paymentMethod: { type: 'string', nullable: true },
          paymentId: { type: 'string', nullable: true },
          couponCode: { type: 'string', nullable: true },
          couponDiscount: { type: 'number', format: 'decimal' },
          loyaltyPoints: { type: 'integer' },
          marketplace: { type: 'string', nullable: true },
          externalId: { type: 'string', nullable: true },
          notes: { type: 'string', nullable: true },
          adminNotes: { type: 'string', nullable: true },
          completedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      OrderListResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Order' },
          },
          total: { type: 'integer' },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      OrderStats: {
        type: 'object',
        properties: {
          total: { type: 'integer', description: 'Загальна кількість замовлень' },
          pending: { type: 'integer', description: 'Замовлення в очікуванні' },
          processing: { type: 'integer', description: 'Замовлення в обробці' },
          completed: { type: 'integer', description: 'Виконані замовлення' },
          cancelled: { type: 'integer', description: 'Скасовані замовлення' },
          totalRevenue: { type: 'number', description: 'Загальна виручка' },
          averageOrderValue: { type: 'number', description: 'Середній чек' },
        },
      },
      CreateOrderRequest: {
        type: 'object',
        required: ['customerEmail', 'customerPhone', 'customerName', 'items'],
        properties: {
          customerEmail: { type: 'string', format: 'email' },
          customerPhone: { type: 'string' },
          customerName: { type: 'string' },
          userId: { type: 'string', nullable: true },
          addressId: { type: 'string', nullable: true },
          shippingMethod: { type: 'string', nullable: true },
          paymentMethod: { type: 'string', nullable: true },
          notes: { type: 'string', nullable: true },
          shippingCost: { type: 'number', default: 0 },
          discount: { type: 'number', default: 0 },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['productId', 'sku', 'name', 'price', 'quantity'],
              properties: {
                productId: { type: 'string' },
                variantId: { type: 'string', nullable: true },
                sku: { type: 'string' },
                name: { type: 'string' },
                price: { type: 'number' },
                quantity: { type: 'integer', minimum: 1 },
                discount: { type: 'number', default: 0 },
              },
            },
          },
        },
      },
      UpdateOrderRequest: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'],
          },
          paymentStatus: {
            type: 'string',
            enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'],
          },
          shippingStatus: {
            type: 'string',
            enum: ['PENDING', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'],
          },
          trackingNumber: { type: 'string' },
          adminNotes: { type: 'string' },
        },
      },
      SearchResponse: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Product' },
          },
          total: { type: 'integer' },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      CreateProductRequest: {
        type: 'object',
        required: ['name', 'nameUa', 'sku', 'slug', 'price', 'categoryId'],
        properties: {
          name: { type: 'string' },
          nameUa: { type: 'string' },
          sku: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' },
          descriptionUa: { type: 'string' },
          price: { type: 'number' },
          compareAtPrice: { type: 'number' },
          costPrice: { type: 'number' },
          categoryId: { type: 'string' },
          brandId: { type: 'string' },
          status: {
            type: 'string',
            enum: ['DRAFT', 'ACTIVE', 'ARCHIVED', 'OUT_OF_STOCK'],
            default: 'DRAFT',
          },
          isNew: { type: 'boolean', default: false },
          isBestseller: { type: 'boolean', default: false },
          isFeatured: { type: 'boolean', default: false },
          weight: { type: 'number' },
          length: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          metaTitle: { type: 'string' },
          metaDescription: { type: 'string' },
        },
      },
      UpdateProductRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          nameUa: { type: 'string' },
          description: { type: 'string' },
          descriptionUa: { type: 'string' },
          price: { type: 'number' },
          compareAtPrice: { type: 'number' },
          costPrice: { type: 'number' },
          categoryId: { type: 'string' },
          brandId: { type: 'string' },
          status: {
            type: 'string',
            enum: ['DRAFT', 'ACTIVE', 'ARCHIVED', 'OUT_OF_STOCK'],
          },
          isNew: { type: 'boolean' },
          isBestseller: { type: 'boolean' },
          isFeatured: { type: 'boolean' },
          weight: { type: 'number' },
          length: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          metaTitle: { type: 'string' },
          metaDescription: { type: 'string' },
        },
      },
      CreateCategoryRequest: {
        type: 'object',
        required: ['name', 'nameUa', 'slug'],
        properties: {
          name: { type: 'string' },
          nameUa: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' },
          image: { type: 'string' },
          parentId: { type: 'string' },
          order: { type: 'integer', default: 0 },
          isActive: { type: 'boolean', default: true },
        },
      },
      UpdateCategoryRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          nameUa: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' },
          image: { type: 'string' },
          parentId: { type: 'string' },
          order: { type: 'integer' },
          isActive: { type: 'boolean' },
        },
      },
      Customer: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string', nullable: true },
          firstName: { type: 'string', nullable: true },
          lastName: { type: 'string', nullable: true },
          avatar: { type: 'string', nullable: true },
          role: {
            type: 'string',
            enum: ['CUSTOMER', 'ADMIN', 'MANAGER', 'WAREHOUSE', 'SUPPORT'],
          },
          isVerified: { type: 'boolean' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      CustomerListResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Customer' },
          },
          total: { type: 'integer' },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      CreateCustomerRequest: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phone: { type: 'string' },
          role: {
            type: 'string',
            enum: ['CUSTOMER', 'ADMIN', 'MANAGER', 'WAREHOUSE', 'SUPPORT'],
            default: 'CUSTOMER',
          },
        },
      },
      UpdateCustomerRequest: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phone: { type: 'string' },
          role: {
            type: 'string',
            enum: ['CUSTOMER', 'ADMIN', 'MANAGER', 'WAREHOUSE', 'SUPPORT'],
          },
          isActive: { type: 'boolean' },
          isVerified: { type: 'boolean' },
        },
      },
    },
  },
} as const;
