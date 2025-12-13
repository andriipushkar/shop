/**
 * Tests for SMS Notifications System
 */

import {
  formatPhoneNumber,
  validatePhoneNumber,
  renderTemplate,
  getTemplate,
  getSmsConfig,
  SMS_TEMPLATES,
  SmsNotificationType,
  SmsTemplate,
} from '../../lib/sms-notifications';

describe('SMS Notifications System', () => {
  describe('formatPhoneNumber', () => {
    it('should format phone with +380 prefix', () => {
      const formatted = formatPhoneNumber('+380501234567');
      expect(formatted).toBe('+380501234567');
    });

    it('should add +380 prefix to 0-starting numbers', () => {
      const formatted = formatPhoneNumber('0501234567');
      expect(formatted).toBe('+380501234567');
    });

    it('should handle 380 prefix without +', () => {
      const formatted = formatPhoneNumber('380501234567');
      expect(formatted).toBe('+380501234567');
    });

    it('should remove spaces and dashes', () => {
      const formatted = formatPhoneNumber('+380 50 123 45 67');
      expect(formatted).toBe('+380501234567');
    });

    it('should handle phone with dashes', () => {
      const formatted = formatPhoneNumber('050-123-45-67');
      expect(formatted).toBe('+380501234567');
    });

    it('should handle phone with parentheses', () => {
      const formatted = formatPhoneNumber('+38(050)1234567');
      expect(formatted).toBe('+380501234567');
    });
  });

  describe('validatePhoneNumber', () => {
    it('should validate correct Ukrainian phone', () => {
      expect(validatePhoneNumber('+380501234567')).toBe(true);
      expect(validatePhoneNumber('0501234567')).toBe(true);
      expect(validatePhoneNumber('380501234567')).toBe(true);
    });

    it('should reject short phone numbers', () => {
      expect(validatePhoneNumber('12345')).toBe(false);
    });

    it('should reject empty phone', () => {
      expect(validatePhoneNumber('')).toBe(false);
    });

    it('should validate various Ukrainian operators', () => {
      // Vodafone
      expect(validatePhoneNumber('+380501234567')).toBe(true);
      // Kyivstar
      expect(validatePhoneNumber('+380671234567')).toBe(true);
      // lifecell
      expect(validatePhoneNumber('+380631234567')).toBe(true);
      // Kyivstar (old)
      expect(validatePhoneNumber('+380961234567')).toBe(true);
    });

    it('should accept phones with spaces and dashes', () => {
      expect(validatePhoneNumber('+380 50 123 45 67')).toBe(true);
      expect(validatePhoneNumber('050-123-45-67')).toBe(true);
    });
  });

  describe('renderTemplate', () => {
    it('should replace variables in template', () => {
      const template = getTemplate('order_confirmed')!;
      const variables = { orderId: '12345' };

      const result = renderTemplate(template, variables);
      expect(result).toContain('12345');
    });

    it('should replace multiple variables', () => {
      const template = getTemplate('order_created')!;
      const variables = { orderId: '12345', total: '1500', trackingUrl: 'https://example.com' };

      const result = renderTemplate(template, variables);
      expect(result).toContain('12345');
      expect(result).toContain('1500');
    });

    it('should handle empty variables', () => {
      const template = getTemplate('order_confirmed')!;
      const variables = {};

      const result = renderTemplate(template, variables);
      expect(typeof result).toBe('string');
    });

    it('should support both languages', () => {
      const template = getTemplate('order_confirmed')!;
      const variables = { orderId: '12345' };

      const resultEn = renderTemplate(template, variables, 'en');
      const resultUk = renderTemplate(template, variables, 'uk');

      expect(resultEn).toContain('12345');
      expect(resultUk).toContain('12345');
    });
  });

  describe('getTemplate', () => {
    it('should return template for valid notification type', () => {
      const template = getTemplate('order_created');

      expect(template).toBeDefined();
      expect(template?.type).toBe('order_created');
      expect(template?.template).toBeTruthy();
    });

    it('should return undefined for invalid type', () => {
      const template = getTemplate('invalid_type' as SmsNotificationType);

      expect(template).toBeUndefined();
    });

    it('should have order_created template', () => {
      const template = getTemplate('order_created');
      expect(template).toBeDefined();
    });

    it('should have order_confirmed template', () => {
      const template = getTemplate('order_confirmed');
      expect(template).toBeDefined();
    });

    it('should have order_shipped template', () => {
      const template = getTemplate('order_shipped');
      expect(template).toBeDefined();
    });

    it('should have order_delivered template', () => {
      const template = getTemplate('order_delivered');
      expect(template).toBeDefined();
    });

    it('should have verification_code template', () => {
      const template = getTemplate('verification_code');
      expect(template).toBeDefined();
    });
  });

  describe('getSmsConfig', () => {
    it('should return SMS config without API key', () => {
      const config = getSmsConfig();

      expect(config).toBeDefined();
      expect(config.provider).toBeTruthy();
      expect(config.sender).toBeTruthy();
      expect((config as any).apiKey).toBeUndefined();
    });
  });

  describe('SMS Templates', () => {
    it('should have multiple templates', () => {
      expect(SMS_TEMPLATES.length).toBeGreaterThan(0);
    });

    it('should have all required fields in templates', () => {
      SMS_TEMPLATES.forEach(template => {
        expect(template.id).toBeTruthy();
        expect(template.type).toBeTruthy();
        expect(template.template).toBeTruthy();
        expect(template.templateUk).toBeTruthy();
        expect(Array.isArray(template.variables)).toBe(true);
        expect(typeof template.maxLength).toBe('number');
        expect(typeof template.enabled).toBe('boolean');
      });
    });

    it('should have unique types', () => {
      const types = SMS_TEMPLATES.map(t => t.type);
      const uniqueTypes = new Set(types);

      expect(uniqueTypes.size).toBe(types.length);
    });

    it('should have order-related templates', () => {
      const orderTemplates = SMS_TEMPLATES.filter(t => t.type.startsWith('order_'));
      expect(orderTemplates.length).toBeGreaterThan(0);
    });

    it('should have verification template', () => {
      const verificationTemplate = SMS_TEMPLATES.find(t => t.type === 'verification_code');
      expect(verificationTemplate).toBeDefined();
      expect(verificationTemplate?.variables).toContain('code');
      expect(verificationTemplate?.variables).toContain('minutes');
    });

    it('should have reasonable template lengths', () => {
      SMS_TEMPLATES.forEach(template => {
        // SMS should be reasonably short
        const baseLength = template.template.length;
        expect(baseLength).toBeLessThan(500);
      });
    });
  });
});
