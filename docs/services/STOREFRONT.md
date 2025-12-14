# Storefront (Next.js)

Клієнтський веб-додаток для покупців.

## Огляд

| Властивість | Значення |
|-------------|----------|
| Фреймворк | Next.js 16 (App Router) |
| React | 19 (Server Components) |
| Мова | TypeScript 5 |
| Стилі | Tailwind CSS 3 |
| ORM | Prisma 5 |
| Тести | Jest + React Testing Library |

## Структура проекту

```
storefront/
├── app/                          # Next.js App Router
│   ├── (shop)/                   # Public storefront routes
│   │   ├── page.tsx              # Homepage
│   │   ├── catalog/              # Product catalog
│   │   ├── product/[id]/         # Product detail
│   │   ├── category/[slug]/      # Category page
│   │   ├── cart/                 # Shopping cart
│   │   ├── checkout/             # Checkout flow
│   │   ├── search/               # Search results
│   │   └── order-status/         # Order tracking
│   │
│   ├── (auth)/                   # Authentication routes
│   │   ├── login/
│   │   ├── register/
│   │   └── forgot-password/
│   │
│   ├── (account)/                # User account
│   │   ├── profile/
│   │   ├── orders/
│   │   ├── wishlist/
│   │   └── settings/
│   │
│   ├── admin/                    # Admin panel
│   │   ├── dashboard/
│   │   ├── products/
│   │   ├── orders/
│   │   ├── customers/
│   │   ├── analytics/
│   │   └── warehouse/
│   │
│   ├── api/                      # API routes
│   │   ├── auth/
│   │   ├── products/
│   │   ├── cart/
│   │   └── webhooks/
│   │
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
│
├── components/                   # React components
│   ├── ui/                       # UI primitives
│   ├── forms/                    # Form components
│   ├── product/                  # Product components
│   ├── cart/                     # Cart components
│   ├── checkout/                 # Checkout components
│   └── admin/                    # Admin components
│
├── lib/                          # Utilities
│   ├── api/                      # API client
│   ├── auth/                     # Authentication
│   ├── i18n/                     # Internationalization
│   ├── payments/                 # Payment integrations
│   └── utils/                    # Helper functions
│
├── hooks/                        # Custom React hooks
├── stores/                       # Zustand stores
├── types/                        # TypeScript types
├── prisma/                       # Database schema
└── public/                       # Static assets
```

## Ключові сторінки

### Homepage (`app/page.tsx`)

```tsx
export default async function HomePage() {
  const [featuredProducts, categories, banners] = await Promise.all([
    getFeaturedProducts(),
    getTopCategories(),
    getActiveBanners(),
  ]);

  return (
    <>
      <HeroBanner banners={banners} />
      <CategoryGrid categories={categories} />
      <ProductCarousel title="Популярні товари" products={featuredProducts} />
      <PromoBanner />
      <NewArrivals />
      <BrandShowcase />
    </>
  );
}
```

### Product Page (`app/product/[id]/page.tsx`)

```tsx
export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id);

  if (!product) {
    notFound();
  }

  const [reviews, relatedProducts] = await Promise.all([
    getProductReviews(product.id),
    getRelatedProducts(product.categoryId),
  ]);

  return (
    <>
      <Breadcrumbs items={buildBreadcrumbs(product)} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ProductGallery images={product.images} />

        <div>
          <ProductInfo product={product} />
          <ProductOptions variants={product.variants} />
          <AddToCartButton product={product} />
          <ProductActions product={product} />
        </div>
      </div>

      <ProductTabs
        description={product.description}
        specifications={product.attributes}
        reviews={reviews}
      />

      <RelatedProducts products={relatedProducts} />
    </>
  );
}

// SEO
export async function generateMetadata({ params }): Promise<Metadata> {
  const product = await getProduct(params.id);

  return {
    title: product.metaTitle || product.name,
    description: product.metaDescription || product.shortDescription,
    openGraph: {
      images: [product.images[0]],
    },
  };
}
```

### Category Page (`app/category/[slug]/page.tsx`)

```tsx
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { [key: string]: string };
}) {
  const category = await getCategoryBySlug(params.slug);

  const filters = parseFilters(searchParams);
  const { products, total, facets } = await getProducts({
    categoryId: category.id,
    ...filters,
  });

  return (
    <>
      <CategoryHeader category={category} />

      <div className="grid grid-cols-4 gap-6">
        <aside>
          <ProductFilters facets={facets} activeFilters={filters} />
        </aside>

        <main className="col-span-3">
          <ProductToolbar total={total} sortBy={filters.sortBy} />
          <ProductGrid products={products} />
          <Pagination total={total} pageSize={filters.pageSize} />
        </main>
      </div>
    </>
  );
}
```

### Cart Page (`app/cart/page.tsx`)

```tsx
'use client';

import { useCart } from '@/hooks/useCart';

export default function CartPage() {
  const { items, total, updateQuantity, removeItem, isLoading } = useCart();

  if (items.length === 0) {
    return <EmptyCart />;
  }

  return (
    <div className="grid grid-cols-3 gap-8">
      <div className="col-span-2">
        <h1 className="text-2xl font-bold mb-6">Кошик</h1>

        <CartItemList
          items={items}
          onUpdateQuantity={updateQuantity}
          onRemove={removeItem}
        />
      </div>

      <aside>
        <CartSummary total={total} />
        <PromoCodeInput />
        <CheckoutButton disabled={isLoading} />
      </aside>
    </div>
  );
}
```

### Checkout Page (`app/checkout/page.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { useCheckout } from '@/hooks/useCheckout';

export default function CheckoutPage() {
  const [step, setStep] = useState(1);
  const { cart, shipping, payment, placeOrder } = useCheckout();

  return (
    <div className="grid grid-cols-3 gap-8">
      <main className="col-span-2">
        <CheckoutSteps current={step} />

        {step === 1 && (
          <ContactInfoForm onNext={() => setStep(2)} />
        )}

        {step === 2 && (
          <ShippingForm
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <PaymentForm
            onSubmit={placeOrder}
            onBack={() => setStep(2)}
          />
        )}
      </main>

      <aside>
        <OrderSummary cart={cart} shipping={shipping} />
      </aside>
    </div>
  );
}
```

## Компоненти

### Product Card

```tsx
// components/product/ProductCard.tsx
interface ProductCardProps {
  product: Product;
  showQuickView?: boolean;
}

export function ProductCard({ product, showQuickView = true }: ProductCardProps) {
  const { addItem } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  return (
    <div className="group relative bg-white rounded-lg shadow-sm hover:shadow-md transition">
      {/* Badges */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        {product.isNew && <Badge variant="new">Новинка</Badge>}
        {product.discount > 0 && <Badge variant="sale">-{product.discount}%</Badge>}
      </div>

      {/* Wishlist button */}
      <button
        onClick={() => toggleWishlist(product.id)}
        className="absolute top-2 right-2 z-10"
      >
        <HeartIcon filled={isInWishlist(product.id)} />
      </button>

      {/* Image */}
      <Link href={`/product/${product.id}`}>
        <div className="aspect-square overflow-hidden rounded-t-lg">
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition"
          />
        </div>
      </Link>

      {/* Content */}
      <div className="p-4">
        <Link href={`/product/${product.id}`}>
          <h3 className="font-medium line-clamp-2 hover:text-primary">
            {product.name}
          </h3>
        </Link>

        <div className="mt-2 flex items-center gap-2">
          <span className="text-lg font-bold">{formatPrice(product.price)}</span>
          {product.oldPrice && (
            <span className="text-sm text-gray-400 line-through">
              {formatPrice(product.oldPrice)}
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-1">
          <StarRating value={product.rating} />
          <span className="text-sm text-gray-500">({product.reviewCount})</span>
        </div>

        {/* Quick add */}
        <Button
          onClick={() => addItem(product)}
          className="mt-4 w-full"
          disabled={!product.inStock}
        >
          {product.inStock ? 'Додати в кошик' : 'Немає в наявності'}
        </Button>
      </div>

      {/* Quick view */}
      {showQuickView && (
        <QuickViewButton product={product} />
      )}
    </div>
  );
}
```

### Product Filters

```tsx
// components/product/ProductFilters.tsx
interface ProductFiltersProps {
  facets: Facets;
  activeFilters: Filters;
  onChange: (filters: Filters) => void;
}

export function ProductFilters({ facets, activeFilters, onChange }: ProductFiltersProps) {
  return (
    <div className="space-y-6">
      {/* Price range */}
      <FilterSection title="Ціна">
        <PriceRangeSlider
          min={facets.priceRange.min}
          max={facets.priceRange.max}
          value={[activeFilters.priceMin, activeFilters.priceMax]}
          onChange={([min, max]) => onChange({ ...activeFilters, priceMin: min, priceMax: max })}
        />
      </FilterSection>

      {/* Categories */}
      <FilterSection title="Категорії">
        <CheckboxGroup
          options={facets.categories}
          value={activeFilters.categories}
          onChange={(categories) => onChange({ ...activeFilters, categories })}
        />
      </FilterSection>

      {/* Brands */}
      <FilterSection title="Бренди">
        <CheckboxGroup
          options={facets.brands}
          value={activeFilters.brands}
          onChange={(brands) => onChange({ ...activeFilters, brands })}
        />
      </FilterSection>

      {/* Dynamic attributes */}
      {facets.attributes.map((attr) => (
        <FilterSection key={attr.id} title={attr.name}>
          <CheckboxGroup
            options={attr.values}
            value={activeFilters.attributes?.[attr.id] || []}
            onChange={(values) => onChange({
              ...activeFilters,
              attributes: { ...activeFilters.attributes, [attr.id]: values },
            })}
          />
        </FilterSection>
      ))}

      {/* In stock */}
      <FilterSection>
        <Checkbox
          checked={activeFilters.inStock}
          onChange={(inStock) => onChange({ ...activeFilters, inStock })}
        >
          Тільки в наявності
        </Checkbox>
      </FilterSection>

      {/* Reset */}
      <Button variant="outline" onClick={() => onChange({})}>
        Скинути фільтри
      </Button>
    </div>
  );
}
```

## State Management (Zustand)

### Cart Store

```tsx
// stores/cart.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartStore {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, quantity = 1) => {
        set((state) => {
          const existing = state.items.find((i) => i.productId === product.id);

          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === product.id
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              ),
            };
          }

          return {
            items: [...state.items, {
              productId: product.id,
              name: product.name,
              price: product.price,
              image: product.images[0],
              quantity,
            }],
          };
        });
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        }));
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }

        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId ? { ...i, quantity } : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      get total() {
        return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      },

      get itemCount() {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },
    }),
    { name: 'cart-storage' }
  )
);
```

## API Client

```tsx
// lib/api/client.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL;

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new ApiError(response.status, await response.json());
    }

    return response.json();
  }

  // Products
  getProducts(params: ProductsParams) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<ProductsResponse>(`/products?${query}`);
  }

  getProduct(id: string) {
    return this.request<Product>(`/products/${id}`);
  }

  // Cart
  getCart() {
    return this.request<Cart>('/cart');
  }

  addToCart(productId: string, quantity: number) {
    return this.request<Cart>('/cart/items', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    });
  }

  // Orders
  createOrder(data: CreateOrderData) {
    return this.request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getOrders() {
    return this.request<Order[]>('/orders');
  }
}

export const api = new ApiClient();
```

## SEO

### Metadata

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  title: {
    template: '%s | Your Store',
    default: 'Your Store - Інтернет-магазин',
  },
  description: 'Купуйте якісні товари за найкращими цінами',
  openGraph: {
    type: 'website',
    locale: 'uk_UA',
    siteName: 'Your Store',
  },
};
```

### JSON-LD

```tsx
// components/seo/ProductJsonLd.tsx
export function ProductJsonLd({ product }: { product: Product }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images,
    sku: product.sku,
    brand: {
      '@type': 'Brand',
      name: product.brand,
    },
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'UAH',
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
```

## Конфігурація

```bash
# API
NEXT_PUBLIC_API_URL=https://api.yourstore.com
NEXT_PUBLIC_SITE_URL=https://yourstore.com

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/storefront

# Auth
NEXTAUTH_URL=https://yourstore.com
NEXTAUTH_SECRET=your-secret

# Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_FB_PIXEL_ID=1234567890

# Payments
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_live_xxx
NEXT_PUBLIC_LIQPAY_PUBLIC_KEY=xxx
```

## Запуск

```bash
cd services/storefront

# Development
npm run dev

# Production build
npm run build
npm start

# Tests
npm test
npm run test:coverage
```
