/**
 * Tests for CRM System
 */

import {
  calculateCustomerLTV,
  daysSince,
  calculatePurchaseFrequency,
  matchesSegmentRules,
  formatCustomerName,
  formatCurrency,
  generateReferralCode,
  validateEmail,
  validateUkrainianPhone,
  formatUkrainianPhone,
  DEFAULT_SEGMENTS,
  CUSTOMER_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
  Customer,
  SegmentRule,
} from '../../../lib/admin/crm';

describe('CRM System', () => {
  // Sample customer
  const createSampleCustomer = (overrides?: Partial<Customer>): Customer => ({
    id: 'cust-1',
    email: 'test@example.com',
    phone: '+380501234567',
    firstName: 'Іван',
    lastName: 'Петренко',
    fullName: 'Іван Петренко',
    language: 'uk',
    currency: 'UAH',
    status: 'active',
    tags: ['vip', 'returning'],
    source: 'organic',
    addresses: [{
      id: 'addr-1',
      customerId: 'cust-1',
      type: 'shipping',
      firstName: 'Іван',
      lastName: 'Петренко',
      phone: '+380501234567',
      street: 'вул. Хрещатик',
      city: 'Київ',
      region: 'Київська область',
      postalCode: '01001',
      country: 'UA',
      isDefault: true,
      createdAt: new Date(),
    }],
    loyaltyPoints: 5000,
    totalSpent: 50000,
    totalOrders: 10,
    averageOrderValue: 5000,
    lastOrderDate: new Date('2024-01-15'),
    firstOrderDate: new Date('2023-01-01'),
    lastActivityDate: new Date(),
    emailVerified: true,
    phoneVerified: true,
    marketingConsent: true,
    smsConsent: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('calculateCustomerLTV', () => {
    it('should calculate lifetime value correctly', () => {
      // Average order $1000, 4 orders/year, 3 year lifespan
      const ltv = calculateCustomerLTV(50000, 5000, 4, 3);

      expect(ltv).toBe(5000 * 4 * 3); // 60000
    });

    it('should use default 3-year lifespan', () => {
      const ltv = calculateCustomerLTV(50000, 1000, 2);

      expect(ltv).toBe(1000 * 2 * 3); // 6000
    });

    it('should handle zero values', () => {
      const ltv = calculateCustomerLTV(0, 0, 0);

      expect(ltv).toBe(0);
    });
  });

  describe('daysSince', () => {
    it('should calculate days since date', () => {
      // Use 2 days ago to avoid edge case around midnight
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const days = daysSince(twoDaysAgo);

      // Due to Math.ceil, could be 2 or 3 depending on time of day
      expect(days).toBeGreaterThanOrEqual(2);
      expect(days).toBeLessThanOrEqual(3);
    });

    it('should return null for null date', () => {
      const days = daysSince(null);

      expect(days).toBeNull();
    });

    it('should return null for undefined date', () => {
      const days = daysSince(undefined);

      expect(days).toBeNull();
    });

    it('should handle same day', () => {
      const today = new Date();

      const days = daysSince(today);

      expect(days).toBeLessThanOrEqual(1); // Could be 0 or 1 depending on timing
    });
  });

  describe('calculatePurchaseFrequency', () => {
    it('should calculate orders per year', () => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const frequency = calculatePurchaseFrequency(12, oneYearAgo);

      expect(frequency).toBeCloseTo(12, 0); // ~12 orders per year
    });

    it('should return 0 for null first order date', () => {
      const frequency = calculatePurchaseFrequency(10, null);

      expect(frequency).toBe(0);
    });

    it('should return order count for same day', () => {
      const today = new Date();

      const frequency = calculatePurchaseFrequency(5, today);

      expect(frequency).toBe(5);
    });

    it('should return 0 for 0 orders', () => {
      const frequency = calculatePurchaseFrequency(0, new Date('2023-01-01'));

      expect(frequency).toBe(0);
    });
  });

  describe('matchesSegmentRules', () => {
    it('should match total_spent greater than', () => {
      const customer = createSampleCustomer({ totalSpent: 60000 });
      const rules: SegmentRule[] = [
        { field: 'total_spent', operator: 'greater_than', value: 50000 },
      ];

      expect(matchesSegmentRules(customer, rules)).toBe(true);
    });

    it('should not match when below threshold', () => {
      const customer = createSampleCustomer({ totalSpent: 40000 });
      const rules: SegmentRule[] = [
        { field: 'total_spent', operator: 'greater_than', value: 50000 },
      ];

      expect(matchesSegmentRules(customer, rules)).toBe(false);
    });

    it('should match total_orders equals', () => {
      const customer = createSampleCustomer({ totalOrders: 5 });
      const rules: SegmentRule[] = [
        { field: 'total_orders', operator: 'equals', value: 5 },
      ];

      expect(matchesSegmentRules(customer, rules)).toBe(true);
    });

    it('should match source in list', () => {
      const customer = createSampleCustomer({ source: 'referral' });
      const rules: SegmentRule[] = [
        { field: 'source', operator: 'in', value: ['referral', 'organic'] },
      ];

      expect(matchesSegmentRules(customer, rules)).toBe(true);
    });

    it('should match marketing_consent boolean', () => {
      const customer = createSampleCustomer({ marketingConsent: true });
      const rules: SegmentRule[] = [
        { field: 'marketing_consent', operator: 'equals', value: true },
      ];

      expect(matchesSegmentRules(customer, rules)).toBe(true);
    });

    it('should match city', () => {
      const customer = createSampleCustomer();
      const rules: SegmentRule[] = [
        { field: 'city', operator: 'equals', value: 'Київ' },
      ];

      expect(matchesSegmentRules(customer, rules)).toBe(true);
    });

    it('should require all rules to match', () => {
      const customer = createSampleCustomer({ totalSpent: 60000, totalOrders: 5 });
      const rules: SegmentRule[] = [
        { field: 'total_spent', operator: 'greater_than', value: 50000 },
        { field: 'total_orders', operator: 'greater_or_equal', value: 10 }, // Fails
      ];

      expect(matchesSegmentRules(customer, rules)).toBe(false);
    });

    it('should match is_set operator', () => {
      const customer = createSampleCustomer({ phone: '+380501234567' });
      const rules: SegmentRule[] = [
        { field: 'has_phone', operator: 'is_set', value: true },
      ];

      expect(matchesSegmentRules(customer, rules)).toBe(true);
    });
  });

  describe('formatCustomerName', () => {
    it('should format full name', () => {
      const name = formatCustomerName({ firstName: 'Іван', lastName: 'Петренко' });

      expect(name).toBe('Іван Петренко');
    });

    it('should handle missing last name', () => {
      const name = formatCustomerName({ firstName: 'Іван', lastName: '' });

      expect(name).toBe('Іван');
    });

    it('should handle missing first name', () => {
      const name = formatCustomerName({ firstName: '', lastName: 'Петренко' });

      expect(name).toBe('Петренко');
    });
  });

  describe('formatCurrency', () => {
    it('should format UAH currency', () => {
      const formatted = formatCurrency(1000);

      expect(formatted).toContain('1');
      expect(formatted).toContain('000');
      expect(formatted).toContain('₴');
    });

    it('should handle zero', () => {
      const formatted = formatCurrency(0);

      expect(formatted).toContain('0');
    });
  });

  describe('generateReferralCode', () => {
    it('should generate code with REF prefix', () => {
      const code = generateReferralCode('cust-123');

      expect(code.startsWith('REF')).toBe(true);
    });

    it('should generate unique codes', () => {
      const codes = new Set<string>();

      for (let i = 0; i < 100; i++) {
        codes.add(generateReferralCode(`cust-${i}`));
      }

      expect(codes.size).toBe(100);
    });

    it('should be uppercase', () => {
      const code = generateReferralCode('cust-1');

      expect(code).toBe(code.toUpperCase());
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('no@domain')).toBe(false);
      expect(validateEmail('@nodomain.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('validateUkrainianPhone', () => {
    it('should validate correct Ukrainian phones', () => {
      expect(validateUkrainianPhone('+380501234567')).toBe(true);
      expect(validateUkrainianPhone('0501234567')).toBe(true);
      expect(validateUkrainianPhone('380501234567')).toBe(true);
    });

    it('should reject invalid phones', () => {
      expect(validateUkrainianPhone('12345')).toBe(false);
      expect(validateUkrainianPhone('+7999123456')).toBe(false);
      expect(validateUkrainianPhone('')).toBe(false);
    });

    it('should handle phones with spaces and dashes', () => {
      expect(validateUkrainianPhone('+38 050 123 45 67')).toBe(true);
      expect(validateUkrainianPhone('050-123-45-67')).toBe(true);
    });
  });

  describe('formatUkrainianPhone', () => {
    it('should format phone with +380 prefix', () => {
      const formatted = formatUkrainianPhone('0501234567');

      expect(formatted).toContain('+380');
    });

    it('should add spaces for readability', () => {
      const formatted = formatUkrainianPhone('+380501234567');

      expect(formatted).toContain(' ');
    });
  });

  describe('DEFAULT_SEGMENTS', () => {
    it('should have VIP segment', () => {
      const vipSegment = DEFAULT_SEGMENTS.find(s => s.name === 'VIP Customers');

      expect(vipSegment).toBeDefined();
      expect(vipSegment?.rules.length).toBeGreaterThan(0);
    });

    it('should have New Customers segment', () => {
      const newSegment = DEFAULT_SEGMENTS.find(s => s.name === 'New Customers');

      expect(newSegment).toBeDefined();
    });

    it('should have At Risk segment', () => {
      const atRiskSegment = DEFAULT_SEGMENTS.find(s => s.name === 'At Risk');

      expect(atRiskSegment).toBeDefined();
    });

    it('should have all required properties', () => {
      DEFAULT_SEGMENTS.forEach(segment => {
        expect(segment.name).toBeTruthy();
        expect(segment.nameUk).toBeTruthy();
        expect(segment.color).toBeTruthy();
        expect(segment.icon).toBeTruthy();
        expect(Array.isArray(segment.rules)).toBe(true);
        expect(typeof segment.isAutomatic).toBe('boolean');
      });
    });

    it('should have valid rules', () => {
      DEFAULT_SEGMENTS.forEach(segment => {
        segment.rules.forEach(rule => {
          expect(rule.field).toBeTruthy();
          expect(rule.operator).toBeTruthy();
          expect(rule.value !== undefined).toBe(true);
        });
      });
    });
  });

  describe('CUSTOMER_STATUS_LABELS', () => {
    it('should have all statuses', () => {
      expect(CUSTOMER_STATUS_LABELS.active).toBeDefined();
      expect(CUSTOMER_STATUS_LABELS.inactive).toBeDefined();
      expect(CUSTOMER_STATUS_LABELS.blocked).toBeDefined();
      expect(CUSTOMER_STATUS_LABELS.pending_verification).toBeDefined();
    });

    it('should have all required properties', () => {
      Object.values(CUSTOMER_STATUS_LABELS).forEach(label => {
        expect(label.en).toBeTruthy();
        expect(label.uk).toBeTruthy();
        expect(label.color).toBeTruthy();
      });
    });
  });

  describe('ACTIVITY_TYPE_LABELS', () => {
    it('should have common activity types', () => {
      expect(ACTIVITY_TYPE_LABELS.registration).toBeDefined();
      expect(ACTIVITY_TYPE_LABELS.login).toBeDefined();
      expect(ACTIVITY_TYPE_LABELS.order_placed).toBeDefined();
      expect(ACTIVITY_TYPE_LABELS.review_submitted).toBeDefined();
    });

    it('should have all required properties', () => {
      Object.values(ACTIVITY_TYPE_LABELS).forEach(label => {
        expect(label.en).toBeTruthy();
        expect(label.uk).toBeTruthy();
        expect(label.icon).toBeTruthy();
      });
    });
  });

  describe('Segment matching integration', () => {
    it('should match VIP customer', () => {
      const customer = createSampleCustomer({ totalSpent: 60000 });
      const vipSegment = DEFAULT_SEGMENTS.find(s => s.name === 'VIP Customers')!;

      expect(matchesSegmentRules(customer, vipSegment.rules)).toBe(true);
    });

    it('should match new customer', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 15);

      const customer = createSampleCustomer({
        createdAt: recentDate,
      });
      const newSegment = DEFAULT_SEGMENTS.find(s => s.name === 'New Customers')!;

      expect(matchesSegmentRules(customer, newSegment.rules)).toBe(true);
    });

    it('should match newsletter subscriber', () => {
      const customer = createSampleCustomer({ marketingConsent: true });
      const newsletterSegment = DEFAULT_SEGMENTS.find(s => s.name === 'Newsletter Subscribers')!;

      expect(matchesSegmentRules(customer, newsletterSegment.rules)).toBe(true);
    });
  });
});
