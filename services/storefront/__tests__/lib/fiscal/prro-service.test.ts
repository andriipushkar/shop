/**
 * Unit tests for ПРРО Service
 * Тести для сервісу ПРРО
 */

import { PRROService } from '@/lib/fiscal/prro-service';
import { CheckboxClient } from '@/lib/fiscal/checkbox-api';

// Mock CheckboxClient
jest.mock('@/lib/fiscal/checkbox-api');

describe('PRROService', () => {
  let service: PRROService;
  let mockCheckboxClient: jest.Mocked<CheckboxClient>;

  beforeEach(() => {
    mockCheckboxClient = {
      signIn: jest.fn(),
      getCashRegisters: jest.fn(),
      selectCashRegister: jest.fn(),
      getTaxes: jest.fn(),
      getCurrentShift: jest.fn(),
      openShift: jest.fn(),
      closeShift: jest.fn(),
      createReceipt: jest.fn(),
      createReturnReceipt: jest.fn(),
      searchReceipts: jest.fn(),
      getReceipt: jest.fn(),
      serviceDeposit: jest.fn(),
      serviceWithdraw: jest.fn(),
      formatAmount: jest.fn((amount) => Math.round(amount * 100)),
      parseAmount: jest.fn((kopecks) => kopecks / 100),
      ping: jest.fn(),
    } as any;

    (CheckboxClient as jest.Mock).mockImplementation(() => mockCheckboxClient);

    service = new PRROService({
      apiUrl: 'https://test.api',
      licenseKey: 'test-key',
      cashierLogin: 'test@test.com',
      cashierPassword: 'password',
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      mockCheckboxClient.signIn.mockResolvedValue(undefined);
      mockCheckboxClient.getCashRegisters.mockResolvedValue([
        {
          id: 'reg-1',
          fiscal_number: '12345',
          active: true,
          created_at: '2024-01-01T00:00:00Z',
        },
      ]);
      mockCheckboxClient.selectCashRegister.mockResolvedValue(undefined);
      mockCheckboxClient.getTaxes.mockResolvedValue([
        {
          id: '1',
          code: 1,
          label: 'ПДВ 20%',
          symbol: 'А',
          rate: 20,
          included: true,
        },
      ]);

      await service.initialize();

      expect(mockCheckboxClient.signIn).toHaveBeenCalled();
      expect(mockCheckboxClient.getCashRegisters).toHaveBeenCalled();
      expect(mockCheckboxClient.selectCashRegister).toHaveBeenCalledWith('reg-1');
      expect(mockCheckboxClient.getTaxes).toHaveBeenCalled();
    });

    it('should throw error when no active cash register found', async () => {
      mockCheckboxClient.signIn.mockResolvedValue(undefined);
      mockCheckboxClient.getCashRegisters.mockResolvedValue([
        {
          id: 'reg-1',
          fiscal_number: '12345',
          active: false,
          created_at: '2024-01-01T00:00:00Z',
        },
      ]);

      await expect(service.initialize()).rejects.toThrow(
        'No active cash register found'
      );
    });
  });

  describe('fiscalizeOrder', () => {
    beforeEach(async () => {
      mockCheckboxClient.signIn.mockResolvedValue(undefined);
      mockCheckboxClient.getCashRegisters.mockResolvedValue([
        {
          id: 'reg-1',
          fiscal_number: '12345',
          active: true,
          created_at: '2024-01-01T00:00:00Z',
        },
      ]);
      mockCheckboxClient.selectCashRegister.mockResolvedValue(undefined);
      mockCheckboxClient.getTaxes.mockResolvedValue([
        {
          id: '1',
          code: 1,
          label: 'ПДВ 20%',
          symbol: 'А',
          rate: 20,
          included: true,
        },
      ]);
      await service.initialize();
    });

    it('should fiscalize order successfully', async () => {
      const mockReceipt = {
        id: 'receipt-1',
        type: 'SELL' as const,
        fiscal_code: 'FISCAL123',
        fiscal_date: '2024-01-01T12:00:00Z',
        serial: 1,
        total_sum: 10000,
        total_payment: 10000,
        total_rest: 0,
        goods: [],
        payments: [],
        taxes: [],
        pdf_url: 'https://example.com/receipt.pdf',
        qr_code_url: 'https://example.com/qr',
        text: 'Receipt text',
      };

      mockCheckboxClient.createReceipt.mockResolvedValue(mockReceipt);

      const result = await service.fiscalizeOrder({
        orderId: 'order-1',
        items: [
          {
            sku: 'PROD-1',
            name: 'Test Product',
            price: 100,
            quantity: 1,
          },
        ],
        payments: [
          {
            type: 'cash',
            amount: 100,
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.fiscalCode).toBe('FISCAL123');
      expect(result.receiptId).toBe('receipt-1');
      expect(mockCheckboxClient.createReceipt).toHaveBeenCalled();
    });

    it('should handle fiscalization errors', async () => {
      mockCheckboxClient.createReceipt.mockRejectedValue(
        new Error('Network error')
      );

      const result = await service.fiscalizeOrder({
        orderId: 'order-1',
        items: [
          {
            sku: 'PROD-1',
            name: 'Test Product',
            price: 100,
            quantity: 1,
          },
        ],
        payments: [
          {
            type: 'cash',
            amount: 100,
          },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('fiscalizeReturn', () => {
    beforeEach(async () => {
      mockCheckboxClient.signIn.mockResolvedValue(undefined);
      mockCheckboxClient.getCashRegisters.mockResolvedValue([
        {
          id: 'reg-1',
          fiscal_number: '12345',
          active: true,
          created_at: '2024-01-01T00:00:00Z',
        },
      ]);
      mockCheckboxClient.selectCashRegister.mockResolvedValue(undefined);
      mockCheckboxClient.getTaxes.mockResolvedValue([
        {
          id: '1',
          code: 1,
          label: 'ПДВ 20%',
          symbol: 'А',
          rate: 20,
          included: true,
        },
      ]);
      await service.initialize();
    });

    it('should fiscalize return successfully', async () => {
      const originalReceipt = {
        id: 'receipt-1',
        type: 'SELL' as const,
        fiscal_code: 'FISCAL123',
        fiscal_date: '2024-01-01T12:00:00Z',
        serial: 1,
        total_sum: 10000,
        total_payment: 10000,
        total_rest: 0,
        goods: [],
        payments: [{ type: 'CASH' as const, value: 10000 }],
        taxes: [],
      };

      const returnReceipt = {
        id: 'receipt-return-1',
        type: 'RETURN' as const,
        fiscal_code: 'RETURN123',
        fiscal_date: '2024-01-02T12:00:00Z',
        serial: 2,
        total_sum: -10000,
        total_payment: -10000,
        total_rest: 0,
        goods: [],
        payments: [],
        taxes: [],
        pdf_url: 'https://example.com/return.pdf',
        qr_code_url: 'https://example.com/qr-return',
      };

      mockCheckboxClient.searchReceipts.mockResolvedValue([originalReceipt]);
      mockCheckboxClient.createReturnReceipt.mockResolvedValue(returnReceipt);

      const result = await service.fiscalizeReturn('FISCAL123', [
        {
          sku: 'PROD-1',
          name: 'Test Product',
          price: 100,
          quantity: 1,
        },
      ]);

      expect(result.success).toBe(true);
      expect(result.fiscalCode).toBe('RETURN123');
      expect(mockCheckboxClient.searchReceipts).toHaveBeenCalledWith({
        fiscal_code: 'FISCAL123',
      });
    });

    it('should handle receipt not found error', async () => {
      mockCheckboxClient.searchReceipts.mockResolvedValue([]);

      const result = await service.fiscalizeReturn('NOTFOUND', [
        {
          sku: 'PROD-1',
          name: 'Test Product',
          price: 100,
          quantity: 1,
        },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Shift Management', () => {
    beforeEach(async () => {
      mockCheckboxClient.signIn.mockResolvedValue(undefined);
      mockCheckboxClient.getCashRegisters.mockResolvedValue([
        {
          id: 'reg-1',
          fiscal_number: '12345',
          active: true,
          created_at: '2024-01-01T00:00:00Z',
        },
      ]);
      mockCheckboxClient.selectCashRegister.mockResolvedValue(undefined);
      mockCheckboxClient.getTaxes.mockResolvedValue([]);
      await service.initialize();
    });

    it('should open cashier shift', async () => {
      const mockShift = {
        id: 'shift-1',
        serial: 1,
        status: 'OPENED' as const,
        opened_at: '2024-01-01T10:00:00Z',
        initial_transaction: {
          id: 'txn-1',
          type: 'SHIFT_OPEN',
          datetime: '2024-01-01T10:00:00Z',
          balance: 0,
        },
        balance: 0,
        taxes: [],
      };

      mockCheckboxClient.openShift.mockResolvedValue(mockShift);

      const result = await service.openCashierShift('cashier-1');

      expect(result.id).toBe('shift-1');
      expect(result.status).toBe('OPENED');
      expect(mockCheckboxClient.openShift).toHaveBeenCalled();
    });

    it('should close cashier shift', async () => {
      const mockZReport = {
        id: 'zreport-1',
        serial: 1,
        fiscal_code: 'Z123',
        created_at: '2024-01-01T18:00:00Z',
        payments_sum: 100000,
        returns_sum: 0,
        receipts_count: 10,
        returns_count: 0,
        taxes: [],
      };

      mockCheckboxClient.closeShift.mockResolvedValue(mockZReport);

      const result = await service.closeCashierShift('cashier-1');

      expect(result.id).toBe('zreport-1');
      expect(result.receiptsCount).toBe(10);
      expect(mockCheckboxClient.closeShift).toHaveBeenCalled();
    });

    it('should get shift status when open', async () => {
      const mockShift = {
        id: 'shift-1',
        serial: 1,
        status: 'OPENED' as const,
        opened_at: '2024-01-01T10:00:00Z',
        initial_transaction: {
          id: 'txn-1',
          type: 'SHIFT_OPEN',
          datetime: '2024-01-01T10:00:00Z',
          balance: 0,
        },
        balance: 0,
        taxes: [],
      };

      mockCheckboxClient.getCurrentShift.mockResolvedValue(mockShift);

      const result = await service.getShiftStatus('cashier-1');

      expect(result.isOpen).toBe(true);
      expect(result.shift).toBeDefined();
    });

    it('should get shift status when closed', async () => {
      mockCheckboxClient.getCurrentShift.mockResolvedValue(null);

      const result = await service.getShiftStatus('cashier-1');

      expect(result.isOpen).toBe(false);
      expect(result.shift).toBeUndefined();
    });
  });

  describe('Service Operations', () => {
    beforeEach(async () => {
      mockCheckboxClient.signIn.mockResolvedValue(undefined);
      mockCheckboxClient.getCashRegisters.mockResolvedValue([
        {
          id: 'reg-1',
          fiscal_number: '12345',
          active: true,
          created_at: '2024-01-01T00:00:00Z',
        },
      ]);
      mockCheckboxClient.selectCashRegister.mockResolvedValue(undefined);
      mockCheckboxClient.getTaxes.mockResolvedValue([]);
      await service.initialize();
    });

    it('should deposit cash', async () => {
      const mockReceipt = {
        id: 'receipt-deposit',
        type: 'SELL' as const,
        fiscal_code: 'DEP123',
        fiscal_date: '2024-01-01T12:00:00Z',
        serial: 1,
        total_sum: 50000,
        total_payment: 50000,
        total_rest: 0,
        goods: [],
        payments: [],
        taxes: [],
        pdf_url: 'https://example.com/deposit.pdf',
        qr_code_url: 'https://example.com/qr-deposit',
      };

      mockCheckboxClient.serviceDeposit.mockResolvedValue(mockReceipt);

      const result = await service.depositCash(500);

      expect(result.success).toBe(true);
      expect(result.fiscalCode).toBe('DEP123');
      expect(mockCheckboxClient.serviceDeposit).toHaveBeenCalledWith(500);
    });

    it('should withdraw cash', async () => {
      const mockReceipt = {
        id: 'receipt-withdraw',
        type: 'SELL' as const,
        fiscal_code: 'WITH123',
        fiscal_date: '2024-01-01T12:00:00Z',
        serial: 1,
        total_sum: 20000,
        total_payment: 20000,
        total_rest: 0,
        goods: [],
        payments: [],
        taxes: [],
        pdf_url: 'https://example.com/withdraw.pdf',
        qr_code_url: 'https://example.com/qr-withdraw',
      };

      mockCheckboxClient.serviceWithdraw.mockResolvedValue(mockReceipt);

      const result = await service.withdrawCash(200);

      expect(result.success).toBe(true);
      expect(result.fiscalCode).toBe('WITH123');
      expect(mockCheckboxClient.serviceWithdraw).toHaveBeenCalledWith(200);
    });
  });

  describe('getReceiptByFiscalCode', () => {
    beforeEach(async () => {
      mockCheckboxClient.signIn.mockResolvedValue(undefined);
      mockCheckboxClient.getCashRegisters.mockResolvedValue([
        {
          id: 'reg-1',
          fiscal_number: '12345',
          active: true,
          created_at: '2024-01-01T00:00:00Z',
        },
      ]);
      mockCheckboxClient.selectCashRegister.mockResolvedValue(undefined);
      mockCheckboxClient.getTaxes.mockResolvedValue([]);
      await service.initialize();
    });

    it('should get receipt by fiscal code', async () => {
      const mockReceipt = {
        id: 'receipt-1',
        type: 'SELL' as const,
        fiscal_code: 'ABC123',
        fiscal_date: '2024-01-01T12:00:00Z',
        serial: 1,
        total_sum: 10000,
        total_payment: 10000,
        total_rest: 0,
        goods: [
          {
            good: {
              code: 'PROD-1',
              name: 'Test Product',
              price: 10000,
            },
            quantity: 1000,
          },
        ],
        payments: [{ type: 'CASH' as const, value: 10000 }],
        taxes: [],
        pdf_url: 'https://example.com/receipt.pdf',
        qr_code_url: 'https://example.com/qr',
      };

      mockCheckboxClient.searchReceipts.mockResolvedValue([mockReceipt]);

      const result = await service.getReceiptByFiscalCode('ABC123');

      expect(result).toBeDefined();
      expect(result?.fiscalCode).toBe('ABC123');
      expect(mockCheckboxClient.searchReceipts).toHaveBeenCalledWith({
        fiscal_code: 'ABC123',
      });
    });

    it('should return null when receipt not found', async () => {
      mockCheckboxClient.searchReceipts.mockResolvedValue([]);

      const result = await service.getReceiptByFiscalCode('NOTFOUND');

      expect(result).toBeNull();
    });
  });

  describe('Health Check', () => {
    it('should check service health', async () => {
      mockCheckboxClient.ping.mockResolvedValue(true);

      const result = await service.checkHealth();

      expect(result).toBe(true);
      expect(mockCheckboxClient.ping).toHaveBeenCalled();
    });

    it('should return false when health check fails', async () => {
      mockCheckboxClient.ping.mockResolvedValue(false);

      const result = await service.checkHealth();

      expect(result).toBe(false);
    });
  });
});
