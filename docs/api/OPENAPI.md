# OpenAPI Specification

Shop Platform API відповідає специфікації OpenAPI 3.1.

## Огляд

- **Версія**: 1.4.0
- **Base URL**: `https://api.shop.example.com/v1`
- **Формат**: JSON
- **Автентифікація**: Bearer JWT

## OpenAPI Specification

```yaml
openapi: 3.1.0
info:
  title: Shop Platform API
  description: |
    API для Shop Platform - багатотенантної e-commerce платформи.

    ## Автентифікація

    Більшість endpoints вимагають JWT токен в заголовку Authorization:
    ```
    Authorization: Bearer <access_token>
    ```

    ## Rate Limits

    - Публічні endpoints: 100 req/min
    - Автентифіковані: 1000 req/min
    - Admin endpoints: 5000 req/min

    ## Коди помилок

    | Код | Опис |
    |-----|------|
    | 400 | Bad Request |
    | 401 | Unauthorized |
    | 403 | Forbidden |
    | 404 | Not Found |
    | 422 | Validation Error |
    | 429 | Too Many Requests |
    | 500 | Internal Server Error |

  version: 1.4.0
  contact:
    name: API Support
    email: api@shop-platform.com
    url: https://docs.shop-platform.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.shop.example.com/v1
    description: Production
  - url: https://api.staging.shop.example.com/v1
    description: Staging
  - url: http://localhost:8080/v1
    description: Development

tags:
  - name: Auth
    description: Автентифікація та авторизація
  - name: Products
    description: Управління товарами
  - name: Categories
    description: Категорії товарів
  - name: Cart
    description: Кошик покупця
  - name: Orders
    description: Замовлення
  - name: Users
    description: Користувачі
  - name: Inventory
    description: Складський облік

paths:
  # Auth
  /auth/register:
    post:
      tags: [Auth]
      summary: Реєстрація нового користувача
      operationId: register
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RegisterRequest'
      responses:
        '201':
          description: Користувача створено
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '400':
          $ref: '#/components/responses/BadRequest'
        '422':
          $ref: '#/components/responses/ValidationError'

  /auth/login:
    post:
      tags: [Auth]
      summary: Вхід користувача
      operationId: login
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: Успішний вхід
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /auth/refresh:
    post:
      tags: [Auth]
      summary: Оновлення токенів
      operationId: refreshTokens
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [refresh_token]
              properties:
                refresh_token:
                  type: string
      responses:
        '200':
          description: Токени оновлено
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /auth/logout:
    post:
      tags: [Auth]
      summary: Вихід користувача
      operationId: logout
      security:
        - bearerAuth: []
      responses:
        '204':
          description: Успішний вихід

  # Products
  /products:
    get:
      tags: [Products]
      summary: Список товарів
      operationId: listProducts
      parameters:
        - $ref: '#/components/parameters/PageParam'
        - $ref: '#/components/parameters/LimitParam'
        - $ref: '#/components/parameters/SortParam'
        - name: category
          in: query
          schema:
            type: string
          description: Slug категорії
        - name: brand
          in: query
          schema:
            type: string
          description: Slug бренду
        - name: price_min
          in: query
          schema:
            type: number
        - name: price_max
          in: query
          schema:
            type: number
        - name: q
          in: query
          schema:
            type: string
          description: Пошуковий запит
        - name: in_stock
          in: query
          schema:
            type: boolean
      responses:
        '200':
          description: Список товарів
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProductListResponse'

    post:
      tags: [Products]
      summary: Створення товару
      operationId: createProduct
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateProductRequest'
      responses:
        '201':
          description: Товар створено
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Product'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '422':
          $ref: '#/components/responses/ValidationError'

  /products/{id}:
    get:
      tags: [Products]
      summary: Отримання товару
      operationId: getProduct
      parameters:
        - $ref: '#/components/parameters/IdParam'
      responses:
        '200':
          description: Товар
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Product'
        '404':
          $ref: '#/components/responses/NotFound'

    put:
      tags: [Products]
      summary: Оновлення товару
      operationId: updateProduct
      security:
        - bearerAuth: []
      parameters:
        - $ref: '#/components/parameters/IdParam'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateProductRequest'
      responses:
        '200':
          description: Товар оновлено
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Product'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'

    delete:
      tags: [Products]
      summary: Видалення товару
      operationId: deleteProduct
      security:
        - bearerAuth: []
      parameters:
        - $ref: '#/components/parameters/IdParam'
      responses:
        '204':
          description: Товар видалено
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'

  /products/slug/{slug}:
    get:
      tags: [Products]
      summary: Отримання товару за slug
      operationId: getProductBySlug
      parameters:
        - name: slug
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Товар
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Product'
        '404':
          $ref: '#/components/responses/NotFound'

  # Categories
  /categories:
    get:
      tags: [Categories]
      summary: Дерево категорій
      operationId: getCategoryTree
      parameters:
        - name: flat
          in: query
          schema:
            type: boolean
          description: Повернути плоский список замість дерева
      responses:
        '200':
          description: Категорії
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Category'

  /categories/{id}:
    get:
      tags: [Categories]
      summary: Отримання категорії
      operationId: getCategory
      parameters:
        - $ref: '#/components/parameters/IdParam'
      responses:
        '200':
          description: Категорія
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Category'
        '404':
          $ref: '#/components/responses/NotFound'

  /categories/{id}/products:
    get:
      tags: [Categories]
      summary: Товари категорії
      operationId: getCategoryProducts
      parameters:
        - $ref: '#/components/parameters/IdParam'
        - $ref: '#/components/parameters/PageParam'
        - $ref: '#/components/parameters/LimitParam'
        - name: include_children
          in: query
          schema:
            type: boolean
            default: true
          description: Включити товари з підкатегорій
      responses:
        '200':
          description: Товари
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProductListResponse'

  # Cart
  /cart:
    get:
      tags: [Cart]
      summary: Отримання кошика
      operationId: getCart
      security:
        - bearerAuth: []
        - {}
      responses:
        '200':
          description: Кошик
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Cart'

  /cart/items:
    post:
      tags: [Cart]
      summary: Додавання товару в кошик
      operationId: addToCart
      security:
        - bearerAuth: []
        - {}
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AddToCartRequest'
      responses:
        '200':
          description: Товар додано
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Cart'
        '422':
          $ref: '#/components/responses/ValidationError'

  /cart/items/{id}:
    patch:
      tags: [Cart]
      summary: Оновлення кількості
      operationId: updateCartItem
      security:
        - bearerAuth: []
        - {}
      parameters:
        - $ref: '#/components/parameters/IdParam'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [quantity]
              properties:
                quantity:
                  type: integer
                  minimum: 1
      responses:
        '200':
          description: Кількість оновлено
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Cart'

    delete:
      tags: [Cart]
      summary: Видалення товару з кошика
      operationId: removeFromCart
      security:
        - bearerAuth: []
        - {}
      parameters:
        - $ref: '#/components/parameters/IdParam'
      responses:
        '200':
          description: Товар видалено
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Cart'

  /cart/coupon:
    post:
      tags: [Cart]
      summary: Застосування купона
      operationId: applyCoupon
      security:
        - bearerAuth: []
        - {}
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [code]
              properties:
                code:
                  type: string
      responses:
        '200':
          description: Купон застосовано
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Cart'
        '400':
          description: Невалідний купон

    delete:
      tags: [Cart]
      summary: Видалення купона
      operationId: removeCoupon
      security:
        - bearerAuth: []
        - {}
      responses:
        '200':
          description: Купон видалено
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Cart'

  # Orders
  /orders:
    get:
      tags: [Orders]
      summary: Список замовлень
      operationId: listOrders
      security:
        - bearerAuth: []
      parameters:
        - $ref: '#/components/parameters/PageParam'
        - $ref: '#/components/parameters/LimitParam'
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, confirmed, processing, shipped, delivered, completed, cancelled]
      responses:
        '200':
          description: Замовлення
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderListResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'

    post:
      tags: [Orders]
      summary: Створення замовлення
      operationId: createOrder
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrderRequest'
      responses:
        '201':
          description: Замовлення створено
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
        '422':
          $ref: '#/components/responses/ValidationError'

  /orders/{id}:
    get:
      tags: [Orders]
      summary: Отримання замовлення
      operationId: getOrder
      security:
        - bearerAuth: []
      parameters:
        - $ref: '#/components/parameters/IdParam'
      responses:
        '200':
          description: Замовлення
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
        '404':
          $ref: '#/components/responses/NotFound'

  /orders/{id}/cancel:
    post:
      tags: [Orders]
      summary: Скасування замовлення
      operationId: cancelOrder
      security:
        - bearerAuth: []
      parameters:
        - $ref: '#/components/parameters/IdParam'
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                reason:
                  type: string
      responses:
        '200':
          description: Замовлення скасовано
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
        '400':
          description: Замовлення не можна скасувати

  # Checkout
  /checkout:
    post:
      tags: [Orders]
      summary: Оформлення замовлення (checkout)
      operationId: checkout
      security:
        - bearerAuth: []
        - {}
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CheckoutRequest'
      responses:
        '201':
          description: Замовлення створено
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CheckoutResponse'
        '422':
          $ref: '#/components/responses/ValidationError'

  /checkout/shipping-rates:
    post:
      tags: [Orders]
      summary: Розрахунок вартості доставки
      operationId: getShippingRates
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [address]
              properties:
                address:
                  $ref: '#/components/schemas/Address'
      responses:
        '200':
          description: Варіанти доставки
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ShippingRate'

  # User
  /users/me:
    get:
      tags: [Users]
      summary: Поточний користувач
      operationId: getCurrentUser
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Користувач
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '401':
          $ref: '#/components/responses/Unauthorized'

    patch:
      tags: [Users]
      summary: Оновлення профілю
      operationId: updateProfile
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateUserRequest'
      responses:
        '200':
          description: Профіль оновлено
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'

  /users/me/addresses:
    get:
      tags: [Users]
      summary: Адреси користувача
      operationId: listAddresses
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Адреси
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Address'

    post:
      tags: [Users]
      summary: Додавання адреси
      operationId: addAddress
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Address'
      responses:
        '201':
          description: Адресу додано
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Address'

  # Inventory
  /inventory/{product_id}:
    get:
      tags: [Inventory]
      summary: Залишки товару
      operationId: getInventory
      parameters:
        - name: product_id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Залишки
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/InventoryResponse'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  parameters:
    IdParam:
      name: id
      in: path
      required: true
      schema:
        type: string
        format: uuid

    PageParam:
      name: page
      in: query
      schema:
        type: integer
        minimum: 1
        default: 1

    LimitParam:
      name: limit
      in: query
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20

    SortParam:
      name: sort
      in: query
      schema:
        type: string
        enum: [created_at, -created_at, price, -price, name, -name, popular]
        default: -created_at

  responses:
    BadRequest:
      description: Bad Request
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

    Unauthorized:
      description: Unauthorized
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

    Forbidden:
      description: Forbidden
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

    NotFound:
      description: Not Found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

    ValidationError:
      description: Validation Error
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ValidationError'

  schemas:
    # Auth
    RegisterRequest:
      type: object
      required: [email, password, first_name, last_name]
      properties:
        email:
          type: string
          format: email
        password:
          type: string
          minLength: 8
        first_name:
          type: string
        last_name:
          type: string
        phone:
          type: string

    LoginRequest:
      type: object
      required: [email, password]
      properties:
        email:
          type: string
          format: email
        password:
          type: string

    AuthResponse:
      type: object
      properties:
        user:
          $ref: '#/components/schemas/User'
        access_token:
          type: string
        refresh_token:
          type: string
        expires_at:
          type: string
          format: date-time

    # User
    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        first_name:
          type: string
        last_name:
          type: string
        phone:
          type: string
        avatar_url:
          type: string
        role:
          type: string
          enum: [customer, manager, admin]
        created_at:
          type: string
          format: date-time

    UpdateUserRequest:
      type: object
      properties:
        first_name:
          type: string
        last_name:
          type: string
        phone:
          type: string
        avatar_url:
          type: string

    # Product
    Product:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        slug:
          type: string
        description:
          type: string
        price:
          type: number
        compare_at_price:
          type: number
        sku:
          type: string
        barcode:
          type: string
        brand:
          type: string
        in_stock:
          type: boolean
        quantity:
          type: integer
        is_active:
          type: boolean
        is_new:
          type: boolean
        rating:
          type: number
        reviews_count:
          type: integer
        images:
          type: array
          items:
            $ref: '#/components/schemas/ProductImage'
        variants:
          type: array
          items:
            $ref: '#/components/schemas/ProductVariant'
        categories:
          type: array
          items:
            $ref: '#/components/schemas/Category'
        attributes:
          type: object
          additionalProperties:
            type: string
        meta_title:
          type: string
        meta_description:
          type: string
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    ProductImage:
      type: object
      properties:
        id:
          type: string
        url:
          type: string
        alt:
          type: string
        position:
          type: integer

    ProductVariant:
      type: object
      properties:
        id:
          type: string
        sku:
          type: string
        name:
          type: string
        price:
          type: number
        compare_at_price:
          type: number
        quantity:
          type: integer
        attributes:
          type: object
          additionalProperties:
            type: string

    CreateProductRequest:
      type: object
      required: [name, price]
      properties:
        name:
          type: string
        slug:
          type: string
        description:
          type: string
        price:
          type: number
        compare_at_price:
          type: number
        sku:
          type: string
        brand:
          type: string
        category_ids:
          type: array
          items:
            type: string
        images:
          type: array
          items:
            type: object
            properties:
              url:
                type: string
              alt:
                type: string
        variants:
          type: array
          items:
            type: object
            properties:
              sku:
                type: string
              name:
                type: string
              price:
                type: number
              attributes:
                type: object
        attributes:
          type: object
        is_active:
          type: boolean
          default: true

    UpdateProductRequest:
      type: object
      properties:
        name:
          type: string
        description:
          type: string
        price:
          type: number
        compare_at_price:
          type: number
        sku:
          type: string
        brand:
          type: string
        category_ids:
          type: array
          items:
            type: string
        is_active:
          type: boolean

    ProductListResponse:
      type: object
      properties:
        products:
          type: array
          items:
            $ref: '#/components/schemas/Product'
        pagination:
          $ref: '#/components/schemas/Pagination'
        filters:
          $ref: '#/components/schemas/FilterOptions'

    # Category
    Category:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        slug:
          type: string
        description:
          type: string
        image_url:
          type: string
        parent_id:
          type: string
        level:
          type: integer
        position:
          type: integer
        product_count:
          type: integer
        children:
          type: array
          items:
            $ref: '#/components/schemas/Category'

    # Cart
    Cart:
      type: object
      properties:
        id:
          type: string
        items:
          type: array
          items:
            $ref: '#/components/schemas/CartItem'
        subtotal:
          type: number
        discount_amount:
          type: number
        shipping_amount:
          type: number
        tax_amount:
          type: number
        total:
          type: number
        coupon_code:
          type: string
        item_count:
          type: integer

    CartItem:
      type: object
      properties:
        id:
          type: string
        product_id:
          type: string
        variant_id:
          type: string
        name:
          type: string
        variant_name:
          type: string
        image_url:
          type: string
        product_slug:
          type: string
        price:
          type: number
        quantity:
          type: integer
        total:
          type: number

    AddToCartRequest:
      type: object
      required: [product_id, quantity]
      properties:
        product_id:
          type: string
        variant_id:
          type: string
        quantity:
          type: integer
          minimum: 1

    # Order
    Order:
      type: object
      properties:
        id:
          type: string
        number:
          type: string
        status:
          type: string
          enum: [pending, confirmed, processing, shipped, delivered, completed, cancelled]
        payment_status:
          type: string
          enum: [pending, paid, failed, refunded]
        items:
          type: array
          items:
            $ref: '#/components/schemas/OrderItem'
        subtotal:
          type: number
        discount_amount:
          type: number
        shipping_amount:
          type: number
        tax_amount:
          type: number
        total:
          type: number
        currency:
          type: string
        shipping_address:
          $ref: '#/components/schemas/Address'
        billing_address:
          $ref: '#/components/schemas/Address'
        shipping_method:
          type: string
        payment_method:
          type: string
        notes:
          type: string
        tracking_number:
          type: string
        tracking_url:
          type: string
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    OrderItem:
      type: object
      properties:
        id:
          type: string
        product_id:
          type: string
        variant_id:
          type: string
        name:
          type: string
        variant_name:
          type: string
        sku:
          type: string
        image_url:
          type: string
        price:
          type: number
        quantity:
          type: integer
        total:
          type: number

    CreateOrderRequest:
      type: object
      required: [shipping_address, shipping_method, payment_method]
      properties:
        shipping_address:
          $ref: '#/components/schemas/Address'
        billing_address:
          $ref: '#/components/schemas/Address'
        shipping_method:
          type: string
        payment_method:
          type: string
        notes:
          type: string

    OrderListResponse:
      type: object
      properties:
        orders:
          type: array
          items:
            $ref: '#/components/schemas/Order'
        pagination:
          $ref: '#/components/schemas/Pagination'

    # Checkout
    CheckoutRequest:
      type: object
      required: [shipping_address, shipping_method, payment_method]
      properties:
        email:
          type: string
          format: email
        shipping_address:
          $ref: '#/components/schemas/Address'
        billing_address:
          $ref: '#/components/schemas/Address'
        same_billing_address:
          type: boolean
          default: true
        shipping_method:
          type: string
        payment_method:
          type: string
        coupon_code:
          type: string
        notes:
          type: string

    CheckoutResponse:
      type: object
      properties:
        order:
          $ref: '#/components/schemas/Order'
        payment_url:
          type: string
          description: URL для оплати (якщо потрібно перенаправлення)

    # Address
    Address:
      type: object
      required: [first_name, last_name, address1, city, postal_code, country]
      properties:
        id:
          type: string
        first_name:
          type: string
        last_name:
          type: string
        company:
          type: string
        address1:
          type: string
        address2:
          type: string
        city:
          type: string
        state:
          type: string
        postal_code:
          type: string
        country:
          type: string
        phone:
          type: string
        is_default:
          type: boolean

    ShippingRate:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        description:
          type: string
        price:
          type: number
        estimated_days:
          type: integer
        carrier:
          type: string

    # Inventory
    InventoryResponse:
      type: object
      properties:
        product_id:
          type: string
        total_quantity:
          type: integer
        available_quantity:
          type: integer
        reserved_quantity:
          type: integer
        locations:
          type: array
          items:
            type: object
            properties:
              location_id:
                type: string
              location_name:
                type: string
              quantity:
                type: integer
              available:
                type: integer

    # Common
    Pagination:
      type: object
      properties:
        page:
          type: integer
        limit:
          type: integer
        total:
          type: integer
        total_pages:
          type: integer
        has_more:
          type: boolean

    FilterOptions:
      type: object
      properties:
        price:
          type: object
          properties:
            min:
              type: number
            max:
              type: number
        categories:
          type: array
          items:
            type: object
            properties:
              id:
                type: string
              name:
                type: string
              slug:
                type: string
              count:
                type: integer
        brands:
          type: array
          items:
            type: object
            properties:
              name:
                type: string
              slug:
                type: string
              count:
                type: integer
        attributes:
          type: array
          items:
            type: object
            properties:
              name:
                type: string
              key:
                type: string
              type:
                type: string
              values:
                type: array
                items:
                  type: object
                  properties:
                    value:
                      type: string
                    label:
                      type: string
                    count:
                      type: integer

    Error:
      type: object
      properties:
        error:
          type: string
        message:
          type: string
        code:
          type: string

    ValidationError:
      type: object
      properties:
        error:
          type: string
        message:
          type: string
        details:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string

security:
  - bearerAuth: []
```

## Генерація клієнтів

### Go Client

```bash
# Встановлення oapi-codegen
go install github.com/deepmap/oapi-codegen/cmd/oapi-codegen@latest

# Генерація клієнта
oapi-codegen -generate types,client -package api openapi.yaml > api/client.go
```

### TypeScript Client

```bash
# Встановлення openapi-typescript
npm install -D openapi-typescript

# Генерація типів
npx openapi-typescript openapi.yaml -o src/types/api.d.ts
```

## Swagger UI

API документація доступна за адресою:
- Production: `https://api.shop.example.com/docs`
- Development: `http://localhost:8080/docs`

## Див. також

- [API Changelog](./CHANGELOG.md)
- [WebSocket API](./WEBSOCKET.md)
- [Authentication](../modules/AUTH.md)
- [Rate Limiting](../operations/RATE_LIMITING.md)
