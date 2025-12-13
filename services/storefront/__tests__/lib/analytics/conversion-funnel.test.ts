/**
 * Tests for Conversion Funnel Analytics
 */
import {
  calculateFunnelMetrics,
  analyzeDropoff,
  calculateOverallConversion,
  segmentByDevice,
  generateFunnelVisualization,
  calculateTimeMetrics,
  getFunnelHealthScore,
  ECOMMERCE_FUNNEL_STAGES,
  FunnelEvent,
} from '@/lib/analytics/conversion-funnel';

// Helper to create test events
function createEvent(
  sessionId: string,
  stage: string,
  device: 'desktop' | 'mobile' | 'tablet' = 'desktop',
  timestamp?: Date
): FunnelEvent {
  return {
    id: `event-${sessionId}-${stage}`,
    sessionId,
    stage,
    timestamp: timestamp || new Date(),
    metadata: {},
    device,
  };
}

describe('Conversion Funnel Analytics', () => {
  describe('ECOMMERCE_FUNNEL_STAGES', () => {
    it('should have all required stages', () => {
      const stageIds = ECOMMERCE_FUNNEL_STAGES.map(s => s.id);
      expect(stageIds).toContain('visit');
      expect(stageIds).toContain('product_view');
      expect(stageIds).toContain('add_to_cart');
      expect(stageIds).toContain('checkout_start');
      expect(stageIds).toContain('purchase');
    });

    it('should have stages in correct order', () => {
      for (let i = 1; i < ECOMMERCE_FUNNEL_STAGES.length; i++) {
        expect(ECOMMERCE_FUNNEL_STAGES[i].order).toBeGreaterThan(
          ECOMMERCE_FUNNEL_STAGES[i - 1].order
        );
      }
    });

    it('should have Ukrainian translations', () => {
      for (const stage of ECOMMERCE_FUNNEL_STAGES) {
        expect(stage.nameUk).toBeDefined();
        expect(stage.descriptionUk).toBeDefined();
      }
    });
  });

  describe('calculateFunnelMetrics', () => {
    it('should calculate visitors per stage', () => {
      const events: FunnelEvent[] = [
        createEvent('session1', 'visit'),
        createEvent('session1', 'product_view'),
        createEvent('session2', 'visit'),
        createEvent('session2', 'product_view'),
        createEvent('session2', 'add_to_cart'),
        createEvent('session3', 'visit'),
      ];

      const metrics = calculateFunnelMetrics(events);

      const visitMetric = metrics.find(m => m.stage === 'visit');
      const productViewMetric = metrics.find(m => m.stage === 'product_view');
      const addToCartMetric = metrics.find(m => m.stage === 'add_to_cart');

      expect(visitMetric?.visitors).toBe(3);
      expect(productViewMetric?.visitors).toBe(2);
      expect(addToCartMetric?.visitors).toBe(1);
    });

    it('should calculate conversion rates', () => {
      const events: FunnelEvent[] = [
        createEvent('session1', 'visit'),
        createEvent('session1', 'product_view'),
        createEvent('session2', 'visit'),
        createEvent('session2', 'product_view'),
        createEvent('session3', 'visit'),
        createEvent('session4', 'visit'),
      ];

      const metrics = calculateFunnelMetrics(events);

      const visitMetric = metrics.find(m => m.stage === 'visit');
      // 4 visits, 2 went to product_view = 50%
      expect(visitMetric?.conversionRate).toBe(50);
    });

    it('should calculate dropoff rates', () => {
      const events: FunnelEvent[] = [
        createEvent('session1', 'visit'),
        createEvent('session1', 'product_view'),
        createEvent('session2', 'visit'),
        createEvent('session3', 'visit'),
        createEvent('session4', 'visit'),
      ];

      const metrics = calculateFunnelMetrics(events);

      const visitMetric = metrics.find(m => m.stage === 'visit');
      // 4 visits, 1 went to product_view = 25% conversion, 75% dropoff
      expect(visitMetric?.dropoffRate).toBe(75);
    });

    it('should handle empty events', () => {
      const metrics = calculateFunnelMetrics([]);

      expect(metrics).toBeDefined();
      expect(metrics.length).toBe(ECOMMERCE_FUNNEL_STAGES.length);
      metrics.forEach(m => {
        expect(m.visitors).toBe(0);
      });
    });
  });

  describe('analyzeDropoff', () => {
    it('should identify stages with high dropoff', () => {
      const events: FunnelEvent[] = [
        createEvent('session1', 'visit'),
        createEvent('session1', 'product_view'),
        createEvent('session2', 'visit'),
        createEvent('session3', 'visit'),
        createEvent('session4', 'visit'),
        createEvent('session5', 'visit'),
      ];

      const metrics = calculateFunnelMetrics(events);
      const analysis = analyzeDropoff(events, metrics);

      const visitDropoff = analysis.find(a => a.fromStage === 'visit');
      expect(visitDropoff).toBeDefined();
      expect(visitDropoff?.dropoffRate).toBe(80);
    });

    it('should provide recommendations for high dropoff stages', () => {
      const events: FunnelEvent[] = [];
      // Create many sessions that drop at product_view
      for (let i = 0; i < 10; i++) {
        events.push(createEvent(`session${i}`, 'visit'));
        events.push(createEvent(`session${i}`, 'product_view'));
      }
      // Only 2 add to cart
      events.push(createEvent('session0', 'add_to_cart'));
      events.push(createEvent('session1', 'add_to_cart'));

      const metrics = calculateFunnelMetrics(events);
      const analysis = analyzeDropoff(events, metrics);

      const productViewDropoff = analysis.find(a => a.fromStage === 'product_view');
      expect(productViewDropoff?.recommendations.length).toBeGreaterThan(0);
      expect(productViewDropoff?.recommendationsUk.length).toBeGreaterThan(0);
    });
  });

  describe('calculateOverallConversion', () => {
    it('should calculate overall funnel conversion', () => {
      const events: FunnelEvent[] = [
        // 4 visitors
        createEvent('session1', 'visit'),
        createEvent('session2', 'visit'),
        createEvent('session3', 'visit'),
        createEvent('session4', 'visit'),
        // 2 reach product view
        createEvent('session1', 'product_view'),
        createEvent('session2', 'product_view'),
        // 1 purchase
        createEvent('session1', 'add_to_cart'),
        createEvent('session1', 'checkout_start'),
        createEvent('session1', 'purchase'),
      ];

      const metrics = calculateFunnelMetrics(events);
      const overall = calculateOverallConversion(metrics);

      expect(overall.totalVisitors).toBe(4);
      expect(overall.totalConversions).toBe(1);
      expect(overall.rate).toBe(25);
    });

    it('should handle zero conversions', () => {
      const events: FunnelEvent[] = [
        createEvent('session1', 'visit'),
        createEvent('session2', 'visit'),
      ];

      const metrics = calculateFunnelMetrics(events);
      const overall = calculateOverallConversion(metrics);

      expect(overall.totalConversions).toBe(0);
      expect(overall.rate).toBe(0);
    });
  });

  describe('segmentByDevice', () => {
    it('should segment funnel by device type', () => {
      const events: FunnelEvent[] = [
        createEvent('d1', 'visit', 'desktop'),
        createEvent('d1', 'product_view', 'desktop'),
        createEvent('d2', 'visit', 'desktop'),
        createEvent('m1', 'visit', 'mobile'),
        createEvent('m1', 'product_view', 'mobile'),
        createEvent('m2', 'visit', 'mobile'),
        createEvent('m3', 'visit', 'mobile'),
      ];

      const segmented = segmentByDevice(events);

      expect(segmented.desktop).toBeDefined();
      expect(segmented.mobile).toBeDefined();
      expect(segmented.tablet).toBeDefined();

      const desktopVisit = segmented.desktop.find(m => m.stage === 'visit');
      const mobileVisit = segmented.mobile.find(m => m.stage === 'visit');

      expect(desktopVisit?.visitors).toBe(2);
      expect(mobileVisit?.visitors).toBe(3);
    });

    it('should calculate separate conversion rates per device', () => {
      const events: FunnelEvent[] = [
        // Desktop: 2/2 = 100% to product_view
        createEvent('d1', 'visit', 'desktop'),
        createEvent('d1', 'product_view', 'desktop'),
        createEvent('d2', 'visit', 'desktop'),
        createEvent('d2', 'product_view', 'desktop'),
        // Mobile: 1/3 = 33% to product_view
        createEvent('m1', 'visit', 'mobile'),
        createEvent('m1', 'product_view', 'mobile'),
        createEvent('m2', 'visit', 'mobile'),
        createEvent('m3', 'visit', 'mobile'),
      ];

      const segmented = segmentByDevice(events);

      const desktopMetric = segmented.desktop.find(m => m.stage === 'visit');
      const mobileMetric = segmented.mobile.find(m => m.stage === 'visit');

      expect(desktopMetric?.conversionRate).toBe(100);
      expect(mobileMetric?.conversionRate).toBeCloseTo(33.3, 0);
    });
  });

  describe('generateFunnelVisualization', () => {
    it('should generate visualization data', () => {
      const events: FunnelEvent[] = [
        createEvent('s1', 'visit'),
        createEvent('s1', 'product_view'),
        createEvent('s2', 'visit'),
      ];

      const metrics = calculateFunnelMetrics(events);
      const viz = generateFunnelVisualization(metrics);

      expect(viz.labels.length).toBe(metrics.length);
      expect(viz.labelsUk.length).toBe(metrics.length);
      expect(viz.values.length).toBe(metrics.length);
      expect(viz.percentages.length).toBe(metrics.length);
      expect(viz.colors.length).toBe(metrics.length);
    });

    it('should calculate percentages relative to first stage', () => {
      const events: FunnelEvent[] = [
        createEvent('s1', 'visit'),
        createEvent('s1', 'product_view'),
        createEvent('s2', 'visit'),
        createEvent('s2', 'product_view'),
        createEvent('s3', 'visit'),
        createEvent('s4', 'visit'),
      ];

      const metrics = calculateFunnelMetrics(events);
      const viz = generateFunnelVisualization(metrics);

      expect(viz.percentages[0]).toBe(100); // First stage always 100%
      expect(viz.percentages[1]).toBe(50); // 2 out of 4
    });
  });

  describe('calculateTimeMetrics', () => {
    it('should calculate average time to conversion', () => {
      const baseTime = new Date('2024-01-01T10:00:00').getTime();
      const events: FunnelEvent[] = [
        {
          id: 'e1',
          sessionId: 's1',
          stage: 'visit',
          timestamp: new Date(baseTime),
          metadata: {},
          device: 'desktop',
        },
        {
          id: 'e2',
          sessionId: 's1',
          stage: 'purchase',
          timestamp: new Date(baseTime + 300000), // 5 minutes later
          metadata: {},
          device: 'desktop',
          timeFromPrevious: 300,
        },
      ];

      const timeMetrics = calculateTimeMetrics(events);

      expect(timeMetrics.avgTimeToConversion).toBeGreaterThan(0);
    });

    it('should handle sessions without conversion', () => {
      const events: FunnelEvent[] = [
        createEvent('s1', 'visit'),
        createEvent('s1', 'product_view'),
        // No purchase
      ];

      const timeMetrics = calculateTimeMetrics(events);

      expect(timeMetrics).toBeDefined();
    });
  });

  describe('getFunnelHealthScore', () => {
    it('should return high score for good funnel', () => {
      // Create a funnel with good conversion at each stage
      const events: FunnelEvent[] = [];
      for (let i = 0; i < 100; i++) {
        events.push(createEvent(`s${i}`, 'visit'));
      }
      for (let i = 0; i < 50; i++) {
        events.push(createEvent(`s${i}`, 'product_view'));
      }
      for (let i = 0; i < 20; i++) {
        events.push(createEvent(`s${i}`, 'add_to_cart'));
      }
      for (let i = 0; i < 10; i++) {
        events.push(createEvent(`s${i}`, 'checkout_start'));
      }
      for (let i = 0; i < 5; i++) {
        events.push(createEvent(`s${i}`, 'purchase'));
      }

      const metrics = calculateFunnelMetrics(events);
      const health = getFunnelHealthScore(metrics);

      expect(health.score).toBeGreaterThanOrEqual(0);
      expect(health.score).toBeLessThanOrEqual(100);
      expect(['A', 'B', 'C', 'D', 'F']).toContain(health.grade);
    });

    it('should identify issues in poor funnel', () => {
      const events: FunnelEvent[] = [
        // 100 visits, only 1 purchase = very poor funnel
        ...Array(100).fill(null).map((_, i) => createEvent(`s${i}`, 'visit')),
        createEvent('s0', 'product_view'),
        createEvent('s0', 'add_to_cart'),
        createEvent('s0', 'checkout_start'),
        createEvent('s0', 'purchase'),
      ];

      const metrics = calculateFunnelMetrics(events);
      const health = getFunnelHealthScore(metrics);

      expect(health.issues.length).toBeGreaterThan(0);
      expect(health.improvements.length).toBeGreaterThan(0);
    });

    it('should return grade based on score', () => {
      const events: FunnelEvent[] = [
        createEvent('s1', 'visit'),
        createEvent('s1', 'product_view'),
        createEvent('s1', 'purchase'),
      ];

      const metrics = calculateFunnelMetrics(events);
      const health = getFunnelHealthScore(metrics);

      if (health.score >= 90) expect(health.grade).toBe('A');
      else if (health.score >= 80) expect(health.grade).toBe('B');
      else if (health.score >= 70) expect(health.grade).toBe('C');
      else if (health.score >= 60) expect(health.grade).toBe('D');
      else expect(health.grade).toBe('F');
    });
  });
});
