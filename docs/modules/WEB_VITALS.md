# Web Vitals Module

Моніторинг Core Web Vitals та метрик продуктивності фронтенду.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          WEB VITALS MONITORING                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Core Web Vitals (Google's metrics for UX):                                 │
│                                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                    │
│  │     LCP      │   │     INP      │   │     CLS      │                    │
│  │ Largest      │   │ Interaction  │   │ Cumulative   │                    │
│  │ Contentful   │   │ to Next      │   │ Layout       │                    │
│  │ Paint        │   │ Paint        │   │ Shift        │                    │
│  │              │   │              │   │              │                    │
│  │ Good: <2.5s  │   │ Good: <200ms │   │ Good: <0.1   │                    │
│  │ Poor: >4s    │   │ Poor: >500ms │   │ Poor: >0.25  │                    │
│  └──────────────┘   └──────────────┘   └──────────────┘                    │
│                                                                              │
│  Additional Metrics:                                                        │
│  ├── FCP (First Contentful Paint)                                          │
│  ├── TTFB (Time to First Byte)                                             │
│  ├── FID (First Input Delay) - deprecated, replaced by INP                 │
│  └── Custom metrics (hydration, API calls)                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Implementation

### Web Vitals Library

```typescript
// lib/web-vitals.ts
import { onCLS, onINP, onLCP, onFCP, onTTFB, Metric } from 'web-vitals';

interface VitalsReport {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

// Analytics endpoint
const ANALYTICS_URL = process.env.NEXT_PUBLIC_ANALYTICS_URL || '/api/vitals';

// Send metrics to analytics
function sendToAnalytics(metric: Metric) {
  const report: VitalsReport = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType || 'unknown',
  };

  // Use sendBeacon for reliability
  if (navigator.sendBeacon) {
    navigator.sendBeacon(ANALYTICS_URL, JSON.stringify(report));
  } else {
    fetch(ANALYTICS_URL, {
      method: 'POST',
      body: JSON.stringify(report),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    });
  }

  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Web Vitals] ${metric.name}:`, metric.value, metric.rating);
  }
}

// Initialize Web Vitals monitoring
export function initWebVitals() {
  onCLS(sendToAnalytics);
  onINP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onFCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}

// Export for Next.js reportWebVitals
export function reportWebVitals(metric: Metric) {
  sendToAnalytics(metric);
}
```

### Next.js Integration

```typescript
// pages/_app.tsx
import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import { initWebVitals, reportWebVitals } from '@/lib/web-vitals';

export { reportWebVitals };

function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    initWebVitals();
  }, []);

  return <Component {...pageProps} />;
}

export default MyApp;
```

### Custom Metrics

```typescript
// lib/performance.ts

// Measure hydration time
export function measureHydration() {
  if (typeof window === 'undefined') return;

  const startTime = performance.now();

  // Wait for React hydration to complete
  requestIdleCallback(() => {
    const hydrationTime = performance.now() - startTime;

    sendCustomMetric({
      name: 'hydration',
      value: hydrationTime,
      unit: 'ms',
    });
  });
}

// Measure API call performance
export function measureApiCall(name: string, duration: number) {
  sendCustomMetric({
    name: `api_${name}`,
    value: duration,
    unit: 'ms',
  });
}

// Measure component render time
export function measureRender(componentName: string) {
  const startTime = performance.now();

  return () => {
    const renderTime = performance.now() - startTime;

    if (renderTime > 100) {
      // Only log slow renders
      sendCustomMetric({
        name: `render_${componentName}`,
        value: renderTime,
        unit: 'ms',
      });
    }
  };
}

// Send custom metric
function sendCustomMetric(metric: { name: string; value: number; unit: string }) {
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals/custom', JSON.stringify(metric));
  }
}
```

### Performance Observer

```typescript
// lib/performance-observer.ts

export function initPerformanceObserver() {
  if (typeof window === 'undefined' || !window.PerformanceObserver) return;

  // Long Tasks (blocking main thread > 50ms)
  const longTaskObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > 50) {
        sendCustomMetric({
          name: 'long_task',
          value: entry.duration,
          unit: 'ms',
        });
      }
    }
  });

  longTaskObserver.observe({ entryTypes: ['longtask'] });

  // Resource Timing (slow resources)
  const resourceObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
      if (entry.duration > 1000) {
        // Resources taking > 1s
        console.warn(`Slow resource: ${entry.name} (${entry.duration}ms)`);
      }
    }
  });

  resourceObserver.observe({ entryTypes: ['resource'] });

  // Layout Shifts
  const layoutShiftObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as any[]) {
      if (!entry.hadRecentInput && entry.value > 0.01) {
        console.warn('Layout shift detected:', entry.value, entry.sources);
      }
    }
  });

  layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
}
```

## Backend API

```typescript
// pages/api/vitals.ts
import type { NextApiRequest, NextApiResponse } from 'next';

interface VitalsData {
  name: string;
  value: number;
  rating: string;
  delta: number;
  id: string;
  navigationType: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const data: VitalsData = req.body;

  // Store in time-series database (InfluxDB, TimescaleDB, etc.)
  await storeVitals({
    ...data,
    timestamp: Date.now(),
    userAgent: req.headers['user-agent'],
    url: req.headers['referer'],
    country: req.headers['cf-ipcountry'], // Cloudflare
  });

  // Alert on poor performance
  if (data.rating === 'poor') {
    await sendAlert({
      metric: data.name,
      value: data.value,
      url: req.headers['referer'],
    });
  }

  res.status(200).json({ success: true });
}

async function storeVitals(data: any) {
  // Example: Store in PostgreSQL with TimescaleDB
  await db.query(
    `INSERT INTO web_vitals (name, value, rating, url, user_agent, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [data.name, data.value, data.rating, data.url, data.userAgent, new Date(data.timestamp)]
  );
}
```

## Thresholds & Targets

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | ≤ 2.5s | 2.5s - 4s | > 4s |
| INP | ≤ 200ms | 200ms - 500ms | > 500ms |
| CLS | ≤ 0.1 | 0.1 - 0.25 | > 0.25 |
| FCP | ≤ 1.8s | 1.8s - 3s | > 3s |
| TTFB | ≤ 800ms | 800ms - 1.8s | > 1.8s |

## Optimization Strategies

### LCP Optimization

```tsx
// Preload critical images
<Head>
  <link
    rel="preload"
    href="/hero-image.webp"
    as="image"
    fetchPriority="high"
  />
</Head>

// Use priority for above-fold images
<Image
  src="/hero.jpg"
  priority
  alt="Hero"
  width={1200}
  height={600}
/>

// Inline critical CSS
<style jsx global>{`
  .hero { min-height: 400px; }
`}</style>
```

### CLS Prevention

```tsx
// Reserve space for images
<div style={{ aspectRatio: '16/9' }}>
  <Image src="/product.jpg" fill alt="Product" />
</div>

// Reserve space for dynamic content
<div style={{ minHeight: '200px' }}>
  {loading ? <Skeleton /> : <Content />}
</div>

// Avoid inserting content above existing
const [ads, setAds] = useState<Ad[]>([]);
// Bad: inserting ads at top
// Good: reserve space or append at bottom
```

### INP Optimization

```tsx
// Debounce expensive handlers
const handleSearch = useDebouncedCallback((query: string) => {
  search(query);
}, 300);

// Use startTransition for non-urgent updates
import { startTransition } from 'react';

function handleFilter(filter: string) {
  startTransition(() => {
    setFilter(filter);
  });
}

// Move heavy computation to Web Worker
const worker = new Worker('/search-worker.js');
worker.postMessage({ query });
```

## Monitoring Dashboard

### Grafana Queries

```sql
-- Average LCP by page
SELECT
  url,
  AVG(value) as avg_lcp,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY value) as p75_lcp
FROM web_vitals
WHERE name = 'LCP'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY url
ORDER BY avg_lcp DESC;

-- Poor CWV rate over time
SELECT
  time_bucket('1 hour', timestamp) as hour,
  COUNT(*) FILTER (WHERE rating = 'poor') * 100.0 / COUNT(*) as poor_rate
FROM web_vitals
WHERE name IN ('LCP', 'INP', 'CLS')
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour;
```

### Alerts

```yaml
# alerts/web-vitals.yml
groups:
  - name: web-vitals
    rules:
      - alert: HighLCP
        expr: |
          avg(web_vitals_lcp_seconds{quantile="0.75"}) > 2.5
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "LCP is above 2.5s threshold"

      - alert: HighCLS
        expr: |
          avg(web_vitals_cls) > 0.1
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "CLS is above 0.1 threshold"

      - alert: HighINP
        expr: |
          avg(web_vitals_inp_milliseconds{quantile="0.75"}) > 200
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "INP is above 200ms threshold"
```

## Lighthouse CI

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI

on:
  pull_request:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Lighthouse
        uses: treosh/lighthouse-ci-action@v10
        with:
          urls: |
            https://staging.shop.ua/
            https://staging.shop.ua/products
          configPath: ./lighthouserc.json
          uploadArtifacts: true

      - name: Assert Results
        run: |
          if [ $(cat .lighthouseci/manifest.json | jq '.[0].summary.performance') -lt 0.9 ]; then
            echo "Performance score below 90%"
            exit 1
          fi
```

```json
// lighthouserc.json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "interactive": ["error", { "maxNumericValue": 3800 }]
      }
    }
  }
}
```

## See Also

- [Performance Tuning](../operations/PERFORMANCE_TUNING.md)
- [PWA Module](./PWA.md)
- [Metrics Module](./METRICS.md)
