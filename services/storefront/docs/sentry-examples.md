# Sentry Integration Examples

This document provides practical examples of using the Sentry integration in various scenarios.

## Table of Contents

- [Basic Setup](#basic-setup)
- [Error Tracking Examples](#error-tracking-examples)
- [Error Boundary Examples](#error-boundary-examples)
- [Performance Monitoring Examples](#performance-monitoring-examples)
- [User Context Examples](#user-context-examples)
- [Real-World Scenarios](#real-world-scenarios)

## Basic Setup

### App Initialization

In your root layout or app initialization:

```tsx
// app/layout.tsx
'use client';

import { useEffect } from 'react';
import { initSentry, setUserContext } from '@/lib/monitoring/sentry';
import { enableSentryTransport } from '@/lib/logger';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize Sentry on client-side
    initSentry();

    // Enable Sentry transport for logger
    enableSentryTransport();
  }, []);

  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

## Error Tracking Examples

### Example 1: API Error Handling

```tsx
// lib/api/products.ts
import { captureError, addBreadcrumb } from '@/lib/monitoring/sentry';

export async function fetchProducts() {
  addBreadcrumb('api', 'Fetching products', { endpoint: '/api/products' });

  try {
    const response = await fetch('/api/products');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    captureError(error as Error, {
      endpoint: '/api/products',
      method: 'GET',
      timestamp: new Date().toISOString(),
    });

    throw error;
  }
}
```

### Example 2: Payment Processing

```tsx
// lib/payment/process.ts
import { captureError, setBusinessContext } from '@/lib/monitoring/sentry';
import { logger } from '@/lib/logger';

export async function processPayment(orderId: string, amount: number) {
  // Set business context
  setBusinessContext({
    orderId,
    amount,
    currency: 'USD',
  });

  try {
    const result = await paymentProvider.charge({
      orderId,
      amount,
    });

    logger.info('Payment processed successfully', { orderId, amount });
    return result;
  } catch (error) {
    // Log error (will be sent to Sentry via logger transport)
    logger.error('Payment processing failed', error, {
      orderId,
      amount,
      provider: 'stripe',
    });

    // Also capture directly with additional context
    captureError(error as Error, {
      orderId,
      amount,
      provider: 'stripe',
      errorType: 'payment_failed',
    });

    throw error;
  }
}
```

### Example 3: Form Submission

```tsx
// components/ContactForm.tsx
import { captureError, addBreadcrumb } from '@/lib/monitoring/sentry';

export function ContactForm() {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    addBreadcrumb('user_action', 'Contact form submitted');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Form submission failed');
      }

      // Success
    } catch (error) {
      captureError(error as Error, {
        form: 'contact',
        formData: {
          // Only include non-sensitive data
          hasEmail: !!formData.email,
          hasMessage: !!formData.message,
        },
      });

      // Show error to user
    }
  };

  return <form onSubmit={handleSubmit}>{/* ... */}</form>;
}
```

## Error Boundary Examples

### Example 1: Page-Level Error Boundary

```tsx
// app/checkout/page.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

function CheckoutErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="error-container">
      <h1>Checkout Error</h1>
      <p>We encountered an error processing your checkout.</p>
      <button onClick={reset}>Try Again</button>
      <a href="/cart">Return to Cart</a>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <ErrorBoundary
      fallback={(error, reset) => <CheckoutErrorFallback error={error} reset={reset} />}
      tags={{ page: 'checkout', critical: 'true' }}
      beforeCapture={(scope, error) => {
        scope.setLevel('fatal');
        scope.setTag('checkout_step', getCurrentCheckoutStep());
      }}
    >
      <CheckoutFlow />
    </ErrorBoundary>
  );
}
```

### Example 2: Component-Level Error Boundary with HOC

```tsx
// components/ProductCard.tsx
import { withErrorBoundary } from '@/components/ErrorBoundary';

function ProductCard({ product }: { product: Product }) {
  // Component might throw if product data is malformed
  const price = calculatePrice(product);

  return (
    <div className="product-card">
      <img src={product.image} alt={product.name} />
      <h3>{product.name}</h3>
      <p>${price}</p>
    </div>
  );
}

// Wrap with error boundary
export default withErrorBoundary(ProductCard, {
  fallback: (
    <div className="product-card-error">
      <p>Unable to display this product</p>
    </div>
  ),
  tags: { component: 'ProductCard' },
});
```

### Example 3: Using Error Handler Hook

```tsx
// components/AsyncDataLoader.tsx
import { useErrorHandler } from '@/components/ErrorBoundary';
import { useEffect, useState } from 'react';

export function AsyncDataLoader() {
  const [data, setData] = useState(null);
  const throwError = useErrorHandler();

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/api/data');
        const json = await response.json();
        setData(json);
      } catch (error) {
        // This will trigger the nearest error boundary
        throwError(error as Error);
      }
    }

    loadData();
  }, [throwError]);

  return data ? <div>{JSON.stringify(data)}</div> : <div>Loading...</div>;
}
```

## Performance Monitoring Examples

### Example 1: Tracking Page Load Performance

```tsx
// app/products/page.tsx
import { measurePerformance } from '@/lib/monitoring/sentry';
import { useEffect } from 'react';

export default function ProductsPage() {
  useEffect(() => {
    measurePerformance(
      {
        name: 'products-page-load',
        op: 'page.load',
        description: 'Products page initial load',
      },
      async () => {
        await fetchProducts();
        await fetchCategories();
      }
    );
  }, []);

  return <div>{/* ... */}</div>;
}
```

### Example 2: API Call Performance Tracking

```tsx
// lib/api/client.ts
import { trackApiCall } from '@/lib/monitoring/sentry';

export async function apiRequest<T>(
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<T> {
  return trackApiCall(endpoint, method, async () => {
    const response = await fetch(endpoint, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  });
}
```

### Example 3: Database Query Performance

```tsx
// lib/db/users.ts
import { trackDatabaseQuery } from '@/lib/monitoring/sentry';
import { prisma } from '@/lib/db';

export async function getUserById(userId: string) {
  return trackDatabaseQuery('select', 'users', async () => {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
  });
}

export async function createUser(data: CreateUserInput) {
  return trackDatabaseQuery('insert', 'users', async () => {
    return prisma.user.create({
      data,
    });
  });
}
```

### Example 4: Custom Performance Measurement

```tsx
// lib/search/index.ts
import { startPerformanceTransaction } from '@/lib/monitoring/sentry';

export async function performSearch(query: string) {
  const span = startPerformanceTransaction({
    name: 'search-operation',
    op: 'search',
    description: 'Full-text search',
    data: { queryLength: query.length },
  });

  try {
    // Phase 1: Parse query
    const parsedQuery = parseSearchQuery(query);
    span?.setAttribute('parsed', true);

    // Phase 2: Execute search
    const results = await executeSearch(parsedQuery);
    span?.setAttribute('resultCount', results.length);

    // Phase 3: Rank results
    const rankedResults = rankResults(results);

    span?.setStatus({ code: 1, message: 'ok' });
    return rankedResults;
  } catch (error) {
    span?.setStatus({ code: 2, message: 'error' });
    throw error;
  } finally {
    span?.end();
  }
}
```

## User Context Examples

### Example 1: Authentication Integration

```tsx
// components/AuthProvider.tsx
import { setUserContext } from '@/lib/monitoring/sentry';
import { useEffect } from 'react';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      setUserContext({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscription: user.subscription?.plan,
        accountAge: calculateAccountAge(user.createdAt),
      });
    } else {
      setUserContext(null);
    }
  }, [user, isAuthenticated]);

  return <>{children}</>;
}
```

### Example 2: Feature Flag Tracking

```tsx
// lib/experiments/tracker.ts
import { setFeatureFlags } from '@/lib/monitoring/sentry';

export function trackActiveExperiments(user: User) {
  const flags = {
    newCheckout: isInExperiment(user, 'new-checkout'),
    betaSearch: isInExperiment(user, 'beta-search'),
    premiumFeatures: user.subscription === 'premium',
    darkMode: user.preferences?.theme === 'dark',
  };

  setFeatureFlags(flags);
}
```

## Real-World Scenarios

### Scenario 1: E-commerce Checkout Flow

```tsx
// app/checkout/CheckoutFlow.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  setBusinessContext,
  addBreadcrumb,
  measurePerformance,
} from '@/lib/monitoring/sentry';

export function CheckoutFlow() {
  const [step, setStep] = useState(1);
  const { cart } = useCart();

  useEffect(() => {
    // Set business context for the entire checkout
    setBusinessContext({
      cartId: cart.id,
      cartValue: cart.total,
      itemCount: cart.items.length,
      checkoutStep: step,
    });

    // Add breadcrumb for step changes
    addBreadcrumb('checkout', `Checkout step ${step}`, {
      step,
      itemCount: cart.items.length,
    });
  }, [step, cart]);

  const handlePayment = async () => {
    await measurePerformance(
      {
        name: 'checkout-payment',
        op: 'payment.process',
        data: { amount: cart.total },
      },
      async () => {
        try {
          const result = await processPayment(cart);
          setStep(4); // Success
          return result;
        } catch (error) {
          // Error will be automatically captured by measurePerformance
          throw error;
        }
      }
    );
  };

  return (
    <ErrorBoundary
      tags={{
        feature: 'checkout',
        step: step.toString(),
      }}
      fallback={(error, reset) => (
        <CheckoutError
          error={error}
          step={step}
          onRetry={reset}
          onCancel={() => router.push('/cart')}
        />
      )}
    >
      {step === 1 && <ShippingInfo onNext={() => setStep(2)} />}
      {step === 2 && <PaymentInfo onNext={handlePayment} />}
      {step === 3 && <OrderReview onConfirm={() => setStep(4)} />}
      {step === 4 && <OrderConfirmation />}
    </ErrorBoundary>
  );
}
```

### Scenario 2: File Upload with Progress

```tsx
// components/FileUpload.tsx
import { captureError, addBreadcrumb, measurePerformance } from '@/lib/monitoring/sentry';

export function FileUpload() {
  const handleUpload = async (file: File) => {
    addBreadcrumb('upload', 'File upload started', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    try {
      await measurePerformance(
        {
          name: 'file-upload',
          op: 'upload',
          data: {
            size: file.size,
            type: file.type,
          },
        },
        async () => {
          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('Upload failed');
          }

          const result = await response.json();

          addBreadcrumb('upload', 'File upload completed', {
            fileId: result.id,
          });

          return result;
        }
      );
    } catch (error) {
      captureError(error as Error, {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        operation: 'file_upload',
      });

      throw error;
    }
  };

  return <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />;
}
```

### Scenario 3: Server-Side API Route

```tsx
// app/api/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { captureServerError, trackServerPerformance } from '@/lib/monitoring/sentry-server';

export async function GET(request: NextRequest) {
  try {
    const result = await trackServerPerformance('api-get-products', async () => {
      const products = await prisma.product.findMany({
        where: { active: true },
        include: { category: true },
      });

      return products;
    });

    return NextResponse.json(result);
  } catch (error) {
    captureServerError(error as Error, {
      route: '/api/products',
      method: 'GET',
      requestId: request.headers.get('x-request-id') || undefined,
    });

    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
```

### Scenario 4: WebSocket Error Handling

```tsx
// lib/websocket/client.ts
import { captureError, addBreadcrumb } from '@/lib/monitoring/sentry';

export class WebSocketClient {
  private ws: WebSocket | null = null;

  connect(url: string) {
    addBreadcrumb('websocket', 'Connecting to WebSocket', { url });

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      addBreadcrumb('websocket', 'WebSocket connected', { url });
    };

    this.ws.onerror = (event) => {
      captureError(new Error('WebSocket error'), {
        url,
        readyState: this.ws?.readyState,
        eventType: 'error',
      });
    };

    this.ws.onclose = (event) => {
      addBreadcrumb('websocket', 'WebSocket closed', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });

      if (!event.wasClean) {
        captureError(new Error('WebSocket closed unexpectedly'), {
          code: event.code,
          reason: event.reason,
        });
      }
    };
  }
}
```

## Summary

These examples demonstrate various ways to integrate Sentry into your Next.js application. Key takeaways:

1. **Always provide context** when capturing errors
2. **Use error boundaries** at appropriate component boundaries
3. **Track performance** for critical operations
4. **Set user context** early in the app lifecycle
5. **Add breadcrumbs** for important user actions
6. **Filter sensitive data** before sending to Sentry
7. **Use appropriate tags** for easier error filtering
8. **Leverage the logger integration** for automatic error reporting

For more information, see the [Sentry Integration Documentation](./sentry-integration.md).
