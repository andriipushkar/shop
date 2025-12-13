/**
 * B2B Credit System
 * Кредитні ліміти для оптових клієнтів
 */

import type { CreditAccount, CreditTransaction, Invoice } from './types';

export class B2BCreditService {
  private accounts: Map<string, CreditAccount> = new Map();
  private transactions: Map<string, CreditTransaction[]> = new Map();
  private invoices: Map<string, Invoice[]> = new Map();
  private orderReservations: Map<string, { orderId: string; amount: number }[]> = new Map();

  constructor() {
    // Initialize with mock data for demonstration
    this.initializeMockData();
  }

  private initializeMockData() {
    // Mock credit account
    this.accounts.set('customer-1', {
      customerId: 'customer-1',
      creditLimit: 100000,
      usedCredit: 25000,
      availableCredit: 75000,
      paymentTermDays: 30,
      overdueDays: 0,
      isBlocked: false
    });

    // Mock invoices
    this.invoices.set('customer-1', [
      {
        id: 'inv-1',
        customerId: 'customer-1',
        orderId: 'order-1',
        amount: 15000,
        paidAmount: 0,
        remainingAmount: 15000,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        isOverdue: false,
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'inv-2',
        customerId: 'customer-1',
        orderId: 'order-2',
        amount: 10000,
        paidAmount: 0,
        remainingAmount: 10000,
        dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days from now
        isOverdue: false,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      }
    ]);

    // Mock transactions
    this.transactions.set('customer-1', [
      {
        id: 'txn-1',
        customerId: 'customer-1',
        type: 'order',
        amount: -15000,
        orderId: 'order-1',
        description: 'Замовлення #ORD-001',
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'txn-2',
        customerId: 'customer-1',
        type: 'order',
        amount: -10000,
        orderId: 'order-2',
        description: 'Замовлення #ORD-002',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
      }
    ]);
  }

  /**
   * Get credit account
   * Отримати кредитний рахунок
   */
  getAccount(customerId: string): CreditAccount {
    const account = this.accounts.get(customerId);

    if (!account) {
      // Return default account with no credit
      return {
        customerId,
        creditLimit: 0,
        usedCredit: 0,
        availableCredit: 0,
        paymentTermDays: 0,
        overdueDays: 0,
        isBlocked: true
      };
    }

    return account;
  }

  /**
   * Create or update credit account
   * Створити або оновити кредитний рахунок
   */
  setAccount(account: CreditAccount): void {
    this.accounts.set(account.customerId, account);
  }

  /**
   * Check if order can be placed on credit
   * Перевірити чи можна розмістити замовлення в кредит
   */
  canPlaceOrder(customerId: string, orderTotal: number): { allowed: boolean; reason?: string } {
    const account = this.getAccount(customerId);

    if (account.isBlocked) {
      return {
        allowed: false,
        reason: 'Рахунок заблоковано через прострочення платежів'
      };
    }

    if (account.creditLimit === 0) {
      return {
        allowed: false,
        reason: 'Кредитний ліміт не встановлено'
      };
    }

    if (account.availableCredit < orderTotal) {
      return {
        allowed: false,
        reason: `Недостатньо доступного кредиту. Доступно: ${account.availableCredit.toFixed(2)} грн, потрібно: ${orderTotal.toFixed(2)} грн`
      };
    }

    return { allowed: true };
  }

  /**
   * Reserve credit for order
   * Зарезервувати кредит для замовлення
   */
  reserveCredit(customerId: string, orderId: string, amount: number): void {
    const account = this.getAccount(customerId);

    if (account.availableCredit < amount) {
      throw new Error('Insufficient credit available');
    }

    // Update account
    account.usedCredit += amount;
    account.availableCredit -= amount;
    this.accounts.set(customerId, account);

    // Add reservation
    const reservations = this.orderReservations.get(customerId) || [];
    reservations.push({ orderId, amount });
    this.orderReservations.set(customerId, reservations);

    // Create transaction
    const transaction: CreditTransaction = {
      id: `txn-${Date.now()}`,
      customerId,
      type: 'order',
      amount: -amount,
      orderId,
      description: `Замовлення ${orderId}`,
      createdAt: new Date(),
      dueDate: new Date(Date.now() + account.paymentTermDays * 24 * 60 * 60 * 1000)
    };

    const transactions = this.transactions.get(customerId) || [];
    transactions.push(transaction);
    this.transactions.set(customerId, transactions);

    // Create invoice
    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      customerId,
      orderId,
      amount,
      paidAmount: 0,
      remainingAmount: amount,
      dueDate: transaction.dueDate!,
      isOverdue: false,
      createdAt: new Date()
    };

    const invoices = this.invoices.get(customerId) || [];
    invoices.push(invoice);
    this.invoices.set(customerId, invoices);
  }

  /**
   * Release credit (order cancelled)
   * Звільнити кредит (замовлення скасовано)
   */
  releaseCredit(customerId: string, orderId: string): void {
    const reservations = this.orderReservations.get(customerId) || [];
    const reservation = reservations.find(r => r.orderId === orderId);

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    const account = this.getAccount(customerId);
    account.usedCredit -= reservation.amount;
    account.availableCredit += reservation.amount;
    this.accounts.set(customerId, account);

    // Remove reservation
    const updatedReservations = reservations.filter(r => r.orderId !== orderId);
    this.orderReservations.set(customerId, updatedReservations);

    // Create adjustment transaction
    const transaction: CreditTransaction = {
      id: `txn-${Date.now()}`,
      customerId,
      type: 'adjustment',
      amount: reservation.amount,
      orderId,
      description: `Скасування замовлення ${orderId}`,
      createdAt: new Date()
    };

    const transactions = this.transactions.get(customerId) || [];
    transactions.push(transaction);
    this.transactions.set(customerId, transactions);

    // Remove or cancel invoice
    const invoices = this.invoices.get(customerId) || [];
    const updatedInvoices = invoices.filter(inv => inv.orderId !== orderId);
    this.invoices.set(customerId, updatedInvoices);
  }

  /**
   * Record payment
   * Зареєструвати платіж
   */
  recordPayment(customerId: string, amount: number, paymentId: string): void {
    const account = this.getAccount(customerId);

    // Update account
    account.usedCredit = Math.max(0, account.usedCredit - amount);
    account.availableCredit = account.creditLimit - account.usedCredit;
    this.accounts.set(customerId, account);

    // Create payment transaction
    const transaction: CreditTransaction = {
      id: `txn-${Date.now()}`,
      customerId,
      type: 'payment',
      amount,
      paymentId,
      description: `Платіж ${paymentId}`,
      createdAt: new Date()
    };

    const transactions = this.transactions.get(customerId) || [];
    transactions.push(transaction);
    this.transactions.set(customerId, transactions);

    // Update invoices (FIFO - oldest first)
    const invoices = this.invoices.get(customerId) || [];
    let remainingPayment = amount;

    for (const invoice of invoices.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
      if (remainingPayment <= 0) break;
      if (invoice.remainingAmount <= 0) continue;

      const paymentForInvoice = Math.min(remainingPayment, invoice.remainingAmount);
      invoice.paidAmount += paymentForInvoice;
      invoice.remainingAmount -= paymentForInvoice;
      remainingPayment -= paymentForInvoice;
    }

    this.invoices.set(customerId, invoices);
  }

  /**
   * Get outstanding invoices
   * Отримати незакриті рахунки
   */
  getOutstandingInvoices(customerId: string): Invoice[] {
    const invoices = this.invoices.get(customerId) || [];
    return invoices.filter(inv => inv.remainingAmount > 0);
  }

  /**
   * Get payment history
   * Отримати історію платежів
   */
  getPaymentHistory(customerId: string): CreditTransaction[] {
    const transactions = this.transactions.get(customerId) || [];
    return transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get all invoices (including paid)
   * Отримати всі рахунки (включно з оплаченими)
   */
  getAllInvoices(customerId: string): Invoice[] {
    const invoices = this.invoices.get(customerId) || [];
    return invoices.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Check and block overdue accounts (cron job)
   * Перевірити та заблокувати прострочені рахунки (cron задача)
   */
  async checkOverdueAccounts(): Promise<string[]> {
    const blockedCustomers: string[] = [];
    const now = new Date();

    for (const [customerId, account] of this.accounts) {
      const invoices = this.invoices.get(customerId) || [];
      let maxOverdueDays = 0;

      for (const invoice of invoices) {
        if (invoice.remainingAmount > 0 && invoice.dueDate < now) {
          const overdueDays = Math.floor(
            (now.getTime() - invoice.dueDate.getTime()) / (24 * 60 * 60 * 1000)
          );
          maxOverdueDays = Math.max(maxOverdueDays, overdueDays);
          invoice.isOverdue = true;
        }
      }

      account.overdueDays = maxOverdueDays;

      // Block if overdue more than 7 days
      if (maxOverdueDays > 7 && !account.isBlocked) {
        account.isBlocked = true;
        blockedCustomers.push(customerId);
      }

      this.accounts.set(customerId, account);
      this.invoices.set(customerId, invoices);
    }

    return blockedCustomers;
  }

  /**
   * Unblock customer account
   * Розблокувати рахунок клієнта
   */
  unblockAccount(customerId: string): void {
    const account = this.getAccount(customerId);
    account.isBlocked = false;
    account.overdueDays = 0;
    this.accounts.set(customerId, account);
  }

  /**
   * Increase credit limit
   * Збільшити кредитний ліміт
   */
  increaseCreditLimit(customerId: string, newLimit: number): void {
    const account = this.getAccount(customerId);
    const increase = newLimit - account.creditLimit;
    account.creditLimit = newLimit;
    account.availableCredit += increase;
    this.accounts.set(customerId, account);

    // Create adjustment transaction
    const transaction: CreditTransaction = {
      id: `txn-${Date.now()}`,
      customerId,
      type: 'adjustment',
      amount: increase,
      description: `Збільшення кредитного ліміту до ${newLimit} грн`,
      createdAt: new Date()
    };

    const transactions = this.transactions.get(customerId) || [];
    transactions.push(transaction);
    this.transactions.set(customerId, transactions);
  }
}

// Singleton instance
export const creditService = new B2BCreditService();
