# Storefront Architecture

Архітектура фронтенду для покупців.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       STOREFRONT ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Browser ──▶ CDN ──▶ Next.js Server ──▶ API Gateway ──▶ Backend Services   │
│                           │                                                  │
│                           ├── SSR/SSG                                       │
│                           ├── API Routes                                    │
│                           └── Edge Functions                                │
│                                                                              │
│  Tech Stack:                                                                │
│  ├── Framework: Next.js 14 (App Router)                                    │
│  ├── Language: TypeScript                                                  │
│  ├── Styling: Tailwind CSS                                                 │
│  ├── State: Zustand + React Query                                          │
│  └── UI: Radix UI + custom components                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
services/storefront/
├── app/                        # Next.js App Router
│   ├── (shop)/                # Shop routes group
│   │   ├── page.tsx           # Homepage
│   │   ├── products/
│   │   │   ├── page.tsx       # Product listing
│   │   │   └── [slug]/
│   │   │       └── page.tsx   # Product detail
│   │   ├── categories/
│   │   │   └── [slug]/
│   │   │       └── page.tsx   # Category page
│   │   ├── cart/
│   │   │   └── page.tsx       # Cart page
│   │   ├── checkout/
│   │   │   └── page.tsx       # Checkout page
│   │   └── search/
│   │       └── page.tsx       # Search results
│   ├── (auth)/                # Auth routes group
│   │   ├── login/
│   │   ├── register/
│   │   └── forgot-password/
│   ├── (account)/             # Account routes (protected)
│   │   ├── profile/
│   │   ├── orders/
│   │   └── wishlist/
│   ├── api/                   # API routes
│   │   ├── cart/
│   │   ├── checkout/
│   │   └── revalidate/
│   ├── layout.tsx             # Root layout
│   └── not-found.tsx          # 404 page
├── components/
│   ├── ui/                    # Base UI components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── modal.tsx
│   │   └── ...
│   ├── product/               # Product components
│   │   ├── ProductCard.tsx
│   │   ├── ProductGallery.tsx
│   │   ├── ProductInfo.tsx
│   │   └── ProductReviews.tsx
│   ├── cart/                  # Cart components
│   │   ├── CartDrawer.tsx
│   │   ├── CartItem.tsx
│   │   └── CartSummary.tsx
│   ├── checkout/              # Checkout components
│   │   ├── CheckoutForm.tsx
│   │   ├── ShippingSelector.tsx
│   │   └── PaymentSelector.tsx
│   └── layout/                # Layout components
│       ├── Header.tsx
│       ├── Footer.tsx
│       ├── Navigation.tsx
│       └── MobileMenu.tsx
├── lib/
│   ├── api/                   # API client
│   │   ├── client.ts
│   │   ├── products.ts
│   │   ├── cart.ts
│   │   └── orders.ts
│   ├── hooks/                 # Custom hooks
│   │   ├── useCart.ts
│   │   ├── useAuth.ts
│   │   └── useSearch.ts
│   ├── stores/                # Zustand stores
│   │   ├── cart.ts
│   │   └── ui.ts
│   └── utils/                 # Utilities
│       ├── format.ts
│       └── validation.ts
├── styles/
│   └── globals.css
└── public/
    ├── images/
    └── icons/
```

## Rendering Strategy

### Static Generation (SSG)

```typescript
// app/products/[slug]/page.tsx
import { getProduct, getProducts } from '@/lib/api/products';

// Generate static pages at build time
export async function generateStaticParams() {
  const products = await getProducts({ limit: 1000 });
  return products.map((product) => ({
    slug: product.slug,
  }));
}

export default async function ProductPage({
  params,
}: {
  params: { slug: string };
}) {
  const product = await getProduct(params.slug);

  return (
    <div>
      <ProductGallery images={product.images} />
      <ProductInfo product={product} />
      <ProductReviews productId={product.id} />
    </div>
  );
}

// Revalidate every hour
export const revalidate = 3600;
```

### Server-Side Rendering (SSR)

```typescript
// app/search/page.tsx
import { searchProducts } from '@/lib/api/products';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  // Always render fresh for search
  const results = await searchProducts({
    query: searchParams.q || '',
    page: parseInt(searchParams.page || '1'),
  });

  return <SearchResults results={results} />;
}

// Disable caching for dynamic content
export const dynamic = 'force-dynamic';
```

### Client-Side Rendering

```typescript
// components/cart/CartDrawer.tsx
'use client';

import { useCart } from '@/lib/hooks/useCart';
import { useQuery } from '@tanstack/react-query';

export function CartDrawer() {
  const { items, isOpen, toggle } = useCart();

  const { data: cart } = useQuery({
    queryKey: ['cart'],
    queryFn: () => fetchCart(),
    enabled: isOpen,
  });

  return (
    <Drawer open={isOpen} onClose={toggle}>
      {cart?.items.map((item) => (
        <CartItem key={item.id} item={item} />
      ))}
    </Drawer>
  );
}
```

## State Management

### Cart Store (Zustand)

```typescript
// lib/stores/cart.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartItem {
  productId: string;
  quantity: number;
  variant?: string;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  toggleCart: () => void;
  clearCart: () => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === item.productId && i.variant === item.variant
          );

          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId && i.variant === item.variant
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i
              ),
            };
          }

          return { items: [...state.items, item] };
        }),

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        })),

      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId ? { ...i, quantity } : i
          ),
        })),

      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'cart-storage',
    }
  )
);
```

### Server State (React Query)

```typescript
// lib/hooks/useProducts.ts
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { getProducts, getProduct } from '@/lib/api/products';

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: () => getProduct(slug),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useInfiniteProducts(filters: ProductFilters) {
  return useInfiniteQuery({
    queryKey: ['products', filters],
    queryFn: ({ pageParam = 1 }) =>
      getProducts({ ...filters, page: pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 60 * 1000, // 1 minute
  });
}
```

## API Integration

### API Client

```typescript
// lib/api/client.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL;

class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new APIError(error);
    }

    return response.json();
  }

  get<T>(endpoint: string, options?: RequestInit) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, data: unknown, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new APIClient(API_BASE);
```

### Products API

```typescript
// lib/api/products.ts
import { api } from './client';

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: Category;
  variants: Variant[];
  inStock: boolean;
}

export async function getProducts(params: ProductParams) {
  const searchParams = new URLSearchParams();
  if (params.category) searchParams.set('category', params.category);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  return api.get<ProductListResponse>(
    `/products?${searchParams.toString()}`
  );
}

export async function getProduct(slug: string) {
  return api.get<Product>(`/products/${slug}`);
}

export async function searchProducts(query: string) {
  return api.get<ProductListResponse>(
    `/search?q=${encodeURIComponent(query)}`
  );
}
```

## Performance Optimization

### Image Optimization

```typescript
// components/product/ProductImage.tsx
import Image from 'next/image';

export function ProductImage({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={600}
      height={600}
      quality={80}
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,..."
      sizes="(max-width: 768px) 100vw, 50vw"
      className="object-cover"
    />
  );
}
```

### Code Splitting

```typescript
// Dynamic imports for heavy components
import dynamic from 'next/dynamic';

const ProductReviews = dynamic(
  () => import('@/components/product/ProductReviews'),
  {
    loading: () => <ReviewsSkeleton />,
    ssr: false,
  }
);

const ImageGallery = dynamic(
  () => import('@/components/product/ImageGallery'),
  {
    loading: () => <GallerySkeleton />,
  }
);
```

### Prefetching

```typescript
// components/product/ProductCard.tsx
import Link from 'next/link';

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      prefetch={true}  // Prefetch on hover
    >
      <div className="product-card">
        <ProductImage src={product.images[0]} alt={product.name} />
        <h3>{product.name}</h3>
        <p>{formatPrice(product.price)}</p>
      </div>
    </Link>
  );
}
```

## SEO

### Metadata

```typescript
// app/products/[slug]/page.tsx
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const product = await getProduct(params.slug);

  return {
    title: `${product.name} | Shop`,
    description: product.description.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.description,
      images: [{ url: product.images[0] }],
      type: 'product',
    },
  };
}
```

### Structured Data

```typescript
// components/product/ProductSchema.tsx
export function ProductSchema({ product }: { product: Product }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images,
    sku: product.sku,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'UAH',
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

## See Also

- [Admin Architecture](./ADMIN_ARCHITECTURE.md)
- [Web Vitals](../modules/WEB_VITALS.md)
- [Components Guide](../guides/COMPONENTS.md)
