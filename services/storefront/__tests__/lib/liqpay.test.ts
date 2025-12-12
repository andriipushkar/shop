/**
 * LiqPay Payment Service Tests
 */

import {
  createPaymentFormData,
  verifyCallback,
  parseCallbackData,
  getPaymentStatusText,
  isPaymentSuccessful,
  isPaymentPending,
  isPaymentFailed,
  getCheckoutUrl,
  PAYMENT_METHODS,
  calculateCODCommission,
} from '@/lib/liqpay';

describe('LiqPay Service', () => {
  describe('createPaymentFormData', () => {
    it('should create payment form data with required fields', () => {
      const formData = createPaymentFormData({
        orderId: 'TEST-123',
        amount: 1000,
        description: 'Test order',
      });

      expect(formData).toHaveProperty('data');
      expect(formData).toHaveProperty('signature');
      expect(typeof formData.data).toBe('string');
      expect(typeof formData.signature).toBe('string');
    });

    it('should create base64 encoded data', () => {
      const formData = createPaymentFormData({
        orderId: 'TEST-123',
        amount: 1000,
        description: 'Test order',
      });

      // Data should be valid base64
      expect(() => Buffer.from(formData.data, 'base64')).not.toThrow();
    });

    it('should include customer info when provided', () => {
      const formData = createPaymentFormData({
        orderId: 'TEST-123',
        amount: 1000,
        description: 'Test order',
        customerEmail: 'test@example.com',
        customerPhone: '+380991234567',
        customerName: 'Іван Петренко',
      });

      const decoded = JSON.parse(Buffer.from(formData.data, 'base64').toString('utf-8'));

      expect(decoded.sender_email).toBe('test@example.com');
      expect(decoded.sender_phone).toBe('+380991234567');
      expect(decoded.sender_first_name).toBe('Іван');
      expect(decoded.sender_last_name).toBe('Петренко');
    });

    it('should set currency to UAH', () => {
      const formData = createPaymentFormData({
        orderId: 'TEST-123',
        amount: 1000,
        description: 'Test order',
      });

      const decoded = JSON.parse(Buffer.from(formData.data, 'base64').toString('utf-8'));

      expect(decoded.currency).toBe('UAH');
    });

    it('should set action to pay', () => {
      const formData = createPaymentFormData({
        orderId: 'TEST-123',
        amount: 1000,
        description: 'Test order',
      });

      const decoded = JSON.parse(Buffer.from(formData.data, 'base64').toString('utf-8'));

      expect(decoded.action).toBe('pay');
    });

    it('should include order_id in data', () => {
      const formData = createPaymentFormData({
        orderId: 'ORDER-456',
        amount: 1000,
        description: 'Test order',
      });

      const decoded = JSON.parse(Buffer.from(formData.data, 'base64').toString('utf-8'));

      expect(decoded.order_id).toBe('ORDER-456');
    });
  });

  describe('verifyCallback', () => {
    it('should return false for mismatched signatures', () => {
      const data = Buffer.from(JSON.stringify({ test: true })).toString('base64');
      const wrongSignature = 'wrongsignature';

      const isValid = verifyCallback(data, wrongSignature);

      expect(isValid).toBe(false);
    });
  });

  describe('parseCallbackData', () => {
    it('should parse valid base64 callback data', () => {
      const callbackData = {
        action: 'pay',
        payment_id: 123456,
        status: 'success',
        order_id: 'TEST-123',
        amount: 1000,
      };

      const encoded = Buffer.from(JSON.stringify(callbackData)).toString('base64');
      const parsed = parseCallbackData(encoded);

      expect(parsed).toBeDefined();
      expect(parsed?.order_id).toBe('TEST-123');
      expect(parsed?.status).toBe('success');
    });

    it('should return null for invalid data', () => {
      const parsed = parseCallbackData('invalidbase64!!!');

      expect(parsed).toBeNull();
    });

    it('should return null for non-JSON data', () => {
      const encoded = Buffer.from('not json').toString('base64');
      const parsed = parseCallbackData(encoded);

      expect(parsed).toBeNull();
    });
  });

  describe('getPaymentStatusText', () => {
    it('should return Ukrainian text for known statuses', () => {
      expect(getPaymentStatusText('success')).toBe('Оплачено');
      expect(getPaymentStatusText('failure')).toBe('Помилка оплати');
      expect(getPaymentStatusText('processing')).toBe('Обробка платежу');
      expect(getPaymentStatusText('wait_secure')).toBe('Очікує підтвердження 3DS');
    });

    it('should return default text for unknown statuses', () => {
      expect(getPaymentStatusText('unknown_status' as any)).toBe('Невідомий статус');
    });
  });

  describe('isPaymentSuccessful', () => {
    it('should return true only for success status', () => {
      expect(isPaymentSuccessful('success')).toBe(true);
      expect(isPaymentSuccessful('failure')).toBe(false);
      expect(isPaymentSuccessful('processing')).toBe(false);
      expect(isPaymentSuccessful('wait_secure')).toBe(false);
    });
  });

  describe('isPaymentPending', () => {
    it('should return true for pending statuses', () => {
      expect(isPaymentPending('wait_secure')).toBe(true);
      expect(isPaymentPending('wait_accept')).toBe(true);
      expect(isPaymentPending('processing')).toBe(true);
      expect(isPaymentPending('prepared')).toBe(true);
    });

    it('should return false for final statuses', () => {
      expect(isPaymentPending('success')).toBe(false);
      expect(isPaymentPending('failure')).toBe(false);
      expect(isPaymentPending('error')).toBe(false);
    });
  });

  describe('isPaymentFailed', () => {
    it('should return true for failed statuses', () => {
      expect(isPaymentFailed('failure')).toBe(true);
      expect(isPaymentFailed('error')).toBe(true);
      expect(isPaymentFailed('reversed')).toBe(true);
    });

    it('should return false for successful or pending statuses', () => {
      expect(isPaymentFailed('success')).toBe(false);
      expect(isPaymentFailed('processing')).toBe(false);
      expect(isPaymentFailed('wait_secure')).toBe(false);
    });
  });

  describe('getCheckoutUrl', () => {
    it('should return LiqPay checkout URL', () => {
      const url = getCheckoutUrl();

      expect(url).toBe('https://www.liqpay.ua/api/3/checkout');
    });
  });

  describe('PAYMENT_METHODS', () => {
    it('should have all payment methods defined', () => {
      expect(PAYMENT_METHODS.length).toBe(3);

      const ids = PAYMENT_METHODS.map(m => m.id);
      expect(ids).toContain('liqpay');
      expect(ids).toContain('cash');
      expect(ids).toContain('cod');
    });

    it('should have required properties for each method', () => {
      PAYMENT_METHODS.forEach(method => {
        expect(method).toHaveProperty('id');
        expect(method).toHaveProperty('name');
        expect(method).toHaveProperty('description');
        expect(method).toHaveProperty('icon');
        expect(method).toHaveProperty('enabled');
      });
    });

    it('should have all methods enabled', () => {
      PAYMENT_METHODS.forEach(method => {
        expect(method.enabled).toBe(true);
      });
    });
  });

  describe('calculateCODCommission', () => {
    it('should calculate commission as 2% + 20 UAH', () => {
      // For 1000 UAH: 1000 * 0.02 + 20 = 40 UAH
      expect(calculateCODCommission(1000)).toBe(40);

      // For 2000 UAH: 2000 * 0.02 + 20 = 60 UAH
      expect(calculateCODCommission(2000)).toBe(60);
    });

    it('should have minimum commission of 30 UAH', () => {
      // For 100 UAH: 100 * 0.02 + 20 = 22 UAH, but min is 30
      expect(calculateCODCommission(100)).toBe(30);

      // For 0 UAH: min is 30
      expect(calculateCODCommission(0)).toBe(30);
    });

    it('should return rounded values', () => {
      const commission = calculateCODCommission(999);
      expect(Number.isInteger(commission)).toBe(true);
    });

    it('should handle large amounts', () => {
      // For 100000 UAH: 100000 * 0.02 + 20 = 2020 UAH
      expect(calculateCODCommission(100000)).toBe(2020);
    });
  });
});
