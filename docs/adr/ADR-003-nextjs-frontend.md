# ADR-003: Next.js для фронтенду

## Status

Accepted

## Date

2024-01-15

## Context

Потрібно було обрати фреймворк для фронтенду з урахуванням:

- SEO вимог для публічного магазину
- Продуктивності та швидкості завантаження
- Developer experience
- Екосистеми компонентів

**Альтернативи:**

1. **Next.js** - React з SSR/SSG, App Router
2. **Nuxt.js** - Vue.js з SSR
3. **Remix** - React з nested routing
4. **SvelteKit** - Svelte з SSR
5. **Astro** - Static-first з islands

## Decision

Обрано **Next.js 16** з App Router для фронтенду.

### Обґрунтування

**SEO:**
- Server-Side Rendering (SSR) для динамічних сторінок
- Static Site Generation (SSG) для статичних сторінок
- Automatic metadata та structured data

**Performance:**
- Image optimization з next/image
- Font optimization
- Automatic code splitting
- Streaming SSR

**Developer Experience:**
- Файлова система для routing
- Вбудований TypeScript support
- Hot Module Replacement
- Turbopack для швидкої розробки

**Ecosystem:**
- Найбільша React екосистема
- Vercel platform integration
- Багато ready-to-use компонентів

### Tech Stack

| Компонент | Бібліотека |
|-----------|------------|
| Framework | Next.js 16 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS |
| UI Components | Radix UI / shadcn/ui |
| State Management | Zustand |
| Data Fetching | TanStack Query |
| Forms | React Hook Form + Zod |
| Testing | Jest + React Testing Library |

### Rendering Strategy

| Сторінка | Стратегія | Причина |
|----------|-----------|---------|
| Homepage | SSG + ISR | Рідко змінюється |
| Product Page | SSR | Динамічні дані (ціна, наявність) |
| Category | SSR + Cache | Фільтри, сортування |
| Cart | CSR | Персональні дані |
| Checkout | CSR | Форми, валідація |
| Static Pages | SSG | Статичний контент |

## Consequences

### Позитивні

- ✅ **SEO**: відмінна індексація пошуковими системами
- ✅ **Performance**: швидке завантаження, Core Web Vitals
- ✅ **DX**: швидка розробка, хороший tooling
- ✅ **Flexibility**: різні rendering strategies
- ✅ **Ecosystem**: величезна кількість бібліотек

### Негативні

- ❌ **Complexity**: App Router має learning curve
- ❌ **Server costs**: SSR вимагає серверних ресурсів
- ❌ **Hydration issues**: можливі проблеми з клієнт/сервер
- ❌ **Vendor lock-in**: деякі оптимізації працюють тільки на Vercel

### Best Practices

```tsx
// Server Component (default)
async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id);
  return <ProductDetails product={product} />;
}

// Client Component
'use client';
function AddToCartButton({ productId }: { productId: string }) {
  const { addItem } = useCart();
  return <button onClick={() => addItem(productId)}>Add to Cart</button>;
}

// Data fetching with caching
async function getProduct(id: string) {
  const res = await fetch(`${API_URL}/products/${id}`, {
    next: { revalidate: 60 } // Cache for 60 seconds
  });
  return res.json();
}

// Metadata
export async function generateMetadata({ params }): Promise<Metadata> {
  const product = await getProduct(params.id);
  return {
    title: product.name,
    description: product.description,
    openGraph: {
      images: [product.image],
    },
  };
}
```

## Related Decisions

- [ADR-001: Мікросервісна архітектура](./ADR-001-microservices.md)
