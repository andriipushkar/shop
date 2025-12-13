# Product Comparison Feature

Повнофункціональна система порівняння товарів для e-commerce магазину з підтримкою EAV атрибутів.

## 📋 Огляд

Система порівняння товарів дозволяє користувачам:
- Додавати до 4 товарів для порівняння
- Порівнювати тільки товари з однієї категорії
- Переглядати характеристики товарів поруч у зручній таблиці
- Виділяти відмінності між товарами
- Зберігати порівняння в localStorage
- Ділитися посиланням на порівняння
- Друкувати порівняння

## 🏗️ Архітектура

### Компоненти

#### 1. **ComparisonService** (`lib/comparison/comparison-service.ts`)
Основний сервіс для управління логікою порівняння.

**Основні методи:**
```typescript
// Додати товар до порівняння
addProduct(product: ComparisonProduct): { success: boolean; error?: string }

// Видалити товар з порівняння
removeProduct(productId: string): void

// Очистити всі товари
clear(): void

// Перевірити чи товар у порівнянні
isInComparison(productId: string): boolean

// Отримати кількість товарів
getCount(): number

// Отримати всі товари
getProducts(): ComparisonProduct[]

// Отримати порівнювані атрибути
getComparableAttributes(products: ComparisonProduct[]): ComparisonAttribute[]

// Отримати посилання для шерингу
getShareableUrl(): string

// Підписатися на зміни
subscribe(listener: () => void): () => void
```

**Особливості:**
- Singleton патерн
- Автоматичне збереження в localStorage
- Event-based оновлення UI
- Підтримка EAV атрибутів
- Валідація категорій

#### 2. **CompareButton** (`components/CompareButton.tsx`)
Кнопка для додавання/видалення товарів з порівняння.

**Props:**
```typescript
interface CompareButtonProps {
  product: ComparisonProduct;
  variant?: 'icon' | 'button' | 'icon-text';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}
```

**Варіанти:**
- `icon` - тільки іконка (для карточок товарів)
- `button` - повна кнопка з текстом
- `icon-text` - іконка + текст

**Використання:**
```tsx
import CompareButton from '@/components/CompareButton';

// У карточці товару
<CompareButton
  product={product}
  variant="icon"
  size="md"
/>

// На сторінці товару
<CompareButton
  product={product}
  variant="button"
  size="lg"
/>
```

#### 3. **ComparisonBar** (`components/ComparisonBar.tsx`)
Sticky панель внизу екрану з превью обраних товарів.

**Функції:**
- Показується автоматично при додаванні товарів
- Міні-превью товарів з зображеннями
- Швидке видалення товарів
- Кнопка "Порівняти" (активна при >= 2 товари)
- Згортання/розгортання
- Показ порожніх слотів

**Інтеграція:**
```tsx
// app/layout.tsx
import ComparisonBar from '@/components/ComparisonBar';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <ComparisonBar />
      </body>
    </html>
  );
}
```

#### 4. **ComparisonTable** (`components/ComparisonTable.tsx`)
Повна таблиця порівняння з характеристиками.

**Props:**
```typescript
interface ComparisonTableProps {
  initialProducts?: ComparisonProduct[];
  showDifferencesOnly?: boolean;
}
```

**Функції:**
- Side-by-side порівняння
- Sticky заголовки при скролі
- Виділення відмінностей
- Фільтр "Тільки відмінності"
- Різні типи атрибутів (текст, число, boolean, рейтинг)
- Responsive дизайн
- Видалення товарів з таблиці

#### 5. **Comparison Page** (`app/compare/page.tsx`)
Повноцінна сторінка порівняння.

**Функції:**
- Завантаження з URL параметрів
- Кнопка "Поділитися"
- Кнопка "Друк"
- Очистка порівняння
- Підказки для додавання товарів
- Print-friendly view

**URL формат:**
```
/compare?ids=prod-1,prod-2,prod-3
```

### API Routes

#### **GET /api/compare/attributes**
Отримання схеми порівнюваних атрибутів для категорії.

**Query параметри:**
- `categoryId` (required) - ID категорії

**Відповідь:**
```json
{
  "success": true,
  "data": {
    "categoryId": "cat-1-1",
    "categoryName": "Смартфони",
    "attributes": [
      {
        "key": "screen_size",
        "label": "Діагональ екрану",
        "type": "number",
        "unit": "дюймів"
      },
      ...
    ]
  }
}
```

**Підтримувані категорії:**
- `cat-1-1` - Смартфони
- `cat-1-3` - Ноутбуки
- `cat-1-5` - Телевізори
- `cat-2-1` - Холодильники
- `cat-2-2` - Пральні машини

#### **POST /api/compare/attributes**
Оновлення схеми атрибутів (тільки для адміністраторів).

## 📦 Типи даних

### ComparisonProduct
```typescript
interface ComparisonProduct extends Product {
  category?: {
    id: string;
    name: string;
  };
  attributes?: Record<string, string | number | boolean>;
  rating?: number;
  reviewCount?: number;
  brand?: string;
}
```

### ComparisonAttribute
```typescript
interface ComparisonAttribute {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'rating';
  values: (string | number | boolean | null)[];
  hasDifference: boolean;
}
```

### ComparisonState
```typescript
interface ComparisonState {
  products: ComparisonProduct[];
  categoryId?: string;
  lastUpdated: string;
}
```

## 🚀 Швидкий старт

### 1. Інтеграція в ProductCard

```tsx
import CompareButton from '@/components/CompareButton';

export default function ProductCard({ product }) {
  return (
    <div className="product-card">
      {/* ... інший контент ... */}

      <div className="flex gap-2">
        <button>В кошик</button>
        <CompareButton
          product={{
            ...product,
            category: { id: product.category_id, name: 'Категорія' }
          }}
          variant="icon"
        />
      </div>
    </div>
  );
}
```

### 2. Додавання ComparisonBar в Layout

```tsx
// app/layout.tsx
import ComparisonBar from '@/components/ComparisonBar';

export default function RootLayout({ children }) {
  return (
    <html lang="uk">
      <body>
        {children}
        <ComparisonBar />
      </body>
    </html>
  );
}
```

### 3. Створення сторінки порівняння

Файл вже створено: `app/compare/page.tsx`

Доступ: `/compare`

## 🧪 Тестування

### Запуск тестів
```bash
npm test comparison-service.test.ts
```

### Coverage
```bash
npm run test:coverage -- comparison-service.test.ts
```

### Тестові сценарії
- ✅ Додавання товарів
- ✅ Видалення товарів
- ✅ Обмеження на 4 товари
- ✅ Валідація категорій
- ✅ Збереження в localStorage
- ✅ Отримання атрибутів
- ✅ Виявлення відмінностей
- ✅ Event система
- ✅ Shareable URLs

## 🎨 Стилі та UI/UX

### Кольорова схема
- Синій (`blue-600`) - основні дії
- Червоний (`red-600`) - видалення
- Жовтий (`yellow-50`) - виділення відмінностей
- Сірий - нейтральні елементи

### Responsive
- Mobile-first підхід
- Горизонтальний скрол для таблиці на мобільних
- Адаптивні кнопки та відступи

### Accessibility
- ARIA labels
- Keyboard navigation
- Screen reader підтримка
- Високий контраст

## 📱 Приклади використання

### Базове використання
```tsx
import { comparisonService } from '@/lib/comparison/comparison-service';

// Додати товар
const result = comparisonService.addProduct(product);
if (result.success) {
  console.log('Товар додано');
} else {
  console.error(result.error);
}

// Перевірити наявність
if (comparisonService.isInComparison(productId)) {
  console.log('Товар вже в порівнянні');
}

// Отримати всі товари
const products = comparisonService.getProducts();
```

### З React Hooks
```tsx
import { useState, useEffect } from 'react';
import { comparisonService } from '@/lib/comparison/comparison-service';

function MyComponent() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(comparisonService.getCount());

    const unsubscribe = comparisonService.subscribe(() => {
      setCount(comparisonService.getCount());
    });

    return unsubscribe;
  }, []);

  return <div>Товарів у порівнянні: {count}</div>;
}
```

## 🔧 Налаштування

### Змінити максимальну кількість товарів

У файлі `lib/comparison/comparison-service.ts`:
```typescript
const MAX_PRODUCTS = 4; // Змініть на потрібне значення
```

### Додати нові категорії атрибутів

У файлі `app/api/compare/attributes/route.ts`:
```typescript
const categoryAttributeSchemas: Record<string, CategoryAttributes> = {
  'your-category-id': {
    categoryId: 'your-category-id',
    categoryName: 'Ваша категорія',
    attributes: [
      { key: 'attr1', label: 'Атрибут 1', type: 'text' },
      // ...
    ],
  },
};
```

## 🐛 Відомі обмеження

1. **localStorage обмеження** - Максимум ~5-10MB даних
2. **Тільки одна категорія** - Не можна порівнювати різні категорії
3. **Client-sideOnly** - Порівняння не зберігається на сервері

## 🚧 Майбутні покращення

- [ ] Server-side збереження порівнянь
- [ ] Збереження історії порівнянь
- [ ] Експорт порівняння в PDF/Excel
- [ ] Порівняння по декільком категоріям
- [ ] AI рекомендації на основі порівняння
- [ ] Графіки та візуалізації
- [ ] Мобільний додаток

## 📄 Ліцензія

Частина проекту Shop Services.

## 👥 Автори

Створено для e-commerce платформи Shop.

## 📞 Підтримка

Для питань та пропозицій створюйте issue в репозиторії проекту.
