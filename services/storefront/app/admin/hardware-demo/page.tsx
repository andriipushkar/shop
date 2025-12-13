/**
 * Hardware Integration Demo Page
 * Демонстрація роботи з обладnanням
 */

'use client';

import React, { useState } from 'react';
import { ScannerInput, InlineScannerInput } from '@/components/hardware/ScannerInput';
import { PrintButton, QuickPrintButton } from '@/components/hardware/PrintButton';
import { ThermalPrinterService } from '@/lib/hardware/thermal-printer';
import { Package, Truck, Tag, Receipt } from 'lucide-react';

export default function HardwareDemoPage() {
  const [scannedProduct, setScannedProduct] = useState<string | null>(null);
  const [barcode, setBarcode] = useState('');

  const handleProductScan = (barcode: string) => {
    setScannedProduct(barcode);
    // В реальному додатку - завантажити товар з API
    console.log('Product scanned:', barcode);
  };

  const generateProductLabel = async () => {
    const printer = new ThermalPrinterService({
      type: 'network',
      width: 60,
      height: 40,
      dpi: 203,
      model: 'zebra',
    });

    return printer.generateZPL(
      {
        id: 'demo-product',
        name: 'Product Label',
        width: 60,
        height: 40,
        elements: [
          {
            type: 'text',
            x: 5,
            y: 5,
            content: 'Демо товар',
            fontSize: 12,
            bold: true,
          },
          {
            type: 'text',
            x: 5,
            y: 20,
            content: 'SKU: DEMO-001',
            fontSize: 8,
          },
          {
            type: 'barcode',
            x: 5,
            y: 30,
            data: barcode || '4820024700016',
            symbology: 'EAN13',
            height: 40,
            showText: true,
          },
          {
            type: 'text',
            x: 5,
            y: 75,
            content: '299.99 грн',
            fontSize: 16,
            bold: true,
          },
        ],
      },
      {}
    );
  };

  const generateShippingLabel = async () => {
    const printer = new ThermalPrinterService({
      type: 'network',
      width: 100,
      height: 150,
      dpi: 203,
      model: 'zebra',
    });

    return printer.generateZPL(
      {
        id: 'demo-shipping',
        name: 'Shipping Label',
        width: 100,
        height: 150,
        elements: [
          {
            type: 'text',
            x: 10,
            y: 10,
            content: 'НОВА ПОШТА',
            fontSize: 24,
            bold: true,
          },
          {
            type: 'text',
            x: 10,
            y: 40,
            content: '№ 59001234567890',
            fontSize: 16,
          },
          {
            type: 'barcode',
            x: 10,
            y: 60,
            data: '59001234567890',
            symbology: 'CODE128',
            height: 60,
            showText: true,
          },
          {
            type: 'line',
            x1: 10,
            y1: 130,
            x2: 90,
            y2: 130,
            thickness: 2,
          },
          {
            type: 'text',
            x: 10,
            y: 140,
            content: 'Відправник:',
            fontSize: 10,
            bold: true,
          },
          {
            type: 'text',
            x: 10,
            y: 155,
            content: 'Інтернет-магазин',
            fontSize: 12,
          },
          {
            type: 'text',
            x: 10,
            y: 170,
            content: '+380501234567',
            fontSize: 10,
          },
          {
            type: 'line',
            x1: 10,
            y1: 185,
            x2: 90,
            y2: 185,
            thickness: 2,
          },
          {
            type: 'text',
            x: 10,
            y: 195,
            content: 'Одержувач:',
            fontSize: 10,
            bold: true,
          },
          {
            type: 'text',
            x: 10,
            y: 210,
            content: 'Іван Іваненко',
            fontSize: 14,
            bold: true,
          },
          {
            type: 'text',
            x: 10,
            y: 225,
            content: '+380671234567',
            fontSize: 12,
          },
          {
            type: 'text',
            x: 10,
            y: 240,
            content: 'КИЇВ',
            fontSize: 14,
            bold: true,
          },
          {
            type: 'text',
            x: 10,
            y: 255,
            content: 'вул. Соборна, 10',
            fontSize: 10,
          },
        ],
      },
      {}
    );
  };

  const generateReceipt = () => {
    const printer = new ThermalPrinterService({
      type: 'network',
      width: 80,
      height: 200,
      dpi: 203,
      model: 'zebra',
    });

    const receipt = {
      storeName: 'ІНТЕРНЕТ-МАГАЗИН',
      storeAddress: 'вул. Хрещатик, 1, Київ',
      storePhone: '+380501234567',
      invoiceNumber: 'INV-2024-001',
      date: new Date().toLocaleString('uk-UA'),
      items: [
        { name: 'Товар 1', quantity: 2, price: 100, total: 200 },
        { name: 'Товар 2', quantity: 1, price: 150, total: 150 },
        { name: 'Товар 3', quantity: 3, price: 50, total: 150 },
      ],
      subtotal: 500,
      tax: 83.33,
      discount: 50,
      total: 533.33,
      paymentMethod: 'Готівка',
      footer: 'Дякуємо за покупку!',
    };

    const escpos = printer.generateESCPOS(receipt);
    return new TextDecoder().decode(escpos);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Демо обладнання</h1>
        <p className="text-gray-600 mt-2">
          Демонстрація роботи зі сканерами та принтерами
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Scanner Demo */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Package className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold">Сканер штрих-кодів</h2>
            </div>

            <ScannerInput
              onScan={handleProductScan}
              validate={(barcode) => {
                if (barcode.length < 8) {
                  return 'Штрих-код занадто короткий';
                }
                return true;
              }}
              showHistory={true}
              maxHistory={5}
            />

            {scannedProduct && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-900">Відскановано товар</h3>
                <p className="text-green-700 mt-1">Штрих-код: {scannedProduct}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Tag className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-semibold">Inline сканер</h2>
            </div>

            <p className="text-gray-600 mb-4">Сканер в формі (для швидкого введення)</p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Штрих-код товару
                </label>
                <InlineScannerInput
                  value={barcode}
                  onChange={setBarcode}
                  placeholder="Скануйте або введіть"
                />
              </div>

              {barcode && (
                <div className="text-sm text-gray-600">
                  Введено: <span className="font-mono font-medium">{barcode}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Printer Demo */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Tag className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-semibold">Друк товарної етикетки</h2>
            </div>

            <div className="mb-4">
              <p className="text-gray-600 mb-2">Розмір: 60x40мм (стандарт)</p>
              <div className="bg-gray-50 p-4 rounded border border-gray-200">
                <div className="text-xs font-mono whitespace-pre-wrap break-all text-gray-700">
                  ^XA
                  <br />
                  ^FO5,5^A0N,12,12^FDДемо товар^FS
                  <br />
                  ^FO5,20^A0N,8,8^FDSKU: DEMO-001^FS
                  <br />
                  ^FO5,30^BY2^BCN,40,Y,N^FD4820024700016^FS
                  <br />
                  ^FO5,75^A0N,16,16^FD299.99 грн^FS
                  <br />
                  ^XZ
                </div>
              </div>
            </div>

            <PrintButton
              label="Друк етикетки"
              content={generateProductLabel}
              contentType="zpl"
              printerType="label"
              onSuccess={(jobId) => {
                console.log('Label printed:', jobId);
              }}
            />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Truck className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold">Друк накладної</h2>
            </div>

            <div className="mb-4">
              <p className="text-gray-600 mb-2">
                Розмір: 100x150мм (Нова Пошта стиль)
              </p>
              <div className="bg-blue-50 p-4 rounded border border-blue-200">
                <p className="text-sm font-medium text-blue-900">НОВА ПОШТА</p>
                <p className="text-sm text-blue-700 mt-1">№ 59001234567890</p>
                <div className="mt-2 text-xs text-blue-600">
                  Одержувач: Іван Іваненко
                  <br />
                  Місто: КИЇВ
                  <br />
                  Адреса: вул. Соборна, 10
                </div>
              </div>
            </div>

            <PrintButton
              label="Друк накладної"
              content={generateShippingLabel}
              contentType="zpl"
              printerType="label"
              variant="primary"
              size="md"
            />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Receipt className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-semibold">Друк чека</h2>
            </div>

            <div className="mb-4">
              <p className="text-gray-600 mb-2">Термочековий принтер (80мм)</p>
              <div className="bg-gray-50 p-4 rounded border border-gray-200 font-mono text-xs">
                <div className="text-center">
                  <div className="font-bold">ІНТЕРНЕТ-МАГАЗИН</div>
                  <div className="text-gray-600">вул. Хрещатик, 1, Київ</div>
                  <div className="text-gray-600">+380501234567</div>
                </div>
                <div className="border-t border-gray-300 my-2"></div>
                <div>Чек: INV-2024-001</div>
                <div className="border-t border-gray-300 my-2"></div>
                <div>Товар 1 2x100.00 = 200.00</div>
                <div>Товар 2 1x150.00 = 150.00</div>
                <div>Товар 3 3x50.00 = 150.00</div>
                <div className="border-t border-gray-300 my-2"></div>
                <div className="font-bold">ВСЬОГО: 533.33 грн</div>
              </div>
            </div>

            <PrintButton
              label="Друк чека"
              content={generateReceipt}
              contentType="escpos"
              printerType="receipt"
              variant="secondary"
            />
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">Підказки</h3>
        <ul className="space-y-2 text-blue-800 text-sm">
          <li>• Для тестування сканера використовуйте будь-який штрих-код з упаковки</li>
          <li>
            • Принтери потрібно спочатку налаштувати в{' '}
            <a href="/admin/settings/hardware" className="underline">
              Налаштуваннях обладнання
            </a>
          </li>
          <li>
            • Для друку без діалогу браузера використовуйте локальний принт-сервер
          </li>
          <li>• ZPL - мова програмування для принтерів Zebra</li>
          <li>• TSPL - для принтерів TSC</li>
          <li>• ESC/POS - стандарт для чекових принтерів</li>
        </ul>
      </div>
    </div>
  );
}
