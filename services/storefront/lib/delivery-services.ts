/**
 * Ukrainian Delivery Services Integration
 * Supports: Nova Poshta, Meest, Justin, Ukrposhta
 */

import { deliveryLogger } from './logger';

// ==================== TYPES ====================

export interface DeliveryCity {
  ref: string;
  name: string;
  nameRu?: string;
  area: string;
  region?: string;
}

export interface DeliveryWarehouse {
  ref: string;
  number: string;
  name: string;
  shortAddress: string;
  cityRef: string;
  cityName: string;
  phone?: string;
  schedule?: Record<string, string>;
  latitude?: number;
  longitude?: number;
  maxWeight?: number;
  type: 'branch' | 'postomat' | 'pickup';
}

export interface DeliveryPrice {
  cost: number;
  currency: 'UAH';
  estimatedDays: { min: number; max: number };
  provider: DeliveryProvider;
}

export interface TrackingInfo {
  status: DeliveryStatus;
  statusText: string;
  location?: string;
  date: string;
  history: TrackingEvent[];
}

export interface TrackingEvent {
  date: string;
  status: string;
  location?: string;
  description: string;
}

export type DeliveryProvider = 'nova_poshta' | 'meest' | 'justin' | 'ukrposhta';

export type DeliveryStatus =
  | 'created'
  | 'in_transit'
  | 'arrived'
  | 'delivering'
  | 'delivered'
  | 'returned'
  | 'unknown';

export interface DeliveryServiceConfig {
  id: DeliveryProvider;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  sameDayAvailable: boolean;
  postomat: boolean;
  maxWeight: number;
  freeShippingThreshold?: number;
}

// ==================== CONFIGURATION ====================

export const DELIVERY_SERVICES: DeliveryServiceConfig[] = [
  {
    id: 'nova_poshta',
    name: 'Нова Пошта',
    description: 'Доставка 1-3 дні по всій Україні',
    icon: '📦',
    enabled: true,
    sameDayAvailable: true,
    postomat: true,
    maxWeight: 30,
    freeShippingThreshold: 2000,
  },
  {
    id: 'meest',
    name: 'Meest',
    description: 'Доставка 2-4 дні, вигідні тарифи',
    icon: '📮',
    enabled: true,
    sameDayAvailable: false,
    postomat: true,
    maxWeight: 30,
    freeShippingThreshold: 1500,
  },
  {
    id: 'justin',
    name: 'Justin',
    description: 'Швидка доставка у великих містах',
    icon: '🚚',
    enabled: true,
    sameDayAvailable: true,
    postomat: true,
    maxWeight: 20,
    freeShippingThreshold: 1000,
  },
  {
    id: 'ukrposhta',
    name: 'Укрпошта',
    description: 'Економна доставка 3-7 днів',
    icon: '✉️',
    enabled: true,
    sameDayAvailable: false,
    postomat: false,
    maxWeight: 30,
    freeShippingThreshold: 3000,
  },
];

// ==================== MEEST API ====================

const MEEST_API_KEY = process.env.MEEST_API_KEY || '';
const MEEST_API_URL = 'https://api.meest.com/v3.0';

export const meestApi = {
  /**
   * Search cities by name
   */
  async searchCities(query: string): Promise<DeliveryCity[]> {
    try {
      const response = await fetch(`${MEEST_API_URL}/localities?search=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${MEEST_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Meest API error: ${response.status}`);
      }

      const data = await response.json();

      return (data.result || []).map((city: Record<string, string>) => ({
        ref: city.cityID,
        name: city.cityUa,
        nameRu: city.cityRu,
        area: city.districtUa,
        region: city.regionUa,
      }));
    } catch (error) {
      deliveryLogger.error('Meest cities search error', error, { query });
      return [];
    }
  },

  /**
   * Get warehouses in a city
   */
  async getWarehouses(cityRef: string): Promise<DeliveryWarehouse[]> {
    try {
      const response = await fetch(`${MEEST_API_URL}/branches?cityID=${cityRef}`, {
        headers: {
          'Authorization': `Bearer ${MEEST_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Meest API error: ${response.status}`);
      }

      const data = await response.json();

      return (data.result || []).map((wh: Record<string, string | number>) => ({
        ref: wh.branchID as string,
        number: wh.num as string,
        name: `Відділення №${wh.num}`,
        shortAddress: wh.addressUa as string,
        cityRef: wh.cityID as string,
        cityName: wh.cityUa as string,
        phone: wh.phone as string,
        latitude: parseFloat(wh.lat as string),
        longitude: parseFloat(wh.lng as string),
        maxWeight: 30,
        type: (wh.type as string) === 'postomat' ? 'postomat' : 'branch',
      }));
    } catch (error) {
      deliveryLogger.error('Meest warehouses error', error, { cityRef });
      return [];
    }
  },

  /**
   * Calculate delivery price
   */
  async calculatePrice(params: {
    cityFromRef: string;
    cityToRef: string;
    weight: number;
    declaredValue?: number;
  }): Promise<DeliveryPrice | null> {
    try {
      const response = await fetch(`${MEEST_API_URL}/calculator`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MEEST_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cityIDFrom: params.cityFromRef,
          cityIDTo: params.cityToRef,
          weight: params.weight,
          insurance: params.declaredValue || 0,
        }),
      });

      if (!response.ok) {
        throw new Error(`Meest API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        cost: Math.round(data.result?.price || 0),
        currency: 'UAH',
        estimatedDays: { min: 2, max: 4 },
        provider: 'meest',
      };
    } catch (error) {
      deliveryLogger.error('Meest price calculation error', error, { params });
      return null;
    }
  },

  /**
   * Track shipment
   */
  async trackShipment(trackingNumber: string): Promise<TrackingInfo | null> {
    try {
      const response = await fetch(`${MEEST_API_URL}/tracking/${trackingNumber}`, {
        headers: {
          'Authorization': `Bearer ${MEEST_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Meest API error: ${response.status}`);
      }

      const data = await response.json();
      const tracking = data.result;

      return {
        status: mapMeestStatus(tracking?.status),
        statusText: tracking?.statusName || 'Невідомо',
        location: tracking?.currentLocation,
        date: tracking?.lastUpdate || new Date().toISOString(),
        history: (tracking?.history || []).map((h: Record<string, string>) => ({
          date: h.date,
          status: h.status,
          location: h.location,
          description: h.description,
        })),
      };
    } catch (error) {
      deliveryLogger.error('Meest tracking error', error, { trackingNumber });
      return null;
    }
  },
};

// ==================== JUSTIN API ====================

const JUSTIN_API_KEY = process.env.JUSTIN_API_KEY || '';
const JUSTIN_API_URL = 'https://api.justin.ua/client_api/1.0';

export const justinApi = {
  /**
   * Search cities by name
   */
  async searchCities(query: string): Promise<DeliveryCity[]> {
    try {
      const response = await fetch(`${JUSTIN_API_URL}/localities`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${JUSTIN_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: { descr: query },
        }),
      });

      if (!response.ok) {
        throw new Error(`Justin API error: ${response.status}`);
      }

      const data = await response.json();

      return (data.result || []).map((city: Record<string, string>) => ({
        ref: city.uuid,
        name: city.title_ua,
        nameRu: city.title_ru,
        area: city.region,
      }));
    } catch (error) {
      deliveryLogger.error('Justin cities search error', error, { query });
      return [];
    }
  },

  /**
   * Get warehouses in a city
   */
  async getWarehouses(cityRef: string): Promise<DeliveryWarehouse[]> {
    try {
      const response = await fetch(`${JUSTIN_API_URL}/branches`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${JUSTIN_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: { locality_uuid: cityRef },
        }),
      });

      if (!response.ok) {
        throw new Error(`Justin API error: ${response.status}`);
      }

      const data = await response.json();

      return (data.result || []).map((wh: Record<string, string | number | boolean>) => ({
        ref: wh.uuid as string,
        number: wh.code as string,
        name: wh.descr as string,
        shortAddress: wh.address as string,
        cityRef: wh.locality_uuid as string,
        cityName: wh.locality as string,
        phone: wh.phone as string,
        latitude: wh.lat as number,
        longitude: wh.lng as number,
        maxWeight: 20,
        type: wh.is_postomat ? 'postomat' : 'branch',
      }));
    } catch (error) {
      deliveryLogger.error('Justin warehouses error', error, { cityRef });
      return [];
    }
  },

  /**
   * Calculate delivery price
   */
  async calculatePrice(params: {
    cityFromRef: string;
    cityToRef: string;
    weight: number;
    declaredValue?: number;
  }): Promise<DeliveryPrice | null> {
    try {
      const response = await fetch(`${JUSTIN_API_URL}/calculator`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${JUSTIN_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locality_from: params.cityFromRef,
          locality_to: params.cityToRef,
          weight: params.weight,
          declared_value: params.declaredValue || 0,
        }),
      });

      if (!response.ok) {
        throw new Error(`Justin API error: ${response.status}`);
      }

      const data = await response.json();

      // Justin often offers same-day in major cities
      const isSameCity = params.cityFromRef === params.cityToRef;

      return {
        cost: Math.round(data.result?.price || 0),
        currency: 'UAH',
        estimatedDays: isSameCity ? { min: 0, max: 1 } : { min: 1, max: 3 },
        provider: 'justin',
      };
    } catch (error) {
      deliveryLogger.error('Justin price calculation error', error, { params });
      return null;
    }
  },

  /**
   * Track shipment
   */
  async trackShipment(trackingNumber: string): Promise<TrackingInfo | null> {
    try {
      const response = await fetch(`${JUSTIN_API_URL}/tracking`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${JUSTIN_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: trackingNumber,
        }),
      });

      if (!response.ok) {
        throw new Error(`Justin API error: ${response.status}`);
      }

      const data = await response.json();
      const tracking = data.result;

      return {
        status: mapJustinStatus(tracking?.status),
        statusText: tracking?.status_descr || 'Невідомо',
        location: tracking?.location,
        date: tracking?.date || new Date().toISOString(),
        history: (tracking?.history || []).map((h: Record<string, string>) => ({
          date: h.date,
          status: h.status,
          location: h.location,
          description: h.descr,
        })),
      };
    } catch (error) {
      deliveryLogger.error('Justin tracking error', error, { trackingNumber });
      return null;
    }
  },
};

// ==================== UKRPOSHTA API ====================

const UKRPOSHTA_API_KEY = process.env.UKRPOSHTA_API_KEY || '';
const UKRPOSHTA_API_URL = 'https://www.ukrposhta.ua/ecom/0.0.1';

export const ukrposhtaApi = {
  /**
   * Search cities by name
   */
  async searchCities(query: string): Promise<DeliveryCity[]> {
    try {
      const response = await fetch(
        `${UKRPOSHTA_API_URL}/address/city?q=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': `Bearer ${UKRPOSHTA_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Ukrposhta API error: ${response.status}`);
      }

      const data = await response.json();

      return (data.Entries?.Entry || []).map((city: Record<string, string>) => ({
        ref: city.CITY_ID,
        name: city.CITY_UA,
        area: city.DISTRICT_UA,
        region: city.REGION_UA,
      }));
    } catch (error) {
      deliveryLogger.error('Ukrposhta cities search error', error, { query });
      return [];
    }
  },

  /**
   * Get post offices in a city
   */
  async getWarehouses(cityRef: string): Promise<DeliveryWarehouse[]> {
    try {
      const response = await fetch(
        `${UKRPOSHTA_API_URL}/address/postoffice?cityId=${cityRef}`,
        {
          headers: {
            'Authorization': `Bearer ${UKRPOSHTA_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Ukrposhta API error: ${response.status}`);
      }

      const data = await response.json();

      return (data.Entries?.Entry || []).map((po: Record<string, string | number>) => ({
        ref: po.POSTOFFICE_ID as string,
        number: po.POSTCODE as string,
        name: `Відділення ${po.POSTCODE}`,
        shortAddress: po.ADDRESS as string,
        cityRef: po.CITY_ID as string,
        cityName: po.CITY_UA as string,
        latitude: po.LATITUDE as number,
        longitude: po.LONGITUDE as number,
        maxWeight: 30,
        type: 'branch',
      }));
    } catch (error) {
      deliveryLogger.error('Ukrposhta offices error', error, { cityRef });
      return [];
    }
  },

  /**
   * Calculate delivery price
   */
  async calculatePrice(params: {
    cityFromRef: string;
    cityToRef: string;
    weight: number;
    declaredValue?: number;
  }): Promise<DeliveryPrice | null> {
    try {
      const response = await fetch(`${UKRPOSHTA_API_URL}/domestic/delivery-price`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${UKRPOSHTA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cityFrom: params.cityFromRef,
          cityTo: params.cityToRef,
          weight: params.weight * 1000, // Convert kg to grams
          declaredPrice: params.declaredValue || 0,
          deliveryType: 'W2W', // Warehouse to Warehouse
        }),
      });

      if (!response.ok) {
        throw new Error(`Ukrposhta API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        cost: Math.round(data.deliveryPrice || 0),
        currency: 'UAH',
        estimatedDays: { min: 3, max: 7 },
        provider: 'ukrposhta',
      };
    } catch (error) {
      deliveryLogger.error('Ukrposhta price calculation error', error, { params });
      return null;
    }
  },

  /**
   * Track shipment
   */
  async trackShipment(trackingNumber: string): Promise<TrackingInfo | null> {
    try {
      const response = await fetch(
        `${UKRPOSHTA_API_URL}/statuses/barcodes/${trackingNumber}`,
        {
          headers: {
            'Authorization': `Bearer ${UKRPOSHTA_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Ukrposhta API error: ${response.status}`);
      }

      const data = await response.json();
      const events = data.eventList || [];
      const lastEvent = events[0];

      return {
        status: mapUkrposhtaStatus(lastEvent?.eventCode),
        statusText: lastEvent?.eventDescription || 'Невідомо',
        location: lastEvent?.postOfficeName,
        date: lastEvent?.eventDateTime || new Date().toISOString(),
        history: events.map((e: Record<string, string>) => ({
          date: e.eventDateTime,
          status: e.eventCode,
          location: e.postOfficeName,
          description: e.eventDescription,
        })),
      };
    } catch (error) {
      deliveryLogger.error('Ukrposhta tracking error', error, { trackingNumber });
      return null;
    }
  },
};

// ==================== UNIFIED API ====================

/**
 * Get delivery service API by provider
 */
export function getDeliveryApi(provider: DeliveryProvider) {
  switch (provider) {
    case 'meest':
      return meestApi;
    case 'justin':
      return justinApi;
    case 'ukrposhta':
      return ukrposhtaApi;
    default:
      return null; // Nova Poshta has its own module
  }
}

/**
 * Get all available delivery options for an order
 */
export async function getAllDeliveryPrices(params: {
  cityFromRef: string;
  cityToRef: string;
  weight: number;
  declaredValue?: number;
}): Promise<DeliveryPrice[]> {
  const prices: DeliveryPrice[] = [];

  const providers: DeliveryProvider[] = ['meest', 'justin', 'ukrposhta'];

  const results = await Promise.allSettled(
    providers.map(async provider => {
      const api = getDeliveryApi(provider);
      if (!api) return null;
      return api.calculatePrice(params);
    })
  );

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      prices.push(result.value);
    }
  });

  // Sort by price
  return prices.sort((a, b) => a.cost - b.cost);
}

/**
 * Check if free shipping is available
 */
export function checkFreeShipping(
  provider: DeliveryProvider,
  orderAmount: number
): { isFree: boolean; threshold: number; remaining: number } {
  const service = DELIVERY_SERVICES.find(s => s.id === provider);
  const threshold = service?.freeShippingThreshold || 0;

  if (!threshold) {
    return { isFree: false, threshold: 0, remaining: 0 };
  }

  return {
    isFree: orderAmount >= threshold,
    threshold,
    remaining: Math.max(0, threshold - orderAmount),
  };
}

// ==================== STATUS MAPPERS ====================

function mapMeestStatus(status?: string): DeliveryStatus {
  const statusMap: Record<string, DeliveryStatus> = {
    new: 'created',
    processing: 'in_transit',
    arrived: 'arrived',
    delivering: 'delivering',
    delivered: 'delivered',
    returned: 'returned',
  };
  return statusMap[status || ''] || 'unknown';
}

function mapJustinStatus(status?: string): DeliveryStatus {
  const statusMap: Record<string, DeliveryStatus> = {
    created: 'created',
    in_delivery: 'in_transit',
    at_branch: 'arrived',
    out_for_delivery: 'delivering',
    delivered: 'delivered',
    returned: 'returned',
  };
  return statusMap[status || ''] || 'unknown';
}

function mapUkrposhtaStatus(code?: string): DeliveryStatus {
  if (!code) return 'unknown';

  if (code.startsWith('1')) return 'created';
  if (code.startsWith('2') || code.startsWith('3')) return 'in_transit';
  if (code.startsWith('4')) return 'arrived';
  if (code.startsWith('5')) return 'delivering';
  if (code.startsWith('6')) return 'delivered';
  if (code.startsWith('7') || code.startsWith('8')) return 'returned';

  return 'unknown';
}

/**
 * Get delivery status text in Ukrainian
 */
export function getDeliveryStatusText(status: DeliveryStatus): string {
  const texts: Record<DeliveryStatus, string> = {
    created: 'Створено',
    in_transit: 'В дорозі',
    arrived: 'Прибуло у відділення',
    delivering: 'Доставляється',
    delivered: 'Доставлено',
    returned: 'Повернено',
    unknown: 'Невідомо',
  };
  return texts[status];
}
