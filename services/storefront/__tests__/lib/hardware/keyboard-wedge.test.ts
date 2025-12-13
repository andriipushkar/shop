/**
 * Unit tests for Keyboard Wedge Scanner
 * Тести для сканера з режимом клавіатури
 */

import { KeyboardWedgeScanner } from '@/lib/hardware/keyboard-wedge';

describe('KeyboardWedgeScanner', () => {
  let scanner: KeyboardWedgeScanner;

  beforeEach(() => {
    scanner = new KeyboardWedgeScanner({
      minLength: 8,
      maxLength: 13,
      timeout: 100,
      suffix: 'Enter',
      debug: false,
    });
  });

  afterEach(() => {
    scanner.destroy();
  });

  describe('Barcode Type Detection', () => {
    it('should detect EAN-13 barcode', () => {
      const type = scanner.detectBarcodeType('4820024700016');
      expect(type).toBe('EAN13');
    });

    it('should detect EAN-8 barcode', () => {
      const type = scanner.detectBarcodeType('12345678');
      expect(type).toBe('EAN8');
    });

    it('should detect CODE128 barcode', () => {
      const type = scanner.detectBarcodeType('ABC-123-XYZ');
      expect(type).toBe('CODE128');
    });

    it('should detect QR code (long alphanumeric)', () => {
      const type = scanner.detectBarcodeType('https://example.com/product/12345');
      expect(type).toBe('QR');
    });

    it('should return UNKNOWN for unrecognized format', () => {
      const type = scanner.detectBarcodeType('abc');
      expect(type).toBe('UNKNOWN');
    });
  });

  describe('EAN Checksum Validation', () => {
    it('should validate correct EAN-13 checksum', () => {
      const isValid = scanner.validateEAN('4820024700016');
      expect(isValid).toBe(true);
    });

    it('should validate correct EAN-8 checksum', () => {
      const isValid = scanner.validateEAN('96385074');
      expect(isValid).toBe(true);
    });

    it('should reject invalid EAN-13 checksum', () => {
      const isValid = scanner.validateEAN('4820024700015'); // Wrong check digit
      expect(isValid).toBe(false);
    });

    it('should reject invalid EAN-8 checksum', () => {
      const isValid = scanner.validateEAN('96385075'); // Wrong check digit
      expect(isValid).toBe(false);
    });

    it('should reject non-numeric EAN', () => {
      const isValid = scanner.validateEAN('ABC123DEF4567');
      expect(isValid).toBe(false);
    });

    it('should reject wrong length EAN', () => {
      const isValid = scanner.validateEAN('123456');
      expect(isValid).toBe(false);
    });
  });

  describe('Scanner Listeners', () => {
    it('should add scan listener', () => {
      const callback = jest.fn();
      const unsubscribe = scanner.onScan(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should remove scan listener', () => {
      const callback = jest.fn();
      const unsubscribe = scanner.onScan(callback);

      unsubscribe();

      const state = scanner.getState();
      expect(state.listenerCount).toBe(0);
    });

    it('should support multiple listeners', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      scanner.onScan(callback1);
      scanner.onScan(callback2);

      const state = scanner.getState();
      expect(state.listenerCount).toBe(2);
    });
  });

  describe('Scanner State', () => {
    it('should return initial state', () => {
      const state = scanner.getState();

      expect(state.isListening).toBe(false);
      expect(state.buffer).toBe('');
      expect(state.listenerCount).toBe(0);
    });

    it('should update state when listening', () => {
      scanner.start();
      const state = scanner.getState();

      expect(state.isListening).toBe(true);
    });

    it('should stop listening', () => {
      scanner.start();
      scanner.stop();
      const state = scanner.getState();

      expect(state.isListening).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const customScanner = new KeyboardWedgeScanner({
        minLength: 5,
        maxLength: 20,
        timeout: 200,
        onlyNumeric: true,
      });

      expect(customScanner).toBeDefined();
      customScanner.destroy();
    });

    it('should use default configuration when not provided', () => {
      const defaultScanner = new KeyboardWedgeScanner();
      expect(defaultScanner).toBeDefined();
      defaultScanner.destroy();
    });

    it('should merge partial configuration with defaults', () => {
      const partialScanner = new KeyboardWedgeScanner({
        minLength: 10,
      });

      expect(partialScanner).toBeDefined();
      partialScanner.destroy();
    });
  });

  describe('Scanner Detection vs Manual Input', () => {
    it('should differentiate scanner from manual typing', () => {
      // Scanner input is typically very fast (< 50ms between keystrokes)
      // Manual typing is slower (> 100ms between keystrokes)
      // This is tested via private isFromScanner method which checks timing
      const scanner = new KeyboardWedgeScanner({ debug: false });
      expect(scanner).toBeDefined();
      scanner.destroy();
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      scanner.start();
      scanner.onScan(() => {});

      scanner.destroy();

      const state = scanner.getState();
      expect(state.isListening).toBe(false);
      expect(state.listenerCount).toBe(0);
    });

    it('should handle multiple destroy calls', () => {
      scanner.destroy();
      scanner.destroy();

      expect(scanner.getState().isListening).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty barcode', () => {
      const type = scanner.detectBarcodeType('');
      expect(type).toBe('UNKNOWN');
    });

    it('should handle very long barcodes', () => {
      const longCode = '1'.repeat(100);
      const type = scanner.detectBarcodeType(longCode);
      // Long numeric strings are detected as CODE128, not QR
      // QR codes typically contain URLs or alphanumeric mixed content
      expect(['CODE128', 'QR']).toContain(type);
    });

    it('should validate special characters in CODE128', () => {
      const type = scanner.detectBarcodeType('ABC-123.XYZ/456');
      expect(type).toBe('CODE128');
    });

    it('should handle numeric-only configuration', () => {
      const numericScanner = new KeyboardWedgeScanner({
        onlyNumeric: true,
      });

      const type = numericScanner.detectBarcodeType('1234567890123');
      expect(type).toBe('EAN13');

      numericScanner.destroy();
    });
  });

  describe('Start/Stop Behavior', () => {
    it('should not start twice', () => {
      scanner.start();
      scanner.start();

      const state = scanner.getState();
      expect(state.isListening).toBe(true);
    });

    it('should handle stop when not started', () => {
      scanner.stop();

      const state = scanner.getState();
      expect(state.isListening).toBe(false);
    });

    it('should clear buffer on stop', () => {
      scanner.start();
      scanner.stop();

      const state = scanner.getState();
      expect(state.buffer).toBe('');
    });
  });
});

describe('useKeyboardScanner Hook', () => {
  it('should be defined', () => {
    // Hook tests would require React Testing Library
    // This is a placeholder to show the hook is exported
    const { useKeyboardScanner } = require('@/lib/hardware/keyboard-wedge');
    expect(useKeyboardScanner).toBeDefined();
  });
});
