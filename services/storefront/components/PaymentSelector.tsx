'use client';

import { useState, useEffect } from 'react';
import {
  PAYMENT_METHODS,
  PaymentMethodId,
  calculateCODCommission,
  createPaymentFormData,
  getCheckoutUrl,
} from '@/lib/liqpay';
import {
  CreditCardIcon,
  BanknotesIcon,
  TruckIcon,
  CheckIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  BuildingLibraryIcon,
} from '@heroicons/react/24/outline';

export interface PaymentSelection {
  method: PaymentMethodId;
  commission: number;
}

interface PaymentSelectorProps {
  cartTotal: number;
  deliveryPrice: number;
  onSelectionChange: (selection: PaymentSelection) => void;
  initialMethod?: PaymentMethodId;
}

export default function PaymentSelector({
  cartTotal,
  deliveryPrice,
  onSelectionChange,
  initialMethod = 'cash',
}: PaymentSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>(initialMethod);
  const [commission, setCommission] = useState(0);

  // Calculate total
  const total = cartTotal + deliveryPrice;

  // Calculate COD commission if applicable
  useEffect(() => {
    const newCommission = selectedMethod === 'cod' ? calculateCODCommission(total) : 0;
    setCommission(newCommission);
    onSelectionChange({ method: selectedMethod, commission: newCommission });
  }, [selectedMethod, total, onSelectionChange]);

  const getMethodIcon = (methodId: PaymentMethodId) => {
    switch (methodId) {
      case 'liqpay':
        return <CreditCardIcon className="w-6 h-6" />;
      case 'monobank':
        return <BuildingLibraryIcon className="w-6 h-6" />;
      case 'cash':
        return <BanknotesIcon className="w-6 h-6" />;
      case 'cod':
        return <TruckIcon className="w-6 h-6" />;
      default:
        return null;
    }
  };

  const getMethodColor = (methodId: PaymentMethodId) => {
    switch (methodId) {
      case 'liqpay':
        return 'text-green-600';
      case 'monobank':
        return 'text-black';
      case 'cash':
        return 'text-yellow-600';
      case 'cod':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Спосіб оплати</h3>
        <div className="space-y-3">
          {PAYMENT_METHODS.filter(m => m.enabled).map((method) => {
            const isSelected = selectedMethod === method.id;
            const methodCommission = method.id === 'cod' ? calculateCODCommission(total) : 0;

            return (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-start gap-4 ${
                  isSelected
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Icon */}
                <div className={`flex-shrink-0 p-2 rounded-lg bg-white ${getMethodColor(method.id)}`}>
                  {getMethodIcon(method.id)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">{method.name}</h4>
                    {isSelected && (
                      <CheckIcon className="w-5 h-5 text-teal-600 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{method.description}</p>
                  {method.id === 'cod' && (
                    <p className="text-sm text-orange-600 mt-1">
                      Комісія: +{methodCommission} грн
                    </p>
                  )}
                  {method.id === 'liqpay' && (
                    <div className="flex items-center gap-2 mt-2">
                      <img src="/visa.svg" alt="Visa" className="h-6" onError={(e) => e.currentTarget.style.display = 'none'} />
                      <img src="/mastercard.svg" alt="Mastercard" className="h-6" onError={(e) => e.currentTarget.style.display = 'none'} />
                      <span className="text-xs text-gray-400">Google Pay, Apple Pay</span>
                    </div>
                  )}
                  {method.id === 'monobank' && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-black text-white px-2 py-0.5 rounded">mono</span>
                      <span className="text-xs text-gray-400">Оплата частинами</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Security Notice for Card Payment */}
      {selectedMethod === 'liqpay' && (
        <div className="p-4 bg-green-50 rounded-xl border border-green-200">
          <div className="flex items-start gap-3">
            <ShieldCheckIcon className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-green-900">Безпечна оплата</h4>
              <p className="text-sm text-green-700 mt-1">
                Оплата здійснюється через захищений сервіс LiqPay.
                Ми не зберігаємо дані вашої картки.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <LockClosedIcon className="w-4 h-4 text-green-600" />
                <span className="text-xs text-green-600">SSL шифрування 256-bit</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monobank Notice */}
      {selectedMethod === 'monobank' && (
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-start gap-3">
            <BuildingLibraryIcon className="w-6 h-6 text-gray-800 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-gray-900">Monobank Acquiring</h4>
              <p className="text-sm text-gray-700 mt-1">
                Безпечна оплата через Monobank. Підтримується оплата частинами
                до 25 платежів.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <LockClosedIcon className="w-4 h-4 text-gray-600" />
                <span className="text-xs text-gray-600">PCI DSS сертифікація</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COD Commission Notice */}
      {selectedMethod === 'cod' && (
        <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
          <div className="flex items-start gap-3">
            <TruckIcon className="w-6 h-6 text-orange-600 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-orange-900">Накладений платіж</h4>
              <p className="text-sm text-orange-700 mt-1">
                При отриманні посилки ви сплачуєте вартість замовлення + комісію
                Нової Пошти ({commission} грн).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cash Notice */}
      {selectedMethod === 'cash' && (
        <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
          <div className="flex items-start gap-3">
            <BanknotesIcon className="w-6 h-6 text-yellow-600 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-yellow-900">Оплата готівкою</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Оплатіть замовлення готівкою при отриманні у відділенні Нової Пошти.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Payment Summary */}
      <div className="border-t border-gray-200 pt-4 space-y-2">
        <div className="flex justify-between items-center text-gray-600">
          <span>Товари:</span>
          <span>{cartTotal.toLocaleString()} грн</span>
        </div>
        <div className="flex justify-between items-center text-gray-600">
          <span>Доставка:</span>
          <span>{deliveryPrice === 0 ? 'Безкоштовно' : `${deliveryPrice} грн`}</span>
        </div>
        {commission > 0 && (
          <div className="flex justify-between items-center text-orange-600">
            <span>Комісія:</span>
            <span>+{commission} грн</span>
          </div>
        )}
        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
          <span className="text-lg font-semibold text-gray-900">До сплати:</span>
          <span className="text-xl font-bold text-gray-900">
            {(total + commission).toLocaleString()} грн
          </span>
        </div>
      </div>
    </div>
  );
}

// LiqPay Payment Form Component
interface LiqPayFormProps {
  orderId: string;
  amount: number;
  description: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  onSuccess?: () => void;
}

export function LiqPayForm({
  orderId,
  amount,
  description,
  customerEmail,
  customerPhone,
  customerName,
}: LiqPayFormProps) {
  const [formData, setFormData] = useState<{ data: string; signature: string } | null>(null);

  useEffect(() => {
    // Generate form data on client side
    // In production, this should be done server-side for security
    const data = createPaymentFormData({
      orderId,
      amount,
      description,
      customerEmail,
      customerPhone,
      customerName,
    });
    setFormData(data);
  }, [orderId, amount, description, customerEmail, customerPhone, customerName]);

  if (!formData) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <form method="POST" action={getCheckoutUrl()} acceptCharset="utf-8">
      <input type="hidden" name="data" value={formData.data} />
      <input type="hidden" name="signature" value={formData.signature} />
      <button
        type="submit"
        className="w-full py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
      >
        <LockClosedIcon className="w-5 h-5" />
        Оплатити {amount.toLocaleString()} грн
      </button>
    </form>
  );
}
