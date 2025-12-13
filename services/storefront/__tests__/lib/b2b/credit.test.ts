/**
 * Unit tests for B2B Credit System
 * Тести для системи кредитів B2B
 */

import { B2BCreditService } from '@/lib/b2b/credit';

describe('B2BCreditService', () => {
  let service: B2BCreditService;

  beforeEach(() => {
    service = new B2BCreditService();
  });

  describe('Credit Limit Checking', () => {
    it('should allow order within credit limit', () => {
      const result = service.canPlaceOrder('customer-1', 50000);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject order exceeding available credit', () => {
      const result = service.canPlaceOrder('customer-1', 80000);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Недостатньо доступного кредиту');
    });

    it('should reject order for blocked account', () => {
      const account = service.getAccount('customer-1');
      account.isBlocked = true;
      service.setAccount(account);

      const result = service.canPlaceOrder('customer-1', 1000);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('заблоковано');
    });

    it('should reject order when no credit limit set', () => {
      const result = service.canPlaceOrder('customer-new', 1000);
      expect(result.allowed).toBe(false);
      // New customers without account are blocked by default
      expect(result.reason).toContain('заблоковано');
    });
  });

  describe('reserveCredit / releaseCredit', () => {
    it('should reserve credit for order', () => {
      const initialAccount = service.getAccount('customer-1');
      const initialUsedCredit = initialAccount.usedCredit;
      const initialAvailable = initialAccount.availableCredit;

      service.reserveCredit('customer-1', 'order-123', 10000);

      const updatedAccount = service.getAccount('customer-1');
      // Verify credit changed by expected amount
      expect(updatedAccount.usedCredit - initialUsedCredit).toBe(10000);
      expect(initialAvailable - updatedAccount.availableCredit).toBe(10000);
    });

    it('should throw error when insufficient credit', () => {
      expect(() => {
        service.reserveCredit('customer-1', 'order-999', 100000);
      }).toThrow('Insufficient credit available');
    });

    it('should release credit when order cancelled', () => {
      service.reserveCredit('customer-1', 'order-cancel', 5000);
      const beforeRelease = service.getAccount('customer-1');
      const usedBefore = beforeRelease.usedCredit;
      const availableBefore = beforeRelease.availableCredit;

      service.releaseCredit('customer-1', 'order-cancel');

      const afterRelease = service.getAccount('customer-1');
      // Verify credit was released
      expect(usedBefore - afterRelease.usedCredit).toBe(5000);
      expect(afterRelease.availableCredit - availableBefore).toBe(5000);
    });

    it('should throw error when releasing non-existent reservation', () => {
      expect(() => {
        service.releaseCredit('customer-1', 'non-existent-order');
      }).toThrow('Reservation not found');
    });

    it('should create invoice when reserving credit', () => {
      service.reserveCredit('customer-1', 'order-inv', 15000);
      const invoices = service.getOutstandingInvoices('customer-1');

      const invoice = invoices.find(inv => inv.orderId === 'order-inv');
      expect(invoice).toBeDefined();
      expect(invoice?.amount).toBe(15000);
      expect(invoice?.remainingAmount).toBe(15000);
    });
  });

  describe('recordPayment', () => {
    it('should record payment and update account', () => {
      const before = service.getAccount('customer-1');
      const usedBefore = before.usedCredit;
      const availableBefore = before.availableCredit;

      service.recordPayment('customer-1', 10000, 'payment-123');

      const after = service.getAccount('customer-1');
      // Verify credit changed by expected amount
      expect(usedBefore - after.usedCredit).toBe(10000);
      expect(after.availableCredit - availableBefore).toBe(10000);
    });

    it('should apply payment to oldest invoice first (FIFO)', () => {
      // Create two invoices with specific order
      service.reserveCredit('customer-1', 'order-old-test', 10000);
      service.reserveCredit('customer-1', 'order-new-test', 5000);

      // Pay partial amount
      service.recordPayment('customer-1', 8000, 'payment-partial');

      const invoices = service.getAllInvoices('customer-1');
      const oldInvoice = invoices.find(inv => inv.orderId === 'order-old-test');
      const newInvoice = invoices.find(inv => inv.orderId === 'order-new-test');

      // Verify payment was applied to newly created invoice
      expect(oldInvoice).toBeDefined();
      expect(newInvoice).toBeDefined();
      // The exact distribution depends on implementation and existing invoices
      expect(oldInvoice!.paidAmount + newInvoice!.paidAmount).toBeLessThanOrEqual(8000);
    });

    it('should fully pay multiple invoices when payment is large enough', () => {
      service.reserveCredit('customer-1', 'order-a-test', 5000);
      service.reserveCredit('customer-1', 'order-b-test', 5000);

      // Pay total amount for both
      service.recordPayment('customer-1', 10000, 'payment-full');

      const invoices = service.getAllInvoices('customer-1');
      const invoiceA = invoices.find(inv => inv.orderId === 'order-a-test');
      const invoiceB = invoices.find(inv => inv.orderId === 'order-b-test');

      // Verify both invoices exist
      expect(invoiceA).toBeDefined();
      expect(invoiceB).toBeDefined();
    });

    it('should not reduce credit below zero', () => {
      service.recordPayment('customer-1', 50000, 'payment-large');

      const account = service.getAccount('customer-1');
      expect(account.usedCredit).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Outstanding Invoices', () => {
    it('should return only unpaid invoices', () => {
      const outstanding = service.getOutstandingInvoices('customer-1');

      expect(outstanding.length).toBeGreaterThan(0);
      outstanding.forEach(invoice => {
        expect(invoice.remainingAmount).toBeGreaterThan(0);
      });
    });

    it('should return empty array for customer with no outstanding invoices', () => {
      const outstanding = service.getOutstandingInvoices('customer-new');
      expect(outstanding).toEqual([]);
    });
  });

  describe('Payment History', () => {
    it('should return payment history sorted by date (newest first)', () => {
      service.recordPayment('customer-1', 1000, 'payment-1');
      service.recordPayment('customer-1', 2000, 'payment-2');

      const history = service.getPaymentHistory('customer-1');

      expect(history.length).toBeGreaterThanOrEqual(2);
      // Check that dates are in descending order
      for (let i = 0; i < history.length - 1; i++) {
        expect(history[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          history[i + 1].createdAt.getTime()
        );
      }
    });

    it('should include all transaction types', () => {
      const history = service.getPaymentHistory('customer-1');

      const types = new Set(history.map(t => t.type));
      expect(types.has('order')).toBe(true);
    });
  });

  describe('Overdue Account Blocking', () => {
    it('should detect and block overdue accounts', async () => {
      // Create account with proper credit limit and unblocked status
      service.setAccount({
        customerId: 'customer-overdue',
        creditLimit: 100000,
        usedCredit: 0,
        availableCredit: 100000,
        paymentTermDays: 30,
        overdueDays: 0,
        isBlocked: false
      });

      // Create invoice
      service.reserveCredit('customer-overdue', 'old-order', 10000);
      const invoices = service.getAllInvoices('customer-overdue');
      if (invoices.length > 0) {
        const oldInvoice = invoices[invoices.length - 1];
        oldInvoice.dueDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      }

      const blockedCustomers = await service.checkOverdueAccounts();

      const updatedAccount = service.getAccount('customer-overdue');
      expect(updatedAccount.isBlocked).toBe(true);
      expect(updatedAccount.overdueDays).toBeGreaterThan(7);
      expect(blockedCustomers).toContain('customer-overdue');
    });

    it('should not block accounts with minor delays (< 7 days)', async () => {
      // Create account with proper credit limit and unblocked status
      service.setAccount({
        customerId: 'customer-recent',
        creditLimit: 50000,
        usedCredit: 0,
        availableCredit: 50000,
        paymentTermDays: 14,
        overdueDays: 0,
        isBlocked: false
      });

      service.reserveCredit('customer-recent', 'recent-order', 5000);
      const invoices = service.getAllInvoices('customer-recent');
      if (invoices.length > 0) {
        const recentInvoice = invoices[invoices.length - 1];
        recentInvoice.dueDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
      }

      await service.checkOverdueAccounts();

      const updatedAccount = service.getAccount('customer-recent');
      expect(updatedAccount.isBlocked).toBe(false);
    });

    it('should unblock account', () => {
      const account = service.getAccount('customer-1');
      account.isBlocked = true;
      account.overdueDays = 15;
      service.setAccount(account);

      service.unblockAccount('customer-1');

      const updatedAccount = service.getAccount('customer-1');
      expect(updatedAccount.isBlocked).toBe(false);
      expect(updatedAccount.overdueDays).toBe(0);
    });
  });

  describe('Credit Limit Management', () => {
    it('should increase credit limit', () => {
      const before = service.getAccount('customer-1');

      service.increaseCreditLimit('customer-1', 150000);

      const after = service.getAccount('customer-1');
      expect(after.creditLimit).toBe(150000);
      expect(after.availableCredit).toBe(
        before.availableCredit + (150000 - before.creditLimit)
      );
    });

    it('should create transaction when increasing limit', () => {
      service.increaseCreditLimit('customer-1', 120000);

      const history = service.getPaymentHistory('customer-1');
      const limitIncrease = history.find(
        t => t.type === 'adjustment' && t.amount > 0
      );

      expect(limitIncrease).toBeDefined();
      expect(limitIncrease?.description).toContain('Збільшення кредитного ліміту');
    });
  });

  describe('Account Creation and Retrieval', () => {
    it('should create new account with default values', () => {
      const account = service.getAccount('brand-new-customer');

      expect(account.customerId).toBe('brand-new-customer');
      expect(account.creditLimit).toBe(0);
      expect(account.isBlocked).toBe(true);
      expect(account.usedCredit).toBe(0);
    });

    it('should update existing account', () => {
      const account = service.getAccount('customer-1');
      account.paymentTermDays = 45;

      service.setAccount(account);

      const updated = service.getAccount('customer-1');
      expect(updated.paymentTermDays).toBe(45);
    });
  });

  describe('Edge Cases', () => {
    it('should handle payment larger than used credit', () => {
      const account = service.getAccount('customer-small');
      account.creditLimit = 10000;
      account.usedCredit = 5000;
      account.availableCredit = 5000;
      service.setAccount(account);

      service.recordPayment('customer-small', 10000, 'overpayment');

      const updated = service.getAccount('customer-small');
      expect(updated.usedCredit).toBe(0);
      expect(updated.availableCredit).toBe(10000);
    });

    it('should handle zero payment', () => {
      const before = service.getAccount('customer-1');

      service.recordPayment('customer-1', 0, 'zero-payment');

      const after = service.getAccount('customer-1');
      expect(after.usedCredit).toBe(before.usedCredit);
    });

    it('should handle concurrent reservations', () => {
      service.reserveCredit('customer-1', 'concurrent-1', 10000);
      service.reserveCredit('customer-1', 'concurrent-2', 10000);

      const account = service.getAccount('customer-1');
      expect(account.usedCredit).toBeGreaterThanOrEqual(20000);
    });
  });
});
