'use client';

import { useState } from 'react';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type PaymentProvider = 'liqpay' | 'stripe' | 'fondy';

export function PaymentMethodModal({ onClose, onSuccess }: Props) {
  const [provider, setProvider] = useState<PaymentProvider>('liqpay');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Card form state (for Stripe)
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (provider === 'liqpay') {
        // Redirect to LiqPay checkout
        const res = await fetch('/api/billing/liqpay/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ return_url: window.location.href }),
        });

        if (!res.ok) throw new Error('Failed to create checkout session');

        const { checkout_url } = await res.json();
        window.location.href = checkout_url;
        return;
      }

      if (provider === 'stripe') {
        // In production, use Stripe Elements
        const res = await fetch('/api/billing/stripe/add-payment-method', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            card_number: cardNumber.replace(/\s/g, ''),
            exp_month: parseInt(expiry.split('/')[0]),
            exp_year: parseInt('20' + expiry.split('/')[1]),
            cvc,
            name,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to add payment method');
        }

        onSuccess();
        return;
      }

      if (provider === 'fondy') {
        // Redirect to Fondy checkout
        const res = await fetch('/api/billing/fondy/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ return_url: window.location.href }),
        });

        if (!res.ok) throw new Error('Failed to create checkout session');

        const { checkout_url } = await res.json();
        window.location.href = checkout_url;
        return;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 16);
    const parts = [];
    for (let i = 0; i < v.length; i += 4) {
      parts.push(v.slice(i, i + 4));
    }
    return parts.join(' ');
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 2) {
      return v.slice(0, 2) + '/' + v.slice(2);
    }
    return v;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Payment Method
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XIcon />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Provider Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Choose Payment Provider
            </label>
            <div className="grid grid-cols-3 gap-3">
              <ProviderButton
                provider="liqpay"
                selected={provider === 'liqpay'}
                onClick={() => setProvider('liqpay')}
                logo="/logos/liqpay.svg"
                name="LiqPay"
              />
              <ProviderButton
                provider="stripe"
                selected={provider === 'stripe'}
                onClick={() => setProvider('stripe')}
                logo="/logos/stripe.svg"
                name="Stripe"
              />
              <ProviderButton
                provider="fondy"
                selected={provider === 'fondy'}
                onClick={() => setProvider('fondy')}
                logo="/logos/fondy.svg"
                name="Fondy"
              />
            </div>
          </div>

          {/* LiqPay / Fondy - Redirect flow */}
          {(provider === 'liqpay' || provider === 'fondy') && (
            <div className="text-center py-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  You will be redirected to {provider === 'liqpay' ? 'LiqPay' : 'Fondy'} to securely add your payment method.
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <SpinnerIcon /> : <LockIcon />}
                Continue to {provider === 'liqpay' ? 'LiqPay' : 'Fondy'}
              </button>
            </div>
          )}

          {/* Stripe - Card form */}
          {provider === 'stripe' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="JOHN DOE"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Card Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white pl-12"
                    placeholder="4242 4242 4242 4242"
                    required
                  />
                  <CardIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="MM/YY"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    CVC
                  </label>
                  <input
                    type="text"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="123"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !cardNumber || !expiry || !cvc || !name}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <SpinnerIcon /> : <LockIcon />}
                Add Card
              </button>
            </div>
          )}

          {/* Security note */}
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center flex items-center justify-center gap-1">
            <LockIcon className="w-3 h-3" />
            Your payment info is encrypted and secure
          </p>
        </form>
      </div>
    </div>
  );
}

function ProviderButton({
  provider,
  selected,
  onClick,
  logo,
  name,
}: {
  provider: string;
  selected: boolean;
  onClick: () => void;
  logo: string;
  name: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        p-3 border-2 rounded-lg transition-all flex flex-col items-center gap-2
        ${selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
        }
      `}
    >
      <div className="h-6 flex items-center justify-center">
        {/* In production, use actual logos */}
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
          {name}
        </span>
      </div>
    </button>
  );
}

function XIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function LockIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function CardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
