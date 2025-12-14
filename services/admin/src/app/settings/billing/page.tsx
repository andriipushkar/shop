'use client';

import { useState, useEffect } from 'react';
import { PaymentMethodModal } from '@/components/billing/PaymentMethodModal';
import { PlanSelector } from '@/components/billing/PlanSelector';
import { InvoiceList } from '@/components/billing/InvoiceList';
import { UsageStats } from '@/components/billing/UsageStats';

interface Subscription {
  id: string;
  plan_id: string;
  plan_name: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  payment_method?: {
    type: 'card' | 'liqpay';
    last4?: string;
    brand?: string;
    exp_month?: number;
    exp_year?: number;
  };
}

interface Usage {
  products: { used: number; limit: number };
  orders: { used: number; limit: number };
  storage: { used: number; limit: number };
  api_calls: { used: number; limit: number };
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const [subRes, usageRes] = await Promise.all([
        fetch('/api/billing/subscription'),
        fetch('/api/billing/usage'),
      ]);

      if (subRes.ok) {
        setSubscription(await subRes.json());
      }
      if (usageRes.ok) {
        setUsage(await usageRes.json());
      }
    } catch (err) {
      console.error('Failed to fetch billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access at the end of the billing period.')) {
      return;
    }

    setActionLoading(true);
    try {
      await fetch('/api/billing/subscription', { method: 'DELETE' });
      fetchBillingData();
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    setActionLoading(true);
    try {
      await fetch('/api/billing/subscription/reactivate', { method: 'POST' });
      fetchBillingData();
    } catch (err) {
      console.error('Failed to reactivate subscription:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <SpinnerIcon />
      </div>
    );
  }

  const isBlocked = subscription?.status === 'past_due';

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Alert for past due */}
      {isBlocked && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertIcon className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-400">
                Payment Past Due
              </h3>
              <p className="text-red-700 dark:text-red-300 mt-1">
                Your payment is overdue. Please update your payment method to restore access to your store.
                API access has been restricted.
              </p>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Update Payment Method
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Billing & Subscription
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage your subscription plan and payment methods
        </p>
      </div>

      {/* Current Plan Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {subscription?.plan_name || 'Free'} Plan
              </h2>
              {getStatusBadge(subscription?.status || 'active')}
            </div>

            {subscription && (
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {subscription.cancel_at_period_end ? (
                  <span className="text-orange-600 dark:text-orange-400">
                    Cancels on {formatDate(subscription.current_period_end)}
                  </span>
                ) : (
                  <>
                    Renews on {formatDate(subscription.current_period_end)}
                  </>
                )}
              </div>
            )}

            {subscription?.payment_method && (
              <div className="mt-3 flex items-center gap-2">
                <CardIcon brand={subscription.payment_method.brand} />
                <span className="text-gray-700 dark:text-gray-300">
                  •••• {subscription.payment_method.last4}
                </span>
                <span className="text-gray-500 dark:text-gray-400 text-sm">
                  Expires {subscription.payment_method.exp_month}/{subscription.payment_method.exp_year}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowPaymentModal(true)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {subscription?.payment_method ? 'Update Payment' : 'Add Payment Method'}
            </button>

            <button
              onClick={() => setShowPlanModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {subscription ? 'Change Plan' : 'Upgrade'}
            </button>

            {subscription && !subscription.cancel_at_period_end && (
              <button
                onClick={handleCancelSubscription}
                disabled={actionLoading}
                className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
            )}

            {subscription?.cancel_at_period_end && (
              <button
                onClick={handleReactivate}
                disabled={actionLoading}
                className="px-4 py-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg disabled:opacity-50"
              >
                Reactivate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Usage Stats */}
      {usage && <UsageStats usage={usage} />}

      {/* Invoices */}
      <InvoiceList />

      {/* Modals */}
      {showPaymentModal && (
        <PaymentMethodModal
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            fetchBillingData();
          }}
        />
      )}

      {showPlanModal && (
        <PlanSelector
          currentPlan={subscription?.plan_id}
          onClose={() => setShowPlanModal(false)}
          onSuccess={() => {
            setShowPlanModal(false);
            fetchBillingData();
          }}
        />
      )}
    </div>
  );
}

function getStatusBadge(status: Subscription['status']) {
  const styles = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    trialing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    past_due: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    canceled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400',
  };
  const labels = {
    active: 'Active',
    trialing: 'Trial',
    past_due: 'Past Due',
    canceled: 'Canceled',
  };
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function SpinnerIcon() {
  return (
    <svg className="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function CardIcon({ brand }: { brand?: string }) {
  // Simple card icon - in production would show Visa/Mastercard logos
  return (
    <div className="w-8 h-5 bg-gradient-to-r from-gray-700 to-gray-500 rounded flex items-center justify-center">
      <span className="text-white text-[8px] font-bold">
        {brand?.toUpperCase().slice(0, 4) || 'CARD'}
      </span>
    </div>
  );
}
