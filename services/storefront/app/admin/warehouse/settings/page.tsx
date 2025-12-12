'use client';

import { useState } from 'react';
import {
  Cog6ToothIcon,
  BellIcon,
  CubeIcon,
  TruckIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  PrinterIcon,
  QrCodeIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

interface MinStockRule {
  id: string;
  category: string;
  minStock: number;
  reorderPoint: number;
  reorderQty: number;
  supplier?: string;
  autoOrder: boolean;
}

// Моковані правила мінімальних залишків
const mockMinStockRules: MinStockRule[] = [
  { id: '1', category: 'Смартфони', minStock: 5, reorderPoint: 10, reorderQty: 20, supplier: 'ТОВ "Електроніка Плюс"', autoOrder: true },
  { id: '2', category: 'Ноутбуки', minStock: 2, reorderPoint: 5, reorderQty: 10, supplier: 'Імпорт Трейд', autoOrder: false },
  { id: '3', category: 'Аксесуари', minStock: 20, reorderPoint: 50, reorderQty: 100, supplier: 'ФОП Коваленко', autoOrder: true },
  { id: '4', category: 'Телевізори', minStock: 1, reorderPoint: 3, reorderQty: 5, autoOrder: false },
  { id: '5', category: 'Навушники', minStock: 10, reorderPoint: 25, reorderQty: 50, supplier: 'ТОВ "Електроніка Плюс"', autoOrder: true },
];

export default function WarehouseSettingsPage() {
  const [minStockRules, setMinStockRules] = useState<MinStockRule[]>(mockMinStockRules);
  const [activeTab, setActiveTab] = useState('general');
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<MinStockRule | null>(null);

  // Загальні налаштування
  const [settings, setSettings] = useState({
    // Загальні
    defaultWarehouse: '1',
    autoReserve: true,
    reserveExpireHours: 48,
    allowNegativeStock: false,

    // Сповіщення
    lowStockNotify: true,
    lowStockEmail: 'admin@myshop.ua',
    expiryNotifyDays: 30,
    notifyOnReceipt: true,
    notifyOnShipment: true,

    // Серійні номери
    requireSerial: false,
    serialCategories: ['Смартфони', 'Ноутбуки', 'Телевізори'],

    // Партії
    requireBatch: false,
    batchCategories: ['Продукти харчування'],
    fifoEnabled: true,

    // Друк
    defaultLabelFormat: 'a4_4x2',
    includeBarcode: true,
    includeLogo: true,
    printerName: '',

    // Авто-замовлення
    autoOrderEnabled: true,
    autoOrderCheckTime: '09:00',
    autoOrderApproval: true,
  });

  const handleEditRule = (rule: MinStockRule) => {
    setEditingRule(rule);
    setShowRuleModal(true);
  };

  const handleDeleteRule = (ruleId: string) => {
    if (confirm('Видалити це правило?')) {
      setMinStockRules(minStockRules.filter(r => r.id !== ruleId));
    }
  };

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Налаштування складу</h1>
          <p className="text-gray-600">Конфігурація складських операцій</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
          <CheckCircleIcon className="w-5 h-5" />
          Зберегти зміни
        </button>
      </div>

      {/* Табы */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {[
            { id: 'general', label: 'Загальні', icon: Cog6ToothIcon },
            { id: 'minstock', label: 'Мін. залишки', icon: ExclamationTriangleIcon },
            { id: 'autoorder', label: 'Авто-замовлення', icon: ArrowPathIcon },
            { id: 'notifications', label: 'Сповіщення', icon: BellIcon },
            { id: 'serials', label: 'Серійні номери', icon: QrCodeIcon },
            { id: 'printing', label: 'Друк', icon: PrinterIcon },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Контент табів */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {/* Загальні налаштування */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Загальні налаштування</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Склад за замовчуванням
                  </label>
                  <select
                    value={settings.defaultWarehouse}
                    onChange={(e) => setSettings({ ...settings, defaultWarehouse: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="1">Головний склад</option>
                    <option value="2">Магазин &quot;Центр&quot;</option>
                    <option value="3">Дропшипінг</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Термін дії резерву (годин)
                  </label>
                  <input
                    type="number"
                    value={settings.reserveExpireHours}
                    onChange={(e) => setSettings({ ...settings, reserveExpireHours: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Поведінка системи</h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                  <div>
                    <div className="font-medium text-gray-900">Автоматичне резервування</div>
                    <div className="text-sm text-gray-500">Резервувати товар при створенні замовлення</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoReserve}
                    onChange={(e) => setSettings({ ...settings, autoReserve: e.target.checked })}
                    className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                  />
                </label>

                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                  <div>
                    <div className="font-medium text-gray-900">Дозволити від&apos;ємні залишки</div>
                    <div className="text-sm text-gray-500">Продавати товар навіть якщо його немає на складі</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allowNegativeStock}
                    onChange={(e) => setSettings({ ...settings, allowNegativeStock: e.target.checked })}
                    className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                  />
                </label>

                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                  <div>
                    <div className="font-medium text-gray-900">FIFO (First In, First Out)</div>
                    <div className="text-sm text-gray-500">Відвантажувати спочатку товари, що надійшли раніше</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.fifoEnabled}
                    onChange={(e) => setSettings({ ...settings, fifoEnabled: e.target.checked })}
                    className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Мінімальні залишки */}
        {activeTab === 'minstock' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Правила мінімальних залишків</h3>
                <p className="text-sm text-gray-500">Налаштуйте рівні для сповіщень та авто-замовлень</p>
              </div>
              <button
                onClick={() => { setEditingRule(null); setShowRuleModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                Додати правило
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Категорія</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Мін. залишок</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Точка замовлення</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Кількість замовлення</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Постачальник</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Авто</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {minStockRules.map(rule => (
                    <tr key={rule.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{rule.category}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm font-medium">
                          {rule.minStock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-sm font-medium">
                          {rule.reorderPoint}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{rule.reorderQty} шт.</td>
                      <td className="px-4 py-3 text-gray-600">{rule.supplier || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {rule.autoOrder ? (
                          <CheckCircleIcon className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleEditRule(rule)}
                          className="text-teal-600 hover:text-teal-700 mr-2"
                        >
                          Редагувати
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Видалити
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CubeIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <strong>Як це працює:</strong>
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    <li><strong>Мін. залишок</strong> — критичний рівень, при якому з&apos;являється сповіщення</li>
                    <li><strong>Точка замовлення</strong> — рівень, при якому створюється авто-замовлення</li>
                    <li><strong>Кількість замовлення</strong> — скільки товару замовляти</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Авто-замовлення */}
        {activeTab === 'autoorder' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Автоматичні замовлення</h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                  <div>
                    <div className="font-medium text-gray-900">Увімкнути авто-замовлення</div>
                    <div className="text-sm text-gray-500">Система автоматично створюватиме замовлення постачальникам</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoOrderEnabled}
                    onChange={(e) => setSettings({ ...settings, autoOrderEnabled: e.target.checked })}
                    className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                  />
                </label>

                {settings.autoOrderEnabled && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          <ClockIcon className="w-4 h-4 inline mr-1" />
                          Час перевірки залишків
                        </label>
                        <input
                          type="time"
                          value={settings.autoOrderCheckTime}
                          onChange={(e) => setSettings({ ...settings, autoOrderCheckTime: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>

                    <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                      <div>
                        <div className="font-medium text-gray-900">Вимагати підтвердження</div>
                        <div className="text-sm text-gray-500">Авто-замовлення зберігатимуться як чернетки для перевірки</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.autoOrderApproval}
                        onChange={(e) => setSettings({ ...settings, autoOrderApproval: e.target.checked })}
                        className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Сповіщення */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Налаштування сповіщень</h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                  <div>
                    <div className="font-medium text-gray-900">Сповіщати про низькі залишки</div>
                    <div className="text-sm text-gray-500">Надсилати email коли товар досягає мінімального рівня</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.lowStockNotify}
                    onChange={(e) => setSettings({ ...settings, lowStockNotify: e.target.checked })}
                    className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                  />
                </label>

                {settings.lowStockNotify && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email для сповіщень
                    </label>
                    <input
                      type="email"
                      value={settings.lowStockEmail}
                      onChange={(e) => setSettings({ ...settings, lowStockEmail: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                )}

                <div className="p-4 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Попереджати про закінчення терміну за (днів)
                  </label>
                  <input
                    type="number"
                    value={settings.expiryNotifyDays}
                    onChange={(e) => setSettings({ ...settings, expiryNotifyDays: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                  <div>
                    <div className="font-medium text-gray-900">Сповіщати про приймання</div>
                    <div className="text-sm text-gray-500">Надсилати сповіщення при оприбуткуванні товару</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifyOnReceipt}
                    onChange={(e) => setSettings({ ...settings, notifyOnReceipt: e.target.checked })}
                    className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                  />
                </label>

                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                  <div>
                    <div className="font-medium text-gray-900">Сповіщати про відвантаження</div>
                    <div className="text-sm text-gray-500">Надсилати сповіщення при відправці товару</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifyOnShipment}
                    onChange={(e) => setSettings({ ...settings, notifyOnShipment: e.target.checked })}
                    className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Серійні номери */}
        {activeTab === 'serials' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Серійні номери та партії</h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                  <div>
                    <div className="font-medium text-gray-900">Вимагати серійні номери</div>
                    <div className="text-sm text-gray-500">Обов&apos;язково вводити серійний номер для обраних категорій</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.requireSerial}
                    onChange={(e) => setSettings({ ...settings, requireSerial: e.target.checked })}
                    className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                  />
                </label>

                {settings.requireSerial && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Категорії з серійними номерами
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {settings.serialCategories.map(cat => (
                        <span key={cat} className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm flex items-center gap-1">
                          {cat}
                          <button className="hover:text-teal-900">×</button>
                        </span>
                      ))}
                      <button className="px-3 py-1 border border-dashed border-gray-300 text-gray-500 rounded-full text-sm hover:bg-gray-100">
                        + Додати
                      </button>
                    </div>
                  </div>
                )}

                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                  <div>
                    <div className="font-medium text-gray-900">Вимагати партії/лоти</div>
                    <div className="text-sm text-gray-500">Обов&apos;язково вводити номер партії для обраних категорій</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.requireBatch}
                    onChange={(e) => setSettings({ ...settings, requireBatch: e.target.checked })}
                    className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Друк */}
        {activeTab === 'printing' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Налаштування друку</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Формат етикеток
                  </label>
                  <select
                    value={settings.defaultLabelFormat}
                    onChange={(e) => setSettings({ ...settings, defaultLabelFormat: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="a4_4x2">A4 - 4x2 (8 етикеток)</option>
                    <option value="a4_3x3">A4 - 3x3 (9 етикеток)</option>
                    <option value="a4_2x5">A4 - 2x5 (10 етикеток)</option>
                    <option value="thermal_58">Термо 58мм</option>
                    <option value="thermal_80">Термо 80мм</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Принтер за замовчуванням
                  </label>
                  <input
                    type="text"
                    value={settings.printerName}
                    onChange={(e) => setSettings({ ...settings, printerName: e.target.value })}
                    placeholder="Назва принтера"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                <div>
                  <div className="font-medium text-gray-900">Друкувати штрих-код</div>
                  <div className="text-sm text-gray-500">Додавати штрих-код товару на етикетку</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.includeBarcode}
                  onChange={(e) => setSettings({ ...settings, includeBarcode: e.target.checked })}
                  className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                <div>
                  <div className="font-medium text-gray-900">Додавати логотип</div>
                  <div className="text-sm text-gray-500">Друкувати логотип магазину на документах</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.includeLogo}
                  onChange={(e) => setSettings({ ...settings, includeLogo: e.target.checked })}
                  className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Модальне вікно правила */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingRule ? 'Редагувати правило' : 'Нове правило'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Категорія *</label>
                <select
                  defaultValue={editingRule?.category || ''}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Оберіть категорію</option>
                  <option value="Смартфони">Смартфони</option>
                  <option value="Ноутбуки">Ноутбуки</option>
                  <option value="Аксесуари">Аксесуари</option>
                  <option value="Телевізори">Телевізори</option>
                  <option value="Навушники">Навушники</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Мін. залишок</label>
                  <input
                    type="number"
                    defaultValue={editingRule?.minStock || 5}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Точка замовлення</label>
                  <input
                    type="number"
                    defaultValue={editingRule?.reorderPoint || 10}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">К-сть замовлення</label>
                  <input
                    type="number"
                    defaultValue={editingRule?.reorderQty || 20}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Постачальник</label>
                <select
                  defaultValue={editingRule?.supplier || ''}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Не вказано</option>
                  <option value="ТОВ &quot;Електроніка Плюс&quot;">ТОВ &quot;Електроніка Плюс&quot;</option>
                  <option value="ФОП Коваленко">ФОП Коваленко</option>
                  <option value="Імпорт Трейд">Імпорт Трейд</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked={editingRule?.autoOrder ?? true}
                  className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                />
                <span className="text-sm text-gray-700">Увімкнути авто-замовлення для цієї категорії</span>
              </label>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowRuleModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Скасувати
              </button>
              <button
                onClick={() => setShowRuleModal(false)}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                {editingRule ? 'Зберегти' : 'Створити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
