/**
 * Приклади використання системи рекомендацій
 * Product Recommendation System Usage Examples
 */

import RecommendedProducts, { RecommendedProductsCompact } from '@/components/RecommendedProducts';
import TrendingProducts, { TrendingProductsWidget } from '@/components/TrendingProducts';
import { recommendationEngine } from '@/lib/recommendations';

// ============================================
// ПРИКЛАД 1: Сторінка товару
// ============================================

export function ProductDetailPage({ productId }: { productId: string }) {
  return (
    <div className="container mx-auto px-4">
      {/* Деталі товару */}
      <div className="mb-12">
        {/* Product info, images, etc */}
      </div>

      {/* Часто купують разом */}
      <RecommendedProducts
        productId={productId}
        type="bought-together"
        title="Часто купують разом"
        subtitle="Покупці також обрали ці товари"
        limit={3}
        showReasons={true}
      />

      {/* Схожі товари */}
      <RecommendedProducts
        productId={productId}
        type="similar"
        title="Схожі товари"
        subtitle="Товари з подібними характеристиками"
        limit={8}
        showViewAll={true}
        viewAllLink={`/category/${productId}`}
        showReasons={false}
      />

      {/* Гібридні рекомендації */}
      <RecommendedProducts
        productId={productId}
        type="hybrid"
        title="Вас також може зацікавити"
        limit={12}
        showViewAll={false}
      />
    </div>
  );
}

// ============================================
// ПРИКЛАД 2: Головна сторінка
// ============================================

export function HomePage() {
  return (
    <div className="container mx-auto px-4">
      {/* Hero banner */}
      <div className="mb-12">
        {/* Hero content */}
      </div>

      {/* Популярні товари */}
      <TrendingProducts
        limit={8}
        period={7}
        title="🔥 Популярні цього тижня"
        showTrends={true}
        showStats={true}
        showViewAll={true}
        variant="grid"
      />

      {/* Персоналізовані рекомендації (для залогінених) */}
      <RecommendedProducts
        type="personalized"
        title="Рекомендовані для вас"
        subtitle="Підібрано на основі ваших уподобань"
        limit={12}
        showViewAll={true}
        viewAllLink="/recommendations"
      />

      {/* На основі переглянутого */}
      <RecommendedProducts
        type="history"
        title="На основі переглянутого"
        subtitle="Можливо вас зацікавить"
        limit={8}
        showViewAll={false}
      />

      {/* Нові надходження */}
      <div className="mt-12">
        {/* New arrivals component */}
      </div>
    </div>
  );
}

// ============================================
// ПРИКЛАД 3: Бічна панель
// ============================================

export function ProductSidebar({ productId }: { productId: string }) {
  return (
    <aside className="w-full lg:w-80 space-y-6">
      {/* Топ-3 тижня */}
      <TrendingProductsWidget />

      {/* Компактні схожі товари */}
      <RecommendedProductsCompact
        productId={productId}
        type="similar"
        limit={3}
      />

      {/* Інші віджети */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        {/* Newsletter, etc */}
      </div>
    </aside>
  );
}

// ============================================
// ПРИКЛАД 4: Кошик
// ============================================

export function CartPage({ cartItems }: { cartItems: any[] }) {
  // Отримуємо ID товарів з кошика
  const productIds = cartItems.map(item => item.productId);

  return (
    <div className="container mx-auto px-4">
      {/* Cart items */}
      <div className="mb-12">
        {/* Cart content */}
      </div>

      {/* Рекомендації на основі товарів у кошику */}
      {productIds.length > 0 && (
        <RecommendedProducts
          productId={productIds[0]} // Використовуємо перший товар
          type="bought-together"
          title="Доповніть замовлення"
          subtitle="Ці товари часто купують разом"
          limit={6}
          showReasons={true}
        />
      )}
    </div>
  );
}

// ============================================
// ПРИКЛАД 5: Категорія товарів
// ============================================

export function CategoryPage({ categoryId }: { categoryId: string }) {
  return (
    <div className="container mx-auto px-4">
      {/* Category header, filters */}
      <div className="mb-8">
        {/* Category content */}
      </div>

      {/* Products grid */}
      <div className="mb-12">
        {/* Products list */}
      </div>

      {/* Trending у цій категорії */}
      <TrendingProducts
        limit={6}
        period={7}
        title="Популярні в категорії"
        variant="carousel"
        showTrends={true}
      />
    </div>
  );
}

// ============================================
// ПРИКЛАД 6: Програмне використання API
// ============================================

export async function ServerSideRecommendations({ productId }: { productId: string }) {
  // Server-side код (в async компоненті або getServerSideProps)

  // Схожі товари
  const similar = await recommendationEngine.getSimilarProducts(productId, {
    limit: 10,
    minScore: 0.3,
    includeReasons: true,
  });

  // Часто купують разом
  const boughtTogether = await recommendationEngine.getFrequentlyBoughtTogether(productId, {
    limit: 5,
  });

  // Гібридні рекомендації
  const hybrid = await recommendationEngine.getHybridRecommendations(productId, {
    limit: 10,
  });

  // Trending
  const trending = await recommendationEngine.getTrendingProducts({
    limit: 20,
  });

  return (
    <div>
      <h2>Схожі товари</h2>
      <pre>{JSON.stringify(similar, null, 2)}</pre>

      <h2>Часто купують разом</h2>
      <pre>{JSON.stringify(boughtTogether, null, 2)}</pre>

      <h2>Гібридні рекомендації</h2>
      <pre>{JSON.stringify(hybrid, null, 2)}</pre>

      <h2>Trending</h2>
      <pre>{JSON.stringify(trending, null, 2)}</pre>
    </div>
  );
}

// ============================================
// ПРИКЛАД 7: Персоналізовані рекомендації
// ============================================

export async function PersonalizedRecommendationsPage({ userId }: { userId: string }) {
  // Отримуємо персоналізовані рекомендації
  const recommendations = await recommendationEngine.getPersonalizedRecommendations(userId, {
    limit: 30,
    excludeIds: [], // Можна виключити вже куплені товари
  });

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-3xl font-bold mb-8">Рекомендовано для вас</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {recommendations.map(rec => (
          <div key={rec.productId} className="relative">
            {/* Product card */}
            {rec.reasons && (
              <div className="absolute top-2 left-2 z-10 bg-teal-600 text-white text-xs px-2 py-1 rounded">
                {rec.reasons[0]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// ПРИКЛАД 8: Email маркетинг
// ============================================

export async function generateEmailRecommendations(userId: string) {
  // Отримуємо top-10 персоналізованих рекомендацій
  const recommendations = await recommendationEngine.getPersonalizedRecommendations(userId, {
    limit: 10,
  });

  // Отримуємо trending products
  const trending = await recommendationEngine.getTrendingProducts({
    limit: 5,
  });

  // Формуємо email
  const emailData = {
    userId,
    recommendations: recommendations.slice(0, 6),
    trending: trending.slice(0, 3),
    subject: 'Підібрали для вас найкращі пропозиції!',
  };

  return emailData;
}

// ============================================
// ПРИКЛАД 9: A/B тестування
// ============================================

export function ABTestRecommendations({ productId, variant }: { productId: string; variant: 'A' | 'B' }) {
  if (variant === 'A') {
    // Варіант A: тільки content-based
    return (
      <RecommendedProducts
        productId={productId}
        type="similar"
        title="Схожі товари"
        limit={8}
      />
    );
  } else {
    // Варіант B: hybrid
    return (
      <RecommendedProducts
        productId={productId}
        type="hybrid"
        title="Рекомендовані товари"
        limit={8}
        showReasons={true}
      />
    );
  }
}

// ============================================
// ПРИКЛАД 10: Mobile app
// ============================================

export async function MobileRecommendationsAPI(userId: string) {
  // API для мобільного додатку

  const [personalized, trending, history] = await Promise.all([
    recommendationEngine.getPersonalizedRecommendations(userId, { limit: 20 }),
    recommendationEngine.getTrendingProducts({ limit: 10 }),
    // Отримуємо з локального сховища переглянуті товари
    getRecentlyViewedFromStorage().then(ids =>
      recommendationEngine.getRecommendationsFromHistory(ids, { limit: 10 })
    ),
  ]);

  return {
    sections: [
      {
        title: 'Рекомендовані для вас',
        type: 'personalized',
        products: personalized,
      },
      {
        title: 'Популярні зараз',
        type: 'trending',
        products: trending,
      },
      {
        title: 'На основі переглянутого',
        type: 'history',
        products: history,
      },
    ],
  };
}

// Helper function
async function getRecentlyViewedFromStorage(): Promise<string[]> {
  // Implementation depends on storage solution
  return [];
}
