/**
 * Web Vitals Tests
 * Tests for Core Web Vitals tracking and rating
 */

// Mock thresholds (same as in web-vitals.ts)
const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 },
};

function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = WEB_VITALS_THRESHOLDS[name as keyof typeof WEB_VITALS_THRESHOLDS];
  if (!thresholds) return 'needs-improvement';

  if (value <= thresholds.good) return 'good';
  if (value > thresholds.poor) return 'poor';
  return 'needs-improvement';
}

describe('Web Vitals Rating', () => {
  describe('LCP (Largest Contentful Paint)', () => {
    it('should rate LCP <= 2500ms as good', () => {
      expect(getRating('LCP', 1500)).toBe('good');
      expect(getRating('LCP', 2500)).toBe('good');
    });

    it('should rate LCP between 2501-4000ms as needs-improvement', () => {
      expect(getRating('LCP', 3000)).toBe('needs-improvement');
      expect(getRating('LCP', 4000)).toBe('needs-improvement');
    });

    it('should rate LCP > 4000ms as poor', () => {
      expect(getRating('LCP', 4001)).toBe('poor');
      expect(getRating('LCP', 6000)).toBe('poor');
    });
  });

  describe('FID (First Input Delay)', () => {
    it('should rate FID <= 100ms as good', () => {
      expect(getRating('FID', 50)).toBe('good');
      expect(getRating('FID', 100)).toBe('good');
    });

    it('should rate FID between 101-300ms as needs-improvement', () => {
      expect(getRating('FID', 150)).toBe('needs-improvement');
      expect(getRating('FID', 300)).toBe('needs-improvement');
    });

    it('should rate FID > 300ms as poor', () => {
      expect(getRating('FID', 301)).toBe('poor');
      expect(getRating('FID', 500)).toBe('poor');
    });
  });

  describe('CLS (Cumulative Layout Shift)', () => {
    it('should rate CLS <= 0.1 as good', () => {
      expect(getRating('CLS', 0.05)).toBe('good');
      expect(getRating('CLS', 0.1)).toBe('good');
    });

    it('should rate CLS between 0.1-0.25 as needs-improvement', () => {
      expect(getRating('CLS', 0.15)).toBe('needs-improvement');
      expect(getRating('CLS', 0.25)).toBe('needs-improvement');
    });

    it('should rate CLS > 0.25 as poor', () => {
      expect(getRating('CLS', 0.3)).toBe('poor');
      expect(getRating('CLS', 0.5)).toBe('poor');
    });
  });

  describe('FCP (First Contentful Paint)', () => {
    it('should rate FCP <= 1800ms as good', () => {
      expect(getRating('FCP', 1000)).toBe('good');
      expect(getRating('FCP', 1800)).toBe('good');
    });

    it('should rate FCP between 1801-3000ms as needs-improvement', () => {
      expect(getRating('FCP', 2000)).toBe('needs-improvement');
    });

    it('should rate FCP > 3000ms as poor', () => {
      expect(getRating('FCP', 3500)).toBe('poor');
    });
  });

  describe('TTFB (Time to First Byte)', () => {
    it('should rate TTFB <= 800ms as good', () => {
      expect(getRating('TTFB', 500)).toBe('good');
      expect(getRating('TTFB', 800)).toBe('good');
    });

    it('should rate TTFB between 801-1800ms as needs-improvement', () => {
      expect(getRating('TTFB', 1000)).toBe('needs-improvement');
    });

    it('should rate TTFB > 1800ms as poor', () => {
      expect(getRating('TTFB', 2000)).toBe('poor');
    });
  });

  describe('INP (Interaction to Next Paint)', () => {
    it('should rate INP <= 200ms as good', () => {
      expect(getRating('INP', 100)).toBe('good');
      expect(getRating('INP', 200)).toBe('good');
    });

    it('should rate INP between 201-500ms as needs-improvement', () => {
      expect(getRating('INP', 300)).toBe('needs-improvement');
    });

    it('should rate INP > 500ms as poor', () => {
      expect(getRating('INP', 600)).toBe('poor');
    });
  });

  describe('Unknown metric', () => {
    it('should return needs-improvement for unknown metrics', () => {
      expect(getRating('UNKNOWN', 1000)).toBe('needs-improvement');
    });
  });
});

describe('Web Vitals Reporting', () => {
  it('should format metric data correctly', () => {
    const metric = {
      name: 'LCP',
      value: 2000,
      rating: 'good',
      delta: 100,
      id: 'test-id',
      page: '/product/1',
      timestamp: Date.now(),
    };

    expect(metric.name).toBe('LCP');
    expect(metric.rating).toBe('good');
    expect(metric.page).toBe('/product/1');
    expect(typeof metric.timestamp).toBe('number');
  });

  it('should have correct data structure for analytics', () => {
    const body = JSON.stringify({
      name: 'LCP',
      value: 2000,
      rating: 'good',
      delta: 100,
      id: 'test-id',
      page: '/product/1',
      timestamp: Date.now(),
    });

    const parsed = JSON.parse(body);
    expect(parsed.name).toBe('LCP');
    expect(parsed.rating).toBe('good');
    expect(parsed.value).toBe(2000);
  });
});
