# Internationalization (i18n) System

Complete internationalization system for the TechShop storefront, supporting multiple languages with locale-aware routing, translations, and formatting.

## Supported Languages

- **Ukrainian (uk)** - Default language
- **English (en)**
- **Polish (pl)**
- **German (de)**

## Architecture

The i18n system consists of several key components:

### Core Files

1. **i18n.ts** - Core i18n functionality (translation, formatting, pluralization)
2. **i18n-config.ts** - Centralized configuration for locales, cookies, URL strategy
3. **i18n-context.tsx** - React context and hooks for client components
4. **I18nProvider.tsx** - Context provider component
5. **server.ts** - Server-side i18n utilities for Server Components and API routes
6. **translations/** - Translation files for each locale

### Components

- **LanguageSwitcher.tsx** - UI component for changing languages

## Usage

### Client Components

Use hooks from `i18n-context.tsx` for client-side internationalization:

```tsx
import { useTranslation, useI18n, useLocale } from '@/lib/i18n';

function MyComponent() {
    // Basic translation
    const { t, locale } = useTranslation();

    // Full i18n context
    const { t, formatCurrency, formatDate, locale, setLocale } = useI18n();

    // Just locale management
    const { locale, setLocale, config } = useLocale();

    return (
        <div>
            <h1>{t('common.hello')}</h1>
            <p>{t('product.price')}: {formatCurrency(99.99)}</p>
            <p>{t('cart.itemsCount', { count: 5 })}</p>
        </div>
    );
}
```

### Server Components

Use utilities from `server.ts` for server-side rendering:

```tsx
import { getServerTranslator, getServerLocale } from '@/lib/i18n/server';

export default async function ServerComponent() {
    const { t, formatCurrency, locale } = await getServerTranslator();

    return (
        <div>
            <h1>{t('common.welcome')}</h1>
            <p>{formatCurrency(99.99)}</p>
        </div>
    );
}
```

### API Routes

```typescript
import { getServerLocale, getTranslations } from '@/lib/i18n/server';

export async function GET(request: Request) {
    const locale = await getServerLocale();
    const t = getTranslations(locale);

    return Response.json({
        message: t('api.success'),
    });
}
```

### Server Actions

```typescript
'use server';

import { setLocaleCookie } from '@/lib/i18n/server';

export async function changeLanguage(locale: Locale) {
    await setLocaleCookie(locale);
    // Locale is now persisted in cookies
}
```

## Translation Keys

Translations are organized into categories:

- **common** - Common UI elements (buttons, labels, etc.)
- **navigation** - Navigation menu items
- **product** - Product-related translations
- **cart** - Shopping cart
- **checkout** - Checkout process
- **payment** - Payment methods
- **delivery** - Delivery options
- **order** - Order management
- **auth** - Authentication
- **account** - User account
- **loyalty** - Loyalty program
- **giftCard** - Gift cards
- **promo** - Promo codes
- **reviews** - Product reviews
- **search** - Search functionality
- **filters** - Filters and sorting
- **footer** - Footer links
- **errors** - Error messages
- **meta** - SEO metadata

### Translation Examples

```typescript
// Simple translation
t('common.loading') // "Loading..."

// Nested keys
t('product.addToCart') // "Add to Cart"

// With parameters
t('cart.itemsCount', { count: 5 }) // "5 items"
t('errors.minLength', { count: 8 }) // "Minimum 8 characters"
```

## Formatting

### Numbers

```typescript
import { useNumberFormat } from '@/lib/i18n';

const { formatNumber } = useNumberFormat();

formatNumber(1234.56) // "1,234.56" (en) or "1 234,56" (uk)
```

### Currency

```typescript
import { useCurrencyFormat } from '@/lib/i18n';

const { formatCurrency } = useCurrencyFormat();

formatCurrency(99.99) // "$99.99" (en) or "99,99 ₴" (uk)
formatCurrency(99.99, 'EUR') // "€99.99"
```

### Dates

```typescript
import { useDateFormat } from '@/lib/i18n';

const { formatDate, formatRelativeTime } = useDateFormat();

formatDate(new Date()) // "January 15, 2025" (en) or "15 січня 2025" (uk)
formatRelativeTime(new Date()) // "2 hours ago"
```

### Pluralization

```typescript
import { usePluralization } from '@/lib/i18n';

const { pluralize } = usePluralization();

pluralize(0, {
    zero: 'no items',
    one: '{{count}} item',
    other: '{{count}} items'
}) // "no items"

pluralize(1, {
    zero: 'no items',
    one: '{{count}} item',
    other: '{{count}} items'
}) // "1 item"
```

## Language Switcher

The `LanguageSwitcher` component provides UI for changing languages:

```tsx
import LanguageSwitcher from '@/components/LanguageSwitcher';

// Dropdown variant (default)
<LanguageSwitcher />

// Compact variant (icon + flag)
<LanguageSwitcher variant="compact" />

// Button group variant
<LanguageSwitcher variant="buttons" showFlag showName />
```

## Locale Routing

The middleware automatically handles locale routing:

### URL Structure

- **Default locale (uk)**: `/products`, `/cart`
- **Other locales**: `/en/products`, `/de/cart`

This is configured via `urlStrategy` in `i18n-config.ts`:
- `'as-needed'` (default) - Only non-default locales in URL
- `'always'` - All locales in URL

### Locale Detection Priority

1. **URL path** - `/en/products` → English
2. **Cookie** - `NEXT_LOCALE` cookie
3. **Accept-Language header** - Browser preference
4. **Default locale** - Ukrainian (fallback)

## Adding a New Language

1. **Update locale type** in `lib/i18n/i18n.ts`:
```typescript
export type Locale = 'uk' | 'en' | 'pl' | 'de' | 'fr';
```

2. **Add locale config** in `lib/i18n/i18n.ts`:
```typescript
fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    dir: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    currency: {
        code: 'EUR',
        symbol: '€',
        position: 'before',
    },
}
```

3. **Create translation file** `lib/i18n/translations/fr.ts`:
```typescript
import { TranslationKeys } from './uk';

export const fr: TranslationKeys = {
    common: {
        loading: 'Chargement...',
        // ... all other keys
    },
    // ... all other categories
};
```

4. **Update translations index** `lib/i18n/translations/index.ts`:
```typescript
import { fr } from './fr';

export const translations: Record<Locale, TranslationDict> = {
    uk, en, pl, de, fr,
};
```

5. **Add plural rules** in `lib/i18n/i18n.ts`:
```typescript
fr: (n: number): PluralForm => {
    if (n === 0) return 'zero';
    if (n === 1) return 'one';
    return 'other';
}
```

6. **Add metadata** in `lib/i18n/i18n-config.ts`:
```typescript
fr: {
    title: 'TechShop - Boutique en ligne',
    description: '...',
    keywords: ['...'],
    ogLocale: 'fr_FR',
}
```

## Configuration

Edit `lib/i18n/i18n-config.ts` to customize:

```typescript
export const i18nConfig = {
    // Default locale
    defaultLocale: 'uk',

    // Cookie settings
    localeCookieName: 'NEXT_LOCALE',
    cookieOptions: {
        maxAge: 365 * 24 * 60 * 60, // 1 year
        path: '/',
        sameSite: 'lax' as const,
    },

    // URL strategy
    urlStrategy: 'as-needed', // or 'always'

    // Paths to exclude from locale routing
    excludePaths: ['/api', '/_next', '/static'],
};
```

## Testing

Run the i18n tests:

```bash
npm test __tests__/lib/i18n.test.ts
```

Tests cover:
- Translation function
- Number/currency/date formatting
- Pluralization rules
- Locale detection
- Path utilities
- Translation completeness

## SEO Considerations

The system automatically generates:
- Locale-specific metadata (title, description)
- OpenGraph locale tags
- Alternate language links (hreflang)

Use `getLocaleMetadata()` in your layout:

```tsx
import { getLocaleMetadata } from '@/lib/i18n/server';

export async function generateMetadata({ params }) {
    const locale = params.locale || 'uk';
    const metadata = getLocaleMetadata(locale);

    return {
        title: metadata.title,
        description: metadata.description,
        // ...
    };
}
```

## Best Practices

1. **Always use translation keys** - Never hardcode text in components
2. **Use semantic keys** - `product.addToCart` not `button.add`
3. **Provide context in keys** - `auth.login` vs `navigation.login`
4. **Include all parameters** - Document required parameters in comments
5. **Test all locales** - Ensure translations are complete
6. **Use proper formatting** - Don't concatenate formatted values
7. **Avoid layout shifts** - Reserve space for longest translations

## Troubleshooting

### Missing translations warning

If you see "Translation missing: key.name" in console:
1. Check if the key exists in all locale files
2. Verify the key path is correct (use dot notation)
3. Ensure fallback locale has the key

### Locale not persisting

Check:
1. Cookies are enabled in browser
2. Cookie domain is correct
3. Middleware is running (check matcher config)

### Wrong locale detected

Verify detection order in middleware:
1. URL path takes precedence
2. Then cookie
3. Then Accept-Language header
4. Finally default locale

## Migration Guide

If migrating from an existing i18n solution:

1. Map your existing locale codes to the new format
2. Convert translation files to the new structure
3. Replace translation hooks with new hooks
4. Update components to use new LanguageSwitcher
5. Test all locale-specific formatting
6. Verify SEO metadata is correct

## Performance

- Translations are loaded synchronously (no lazy loading)
- Minimal runtime overhead
- Server Components use server-side translation (no JS sent to client)
- Cookie-based locale persistence (no localStorage on first render)
