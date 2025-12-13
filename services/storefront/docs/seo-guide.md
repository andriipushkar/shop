# SEO Guide for TechShop Storefront

This document describes the SEO implementation in the TechShop storefront, including metadata, structured data, performance optimization, and best practices.

## Table of Contents

1. [Metadata Configuration](#metadata-configuration)
2. [Hreflang & Internationalization](#hreflang--internationalization)
3. [Pagination SEO](#pagination-seo)
4. [Structured Data (JSON-LD)](#structured-data-json-ld)
5. [Extended Product Schema](#extended-product-schema)
6. [Dynamic OG Images](#dynamic-og-images)
7. [Pinterest Rich Pins](#pinterest-rich-pins)
8. [Web Vitals Tracking](#web-vitals-tracking)
9. [Sitemap & Robots.txt](#sitemap--robotstxt)
10. [Image Optimization](#image-optimization-new)
11. [Font Optimization](#font-optimization)
12. [Accessibility](#accessibility)
13. [Security Headers](#security-headers)
14. [PWA & Offline Support](#pwa--offline-support)
15. [Automated Tests](#automated-tests)
16. [Manual Testing Checklist](#manual-testing-checklist)

---

## Metadata Configuration

### Homepage Metadata (NEW)

The homepage (`app/page.tsx`) now includes comprehensive SEO metadata:

```typescript
export const metadata: Metadata = {
  title: "TechShop - Інтернет-магазин електроніки в Україні",
  description: "Купити смартфони, ноутбуки, планшети та електроніку в TechShop. ⭐ Офіційна гарантія ✓ Доставка по всій Україні ✓ Найкращі ціни ✓ 5000+ товарів",
  keywords: ["інтернет-магазин", "електроніка", "смартфони", "ноутбуки", ...],
  alternates: {
    canonical: BASE_URL,
    languages: {
      'uk-UA': BASE_URL,
      'en-US': `${BASE_URL}/en`,
    },
  },
  openGraph: { ... },
  twitter: { card: "summary_large_image", ... },
};
```

**Features:**
- SEO-optimized Ukrainian title and description
- Keywords for main product categories
- Canonical URL with hreflang for multi-language support
- Open Graph and Twitter Card metadata
- H1 heading (visually hidden but accessible)

### Dynamic Metadata for Product Pages

Product pages use `generateMetadata` in `app/product/[id]/layout.tsx` for dynamic SEO:

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const product = await getProduct(params.id);

  return {
    title: `${product.name} - купити в TechShop | Ціна ${product.price} ₴`,
    description: `${product.name} ⭐ ${product.rating}/5...`,
    alternates: {
      canonical: `${BASE_URL}/product/${id}`,
      languages: {
        'uk-UA': `${BASE_URL}/product/${id}`,
        'en-US': `${BASE_URL}/en/product/${id}`,
      },
    },
    openGraph: {
      title: product.name,
      images: [{ url: ogImageUrl }],
    },
  };
}
```

### Category Pages

Category pages use dynamic metadata in `app/category/[slug]/layout.tsx`:

- Dynamic titles with category name
- Product count and price range in description
- Category-specific keywords
- CollectionPage structured data

### Metadata Library

Centralized metadata configuration in `lib/metadata.ts`:

- `pageMetadata` - Pre-defined metadata for static pages
- `getCanonicalUrl()` - Helper for canonical URLs
- Supports `robots: { index: false }` for private pages

---

## Hreflang & Internationalization

All pages now include hreflang tags for multi-language support.

### Helper Function

Use `generateHreflangAlternates` from `lib/seo-config.ts`:

```typescript
import { generateHreflangAlternates } from '@/lib/seo-config';

const hreflang = generateHreflangAlternates('/category/smartphones');
// Returns:
// {
//   canonical: 'https://techshop.ua/category/smartphones',
//   languages: {
//     'uk-UA': 'https://techshop.ua/category/smartphones',
//     'en-US': 'https://techshop.ua/en/category/smartphones',
//     'x-default': 'https://techshop.ua/category/smartphones',
//   }
// }
```

### Usage in Layout

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const hreflang = generateHreflangAlternates(`/category/${slug}`);

  return {
    alternates: {
      canonical: hreflang.canonical,
      languages: hreflang.languages,
    },
  };
}
```

### Implemented Pages

- Homepage (`/`)
- Category pages (`/category/[slug]`)
- Search pages (`/search`)
- Product pages (`/product/[id]`)

---

## Pagination SEO

Pagination is properly handled for SEO with `rel="prev"` and `rel="next"` links.

### Helper Function

```typescript
import { generatePaginationMeta } from '@/lib/seo-config';

const pagination = generatePaginationMeta({
  currentPage: 2,
  totalPages: 10,
  basePath: '/category/smartphones',
  queryParams: { sort: 'price' },
});
// Returns:
// {
//   canonical: 'https://techshop.ua/category/smartphones?sort=price&page=2',
//   prev: 'https://techshop.ua/category/smartphones?sort=price',
//   next: 'https://techshop.ua/category/smartphones?sort=price&page=3',
// }
```

### PaginationSEO Component

```typescript
import { PaginationSEO } from '@/components/ProductJsonLd';

<PaginationSEO
  currentPage={2}
  totalPages={10}
  basePath="/category/smartphones"
  queryParams={{ sort: 'price' }}
/>
// Renders <link rel="prev" /> and <link rel="next" /> tags
```

### Best Practices

- First page has no `?page=1` parameter (cleaner URLs)
- Deep pagination (page > 5) is not indexed
- Filtered/sorted pages are blocked in robots.txt

---

## Structured Data (JSON-LD)

All structured data components are in `components/ProductJsonLd.tsx`:

### Product Schema

```typescript
<ProductJsonLd product={product} />
```

Includes:
- Product name, description, SKU
- Brand information
- Price offers with currency (UAH)
- Availability status
- Aggregate ratings

### FAQPage Schema

```typescript
<FAQJsonLd items={faqItems} />
```

Used on `/faq` page for rich FAQ snippets in search results.

### CollectionPage Schema

```typescript
<CollectionPageJsonLd
  name="Смартфони"
  itemCount={150}
  aggregateRating={{ ratingValue: 4.5, reviewCount: 1250 }}
/>
```

Used on category pages.

### ReviewJsonLd Schema (NEW)

```typescript
<ReviewJsonLd
  productName="iPhone 15 Pro Max"
  productId="1"
  reviews={[
    {
      author: 'Іван',
      datePublished: '2025-01-15',
      rating: 5,
      reviewBody: 'Чудовий товар!',
    },
  ]}
/>
```

Used on product pages to display user reviews with aggregate ratings in search results.

**Features:**
- Aggregates all reviews into `AggregateRating` schema
- Individual reviews with `Review` schema
- Links reviews to product using `@id` reference

### ItemListJsonLd Schema (NEW)

```typescript
<ItemListJsonLd
  name="Популярні товари TechShop"
  description="Найпопулярніші товари в інтернет-магазині"
  products={products.slice(0, 20).map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    image_url: p.image_url,
    rating: p.rating,
  }))}
  url="/"
/>
```

Used on homepage and category pages for product listing schema.

**Benefits:**
- Improves visibility in Google Shopping results
- Shows rich product carousels in search results
- Links to individual product pages

### BreadcrumbList Schema

```typescript
<BreadcrumbJsonLd items={[
  { name: 'Головна', url: '/' },
  { name: 'Смартфони', url: '/category/smartphones' },
]} />
```

Included in product and category pages.

### VideoObject Schema (NEW)

For product review videos:

```typescript
import { VideoObjectJsonLd } from '@/components/ProductJsonLd';

<VideoObjectJsonLd
  name="Огляд iPhone 15 Pro Max"
  description="Детальний огляд нового iPhone 15 Pro Max"
  thumbnailUrl="https://example.com/thumbnail.jpg"
  uploadDate="2025-01-15"
  duration="PT5M30S"
  embedUrl="https://youtube.com/embed/xxx"
/>
```

### HowTo Schema (NEW)

For product setup guides:

```typescript
import { HowToJsonLd } from '@/components/ProductJsonLd';

<HowToJsonLd
  name="Як налаштувати iPhone 15"
  description="Покрокова інструкція з налаштування"
  totalTime="PT15M"
  steps={[
    { name: 'Увімкніть iPhone', text: 'Натисніть бокову кнопку' },
    { name: 'Виберіть мову', text: 'Оберіть українську' },
  ]}
/>
```

### LocalBusiness Schema (NEW)

For physical store information:

```typescript
import { LocalBusinessJsonLd } from '@/components/ProductJsonLd';

<LocalBusinessJsonLd
  name="TechShop"
  address={{
    street: 'вул. Хрещатик, 1',
    city: 'Київ',
    postalCode: '01001'
  }}
  geo={{ latitude: 50.4501, longitude: 30.5234 }}
/>
```

### Organization & WebSite Schema

Global schemas in `app/layout.tsx`:
- OrganizationJsonLd - Company info, contacts, social links
- WebSiteJsonLd - Site search action

---

## Extended Product Schema

Enhanced Product JSON-LD with warranty, shipping, and return policy.

### ExtendedProductJsonLd Component

```typescript
import { ExtendedProductJsonLd } from '@/components/ProductJsonLd';

<ExtendedProductJsonLd
  product={{
    id: '1',
    name: 'iPhone 15 Pro',
    description: 'Latest Apple smartphone',
    price: 49999,
    sku: 'IP15PRO-256',
    stock: 15,
    brand: 'Apple',
    images: ['/img1.jpg', '/img2.jpg'],
    rating: 4.8,
    reviewCount: 150,
  }}
  warranty={{
    durationMonths: 12,
    type: 'manufacturer', // or 'seller'
  }}
  shipping={{
    freeShippingThreshold: 2000,
    deliveryDays: { min: 1, max: 3 },
  }}
  returnPolicy={{
    days: 14,
    type: 'full', // or 'exchange'
  }}
/>
```

### Schema.org Properties Added

| Property | Description |
|----------|-------------|
| `warranty` | WarrantyPromise with duration |
| `shippingDetails` | OfferShippingDetails with delivery time |
| `hasMerchantReturnPolicy` | Return policy details |
| `itemCondition` | NewCondition, UsedCondition, RefurbishedCondition |
| `availability` | InStock, OutOfStock, LimitedAvailability |
| `priceValidUntil` | Auto-calculated (30 days from now) |

### Helper Function

```typescript
import { generateExtendedProductJsonLd } from '@/lib/seo-config';

const jsonLd = generateExtendedProductJsonLd({
  name: 'iPhone 15 Pro',
  price: 49999,
  brand: 'Apple',
  // ... other props
  warranty: { durationMonths: 12, type: 'manufacturer' },
  shipping: { freeShippingThreshold: 2000, deliveryDays: { min: 1, max: 3 } },
  returnPolicy: { days: 14, type: 'full' },
});
```

---

## Dynamic OG Images

API endpoint at `app/api/og/route.tsx` generates dynamic Open Graph images.

### Usage

```typescript
const ogImageUrl = `${BASE_URL}/api/og?` + new URLSearchParams({
  type: 'product',
  title: product.name,
  price: String(product.price),
  oldPrice: String(product.compare_price),
  rating: String(product.rating),
  brand: product.brand,
}).toString();
```

### Parameters

| Parameter | Description |
|-----------|-------------|
| `type` | `product`, `category`, or `default` |
| `title` | Main title text |
| `subtitle` | Description text |
| `price` | Current price |
| `oldPrice` | Original price (for discount) |
| `rating` | Product rating |
| `brand` | Brand name |

---

## Pinterest Rich Pins

Pinterest Rich Pins show additional product info directly on pins.

### PinterestMeta Component

```typescript
import { PinterestMeta } from '@/components/ProductJsonLd';

<PinterestMeta
  product={{
    name: 'iPhone 15 Pro',
    price: 49999,
    currency: 'UAH', // optional, defaults to UAH
    availability: 'in stock', // 'in stock' | 'out of stock' | 'preorder'
    brand: 'Apple',
  }}
/>
```

### Generated Meta Tags

```html
<meta property="og:type" content="product" />
<meta property="product:price:amount" content="49999" />
<meta property="product:price:currency" content="UAH" />
<meta property="product:availability" content="in stock" />
<meta property="product:brand" content="Apple" />
```

### Helper Function

```typescript
import { generatePinterestMeta } from '@/lib/seo-config';

const meta = generatePinterestMeta({
  name: 'iPhone 15 Pro',
  price: 49999,
  availability: 'in stock',
});
// Returns object with og:type and product:* properties
```

### Validation

Test your Rich Pins at: https://developers.pinterest.com/tools/url-debugger/

---

## Web Vitals Tracking

Core Web Vitals are tracked using `lib/web-vitals.ts` and `components/WebVitalsTracker.tsx`.

### Tracked Metrics

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | ≤2.5s | 2.5s-4s | >4s |
| FID | ≤100ms | 100ms-300ms | >300ms |
| CLS | ≤0.1 | 0.1-0.25 | >0.25 |
| FCP | ≤1.8s | 1.8s-3s | >3s |
| TTFB | ≤800ms | 800ms-1.8s | >1.8s |
| INP | ≤200ms | 200ms-500ms | >500ms |

### Configuration

Set `NEXT_PUBLIC_ANALYTICS_ENDPOINT` environment variable to send metrics to your analytics server.

---

## Sitemap & Robots.txt

### Sitemap (`app/sitemap.ts`)

Generates dynamic sitemap with:
- Static pages (home, faq, about, contact, etc.)
- Category pages (all categories)
- Product pages (fetched from API)

**Excluded pages:**
- `/cart`
- `/checkout`
- `/wishlist`
- `/compare`
- User account pages

### Robots.txt (`app/robots.ts`)

Extended robots.txt with user-agent specific rules:

#### Default Rules (All Bots)

**Allowed:** `/`

**Disallowed:**
- `/admin/`, `/api/`, `/auth/`
- `/checkout/`, `/cart/`, `/profile/`
- `/wishlist/`, `/compare/`, `/orders/`
- `/_next/`, `/static/`
- Query params: `*?*session`, `*?*token`, `*?*sort=*&`, `*?*filter=*`

#### Googlebot

**Allowed:** `/`, `/category/`, `/product/`, `/search`, `/faq`, `/about`, `/contact`, `/delivery`, `/warranty`, `/returns`, `/*.js`, `/*.css`

#### Googlebot-Image

**Allowed:** `/products/`, `/images/`, `/icons/`

#### Blocked Bots

The following aggressive SEO crawler bots are completely blocked:
- `AhrefsBot`
- `SemrushBot`
- `MJ12bot`

#### Google Ads Bot

**Allowed:** `/product/`, `/category/`

**Disallowed:** `/admin/`, `/api/`, `/auth/`

---

## Image Optimization

### Priority Loading for LCP

Product cards use the `priority` prop for above-the-fold images to improve LCP:

```typescript
<ProductCard
  product={product}
  priority={index < 8} // First 8 products get priority loading
/>
```

In `ProductCard.tsx`:

```typescript
<Image
  src={product.image_url}
  alt={`${product.name} - купити в TechShop за ${price} грн`}
  fill
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
  priority={priority}
  loading={priority ? undefined : 'lazy'}
/>
```

### SEO-Optimized Alt Attributes

Alt text now includes:
- Product name
- Call-to-action ("купити в TechShop")
- Price in Ukrainian format

**Before:**
```html
<img alt="iPhone 15 Pro Max" />
```

**After:**
```html
<img alt="iPhone 15 Pro Max - купити в TechShop за 54 999 грн" />
```

**Benefits:**
- Better image search rankings
- Improved accessibility for screen readers
- Keywords in alt text for SEO

---

## Font Optimization

Fonts are optimized for performance and Ukrainian language support.

### Configuration (`app/layout.tsx`)

```typescript
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"], // Includes extended Latin for special characters
  display: "swap",                  // Prevents FOIT (Flash of Invisible Text)
  preload: true,                    // Preloads main font
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,                   // Mono font not preloaded (less critical)
});
```

### Best Practices Applied

| Optimization | Description |
|--------------|-------------|
| `display: swap` | Shows fallback font immediately, swaps when loaded |
| `preload: true` | Adds `<link rel="preload">` for critical fonts |
| `subsets` | Only loads required character sets |
| `latin-ext` | Supports Ukrainian special characters in product names |

### DNS Prefetch & Preconnect

```html
<link rel="dns-prefetch" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
```

---

## Accessibility

### ARIA Labels

All icon buttons in the header have descriptive aria-labels:

```typescript
<button aria-label="Відкрити меню" aria-expanded={isMenuOpen}>
  <Bars3Icon aria-hidden="true" />
</button>
```

### Skip to Content Link

```html
<a href="#main-content" className="sr-only focus:not-sr-only">
  Перейти до основного вмісту
</a>
```

### Semantic HTML

- Proper heading hierarchy (h1, h2, h3)
- Navigation landmarks with `<nav aria-label="...">`
- Main content landmark with `<main id="main-content">`

---

## Security Headers

Configured in `next.config.ts`:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | nosniff |
| `X-Frame-Options` | DENY |
| `X-XSS-Protection` | 1; mode=block |
| `Referrer-Policy` | strict-origin-when-cross-origin |
| `Strict-Transport-Security` | max-age=31536000; includeSubDomains; preload |
| `Permissions-Policy` | camera=(), microphone=(), geolocation=(self), payment=(self) |

---

## PWA & Offline Support

Service Worker (`public/sw.js`) implements:

### Caching Strategies

| Request Type | Strategy |
|--------------|----------|
| API requests | Network first, fallback to cache |
| Images | Cache first, then network |
| Static assets | Stale-while-revalidate |

### Cache Limits

- Dynamic cache: 100 items max
- Image cache: 50 items max
- Auto-cleanup of old cache versions

### Offline Fallback

Navigation requests that fail show `/offline` page.

---

## Automated Tests

SEO functionality is covered by automated tests in `__tests__/lib/seo-config.test.ts`.

### Running Tests

```bash
# Run all SEO tests
npm test -- --testPathPatterns="seo-config"

# Run all SEO-related tests
npm test -- --testPathPatterns="seo"
```

### Test Coverage

| Test Suite | Coverage |
|------------|----------|
| `siteConfig` | Basic configuration properties |
| `generateMetadata` | Metadata generation with options |
| `generateProductMetadata` | Product-specific metadata |
| `generateProductJsonLd` | Product JSON-LD schema |
| `generateCategoryJsonLd` | Category page schema |
| `generateOrganizationJsonLd` | Organization schema |
| `generateBreadcrumbJsonLd` | Breadcrumb schema |
| `generateFAQJsonLd` | FAQ page schema |
| `generateWebsiteJsonLd` | Website schema with search action |
| `generateHreflangAlternates` | Hreflang URL generation |
| `generatePaginationMeta` | Pagination rel links |
| `generateVideoObjectJsonLd` | Video schema |
| `generateHowToJsonLd` | HowTo schema |
| `generateAggregateOfferJsonLd` | AggregateOffer schema |
| `generateExtendedProductJsonLd` | Extended product with warranty/shipping |
| `generatePinterestMeta` | Pinterest Rich Pins |
| `generateSearchMetadata` | Dynamic search metadata |

### Example Test Output

```
Test Suites: 1 passed, 1 total
Tests:       63 passed, 63 total
Time:        1.252 s
```

---

## Manual Testing Checklist

### Metadata Verification

- [ ] Check product page title contains product name and price
- [ ] Verify meta description is unique per page
- [ ] Confirm canonical URLs are correct
- [ ] Test hreflang tags with Google's hreflang testing tool
- [ ] Verify search page metadata changes with query

### Hreflang & Pagination

- [ ] Check hreflang tags on category pages (uk-UA, en-US, x-default)
- [ ] Verify pagination rel="prev" and rel="next" links
- [ ] Confirm first page doesn't have ?page=1 parameter
- [ ] Test deep pagination (page > 5) is not indexed

### Structured Data Validation

- [ ] Test Product schema at https://search.google.com/test/rich-results
- [ ] Test ExtendedProduct schema (warranty, shipping, returns)
- [ ] Test FAQPage schema
- [ ] Test BreadcrumbList schema
- [ ] Test VideoObject schema (if video exists)
- [ ] Test HowTo schema (if guide exists)
- [ ] Verify all schemas pass validation

### Open Graph Testing

- [ ] Test OG tags with Facebook Sharing Debugger
- [ ] Verify OG images are 1200x630px
- [ ] Test Twitter Card Validator

### Pinterest Rich Pins

- [ ] Verify product:price:amount meta tag
- [ ] Verify product:price:currency meta tag (UAH)
- [ ] Verify product:availability meta tag
- [ ] Test with Pinterest URL Debugger

### Performance Testing

- [ ] Run Lighthouse audit (target score 90+)
- [ ] Check Core Web Vitals in Chrome DevTools
- [ ] Test LCP with different network speeds
- [ ] Verify no layout shifts (CLS)
- [ ] Verify font display: swap is working

### Robots.txt Verification

- [ ] Check Googlebot can access /category/ and /product/
- [ ] Verify AhrefsBot is blocked
- [ ] Confirm /admin/ and /api/ are disallowed
- [ ] Test with Google Search Console robots.txt tester

### Security Headers Testing

- [ ] Check headers at securityheaders.com
- [ ] Verify HSTS is active
- [ ] Test X-Frame-Options blocks embedding

### PWA Testing

- [ ] Install PWA on mobile device
- [ ] Test offline functionality
- [ ] Verify cached pages load correctly
- [ ] Test push notifications (if enabled)

### Accessibility Testing

- [ ] Run axe DevTools audit
- [ ] Test keyboard navigation
- [ ] Verify screen reader compatibility
- [ ] Check color contrast ratios

---

## Tools & Resources

- [Google Search Console](https://search.google.com/search-console)
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [Security Headers](https://securityheaders.com/)
- [axe DevTools](https://www.deque.com/axe/)
