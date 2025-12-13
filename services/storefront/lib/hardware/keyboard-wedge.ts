/**
 * Keyboard Wedge Scanner Support
 * Підтримка сканерів з режимом клавіатури
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface KeyboardWedgeConfig {
  minLength?: number; // Мінімальна довжина штрих-коду
  maxLength?: number; // Максимальна довжина
  timeout?: number; // Таймаут між символами (ms)
  prefix?: string; // Префікс (наприклад, для сканерів Zebra)
  suffix?: string; // Суфікс (зазвичай Enter)
  preventFocus?: boolean; // Перехоплювати скани навіть без фокусу
  onlyNumeric?: boolean; // Приймати тільки цифри
  debug?: boolean; // Виводити debug інформацію
}

const DEFAULT_CONFIG: Required<KeyboardWedgeConfig> = {
  minLength: 5,
  maxLength: 50,
  timeout: 100,
  prefix: '',
  suffix: 'Enter',
  preventFocus: true,
  onlyNumeric: false,
  debug: false,
};

export class KeyboardWedgeScanner {
  private buffer: string = '';
  private lastKeyTime: number = 0;
  private config: Required<KeyboardWedgeConfig>;
  private listeners: Set<(barcode: string) => void> = new Set();
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private keypressListener: ((e: KeyboardEvent) => void) | null = null;
  private isListening = false;

  constructor(config?: KeyboardWedgeConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start listening for scanner input
   */
  start(): void {
    if (this.isListening) {
      return;
    }

    if (typeof window === 'undefined') {
      console.warn('KeyboardWedgeScanner can only run in browser');
      return;
    }

    this.keydownListener = this.handleKeyDown.bind(this);
    this.keypressListener = this.handleKeyPress.bind(this);

    window.addEventListener('keydown', this.keydownListener, true);
    window.addEventListener('keypress', this.keypressListener, true);

    this.isListening = true;

    if (this.config.debug) {
      console.log('KeyboardWedgeScanner started with config:', this.config);
    }
  }

  /**
   * Stop listening
   */
  stop(): void {
    if (!this.isListening) {
      return;
    }

    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener, true);
      this.keydownListener = null;
    }

    if (this.keypressListener) {
      window.removeEventListener('keypress', this.keypressListener, true);
      this.keypressListener = null;
    }

    this.buffer = '';
    this.isListening = false;

    if (this.config.debug) {
      console.log('KeyboardWedgeScanner stopped');
    }
  }

  /**
   * Add scan listener
   */
  onScan(callback: (barcode: string) => void): () => void {
    this.listeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Handle keydown events
   */
  private handleKeyDown(e: KeyboardEvent): void {
    const now = Date.now();
    const timeDiff = now - this.lastKeyTime;

    // Reset buffer if timeout exceeded
    if (timeDiff > this.config.timeout) {
      this.buffer = '';
    }

    this.lastKeyTime = now;

    // Check for suffix (usually Enter)
    if (e.key === this.config.suffix && this.buffer.length > 0) {
      this.processScan();
      if (this.config.preventFocus) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    // Ignore if typing in input/textarea
    if (!this.config.preventFocus) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }
    }
  }

  /**
   * Handle keypress events
   */
  private handleKeyPress(e: KeyboardEvent): void {
    const now = Date.now();
    const timeDiff = now - this.lastKeyTime;

    // Reset buffer if timeout exceeded
    if (timeDiff > this.config.timeout) {
      this.buffer = '';
    }

    this.lastKeyTime = now;

    // Ignore special keys
    if (e.key.length !== 1) {
      return;
    }

    // Check if only numeric allowed
    if (this.config.onlyNumeric && !/\d/.test(e.key)) {
      return;
    }

    // Add to buffer
    this.buffer += e.key;

    if (this.config.debug) {
      console.log('Buffer:', this.buffer, 'Length:', this.buffer.length);
    }

    // Auto-process if max length reached
    if (this.buffer.length >= this.config.maxLength) {
      this.processScan();
    }

    // Prevent default if we're capturing scanner input
    if (this.config.preventFocus && this.isFromScanner(timeDiff)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  /**
   * Process completed scan
   */
  private processScan(): void {
    let barcode = this.buffer.trim();

    // Remove prefix if configured
    if (this.config.prefix && barcode.startsWith(this.config.prefix)) {
      barcode = barcode.substring(this.config.prefix.length);
    }

    // Validate length
    if (barcode.length < this.config.minLength) {
      if (this.config.debug) {
        console.log('Scan rejected: too short', barcode);
      }
      this.buffer = '';
      return;
    }

    if (barcode.length > this.config.maxLength) {
      if (this.config.debug) {
        console.log('Scan rejected: too long', barcode);
      }
      this.buffer = '';
      return;
    }

    if (this.config.debug) {
      console.log('Scan accepted:', barcode);
    }

    // Notify listeners
    this.notifyListeners(barcode);

    // Clear buffer
    this.buffer = '';
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(barcode: string): void {
    this.listeners.forEach((callback) => {
      try {
        callback(barcode);
      } catch (error) {
        console.error('Error in scan callback:', error);
      }
    });
  }

  /**
   * Detect if input is from scanner (fast typing)
   * Scanners typically type at 20-50ms per character
   * Humans type at 100-200ms per character
   */
  private isFromScanner(keyTiming: number): boolean {
    return keyTiming < 50;
  }

  /**
   * Detect barcode type based on pattern
   */
  detectBarcodeType(barcode: string): 'EAN13' | 'EAN8' | 'CODE128' | 'QR' | 'UNKNOWN' {
    // EAN-13: 13 digits
    if (/^\d{13}$/.test(barcode)) {
      return 'EAN13';
    }

    // EAN-8: 8 digits
    if (/^\d{8}$/.test(barcode)) {
      return 'EAN8';
    }

    // CODE128: alphanumeric
    if (/^[A-Z0-9\-\.\/\s]+$/i.test(barcode) && barcode.length >= 6) {
      return 'CODE128';
    }

    // QR: any characters, usually longer
    if (barcode.length > 20) {
      return 'QR';
    }

    return 'UNKNOWN';
  }

  /**
   * Validate EAN checksum
   */
  validateEAN(barcode: string): boolean {
    if (!/^\d{8}$|^\d{13}$/.test(barcode)) {
      return false;
    }

    const digits = barcode.split('').map(Number);
    const checkDigit = digits.pop()!;

    let sum = 0;
    digits.reverse().forEach((digit, index) => {
      sum += digit * (index % 2 === 0 ? 3 : 1);
    });

    const calculatedCheckDigit = (10 - (sum % 10)) % 10;
    return calculatedCheckDigit === checkDigit;
  }

  /**
   * Get current state
   */
  getState(): {
    isListening: boolean;
    buffer: string;
    listenerCount: number;
  } {
    return {
      isListening: this.isListening,
      buffer: this.buffer,
      listenerCount: this.listeners.size,
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stop();
    this.listeners.clear();
  }
}

/**
 * React hook for keyboard scanner
 */
export function useKeyboardScanner(config?: KeyboardWedgeConfig) {
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const scannerRef = useRef<KeyboardWedgeScanner | null>(null);

  useEffect(() => {
    // Initialize scanner
    if (!scannerRef.current) {
      scannerRef.current = new KeyboardWedgeScanner(config);
    }

    const scanner = scannerRef.current;

    // Subscribe to scans
    const unsubscribe = scanner.onScan((barcode) => {
      setLastScan(barcode);
      setScanCount((prev) => prev + 1);
    });

    // Start listening
    scanner.start();
    setIsListening(true);

    // Cleanup
    return () => {
      unsubscribe();
      scanner.stop();
      setIsListening(false);
    };
  }, [config]);

  const resetCount = useCallback(() => {
    setScanCount(0);
  }, []);

  const clearLastScan = useCallback(() => {
    setLastScan(null);
  }, []);

  return {
    lastScan,
    scanCount,
    isListening,
    resetCount,
    clearLastScan,
    scanner: scannerRef.current,
  };
}
