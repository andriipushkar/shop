# Sentry Error Monitoring Integration

This document provides comprehensive documentation for the Sentry error monitoring integration in the Next.js storefront application.

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Best Practices](#best-practices)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Overview

The Sentry integration provides:

- **Error Tracking**: Automatic capture and reporting of JavaScript errors
- **Performance Monitoring**: Track application performance and slow operations
- **User Context**: Associate errors with user information
- **Breadcrumbs**: Track user actions leading to errors
- **Session Replay**: Replay user sessions to understand error context
- **Error Boundaries**: React error boundaries with Sentry integration
- **Logger Integration**: Send logs to Sentry automatically

## Setup

### 1. Environment Variables

Create or update your `.env.local` file with the following variables:

```bash
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_AUTH_TOKEN=your-auth-token
SENTRY_ORG=your-organization
SENTRY_PROJECT=your-project

# Optional: For release tracking
NEXT_PUBLIC_VERSION=1.0.0
```

### 2. Package Installation

The `@sentry/nextjs` package should already be installed. If not:

```bash
npm install @sentry/nextjs
```

### 3. Initialization

The Sentry client is automatically initialized through:

- **Client-side**: `sentry.client.config.ts`
- **Server-side**: `sentry.server.config.ts`
- **Edge runtime**: `sentry.edge.config.ts`
- **Instrumentation**: `instrumentation.ts` (Next.js 13+ feature)

## Configuration

### Client-Side Configuration

Located in `/lib/monitoring/sentry.ts`:

```typescript
import { initSentry } from '@/lib/monitoring/sentry';

// Initialize with default config
initSentry();

// Or with custom config
initSentry({
  environment: 'production',
  tracesSampleRate: 0.1,
  debug: false,
});
```

### Server-Side Configuration

The server-side configuration is automatically loaded via `instrumentation.ts`.

### Environment-Specific Settings

Different sample rates for different environments:

- **Development**: 100% of transactions tracked
- **Production**: 10% of transactions tracked
- **Test**: No events sent to Sentry

## Usage

### Basic Error Tracking

```typescript
import { captureError, captureMessage } from '@/lib/monitoring/sentry';

try {
  await riskyOperation();
} catch (error) {
  captureError(error as Error, {
    userId: user.id,
    operation: 'checkout',
  });
}

// Capture informational messages
captureMessage('User completed checkout', 'info');
```

### Error Boundary Component

Wrap components with error boundaries to catch React errors:

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary
      fallback={<div>Something went wrong</div>}
      onError={(error) => console.log('Error caught:', error)}
    >
      <YourApp />
    </ErrorBoundary>
  );
}
```

Or use the HOC:

```tsx
import { withErrorBoundary } from '@/components/ErrorBoundary';

const SafeComponent = withErrorBoundary(MyComponent, {
  fallback: <ErrorFallback />,
});
```

### User Context

Set user context to associate errors with users:

```typescript
import { setUserContext } from '@/lib/monitoring/sentry';

// Basic user info
setUserContext({
  id: '123',
  email: 'user@example.com',
  name: 'John Doe',
});

// Extended user info with metadata
setUserContext({
  id: '123',
  email: 'user@example.com',
  name: 'John Doe',
  role: 'admin',
  subscription: 'premium',
  customField: 'value',
});

// Clear user context on logout
setUserContext(null);
```

### Business Context

Track business-specific context:

```typescript
import { setBusinessContext } from '@/lib/monitoring/sentry';

setBusinessContext({
  cartId: 'cart-123',
  orderId: 'order-456',
  customerId: 'customer-789',
});
```

### Performance Monitoring

Track performance of operations:

```typescript
import { measurePerformance, trackApiCall, trackDatabaseQuery } from '@/lib/monitoring/sentry';

// Generic performance tracking
const result = await measurePerformance(
  {
    name: 'checkout-process',
    op: 'function',
    description: 'Complete checkout process',
  },
  async () => {
    // Your code here
    return await processCheckout();
  }
);

// Track API calls
const data = await trackApiCall('/api/users', 'GET', async () => {
  return await fetch('/api/users');
});

// Track database queries
const users = await trackDatabaseQuery('select', 'users', async () => {
  return await prisma.user.findMany();
});
```

### Breadcrumbs

Add breadcrumbs to track user actions:

```typescript
import { addBreadcrumb } from '@/lib/monitoring/sentry';

addBreadcrumb('navigation', 'User navigated to checkout', {
  from: '/cart',
  to: '/checkout',
});

addBreadcrumb('action', 'Button clicked', {
  button: 'submit-payment',
});
```

### Feature Flags

Track feature flag state:

```typescript
import { setFeatureFlags } from '@/lib/monitoring/sentry';

setFeatureFlags({
  newCheckout: true,
  betaFeature: false,
  experimentId: 'exp-123',
});
```

### Logger Integration

Enable Sentry transport for the logger to automatically send error logs:

```typescript
import { enableSentryTransport } from '@/lib/logger';

// Enable Sentry transport
enableSentryTransport();

// Now all error and fatal logs will be sent to Sentry
logger.error('Payment failed', error, { orderId: '123' });
logger.fatal('Critical system error', error);
```

## API Reference

### Core Functions

#### `initSentry(config?: Partial<SentryConfig>)`

Initialize Sentry with optional custom configuration.

```typescript
initSentry({
  dsn: 'https://...',
  environment: 'production',
  tracesSampleRate: 0.1,
  debug: false,
});
```

#### `captureError(error: Error, context?: Record<string, unknown>)`

Capture an error with optional context.

#### `captureMessage(message: string, level?: SeverityLevel)`

Capture a message with severity level.

#### `setUserContext(user: UserContext | null)`

Set or clear user context.

#### `setBusinessContext(context: Record<string, unknown>)`

Set business-specific context.

#### `addBreadcrumb(category: string, message: string, data?: Record<string, unknown>, level?: SeverityLevel)`

Add a breadcrumb for tracking user actions.

### Performance Functions

#### `measurePerformance<T>(options: PerformanceOptions, fn: () => Promise<T> | T): Promise<T>`

Measure performance of a function.

#### `trackApiCall<T>(endpoint: string, method: string, fn: () => Promise<T>): Promise<T>`

Track API call performance.

#### `trackDatabaseQuery<T>(operation: string, table: string, fn: () => Promise<T>): Promise<T>`

Track database query performance.

### Utility Functions

#### `withErrorTracking<T>(fn: T, context?: string): T`

Wrap an async function with error tracking.

#### `isSentryEnabled(): boolean`

Check if Sentry is initialized and ready.

#### `flushEvents(timeout?: number): Promise<boolean>`

Flush events to Sentry immediately.

#### `closeSentry(timeout?: number): Promise<boolean>`

Close Sentry client.

## Best Practices

### 1. Privacy and Security

- Always filter sensitive data (passwords, credit cards, tokens)
- Use `beforeSend` hook to sanitize data
- Never log PII without user consent
- Review Sentry data retention policies

### 2. Performance

- Use appropriate sample rates in production
- Don't track every single operation
- Use breadcrumbs strategically
- Set proper fingerprints for grouping

### 3. Error Handling

```typescript
// Good: Provide context
try {
  await processPayment(orderId);
} catch (error) {
  captureError(error as Error, {
    orderId,
    userId: user.id,
    paymentMethod: 'credit_card',
  });
  throw error;
}

// Bad: No context
try {
  await processPayment(orderId);
} catch (error) {
  captureError(error as Error);
  throw error;
}
```

### 4. User Context

Set user context early in the app lifecycle:

```typescript
// In your auth provider or app initialization
useEffect(() => {
  if (user) {
    setUserContext({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  } else {
    setUserContext(null);
  }
}, [user]);
```

### 5. Error Boundaries

Use error boundaries at strategic points:

```tsx
// App-level error boundary
<ErrorBoundary fallback={<AppErrorPage />}>
  <App />
</ErrorBoundary>

// Feature-level error boundaries
<ErrorBoundary fallback={<CheckoutError />} tags={{ feature: 'checkout' }}>
  <CheckoutFlow />
</ErrorBoundary>
```

## Testing

### Unit Tests

Tests are located in `__tests__/lib/monitoring/sentry.test.ts` and `__tests__/components/ErrorBoundary.test.tsx`.

Run tests:

```bash
npm test sentry
npm test ErrorBoundary
```

### Integration Testing

Mock Sentry in tests:

```typescript
jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  // ... other mocks
}));
```

### Manual Testing

1. Trigger a test error in development
2. Check console for Sentry logs
3. Verify error appears in Sentry dashboard
4. Test error boundaries with various error types

## Troubleshooting

### Errors Not Appearing in Sentry

1. Check DSN is correctly configured
2. Verify `NODE_ENV` is not 'test' or 'development'
3. Check browser console for Sentry errors
4. Verify network requests to Sentry are not blocked

### Too Many Events

1. Reduce sample rates in production
2. Add more items to `ignoreErrors` list
3. Implement proper error fingerprinting
4. Review breadcrumb limits

### Performance Issues

1. Lower `tracesSampleRate`
2. Disable session replay in production
3. Reduce `maxBreadcrumbs`
4. Use selective performance tracking

### Common Errors

#### "Sentry DSN not configured"

Set `NEXT_PUBLIC_SENTRY_DSN` in your environment variables.

#### "beforeSend is not filtering data"

Ensure the `beforeSend` hook is properly configured in `sentry.client.config.ts`.

#### "User context not persisting"

Make sure to call `setUserContext` after authentication.

## Additional Resources

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Best Practices](https://docs.sentry.io/platforms/javascript/best-practices/)
- [Error Boundary Pattern](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Performance Monitoring Guide](https://docs.sentry.io/product/performance/)

## Support

For issues or questions:

1. Check the Sentry dashboard for errors
2. Review application logs
3. Consult this documentation
4. Contact the development team
