'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BuildingStorefrontIcon,
  CurrencyDollarIcon,
  TruckIcon,
  BellIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface Settings {
  store: {
    name: string
    email: string
    phone: string
    address: string
    currency: string
    language: string
    timezone: string
  }
  payments: {
    liqpay_enabled: boolean
    liqpay_public_key: string
    cod_enabled: boolean
    cod_fee: number
    prepayment_enabled: boolean
  }
  shipping: {
    nova_poshta_enabled: boolean
    nova_poshta_api_key: string
    ukrposhta_enabled: boolean
    free_shipping_threshold: number
    default_shipping_cost: number
  }
  notifications: {
    email_new_order: boolean
    email_order_status: boolean
    sms_order_status: boolean
    sms_provider: string
  }
  security: {
    two_factor_required: boolean
    session_timeout: number
    ip_whitelist: string
  }
}

const defaultSettings: Settings = {
  store: {
    name: '',
    email: '',
    phone: '',
    address: '',
    currency: 'UAH',
    language: 'uk',
    timezone: 'Europe/Kyiv',
  },
  payments: {
    liqpay_enabled: false,
    liqpay_public_key: '',
    cod_enabled: true,
    cod_fee: 0,
    prepayment_enabled: false,
  },
  shipping: {
    nova_poshta_enabled: false,
    nova_poshta_api_key: '',
    ukrposhta_enabled: false,
    free_shipping_threshold: 0,
    default_shipping_cost: 0,
  },
  notifications: {
    email_new_order: true,
    email_order_status: true,
    sms_order_status: false,
    sms_provider: 'turbosms',
  },
  security: {
    two_factor_required: false,
    session_timeout: 60,
    ip_whitelist: '',
  },
}

type SettingsTab = 'store' | 'payments' | 'shipping' | 'notifications' | 'security'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('store')
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: async () => {
      try {
        return await api.getSettings()
      } catch {
        return defaultSettings
      }
    },
  })

  const [formData, setFormData] = useState<Settings>(settings || defaultSettings)

  const mutation = useMutation({
    mutationFn: (data: Settings) => api.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Settings saved successfully')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  const tabs = [
    { id: 'store', name: 'Store', icon: BuildingStorefrontIcon },
    { id: 'payments', name: 'Payments', icon: CurrencyDollarIcon },
    { id: 'shipping', name: 'Shipping', icon: TruckIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
    { id: 'security', name: 'Security', icon: ShieldCheckIcon },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Configure your store settings</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-56 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-5 h-5 mr-3" />
              {tab.name}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1">
          <form onSubmit={handleSubmit}>
            <div className="card">
              {activeTab === 'store' && (
                <StoreSettings
                  data={formData.store}
                  onChange={(store) => setFormData({ ...formData, store })}
                />
              )}

              {activeTab === 'payments' && (
                <PaymentsSettings
                  data={formData.payments}
                  onChange={(payments) => setFormData({ ...formData, payments })}
                />
              )}

              {activeTab === 'shipping' && (
                <ShippingSettings
                  data={formData.shipping}
                  onChange={(shipping) => setFormData({ ...formData, shipping })}
                />
              )}

              {activeTab === 'notifications' && (
                <NotificationsSettings
                  data={formData.notifications}
                  onChange={(notifications) => setFormData({ ...formData, notifications })}
                />
              )}

              {activeTab === 'security' && (
                <SecuritySettings
                  data={formData.security}
                  onChange={(security) => setFormData({ ...formData, security })}
                />
              )}

              <div className="flex justify-end pt-6 mt-6 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="btn-primary disabled:opacity-50"
                >
                  {mutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function StoreSettings({
  data,
  onChange,
}: {
  data: Settings['store']
  onChange: (data: Settings['store']) => void
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center">
        <BuildingStorefrontIcon className="w-5 h-5 mr-2" />
        Store Information
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Store Name
          </label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            className="input"
            placeholder="My Store"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contact Email
          </label>
          <input
            type="email"
            value={data.email}
            onChange={(e) => onChange({ ...data, email: e.target.value })}
            className="input"
            placeholder="store@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contact Phone
          </label>
          <input
            type="tel"
            value={data.phone}
            onChange={(e) => onChange({ ...data, phone: e.target.value })}
            className="input"
            placeholder="+380501234567"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Currency
          </label>
          <select
            value={data.currency}
            onChange={(e) => onChange({ ...data, currency: e.target.value })}
            className="input"
          >
            <option value="UAH">UAH - Ukrainian Hryvnia</option>
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Language
          </label>
          <select
            value={data.language}
            onChange={(e) => onChange({ ...data, language: e.target.value })}
            className="input"
          >
            <option value="uk">Ukrainian</option>
            <option value="en">English</option>
            <option value="ru">Russian</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Timezone
          </label>
          <select
            value={data.timezone}
            onChange={(e) => onChange({ ...data, timezone: e.target.value })}
            className="input"
          >
            <option value="Europe/Kyiv">Europe/Kyiv (UTC+2/+3)</option>
            <option value="UTC">UTC</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address
        </label>
        <textarea
          value={data.address}
          onChange={(e) => onChange({ ...data, address: e.target.value })}
          className="input"
          rows={3}
          placeholder="Store address..."
        />
      </div>
    </div>
  )
}

function PaymentsSettings({
  data,
  onChange,
}: {
  data: Settings['payments']
  onChange: (data: Settings['payments']) => void
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center">
        <CurrencyDollarIcon className="w-5 h-5 mr-2" />
        Payment Methods
      </h2>

      {/* LiqPay */}
      <div className="p-4 bg-gray-50 rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">LiqPay</h3>
            <p className="text-sm text-gray-500">Accept card payments via LiqPay</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={data.liqpay_enabled}
              onChange={(e) => onChange({ ...data, liqpay_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>
        {data.liqpay_enabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Public Key
            </label>
            <input
              type="text"
              value={data.liqpay_public_key}
              onChange={(e) => onChange({ ...data, liqpay_public_key: e.target.value })}
              className="input"
              placeholder="sandbox_..."
            />
          </div>
        )}
      </div>

      {/* Cash on Delivery */}
      <div className="p-4 bg-gray-50 rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">Cash on Delivery</h3>
            <p className="text-sm text-gray-500">Accept cash payments on delivery</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={data.cod_enabled}
              onChange={(e) => onChange({ ...data, cod_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>
        {data.cod_enabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              COD Fee (UAH)
            </label>
            <input
              type="number"
              value={data.cod_fee}
              onChange={(e) => onChange({ ...data, cod_fee: parseFloat(e.target.value) })}
              className="input w-40"
              min="0"
            />
          </div>
        )}
      </div>

      {/* Prepayment */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">Bank Transfer / Prepayment</h3>
            <p className="text-sm text-gray-500">Accept prepayment to bank account</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={data.prepayment_enabled}
              onChange={(e) => onChange({ ...data, prepayment_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>
      </div>
    </div>
  )
}

function ShippingSettings({
  data,
  onChange,
}: {
  data: Settings['shipping']
  onChange: (data: Settings['shipping']) => void
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center">
        <TruckIcon className="w-5 h-5 mr-2" />
        Shipping Options
      </h2>

      {/* Nova Poshta */}
      <div className="p-4 bg-gray-50 rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">Nova Poshta</h3>
            <p className="text-sm text-gray-500">Integration with Nova Poshta delivery</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={data.nova_poshta_enabled}
              onChange={(e) => onChange({ ...data, nova_poshta_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>
        {data.nova_poshta_enabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <input
              type="password"
              value={data.nova_poshta_api_key}
              onChange={(e) => onChange({ ...data, nova_poshta_api_key: e.target.value })}
              className="input"
              placeholder="Enter API key..."
            />
          </div>
        )}
      </div>

      {/* Ukrposhta */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">Ukrposhta</h3>
            <p className="text-sm text-gray-500">Integration with Ukrposhta delivery</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={data.ukrposhta_enabled}
              onChange={(e) => onChange({ ...data, ukrposhta_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>
      </div>

      {/* Shipping Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Free Shipping Threshold (UAH)
          </label>
          <input
            type="number"
            value={data.free_shipping_threshold}
            onChange={(e) =>
              onChange({ ...data, free_shipping_threshold: parseFloat(e.target.value) })
            }
            className="input"
            min="0"
            placeholder="0 = disabled"
          />
          <p className="text-xs text-gray-500 mt-1">Set to 0 to disable free shipping</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Shipping Cost (UAH)
          </label>
          <input
            type="number"
            value={data.default_shipping_cost}
            onChange={(e) =>
              onChange({ ...data, default_shipping_cost: parseFloat(e.target.value) })
            }
            className="input"
            min="0"
          />
        </div>
      </div>
    </div>
  )
}

function NotificationsSettings({
  data,
  onChange,
}: {
  data: Settings['notifications']
  onChange: (data: Settings['notifications']) => void
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center">
        <BellIcon className="w-5 h-5 mr-2" />
        Notifications
      </h2>

      {/* Email Notifications */}
      <div className="p-4 bg-gray-50 rounded-lg space-y-4">
        <h3 className="font-medium text-gray-900 flex items-center">
          <EnvelopeIcon className="w-4 h-4 mr-2" />
          Email Notifications
        </h3>

        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={data.email_new_order}
              onChange={(e) => onChange({ ...data, email_new_order: e.target.checked })}
              className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="ml-3 text-sm text-gray-700">
              Notify admin on new orders
            </span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={data.email_order_status}
              onChange={(e) => onChange({ ...data, email_order_status: e.target.checked })}
              className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="ml-3 text-sm text-gray-700">
              Send order status updates to customers
            </span>
          </label>
        </div>
      </div>

      {/* SMS Notifications */}
      <div className="p-4 bg-gray-50 rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">SMS Notifications</h3>
            <p className="text-sm text-gray-500">Send SMS updates to customers</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={data.sms_order_status}
              onChange={(e) => onChange({ ...data, sms_order_status: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>

        {data.sms_order_status && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SMS Provider
            </label>
            <select
              value={data.sms_provider}
              onChange={(e) => onChange({ ...data, sms_provider: e.target.value })}
              className="input"
            >
              <option value="turbosms">TurboSMS</option>
              <option value="alphasms">AlphaSMS</option>
              <option value="smsua">SMS.ua</option>
            </select>
          </div>
        )}
      </div>
    </div>
  )
}

function SecuritySettings({
  data,
  onChange,
}: {
  data: Settings['security']
  onChange: (data: Settings['security']) => void
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center">
        <ShieldCheckIcon className="w-5 h-5 mr-2" />
        Security
      </h2>

      <div className="p-4 bg-gray-50 rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">Two-Factor Authentication</h3>
            <p className="text-sm text-gray-500">Require 2FA for all admin users</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={data.two_factor_required}
              onChange={(e) =>
                onChange({ ...data, two_factor_required: e.target.checked })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Session Timeout (minutes)
        </label>
        <input
          type="number"
          value={data.session_timeout}
          onChange={(e) =>
            onChange({ ...data, session_timeout: parseInt(e.target.value) })
          }
          className="input w-40"
          min="5"
          max="1440"
        />
        <p className="text-xs text-gray-500 mt-1">Auto-logout after inactivity</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          IP Whitelist
        </label>
        <textarea
          value={data.ip_whitelist}
          onChange={(e) => onChange({ ...data, ip_whitelist: e.target.value })}
          className="input"
          rows={3}
          placeholder="One IP per line (leave empty to allow all)"
        />
        <p className="text-xs text-gray-500 mt-1">
          Only allow admin access from these IPs
        </p>
      </div>
    </div>
  )
}
