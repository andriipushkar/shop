# Performance Optimization Guide

This document outlines the performance optimizations implemented in the storefront application and provides guidelines for maintaining optimal performance.

## Table of Contents

1. [Overview](#overview)
2. [Performance Targets](#performance-targets)
3. [Optimization Strategies](#optimization-strategies)
4. [Caching Layer](#caching-layer)
5. [Image Optimization](#image-optimization)
6. [Bundle Optimization](#bundle-optimization)
7. [Database Performance](#database-performance)
8. [Monitoring & Auditing](#monitoring--auditing)
9. [Best Practices](#best-practices)

## Overview

Our performance optimization strategy focuses on:

- **Fast Initial Load**: Minimize Time to First Byte (TTFB) and First Contentful Paint (FCP)
- **Quick Interactivity**: Reduce Total Blocking Time (TBT) and Time to Interactive (TTI)
- **Visual Stability**: Minimize Cumulative Layout Shift (CLS)
- **Efficient Caching**: Implement multi-layer caching strategy
- **Optimized Assets**: Compress and optimize all static resources

## Performance Targets

### Core Web Vitals

| Metric | Target | Current |
|--------|--------|---------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Monitor with Lighthouse |
| **FID** (First Input Delay) | < 100ms | Monitor with Lighthouse |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Monitor with Lighthouse |

### Lighthouse Scores

| Category | Target Score |
|----------|-------------|
| Performance | ≥ 90 |
| Accessibility | ≥ 90 |
| Best Practices | ≥ 90 |
| SEO | ≥ 90 |

### Additional Metrics

| Metric | Target |
|--------|--------|
| **FCP** (First Contentful Paint) | < 1.8s |
| **TTI** (Time to Interactive) | < 3.8s |
| **TBT** (Total Blocking Time) | < 200ms |
| **Speed Index** | < 3.4s |

## Optimization Strategies

### 1. Server-Side Rendering (SSR)

We use Next.js App Router for optimal rendering strategies:

```typescript
// Static Generation for product pages
export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({
    slug: product.slug,
  }));
}

// Server Components by default
export default async function ProductPage({ params }) {
  const product = await getProduct(params.slug);
  return <ProductView product={product} />;
}
```

### 2. Code Splitting

Automatic route-based code splitting + manual dynamic imports:

```typescript
// Lazy load heavy components
const AdminPanel = dynamic(() => import('@/components/admin/AdminPanel'), {
  loading: () => <LoadingSpinner />,
  ssr: false,
});

// Lazy load charts
const Charts = dynamic(() => import('recharts'), {
  loading: () => <LoadingSpinner />,
  ssr: false,
});
```

### 3. Tree Shaking

Use modular imports to enable tree shaking:

```typescript
// ❌ Bad - imports entire library
import { Icon } from '@heroicons/react/24/outline';

// ✅ Good - imports only what's needed
import Icon from '@heroicons/react/24/outline/Icon';
```

## Caching Layer

### Multi-Layer Caching Strategy

```
┌─────────────────┐
│  Browser Cache  │  (Service Worker, HTTP Cache)
└────────┬────────┘
         │
┌────────▼────────┐
│   Redis Cache   │  (Server-side, 5min - 7days)
└────────┬────────┘
         │
┌────────▼────────┐
│    Database     │  (PostgreSQL with indexes)
└─────────────────┘
```

### Redis Cache Configuration

Located in `/lib/cache/redis-cache.ts`:

```typescript
// Cache TTL Configuration
export const CACHE_TTL = {
  PRODUCTS: 5 * 60,        // 5 minutes
  CATEGORIES: 60 * 60,     // 1 hour
  SESSION: 7 * 24 * 60 * 60, // 7 days
  SEARCH: 10 * 60,         // 10 minutes
};

// Usage example
import { redisCache } from '@/lib/cache/redis-cache';

const product = await redisCache.cacheProduct(
  productId,
  () => fetchProductFromDB(productId)
);
```

### API Caching Middleware

Located in `/lib/cache/cache-middleware.ts`:

```typescript
import { withCache, CachePresets } from '@/lib/cache/cache-middleware';

// Cache API responses
export const GET = withCache(CachePresets.product)(async (req) => {
  const data = await fetchProduct();
  return NextResponse.json(data);
});
```

Features:
- **Stale-While-Revalidate**: Serve stale content while fetching fresh data
- **ETag Support**: Conditional requests to reduce bandwidth
- **Cache Headers**: Proper HTTP caching headers

### Cache Invalidation

```typescript
// Invalidate specific product
await redisCache.invalidateProduct(productId);

// Invalidate by tag
await redisCache.invalidateAllProducts();

// Invalidate API cache
import { invalidateCacheByTag } from '@/lib/cache/cache-middleware';
await invalidateCacheByTag('products');
```

### Cache Warming

Pre-populate cache with popular items:

```typescript
import { redisCache } from '@/lib/cache/redis-cache';

// Warm popular products on server start
await redisCache.warmPopularProducts(async () => {
  return await fetchPopularProducts();
});

// Warm categories
await redisCache.warmCategories(async () => {
  return await fetchAllCategories();
});
```

## Image Optimization

### Next.js Image Component

Always use the Next.js Image component:

```tsx
import Image from 'next/image';

<Image
  src="/product.jpg"
  alt="Product"
  width={800}
  height={600}
  priority // For above-the-fold images
  placeholder="blur"
  blurDataURL="data:image/..."
/>
```

### Advanced Image Optimizer

Located in `/lib/performance/image-optimizer.ts`:

```typescript
import { imageOptimizer } from '@/lib/performance/image-optimizer';

// Optimize image with responsive sizes
const result = await imageOptimizer.optimize('/path/to/image.jpg', {
  width: 1200,
  quality: 80,
  format: 'webp',
  generatePlaceholder: true,
  responsiveSizes: [640, 768, 1024, 1280, 1920],
});

// Result includes:
// - src: Main optimized image
// - webp: WebP variant
// - avif: AVIF variant
// - srcset: Responsive sizes
// - placeholder: Blur placeholder
```

### Image Formats

Priority order:
1. **AVIF** - Best compression, modern browsers
2. **WebP** - Good compression, wide support
3. **JPEG** - Fallback for older browsers

```html
<picture>
  <source type="image/avif" srcset="image.avif" />
  <source type="image/webp" srcset="image.webp" />
  <img src="image.jpg" alt="Product" />
</picture>
```

### Lazy Loading

```tsx
// Native lazy loading
<img loading="lazy" src="image.jpg" alt="Product" />

// Or use Next.js Image (lazy by default)
<Image src="image.jpg" alt="Product" width={800} height={600} />
```

## Bundle Optimization

### Bundle Analysis

Run bundle analyzer to identify large dependencies:

```bash
# Analyze bundle size
npm run analyze

# Or using the script
npm run analyze-bundle
```

This generates:
- Visual bundle size report
- Optimization suggestions
- Large dependency identification

### Code Splitting Configuration

Located in `next.config.ts`:

```typescript
webpack: (config, { dev }) => {
  if (!dev) {
    config.optimization.splitChunks = {
      cacheGroups: {
        vendor: {
          test: /node_modules/,
          name: 'vendor',
          chunks: 'all',
        },
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: 'react',
          priority: 30,
        },
        charts: {
          test: /[\\/]node_modules[\\/](recharts)[\\/]/,
          name: 'charts',
          chunks: 'async',
        },
      },
    };
  }
  return config;
}
```

### Reducing Bundle Size

1. **Use modular imports** (configured in `next.config.ts`)
2. **Remove unused dependencies**
3. **Use dynamic imports for heavy components**
4. **Enable tree shaking**

## Database Performance

### Index Strategy

We've added comprehensive indexes in `/prisma/migrations/add_indexes.sql`:

#### Product Indexes
- `idx_products_category_id` - Filter by category
- `idx_products_price` - Price range queries
- `idx_products_created_at` - Sort by date
- `idx_products_category_price` - Combined filtering
- Full-text search indexes

#### Order Indexes
- `idx_orders_user_id` - User order history
- `idx_orders_status` - Filter by status
- `idx_orders_created_at` - Sort by date
- `idx_orders_user_status` - Combined filtering

#### Review Indexes
- `idx_reviews_product_id` - Product reviews
- `idx_reviews_rating` - Filter by rating
- `idx_reviews_published` - Published reviews only

### Applying Indexes

```bash
# Run migration
psql -U username -d database -f prisma/migrations/add_indexes.sql
```

### Query Optimization

```typescript
// ✅ Good - uses indexes
const products = await prisma.product.findMany({
  where: {
    categoryId: 'category-id',
    status: 'ACTIVE',
  },
  orderBy: {
    price: 'asc',
  },
});

// ❌ Bad - no index on custom field
const products = await prisma.$queryRaw`
  SELECT * FROM products
  WHERE custom_field = 'value'
`;
```

### Connection Pooling

Configure in `.env`:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/db?connection_limit=10"
```

## Monitoring & Auditing

### Lighthouse Audits

Run automated Lighthouse audits:

```bash
# Single audit
npm run lighthouse-audit

# With custom URL
npm run lighthouse-audit -- --url=https://example.com

# In CI/CD
npx lhci autorun
```

Configuration in `.lighthouserc.js`:
- Performance budgets
- Assertion thresholds
- Multiple URL testing
- Report generation

### Performance Monitoring

Add to your application:

```typescript
// Web Vitals monitoring
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  // Send to your analytics service
  console.log(metric);
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

### Real User Monitoring (RUM)

Use Next.js built-in analytics:

```typescript
// app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
```

## Best Practices

### 1. Component Optimization

```typescript
// Use React.memo for expensive components
const ProductCard = React.memo(({ product }) => {
  return <div>{product.name}</div>;
});

// Use useMemo for expensive calculations
const sortedProducts = useMemo(() => {
  return products.sort((a, b) => a.price - b.price);
}, [products]);

// Use useCallback for event handlers
const handleClick = useCallback(() => {
  // Handle click
}, []);
```

### 2. Font Optimization

```typescript
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

export default function RootLayout({ children }) {
  return (
    <html className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
```

### 3. Resource Hints

```tsx
// Preconnect to external origins
<link rel="preconnect" href="https://cdn.example.com" />

// Prefetch next page
<link rel="prefetch" href="/products" />

// Preload critical resources
<link rel="preload" href="/hero.jpg" as="image" />
```

### 4. API Optimization

```typescript
// Implement pagination
export async function getProducts(page = 1, limit = 20) {
  return await prisma.product.findMany({
    take: limit,
    skip: (page - 1) * limit,
  });
}

// Select only needed fields
export async function getProducts() {
  return await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      price: true,
      image: true,
    },
  });
}
```

### 5. Third-Party Scripts

```tsx
import Script from 'next/script';

// Defer non-critical scripts
<Script
  src="https://analytics.example.com/script.js"
  strategy="lazyOnload"
/>

// Load after page is interactive
<Script
  src="https://chat.example.com/widget.js"
  strategy="afterInteractive"
/>
```

## Performance Checklist

- [ ] Images optimized (WebP/AVIF, lazy loading, blur placeholder)
- [ ] Code splitting implemented (route-based + dynamic imports)
- [ ] Bundle size under budget (< 350KB JS, < 50KB CSS)
- [ ] Redis caching enabled for API routes
- [ ] Database indexes created
- [ ] Lighthouse score ≥ 90
- [ ] Core Web Vitals passing (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- [ ] Service Worker for offline support
- [ ] HTTP/2 enabled on server
- [ ] Brotli/GZIP compression enabled
- [ ] CDN configured for static assets

## Troubleshooting

### Slow Page Load

1. Run Lighthouse audit to identify bottlenecks
2. Check bundle size with `npm run analyze-bundle`
3. Review Network tab in DevTools
4. Verify cache headers are set correctly
5. Check database query performance

### High CLS

1. Set explicit width/height on images
2. Reserve space for dynamic content
3. Avoid inserting content above existing content
4. Use `font-display: swap` for web fonts

### Large Bundle Size

1. Run `npm run analyze-bundle`
2. Remove unused dependencies
3. Use dynamic imports for large components
4. Enable tree shaking with ES modules

### Cache Not Working

1. Verify Redis is running
2. Check Redis connection in logs
3. Verify cache keys are consistent
4. Check TTL configuration

## Resources

- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Web.dev Performance](https://web.dev/performance/)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [Web Vitals](https://web.dev/vitals/)

## Scripts Reference

```bash
# Development
npm run dev                  # Start dev server

# Production
npm run build               # Build for production
npm run start               # Start production server

# Analysis
npm run analyze-bundle      # Analyze bundle size
npm run lighthouse-audit    # Run Lighthouse audit

# Testing
npm run test               # Run unit tests
npm run test:e2e           # Run E2E tests
```

## Contact

For performance-related questions or issues, contact the development team or open an issue in the repository.
