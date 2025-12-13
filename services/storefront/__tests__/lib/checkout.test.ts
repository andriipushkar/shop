/**
 * Tests for Checkout System
 */

import {
  validateEmail,
  validatePhone,
  validateCustomerInfo,
  validateDeliveryInfo,
  validatePaymentInfo,
  calculateTotals,
  canProceedToStep,
  getInitialCheckoutState,
  formatDeliveryMethod,
  formatPaymentMethod,
  getDeliveryMethodsByProvider,
  formatAddress,
  getStepNumber,
  isStepComplete,
  CHECKOUT_STEPS,
  DELIVERY_METHODS,
  PAYMENT_METHODS,
  TIME_SLOTS,
  CHECKOUT_SESSION_DURATION,
  CheckoutState,
  CustomerInfo,
  DeliveryInfo,
  PaymentInfo,
  AddressInfo,
  CheckoutStep,
} from '../../lib/checkout';

describe('Checkout System', () => {
  // Sample checkout state
  const createSampleState = (overrides?: Partial<CheckoutState>): CheckoutState => ({
    step: 'customer',
    customer: {
      email: 'test@example.com',
      phone: '+380501234567',
      firstName: 'Іван',
      lastName: 'Петренко',
      isReturning: false,
    },
    delivery: {
      method: 'nova_poshta_warehouse',
      provider: 'nova_poshta',
      cityRef: 'city-1',
      cityName: 'Київ',
      warehouseRef: 'wh-1',
      warehouseName: 'Відділення №1',
      price: 50,
      isFree: false,
    },
    payment: {
      method: 'card',
    },
    cart: {
      items: [
        {
          id: 'item-1',
          productId: 'prod-1',
          name: 'Товар 1',
          price: 1000,
          quantity: 2,
          image: 'image.jpg',
          stock: 10,
          sku: 'SKU-001',
        },
      ],
      itemCount: 2,
      subtotal: 2000,
    },
    appliedCoupons: [],
    totals: {
      subtotal: 2000,
      discount: 0,
      delivery: 50,
      total: 2050,
      loyaltyPointsEarned: 205,
      loyaltyPointsUsed: 0,
    },
    errors: {},
    isGuest: true,
    saveInfo: false,
    ...overrides,
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

  describe('validatePhone', () => {
    it('should validate correct phone', () => {
      expect(validatePhone('+380501234567')).toBe(true);
      expect(validatePhone('0501234567')).toBe(true);
      expect(validatePhone('380501234567')).toBe(true);
    });

    it('should reject invalid phone', () => {
      expect(validatePhone('12345')).toBe(false);
      expect(validatePhone('')).toBe(false);
    });

    it('should accept phones with spaces and dashes', () => {
      expect(validatePhone('+38 050 123 45 67')).toBe(true);
      expect(validatePhone('050-123-45-67')).toBe(true);
    });
  });

  describe('validateCustomerInfo', () => {
    it('should pass for valid customer info', () => {
      const customer: CustomerInfo = {
        email: 'test@example.com',
        phone: '+380501234567',
        firstName: 'Іван',
        lastName: 'Петренко',
        isReturning: false,
      };

      const errors = validateCustomerInfo(customer);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should fail for invalid email', () => {
      const customer: CustomerInfo = {
        email: 'invalid-email',
        phone: '+380501234567',
        firstName: 'Іван',
        lastName: 'Петренко',
        isReturning: false,
      };

      const errors = validateCustomerInfo(customer);
      expect(errors.email).toBeTruthy();
    });

    it('should fail for missing required fields', () => {
      const customer: CustomerInfo = {
        email: '',
        phone: '',
        firstName: '',
        lastName: '',
        isReturning: false,
      };

      const errors = validateCustomerInfo(customer);
      expect(errors.email).toBeTruthy();
      expect(errors.phone).toBeTruthy();
      expect(errors.firstName).toBeTruthy();
      expect(errors.lastName).toBeTruthy();
    });

    it('should fail for invalid phone', () => {
      const customer: CustomerInfo = {
        email: 'test@example.com',
        phone: '12345',
        firstName: 'Іван',
        lastName: 'Петренко',
        isReturning: false,
      };

      const errors = validateCustomerInfo(customer);
      expect(errors.phone).toBeTruthy();
    });
  });

  describe('validateDeliveryInfo', () => {
    it('should pass for valid warehouse delivery', () => {
      const delivery: DeliveryInfo = {
        method: 'nova_poshta_warehouse',
        cityRef: 'city-1',
        cityName: 'Київ',
        warehouseRef: 'wh-1',
        warehouseName: 'Відділення №1',
        price: 50,
        isFree: false,
      };

      const errors = validateDeliveryInfo(delivery);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should pass for valid courier delivery', () => {
      const delivery: DeliveryInfo = {
        method: 'nova_poshta_courier',
        cityRef: 'city-1',
        cityName: 'Київ',
        address: {
          street: 'вул. Хрещатик',
          building: '1',
          apartment: '10',
          cityRef: 'city-1',
          cityName: 'Київ',
          isDefault: false,
        },
        price: 80,
        isFree: false,
      };

      const errors = validateDeliveryInfo(delivery);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should fail for warehouse delivery without warehouse', () => {
      const delivery: DeliveryInfo = {
        method: 'nova_poshta_warehouse',
        cityRef: 'city-1',
        cityName: 'Київ',
        price: 50,
        isFree: false,
      };

      const errors = validateDeliveryInfo(delivery);
      expect(errors.warehouse).toBeTruthy();
    });

    it('should fail for courier delivery without street', () => {
      const delivery: DeliveryInfo = {
        method: 'nova_poshta_courier',
        cityRef: 'city-1',
        cityName: 'Київ',
        address: {
          street: '',
          building: '',
          cityRef: 'city-1',
          cityName: 'Київ',
          isDefault: false,
        },
        price: 80,
        isFree: false,
      };

      const errors = validateDeliveryInfo(delivery);
      expect(errors.street).toBeTruthy();
      expect(errors.building).toBeTruthy();
    });

    it('should fail without method', () => {
      const delivery = { price: 50, isFree: false } as DeliveryInfo;

      const errors = validateDeliveryInfo(delivery);
      expect(errors.method).toBeTruthy();
    });
  });

  describe('validatePaymentInfo', () => {
    it('should pass for valid card payment', () => {
      const payment: PaymentInfo = {
        method: 'card',
      };

      const errors = validatePaymentInfo(payment);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should pass for cash on delivery', () => {
      const payment: PaymentInfo = {
        method: 'cash',
      };

      const errors = validatePaymentInfo(payment);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should fail without payment method', () => {
      const payment = {} as PaymentInfo;

      const errors = validatePaymentInfo(payment);
      expect(errors.method).toBeTruthy();
    });

    it('should fail for installment without months', () => {
      const payment: PaymentInfo = {
        method: 'installment',
      };

      const errors = validatePaymentInfo(payment);
      expect(errors.installmentMonths).toBeTruthy();
    });

    it('should pass for installment with months', () => {
      const payment: PaymentInfo = {
        method: 'installment',
        installmentMonths: 3,
      };

      const errors = validatePaymentInfo(payment);
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('calculateTotals', () => {
    it('should calculate totals correctly', () => {
      const state = createSampleState();
      const totals = calculateTotals(state);

      expect(totals.subtotal).toBe(2000);
      expect(totals.delivery).toBe(50);
      expect(totals.total).toBe(2050);
    });

    it('should apply percent coupon discount', () => {
      const state = createSampleState({
        appliedCoupons: [{ code: 'SALE20', type: 'percent', value: 20, discount: 400, description: '20% off' }],
      });

      const totals = calculateTotals(state);

      expect(totals.discount).toBe(400);
      expect(totals.total).toBe(1650); // 2000 - 400 + 50
    });

    it('should apply fixed coupon discount', () => {
      const state = createSampleState({
        appliedCoupons: [{ code: 'SAVE100', type: 'fixed', value: 100, discount: 100, description: '100 UAH off' }],
      });

      const totals = calculateTotals(state);

      expect(totals.discount).toBe(100);
      expect(totals.total).toBe(1950); // 2000 - 100 + 50
    });

    it('should apply free shipping coupon', () => {
      const state = createSampleState({
        appliedCoupons: [{ code: 'FREESHIP', type: 'free_shipping', value: 0, discount: 0, description: 'Free shipping' }],
      });

      const totals = calculateTotals(state);

      expect(totals.delivery).toBe(0);
      expect(totals.total).toBe(2000);
    });

    it('should handle free delivery flag', () => {
      const state = createSampleState();
      state.delivery!.isFree = true;

      const totals = calculateTotals(state);

      expect(totals.delivery).toBe(0);
    });

    it('should calculate loyalty points earned', () => {
      const state = createSampleState();

      const totals = calculateTotals(state);

      // 1 point per 10 UAH on total
      expect(totals.loyaltyPointsEarned).toBeGreaterThan(0);
    });
  });

  describe('canProceedToStep', () => {
    it('should allow going back to previous step', () => {
      const state = createSampleState({ step: 'payment' });

      expect(canProceedToStep(state, 'customer')).toBe(true);
      expect(canProceedToStep(state, 'delivery')).toBe(true);
    });

    it('should allow proceeding when previous steps are valid', () => {
      const state = createSampleState({ step: 'customer' });

      expect(canProceedToStep(state, 'delivery')).toBe(true);
    });

    it('should not allow skipping steps with invalid data', () => {
      const state = createSampleState({
        step: 'customer',
        customer: { email: '', phone: '', firstName: '', lastName: '', isReturning: false },
      });

      expect(canProceedToStep(state, 'delivery')).toBe(false);
    });
  });

  describe('getInitialCheckoutState', () => {
    it('should return initial state with default values', () => {
      const state = getInitialCheckoutState();

      expect(state.step).toBe('customer');
      expect(state.customer).toBeNull();
      expect(state.delivery).toBeNull();
      expect(state.payment).toBeNull();
      expect(state.isGuest).toBe(true);
      expect(state.appliedCoupons).toEqual([]);
    });
  });

  describe('formatDeliveryMethod', () => {
    it('should format Nova Poshta warehouse', () => {
      const formatted = formatDeliveryMethod('nova_poshta_warehouse');

      expect(formatted.nameUk).toContain('Нової Пошти');
    });

    it('should return method name for unknown method', () => {
      const formatted = formatDeliveryMethod('unknown' as any);

      expect(formatted.name).toBe('unknown');
    });
  });

  describe('formatPaymentMethod', () => {
    it('should format card payment', () => {
      const formatted = formatPaymentMethod('card');

      expect(formatted.nameUk).toBeTruthy();
    });

    it('should format cash payment', () => {
      const formatted = formatPaymentMethod('cash');

      expect(formatted.nameUk).toContain('отриманні');
    });
  });

  describe('getDeliveryMethodsByProvider', () => {
    it('should return Nova Poshta methods', () => {
      const methods = getDeliveryMethodsByProvider('nova_poshta');

      expect(methods.length).toBeGreaterThan(0);
      methods.forEach(m => {
        expect(m.provider).toBe('nova_poshta');
      });
    });

    it('should return empty for unknown provider', () => {
      const methods = getDeliveryMethodsByProvider('unknown');

      expect(methods).toHaveLength(0);
    });
  });

  describe('formatAddress', () => {
    it('should format full address', () => {
      const address: AddressInfo = {
        cityName: 'Київ',
        street: 'вул. Хрещатик',
        building: '1',
        apartment: '10',
        cityRef: 'city-1',
        isDefault: false,
      };

      const formatted = formatAddress(address);

      expect(formatted).toContain('Київ');
      expect(formatted).toContain('Хрещатик');
      expect(formatted).toContain('буд. 1');
      expect(formatted).toContain('кв. 10');
    });

    it('should format address without apartment', () => {
      const address: AddressInfo = {
        cityName: 'Київ',
        street: 'вул. Хрещатик',
        building: '1',
        cityRef: 'city-1',
        isDefault: false,
      };

      const formatted = formatAddress(address);

      expect(formatted).toContain('Київ');
      expect(formatted).not.toContain('кв.');
    });
  });

  describe('getStepNumber', () => {
    it('should return correct step numbers', () => {
      expect(getStepNumber('customer')).toBe(1);
      expect(getStepNumber('delivery')).toBe(2);
      expect(getStepNumber('payment')).toBe(3);
      expect(getStepNumber('review')).toBe(4);
      expect(getStepNumber('complete')).toBe(5);
    });
  });

  describe('isStepComplete', () => {
    it('should return true for completed steps', () => {
      const state = createSampleState({ step: 'review' });

      expect(isStepComplete(state, 'customer')).toBe(true);
      expect(isStepComplete(state, 'delivery')).toBe(true);
      expect(isStepComplete(state, 'payment')).toBe(true);
    });

    it('should return false for current and future steps', () => {
      const state = createSampleState({ step: 'delivery' });

      expect(isStepComplete(state, 'delivery')).toBe(false);
      expect(isStepComplete(state, 'payment')).toBe(false);
    });
  });

  describe('CHECKOUT_STEPS', () => {
    it('should have 4 steps', () => {
      expect(CHECKOUT_STEPS).toHaveLength(4);
    });

    it('should have all required properties', () => {
      CHECKOUT_STEPS.forEach(step => {
        expect(step.step).toBeTruthy();
        expect(step.label).toBeTruthy();
        expect(step.labelUk).toBeTruthy();
      });
    });
  });

  describe('DELIVERY_METHODS', () => {
    it('should have multiple methods', () => {
      expect(DELIVERY_METHODS.length).toBeGreaterThan(0);
    });

    it('should have all required properties', () => {
      DELIVERY_METHODS.forEach(method => {
        expect(method.method).toBeTruthy();
        expect(method.provider).toBeTruthy();
        expect(method.name).toBeTruthy();
        expect(method.nameUk).toBeTruthy();
        expect(method.estimatedDays).toBeTruthy();
        expect(method.icon).toBeTruthy();
      });
    });

    it('should include Nova Poshta options', () => {
      expect(DELIVERY_METHODS.some(m => m.method.includes('nova_poshta'))).toBe(true);
    });

    it('should have unique methods', () => {
      const methods = DELIVERY_METHODS.map(m => m.method);
      const uniqueMethods = new Set(methods);

      expect(uniqueMethods.size).toBe(methods.length);
    });
  });

  describe('PAYMENT_METHODS', () => {
    it('should have multiple methods', () => {
      expect(PAYMENT_METHODS.length).toBeGreaterThan(0);
    });

    it('should have all required properties', () => {
      PAYMENT_METHODS.forEach(method => {
        expect(method.method).toBeTruthy();
        expect(method.name).toBeTruthy();
        expect(method.nameUk).toBeTruthy();
        expect(method.icon).toBeTruthy();
      });
    });

    it('should include standard payment options', () => {
      expect(PAYMENT_METHODS.some(m => m.method === 'card')).toBe(true);
      expect(PAYMENT_METHODS.some(m => m.method === 'cash')).toBe(true);
    });

    it('should have unique methods', () => {
      const methods = PAYMENT_METHODS.map(m => m.method);
      const uniqueMethods = new Set(methods);

      expect(uniqueMethods.size).toBe(methods.length);
    });
  });

  describe('TIME_SLOTS', () => {
    it('should have multiple time slots', () => {
      expect(TIME_SLOTS.length).toBeGreaterThan(0);
    });

    it('should have all required properties', () => {
      TIME_SLOTS.forEach(slot => {
        expect(slot.id).toBeTruthy();
        expect(slot.start).toBeTruthy();
        expect(slot.end).toBeTruthy();
        expect(slot.label).toBeTruthy();
        expect(slot.labelUk).toBeTruthy();
      });
    });
  });

  describe('CHECKOUT_SESSION_DURATION', () => {
    it('should be 30 minutes in milliseconds', () => {
      expect(CHECKOUT_SESSION_DURATION).toBe(30 * 60 * 1000);
    });
  });
});
