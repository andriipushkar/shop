# Monitoring Module

This directory contains monitoring and observability integrations for the application.

## Files

### Core Sentry Files

- **`sentry.ts`** - Main Sentry client-side integration with:
  - Error tracking utilities
  - Performance monitoring
  - User context management
  - Error boundary wrapper HOC
  - Business context helpers
  - Feature flag tracking

- **`sentry-server.ts`** - Server-side (Node.js runtime) Sentry initialization
  - Prisma integration
  - HTTP request tracking
  - Server performance monitoring
  - Environment variable filtering

- **`sentry-edge.ts`** - Edge runtime Sentry initialization
  - Optimized for edge environments
  - Lightweight configuration

### Other Monitoring Files

- **`analytics.ts`** - Client-side analytics tracking
- **`business-events.ts`** - Business event tracking
- **`logger.ts`** - Structured logging
- **`metrics.ts`** - Application metrics
- **`index.ts`** - Combined monitoring initialization

## Quick Start

### 1. Environment Setup

Add to your `.env.local`:

```bash
NEXT_PUBLIC_SENTRY_DSN=https://your-key@sentry.io/project
SENTRY_AUTH_TOKEN=your-auth-token
SENTRY_ORG=your-organization
SENTRY_PROJECT=your-project
```

### 2. Initialize Sentry

Client-side (automatic via `sentry.client.config.ts`):

```typescript
import { initSentry } from '@/lib/monitoring/sentry';

initSentry();
```

### 3. Track Errors

```typescript
import { captureError } from '@/lib/monitoring/sentry';

try {
  await riskyOperation();
} catch (error) {
  captureError(error as Error, { context: 'additional-info' });
}
```

### 4. Use Error Boundaries

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

<ErrorBoundary fallback={<ErrorPage />}>
  <YourApp />
</ErrorBoundary>
```

### 5. Track Performance

```typescript
import { measurePerformance } from '@/lib/monitoring/sentry';

const result = await measurePerformance(
  { name: 'operation', op: 'function' },
  async () => await expensiveOperation()
);
```

### 6. Set User Context

```typescript
import { setUserContext } from '@/lib/monitoring/sentry';

setUserContext({
  id: user.id,
  email: user.email,
  name: user.name,
});
```

### 7. Enable Logger Integration

```typescript
import { enableSentryTransport } from '@/lib/logger';

enableSentryTransport();
```

## API Overview

### Error Tracking

- `captureError(error, context?)` - Capture an exception
- `captureMessage(message, level?)` - Capture a message
- `withErrorTracking(fn, context?)` - Wrap async function with error tracking

### Performance Monitoring

- `measurePerformance(options, fn)` - Measure function performance
- `trackApiCall(endpoint, method, fn)` - Track API call performance
- `trackDatabaseQuery(operation, table, fn)` - Track database query performance
- `startPerformanceTransaction(options)` - Start a custom transaction

### Context Management

- `setUserContext(user)` - Set user information
- `setBusinessContext(context)` - Set business context (cart, order, etc.)
- `setFeatureFlags(flags)` - Track feature flag state
- `addBreadcrumb(category, message, data?, level?)` - Add breadcrumb

### Error Boundaries

- `<ErrorBoundary>` - React error boundary component
- `withErrorBoundary(Component, options)` - HOC for error boundaries
- `useErrorHandler()` - Hook to trigger error boundary programmatically

### Utilities

- `isSentryEnabled()` - Check if Sentry is initialized
- `flushEvents(timeout?)` - Flush events immediately
- `closeSentry(timeout?)` - Close Sentry client

## Configuration Options

### SentryConfig

```typescript
interface SentryConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
  replaysSessionSampleRate?: number;
  replaysOnErrorSampleRate?: number;
  maxBreadcrumbs?: number;
  debug?: boolean;
}
```

### ErrorBoundaryOptions

```typescript
interface ErrorBoundaryOptions {
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDialog?: boolean;
  beforeCapture?: (scope: Scope, error: Error, errorInfo: ErrorInfo) => void;
  level?: SeverityLevel;
  tags?: Record<string, string>;
  context?: Record<string, unknown>;
}
```

## Best Practices

1. **Always provide context** when capturing errors
2. **Filter sensitive data** in `beforeSend` hooks
3. **Use appropriate sample rates** in production
4. **Set user context** after authentication
5. **Add breadcrumbs** for important user actions
6. **Use error boundaries** at strategic component levels
7. **Track performance** for critical operations
8. **Set business context** for e-commerce operations

## Documentation

- [Full Documentation](../../docs/sentry-integration.md)
- [Usage Examples](../../docs/sentry-examples.md)
- [Sentry Official Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

## Testing

Tests are located in:
- `__tests__/lib/monitoring/sentry.test.ts`
- `__tests__/components/ErrorBoundary.test.tsx`

Run tests:
```bash
npm test sentry
npm test ErrorBoundary
```

## Support

For issues or questions:
1. Check the documentation
2. Review existing Sentry events
3. Check application logs
4. Contact the development team
