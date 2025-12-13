# Photo Reviews Feature

Система фото-відгуків для електронної комерції з підтримкою завантаження зображень, оптимізації, модерації та галереї.

## Функціонал

### 1. Завантаження фотографій
- Підтримка форматів: JPG, PNG, WebP
- Максимум 5 фотографій на відгук
- Максимальний розмір файлу: 10 МБ
- Автоматична компресія до 1920x1920px
- Створення мініатюр 200x200px

### 2. Форма відгуку (ReviewForm.tsx)
- Оцінка 1-5 зірок
- Заголовок та текст відгуку
- Поля переваг/недоліків (до 5 кожного)
- Drag & drop завантаження фото
- Попередній перегляд зображень
- Прогрес завантаження
- Вибір періоду використання
- Позначка "Рекомендую"

### 3. Картка відгуку (ReviewCard.tsx)
- Аватар та ім'я автора
- Бейджі (верифікований покупець, топ рецензент, тощо)
- Рейтинг зірками
- Переваги/недоліки з кольоровими бейджами
- Мініатюри фотографій (до 4 в картці)
- Голосування "Корисно/Не корисно"
- Відповіді продавця/підтримки

### 4. Галерея (ReviewGallery.tsx)
- Перегляд усіх відгуків
- Фільтр "Тільки з фото"
- Сітка фотографій
- Lightbox для повноекранного перегляду
- Навігація клавіатурою (стрілки, Escape)
- Підписи та автор фото

### 5. API Endpoints

#### POST /api/reviews/upload
Завантаження фотографії відгуку.

**Request:**
- FormData з полем `image`
- Тип: image/jpeg, image/png, image/webp
- Макс розмір: 10 МБ

**Response:**
```json
{
  "id": "uuid",
  "url": "/uploads/reviews/filename.jpg",
  "thumbnailUrl": "/uploads/reviews/filename_thumb.jpg",
  "width": 1920,
  "height": 1080,
  "size": 245678,
  "format": "jpg"
}
```

#### POST /api/reviews/[id]/vote
Голосування за відгук.

**Request:**
```json
{
  "voteType": "helpful" | "not_helpful"
}
```

**Response:**
```json
{
  "success": true,
  "newVotes": {
    "helpful": 15,
    "notHelpful": 2,
    "userVote": "helpful"
  }
}
```

#### GET /api/reviews/[id]/vote
Отримати статус голосування.

**Response:**
```json
{
  "votes": {
    "helpful": 15,
    "notHelpful": 2,
    "userVote": "helpful" | null
  }
}
```

#### DELETE /api/reviews/[id]/vote
Видалити голос (дозволити змінити думку).

## Використання

### Форма відгуку

```tsx
import ReviewForm from '@/components/ReviewForm';
import { submitReview } from '@/lib/reviews';

function ProductPage({ productId, productName }) {
  const handleSubmit = async (reviewData) => {
    try {
      const review = await submitReview(reviewData);
      console.log('Review submitted:', review);
      // Показати успішне повідомлення
    } catch (error) {
      console.error('Error:', error);
      // Показати помилку
    }
  };

  return (
    <ReviewForm
      productId={productId}
      productName={productName}
      onSubmit={handleSubmit}
    />
  );
}
```

### Картка відгуку

```tsx
import ReviewCard from '@/components/ReviewCard';

function ReviewsList({ reviews }) {
  const handleVoteUpdate = (reviewId, newVotes) => {
    console.log('Votes updated:', reviewId, newVotes);
    // Оновити стан
  };

  return (
    <div>
      {reviews.map(review => (
        <ReviewCard
          key={review.id}
          review={review}
          onVoteUpdate={handleVoteUpdate}
        />
      ))}
    </div>
  );
}
```

### Галерея

```tsx
import ReviewGallery from '@/components/ReviewGallery';

function ProductReviewsPage({ reviews }) {
  return (
    <ReviewGallery
      reviews={reviews}
      showPhotosOnly={false}
      onFilterChange={(photosOnly) => {
        console.log('Filter changed:', photosOnly);
      }}
    />
  );
}
```

## Типи даних

### PhotoReviewImage
```typescript
interface PhotoReviewImage {
  id: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  size: number;
  format: 'jpg' | 'png' | 'webp';
  caption?: string;
  uploadedAt: Date;
  moderationStatus: 'pending' | 'approved' | 'rejected' | 'flagged';
  moderationFlags?: ModerationFlag[];
}
```

### ModerationFlag
```typescript
type ModerationFlag =
  | 'inappropriate_content'
  | 'low_quality'
  | 'not_product_related'
  | 'duplicate'
  | 'watermark'
  | 'copyright';
```

## Конфігурація

Параметри за замовчуванням в `lib/reviews/photo-reviews.ts`:

```typescript
export const DEFAULT_UPLOAD_OPTIONS = {
  maxImages: 5,
  maxSizeMB: 10,
  allowedFormats: ['image/jpeg', 'image/png', 'image/webp'],
  compressionQuality: 0.85,
  thumbnailWidth: 200,
  thumbnailHeight: 200,
};
```

## Залежності

Необхідно встановити:

```bash
npm install sharp
# або
yarn add sharp
```

Sharp використовується для обробки зображень на сервері (resize, compression, thumbnails).

## Тестування

Запустити юніт-тести:

```bash
npm test __tests__/lib/photo-reviews.test.ts
```

Тести охоплюють:
- Валідацію файлів
- Валідацію множинних зображень
- Форматування розміру файлів
- Перевірку статусу модерації
- Edge cases

## Модерація

Система підтримує кілька статусів модерації:
- `pending` - очікує перевірки
- `approved` - схвалено
- `rejected` - відхилено
- `flagged` - позначено для перевірки

Флаги модерації:
- `inappropriate_content` - неприйнятний контент
- `low_quality` - низька якість
- `not_product_related` - не стосується товару
- `duplicate` - дублікат
- `watermark` - водяний знак
- `copyright` - проблема авторських прав

## Безпека

1. **Валідація типів файлів** - тільки дозволені формати
2. **Обмеження розміру** - макс 10 МБ на файл
3. **Обмеження кількості** - макс 5 фото на відгук
4. **Rate limiting** - в API endpoints (рекомендується додати)
5. **User authentication** - в vote endpoints використовується IP (в продакшені використовувати справжню аутентифікацію)

## Продуктивність

1. **Компресія зображень** - автоматично до 1920x1920px
2. **Мініатюри** - 200x200px для швидкого завантаження
3. **Lazy loading** - в галереї (рекомендується додати)
4. **CDN** - для зображень (рекомендується налаштувати)
5. **Кешування** - голоси зберігаються в Redis

## Покращення (TODO)

- [ ] Додати підтримку відео відгуків
- [ ] Інтеграція з AI для автоматичної модерації
- [ ] Детекція обличчів та розмиття
- [ ] Watermark detection
- [ ] Геотегування фотографій
- [ ] Порівняння схожих відгуків (duplicate detection)
- [ ] Експорт відгуків в CSV/Excel
- [ ] Аналітика по фото відгуках

## Приклад повного workflow

```typescript
import { processAndUploadImages } from '@/lib/reviews/photo-reviews';

async function submitReviewWithPhotos(files: File[]) {
  try {
    // 1. Валідація
    const validation = validateMultipleImages(files);
    if (!validation.valid) {
      throw new Error(validation.errorsUk[0]);
    }

    // 2. Обробка та завантаження
    const uploadedImages = await processAndUploadImages(
      files,
      undefined,
      (progress) => {
        console.log(`${progress.fileName}: ${progress.progress}%`);
      }
    );

    // 3. Створення відгуку
    const review = await submitReview({
      productId: 'product-123',
      rating: 5,
      title: 'Чудовий товар!',
      content: 'Дуже задоволений покупкою...',
      pros: ['Якість', 'Швидка доставка'],
      cons: ['Ціна трохи висока'],
      recommended: true,
      usagePeriod: 'one_to_three_months',
      mediaFiles: files,
    });

    console.log('Review created:', review);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## Підтримка

Для питань та підтримки звертайтесь до команди розробки.
