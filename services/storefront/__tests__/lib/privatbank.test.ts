/**
 * Tests for PrivatBank payment integration
 */
import {
  calculateInstallmentPlans,
  createPayment,
  createInstallmentPayment,
  verifyCallback,
  getPaymentStatusText,
  isPaymentSuccessful,
  isPaymentPending,
  isPaymentFailed,
  PRIVATBANK_PAYMENT_METHOD,
} from '@/lib/privatbank';

describe('PrivatBank Integration', () => {
  describe('calculateInstallmentPlans', () => {
    it('should calculate monthly payment correctly', () => {
      const plans = calculateInstallmentPlans(12000);

      // 2 months plan: 12000 / 2 = 6000 per month
      const twoMonthPlan = plans.find(p => p.months === 2);
      expect(twoMonthPlan).toBeDefined();
      expect(twoMonthPlan?.monthlyPayment).toBe(6000);
      expect(twoMonthPlan?.totalAmount).toBe(12000);
    });

    it('should apply interest for longer plans', () => {
      const plans = calculateInstallmentPlans(10000);

      // 6 month plan has 2.5% interest rate
      const sixMonthPlan = plans.find(p => p.months === 6);
      expect(sixMonthPlan).toBeDefined();
      expect(sixMonthPlan!.totalAmount).toBeGreaterThan(10000);
    });

    it('should filter out plans below minimum amount', () => {
      const plans = calculateInstallmentPlans(400);

      // Minimum amount for installments is 500 UAH
      expect(plans.length).toBe(0);
    });

    it('should return all valid plans for sufficient amount', () => {
      const plans = calculateInstallmentPlans(10000);

      expect(plans.length).toBe(7); // 2, 3, 4, 6, 10, 12, 24 months
    });

    it('should have 0% rate for short-term plans', () => {
      const plans = calculateInstallmentPlans(5000);

      const shortTermPlans = plans.filter(p => p.months <= 4);
      for (const plan of shortTermPlans) {
        expect(plan.interestRate).toBe(0);
        expect(plan.totalAmount).toBe(5000);
      }
    });
  });

  describe('createPayment', () => {
    it('should create payment form data with correct structure', () => {
      const payment = createPayment({
        orderId: 'ORDER-123',
        amount: 1500,
        description: 'Test order',
      });

      expect(payment.url).toBeDefined();
      expect(payment.data).toBeDefined();
      expect(payment.data.data).toBeDefined();
      expect(payment.data.signature).toBeDefined();
    });

    it('should include customer info when provided', () => {
      const payment = createPayment({
        orderId: 'ORDER-123',
        amount: 1500,
        description: 'Test order',
        customerEmail: 'test@example.com',
        customerPhone: '+380501234567',
      });

      expect(payment.data.data).toBeDefined();
    });
  });

  describe('createInstallmentPayment', () => {
    it('should create installment payment with parts_count', () => {
      const payment = createInstallmentPayment({
        orderId: 'ORDER-456',
        amount: 12000,
        description: 'Test installment',
        months: 4,
        customerPhone: '+380501234567',
      });

      expect(payment.url).toContain('/parts');
      expect(payment.data.data).toBeDefined();
      expect(payment.data.signature).toBeDefined();
    });
  });

  describe('Payment status helpers', () => {
    it('should return correct status text in Ukrainian', () => {
      expect(getPaymentStatusText('success')).toBe('Оплачено');
      expect(getPaymentStatusText('failure')).toBe('Помилка оплати');
      expect(getPaymentStatusText('processing')).toBe('Обробка');
    });

    it('should identify successful payment', () => {
      expect(isPaymentSuccessful('success')).toBe(true);
      expect(isPaymentSuccessful('failure')).toBe(false);
      expect(isPaymentSuccessful('processing')).toBe(false);
    });

    it('should identify pending payment', () => {
      expect(isPaymentPending('created')).toBe(true);
      expect(isPaymentPending('processing')).toBe(true);
      expect(isPaymentPending('hold')).toBe(true);
      expect(isPaymentPending('success')).toBe(false);
    });

    it('should identify failed payment', () => {
      expect(isPaymentFailed('failure')).toBe(true);
      expect(isPaymentFailed('reversed')).toBe(true);
      expect(isPaymentFailed('success')).toBe(false);
    });
  });

  describe('PRIVATBANK_PAYMENT_METHOD configuration', () => {
    it('should have correct configuration', () => {
      expect(PRIVATBANK_PAYMENT_METHOD.id).toBe('privatbank');
      expect(PRIVATBANK_PAYMENT_METHOD.name).toBe('Приват24');
      expect(PRIVATBANK_PAYMENT_METHOD.enabled).toBe(true);
      expect(PRIVATBANK_PAYMENT_METHOD.popular).toBe(true);
    });
  });
});
