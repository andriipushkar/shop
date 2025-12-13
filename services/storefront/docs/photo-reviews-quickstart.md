# Photo Reviews - Quick Start Guide

## 5-хвилинний старт

### Крок 1: Встановлення залежностей

```bash
cd /home/sssmmmddd/Code/pro/shop/services/storefront
npm install sharp
```

### Крок 2: Створення директорії для завантажень

```bash
mkdir -p public/uploads/reviews
chmod 755 public/uploads/reviews
```

### Крок 3: Запуск тестів (опціонально)

```bash
npm test __tests__/lib/photo-reviews.test.ts
```

### Крок 4: Базове використання

Додайте в сторінку товару:

```tsx
// app/products/[id]/page.tsx
import ReviewForm from '@/components/ReviewForm';
import ReviewCard from '@/components/ReviewCard';
import { submitReview } from '@/lib/reviews';

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id);
  const reviews = await getReviews(params.id);

  return (
    <div>
      {/* Ваш контент товару */}

      {/* Форма відгуку */}
      <ReviewForm
        productId={product.id}
        productName={product.name}
        onSubmit={async (data) => {
          'use server';
          await submitReview(data);
        }}
      />

      {/* Список відгуків */}
      <div className="space-y-4 mt-8">
        {reviews.map(review => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </div>
  );
}
```

### Крок 5: Перевірка роботи

1. Відкрийте сторінку товару в браузері
2. Натисніть "Написати відгук"
3. Заповніть форму
4. Завантажте фото (перетягніть або оберіть файли)
5. Натисніть "Опублікувати"

## Типові проблеми та рішення

### Проблема: Sharp не встановлюється

**Рішення:**
```bash
# Очистити кеш
npm cache clean --force

# Спробувати знову
npm install sharp

# Якщо не допомогло (для Linux)
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
npm install sharp
```

### Проблема: Зображення не відображаються

**Рішення:**
- Перевірте, що директорія існує: `ls -la public/uploads/reviews`
- Перевірте права доступу: `chmod 755 public/uploads/reviews`
- Перевірте Next.js static file serving в `next.config.js`

### Проблема: Помилка 500 при завантаженні

**Рішення:**
- Перевірте логи сервера
- Перевірте, що Sharp встановлений: `node -e "require('sharp')"`
- Перевірте розмір та тип файлу

## Налаштування

### Зміна максимальної кількості фото

В `lib/reviews/photo-reviews.ts`:

```typescript
export const DEFAULT_UPLOAD_OPTIONS = {
  maxImages: 10, // змініть з 5 на 10
  // ...
};
```

### Зміна максимального розміру файлу

В `lib/reviews/photo-reviews.ts`:

```typescript
export const DEFAULT_UPLOAD_OPTIONS = {
  maxSizeMB: 20, // змініть з 10 на 20
  // ...
};
```

### Зміна якості компресії

```typescript
export const DEFAULT_UPLOAD_OPTIONS = {
  compressionQuality: 0.9, // змініть з 0.85 на 0.9 (вища якість)
  // ...
};
```

## Наступні кроки

1. **Інтеграція з базою даних**
   - Створіть таблиці для відгуків та зображень
   - Реалізуйте API endpoints для CRUD операцій

2. **Додайте модерацію**
   - Створіть admin панель для модерації
   - Додайте автоматичну модерацію через AI

3. **Налаштуйте CDN**
   - AWS S3 + CloudFront
   - Google Cloud Storage + CDN
   - Cloudflare Images

4. **Додайте аналітику**
   - Tracking переглядів фото
   - Конверсія по відгуках з фото
   - A/B тестування

## Корисні посилання

- [Повна документація](/docs/photo-reviews.md)
- [Приклад використання](/docs/photo-reviews-example.tsx)
- [Архітектура](/docs/photo-reviews-architecture.md)
- [Інструкції встановлення](/SETUP_PHOTO_REVIEWS.md)

## Підтримка

Питання? Перевірте документацію або створіть issue в репозиторії.

---

**Готово!** Ваша система фото-відгуків готова до роботи. 🎉
