/**
 * Email Service Tests
 */

import {
  sendOrderConfirmation,
  sendShippingNotification,
  sendPasswordReset,
  generateOrderConfirmationEmail,
  generateShippingEmail,
  generatePasswordResetEmail,
  OrderEmailData,
} from '@/lib/email';

// Mock console methods
const mockConsole = {
  log: jest.spyOn(console, 'log').mockImplementation(() => {}),
  error: jest.spyOn(console, 'error').mockImplementation(() => {}),
};

describe('Email Service', () => {
  beforeEach(() => {
    mockConsole.log.mockClear();
    mockConsole.error.mockClear();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  const mockOrderData: OrderEmailData = {
    orderId: 'ORDER-123',
    customerName: 'Іван Петренко',
    customerEmail: 'test@example.com',
    customerPhone: '+380991234567',
    items: [
      { name: 'Товар 1', quantity: 2, price: 100 },
      { name: 'Товар 2', quantity: 1, price: 200 },
    ],
    subtotal: 400,
    deliveryPrice: 50,
    total: 450,
    deliveryType: 'warehouse' as const,
    deliveryAddress: 'Київ, Відділення №1',
    paymentMethod: 'Картка онлайн',
  };

  describe('generateOrderConfirmationEmail', () => {
    it('should generate email with customer name', () => {
      const html = generateOrderConfirmationEmail(mockOrderData);

      expect(html).toContain('ORDER-123');
      expect(html).toContain('Іван Петренко');
    });

    it('should include order ID in HTML', () => {
      const html = generateOrderConfirmationEmail(mockOrderData);

      expect(html).toContain('ORDER-123');
    });

    it('should include all order items', () => {
      const html = generateOrderConfirmationEmail(mockOrderData);

      expect(html).toContain('Товар 1');
      expect(html).toContain('Товар 2');
    });

    it('should include pricing information', () => {
      const html = generateOrderConfirmationEmail(mockOrderData);

      expect(html).toContain('400');
      expect(html).toContain('50');
      expect(html).toContain('450');
    });

    it('should include delivery information', () => {
      const html = generateOrderConfirmationEmail(mockOrderData);

      expect(html).toContain('Київ, Відділення №1');
    });

    it('should include payment method', () => {
      const html = generateOrderConfirmationEmail(mockOrderData);

      expect(html).toContain('Картка онлайн');
    });

    it('should generate valid HTML', () => {
      const html = generateOrderConfirmationEmail(mockOrderData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
    });

    it('should be mobile-responsive', () => {
      const html = generateOrderConfirmationEmail(mockOrderData);

      expect(html).toContain('max-width');
    });

    it('should include brand styling', () => {
      const html = generateOrderConfirmationEmail(mockOrderData);

      // Should include teal brand color
      expect(html).toMatch(/#0d9488|#14b8a6|teal/i);
    });
  });

  describe('generateShippingEmail', () => {
    const mockShippingData = {
      ...mockOrderData,
      trackingNumber: '20450000000000',
    };

    it('should generate email with tracking number', () => {
      const html = generateShippingEmail(mockShippingData);

      expect(html).toContain('20450000000000');
    });

    it('should include order ID', () => {
      const html = generateShippingEmail(mockShippingData);

      expect(html).toContain('ORDER-123');
    });

    it('should include delivery address', () => {
      const html = generateShippingEmail(mockShippingData);

      expect(html).toContain('Київ, Відділення №1');
    });

    it('should include tracking link', () => {
      const html = generateShippingEmail(mockShippingData);

      expect(html).toContain('novaposhta.ua/tracking');
    });

    it('should generate valid HTML', () => {
      const html = generateShippingEmail(mockShippingData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
    });
  });

  describe('generatePasswordResetEmail', () => {
    const name = 'Іван Петренко';
    const resetLink = 'https://example.com/reset?token=abc123';

    it('should generate email with reset link', () => {
      const html = generatePasswordResetEmail(name, resetLink);

      expect(html).toContain('https://example.com/reset?token=abc123');
    });

    it('should include customer name', () => {
      const html = generatePasswordResetEmail(name, resetLink);

      expect(html).toContain('Іван Петренко');
    });

    it('should include expiration notice', () => {
      const html = generatePasswordResetEmail(name, resetLink);

      // Should mention time limit
      expect(html).toMatch(/годин/i);
    });

    it('should generate valid HTML', () => {
      const html = generatePasswordResetEmail(name, resetLink);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
    });
  });

  describe('sendOrderConfirmation', () => {
    it('should send email successfully', async () => {
      const result = await sendOrderConfirmation(mockOrderData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should log email details in development', async () => {
      await sendOrderConfirmation(mockOrderData);

      expect(mockConsole.log).toHaveBeenCalled();
    });
  });

  describe('sendShippingNotification', () => {
    const mockShippingData = {
      ...mockOrderData,
      trackingNumber: '20450000000000',
    };

    it('should send email successfully', async () => {
      const result = await sendShippingNotification(mockShippingData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });
  });

  describe('sendPasswordReset', () => {
    it('should send email successfully', async () => {
      const result = await sendPasswordReset(
        'test@example.com',
        'Іван Петренко',
        'https://example.com/reset?token=abc123'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });
  });

  describe('Email HTML structure', () => {
    it('should include quantity info for items', () => {
      const html = generateOrderConfirmationEmail(mockOrderData);

      expect(html).toContain('× 2'); // quantity
      expect(html).toContain('× 1');
    });

    it('should show free delivery when price is 0', () => {
      const dataWithFreeDelivery = {
        ...mockOrderData,
        deliveryPrice: 0,
      };
      const html = generateOrderConfirmationEmail(dataWithFreeDelivery);

      expect(html).toContain('Безкоштовно');
    });

    it('should include contact information', () => {
      const html = generateOrderConfirmationEmail(mockOrderData);

      expect(html).toContain('+380991234567');
      expect(html).toContain('test@example.com');
    });

    it('should include estimated delivery when provided', () => {
      const dataWithDeliveryDate = {
        ...mockOrderData,
        estimatedDelivery: '25 грудня 2025',
      };
      const html = generateOrderConfirmationEmail(dataWithDeliveryDate);

      expect(html).toContain('25 грудня 2025');
    });
  });
});
