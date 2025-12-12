/**
 * Nova Poshta API Integration
 * API Documentation: https://developers.novaposhta.ua/documentation
 */

// Types
export interface NovaPoshtaCity {
  Ref: string;
  Description: string;
  DescriptionRu: string;
  Area: string;
  AreaDescription: string;
  SettlementType: string;
  SettlementTypeDescription: string;
}

export interface NovaPoshtaWarehouse {
  Ref: string;
  SiteKey: string;
  Description: string;
  DescriptionRu: string;
  ShortAddress: string;
  ShortAddressRu: string;
  Phone: string;
  TypeOfWarehouse: string;
  Number: string;
  CityRef: string;
  CityDescription: string;
  CityDescriptionRu: string;
  SettlementRef: string;
  SettlementDescription: string;
  SettlementAreaDescription: string;
  Schedule: {
    Monday: string;
    Tuesday: string;
    Wednesday: string;
    Thursday: string;
    Friday: string;
    Saturday: string;
    Sunday: string;
  };
  PostFinance: string;
  BicycleParking: string;
  POSTerminal: string;
  InternationalShipping: string;
  SelfServiceWorkplacesCount: string;
  TotalMaxWeightAllowed: string;
  PlaceMaxWeightAllowed: string;
  Reception: {
    Monday: string;
    Tuesday: string;
    Wednesday: string;
    Thursday: string;
    Friday: string;
    Saturday: string;
    Sunday: string;
  };
  Delivery: {
    Monday: string;
    Tuesday: string;
    Wednesday: string;
    Thursday: string;
    Friday: string;
    Saturday: string;
    Sunday: string;
  };
  Longitude: string;
  Latitude: string;
  PostMachineType: string;
  PostalCodeUA: string;
  WarehouseStatus: string;
}

export interface NovaPoshtaDeliveryPrice {
  Cost: number;
  AssessedCost: number;
  CostRedelivery: number;
  TZoneFrom: string;
  TZoneTo: string;
}

export interface NovaPoshtaTrackingDocument {
  StatusCode: string;
  Status: string;
  Number: string;
  Redelivery: number;
  RedeliverySum: number;
  RedeliveryNum: string;
  RedeliveryPayer: string;
  OwnerDocumentType: string;
  LastCreatedOnTheBasisDocumentType: string;
  LastCreatedOnTheBasisPayerType: string;
  LastCreatedOnTheBasisDateTime: string;
  LastTransactionStatusGM: string;
  LastTransactionDateTimeGM: string;
  DateCreated: string;
  DocumentWeight: string;
  CheckWeight: string;
  DocumentCost: string;
  SumBeforeCheckWeight: number;
  PayerType: string;
  RecipientFullName: string;
  RecipientDateTime: string;
  ScheduledDeliveryDate: string;
  PaymentMethod: string;
  CargoDescriptionString: string;
  CargoType: string;
  CitySender: string;
  CityRecipient: string;
  WarehouseRecipient: string;
  CounterpartyType: string;
  AfterpaymentOnGoodsCost: string;
  ServiceType: string;
  UndeliveryReasonsSubtypeDescription: string;
  WarehouseRecipientNumber: number;
  LastCreatedOnTheBasisNumber: string;
  PhoneRecipient: string;
  RecipientFullNameEW: string;
  WarehouseRecipientInternetAddressRef: string;
  MarketplacePartnerToken: string;
  ClientBarcode: string;
  RecipientAddress: string;
  CounterpartySenderDescription: string;
  CounterpartyRecipientDescription: string;
  CounterpartySenderType: string;
  DateScan: string;
  PaymentStatus: string;
  PaymentStatusDate: string;
  AmountToPay: string;
  AmountPaid: string;
  RefEW: string;
  BackwardDeliverySubTypesActions: string;
  BackwardDeliverySubTypesServices: string;
  UndeliveryReasons: string;
  DatePayedKeeping: string;
}

export interface NovaPoshtaApiResponse<T> {
  success: boolean;
  data: T[];
  errors: string[];
  warnings: string[];
  info: {
    totalCount?: number;
  };
}

// API Configuration
const NOVA_POSHTA_API_URL = 'https://api.novaposhta.ua/v2.0/json/';
const API_KEY = process.env.NEXT_PUBLIC_NOVA_POSHTA_API_KEY || '';

// Mock data for development (when API key is not available)
const MOCK_CITIES: NovaPoshtaCity[] = [
  { Ref: 'city-1', Description: 'Київ', DescriptionRu: 'Киев', Area: 'area-1', AreaDescription: 'Київська', SettlementType: 'city', SettlementTypeDescription: 'місто' },
  { Ref: 'city-2', Description: 'Львів', DescriptionRu: 'Львов', Area: 'area-2', AreaDescription: 'Львівська', SettlementType: 'city', SettlementTypeDescription: 'місто' },
  { Ref: 'city-3', Description: 'Одеса', DescriptionRu: 'Одесса', Area: 'area-3', AreaDescription: 'Одеська', SettlementType: 'city', SettlementTypeDescription: 'місто' },
  { Ref: 'city-4', Description: 'Харків', DescriptionRu: 'Харьков', Area: 'area-4', AreaDescription: 'Харківська', SettlementType: 'city', SettlementTypeDescription: 'місто' },
  { Ref: 'city-5', Description: 'Дніпро', DescriptionRu: 'Днепр', Area: 'area-5', AreaDescription: 'Дніпропетровська', SettlementType: 'city', SettlementTypeDescription: 'місто' },
  { Ref: 'city-6', Description: 'Запоріжжя', DescriptionRu: 'Запорожье', Area: 'area-6', AreaDescription: 'Запорізька', SettlementType: 'city', SettlementTypeDescription: 'місто' },
  { Ref: 'city-7', Description: 'Вінниця', DescriptionRu: 'Винница', Area: 'area-7', AreaDescription: 'Вінницька', SettlementType: 'city', SettlementTypeDescription: 'місто' },
  { Ref: 'city-8', Description: 'Полтава', DescriptionRu: 'Полтава', Area: 'area-8', AreaDescription: 'Полтавська', SettlementType: 'city', SettlementTypeDescription: 'місто' },
];

const createMockWarehouses = (cityRef: string, cityName: string): NovaPoshtaWarehouse[] => {
  const baseSchedule = {
    Monday: '08:00-20:00',
    Tuesday: '08:00-20:00',
    Wednesday: '08:00-20:00',
    Thursday: '08:00-20:00',
    Friday: '08:00-20:00',
    Saturday: '09:00-18:00',
    Sunday: '09:00-15:00',
  };

  return Array.from({ length: 10 }, (_, i) => ({
    Ref: `warehouse-${cityRef}-${i + 1}`,
    SiteKey: `${i + 1}`,
    Description: `Відділення №${i + 1}: вул. Центральна, ${10 + i}`,
    DescriptionRu: `Отделение №${i + 1}: ул. Центральная, ${10 + i}`,
    ShortAddress: `${cityName}, вул. Центральна, ${10 + i}`,
    ShortAddressRu: `${cityName}, ул. Центральная, ${10 + i}`,
    Phone: '0800 500 609',
    TypeOfWarehouse: i < 7 ? 'Warehouse' : 'Postomat',
    Number: `${i + 1}`,
    CityRef: cityRef,
    CityDescription: cityName,
    CityDescriptionRu: cityName,
    SettlementRef: `settlement-${cityRef}`,
    SettlementDescription: cityName,
    SettlementAreaDescription: cityName,
    Schedule: baseSchedule,
    PostFinance: '1',
    BicycleParking: i % 2 === 0 ? '1' : '0',
    POSTerminal: '1',
    InternationalShipping: '1',
    SelfServiceWorkplacesCount: '2',
    TotalMaxWeightAllowed: '30',
    PlaceMaxWeightAllowed: '30',
    Reception: baseSchedule,
    Delivery: baseSchedule,
    Longitude: '30.5234',
    Latitude: '50.4501',
    PostMachineType: i >= 7 ? 'PostMachine' : '',
    PostalCodeUA: `0${1000 + i}`,
    WarehouseStatus: 'Working',
  }));
};

// API Functions
async function callNovaPoshtaApi<T>(
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, unknown> = {}
): Promise<NovaPoshtaApiResponse<T>> {
  // If no API key, use mock data
  if (!API_KEY) {
    console.warn('Nova Poshta API key not configured, using mock data');
    return getMockResponse<T>(modelName, calledMethod, methodProperties);
  }

  try {
    const response = await fetch(NOVA_POSHTA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: API_KEY,
        modelName,
        calledMethod,
        methodProperties,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Nova Poshta API error:', error);
    // Fallback to mock data on error
    return getMockResponse<T>(modelName, calledMethod, methodProperties);
  }
}

function getMockResponse<T>(
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, unknown>
): NovaPoshtaApiResponse<T> {
  // Mock responses based on API call
  if (modelName === 'Address' && calledMethod === 'getCities') {
    const searchString = (methodProperties.FindByString as string || '').toLowerCase();
    const cities = MOCK_CITIES.filter(
      city => city.Description.toLowerCase().includes(searchString) ||
              city.DescriptionRu.toLowerCase().includes(searchString)
    );
    return {
      success: true,
      data: cities as unknown as T[],
      errors: [],
      warnings: [],
      info: { totalCount: cities.length },
    };
  }

  if (modelName === 'Address' && calledMethod === 'getWarehouses') {
    const cityRef = methodProperties.CityRef as string;
    const city = MOCK_CITIES.find(c => c.Ref === cityRef);
    const warehouses = city ? createMockWarehouses(cityRef, city.Description) : [];
    return {
      success: true,
      data: warehouses as unknown as T[],
      errors: [],
      warnings: [],
      info: { totalCount: warehouses.length },
    };
  }

  if (modelName === 'InternetDocument' && calledMethod === 'getDocumentPrice') {
    const price: NovaPoshtaDeliveryPrice = {
      Cost: 75,
      AssessedCost: methodProperties.Cost as number || 1000,
      CostRedelivery: 20,
      TZoneFrom: '1',
      TZoneTo: '1',
    };
    return {
      success: true,
      data: [price] as unknown as T[],
      errors: [],
      warnings: [],
      info: {},
    };
  }

  if (modelName === 'TrackingDocument' && calledMethod === 'getStatusDocuments') {
    const documents = (methodProperties.Documents as Array<{ DocumentNumber: string }>) || [];
    const tracking: NovaPoshtaTrackingDocument[] = documents.map(doc => ({
      StatusCode: '9',
      Status: 'Відправлення отримано',
      Number: doc.DocumentNumber,
      Redelivery: 0,
      RedeliverySum: 0,
      RedeliveryNum: '',
      RedeliveryPayer: '',
      OwnerDocumentType: '',
      LastCreatedOnTheBasisDocumentType: '',
      LastCreatedOnTheBasisPayerType: '',
      LastCreatedOnTheBasisDateTime: '',
      LastTransactionStatusGM: '',
      LastTransactionDateTimeGM: '',
      DateCreated: new Date().toISOString(),
      DocumentWeight: '0.5',
      CheckWeight: '0.5',
      DocumentCost: '75',
      SumBeforeCheckWeight: 0,
      PayerType: 'Sender',
      RecipientFullName: 'Тестовий Отримувач',
      RecipientDateTime: new Date().toISOString(),
      ScheduledDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      PaymentMethod: 'Cash',
      CargoDescriptionString: 'Товари',
      CargoType: 'Parcel',
      CitySender: 'Київ',
      CityRecipient: 'Львів',
      WarehouseRecipient: 'Відділення №1',
      CounterpartyType: 'PrivatePerson',
      AfterpaymentOnGoodsCost: '0',
      ServiceType: 'WarehouseWarehouse',
      UndeliveryReasonsSubtypeDescription: '',
      WarehouseRecipientNumber: 1,
      LastCreatedOnTheBasisNumber: '',
      PhoneRecipient: '+380991234567',
      RecipientFullNameEW: '',
      WarehouseRecipientInternetAddressRef: '',
      MarketplacePartnerToken: '',
      ClientBarcode: '',
      RecipientAddress: 'Львів, Відділення №1',
      CounterpartySenderDescription: 'MyShop',
      CounterpartyRecipientDescription: 'Тестовий Отримувач',
      CounterpartySenderType: 'Organization',
      DateScan: new Date().toISOString(),
      PaymentStatus: 'Paid',
      PaymentStatusDate: new Date().toISOString(),
      AmountToPay: '0',
      AmountPaid: '75',
      RefEW: '',
      BackwardDeliverySubTypesActions: '',
      BackwardDeliverySubTypesServices: '',
      UndeliveryReasons: '',
      DatePayedKeeping: '',
    }));
    return {
      success: true,
      data: tracking as unknown as T[],
      errors: [],
      warnings: [],
      info: {},
    };
  }

  return {
    success: false,
    data: [],
    errors: ['Unknown API call'],
    warnings: [],
    info: {},
  };
}

// Public API Functions

/**
 * Search cities by name
 */
export async function searchCities(query: string): Promise<NovaPoshtaCity[]> {
  const response = await callNovaPoshtaApi<NovaPoshtaCity>('Address', 'getCities', {
    FindByString: query,
    Limit: 20,
  });

  if (!response.success) {
    console.error('Failed to search cities:', response.errors);
    return [];
  }

  return response.data;
}

/**
 * Get all cities (first load)
 */
export async function getCities(): Promise<NovaPoshtaCity[]> {
  const response = await callNovaPoshtaApi<NovaPoshtaCity>('Address', 'getCities', {
    Limit: 50,
  });

  if (!response.success) {
    console.error('Failed to get cities:', response.errors);
    return [];
  }

  return response.data;
}

/**
 * Get warehouses by city
 */
export async function getWarehouses(cityRef: string): Promise<NovaPoshtaWarehouse[]> {
  const response = await callNovaPoshtaApi<NovaPoshtaWarehouse>('Address', 'getWarehouses', {
    CityRef: cityRef,
    Limit: 100,
  });

  if (!response.success) {
    console.error('Failed to get warehouses:', response.errors);
    return [];
  }

  return response.data;
}

/**
 * Search warehouses by city and query
 */
export async function searchWarehouses(cityRef: string, query: string): Promise<NovaPoshtaWarehouse[]> {
  const response = await callNovaPoshtaApi<NovaPoshtaWarehouse>('Address', 'getWarehouses', {
    CityRef: cityRef,
    FindByString: query,
    Limit: 50,
  });

  if (!response.success) {
    console.error('Failed to search warehouses:', response.errors);
    return [];
  }

  return response.data;
}

/**
 * Calculate delivery price
 */
export async function calculateDeliveryPrice(
  citySender: string,
  cityRecipient: string,
  weight: number,
  cost: number,
  serviceType: 'WarehouseWarehouse' | 'WarehouseDoors' | 'DoorsWarehouse' | 'DoorsDoors' = 'WarehouseWarehouse'
): Promise<NovaPoshtaDeliveryPrice | null> {
  const response = await callNovaPoshtaApi<NovaPoshtaDeliveryPrice>('InternetDocument', 'getDocumentPrice', {
    CitySender: citySender,
    CityRecipient: cityRecipient,
    Weight: weight.toString(),
    ServiceType: serviceType,
    Cost: cost.toString(),
    CargoType: 'Parcel',
    SeatsAmount: '1',
  });

  if (!response.success || response.data.length === 0) {
    console.error('Failed to calculate delivery price:', response.errors);
    return null;
  }

  return response.data[0];
}

/**
 * Track shipment by tracking number
 */
export async function trackShipment(trackingNumber: string): Promise<NovaPoshtaTrackingDocument | null> {
  const response = await callNovaPoshtaApi<NovaPoshtaTrackingDocument>('TrackingDocument', 'getStatusDocuments', {
    Documents: [{ DocumentNumber: trackingNumber }],
  });

  if (!response.success || response.data.length === 0) {
    console.error('Failed to track shipment:', response.errors);
    return null;
  }

  return response.data[0];
}

/**
 * Get delivery status text in Ukrainian
 */
export function getDeliveryStatusText(statusCode: string): string {
  const statuses: Record<string, string> = {
    '1': 'Відправлення створено',
    '2': 'Видалено',
    '3': 'Номер не знайдено',
    '4': 'Відправлення у місті відправника',
    '5': 'Відправлення прямує до міста одержувача',
    '6': 'Відправлення у місті одержувача',
    '7': 'Відправлення прибуло на відділення',
    '8': 'Відправлення прибуло на відділення (із затримкою)',
    '9': 'Відправлення отримано',
    '10': 'Відправлення отримано (з післяплатою)',
    '11': 'Відправлення отримано (наложений платіж не сплачено)',
    '12': 'Відправлення повертається відправнику',
    '14': 'Відправлення очікує на повернення',
    '41': 'Відправлення готове до видачі з поштомату',
    '101': 'Відправлення на складі відправника',
    '102': 'Відправлення передано на відправку',
    '103': 'Відправлення в дорозі',
    '104': 'Зміна адреси',
    '105': 'Припинення зберігання',
    '106': 'Отримання відправлення',
    '111': 'Невдала спроба доставки',
    '112': 'Дата доставки змінена за бажанням одержувача',
  };

  return statuses[statusCode] || 'Невідомий статус';
}

// Delivery price constants
export const DELIVERY_PRICES = {
  NOVA_POSHTA_WAREHOUSE: { min: 55, perKg: 15 },
  NOVA_POSHTA_COURIER: { min: 80, perKg: 20 },
  UKRPOSHTA: { min: 35, perKg: 10 },
  FREE_DELIVERY_THRESHOLD: 1000,
};

/**
 * Calculate estimated delivery price (simple calculation)
 */
export function estimateDeliveryPrice(
  deliveryType: 'warehouse' | 'courier' | 'ukrposhta',
  cartTotal: number,
  weight: number = 1
): number {
  // Free delivery for orders over threshold
  if (cartTotal >= DELIVERY_PRICES.FREE_DELIVERY_THRESHOLD) {
    return 0;
  }

  switch (deliveryType) {
    case 'warehouse':
      return Math.max(
        DELIVERY_PRICES.NOVA_POSHTA_WAREHOUSE.min,
        DELIVERY_PRICES.NOVA_POSHTA_WAREHOUSE.perKg * weight
      );
    case 'courier':
      return Math.max(
        DELIVERY_PRICES.NOVA_POSHTA_COURIER.min,
        DELIVERY_PRICES.NOVA_POSHTA_COURIER.perKg * weight
      );
    case 'ukrposhta':
      return Math.max(
        DELIVERY_PRICES.UKRPOSHTA.min,
        DELIVERY_PRICES.UKRPOSHTA.perKg * weight
      );
    default:
      return DELIVERY_PRICES.NOVA_POSHTA_WAREHOUSE.min;
  }
}
