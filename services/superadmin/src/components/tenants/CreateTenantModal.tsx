'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';

interface CreateTenantForm {
  storeName: string;
  storeSlug: string;
  ownerEmail: string;
  ownerName: string;
  ownerPhone: string;
  planId: string;
  billingPeriod: 'monthly' | 'yearly';
  promoCode?: string;
  customDomain?: string;
  sendWelcomeEmail: boolean;
}

interface Props {
  onClose: () => void;
}

type ProvisioningStep =
  | 'idle'
  | 'validating'
  | 'creating_user'
  | 'creating_tenant'
  | 'provisioning_dns'
  | 'requesting_ssl'
  | 'creating_subscription'
  | 'sending_email'
  | 'completed'
  | 'error';

const STEPS_LABELS: Record<ProvisioningStep, string> = {
  idle: 'Ready',
  validating: 'Validating input...',
  creating_user: 'Creating owner account...',
  creating_tenant: 'Creating tenant in database...',
  provisioning_dns: 'Provisioning DNS subdomain...',
  requesting_ssl: 'Requesting SSL certificate...',
  creating_subscription: 'Setting up subscription...',
  sending_email: 'Sending welcome email...',
  completed: 'Tenant created successfully!',
  error: 'Error occurred',
};

export function CreateTenantModal({ onClose }: Props) {
  const [step, setStep] = useState<ProvisioningStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateTenantForm>({
    defaultValues: {
      planId: 'starter',
      billingPeriod: 'monthly',
      sendWelcomeEmail: true,
    },
  });

  const storeName = watch('storeName');
  const storeSlug = watch('storeSlug');

  // Auto-generate slug from store name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleStoreNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const slug = generateSlug(name);
    setValue('storeSlug', slug);
    checkSlugAvailability(slug);
  };

  const checkSlugAvailability = async (slug: string) => {
    if (!slug || slug.length < 3) {
      setSlugAvailable(null);
      return;
    }

    setCheckingSlug(true);
    try {
      const res = await fetch(`/api/onboarding/check-slug?slug=${slug}`);
      const data = await res.json();
      setSlugAvailable(data.available);
    } catch {
      setSlugAvailable(null);
    } finally {
      setCheckingSlug(false);
    }
  };

  const onSubmit = async (data: CreateTenantForm) => {
    setError(null);

    try {
      // Step 1: Validate
      setStep('validating');
      await simulateDelay(500);

      // Step 2: Create user
      setStep('creating_user');
      await simulateDelay(800);

      // Step 3: Create tenant
      setStep('creating_tenant');
      const response = await fetch('/api/superadmin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_email: data.ownerEmail,
          owner_name: data.ownerName,
          owner_phone: data.ownerPhone,
          owner_password: generateTempPassword(), // Will be reset via email
          store_name: data.storeName,
          store_slug: data.storeSlug,
          plan_id: data.planId,
          billing_period: data.billingPeriod,
          promo_code: data.promoCode,
          custom_domain: data.customDomain,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create tenant');
      }

      const tenantResult = await response.json();

      // Step 4: DNS provisioning (done by backend)
      setStep('provisioning_dns');
      await simulateDelay(1500);

      // Step 5: SSL certificate (done by backend)
      setStep('requesting_ssl');
      await simulateDelay(1000);

      // Step 6: Create subscription
      setStep('creating_subscription');
      await simulateDelay(800);

      // Step 7: Send welcome email
      if (data.sendWelcomeEmail) {
        setStep('sending_email');
        await fetch('/api/superadmin/send-welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: data.ownerEmail,
            tenant_id: tenantResult.tenant_id,
            temp_password: tenantResult.temp_password,
          }),
        });
      }

      // Complete
      setStep('completed');
      setResult(tenantResult);

    } catch (err: any) {
      setStep('error');
      setError(err.message);
    }
  };

  const simulateDelay = (ms: number) => new Promise(r => setTimeout(r, ms));

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Create New Tenant (Zero-touch)
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            <XIcon />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'completed' ? (
            <SuccessView result={result} onClose={onClose} />
          ) : step !== 'idle' && step !== 'error' ? (
            <ProvisioningProgress step={step} />
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Store Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Store Information
                </h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Store Name *
                  </label>
                  <input
                    {...register('storeName', { required: 'Store name is required' })}
                    onChange={handleStoreNameChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="My Awesome Store"
                  />
                  {errors.storeName && (
                    <p className="text-red-500 text-sm mt-1">{errors.storeName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Store Slug (subdomain) *
                  </label>
                  <div className="flex items-center">
                    <input
                      {...register('storeSlug', {
                        required: 'Slug is required',
                        pattern: {
                          value: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
                          message: 'Only lowercase letters, numbers, and hyphens',
                        },
                        minLength: { value: 3, message: 'Minimum 3 characters' },
                      })}
                      onChange={(e) => checkSlugAvailability(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="my-awesome-store"
                    />
                    <span className="px-4 py-2 bg-gray-100 dark:bg-gray-600 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-lg text-gray-600 dark:text-gray-300">
                      .shop.com
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {checkingSlug && (
                      <span className="text-gray-500 text-sm">Checking...</span>
                    )}
                    {!checkingSlug && slugAvailable === true && (
                      <span className="text-green-600 text-sm flex items-center gap-1">
                        <CheckIcon /> Available
                      </span>
                    )}
                    {!checkingSlug && slugAvailable === false && (
                      <span className="text-red-600 text-sm flex items-center gap-1">
                        <XIcon /> Already taken
                      </span>
                    )}
                  </div>
                  {errors.storeSlug && (
                    <p className="text-red-500 text-sm mt-1">{errors.storeSlug.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Custom Domain (optional)
                  </label>
                  <input
                    {...register('customDomain')}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="www.mystore.com"
                  />
                </div>
              </div>

              {/* Owner Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Owner Information
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Owner Name *
                    </label>
                    <input
                      {...register('ownerName', { required: 'Name is required' })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phone
                    </label>
                    <input
                      {...register('ownerPhone')}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="+380991234567"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Owner Email *
                  </label>
                  <input
                    {...register('ownerEmail', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address',
                      },
                    })}
                    type="email"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="owner@example.com"
                  />
                  {errors.ownerEmail && (
                    <p className="text-red-500 text-sm mt-1">{errors.ownerEmail.message}</p>
                  )}
                </div>
              </div>

              {/* Plan Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Subscription Plan
                </h3>

                <div className="grid grid-cols-4 gap-3">
                  {PLANS.map((plan) => (
                    <label
                      key={plan.id}
                      className={`
                        relative p-4 border-2 rounded-lg cursor-pointer transition-all
                        ${watch('planId') === plan.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }
                      `}
                    >
                      <input
                        {...register('planId')}
                        type="radio"
                        value={plan.id}
                        className="sr-only"
                      />
                      <div className="text-center">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {plan.name}
                        </div>
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
                          {plan.price}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {plan.products} products
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      {...register('billingPeriod')}
                      type="radio"
                      value="monthly"
                      className="text-blue-600"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Monthly</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      {...register('billingPeriod')}
                      type="radio"
                      value="yearly"
                      className="text-blue-600"
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      Yearly <span className="text-green-600">(2 months free)</span>
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Promo Code
                  </label>
                  <input
                    {...register('promoCode')}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="LAUNCH50"
                  />
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    {...register('sendWelcomeEmail')}
                    type="checkbox"
                    className="text-blue-600 rounded"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Send welcome email with login credentials
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={slugAvailable === false}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <RocketIcon />
                  Create Tenant
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-components

function ProvisioningProgress({ step }: { step: ProvisioningStep }) {
  const steps: ProvisioningStep[] = [
    'validating',
    'creating_user',
    'creating_tenant',
    'provisioning_dns',
    'requesting_ssl',
    'creating_subscription',
    'sending_email',
  ];

  const currentIndex = steps.indexOf(step);

  return (
    <div className="py-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
          <SpinnerIcon />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Creating Tenant...
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {STEPS_LABELS[step]}
        </p>
      </div>

      <div className="space-y-3">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`flex items-center gap-3 p-3 rounded-lg ${
              i < currentIndex
                ? 'bg-green-50 dark:bg-green-900/20'
                : i === currentIndex
                ? 'bg-blue-50 dark:bg-blue-900/20'
                : 'bg-gray-50 dark:bg-gray-800'
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
              i < currentIndex
                ? 'bg-green-500 text-white'
                : i === currentIndex
                ? 'bg-blue-500 text-white'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}>
              {i < currentIndex ? (
                <CheckIcon />
              ) : i === currentIndex ? (
                <SpinnerIcon className="w-4 h-4" />
              ) : (
                <span className="text-xs">{i + 1}</span>
              )}
            </div>
            <span className={`${
              i <= currentIndex
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-400 dark:text-gray-500'
            }`}>
              {STEPS_LABELS[s]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuccessView({ result, onClose }: { result: any; onClose: () => void }) {
  return (
    <div className="py-8 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
        <CheckCircleIcon />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        Tenant Created Successfully!
      </h3>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        The new store is ready to use
      </p>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-left space-y-3 mb-6">
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Tenant ID:</span>
          <code className="block text-sm font-mono text-gray-900 dark:text-white">
            {result?.tenant_id}
          </code>
        </div>
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Storefront URL:</span>
          <a
            href={result?.storefront_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-blue-600 hover:underline"
          >
            {result?.storefront_url}
          </a>
        </div>
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Admin URL:</span>
          <a
            href={result?.admin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-blue-600 hover:underline"
          >
            {result?.admin_url}
          </a>
        </div>
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">API Key:</span>
          <code className="block text-sm font-mono text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            {result?.api_key}
          </code>
        </div>
      </div>

      <button
        onClick={onClose}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Done
      </button>
    </div>
  );
}

// Icons

function XIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  );
}

function SpinnerIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin text-blue-600`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

// Constants

const PLANS = [
  { id: 'free', name: 'Free', price: '0₴', products: '50' },
  { id: 'starter', name: 'Starter', price: '499₴', products: '500' },
  { id: 'professional', name: 'Pro', price: '1499₴', products: '5,000' },
  { id: 'enterprise', name: 'Enterprise', price: '4999₴', products: 'Unlimited' },
];
