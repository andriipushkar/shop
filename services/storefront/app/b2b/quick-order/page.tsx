/**
 * B2B Quick Order Page
 * Excel-like quick order interface
 * Сторінка швидкого замовлення з Excel-подібним інтерфейсом
 */

'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import type { QuickOrderRow } from '@/lib/b2b/types';

export default function QuickOrderPage() {
  const [rows, setRows] = useState<QuickOrderRow[]>([
    { id: '1', sku: '', quantity: 1 }
  ]);
  const [loading, setLoading] = useState(false);
  const [creditInfo, setCreditInfo] = useState({
    availableCredit: 75000,
    creditLimit: 100000
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add new row
  const addRow = () => {
    const newRow: QuickOrderRow = {
      id: Date.now().toString(),
      sku: '',
      quantity: 1
    };
    setRows([...rows, newRow]);
  };

  // Remove row
  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter(row => row.id !== id));
    }
  };

  // Update row
  const updateRow = (id: string, field: keyof QuickOrderRow, value: any) => {
    setRows(rows.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value };
      }
      return row;
    }));
  };

  // Fetch product info by SKU
  const fetchProductInfo = async (id: string, sku: string) => {
    if (!sku.trim()) return;

    try {
      // Mock product lookup - in real app, call API
      await new Promise(resolve => setTimeout(resolve, 300));

      // Mock data
      const mockProducts: Record<string, any> = {
        'PROD-001': { name: 'Premium Laptop', price: 25000 },
        'PROD-002': { name: 'Wireless Mouse', price: 500 },
        'PROD-003': { name: 'Mechanical Keyboard', price: 2500 }
      };

      const product = mockProducts[sku.toUpperCase()];

      if (product) {
        updateRow(id, 'productId', sku);
        updateRow(id, 'name', product.name);
        updateRow(id, 'price', product.price);
        updateRow(id, 'error', undefined);
      } else {
        updateRow(id, 'error', 'Товар не знайдено');
        updateRow(id, 'name', undefined);
        updateRow(id, 'price', undefined);
      }
    } catch (error) {
      updateRow(id, 'error', 'Помилка завантаження');
    }
  };

  // Handle SKU blur event
  const handleSkuBlur = (id: string, sku: string) => {
    fetchProductInfo(id, sku);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, rowId: string, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      // Find current row index
      const currentIndex = rows.findIndex(r => r.id === rowId);

      if (field === 'sku') {
        // Move to quantity field
        const qtyInput = document.querySelector(`input[data-row="${rowId}"][data-field="quantity"]`) as HTMLInputElement;
        qtyInput?.focus();
      } else if (field === 'quantity') {
        // Move to next row's SKU or add new row
        if (currentIndex === rows.length - 1) {
          addRow();
          setTimeout(() => {
            const inputs = document.querySelectorAll('input[data-field="sku"]');
            const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
            lastInput?.focus();
          }, 0);
        } else {
          const nextSkuInput = document.querySelectorAll('input[data-field="sku"]')[currentIndex + 1] as HTMLInputElement;
          nextSkuInput?.focus();
        }
      }
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    const validRows = rows.filter(r => r.price && r.quantity);
    const subtotal = validRows.reduce((sum, row) => sum + (row.price! * row.quantity), 0);
    const tax = subtotal * 0.20; // 20% VAT
    const total = subtotal + tax;

    return { subtotal, tax, total, itemCount: validRows.length };
  };

  const totals = calculateTotals();

  // Handle file import
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());

      const newRows: QuickOrderRow[] = lines.map((line, index) => {
        const [sku, quantity] = line.split(/[,;\t]/).map(s => s.trim());
        return {
          id: Date.now() + index + '',
          sku: sku || '',
          quantity: parseInt(quantity) || 1
        };
      });

      setRows(newRows);

      // Fetch product info for all rows
      newRows.forEach(row => {
        if (row.sku) {
          fetchProductInfo(row.id, row.sku);
        }
      });
    };

    reader.readAsText(file);
  };

  // Handle paste from Excel
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length > 1) {
      const newRows: QuickOrderRow[] = lines.map((line, index) => {
        const [sku, quantity] = line.split('\t');
        return {
          id: Date.now() + index + '',
          sku: sku?.trim() || '',
          quantity: parseInt(quantity?.trim()) || 1
        };
      });

      setRows(newRows);

      // Fetch product info for all rows
      newRows.forEach(row => {
        if (row.sku) {
          fetchProductInfo(row.id, row.sku);
        }
      });
    }
  };

  // Submit order
  const handleSubmitOrder = async () => {
    const validRows = rows.filter(r => r.productId && r.price);

    if (validRows.length === 0) {
      alert('Додайте товари до замовлення');
      return;
    }

    setLoading(true);

    try {
      const items = validRows.map(row => ({
        productId: row.productId!,
        sku: row.sku,
        name: row.name!,
        quantity: row.quantity,
        basePrice: row.price! * 1.2 // Add markup to show discount
      }));

      const response = await fetch('/api/b2b/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          paymentMethod: 'credit',
          deliveryAddress: 'вул. Хрещатик 1, Київ'
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Замовлення ${data.order.orderNumber} успішно створено!\nСума: ${totals.total.toLocaleString('uk-UA')} грн`);
        // Reset form
        setRows([{ id: '1', sku: '', quantity: 1 }]);
      } else {
        alert(`Помилка: ${data.error}`);
      }
    } catch (error) {
      alert('Помилка створення замовлення');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Швидке замовлення
            </h1>
            <p className="text-gray-600">
              Excel-подібний інтерфейс для швидкого оформлення замовлення
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Доступний кредит</div>
            <div className="text-2xl font-bold text-green-600">
              {creditInfo.availableCredit.toLocaleString('uk-UA')} грн
            </div>
          </div>
        </div>
      </div>

      {/* Import Options */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Імпорт замовлення</h2>
        <div className="flex gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            📁 Завантажити з файлу (CSV/Excel)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileImport}
            className="hidden"
          />
          <div className="text-sm text-gray-600 flex items-center">
            або вставте з Excel (Ctrl+V в таблицю)
          </div>
        </div>
      </div>

      {/* Order Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="px-4 py-3 text-left w-8">#</th>
                <th className="px-4 py-3 text-left">Артикул (SKU)</th>
                <th className="px-4 py-3 text-left">Назва товару</th>
                <th className="px-4 py-3 text-right">Ціна</th>
                <th className="px-4 py-3 text-right">Кількість</th>
                <th className="px-4 py-3 text-right">Сума</th>
                <th className="px-4 py-3 text-center w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`hover:bg-gray-50 ${row.error ? 'bg-red-50' : ''}`}
                  onPaste={index === 0 ? handlePaste : undefined}
                >
                  <td className="px-4 py-2 text-gray-600">{index + 1}</td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={row.sku}
                      onChange={(e) => updateRow(row.id, 'sku', e.target.value.toUpperCase())}
                      onBlur={(e) => handleSkuBlur(row.id, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, row.id, 'sku')}
                      data-row={row.id}
                      data-field="sku"
                      placeholder="PROD-001"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                    />
                  </td>
                  <td className="px-4 py-2">
                    {row.name ? (
                      <div className="font-medium text-gray-900">{row.name}</div>
                    ) : row.error ? (
                      <div className="text-red-600 text-sm">{row.error}</div>
                    ) : (
                      <div className="text-gray-400 text-sm">Введіть артикул</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {row.price ? (
                      <div className="font-semibold text-gray-900">
                        {row.price.toLocaleString('uk-UA')} грн
                      </div>
                    ) : (
                      <div className="text-gray-400">—</div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => updateRow(row.id, 'quantity', parseInt(e.target.value) || 1)}
                      onKeyDown={(e) => handleKeyDown(e, row.id, 'quantity')}
                      data-row={row.id}
                      data-field="quantity"
                      className="w-24 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    {row.price ? (
                      <div className="font-bold text-gray-900">
                        {(row.price * row.quantity).toLocaleString('uk-UA')} грн
                      </div>
                    ) : (
                      <div className="text-gray-400">—</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {rows.length > 1 && (
                      <button
                        onClick={() => removeRow(row.id)}
                        className="text-red-600 hover:text-red-800 font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add Row Button */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={addRow}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            + Додати рядок
          </button>
        </div>
      </div>

      {/* Order Summary */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Підсумок замовлення</h2>
        <div className="space-y-3">
          <div className="flex justify-between text-lg">
            <span className="text-gray-600">Кількість позицій:</span>
            <span className="font-semibold">{totals.itemCount}</span>
          </div>
          <div className="flex justify-between text-lg">
            <span className="text-gray-600">Сума без ПДВ:</span>
            <span className="font-semibold">{totals.subtotal.toLocaleString('uk-UA')} грн</span>
          </div>
          <div className="flex justify-between text-lg">
            <span className="text-gray-600">ПДВ (20%):</span>
            <span className="font-semibold">{totals.tax.toLocaleString('uk-UA')} грн</span>
          </div>
          <div className="border-t-2 border-gray-300 pt-3 flex justify-between text-2xl">
            <span className="font-bold text-gray-900">Разом:</span>
            <span className="font-bold text-blue-600">{totals.total.toLocaleString('uk-UA')} грн</span>
          </div>
          {totals.total > creditInfo.availableCredit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              ⚠️ Сума замовлення перевищує доступний кредитний ліміт
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-4">
          <button
            onClick={handleSubmitOrder}
            disabled={loading || totals.itemCount === 0}
            className="flex-1 px-8 py-3 bg-green-600 text-white text-lg font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Обробка...' : 'Оформити замовлення'}
          </button>
          <button
            onClick={() => setRows([{ id: '1', sku: '', quantity: 1 }])}
            className="px-8 py-3 bg-gray-200 text-gray-700 text-lg font-semibold rounded-lg hover:bg-gray-300 transition"
          >
            Очистити
          </button>
        </div>
      </div>

      {/* Help */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Підказки:</h3>
        <ul className="space-y-1 text-blue-800 text-sm">
          <li>• Натисніть Enter для переходу до наступного поля</li>
          <li>• Вставте дані з Excel (Ctrl+V) для швидкого заповнення</li>
          <li>• Завантажте CSV файл з двома колонками: артикул та кількість</li>
          <li>• Формат CSV: PROD-001,10 (артикул,кількість)</li>
        </ul>
      </div>
    </div>
  );
}
