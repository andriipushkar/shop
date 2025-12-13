/**
 * Tests for Delivery Services integration
 */
import {
  DELIVERY_SERVICES,
  getAllDeliveryPrices,
  checkFreeShipping,
  DeliveryProvider,
} from '@/lib/delivery-services';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('Delivery Services Integration', () => {
  describe('DELIVERY_SERVICES configuration', () => {
    it('should have all required services configured', () => {
      const serviceIds = DELIVERY_SERVICES.map(s => s.id);
      expect(serviceIds).toContain('nova_poshta');
      expect(serviceIds).toContain('meest');
      expect(serviceIds).toContain('justin');
      expect(serviceIds).toContain('ukrposhta');
    });

    it('should have valid configurations for all services', () => {
      for (const service of DELIVERY_SERVICES) {
        expect(service.id).toBeDefined();
        expect(service.name).toBeDefined();
        expect(service.description).toBeDefined();
        expect(service.icon).toBeDefined();
        expect(typeof service.enabled).toBe('boolean');
        expect(typeof service.sameDayAvailable).toBe('boolean');
        expect(typeof service.postomat).toBe('boolean');
        expect(service.maxWeight).toBeGreaterThan(0);
      }
    });

    it('should have Nova Poshta as first option', () => {
      expect(DELIVERY_SERVICES[0].id).toBe('nova_poshta');
      expect(DELIVERY_SERVICES[0].name).toBe('Нова Пошта');
    });

    it('should have free shipping thresholds for all services', () => {
      for (const service of DELIVERY_SERVICES) {
        expect(service.freeShippingThreshold).toBeDefined();
        expect(service.freeShippingThreshold).toBeGreaterThan(0);
      }
    });
  });

  describe('checkFreeShipping', () => {
    it('should return free shipping for nova_poshta when order >= 2000', () => {
      const result = checkFreeShipping('nova_poshta', 2500);
      expect(result.isFree).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('should return remaining amount for nova_poshta when order < 2000', () => {
      const result = checkFreeShipping('nova_poshta', 1500);
      expect(result.isFree).toBe(false);
      expect(result.remaining).toBe(500);
      expect(result.threshold).toBe(2000);
    });

    it('should return free shipping for meest when order >= 1500', () => {
      const result = checkFreeShipping('meest', 1500);
      expect(result.isFree).toBe(true);
    });

    it('should return free shipping for justin when order >= 1000', () => {
      const result = checkFreeShipping('justin', 1000);
      expect(result.isFree).toBe(true);
    });

    it('should return free shipping for ukrposhta when order >= 3000', () => {
      const result = checkFreeShipping('ukrposhta', 3000);
      expect(result.isFree).toBe(true);
    });

    it('should not give free shipping for ukrposhta under 3000', () => {
      const result = checkFreeShipping('ukrposhta', 2999);
      expect(result.isFree).toBe(false);
      expect(result.remaining).toBe(1);
    });

    it('should handle unknown providers gracefully', () => {
      const result = checkFreeShipping('unknown' as DeliveryProvider, 5000);
      expect(result.isFree).toBe(false);
      expect(result.threshold).toBe(0);
    });

    it('should calculate remaining correctly for meest', () => {
      const result = checkFreeShipping('meest', 1234);
      expect(result.remaining).toBe(1500 - 1234);
      expect(result.remaining).toBe(266);
    });
  });

  describe('getAllDeliveryPrices', () => {
    beforeEach(() => {
      // Mock successful API responses
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            price: 75,
            estimatedDays: { min: 2, max: 3 },
          },
        }),
      });
    });

    it('should return prices for all active providers', async () => {
      const prices = await getAllDeliveryPrices({
        cityFromRef: 'city-ref-1',
        cityToRef: 'city-ref-2',
        weight: 1,
        declaredValue: 1000,
      });

      expect(Array.isArray(prices)).toBe(true);
    });

    it('should include cost and provider in results', async () => {
      const prices = await getAllDeliveryPrices({
        cityFromRef: 'city-ref-1',
        cityToRef: 'city-ref-2',
        weight: 2,
        declaredValue: 2000,
      });

      for (const price of prices) {
        expect(price.provider).toBeDefined();
        expect(price.cost).toBeGreaterThanOrEqual(0);
        expect(price.currency).toBe('UAH');
        expect(price.estimatedDays).toBeDefined();
      }
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const prices = await getAllDeliveryPrices({
        cityFromRef: 'city-ref-1',
        cityToRef: 'city-ref-2',
        weight: 1,
        declaredValue: 500,
      });

      // Should return empty array or partial results on error
      expect(Array.isArray(prices)).toBe(true);
    });

    it('should sort prices by cost', async () => {
      // This test verifies the sorting behavior
      const prices = await getAllDeliveryPrices({
        cityFromRef: 'city-ref-1',
        cityToRef: 'city-ref-2',
        weight: 1,
        declaredValue: 1000,
      });

      if (prices.length > 1) {
        for (let i = 1; i < prices.length; i++) {
          expect(prices[i].cost).toBeGreaterThanOrEqual(prices[i - 1].cost);
        }
      }
    });
  });

  describe('Service features', () => {
    it('should have same-day delivery for nova_poshta and justin', () => {
      const novaPoshta = DELIVERY_SERVICES.find(s => s.id === 'nova_poshta');
      const justin = DELIVERY_SERVICES.find(s => s.id === 'justin');

      expect(novaPoshta?.sameDayAvailable).toBe(true);
      expect(justin?.sameDayAvailable).toBe(true);
    });

    it('should not have same-day delivery for meest and ukrposhta', () => {
      const meest = DELIVERY_SERVICES.find(s => s.id === 'meest');
      const ukrposhta = DELIVERY_SERVICES.find(s => s.id === 'ukrposhta');

      expect(meest?.sameDayAvailable).toBe(false);
      expect(ukrposhta?.sameDayAvailable).toBe(false);
    });

    it('should have postomat support for nova_poshta, meest and justin', () => {
      const novaPoshta = DELIVERY_SERVICES.find(s => s.id === 'nova_poshta');
      const meest = DELIVERY_SERVICES.find(s => s.id === 'meest');
      const justin = DELIVERY_SERVICES.find(s => s.id === 'justin');

      expect(novaPoshta?.postomat).toBe(true);
      expect(meest?.postomat).toBe(true);
      expect(justin?.postomat).toBe(true);
    });

    it('should not have postomat support for ukrposhta', () => {
      const ukrposhta = DELIVERY_SERVICES.find(s => s.id === 'ukrposhta');
      expect(ukrposhta?.postomat).toBe(false);
    });

    it('should all be enabled', () => {
      for (const service of DELIVERY_SERVICES) {
        expect(service.enabled).toBe(true);
      }
    });
  });
});
