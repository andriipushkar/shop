/**
 * Unit tests for Checkbox API Client
 * Тести для клієнта Checkbox API
 */

import { CheckboxClient, type CheckboxConfig } from '@/lib/fiscal/checkbox-api';

// Mock fetch globally
global.fetch = jest.fn();

// Helper function to create mock response with headers
const createMockResponse = (data: unknown, ok = true, status = 200, statusText = 'OK') => ({
  ok,
  status,
  statusText,
  headers: {
    get: (name: string) => {
      if (name.toLowerCase() === 'content-type') {
        return 'application/json';
      }
      return null;
    },
  },
  json: async () => data,
});

describe('CheckboxClient', () => {
  let client: CheckboxClient;
  let mockConfig: CheckboxConfig;

  beforeEach(() => {
    mockConfig = {
      apiUrl: 'https://api.checkbox.test/api/v1',
      licenseKey: 'test-license-key',
      cashierLogin: 'test@example.com',
      cashierPassword: 'testpassword',
    };
    client = new CheckboxClient(mockConfig);
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should sign in successfully', async () => {
      const mockAuthResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(mockAuthResponse));

      await client.signIn();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/cashier/signin'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            login: mockConfig.cashierLogin,
            password: mockConfig.cashierPassword,
          }),
        })
      );
    });

    it('should sign out and clear tokens', async () => {
      // First sign in
      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_type: 'Bearer',
        expires_in: 3600,
      }));
      await client.signIn();

      // Then sign out
      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse({}));

      await client.signOut();

      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/cashier/signout'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should refresh access token', async () => {
      // First sign in
      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse({
        access_token: 'initial-token',
        refresh_token: 'initial-refresh',
        token_type: 'Bearer',
        expires_in: 3600,
      }));

      await client.signIn();

      // Then refresh
      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse({
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        token_type: 'Bearer',
        expires_in: 3600,
      }));

      await client.refreshAccessToken();

      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/cashier/refresh'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('initial-refresh'),
        })
      );
    });

    it('should throw error when refreshing without refresh token', async () => {
      await expect(client.refreshAccessToken()).rejects.toThrow(
        'No refresh token available'
      );
    });
  });

  describe('Cash Register Operations', () => {
    beforeEach(async () => {
      // Sign in first
      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_type: 'Bearer',
        expires_in: 3600,
      }));
      await client.signIn();
    });

    it('should get cash registers', async () => {
      const mockRegisters = {
        results: [
          {
            id: 'reg-1',
            fiscal_number: '12345',
            active: true,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(mockRegisters));

      const registers = await client.getCashRegisters();

      expect(registers).toHaveLength(1);
      expect(registers[0].id).toBe('reg-1');
    });

    it('should select cash register', async () => {
      await client.selectCashRegister('reg-1');
      expect(client.getSelectedCashRegister()).toBe('reg-1');
    });

    it('should throw error when no cash register selected', async () => {
      await expect(client.openShift()).rejects.toThrow(
        'No cash register selected'
      );
    });
  });

  describe('Shift Operations', () => {
    beforeEach(async () => {
      // Sign in and select register
      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_type: 'Bearer',
        expires_in: 3600,
      }));
      await client.signIn();
      await client.selectCashRegister('reg-1');
    });

    it('should open shift', async () => {
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

      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(mockShift));

      const shift = await client.openShift();

      expect(shift.id).toBe('shift-1');
      expect(shift.status).toBe('OPENED');
    });

    it('should get current shift', async () => {
      const mockResponse = {
        results: [
          {
            id: 'shift-1',
            serial: 1,
            status: 'OPENED',
            opened_at: '2024-01-01T10:00:00Z',
            initial_transaction: {
              id: 'txn-1',
              type: 'SHIFT_OPEN',
              datetime: '2024-01-01T10:00:00Z',
              balance: 0,
            },
            balance: 0,
            taxes: [],
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(mockResponse));

      const shift = await client.getCurrentShift();

      expect(shift).toBeTruthy();
      expect(shift?.status).toBe('OPENED');
    });

    it('should return null when no shift is open', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse({ results: [] }));

      const shift = await client.getCurrentShift();

      expect(shift).toBeNull();
    });

    it('should get shift status', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse({ results: [] }));

      const status = await client.getShiftStatus();

      expect(status).toBe('NONE');
    });

    it('should close shift', async () => {
      // Mock getting current shift
      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse({
        results: [
          {
            id: 'shift-1',
            serial: 1,
            status: 'OPENED',
            opened_at: '2024-01-01T10:00:00Z',
            initial_transaction: { id: 'txn-1', type: 'SHIFT_OPEN', datetime: '2024-01-01T10:00:00Z', balance: 0 },
            balance: 1000,
            taxes: [],
          },
        ],
      }));

      // Mock closing shift
      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse({
        id: 'zreport-1',
        serial: 1,
        created_at: '2024-01-01T18:00:00Z',
        payments_sum: 10000,
        returns_sum: 0,
        receipts_count: 10,
        returns_count: 0,
        taxes: [],
      }));

      const zReport = await client.closeShift();

      expect(zReport.id).toBe('zreport-1');
      expect(zReport.receipts_count).toBe(10);
    });
  });

  describe('Receipt Operations', () => {
    beforeEach(async () => {
      // Setup: sign in, select register, open shift
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(createMockResponse({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          token_type: 'Bearer',
          expires_in: 3600,
        }))
        .mockResolvedValueOnce(createMockResponse({
          results: [
            {
              id: 'shift-1',
              serial: 1,
              status: 'OPENED',
              opened_at: '2024-01-01T10:00:00Z',
              initial_transaction: { id: 'txn-1', type: 'SHIFT_OPEN', datetime: '2024-01-01T10:00:00Z', balance: 0 },
              balance: 0,
              taxes: [],
            },
          ],
        }));

      await client.signIn();
      await client.selectCashRegister('reg-1');
    });

    it('should create receipt', async () => {
      const mockReceipt = {
        id: 'receipt-1',
        type: 'SELL' as const,
        fiscal_code: 'ABC123',
        fiscal_date: '2024-01-01T12:00:00Z',
        serial: 1,
        total_sum: 10000,
        total_payment: 10000,
        total_rest: 0,
        goods: [],
        payments: [],
        taxes: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(mockReceipt));

      const receiptRequest = {
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
        payments: [
          {
            type: 'CASH' as const,
            value: 10000,
          },
        ],
      };

      const receipt = await client.createReceipt(receiptRequest);

      expect(receipt.id).toBe('receipt-1');
      expect(receipt.fiscal_code).toBe('ABC123');
    });

    it('should throw error when creating receipt without open shift', async () => {
      // Create a fresh client without pre-setup shift
      const freshClient = new CheckboxClient(mockConfig);

      // Sign in
      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_type: 'Bearer',
        expires_in: 3600,
      }));
      await freshClient.signIn();
      await freshClient.selectCashRegister('reg-1');

      // Mock no open shift for getCurrentShift
      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse({ results: [] }));

      const receiptRequest = {
        goods: [],
        payments: [],
      };

      await expect(freshClient.createReceipt(receiptRequest)).rejects.toThrow(
        'No open shift'
      );
    });
  });

  describe('Amount Conversion', () => {
    it('should format UAH to kopecks', () => {
      expect(client.formatAmount(100)).toBe(10000);
      expect(client.formatAmount(1.5)).toBe(150);
      expect(client.formatAmount(0.01)).toBe(1);
    });

    it('should parse kopecks to UAH', () => {
      expect(client.parseAmount(10000)).toBe(100);
      expect(client.parseAmount(150)).toBe(1.5);
      expect(client.parseAmount(1)).toBe(0.01);
    });

    it('should handle rounding in formatAmount', () => {
      expect(client.formatAmount(1.999)).toBe(200);
      expect(client.formatAmount(1.994)).toBe(199);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_type: 'Bearer',
        expires_in: 3600,
      }));
      await client.signIn();
    });

    it('should handle API errors with message', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse({ message: 'Invalid request' }, false, 400, 'Bad Request')
      );

      await expect(client.getCashRegisters()).rejects.toThrow('Invalid request');
    });

    it('should handle API errors with detail', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        createMockResponse({ detail: 'Validation error' }, false, 400, 'Bad Request')
      );

      await expect(client.getCashRegisters()).rejects.toThrow('Validation error');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(client.getCashRegisters()).rejects.toThrow('Network error');
    });
  });

  describe('Utility Methods', () => {
    it('should ping server', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse({}));

      const result = await client.ping();

      expect(result).toBe(true);
    });

    it('should return false when ping fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      const result = await client.ping();

      expect(result).toBe(false);
    });

    it('should generate fiscal QR URL', () => {
      const fiscalCode = 'ABC123DEF456';
      const url = client.generateFiscalQrUrl(fiscalCode);

      expect(url).toBe(`https://cabinet.tax.gov.ua/cashregs/check?id=${fiscalCode}`);
    });
  });

  describe('Service Operations', () => {
    beforeEach(async () => {
      // Setup: sign in, select register, open shift
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(createMockResponse({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          token_type: 'Bearer',
          expires_in: 3600,
        }))
        .mockResolvedValueOnce(createMockResponse({
          results: [
            {
              id: 'shift-1',
              serial: 1,
              status: 'OPENED',
              opened_at: '2024-01-01T10:00:00Z',
              initial_transaction: { id: 'txn-1', type: 'SHIFT_OPEN', datetime: '2024-01-01T10:00:00Z', balance: 0 },
              balance: 0,
              taxes: [],
            },
          ],
        }));

      await client.signIn();
      await client.selectCashRegister('reg-1');
    });

    it('should perform service deposit', async () => {
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
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(mockReceipt));

      const receipt = await client.serviceDeposit(500);

      expect(receipt.id).toBe('receipt-deposit');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/service-input'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should perform service withdraw', async () => {
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
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(createMockResponse(mockReceipt));

      const receipt = await client.serviceWithdraw(200);

      expect(receipt.id).toBe('receipt-withdraw');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/service-output'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
