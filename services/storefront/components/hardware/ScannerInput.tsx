/**
 * Scanner Input Component
 * Компонент для введення штрих-кодів зі сканера
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useKeyboardScanner } from '@/lib/hardware/keyboard-wedge';
import { useDataWedge } from '@/lib/hardware/datawedge';
import { CheckCircle2, Scan, AlertCircle } from 'lucide-react';

interface ScannerInputProps {
  onScan: (barcode: string) => void;
  onError?: (error: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  validate?: (barcode: string) => boolean | string; // true or error message
  showHistory?: boolean;
  maxHistory?: number;
  disabled?: boolean;
  className?: string;
  useDataWedge?: boolean; // Use professional scanner integration
  scannerConfig?: {
    minLength?: number;
    maxLength?: number;
    timeout?: number;
    onlyNumeric?: boolean;
  };
}

export function ScannerInput({
  onScan,
  onError,
  placeholder = 'Скануйте штрих-код або введіть вручну...',
  autoFocus = true,
  validate,
  showHistory = true,
  maxHistory = 10,
  disabled = false,
  className = '',
  useDataWedge: useDataWedgeOption = false,
  scannerConfig,
}: ScannerInputProps) {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [lastScanTime, setLastScanTime] = useState<number>(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard wedge scanner
  const keyboardScanner = useKeyboardScanner(scannerConfig);

  // DataWedge scanner (for professional devices)
  const dataWedge = useDataWedge();

  // Handle keyboard scanner scans
  useEffect(() => {
    if (keyboardScanner.lastScan && !useDataWedgeOption) {
      handleScan(keyboardScanner.lastScan);
      keyboardScanner.clearLastScan();
    }
  }, [keyboardScanner.lastScan, useDataWedgeOption]);

  // Handle DataWedge scans
  useEffect(() => {
    if (dataWedge.lastScan && useDataWedgeOption) {
      handleScan(dataWedge.lastScan.data);
    }
  }, [dataWedge.lastScan, useDataWedgeOption]);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleScan = (barcode: string) => {
    // Validate
    if (validate) {
      const result = validate(barcode);
      if (result !== true) {
        const errorMsg = typeof result === 'string' ? result : 'Невірний штрих-код';
        showErrorFeedback(errorMsg);
        if (onError) {
          onError(errorMsg);
        }
        return;
      }
    }

    // Call onScan callback
    onScan(barcode);

    // Add to history
    if (showHistory) {
      setHistory((prev) => {
        const newHistory = [barcode, ...prev.filter((h) => h !== barcode)];
        return newHistory.slice(0, maxHistory);
      });
    }

    // Show success feedback
    showSuccessFeedback(barcode);

    // Clear input
    setValue('');

    // Update last scan time
    setLastScanTime(Date.now());
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!value.trim()) {
      return;
    }

    handleScan(value.trim());
  };

  const showSuccessFeedback = (barcode: string) => {
    setFeedbackType('success');
    setFeedbackMessage(`Відскановано: ${barcode}`);
    setShowFeedback(true);

    setTimeout(() => {
      setShowFeedback(false);
    }, 2000);
  };

  const showErrorFeedback = (message: string) => {
    setFeedbackType('error');
    setFeedbackMessage(message);
    setShowFeedback(true);

    setTimeout(() => {
      setShowFeedback(false);
    }, 3000);
  };

  const handleHistoryClick = (barcode: string) => {
    setValue(barcode);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return (
    <div className={`scanner-input ${className}`}>
      {/* Scanner status */}
      <div className="flex items-center gap-2 mb-2 text-sm">
        <Scan className="w-4 h-4" />
        <span className="text-gray-600">
          {useDataWedgeOption && dataWedge.isAvailable
            ? 'Сканер ТЗД підключено'
            : keyboardScanner.isListening
            ? 'Очікування сканування...'
            : 'Сканер не активний'}
        </span>
        {keyboardScanner.scanCount > 0 && (
          <span className="text-xs text-gray-500">
            (відскановано: {keyboardScanner.scanCount})
          </span>
        )}
      </div>

      {/* Input form */}
      <form onSubmit={handleManualSubmit} className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-600 hover:text-blue-700 disabled:text-gray-400"
        >
          <Scan className="w-5 h-5" />
        </button>
      </form>

      {/* Feedback */}
      {showFeedback && (
        <div
          className={`mt-2 p-3 rounded-lg flex items-center gap-2 ${
            feedbackType === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {feedbackType === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">{feedbackMessage}</span>
        </div>
      )}

      {/* History */}
      {showHistory && history.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">Історія сканування</h4>
            <button
              onClick={clearHistory}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Очистити
            </button>
          </div>
          <div className="space-y-1">
            {history.map((barcode, index) => (
              <button
                key={index}
                onClick={() => handleHistoryClick(barcode)}
                className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
              >
                {barcode}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* DataWedge trigger button (for professional devices) */}
      {useDataWedgeOption && dataWedge.isAvailable && (
        <button
          onClick={dataWedge.triggerScan}
          disabled={disabled}
          className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
        >
          <Scan className="w-5 h-5" />
          Активувати сканер ТЗД
        </button>
      )}
    </div>
  );
}

/**
 * Compact inline scanner input (for forms)
 */
export function InlineScannerInput({
  value,
  onChange,
  onScan,
  placeholder = 'Штрих-код',
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  onScan?: (barcode: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const keyboardScanner = useKeyboardScanner({
    minLength: 5,
    preventFocus: false,
  });

  useEffect(() => {
    if (keyboardScanner.lastScan) {
      onChange(keyboardScanner.lastScan);
      if (onScan) {
        onScan(keyboardScanner.lastScan);
      }
      keyboardScanner.clearLastScan();
    }
  }, [keyboardScanner.lastScan, onChange, onScan]);

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <Scan className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    </div>
  );
}
