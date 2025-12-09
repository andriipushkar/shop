# Storefront - Інтернет-магазин

Сучасний інтернет-магазин побудований на Next.js 16 з React 19 та TypeScript.

## Особливості

- **5000+ товарів** у 86 категоріях
- **100 акцій та промокодів**
- **Кошик покупок** з синхронізацією через API
- **Адмін-панель** для управління магазином
- **Повністю українізований** інтерфейс
- **Адаптивний дизайн** для мобільних та десктоп пристроїв
- **Покриття тестами** 66%+

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
│   │   └── users/           # Користувачі
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
└── __tests__/              # Тести
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

**Загальне покриття: 97%+ (199 тестів)**

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
- **Акції** - управління промокодами
- **Аналітика** - графіки та звіти
- **Налаштування** - конфігурація магазину
- **Імпорт** - імпорт з Excel/CSV
- **Інтеграції** - зовнішні сервіси
- **Відгуки** - модерація відгуків
- **Контент** - CMS для сторінок
- **Підтримка** - тікети підтримки
- **Користувачі** - ролі та права

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

## Ліцензія

Приватний проект.
