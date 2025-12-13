/**
 * Print Button Component
 * Компонент для друку етикеток та документів
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Printer, ChevronDown, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface PrinterOption {
  id: string;
  name: string;
  type: 'thermal' | 'receipt' | 'label';
  status: 'ready' | 'busy' | 'offline' | 'error';
}

interface PrintButtonProps {
  label?: string;
  content: string | (() => Promise<string>);
  contentType?: 'zpl' | 'tspl' | 'escpos' | 'pdf' | 'raw';
  printerType?: 'thermal' | 'receipt' | 'label';
  copies?: number;
  onSuccess?: (jobId: string) => void;
  onError?: (error: string) => void;
  showPreview?: boolean;
  previewContent?: string;
  disabled?: boolean;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export function PrintButton({
  label = 'Друк',
  content,
  contentType = 'zpl',
  printerType,
  copies = 1,
  onSuccess,
  onError,
  showPreview = false,
  previewContent,
  disabled = false,
  className = '',
  variant = 'primary',
  size = 'md',
}: PrintButtonProps) {
  const [printers, setPrinters] = useState<PrinterOption[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Load printers
  useEffect(() => {
    loadPrinters();
  }, [printerType]);

  const loadPrinters = async () => {
    try {
      const url = printerType
        ? `/api/hardware/printers?type=${printerType}&enabled=true`
        : '/api/hardware/printers?enabled=true';

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setPrinters(data.printers);

        // Auto-select default printer
        const defaultPrinter = data.printers.find((p: any) => p.default);
        if (defaultPrinter) {
          setSelectedPrinter(defaultPrinter.id);
        } else if (data.printers.length > 0) {
          setSelectedPrinter(data.printers[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load printers:', error);
    }
  };

  const handlePrint = async () => {
    if (!selectedPrinter) {
      showError('Будь ласка, оберіть принтер');
      return;
    }

    setIsPrinting(true);
    setPrintStatus('idle');

    try {
      // Get content (may be async)
      const printContent = typeof content === 'function' ? await content() : content;

      // Send print request
      const response = await fetch('/api/hardware/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          printerId: selectedPrinter,
          content: printContent,
          type: contentType,
          copies,
        }),
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(`Відправлено на друк (№${data.jobId})`);
        if (onSuccess) {
          onSuccess(data.jobId);
        }
      } else {
        throw new Error(data.error || 'Помилка друку');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Помилка друку';
      showError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const showSuccess = (message: string) => {
    setPrintStatus('success');
    setStatusMessage(message);
    setTimeout(() => {
      setPrintStatus('idle');
    }, 3000);
  };

  const showError = (message: string) => {
    setPrintStatus('error');
    setStatusMessage(message);
    setTimeout(() => {
      setPrintStatus('idle');
    }, 5000);
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm';
      case 'lg':
        return 'px-6 py-3 text-lg';
      default:
        return 'px-4 py-2';
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'secondary':
        return 'bg-gray-600 hover:bg-gray-700 text-white';
      case 'outline':
        return 'bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-300';
      default:
        return 'bg-blue-600 hover:bg-blue-700 text-white';
    }
  };

  // Simple print button (no dropdown)
  if (printers.length <= 1) {
    return (
      <div className={className}>
        <button
          onClick={handlePrint}
          disabled={disabled || isPrinting || printers.length === 0}
          className={`
            ${getSizeClasses()}
            ${getVariantClasses()}
            rounded-lg font-medium
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center gap-2
            transition-colors
          `}
        >
          {isPrinting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Друк...
            </>
          ) : printStatus === 'success' ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Надруковано
            </>
          ) : printStatus === 'error' ? (
            <>
              <XCircle className="w-4 h-4" />
              Помилка
            </>
          ) : (
            <>
              <Printer className="w-4 h-4" />
              {label}
            </>
          )}
        </button>

        {printStatus !== 'idle' && (
          <div
            className={`mt-2 text-sm ${
              printStatus === 'success' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {statusMessage}
          </div>
        )}
      </div>
    );
  }

  // Print button with printer selection dropdown
  return (
    <div className={`relative ${className}`}>
      <div className="flex gap-1">
        {/* Print button */}
        <button
          onClick={handlePrint}
          disabled={disabled || isPrinting || !selectedPrinter}
          className={`
            ${getSizeClasses()}
            ${getVariantClasses()}
            rounded-l-lg font-medium
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center gap-2
            transition-colors
            flex-1
          `}
        >
          {isPrinting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Друк...
            </>
          ) : printStatus === 'success' ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Надруковано
            </>
          ) : printStatus === 'error' ? (
            <>
              <XCircle className="w-4 h-4" />
              Помилка
            </>
          ) : (
            <>
              <Printer className="w-4 h-4" />
              {label}
            </>
          )}
        </button>

        {/* Dropdown toggle */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={disabled || isPrinting}
          className={`
            ${getSizeClasses()}
            ${getVariantClasses()}
            rounded-r-lg
            disabled:opacity-50 disabled:cursor-not-allowed
            border-l border-white/20
          `}
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Dropdown menu */}
      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 px-2 py-1">
                Оберіть принтер
              </div>
              {printers.map((printer) => (
                <button
                  key={printer.id}
                  onClick={() => {
                    setSelectedPrinter(printer.id);
                    setShowDropdown(false);
                  }}
                  className={`
                    w-full text-left px-3 py-2 rounded
                    hover:bg-gray-100
                    flex items-center justify-between
                    ${selectedPrinter === printer.id ? 'bg-blue-50' : ''}
                  `}
                >
                  <div>
                    <div className="font-medium text-sm">{printer.name}</div>
                    <div className="text-xs text-gray-500">{printer.type}</div>
                  </div>
                  <div
                    className={`
                      w-2 h-2 rounded-full
                      ${
                        printer.status === 'ready'
                          ? 'bg-green-500'
                          : printer.status === 'busy'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }
                    `}
                  />
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Status message */}
      {printStatus !== 'idle' && (
        <div
          className={`mt-2 text-sm ${
            printStatus === 'success' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
}

/**
 * Quick print button (icon only)
 */
export function QuickPrintButton({
  content,
  contentType = 'zpl',
  onSuccess,
  onError,
  className = '',
}: {
  content: string | (() => Promise<string>);
  contentType?: 'zpl' | 'tspl' | 'escpos' | 'pdf';
  onSuccess?: (jobId: string) => void;
  onError?: (error: string) => void;
  className?: string;
}) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    setIsPrinting(true);

    try {
      const printContent = typeof content === 'function' ? await content() : content;

      const response = await fetch('/api/hardware/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: printContent,
          type: contentType,
        }),
      });

      const data = await response.json();

      if (data.success && onSuccess) {
        onSuccess(data.jobId);
      } else if (!data.success && onError) {
        onError(data.error || 'Помилка друку');
      }
    } catch (error) {
      if (onError) {
        onError(error instanceof Error ? error.message : 'Помилка друку');
      }
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <button
      onClick={handlePrint}
      disabled={isPrinting}
      className={`p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 ${className}`}
      title="Друк"
    >
      {isPrinting ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Printer className="w-5 h-5" />
      )}
    </button>
  );
}
