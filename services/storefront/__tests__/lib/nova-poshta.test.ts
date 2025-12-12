/**
 * Nova Poshta API Service Tests
 */

import {
  searchCities,
  getCities,
  getWarehouses,
  searchWarehouses,
  trackShipment,
  getDeliveryStatusText,
  estimateDeliveryPrice,
  DELIVERY_PRICES,
} from '@/lib/nova-poshta';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Nova Poshta Service', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Suppress console warnings for tests
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('searchCities', () => {
    it('should return mock cities when API key is not set', async () => {
      const cities = await searchCities('Київ');

      expect(cities).toBeDefined();
      expect(Array.isArray(cities)).toBe(true);
      expect(cities.length).toBeGreaterThan(0);
      expect(cities.some(city => city.Description.includes('Київ'))).toBe(true);
    });

    it('should filter cities by search query', async () => {
      const cities = await searchCities('Льві');

      expect(cities.some(city => city.Description === 'Львів')).toBe(true);
    });

    it('should return empty array for non-matching query', async () => {
      const cities = await searchCities('НеіснуючеМісто123');

      expect(cities).toEqual([]);
    });

    it('should handle empty search query', async () => {
      const cities = await searchCities('');

      expect(cities).toBeDefined();
      expect(Array.isArray(cities)).toBe(true);
    });
  });

  describe('getCities', () => {
    it('should return list of cities', async () => {
      const cities = await getCities();

      expect(cities).toBeDefined();
      expect(Array.isArray(cities)).toBe(true);
      expect(cities.length).toBeGreaterThan(0);
    });

    it('should include major Ukrainian cities', async () => {
      const cities = await getCities();
      const cityNames = cities.map(c => c.Description);

      expect(cityNames).toContain('Київ');
      expect(cityNames).toContain('Львів');
      expect(cityNames).toContain('Одеса');
    });
  });

  describe('getWarehouses', () => {
    it('should return warehouses for a city', async () => {
      const cities = await getCities();
      const kyiv = cities.find(c => c.Description === 'Київ');

      expect(kyiv).toBeDefined();

      const warehouses = await getWarehouses(kyiv!.Ref);

      expect(warehouses).toBeDefined();
      expect(Array.isArray(warehouses)).toBe(true);
      expect(warehouses.length).toBeGreaterThan(0);
    });

    it('should return warehouses with required properties', async () => {
      const cities = await getCities();
      const kyiv = cities.find(c => c.Description === 'Київ');
      const warehouses = await getWarehouses(kyiv!.Ref);

      const warehouse = warehouses[0];
      expect(warehouse).toHaveProperty('Ref');
      expect(warehouse).toHaveProperty('Description');
      expect(warehouse).toHaveProperty('Number');
      expect(warehouse).toHaveProperty('CityRef');
    });

    it('should return empty array for invalid city ref', async () => {
      const warehouses = await getWarehouses('invalid-city-ref');

      expect(warehouses).toEqual([]);
    });
  });

  describe('searchWarehouses', () => {
    it('should search warehouses within a city', async () => {
      const cities = await getCities();
      const kyiv = cities.find(c => c.Description === 'Київ');

      const warehouses = await searchWarehouses(kyiv!.Ref, 'Відділення');

      expect(warehouses).toBeDefined();
      expect(Array.isArray(warehouses)).toBe(true);
    });
  });

  describe('trackShipment', () => {
    it('should return tracking info for a tracking number', async () => {
      const info = await trackShipment('20450000000000');

      expect(info).toBeDefined();
      expect(info).toHaveProperty('Status');
      expect(info).toHaveProperty('StatusCode');
      expect(info).toHaveProperty('Number');
    });

    it('should include sender and recipient city info', async () => {
      const info = await trackShipment('20450000000000');

      expect(info).toHaveProperty('CitySender');
      expect(info).toHaveProperty('CityRecipient');
    });
  });

  describe('getDeliveryStatusText', () => {
    it('should return status text for known status codes', () => {
      expect(getDeliveryStatusText('1')).toBe('Відправлення створено');
      expect(getDeliveryStatusText('9')).toBe('Відправлення отримано');
      expect(getDeliveryStatusText('5')).toBe('Відправлення прямує до міста одержувача');
    });

    it('should return default text for unknown status codes', () => {
      expect(getDeliveryStatusText('9999')).toBe('Невідомий статус');
      expect(getDeliveryStatusText('')).toBe('Невідомий статус');
    });
  });

  describe('estimateDeliveryPrice', () => {
    it('should return 0 for orders above free delivery threshold', () => {
      const price = estimateDeliveryPrice('warehouse', DELIVERY_PRICES.FREE_DELIVERY_THRESHOLD + 1);
      expect(price).toBe(0);
    });

    it('should calculate warehouse delivery price', () => {
      const price = estimateDeliveryPrice('warehouse', 500);
      expect(price).toBeGreaterThanOrEqual(DELIVERY_PRICES.NOVA_POSHTA_WAREHOUSE.min);
    });

    it('should calculate courier delivery price (higher than warehouse)', () => {
      const warehousePrice = estimateDeliveryPrice('warehouse', 500);
      const courierPrice = estimateDeliveryPrice('courier', 500);

      expect(courierPrice).toBeGreaterThanOrEqual(warehousePrice);
    });

    it('should calculate ukrposhta delivery price (lower than nova poshta)', () => {
      const warehousePrice = estimateDeliveryPrice('warehouse', 500);
      const ukrposhtaPrice = estimateDeliveryPrice('ukrposhta', 500);

      expect(ukrposhtaPrice).toBeLessThanOrEqual(warehousePrice);
    });

    it('should increase price with weight', () => {
      const price1kg = estimateDeliveryPrice('warehouse', 500, 1);
      const price5kg = estimateDeliveryPrice('warehouse', 500, 5);

      expect(price5kg).toBeGreaterThan(price1kg);
    });
  });

  describe('DELIVERY_PRICES constants', () => {
    it('should have required price constants', () => {
      expect(DELIVERY_PRICES.NOVA_POSHTA_WAREHOUSE).toBeDefined();
      expect(DELIVERY_PRICES.NOVA_POSHTA_COURIER).toBeDefined();
      expect(DELIVERY_PRICES.UKRPOSHTA).toBeDefined();
      expect(DELIVERY_PRICES.FREE_DELIVERY_THRESHOLD).toBeDefined();
    });

    it('should have positive price values', () => {
      expect(DELIVERY_PRICES.NOVA_POSHTA_WAREHOUSE.min).toBeGreaterThan(0);
      expect(DELIVERY_PRICES.NOVA_POSHTA_COURIER.min).toBeGreaterThan(0);
      expect(DELIVERY_PRICES.UKRPOSHTA.min).toBeGreaterThan(0);
      expect(DELIVERY_PRICES.FREE_DELIVERY_THRESHOLD).toBeGreaterThan(0);
    });
  });
});
