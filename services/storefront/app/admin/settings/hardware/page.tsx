/**
 * Hardware Settings Page
 * Налаштування обладнання складу
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Printer,
  Scan,
  Plus,
  Trash2,
  Settings,
  CheckCircle,
  XCircle,
  Wifi,
  Usb,
  Bluetooth,
  Edit,
  TestTube,
} from 'lucide-react';
import { ScannerInput } from '@/components/hardware/ScannerInput';
import { PrintButton } from '@/components/hardware/PrintButton';

interface Printer {
  id: string;
  name: string;
  type: 'thermal' | 'receipt' | 'label';
  connection: 'usb' | 'network' | 'bluetooth';
  address?: string;
  port?: number;
  width: number;
  height: number;
  dpi: 203 | 300;
  model?: string;
  default?: boolean;
  enabled: boolean;
}

export default function HardwareSettingsPage() {
  const [activeTab, setActiveTab] = useState<'scanners' | 'printers'>('scanners');
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddPrinter, setShowAddPrinter] = useState(false);

  useEffect(() => {
    loadPrinters();
  }, []);

  const loadPrinters = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/hardware/printers');
      const data = await response.json();

      if (data.success) {
        setPrinters(data.printers);
      }
    } catch (error) {
      console.error('Failed to load printers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deletePrinter = async (id: string) => {
    if (!confirm('Видалити принтер?')) {
      return;
    }

    try {
      const response = await fetch(`/api/hardware/printers/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setPrinters(printers.filter((p) => p.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete printer:', error);
      alert('Помилка видалення принтера');
    }
  };

  const testPrinter = async (printer: Printer) => {
    try {
      // Generate test label ZPL
      const testZPL = `^XA
^FO50,50^A0N,50,50^FDТестова етикетка^FS
^FO50,120^A0N,30,30^FDПринтер: ${printer.name}^FS
^FO50,160^A0N,25,25^FDЧас: ${new Date().toLocaleString('uk-UA')}^FS
^FO50,200^BY3^BCN,100,Y,N^FD123456789^FS
^XZ`;

      const response = await fetch('/api/hardware/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          printerId: printer.id,
          content: testZPL,
          type: 'zpl',
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Тестову етикетку відправлено на друк');
      } else {
        alert('Помилка друку: ' + data.error);
      }
    } catch (error) {
      console.error('Test print failed:', error);
      alert('Помилка друку');
    }
  };

  const toggleDefault = async (id: string) => {
    try {
      const response = await fetch(`/api/hardware/printers/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          default: true,
        }),
      });

      if (response.ok) {
        await loadPrinters();
      }
    } catch (error) {
      console.error('Failed to set default printer:', error);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Налаштування обладнання</h1>
        <p className="text-gray-600 mt-2">
          Конфігурація сканерів штрих-кодів та термопринтерів
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('scanners')}
            className={`px-4 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'scanners'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Scan className="w-5 h-5" />
              Сканери
            </div>
          </button>
          <button
            onClick={() => setActiveTab('printers')}
            className={`px-4 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'printers'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Принтери
            </div>
          </button>
        </nav>
      </div>

      {/* Scanner Settings */}
      {activeTab === 'scanners' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Тест сканера</h2>
            <p className="text-gray-600 mb-4">
              Використовуйте поле нижче для тестування сканера штрих-кодів
            </p>

            <ScannerInput
              onScan={(barcode) => {
                console.log('Scanned:', barcode);
              }}
              showHistory={true}
              maxHistory={10}
            />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Налаштування сканера</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Тип сканера
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option>Клавіатурний режим (Keyboard Wedge)</option>
                  <option>DataWedge (Zebra/Honeywell)</option>
                  <option>WebUSB</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Мінімальна довжина
                  </label>
                  <input
                    type="number"
                    defaultValue={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Максимальна довжина
                  </label>
                  <input
                    type="number"
                    defaultValue={50}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm text-gray-700">
                    Тільки цифри (для EAN/UPC)
                  </span>
                </label>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm text-gray-700">
                    Перехоплювати скани без фокусу
                  </span>
                </label>
              </div>

              <div className="pt-4">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Зберегти налаштування
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printer Settings */}
      {activeTab === 'printers' && (
        <div className="space-y-6">
          {/* Add Printer Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddPrinter(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Додати принтер
            </button>
          </div>

          {/* Printers List */}
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Завантаження...</div>
          ) : printers.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Printer className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Принтери не налаштовані
              </h3>
              <p className="text-gray-600 mb-6">
                Додайте перший принтер для друку етикеток та накладних
              </p>
              <button
                onClick={() => setShowAddPrinter(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Додати принтер
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {printers.map((printer) => (
                <div
                  key={printer.id}
                  className="bg-white rounded-lg border border-gray-200 p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{printer.name}</h3>
                        {printer.default && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                            За замовчуванням
                          </span>
                        )}
                        {printer.enabled ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Тип:</span>{' '}
                          <span className="font-medium">{printer.type}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {printer.connection === 'network' && (
                            <Wifi className="w-4 h-4" />
                          )}
                          {printer.connection === 'usb' && <Usb className="w-4 h-4" />}
                          {printer.connection === 'bluetooth' && (
                            <Bluetooth className="w-4 h-4" />
                          )}
                          <span className="font-medium">{printer.connection}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Розмір:</span>{' '}
                          <span className="font-medium">
                            {printer.width}x{printer.height}мм
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">DPI:</span>{' '}
                          <span className="font-medium">{printer.dpi}</span>
                        </div>
                      </div>

                      {printer.address && (
                        <div className="mt-2 text-sm text-gray-600">
                          Адреса: {printer.address}
                          {printer.port && `:${printer.port}`}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => testPrinter(printer)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="Тестувати"
                      >
                        <TestTube className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => toggleDefault(printer.id)}
                        className="p-2 text-gray-600 hover:bg-gray-50 rounded"
                        title="Встановити за замовчуванням"
                      >
                        <Settings className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deletePrinter(printer.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Видалити"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Printer Modal */}
      {showAddPrinter && (
        <AddPrinterModal
          onClose={() => setShowAddPrinter(false)}
          onSuccess={() => {
            setShowAddPrinter(false);
            loadPrinters();
          }}
        />
      )}
    </div>
  );
}

function AddPrinterModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'label' as 'thermal' | 'receipt' | 'label',
    connection: 'network' as 'usb' | 'network' | 'bluetooth',
    address: '',
    port: 9100,
    width: 100,
    height: 150,
    dpi: 203 as 203 | 300,
    model: 'zebra',
    enabled: true,
    default: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/hardware/printers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
      } else {
        alert('Помилка: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to add printer:', error);
      alert('Помилка додавання принтера');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">Додати принтер</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Назва принтера *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Zebra ZD420"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Тип принтера *
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as any })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="label">Етикетки</option>
                <option value="thermal">Термопринтер</option>
                <option value="receipt">Чеки</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Підключення *
              </label>
              <select
                value={formData.connection}
                onChange={(e) =>
                  setFormData({ ...formData, connection: e.target.value as any })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="network">Мережа (TCP/IP)</option>
                <option value="usb">USB</option>
                <option value="bluetooth">Bluetooth</option>
              </select>
            </div>
          </div>

          {formData.connection === 'network' && (
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  IP адреса
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="192.168.1.100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Порт
                </label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) =>
                    setFormData({ ...formData, port: parseInt(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ширина (мм)
              </label>
              <input
                type="number"
                value={formData.width}
                onChange={(e) =>
                  setFormData({ ...formData, width: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Висота (мм)
              </label>
              <input
                type="number"
                value={formData.height}
                onChange={(e) =>
                  setFormData({ ...formData, height: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">DPI</label>
              <select
                value={formData.dpi}
                onChange={(e) =>
                  setFormData({ ...formData, dpi: parseInt(e.target.value) as any })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={203}>203</option>
                <option value={300}>300</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Модель</label>
            <select
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="zebra">Zebra (ZPL)</option>
              <option value="tsc">TSC (TSPL)</option>
              <option value="xprinter">Xprinter</option>
              <option value="brother">Brother</option>
              <option value="generic">Інший</option>
            </select>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Увімкнено</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.default}
                onChange={(e) => setFormData({ ...formData, default: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-700">За замовчуванням</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Додати принтер
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
