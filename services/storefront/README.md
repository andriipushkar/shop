# Storefront - Інтернет-магазин

Сучасний інтернет-магазин побудований на Next.js 16 з React 19 та TypeScript.

## Особливості

### Основні функції

- **5000+ товарів** у 86 категоріях
- **100 акцій та промокодів**
- **Кошик покупок** з синхронізацією через API
- **Адмін-панель** для управління магазином
- **EAV (Entity-Attribute-Value)** - гнучка система атрибутів товарів
- **WMS (Warehouse Management System)** - повноцінна система управління складом
- **POS (Point of Sale)** - касова система для роздрібної торгівлі
- **Мобільний сканер** - сканування штрих-кодів телефоном
- **Повністю українізований** інтерфейс
- **Адаптивний дизайн** для мобільних та десктоп пристроїв
- **Покриття тестами** 97%+
- **Програма лояльності** - бали, рівні, бонуси
- **Подарункові сертифікати** - купівля та використання
- **Email маркетинг** - кампанії та автоматізації
- **SEO оптимізація** - мета-теги, JSON-LD, sitemap
- **PWA** - офлайн режим, push-сповіщення
- **Docker** - контейнеризація для production

### Нові модулі (v4.0)

- **Фіскалізація (ПРРО)** - інтеграція з Checkbox API для українського ринку
- **B2B Продажі** - багаторівнева система оптових цін (6 рівнів)
- **Supplier API** - dropshipping платформа для постачальників
- **Hardware Integration** - принтери чеків, етикеток, сканери
- **AI Репрайсинг** - автоматичне коригування цін на основі конкурентів
- **AI Прогнозування** - forecasting попиту та рекомендації закупівель
- **Розширений WMS** - 12 нових модулів складу (карта, задачі, FEFO, тощо)

**📚 Детальна документація:** [`docs/MODULES_OVERVIEW.md`](docs/MODULES_OVERVIEW.md)

## Технології

- **Next.js 16** - App Router
- **React 19** - Server Components
- **TypeScript** - строга типізація
- **Tailwind CSS** - стилізація (teal колірна схема)
- **Jest + React Testing Library** - тестування

## Структура проекту

```
storefront/
├── app/                      # Next.js App Router сторінки
│   ├── admin/               # Адмін-панель
│   │   ├── analytics/       # Аналітика
│   │   ├── attributes/      # Управління атрибутами (EAV)
│   │   ├── categories/      # Управління категоріями
│   │   ├── content/         # Контент-менеджмент
│   │   ├── customers/       # Клієнти
│   │   ├── import/          # Імпорт даних
│   │   ├── integrations/    # Інтеграції
│   │   ├── orders/          # Замовлення
│   │   ├── products/        # Товари
│   │   ├── promo/           # Акції та промокоди
│   │   ├── reviews/         # Відгуки
│   │   ├── settings/        # Налаштування
│   │   ├── support/         # Підтримка
│   │   ├── users/           # Користувачі
│   │   └── warehouse/       # WMS (Система управління складом)
│   │       ├── inventory/   # Інвентаризація
│   │       ├── locations/   # Місця зберігання
│   │       ├── movements/   # Історія переміщень
│   │       ├── pos/         # POS (Каса)
│   │       ├── purchases/   # Закупівлі
│   │       ├── receipt/     # Приймання товару
│   │       ├── reports/     # Звіти та аналітика
│   │       ├── reservations/# Резервування
│   │       ├── scanner/     # Мобільний сканер
│   │       ├── serials/     # Серійні номери
│   │       ├── settings/    # Налаштування складу
│   │       ├── shipment/    # Відвантаження
│   │       ├── stock/       # Залишки
│   │       ├── suppliers/   # Постачальники
│   │       ├── transfer/    # Переміщення
│   │       ├── warehouses/  # Склади
│   │       └── writeoff/    # Списання
│   ├── cart/                # Кошик
│   ├── category/[slug]/     # Сторінка категорії
│   ├── checkout/            # Оформлення замовлення
│   ├── order-status/        # Статус замовлення
│   └── product/[id]/        # Сторінка товару
├── components/              # React компоненти
│   ├── Footer.tsx
│   ├── Header.tsx
│   ├── HeroSection.tsx
│   ├── ProductCard.tsx
│   ├── PromoSection.tsx
│   └── SearchFilter.tsx
├── lib/                     # Утиліти та сервіси
│   ├── api.ts              # API функції
│   ├── cart-context.tsx    # Контекст кошика
│   └── mock-data.ts        # Мок-дані (5000 товарів)
├── docs/                    # Документація
│   └── eav-manual-testing.md  # Ручне тестування EAV
└── __tests__/              # Тести
    ├── admin/
    │   └── attributes/
    │       └── attributes-page.test.tsx
    ├── category/
    │   └── category-filters.test.tsx
    ├── product/
    │   └── product-page.test.tsx
    ├── components/
    │   └── ProductCard.test.tsx
    └── lib/
        ├── api.test.ts
        ├── cart-context.test.tsx
        └── mock-data.test.ts
```

## Запуск

### Розробка

```bash
# Встановити залежності
npm install

# Запустити dev сервер
npm run dev
```

Відкрийте [http://localhost:3000](http://localhost:3000) у браузері.

### Production Build

```bash
npm run build
npm start
```

## Тестування

```bash
# Запустити всі тести
npm test

# Тести з покриттям
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Покриття коду

**Загальне покриття: 97%+ (2071 тестів)**

| Модуль | Statements | Branches | Functions | Lines |
|--------|-----------|----------|-----------|-------|
| lib/mock-data.ts | 100% | 88.57% | 100% | 100% |
| lib/api.ts | 100% | 93.54% | 100% | 100% |
| lib/cart-context.tsx | 94.11% | 71.42% | 100% | 100% |
| components/Footer.tsx | 100% | 100% | 100% | 100% |
| components/HeroSection.tsx | 100% | 100% | 100% | 100% |
| components/PromoSection.tsx | 100% | 100% | 100% | 100% |
| components/SearchFilter.tsx | 100% | 100% | 100% | 100% |
| components/ProductCard.tsx | 94.44% | 92.3% | 85.71% | 100% |
| components/Header.tsx | 76.08% | 83.33% | 68% | 76.08% |

## API

### Продукти

```typescript
// Отримати всі продукти
const products = await fetchProducts();

// Отримати продукт за ID
const product = await fetchProductById('prod-123');

// Пошук продуктів
const results = await searchProducts('Apple');

// Продукти за категорією
const categoryProducts = getProductsByCategory('cat-1-1');
```

### Кошик

```typescript
// Використання в компонентах
const { items, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, totalPrice } = useCart();

// Додати товар
addToCart(product);

// Оновити кількість
updateQuantity('prod-123', 5);

// Видалити товар
removeFromCart('prod-123');
```

### Категорії

```typescript
// Кореневі категорії
const rootCategories = getRootCategories();

// Підкатегорії
const subcategories = getSubcategories('cat-1');

// Категорія за ID
const category = getCategoryById('cat-1-1');
```

### Акції

```typescript
// Активні акції
const activePromos = getActivePromotions();

// Акція за промокодом
const promo = getPromotionByCode('SALE20');
```

## Мок-дані

Проект містить генератор мок-даних з seed-based рандомізацією для консистентності:

- **86 категорій** (13 основних + 73 підкатегорії)
- **5000 товарів** з реалістичними характеристиками
- **100 акцій** різних типів (percentage, fixed, bundle, gift)

### Категорії товарів

1. Смартфони та телефони
2. Ноутбуки та комп'ютери
3. Телевізори та аудіо
4. Техніка для кухні
5. Техніка для дому
6. Краса та здоров'я
7. Дитячі товари
8. Спорт та відпочинок
9. Одяг та взуття
10. Автотовари
11. Інструменти та ремонт
12. Зоотовари
13. Канцтовари та книги

## Адмін-панель

Адмін-панель доступна за адресою `/admin` і включає:

- **Товари** - CRUD операції, імпорт/експорт
- **Замовлення** - управління статусами
- **Клієнти** - база клієнтів
- **Категорії** - ієрархічні категорії
- **Атрибути** - EAV система для динамічних характеристик товарів
- **Акції** - управління промокодами
- **Аналітика** - графіки та звіти
- **Налаштування** - конфігурація магазину
- **Імпорт** - імпорт з Excel/CSV
- **Інтеграції** - зовнішні сервіси
- **Відгуки** - модерація відгуків
- **Контент** - CMS для сторінок
- **Підтримка** - тікети підтримки
- **Користувачі** - ролі та права
- **Склад (WMS)** - повноцінна система управління складом

## EAV (Entity-Attribute-Value) - Система атрибутів товарів

Гнучка система для управління динамічними атрибутами товарів.

### Типи атрибутів

| Тип | Опис | Приклад |
|-----|------|---------|
| **text** | Текстове значення | Назва, опис |
| **number** | Числове значення з одиницями | Вага (кг), об'єм (л) |
| **select** | Вибір одного значення | Бренд, колір |
| **multiselect** | Множинний вибір | Функції, технології |
| **boolean** | Так/Ні | Підтримка 5G, NFC |
| **color** | Колір з HEX кодом | #000000 (Чорний) |
| **range** | Діапазон значень | Діагональ екрану 6.1"-6.7" |

### Функціональність

#### Адмін-панель атрибутів (`/admin/attributes`)
- Перегляд та управління атрибутами
- Створення атрибутів різних типів
- Групування атрибутів (Загальні, Дисплей, Камера...)
- Налаштування фільтрів для категорій

#### Сторінка товару
- Відображення характеристик по групах
- Варіанти товару (колір, пам'ять)
- Табличне відображення з одиницями виміру

#### Фільтри на сторінці категорії
- Динамічні фільтри залежно від категорії
- Фільтри: діапазон, мультивибір, колір, логіка
- Кольорові кружечки для фільтра кольору
- Підрахунок товарів для кожного значення

### Тестування

```bash
# Запуск тестів EAV системи
npm test -- --testPathPatterns="product-page|category-filters|attributes-page"
```

**Тестове покриття:** 98 тестів

Детальна документація ручного тестування: `docs/eav-manual-testing.md`

---

## WMS (Warehouse Management System)

Система управління складом доступна за адресою `/admin/warehouse` і включає:

### Основні функції

| Модуль | Опис | URL |
|--------|------|-----|
| **Дашборд** | Огляд складів, KPI, сповіщення | `/admin/warehouse` |
| **Склади** | Управління складами та магазинами | `/admin/warehouse/warehouses` |
| **Залишки** | Перегляд залишків з фільтрами | `/admin/warehouse/stock` |
| **Приймання** | Оприбуткування від постачальників | `/admin/warehouse/receipt/new` |
| **Відвантаження** | Відправка замовлень | `/admin/warehouse/shipment/new` |
| **Переміщення** | Між складами та магазинами | `/admin/warehouse/transfer/new` |
| **Інвентаризація** | Перевірка залишків | `/admin/warehouse/inventory/new` |

### Розширені функції

| Модуль | Опис | URL |
|--------|------|-----|
| **Закупівлі** | Замовлення постачальникам | `/admin/warehouse/purchases` |
| **Місця зберігання** | Ієрархія зон/стелажів/полиць | `/admin/warehouse/locations` |
| **Постачальники** | Довідник постачальників | `/admin/warehouse/suppliers` |
| **Списання** | Акти списання | `/admin/warehouse/writeoff/new` |
| **Історія рухів** | Журнал всіх операцій | `/admin/warehouse/movements` |
| **Серійні номери** | Облік серійників та партій | `/admin/warehouse/serials` |
| **Резервування** | Перегляд резервів | `/admin/warehouse/reservations` |
| **Налаштування** | Мін. залишки, авто-замовлення | `/admin/warehouse/settings` |
| **Звіти** | ABC/XYZ аналіз, оборотність | `/admin/warehouse/reports` |

### POS (Point of Sale)

Касова система для роздрібної торгівлі `/admin/warehouse/pos`:

- Швидкий пошук товарів
- Фільтрація за категоріями
- Кошик з редагуванням кількості
- Знижки на чек
- Оплата: готівка, картка, Apple/Google Pay
- Розрахунок здачі
- Друк чеків
- Клавіатурні скорочення (F2, F3, Escape)

### Мобільний сканер

Система для сканування штрих-кодів телефоном `/admin/warehouse/scanner`:

```
Як використовувати:

1. На комп'ютері:
   - Відкрийте /admin/warehouse/scanner
   - Натисніть "Я на комп'ютері"
   - Отримайте 6-значний код та QR-код

2. На телефоні (два способи):
   a) Відскануйте QR-код камерою телефону
   b) Відкрийте ту ж сторінку та введіть код

3. Скануйте товари телефоном - дані з'являються на комп'ютері в реальному часі
```

**Особливості:**
- QR-код для швидкого підключення
- Синхронізація в реальному часі
- Звукові сигнали при скануванні
- Ручний ввід штрих-коду
- Історія сканувань

### ABC/XYZ Аналіз

Звіти включають аналітику товарів:

- **ABC** - класифікація за обсягом продажів (A/B/C)
- **XYZ** - класифікація за стабільністю попиту (X/Y/Z)
- **Матриця ABC-XYZ** - комбінований аналіз
- **Оборотність** - дні в запасі, швидкість продажу
- **Мертвий запас** - товари без руху

## ProductCard - Особливості

Компонент картки товару підтримує:

- Відображення знижки (стара/нова ціна)
- Бейджі "Новинка" та "Хіт продажів"
- Індикатор наявності (в наявності / залишилось X шт / немає)
- Додавання в список бажань
- Швидкий перегляд
- Адаптивний дизайн

```tsx
<ProductCard
  product={product}
  showQuickView={true}
/>
```

## Змінні оточення

```env
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## Скрипти

```json
{
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```

## Маркетинг та лояльність

### Промокоди (`/admin/marketing/promo-codes`)

Система управління промокодами з підтримкою:
- **Типи знижок**: відсоток, фіксована сума, безкоштовна доставка, buy X get Y
- **Обмеження**: мінімальна сума, максимальна знижка, ліміт використань
- **Терміни дії**: дата початку та закінчення
- **Статистика**: використання, конверсія

### Програма лояльності (`/profile/loyalty`)

4-рівнева система лояльності:

| Рівень | Мін. балів | Множник | Знижка |
|--------|-----------|---------|--------|
| Bronze | 0 | x1.0 | 0% |
| Silver | 1,000 | x1.25 | 3% |
| Gold | 5,000 | x1.5 | 5% |
| Platinum | 15,000 | x2.0 | 10% |

**Нарахування**: 10 грн = 1 бал × множник рівня
**Використання**: 1 бал = 1 грн знижки

### Подарункові сертифікати (`/gift-cards`)

- **Номінали**: 250, 500, 1000, 2000 грн
- **Дизайни**: день народження, універсальний, свято, подяка
- **Персоналізація**: повідомлення, дані отримувача
- **Перевірка балансу**: за кодом сертифіката

## Email маркетинг (`/admin/marketing/email-campaigns`)

- Створення та редагування кампаній
- Шаблони листів
- Сегментація аудиторії
- Статистика: відкриття, кліки, відписки
- Планування відправки

## SEO

### Meta теги та Metadata API

Централізована конфігурація метаданих для всіх сторінок:

```typescript
// lib/metadata.ts - конфігурація для 14+ сторінок
import { pageMetadata } from '@/lib/metadata';

// Використання в layout.tsx
export const metadata: Metadata = pageMetadata.about;
```

**Налаштовані сторінки:**
- Публічні: `/about`, `/contact`, `/faq`, `/returns`, `/gift-cards`, `/tracking`, `/search`
- Приватні (noindex): `/cart`, `/checkout`, `/wishlist`, `/comparison`, `/orders`, `/account`, `/offline`

### Canonical URLs

Автоматичні canonical URL для всіх сторінок:

```typescript
// lib/metadata.ts
alternates: {
    canonical: getCanonicalUrl('/about'),
}
```

### Robots Meta Tags

Приватні сторінки мають `noindex, follow`:

```typescript
robots: {
    index: false,
    follow: true,
}
```

### Open Graph

Повна підтримка Open Graph для всіх сторінок:

```typescript
openGraph: {
    title: 'Про нас | TechShop',
    description: '...',
    url: 'https://techshop.ua/about',
    siteName: 'TechShop',
    locale: 'uk_UA',
    type: 'website',
}
```

### Структуровані дані (JSON-LD)

```typescript
import ProductJsonLd, {
    OrganizationJsonLd,
    WebSiteJsonLd,
    BreadcrumbJsonLd,
    FAQJsonLd,
    ContactPageJsonLd,
    LocalBusinessJsonLd,
} from '@/components/ProductJsonLd';
```

**Типи схем:**
- `Product` - товари з ціною, наявністю, рейтингом, брендом
- `Organization` - інформація про компанію, контакти, соцмережі
- `WebSite` - пошук на сайті (SearchAction)
- `BreadcrumbList` - хлібні крихти
- `FAQPage` - сторінка FAQ з питаннями та відповідями
- `ContactPage` - контактна сторінка
- `LocalBusiness` / `ElectronicsStore` - фізичний магазин з адресою, графіком роботи

### Оптимізація зображень

Всі зображення використовують `next/image` з оптимальними `sizes`:

```tsx
<Image
    src={product.image_url}
    alt={product.name}
    fill
    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
    className="object-cover"
/>
```

### Performance оптимізації

**React.memo** для запобігання зайвим ре-рендерам:

```tsx
export default memo(ProductCard, (prevProps, nextProps) => {
    return prevProps.product.id === nextProps.product.id &&
           prevProps.product.price === nextProps.product.price &&
           prevProps.product.stock === nextProps.product.stock;
});
```

### Sitemap та Robots
- `/sitemap.xml` - автоматична генерація
- `/robots.txt` - правила індексації

### 404 сторінка

Оптимізована сторінка 404 з `noindex` та корисними посиланнями.

## PWA (Progressive Web App)

### Можливості
- **Офлайн режим**: Service Worker кешує статичні ресурси
- **Встановлення**: Add to Home Screen на Android/iOS
- **Push сповіщення**: Web Push API
- **Background Sync**: синхронізація кошика

### Стратегії кешування
- **API запити**: Network First
- **Зображення**: Cache First
- **Статичні файли**: Cache First
- **HTML сторінки**: Network First

### Ярлики (Shortcuts)
- Каталог → `/catalog`
- Кошик → `/cart`
- Відстеження → `/tracking`

## Docker та CI/CD

### Локальний запуск з Docker

```bash
# Запуск всіх сервісів
docker-compose up -d

# Тільки база даних
docker-compose up -d db redis

# Перегляд логів
docker-compose logs -f storefront
```

### Сервіси docker-compose

| Сервіс | Порт | Опис |
|--------|------|------|
| storefront | 3000 | Next.js додаток |
| db | 5432 | PostgreSQL 15 |
| redis | 6379 | Redis кеш |
| nginx | 80, 443 | Reverse proxy (production) |

### CI/CD Pipeline

GitHub Actions workflow включає:
1. **Lint & Type Check** - ESLint, TypeScript
2. **Tests** - Jest з покриттям
3. **Build** - Next.js production build
4. **Docker** - Build & push image
5. **Deploy Staging** - автоматично
6. **Deploy Production** - manual approval
7. **Security Scan** - npm audit, Snyk
8. **Lighthouse** - performance audit

## Нові функції (v2.0)

### Платіжні системи

#### LiqPay

```typescript
import { liqpay } from '@/lib/payments';

// Створення платежу
const payment = await liqpay.createPayment({
    orderId: 'ORD-123',
    amount: 45000,
    currency: 'UAH',
    description: 'Замовлення #123',
    resultUrl: 'https://shop.com/order/123',
    serverUrl: 'https://shop.com/api/payments/liqpay/callback',
});

// Перевірка статусу
const status = await liqpay.getPaymentStatus(orderId);

// Повернення коштів
await liqpay.refund(paymentId, amount, 'Повернення товару');
```

**Типи оплати:** card, liqpay, privat24, masterpass, moment_part (оплата частинами)

#### Monobank Acquiring

```typescript
import { monobank } from '@/lib/payments';

// Створення інвойсу
const invoice = await monobank.createInvoice({
    amount: 45000,
    merchantPaymInfo: {
        reference: 'ORD-123',
        destination: 'Замовлення #123',
    },
    redirectUrl: 'https://shop.com/order/123',
    webHookUrl: 'https://shop.com/api/payments/monobank/webhook',
});

// Перевірка статусу
const status = await monobank.getInvoiceStatus(invoiceId);

// Оплата частинами
const partpayInvoice = await monobank.createInvoice({
    ...options,
    paymentType: 'debit',
});
```

#### Уніфікований інтерфейс

```typescript
import { payments } from '@/lib/payments';

// Вибір провайдера автоматично
const payment = await payments.createPayment({
    provider: 'auto', // 'liqpay' | 'monobank' | 'auto'
    orderId: 'ORD-123',
    amount: 45000,
});

// Перевірка статусу будь-якого платежу
const status = await payments.getPaymentStatus(paymentId, provider);

// Обробка webhook
const result = await payments.handleWebhook(provider, body, signature);
```

**Env змінні:**
```env
LIQPAY_PUBLIC_KEY=your-public-key
LIQPAY_PRIVATE_KEY=your-private-key
MONOBANK_TOKEN=your-token
```

### Система лояльності

5-рівнева система лояльності з бонусами:

```typescript
import { loyaltyService, LOYALTY_TIERS } from '@/lib/loyalty';

// Нарахування балів
await loyaltyService.earnPoints(userId, purchaseAmount, orderId);

// Використання балів
const result = await loyaltyService.redeemPoints(userId, pointsToRedeem, 'order_discount', orderId);

// Реферальна програма
await loyaltyService.processReferral(referrerId, newUserId, firstPurchaseAmount);

// День народження бонус
await loyaltyService.applyBirthdayBonus(userId);
```

| Рівень | Мін. витрати | Cashback | Множник балів |
|--------|-------------|----------|---------------|
| Bronze | 0 грн | 3% | x1 |
| Silver | 5,000 грн | 5% | x1.25 |
| Gold | 20,000 грн | 7% | x1.5 |
| Platinum | 50,000 грн | 10% | x2 |
| Diamond | 100,000 грн | 15% | x3 |

**Бонуси:**
- День народження: x2 бали протягом тижня
- Реферальна програма: 500 балів за запрошення
- Щомісячні завдання
- Спеціальні акції для рівнів

### Чат підтримки (Live Chat)

Real-time чат з операторами підтримки:

```typescript
import { useChatContext, ChatProvider } from '@/lib/chat';

// В компоненті
const { isOpen, openChat, sendMessage, currentChat } = useChatContext();
```

**Можливості:**
- WebSocket підключення для real-time повідомлень
- Статуси операторів (online/offline/away)
- Індикатор набору тексту
- Історія чатів
- Завантаження файлів
- Рейтинг оператора після завершення

### Push-сповіщення

Система push-сповіщень для клієнтів:

```typescript
import { pushNotifications } from '@/lib/notifications';

// Запит дозволу
await pushNotifications.requestPermission();

// Створення сповіщення про статус замовлення
const payload = pushNotifications.createOrderStatusNotification(orderId, 'shipped');

// Створення сповіщення про зниження ціни
const priceAlert = pushNotifications.createPriceDropNotification(productName, oldPrice, newPrice);
```

**Типи сповіщень:**
- `order_status` - статус замовлення
- `price_drop` - зниження ціни
- `back_in_stock` - товар знову в наявності
- `promo` - акції та знижки
- `delivery` - статус доставки
- `abandoned_cart` - покинутий кошик

### Поширення списку бажань

Можливість ділитися списками бажань:

```typescript
import { wishlistSharing, sharePlatforms } from '@/lib/wishlist';

// Створення публічного списку
const shareableList = await wishlistSharing.createShareableWishlist(userId, title, items);

// Генерація посилання для соцмереж
const fbUrl = wishlistSharing.generateShareUrl('facebook', shareableList.shortCode, title);

// QR-код для поширення
const qrCode = await wishlistSharing.generateQRCode(shortCode);

// Експорт у CSV/JSON/PDF
const csv = await wishlistSharing.exportWishlist(shortCode, 'csv');
```

**Платформи:**
- Facebook, Twitter
- Telegram, Viber, WhatsApp
- Email, Copy Link
- QR-код

### Сповіщення про зниження ціни

Система відстеження цін:

```typescript
import { priceAlerts } from '@/lib/price-alerts';

// Створення сповіщення
const alert = await priceAlerts.createAlert(userId, {
    productId: '123',
    productName: 'iPhone 15',
    currentPrice: 45000,
    targetPrice: 40000,
    alertType: 'target_price', // 'any_drop' | 'target_price' | 'percentage_drop'
    notifyVia: ['push', 'email'],
});

// Перевірка падіння ціни
const triggered = priceAlerts.checkPriceDrop(alert, newPrice);
```

### Комплекти товарів (Bundles)

Продаж товарів комплектами зі знижкою:

```typescript
import { productBundles } from '@/lib/bundles';

// Отримати активні комплекти
const bundles = productBundles.getActiveBundles();

// Розрахунок ціни комплекту
const pricing = productBundles.calculateBundlePrice(bundle, selectedItems);

// Валідація вибору
const { valid, errors } = productBundles.validateBundleSelection(bundle, selectedItems);
```

**Типи комплектів:**
- `fixed` - фіксований набір товарів
- `mix_match` - вибір з категорій
- `bogo` - купи X отримай Y безкоштовно
- `tiered` - знижка за кількість

**Типи знижок:**
- `percentage` - відсоток від суми
- `fixed_amount` - фіксована знижка
- `fixed_price` - фіксована ціна комплекту

### Розширена аналітика

Детальна аналітика поведінки користувачів:

```typescript
import { advancedAnalytics } from '@/lib/analytics';

// E-commerce трекінг
advancedAnalytics.trackProductView({ id, name, category, price });
advancedAnalytics.trackAddToCart({ id, name, price, quantity });
advancedAnalytics.trackPurchase({ orderId, total, items });

// Воронка продажів
const funnel = await advancedAnalytics.getFunnelAnalysis('purchase-funnel');

// Когортний аналіз
const cohorts = await advancedAnalytics.getCohortAnalysis('weekly');

// Heatmap
const heatmap = await advancedAnalytics.getHeatmapData('/products');

// A/B тестування
const variant = advancedAnalytics.getABVariant('button-color-test');
```

**Функціональність:**
- Автоматичний трекінг page_view, scroll_depth, time_on_page
- Воронка конверсії з drop-off аналізом
- Когортний аналіз ретеншену
- Теплові карти кліків та скролу
- A/B тестування з статистичною значущістю
- Attribution моделювання
- Customer journey аналіз

### Redis Кешування

Серверне кешування з Redis:

```typescript
import { redisCache } from '@/lib/cache';

// Базове кешування
await redisCache.set('key', value, { ttl: 3600, tags: ['products'] });
const cached = await redisCache.get('key');

// Get or Set pattern
const data = await redisCache.getOrSet('key', async () => {
    return await fetchExpensiveData();
}, { ttl: 600 });

// Спеціалізоване кешування
await redisCache.cacheProduct(productId, () => fetchProduct(productId));
await redisCache.cacheSearchResults(query, filters, () => search(query));

// Інвалідація
await redisCache.invalidateProduct(productId);
await redisCache.invalidateByTag('products');

// Rate limiting
const { allowed, remaining } = await redisCache.checkRateLimit('user:123', 100, 60);

// Distributed locking
const lockId = await redisCache.acquireLock('resource:1', 30);
await redisCache.releaseLock('resource:1', lockId);
```

### Інтеграція з маркетплейсами

#### Rozetka

```typescript
import { rozetka } from '@/lib/marketplaces';

// Синхронізація товарів
const result = await rozetka.syncProducts(products);

// Оновлення залишків та цін
await rozetka.updateStock(productId, quantity);
await rozetka.updatePrice(productId, price, oldPrice);

// Робота з замовленнями
const orders = await rozetka.getOrders('new');
await rozetka.updateOrderStatus(orderId, 'shipped', trackingNumber);
```

#### Prom.ua

```typescript
import { prom } from '@/lib/marketplaces';

// Синхронізація товарів
await prom.syncProducts(products);

// Встановлення знижки
await prom.setDiscount(productId, { type: 'percent', value: 15 });

// Генерація YML фіду
const xmlFeed = prom.generateProductFeed();

// Повідомлення клієнтам
await prom.sendMessage(chatId, 'Товар відправлено');
```

#### Уніфікований інтерфейс

```typescript
import { marketplaces } from '@/lib/marketplaces';

// Всі підключення
const connections = await marketplaces.getConnections();

// Синхронізація на всі маркетплейси
await marketplaces.syncProduct(unifiedProduct);
await marketplaces.syncStock(productId, quantity);

// Всі замовлення з усіх маркетплейсів
const allOrders = await marketplaces.getAllOrders();

// Загальна статистика
const stats = await marketplaces.getCombinedStats();
```

### Адмін-панель: CMS

Система управління контентом:

```typescript
import { cms } from '@/lib/admin/cms';

// Сторінки
const page = await cms.getPage('about-us');
await cms.createPage({ title, slug, content: blocks });
await cms.publishPage(pageId);

// Банери
const banners = await cms.getBanners('homepage_hero');
await cms.trackBannerImpression(bannerId);

// Меню
const menu = await cms.getMenu('header');
await cms.updateMenu(menuId, items);
```

**Типи блоків:**
hero, text, image, gallery, video, products, categories, banner, cta, testimonials, faq, form, html, spacer, divider, columns, tabs, accordion

### Адмін-панель: Bulk операції

Масове редагування товарів:

```typescript
import { bulkOperations } from '@/lib/admin/bulk-operations';

// Масове оновлення цін
await bulkOperations.bulkUpdatePrices({
    productIds: ['1', '2', '3'],
    updateType: 'percentage',
    value: 10,
    direction: 'decrease',
});

// Масове присвоєння категорії
await bulkOperations.bulkAssignCategory(productIds, categoryId);

// Імпорт з файлу
const { headers, rows, preview } = await bulkOperations.parseImportFile(file);
await bulkOperations.importData(importConfig);

// Експорт
await bulkOperations.exportData({ entityType: 'products', format: 'xlsx', fields });
```

### Адмін-панель: Dashboard Analytics

```typescript
import { dashboardAnalytics } from '@/lib/admin/dashboard-analytics';

// Статистика дашборду
const stats = await dashboardAnalytics.getDashboardStats();
// { revenue, orders, customers, products, realtime }

// Звіт продажів
const salesReport = await dashboardAnalytics.getSalesReport(dateRange);

// Звіт клієнтів
const customerReport = await dashboardAnalytics.getCustomerReport(dateRange);

// Realtime статистика
const realtime = await dashboardAnalytics.getRealtimeStats();

// Експорт звітів
const file = dashboardAnalytics.exportReport('sales', 'xlsx', dateRange);
```

## API Routes

### Маркетплейси (`/api/marketplaces`)

```typescript
// GET /api/marketplaces - отримати підключення та статистику
// GET /api/marketplaces?action=connections - тільки підключення
// GET /api/marketplaces?action=orders - замовлення з маркетплейсів

// POST /api/marketplaces - дії
fetch('/api/marketplaces', {
    method: 'POST',
    body: JSON.stringify({
        action: 'sync-product', // 'sync-stock', 'sync-price', 'update-order-status'
        marketplace: 'rozetka',
        data: { product: {...} }
    })
});
```

### Синхронізація (`/api/marketplaces/sync`)

```typescript
// POST - повна синхронізація
fetch('/api/marketplaces/sync', {
    method: 'POST',
    body: JSON.stringify({
        marketplace: 'rozetka', // або 'prom', або null для всіх
        syncType: 'full',
        productIds: ['id1', 'id2'] // опціонально
    })
});
```

### Webhooks

#### Rozetka (`/api/webhooks/rozetka`)

```typescript
// Події:
// - order.created - нове замовлення
// - order.status_changed - зміна статусу
// - order.cancelled - скасування
// - product.moderation_passed - товар пройшов модерацію
// - product.moderation_failed - товар відхилено
// - message.received - повідомлення від клієнта
// - review.created - новий відгук
```

#### Prom.ua (`/api/webhooks/prom`)

```typescript
// Події:
// - order_created - нове замовлення
// - order_accepted - замовлення прийнято
// - order_canceled - скасування
// - message_received - повідомлення
// - product_out_of_stock - товар закінчився
// - price_recommendation - рекомендація ціни
// - feedback_received - відгук
// - question_asked - питання про товар
```

## База даних (Prisma)

### Налаштування

```bash
# Встановити Prisma CLI
npm install prisma --save-dev

# Згенерувати клієнт
npx prisma generate

# Застосувати міграції
npx prisma migrate dev

# Відкрити Prisma Studio
npx prisma studio
```

### Основні моделі

| Модель | Опис |
|--------|------|
| `User` | Користувачі з ролями |
| `Product` | Товари з атрибутами |
| `Category` | Категорії (ієрархічні) |
| `Order` | Замовлення |
| `Cart` | Кошик |
| `Warehouse` | Склади |
| `Inventory` | Залишки |
| `MarketplaceProduct` | Зв'язок з маркетплейсами |
| `Bundle` | Комплекти товарів |
| `PriceAlert` | Сповіщення про ціну |
| `LoyaltyPoints` | Бали лояльності |
| `Page` | CMS сторінки |
| `Banner` | Банери |

### Приклад використання

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Отримати товари з категорією
const products = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    include: { category: true, images: true },
    take: 20,
});

// Створити замовлення
const order = await prisma.order.create({
    data: {
        orderNumber: 'ORD-001',
        customerEmail: 'test@example.com',
        items: { create: [...] },
    },
});
```

## Background Jobs

### Черги задач

```typescript
import { jobQueue, scheduleJob } from '@/lib/jobs/queue';

// Додати задачу
await scheduleJob.marketplaceSync('rozetka');
await scheduleJob.sendEmail('user@email.com', 'order_confirmation', data);
await scheduleJob.processOrder(orderId);

// З затримкою
await scheduleJob.sendPush(userId, title, message, { delay: 5000 });

// З повторами
await jobQueue.add('queue', 'job', data, { maxAttempts: 5 });

// Статистика черги
const stats = jobQueue.getStats('marketplace');
// { pending: 5, processing: 1, completed: 100, failed: 2, delayed: 3 }
```

### Типи черг

| Черга | Призначення |
|-------|-------------|
| `marketplace` | Синхронізація з маркетплейсами |
| `orders` | Обробка замовлень |
| `inventory` | Оновлення залишків |
| `email` | Відправка email |
| `notifications` | Push-сповіщення |
| `alerts` | Перевірка сповіщень про ціну |
| `analytics` | Обробка аналітики |
| `reports` | Генерація звітів |
| `cache` | Інвалідація кешу |
| `images` | Оптимізація зображень |

## Моніторинг

### Sentry

```typescript
import { captureError, setUser, addBreadcrumb } from '@/lib/monitoring/sentry';

// Помилки
captureError(new Error('Something went wrong'), { context: 'checkout' });

// Користувач
setUser({ id: '123', email: 'user@email.com' });

// Breadcrumbs
addBreadcrumb('checkout', 'Started checkout', { cartTotal: 1000 });

// Обгортка для async функцій
const safeFunction = withErrorTracking(async () => {
    // ваш код
});
```

### Метрики

```typescript
import { metrics } from '@/lib/monitoring/metrics';

// HTTP запити
metrics.trackRequest('GET', '/api/products', 200, 45);

// База даних
metrics.trackDatabaseQuery('SELECT', 'products', 12);

// Кеш
metrics.trackCacheOperation('get', true); // hit
metrics.trackCacheOperation('get', false); // miss

// Маркетплейси
metrics.trackMarketplaceSync('rozetka', true, 500);

// Замовлення
metrics.trackOrder('rozetka', 45000);

// Таймінг
const stopTimer = metrics.startTimer('api_request_duration');
// ... виконання
stopTimer();

// Async таймінг
const result = await metrics.timeAsync('db_query', async () => {
    return await fetchData();
});

// Prometheus формат
const prometheusMetrics = metrics.toPrometheusFormat();

// JSON формат
const jsonMetrics = metrics.toJSON();
```

### Datadog інтеграція

Встановіть змінні оточення:
```env
DATADOG_API_KEY=your-api-key
DATADOG_APP_KEY=your-app-key
```

Метрики автоматично надсилаються до Datadog.

## E2E тести (Playwright)

### Налаштування

```bash
# Встановити Playwright
npx playwright install

# Запустити тести
npx playwright test

# З UI
npx playwright test --ui

# Один файл
npx playwright test e2e/checkout.spec.ts

# Звіт
npx playwright show-report
```

### Тестові сценарії

#### Checkout (`e2e/checkout.spec.ts`)

- Повний флоу оформлення замовлення
- Валідація форм
- Застосування промокоду
- Оновлення кількості в кошику
- Видалення товарів
- Збереження кошика між сесіями
- Гостьовий checkout
- Методи оплати
- Мобільний checkout

#### Admin (`e2e/admin.spec.ts`)

- Dashboard статистика
- CRUD товарів
- Управління замовленнями
- Аналітика
- Маркетплейси
- CMS
- Bulk операції
- Авторизація адміна

### Конфігурація

```typescript
// playwright.config.ts
export default defineConfig({
    testDir: './e2e',
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        { name: 'chromium', use: devices['Desktop Chrome'] },
        { name: 'firefox', use: devices['Desktop Firefox'] },
        { name: 'webkit', use: devices['Desktop Safari'] },
        { name: 'Mobile Chrome', use: devices['Pixel 5'] },
        { name: 'Mobile Safari', use: devices['iPhone 12'] },
    ],
});
```

## Performance оптимізація

### Next.js Config

```typescript
// next.config.ts
const nextConfig = {
    // Оптимізація зображень
    images: {
        formats: ['image/avif', 'image/webp'],
        minimumCacheTTL: 60 * 60 * 24 * 7,
    },

    // Модульний імпорт (tree shaking)
    modularizeImports: {
        '@heroicons/react/24/outline': {
            transform: '@heroicons/react/24/outline/{{member}}',
        },
        'date-fns': { transform: 'date-fns/{{member}}' },
        lodash: { transform: 'lodash/{{member}}' },
    },

    // Оптимізація пакетів
    experimental: {
        optimizePackageImports: ['@heroicons/react', 'lucide-react'],
    },
};
```

### Bundle аналіз

```bash
# Аналіз bundle size
ANALYZE=true npm run build

# Відкриється звіт у браузері
```

### Кешування (Cache-Control)

| Ресурс | TTL | Стратегія |
|--------|-----|-----------|
| `/_next/static/*` | 1 рік | immutable |
| `/images/*` | 7 днів | stale-while-revalidate |
| `/api/*` | no-store | -  |

### Lazy Loading

```typescript
// Динамічний імпорт компонентів
const HeavyComponent = dynamic(() => import('@/components/HeavyComponent'), {
    loading: () => <Skeleton />,
    ssr: false,
});

// Зображення
import Image from 'next/image';
<Image src={src} loading="lazy" placeholder="blur" />
```

## Нові функції (v2.5)

### Платіжні системи - ПриватБанк

Інтеграція з ПриватБанком для українського ринку:

```typescript
import { createPayment, createInstallmentPayment, calculateInstallmentPlans } from '@/lib/privatbank';

// Створення платежу
const payment = createPayment({
    orderId: 'ORD-123',
    amount: 45000,
    description: 'Замовлення #123',
});

// Оплата частинами (розстрочка)
const installmentPayment = createInstallmentPayment({
    orderId: 'ORD-123',
    amount: 45000,
    description: 'Замовлення #123',
    months: 4,
    customerPhone: '+380501234567',
});

// Розрахунок планів розстрочки
const plans = calculateInstallmentPlans(45000);
// [{ months: 2, monthlyPayment: 22500, interestRate: 0 }, ...]
```

**Доступні плани розстрочки:**
| Місяців | Ставка | Опис |
|---------|--------|------|
| 2 | 0% | Без переплат |
| 3 | 0% | Без переплат |
| 4 | 0% | Без переплат |
| 6 | 2.5% | Мінімальний відсоток |
| 10 | 5% | |
| 12 | 7% | |
| 24 | 15% | |

### Служби доставки

Інтеграція з додатковими службами доставки:

```typescript
import { meestApi, justinApi, ukrposhtaApi, getAllDeliveryPrices, checkFreeShipping } from '@/lib/delivery-services';

// Пошук міст
const cities = await meestApi.searchCities('Київ');

// Отримати відділення
const warehouses = await justinApi.getWarehouses('cityId');

// Розрахунок вартості
const price = await ukrposhtaApi.calculatePrice({
    fromCity: 'Київ',
    toCity: 'Львів',
    weight: 1,
    declaredValue: 1000,
});

// Ціни всіх служб
const allPrices = await getAllDeliveryPrices({
    fromCity: 'Київ',
    toCity: 'Одеса',
    weight: 2,
    declaredValue: 5000,
});

// Перевірка безкоштовної доставки
const freeShipping = checkFreeShipping('meest', 2500);
// { isFree: true, threshold: 2000, remaining: 0 }
```

**Підтримувані служби:**
- **Meest** - безкоштовна доставка від 2000 грн
- **Justin** - безкоштовна доставка від 1500 грн
- **Укрпошта** - безкоштовна доставка від 1000 грн

### Компоненти UX

#### StockBadge - Індикатор наявності

```tsx
import StockBadge, { StockIndicator, StockProgressBar } from '@/components/StockBadge';

// Бейдж статусу
<StockBadge stock={3} showCount lowStockThreshold={5} />
// "Залишилось 3 шт!"

// Передзамовлення
<StockBadge stock={0} preorderDate="2024-02-15" />
// "Передзамовлення (15 лют.)"

// Індикатор для карток
<StockIndicator stock={100} />

// Прогрес-бар
<StockProgressBar stock={25} maxStock={100} />
```

#### FreeShippingProgress - Прогрес безкоштовної доставки

```tsx
import FreeShippingProgress from '@/components/FreeShippingProgress';

// Звичайний варіант
<FreeShippingProgress cartTotal={800} threshold={1000} />

// Компактний
<FreeShippingProgress cartTotal={800} threshold={1000} variant="compact" />

// Банер
<FreeShippingProgress cartTotal={800} threshold={1000} variant="banner" />
```

#### SearchAutocomplete - Пошук з автодоповненням

```tsx
import SearchAutocomplete from '@/components/SearchAutocomplete';

<SearchAutocomplete
    placeholder="Пошук товарів..."
    showTrending
    showRecent
    onSearch={(query) => router.push(`/search?q=${query}`)}
/>
```

**Можливості:**
- Fuzzy matching (нечіткий пошук)
- Підсвітка співпадінь
- Недавні пошуки (localStorage)
- Популярні запити
- Навігація клавіатурою

#### ProductVideo - Відео товару

```tsx
import ProductVideo, { Product360Viewer, ProductMediaGallery } from '@/components/ProductVideo';

// Відео плеєр
<ProductVideo
    src="/videos/product-demo.mp4"
    poster="/images/poster.jpg"
    title="Огляд товару"
/>

// 360° перегляд
<Product360Viewer
    images={frames360}
    autoRotate
    autoRotateSpeed={100}
/>

// Медіа галерея
<ProductMediaGallery
    items={[
        { type: 'image', src: '/img1.jpg' },
        { type: 'video', src: '/video.mp4' },
        { type: '360', images: frames360 },
    ]}
    productName="iPhone 15"
/>
```

#### FrequentlyBoughtTogether - Часто купують разом

```tsx
import FrequentlyBoughtTogether from '@/components/FrequentlyBoughtTogether';

<FrequentlyBoughtTogether
    currentProduct={product}
    recommendedProducts={recommendations}
    title="Часто купують разом"
/>
```

**Можливості:**
- Вибір товарів для додавання
- Знижка 5% за комплект
- Розрахунок загальної ціни
- Одночасне додавання в кошик

### Аналітика

#### RFM аналіз клієнтів

```typescript
import { analyzeCustomer, analyzeAllCustomers, getSegmentInsights, CUSTOMER_SEGMENTS } from '@/lib/analytics/rfm-analysis';

// Аналіз одного клієнта
const analysis = analyzeCustomer(customer);
// { scores: { recency: 5, frequency: 4, monetary: 3, total: 12 }, segment: 'loyal_customers', ... }

// Масовий аналіз
const { results, summary } = analyzeAllCustomers(customers);

// Рекомендації для сегменту
const insights = getSegmentInsights('at_risk');
// { actions: ['Win-back кампанія', ...], kpis: [...], emailTemplates: [...] }
```

**Сегменти:**
| Сегмент | Бали | Опис |
|---------|------|------|
| Champions | 13-15 | Найкращі клієнти |
| Loyal Customers | 10-12 | Лояльні покупці |
| Potential Loyalists | 8-9 | Потенційно лояльні |
| New Customers | 6-7 | Нові клієнти |
| At Risk | 4-5 | Під загрозою відтоку |
| Hibernating | 1-3 | Сплячі клієнти |

#### Моніторинг цін конкурентів

```typescript
import { analyzeMarketPosition, generatePriceAlerts, calculateOptimalPrice, COMPETITORS } from '@/lib/analytics/price-monitoring';

// Аналіз позиції на ринку
const analysis = analyzeMarketPosition(ourPrice, competitorPrices);
// { marketPosition: 'below_average', recommendation: { action: 'keep' }, ... }

// Генерація сповіщень
const alerts = generatePriceAlerts(product, competitorPrices);

// Розрахунок оптимальної ціни
const optimal = calculateOptimalPrice(currentPrice, costPrice, analysis);
```

**Конкуренти:**
Rozetka, Citrus, Foxtrot, Comfy, Епіцентр К, Алло, MOYO

#### Воронка конверсії

```typescript
import { calculateFunnelMetrics, analyzeDropoff, getFunnelHealthScore, ECOMMERCE_FUNNEL_STAGES } from '@/lib/analytics/conversion-funnel';

// Розрахунок метрик
const metrics = calculateFunnelMetrics(events);

// Аналіз відтоку
const dropoffAnalysis = analyzeDropoff(events, metrics);

// Здоров'я воронки
const health = getFunnelHealthScore(metrics);
// { score: 85, grade: 'B', issues: [...], improvements: [...] }
```

**Етапи воронки:**
1. Відвідування сайту
2. Перегляд товару
3. Додано до кошика
4. Перегляд кошика
5. Початок оформлення
6. Дані доставки
7. Дані оплати
8. Замовлення завершено

#### Аналітика повернень

```typescript
import { calculateReturnMetrics, analyzeProductReturns, analyzePreventableReturns, getReturnsDashboardSummary } from '@/lib/analytics/returns-analytics';

// Метрики повернень
const metrics = calculateReturnMetrics(returns, totalOrders);
// { returnRate: 3.5, avgProcessingTime: 4.2, reasonBreakdown: [...] }

// Аналіз по товарах
const productAnalysis = analyzeProductReturns(returns, salesData);

// Запобіжні повернення
const preventable = analyzePreventableReturns(returns);
// { preventableCount: 45, potentialSavings: 125000 }

// Dashboard
const summary = getReturnsDashboardSummary(returns, totalOrders);
```

**Причини повернень:**
- Бракований товар
- Не відповідає опису
- Надіслано не той товар
- Передумав
- Не підійшов розмір
- Знайшов дешевше
- Прийшло пізно
- Пошкоджено при доставці
- Проблеми з якістю

### API Endpoints

```typescript
// Пошук з автодоповненням
GET /api/search/suggestions?q=iphone&limit=10
// { suggestions: [{ id, type, text, url, image, price, highlight }] }
```

## Нові функції (v3.0)

### Система відгуків 2.0

Покращена система відгуків з медіа-контентом та верифікацією:

```typescript
import { filterReviews, calculateReviewStats, validateReviewMedia, REVIEW_GUIDELINES } from '@/lib/reviews';

// Фільтрація відгуків
const filtered = filterReviews(reviews, {
    status: 'approved',
    minRating: 4,
    hasMedia: true,
    sortBy: 'helpful',
});

// Статистика
const stats = calculateReviewStats(reviews);
// { totalReviews, averageRating, distribution, verifiedPurchaseRate }

// Валідація медіа
const validation = validateReviewMedia(file);
// { valid: true } або { valid: false, error: 'error message' }
```

**Можливості:**
- Фото/відео у відгуках
- Голосування за корисність
- Верифіковані покупки
- Модерація контенту

### SMS-сповіщення

Система SMS-сповіщень для клієнтів:

```typescript
import { formatPhoneNumber, validatePhoneNumber, renderTemplate, getTemplate, SMS_TEMPLATES } from '@/lib/sms-notifications';

// Форматування номеру
const formatted = formatPhoneNumber('050-123-45-67');
// +380501234567

// Відправка SMS
const template = getTemplate('order_shipped');
const text = renderTemplate(template!, { orderId: '123', carrier: 'Нова Пошта', trackingNumber: 'TTH123' });
```

**Типи сповіщень:**
- Статус замовлення
- Код верифікації
- Повернення товару
- Зниження ціни
- Товар в наявності

### Сповіщення про наявність

Підписка на сповіщення коли товар з'явиться в наявності:

```typescript
import { subscribeToNotification, getProductSubscribers, formatNotification } from '@/lib/stock-notifications';

// Підписка
await subscribeToNotification({
    productId: '123',
    email: 'user@email.com',
    phone: '+380501234567',
    notifyVia: ['email', 'push'],
});
```

### Списки бажань

Публічні та приватні списки бажань з можливістю поширення:

```typescript
import { createWishlist, addToWishlist, shareWishlist, getWishlistByShareCode } from '@/lib/wishlists';

// Створення списку
const wishlist = await createWishlist(userId, 'День народження', false);

// Поширення
const shareCode = await shareWishlist(wishlistId);
```

### Оптимізований Checkout

One-page checkout з guest режимом та збереженими адресами:

```typescript
import { validateCustomerInfo, validateDeliveryInfo, calculateTotals, CHECKOUT_STEPS, DELIVERY_METHODS } from '@/lib/checkout';

// Валідація кроків
const customerErrors = validateCustomerInfo(customerInfo);
const deliveryErrors = validateDeliveryInfo(deliveryInfo);

// Розрахунок підсумків
const totals = calculateTotals(checkoutState);
```

### Система купонів

Розширена система промокодів та знижок:

```typescript
import { validateCoupon, generateCouponCode, formatCouponDiscount, COUPON_TYPE_LABELS } from '@/lib/coupons';

// Валідація
const result = validateCoupon(coupon, cartItems, userId, orderCount);
// { valid: true, discount: 400, freeShipping: false }

// Генерація коду
const code = generateCouponCode('SALE');
// SALE-A7B3C
```

**Типи купонів:**
- Відсоток знижки
- Фіксована сума
- Безкоштовна доставка
- Купи X отримай Y
- Бандли
- Кешбек

### A/B тестування

Система експериментів для оптимізації UI:

```typescript
import { assignVariant, matchesTargeting, calculateSignificance, isSignificant, DEFAULT_METRICS } from '@/lib/ab-testing';

// Призначення варіанту
const variant = assignVariant(experiment, userId, sessionId);

// Статистичний аналіз
const significance = calculateSignificance(controlConversions, controlParticipants, variantConversions, variantParticipants);
```

### Дашборд продажів

Аналітика продажів з графіками та KPI:

```typescript
import { calculateSalesOverview, calculateTopProducts, calculateSalesTrends, formatTrend } from '@/lib/admin/sales-dashboard';

// Огляд продажів
const overview = calculateSalesOverview(orders);

// Топ товари
const topProducts = calculateTopProducts(orderItems, previousPeriodItems);
```

### Управління складом

Інвентаризація та відстеження руху товарів:

```typescript
import { calculateInventoryStatus, shouldReorder, calculateReorderQuantity, validateMovementInput } from '@/lib/admin/inventory';

// Статус запасів
const status = calculateInventoryStatus(quantity, minStock, maxStock);
// 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstock'

// Потреба в дозамовленні
const needsReorder = shouldReorder(item);
```

### CRM система

Управління клієнтами та сегментація:

```typescript
import { calculateCLV, calculateLTV, daysSince, matchesSegmentRules, buildCustomerQuery } from '@/lib/admin/crm';

// CLV та LTV
const clv = calculateCLV(customer);
const ltv = calculateLTV(orders);

// Сегментація
const matches = matchesSegmentRules(customer, segmentRules);
```

### Звіти та експорт

Генерація звітів у PDF/Excel:

```typescript
import { generateReport, getReportDefinitions, formatReportData, REPORT_FORMATS } from '@/lib/admin/reports';

// Генерація звіту
const report = await generateReport('sales', {
    dateFrom: new Date('2024-01-01'),
    dateTo: new Date('2024-12-31'),
    format: 'xlsx',
});
```

## Платіжні вебхуки

Система автоматичного оновлення статусу замовлень після оплати:

### LiqPay Callback

```typescript
// POST /api/payments/liqpay/callback
import { handleLiqPayCallback } from '@/lib/payments/order-payment-handler';

// Автоматично:
// - Оновлює статус замовлення (PAID, FAILED, REFUNDED)
// - Логує всі події платежу
// - Відправляє сповіщення користувачу
```

### Monobank Webhook

```typescript
// POST /api/payments/monobank/webhook
import { handleMonobankWebhook } from '@/lib/payments/order-payment-handler';

// Підтримувані статуси:
// - success → PAID
// - failure/expired → FAILED
// - reversed → REFUNDED
// - hold → PENDING
```

### Обробка повернень

```typescript
import { handleRefund } from '@/lib/payments/order-payment-handler';

await handleRefund('order-123', 'liqpay', 1500, 'Причина повернення');
```

## Search Console Верифікація

Додайте коди верифікації в `.env`:

```bash
# Google Search Console
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION="ваш-код-верифікації"

# Bing Webmaster Tools
NEXT_PUBLIC_BING_VERIFICATION="ваш-код-верифікації"

# Yandex Webmaster
NEXT_PUBLIC_YANDEX_VERIFICATION="ваш-код-верифікації"
```

## Інтернаціоналізація (i18n)

Підтримувані мови: **українська (uk)**, **англійська (en)**, **російська (ru)**, **польська (pl)**

### Використання перекладів

```typescript
import { useI18n, useTranslation } from '@/lib/i18n';

function MyComponent() {
    const { t, locale, setLocale, formatCurrency } = useI18n();

    return (
        <div>
            <h1>{t('product.addToCart')}</h1>
            <p>{formatCurrency(1500)}</p>
            <button onClick={() => setLocale('pl')}>Polski</button>
        </div>
    );
}
```

### Плюралізація

```typescript
import { pluralize } from '@/lib/i18n';

// Українська: 1 товар, 2 товари, 5 товарів
pluralize('uk', 1, { one: 'товар', few: 'товари', many: 'товарів' }); // → "товар"
pluralize('uk', 3, { one: 'товар', few: 'товари', many: 'товарів' }); // → "товари"

// Польська: 1 produkt, 2 produkty, 5 produktów
pluralize('pl', 1, { one: 'produkt', few: 'produkty', many: 'produktów' }); // → "produkt"
```

### Перемикач мови

```tsx
import { LanguageSelector } from '@/lib/i18n';

// Dropdown варіант
<LanguageSelector variant="dropdown" showFlag showName />

// Кнопки
<LanguageSelector variant="buttons" />
```

### Додавання нової мови

1. Створіть файл перекладів `lib/i18n/translations/de.ts`
2. Додайте локаль в `lib/i18n/i18n.ts`:
   - Тип `Locale`
   - Масив `locales`
   - Конфіг `localeConfigs`
   - Правила `pluralRules`
3. Оновіть `lib/i18n/translations/index.ts`

## Безпека

### Захист від DoS (Pagination)

Всі API endpoints з пагінацією захищені від DoS атак:

```typescript
import { parsePagination, parseEnumParam } from '@/lib/security/pagination';

// Автоматичне обмеження pageSize (максимум 100)
const { page, pageSize } = parsePagination(
    searchParams.get('page'),
    searchParams.get('pageSize'),
    { maxPageSize: 100, defaultPageSize: 20 }
);
```

### HTTP-only Cookies

Токени автентифікації зберігаються в HTTP-only cookies замість localStorage:

```typescript
import { setTokens, getAccessToken, removeTokens } from '@/lib/api-client';

// Токени автоматично зберігаються через /api/auth/set-token
await setTokens(accessToken, refreshToken);

// Отримання токену з cookies на сервері
const token = await getAccessToken();
```

### IP Whitelist для Webhooks

Платіжні webhooks захищені IP whitelist:

```typescript
import { validateWebhookIP, isIPWhitelisted } from '@/lib/security/ip-whitelist';

// Перевірка IP в webhook
const { valid, ip, error } = validateWebhookIP(request, 'monobank');
if (!valid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Підтримувані провайдери:** monobank, liqpay

### CSRF захист

Платіжні callbacks захищені CSRF токенами:

```typescript
import { validateCSRFToken, generateCSRFToken } from '@/lib/security/csrf';

// Генерація токену
const token = generateCSRFToken();

// Валідація
const isValid = validateCSRFToken(requestToken);
```

### Криптографічно безпечні ID

Всі генеровані ID використовують `crypto.randomUUID()`:

```typescript
// Замість Math.random()
const uuid = crypto.randomUUID();
```

### Структуроване логування

Централізована система логування:

```typescript
import { logger, paymentLogger, apiLogger } from '@/lib/logger';

// Типізовані логери
paymentLogger.info('Payment received', { orderId, amount, provider });
paymentLogger.error('Payment failed', error, { orderId });

// Кастомні транспорти (Sentry, Datadog)
addTransport((entry) => sendToSentry(entry));
```

### Транзакції бази даних

Атомарні операції для критичних дій:

```typescript
import { createOrderWithTransaction, processRefundWithTransaction } from '@/lib/db/transactions';

// Атомарне створення замовлення (order + items + payment + history)
const order = await createOrderWithTransaction(orderData);

// Атомарне повернення коштів
await processRefundWithTransaction(orderId, amount, reason);
```

### Retry з Circuit Breaker

Захист від каскадних відмов:

```typescript
import { withRetry, CircuitBreaker } from '@/lib/utils/retry';

// Retry з exponential backoff
const result = await withRetry(() => fetchData(), {
    maxRetries: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
});

// Circuit breaker
const breaker = new CircuitBreaker(5, 30000);
const data = await breaker.execute(() => callExternalApi());
```

## Нові модулі (v4.0)

### Фіскалізація (ПРРО)

Інтеграція з українською системою фіскалізації через Checkbox API:

```typescript
import { prroService } from '@/lib/fiscal/prro-service';

// Фіскалізація замовлення
const result = await prroService.fiscalizeOrder({
  orderId: 'ORD-123',
  items: [...],
  payments: [{ type: 'card', amount: 45000 }],
  customer: { email: 'customer@example.com' }
});

// Відкрити касову зміну
await prroService.openCashierShift('cashier-1');

// Закрити зміну та створити Z-звіт
const zReport = await prroService.closeCashierShift('cashier-1');
```

**Можливості:**
- Створення фіскальних чеків
- Чеки повернення
- Управління змінами (відкриття/закриття)
- Z-звіти та X-звіти
- Службові операції (внесення/винесення)
- Денні та періодичні звіти

**API Endpoints:**
- `POST /api/admin/fiscal/shift/open` - відкрити зміну
- `POST /api/admin/fiscal/shift/close` - закрити зміну
- `POST /api/admin/fiscal/receipt` - створити чек
- `POST /api/admin/fiscal/return` - чек повернення
- `GET /api/admin/fiscal/reports/daily` - денний звіт

---

### B2B Продажі

Система оптових продажів з багаторівневими цінами:

```typescript
import { pricingService } from '@/lib/b2b/pricing';

// Отримати ціну для клієнта
const price = pricingService.getCustomerPrice('prod-123', 'customer-1');

// Розрахувати кошик з оптовими цінами
const total = pricingService.calculateB2BCart('customer-1', cartItems);
```

**Рівні цін:**
- Retail (0%) - роздріб
- Small Wholesale (10%) - малий опт
- Medium Wholesale (15%) - середній опт
- Large Wholesale (20%) - великий опт
- Partner (25%) - партнер
- Distributor (30%) - дистриб'ютор

**API Endpoints:**
- `GET /api/b2b/prices` - ціни для клієнта
- `GET /api/b2b/price-list` - прайс-лист (XLSX/CSV/XML)
- `GET /api/b2b/credit` - кредитний ліміт
- `POST /api/b2b/order` - створити B2B замовлення

---

### Dropshipping / Supplier API

API для постачальників:

```typescript
// Реєстрація постачальника
POST /api/supplier/register
{
  "companyName": "ТОВ Постачальник",
  "contactPerson": "Іван Іваненко",
  "email": "supplier@example.com",
  "phone": "+380501234567"
}

// Додати товар
POST /api/supplier/products
Authorization: X-API-Key: sk_...
{
  "sku": "SUP-001",
  "name": "Товар 1",
  "price": 1000,
  "stock": 50
}
```

**Можливості:**
- Реєстрація та автентифікація через API ключ
- Управління товарами (CRUD)
- Масовий імпорт/експорт
- Оновлення залишків
- Отримання та обробка замовлень
- Відстеження виплат
- Webhook-сповіщення

---

### Апаратне забезпечення

Інтеграція з принтерами та сканерами:

```typescript
import { thermalPrinter } from '@/lib/hardware/thermal-printer';

// Друк чека
await thermalPrinter.printReceipt({
  lines: ['===== ЧЕК =====', 'Товар 1: 1000 грн', ...],
  cut: true
});

// Друк етикетки
POST /api/hardware/print/label
{
  "barcode": "1234567890123",
  "name": "iPhone 15 Pro",
  "price": 45000,
  "quantity": 10
}
```

**Підтримувані пристрої:**
- Термопринтери (ESC/POS)
- Принтери етикеток (ZPL, EPL)
- Сканери штрих-кодів (DataWedge, Keyboard Wedge)

---

### AI Репрайсинг

Автоматичне коригування цін на основі цін конкурентів:

```typescript
import { repricingEngine } from '@/lib/ai/repricing-engine';

// Створити правило репрайсингу
await repricingEngine.setRule({
  id: 'rule-1',
  productId: 'prod-123',
  enabled: true,
  strategy: { type: 'beat_lowest', margin: 10 },
  competitors: ['comp-1', 'comp-2'],
  constraints: {
    minPrice: 900,
    maxPrice: 1200,
    minMargin: 15,
    roundTo: 0.99
  }
});

// Запустити репрайсинг
const change = await repricingEngine.repriceProduct('prod-123');
```

**Стратегії:**
- Beat Lowest - ціна нижче найнижчої на X грн
- Match Lowest - відповідність найнижчій ціні
- Percentage Below - X% нижче найнижчої
- Smart - AI визначає оптимальну ціну
- Maximize Margin - максимізація маржі

**API Endpoints:**
- `GET/POST /api/ai/repricing` - управління правилами
- `POST /api/ai/repricing/run` - запустити репрайсинг
- `GET /api/ai/repricing/history` - історія змін
- `GET /api/ai/repricing/alerts` - цінові сповіщення

---

### AI Прогнозування попиту

Прогнозування продажів на основі історичних даних:

```typescript
import { demandForecasting } from '@/lib/ai/demand-forecasting';

// Прогноз продажів
const forecast = await demandForecasting.forecast(salesHistory, 30);
// Результат: прогноз на 30 днів

// Виявлення сезонності
const seasonality = demandForecasting.detectSeasonality(salesHistory);

// Рекомендації щодо закупівель
GET /api/ai/forecast/recommendations?productId=prod-123
```

**Методи:**
- Simple Moving Average (SMA)
- Exponential Smoothing
- Linear Regression
- Seasonal Decomposition

---

### Warehouse Management (Go Backend)

Розширені функції складу:

**Нові модулі:**
- `warehouse_map.go` - карта складу (зони/стелажі/полиці)
- `tasks.go` - задачі складу (picking, packing, etc.)
- `purchasing.go` - закупівлі
- `expiry.go` - терміни придатності (FEFO)
- `labels.go` - етикетування
- `packing.go` - пакування
- `quality_control.go` - контроль якості
- `returns.go` - повернення
- `cross_docking.go` - крос-докінг
- `kitting.go` - комплектація
- `split_shipment.go` - розділене відвантаження

---

## Документація

### Нова документація модулів:

- **`docs/MODULES_OVERVIEW.md`** - огляд всіх нових модулів з архітектурою
- **`docs/API_REFERENCE.md`** - повна документація API endpoints
- **`docs/CONFIGURATION.md`** - керівництво з налаштування змінних оточення
- **`docs/DEPLOYMENT.md`** - інструкції з розгортання в production

### Існуюча документація:

- `docs/testing/manual-testing-guide.md` - посібник з ручного тестування
- `docs/eav-manual-testing.md` - тестування EAV системи
- `docs/warehouse/` - документація WMS системи
- `.env.example` - приклад змінних середовища

## Тести

```bash
# Всі тести
npm test

# Тести платежів
npm test -- --testPathPatterns="payment"

# Тести i18n
npm test -- --testPathPatterns="i18n"

# З покриттям
npm test -- --coverage
```

**Всього: 2422 тестів** | **Покриття: 97%+**

## Ліцензія

Приватний проект.
