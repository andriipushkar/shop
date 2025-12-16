# Reviews System

Система відгуків та рейтингів товарів.

## Overview

Модуль reviews забезпечує:
- Відгуки з рейтингом
- Фото та відео відгуки
- Модерація відгуків
- Відповіді на відгуки
- Верифіковані покупки
- Агрегація рейтингів

## Data Model

```typescript
interface Review {
  id: string;
  productId: string;
  userId: string;
  orderId?: string;           // For verified purchase
  rating: number;             // 1-5
  title?: string;
  text: string;
  pros?: string[];
  cons?: string[];
  photos?: string[];
  videos?: string[];
  isVerified: boolean;        // Purchased this product
  isRecommended: boolean;
  status: 'pending' | 'approved' | 'rejected';
  helpfulCount: number;
  reportCount: number;
  reply?: ReviewReply;
  createdAt: Date;
  updatedAt: Date;
}

interface ReviewReply {
  text: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
}

interface ProductRating {
  productId: string;
  averageRating: number;
  totalReviews: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  recommendPercent: number;
}
```

## Usage

### Create Review

```typescript
import { reviewsService } from '@/lib/reviews';

const review = await reviewsService.create({
  productId: 'prod-123',
  userId: user.id,
  orderId: 'order-456',  // Optional: for verified badge
  rating: 5,
  title: 'Відмінний смартфон!',
  text: 'Користуюсь вже місяць, все працює ідеально.',
  pros: ['Швидкий', 'Гарна камера', 'Тримає заряд'],
  cons: ['Немає комплектного чохла'],
  isRecommended: true,
  photos: ['https://...'],
});
```

### Get Product Reviews

```typescript
const reviews = await reviewsService.getByProduct({
  productId: 'prod-123',
  status: 'approved',
  sortBy: 'helpful',     // helpful, newest, rating_high, rating_low
  first: 10,
  after: cursor,
});
```

### Get Product Rating

```typescript
const rating = await reviewsService.getRating('prod-123');

// rating = {
//   averageRating: 4.7,
//   totalReviews: 156,
//   distribution: { 5: 120, 4: 25, 3: 8, 2: 2, 1: 1 },
//   recommendPercent: 94
// }
```

### Mark Helpful

```typescript
await reviewsService.markHelpful(reviewId, userId);
```

### Report Review

```typescript
await reviewsService.report(reviewId, {
  userId: user.id,
  reason: 'spam',
  details: 'Це реклама іншого магазину',
});
```

### Reply to Review (Admin)

```typescript
await reviewsService.reply(reviewId, {
  text: 'Дякуємо за відгук! Раді, що товар вам сподобався.',
  authorId: admin.id,
  authorName: 'Служба підтримки',
});
```

## Moderation

### Auto-moderation Rules

```typescript
const moderationRules = {
  autoApprove: {
    minRating: 3,
    verifiedOnly: true,
    noPhotos: false,
  },
  autoReject: {
    containsUrl: true,
    containsProfanity: true,
    minLength: 10,
  },
  requireManualReview: {
    hasPhotos: true,
    rating: [1, 2],
    firstReview: true,
  },
};
```

### Admin Moderation

```typescript
// Approve review
await reviewsService.moderate(reviewId, {
  status: 'approved',
  moderatorId: admin.id,
});

// Reject review
await reviewsService.moderate(reviewId, {
  status: 'rejected',
  moderatorId: admin.id,
  reason: 'Відгук не відповідає правилам',
});
```

## API Endpoints

```
GET    /api/v1/products/:id/reviews       # Product reviews
GET    /api/v1/products/:id/rating        # Product rating
POST   /api/v1/reviews                    # Create review
GET    /api/v1/reviews/:id                # Get review
PUT    /api/v1/reviews/:id                # Update review
DELETE /api/v1/reviews/:id                # Delete review
POST   /api/v1/reviews/:id/helpful        # Mark helpful
POST   /api/v1/reviews/:id/report         # Report review
POST   /api/v1/reviews/:id/reply          # Reply to review

# Admin
GET    /api/v1/admin/reviews              # All reviews (moderation)
PUT    /api/v1/admin/reviews/:id/moderate # Moderate review
```

## Request Review Email

```typescript
// Send review request after delivery
await reviewsService.requestReview({
  orderId: 'order-123',
  customerEmail: 'customer@email.com',
  products: [
    { id: 'prod-1', name: 'iPhone 15 Pro' },
    { id: 'prod-2', name: 'Чохол для iPhone' },
  ],
  delayDays: 7,  // Send 7 days after delivery
});
```

## Widgets

### Rating Summary

```tsx
function RatingSummary({ productId }: { productId: string }) {
  const { data: rating } = useQuery(['rating', productId],
    () => reviewsService.getRating(productId)
  );

  return (
    <div className="flex items-center gap-4">
      <div className="text-4xl font-bold">{rating.averageRating.toFixed(1)}</div>
      <div>
        <StarRating value={rating.averageRating} />
        <div className="text-sm text-gray-500">
          {rating.totalReviews} відгуків
        </div>
      </div>
      <RatingDistribution distribution={rating.distribution} />
    </div>
  );
}
```

### Review Card

```tsx
function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="border-b py-4">
      <div className="flex items-center gap-2">
        <StarRating value={review.rating} />
        {review.isVerified && (
          <Badge variant="success">Підтверджена покупка</Badge>
        )}
      </div>
      <h4 className="font-medium mt-2">{review.title}</h4>
      <p className="text-gray-700 mt-1">{review.text}</p>
      {review.pros && (
        <div className="mt-2">
          <span className="text-green-600">+</span> {review.pros.join(', ')}
        </div>
      )}
      {review.cons && (
        <div>
          <span className="text-red-600">−</span> {review.cons.join(', ')}
        </div>
      )}
      {review.photos && (
        <div className="flex gap-2 mt-2">
          {review.photos.map(photo => (
            <img key={photo} src={photo} className="w-20 h-20 object-cover rounded" />
          ))}
        </div>
      )}
      <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
        <button onClick={() => markHelpful(review.id)}>
          Корисний ({review.helpfulCount})
        </button>
        <span>{formatDate(review.createdAt)}</span>
      </div>
    </div>
  );
}
```

## Configuration

```bash
# Reviews settings
REVIEWS_ENABLED=true
REVIEWS_REQUIRE_PURCHASE=false
REVIEWS_AUTO_APPROVE=false
REVIEWS_MIN_LENGTH=20
REVIEWS_MAX_PHOTOS=5

# Request reviews
REVIEWS_REQUEST_DELAY_DAYS=7
REVIEWS_REQUEST_ENABLED=true
```

## See Also

- [Products](./PRODUCTS.md)
- [Orders](./ORDERS.md)
- [Email Templates](../guides/EMAIL_TEMPLATES.md)
