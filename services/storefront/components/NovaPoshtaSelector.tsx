'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  searchCities,
  getWarehouses,
  NovaPoshtaCity,
  NovaPoshtaWarehouse,
  estimateDeliveryPrice,
  DELIVERY_PRICES,
} from '@/lib/nova-poshta';
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  BuildingStorefrontIcon,
  TruckIcon,
  CheckIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

export interface DeliverySelection {
  type: 'warehouse' | 'courier' | 'ukrposhta';
  city: NovaPoshtaCity | null;
  warehouse: NovaPoshtaWarehouse | null;
  address?: string;
  price: number;
}

interface NovaPoshtaSelectorProps {
  cartTotal: number;
  onSelectionChange: (selection: DeliverySelection) => void;
  initialSelection?: DeliverySelection;
}

export default function NovaPoshtaSelector({
  cartTotal,
  onSelectionChange,
  initialSelection,
}: NovaPoshtaSelectorProps) {
  const [deliveryType, setDeliveryType] = useState<'warehouse' | 'courier' | 'ukrposhta'>(
    initialSelection?.type || 'warehouse'
  );
  const [citySearch, setCitySearch] = useState('');
  const [warehouseSearch, setWarehouseSearch] = useState('');
  const [cities, setCities] = useState<NovaPoshtaCity[]>([]);
  const [warehouses, setWarehouses] = useState<NovaPoshtaWarehouse[]>([]);
  const [selectedCity, setSelectedCity] = useState<NovaPoshtaCity | null>(
    initialSelection?.city || null
  );
  const [selectedWarehouse, setSelectedWarehouse] = useState<NovaPoshtaWarehouse | null>(
    initialSelection?.warehouse || null
  );
  const [courierAddress, setCourierAddress] = useState(initialSelection?.address || '');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);

  const isFreeDelivery = cartTotal >= DELIVERY_PRICES.FREE_DELIVERY_THRESHOLD;

  // Search cities with debounce
  useEffect(() => {
    if (citySearch.length < 2) {
      setCities([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoadingCities(true);
      const results = await searchCities(citySearch);
      setCities(results);
      setIsLoadingCities(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [citySearch]);

  // Load warehouses when city selected
  useEffect(() => {
    if (!selectedCity) {
      setWarehouses([]);
      return;
    }

    const loadWarehouses = async () => {
      setIsLoadingWarehouses(true);
      const results = await getWarehouses(selectedCity.Ref);
      setWarehouses(results);
      setIsLoadingWarehouses(false);
    };

    loadWarehouses();
  }, [selectedCity]);

  // Filter warehouses by search
  const filteredWarehouses = warehouseSearch
    ? warehouses.filter(
        w =>
          w.Description.toLowerCase().includes(warehouseSearch.toLowerCase()) ||
          w.Number.includes(warehouseSearch)
      )
    : warehouses;

  // Calculate delivery price
  const deliveryPrice = estimateDeliveryPrice(deliveryType, cartTotal);

  // Notify parent of selection changes
  const updateSelection = useCallback(() => {
    const selection: DeliverySelection = {
      type: deliveryType,
      city: selectedCity,
      warehouse: deliveryType === 'warehouse' ? selectedWarehouse : null,
      address: deliveryType === 'courier' ? courierAddress : undefined,
      price: deliveryPrice,
    };
    onSelectionChange(selection);
  }, [deliveryType, selectedCity, selectedWarehouse, courierAddress, deliveryPrice, onSelectionChange]);

  useEffect(() => {
    updateSelection();
  }, [updateSelection]);

  const handleCitySelect = (city: NovaPoshtaCity) => {
    setSelectedCity(city);
    setCitySearch(city.Description);
    setShowCityDropdown(false);
    setSelectedWarehouse(null);
    setWarehouseSearch('');
  };

  const handleWarehouseSelect = (warehouse: NovaPoshtaWarehouse) => {
    setSelectedWarehouse(warehouse);
    setWarehouseSearch(warehouse.Description);
    setShowWarehouseDropdown(false);
  };

  return (
    <div className="space-y-6">
      {/* Delivery Type Selection */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Спосіб доставки</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Nova Poshta Warehouse */}
          <button
            onClick={() => setDeliveryType('warehouse')}
            className={`relative p-4 rounded-xl border-2 transition-all text-left ${
              deliveryType === 'warehouse'
                ? 'border-teal-500 bg-teal-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {deliveryType === 'warehouse' && (
              <div className="absolute top-2 right-2">
                <CheckIcon className="w-5 h-5 text-teal-600" />
              </div>
            )}
            <BuildingStorefrontIcon className="w-8 h-8 text-teal-600 mb-2" />
            <h4 className="font-semibold text-gray-900">Нова Пошта</h4>
            <p className="text-sm text-gray-500">На відділення</p>
            <p className="text-sm font-medium text-teal-600 mt-2">
              {isFreeDelivery ? 'Безкоштовно' : `від ${DELIVERY_PRICES.NOVA_POSHTA_WAREHOUSE.min} грн`}
            </p>
          </button>

          {/* Nova Poshta Courier */}
          <button
            onClick={() => setDeliveryType('courier')}
            className={`relative p-4 rounded-xl border-2 transition-all text-left ${
              deliveryType === 'courier'
                ? 'border-teal-500 bg-teal-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {deliveryType === 'courier' && (
              <div className="absolute top-2 right-2">
                <CheckIcon className="w-5 h-5 text-teal-600" />
              </div>
            )}
            <TruckIcon className="w-8 h-8 text-orange-500 mb-2" />
            <h4 className="font-semibold text-gray-900">Кур'єр</h4>
            <p className="text-sm text-gray-500">Нова Пошта</p>
            <p className="text-sm font-medium text-teal-600 mt-2">
              {isFreeDelivery ? 'Безкоштовно' : `від ${DELIVERY_PRICES.NOVA_POSHTA_COURIER.min} грн`}
            </p>
          </button>

          {/* Ukrposhta */}
          <button
            onClick={() => setDeliveryType('ukrposhta')}
            className={`relative p-4 rounded-xl border-2 transition-all text-left ${
              deliveryType === 'ukrposhta'
                ? 'border-teal-500 bg-teal-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {deliveryType === 'ukrposhta' && (
              <div className="absolute top-2 right-2">
                <CheckIcon className="w-5 h-5 text-teal-600" />
              </div>
            )}
            <MapPinIcon className="w-8 h-8 text-blue-500 mb-2" />
            <h4 className="font-semibold text-gray-900">Укрпошта</h4>
            <p className="text-sm text-gray-500">На відділення</p>
            <p className="text-sm font-medium text-teal-600 mt-2">
              {isFreeDelivery ? 'Безкоштовно' : `від ${DELIVERY_PRICES.UKRPOSHTA.min} грн`}
            </p>
          </button>
        </div>

        {isFreeDelivery && (
          <p className="mt-3 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
            Безкоштовна доставка при замовленні від {DELIVERY_PRICES.FREE_DELIVERY_THRESHOLD} грн
          </p>
        )}
      </div>

      {/* City Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Місто
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={citySearch}
            onChange={(e) => {
              setCitySearch(e.target.value);
              setShowCityDropdown(true);
              if (e.target.value !== selectedCity?.Description) {
                setSelectedCity(null);
                setSelectedWarehouse(null);
              }
            }}
            onFocus={() => citySearch.length >= 2 && setShowCityDropdown(true)}
            placeholder="Введіть назву міста..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {isLoadingCities && (
              <div className="animate-spin h-5 w-5 border-2 border-teal-500 border-t-transparent rounded-full" />
            )}
          </div>

          {/* City Dropdown */}
          {showCityDropdown && cities.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
              {cities.map((city) => (
                <button
                  key={city.Ref}
                  onClick={() => handleCitySelect(city)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 last:border-0"
                >
                  <MapPinIcon className="w-5 h-5 text-gray-400" />
                  <div>
                    <span className="font-medium text-gray-900">{city.Description}</span>
                    <span className="text-sm text-gray-500 ml-2">{city.AreaDescription} обл.</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Warehouse Selection (for warehouse delivery) */}
      {deliveryType === 'warehouse' && selectedCity && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Відділення Нової Пошти
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <BuildingStorefrontIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={warehouseSearch}
              onChange={(e) => {
                setWarehouseSearch(e.target.value);
                setShowWarehouseDropdown(true);
                if (e.target.value !== selectedWarehouse?.Description) {
                  setSelectedWarehouse(null);
                }
              }}
              onFocus={() => setShowWarehouseDropdown(true)}
              placeholder="Введіть номер або адресу відділення..."
              className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <button
              onClick={() => setShowWarehouseDropdown(!showWarehouseDropdown)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform ${showWarehouseDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Warehouse Dropdown */}
            {showWarehouseDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                {isLoadingWarehouses ? (
                  <div className="px-4 py-8 text-center">
                    <div className="animate-spin h-8 w-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
                    <p className="text-gray-500 mt-2">Завантаження...</p>
                  </div>
                ) : filteredWarehouses.length > 0 ? (
                  filteredWarehouses.map((warehouse) => (
                    <button
                      key={warehouse.Ref}
                      onClick={() => handleWarehouseSelect(warehouse)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start gap-3 border-b border-gray-100 last:border-0 ${
                        selectedWarehouse?.Ref === warehouse.Ref ? 'bg-teal-50' : ''
                      }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {warehouse.TypeOfWarehouse === 'Postomat' ? (
                          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                            <span className="text-sm">📦</span>
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                            <BuildingStorefrontIcon className="w-5 h-5 text-teal-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {warehouse.Description}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {warehouse.ShortAddress}
                        </p>
                        {warehouse.TypeOfWarehouse === 'Postomat' && (
                          <span className="inline-block mt-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                            Поштомат
                          </span>
                        )}
                      </div>
                      {selectedWarehouse?.Ref === warehouse.Ref && (
                        <CheckIcon className="w-5 h-5 text-teal-600 flex-shrink-0" />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-gray-500">
                    Відділення не знайдено
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Warehouse Info */}
          {selectedWarehouse && (
            <div className="mt-3 p-4 bg-teal-50 rounded-xl">
              <div className="flex items-start gap-3">
                <CheckIcon className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">{selectedWarehouse.Description}</p>
                  <p className="text-sm text-gray-600">{selectedWarehouse.ShortAddress}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Графік: {selectedWarehouse.Schedule?.Monday || '08:00-20:00'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Courier Address (for courier delivery) */}
      {deliveryType === 'courier' && selectedCity && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Адреса доставки
          </label>
          <textarea
            value={courierAddress}
            onChange={(e) => setCourierAddress(e.target.value)}
            placeholder="Вулиця, номер будинку, квартира..."
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
          />
          <p className="text-sm text-gray-500 mt-2">
            Кур'єр зв'яжеться з вами для уточнення часу доставки
          </p>
        </div>
      )}

      {/* Ukrposhta Notice */}
      {deliveryType === 'ukrposhta' && selectedCity && (
        <div className="p-4 bg-blue-50 rounded-xl">
          <p className="text-sm text-blue-800">
            Для доставки Укрпоштою ми надішлемо відправлення на найближче відділення
            у вашому місті. Номер відділення буде вказано в SMS-повідомленні.
          </p>
        </div>
      )}

      {/* Delivery Summary */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Вартість доставки:</span>
          <span className="text-lg font-semibold text-gray-900">
            {isFreeDelivery ? (
              <span className="text-green-600">Безкоштовно</span>
            ) : (
              `${deliveryPrice} грн`
            )}
          </span>
        </div>
        {!isFreeDelivery && (
          <p className="text-sm text-gray-500 mt-1">
            Безкоштовна доставка при замовленні від {DELIVERY_PRICES.FREE_DELIVERY_THRESHOLD} грн
          </p>
        )}
      </div>
    </div>
  );
}
