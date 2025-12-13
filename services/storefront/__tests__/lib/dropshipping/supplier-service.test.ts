/**
 * Unit tests for Dropshipping Supplier Service
 * Тести для сервісу постачальників дропшипінгу
 */

import { SupplierService, type SupplierRegistration, type CreateProduct } from '@/lib/dropshipping/supplier-service';

// Mock fetch globally
global.fetch = jest.fn();

describe('SupplierService', () => {
  let service: SupplierService;

  beforeEach(() => {
    service = new SupplierService('/api/supplier');
    jest.clearAllMocks();
  });

  describe('registerSupplier', () => {
    it('should register supplier successfully', async () => {
      const registration: SupplierRegistration = {
        companyName: 'Test Supplier Ltd',
        contactPerson: 'John Doe',
        email: 'supplier@test.com',
        phone: '+380501234567',
        edrpou: '12345678',
      };

      const mockResponse = {
        id: 'sup-1',
        ...registration,
        status: 'pending' as const,
        commissionRate: 15,
        paymentTermDays: 14,
        autoApprove: false,
        createdAt: new Date(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.registerSupplier(registration);

      expect(result.id).toBe('sup-1');
      expect(result.status).toBe('pending');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/register'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should handle registration error', async () => {
      const registration: SupplierRegistration = {
        companyName: 'Test',
        contactPerson: 'John',
        email: 'test@test.com',
        phone: '+380501234567',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(service.registerSupplier(registration)).rejects.toThrow();
    });
  });

  describe('Product CRUD Operations', () => {
    it('should add product successfully', async () => {
      const product: CreateProduct = {
        sku: 'PROD-001',
        name: 'Test Product',
        description: 'Test Description',
        price: 1000,
        retailPrice: 1500,
        stock: 100,
        category: 'electronics',
        images: ['https://example.com/image.jpg'],
      };

      const mockResponse = {
        id: 'prod-1',
        supplierId: 'sup-1',
        ...product,
        status: 'pending' as const,
        lastStockUpdate: new Date(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.addProduct('sup-1', product);

      expect(result.id).toBe('prod-1');
      expect(result.sku).toBe('PROD-001');
    });

    it('should update product', async () => {
      const updates = { price: 1200, stock: 50 };

      const mockResponse = {
        id: 'prod-1',
        supplierId: 'sup-1',
        sku: 'PROD-001',
        name: 'Updated Product',
        description: 'Test',
        price: 1200,
        stock: 50,
        category: 'electronics',
        images: [],
        status: 'approved' as const,
        lastStockUpdate: new Date(),
        attributes: {},
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.updateProduct('prod-1', updates);

      expect(result.price).toBe(1200);
      expect(result.stock).toBe(50);
    });

    it('should delete product', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      await expect(service.deleteProduct('prod-1')).resolves.not.toThrow();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/products/prod-1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should get products with filters', async () => {
      const mockProducts = [
        {
          id: 'prod-1',
          supplierId: 'sup-1',
          sku: 'PROD-001',
          name: 'Product 1',
          description: 'Test',
          price: 1000,
          stock: 100,
          category: 'electronics',
          images: [],
          status: 'approved' as const,
          lastStockUpdate: new Date(),
          attributes: {},
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProducts,
      });

      const result = await service.getProducts('sup-1', {
        category: 'electronics',
        status: 'approved',
      });

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('electronics');
    });
  });

  describe('Order Processing', () => {
    it('should confirm order', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      await expect(service.confirmOrder('order-1')).resolves.not.toThrow();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/orders/order-1/confirm'),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should ship order with tracking', async () => {
      const tracking = {
        trackingNumber: '1234567890',
        trackingUrl: 'https://tracking.com/1234567890',
        carrier: 'Nova Poshta',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      await expect(service.shipOrder('order-1', tracking)).resolves.not.toThrow();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/orders/order-1/ship'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(tracking),
        })
      );
    });

    it('should cancel order with reason', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      await expect(
        service.cancelOrder('order-1', 'Out of stock')
      ).resolves.not.toThrow();
    });

    it('should get supplier orders', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          supplierId: 'sup-1',
          platformOrderId: 'plat-order-1',
          items: [],
          shippingAddress: {
            street: 'Test St',
            city: 'Kyiv',
            postalCode: '01001',
            country: 'Ukraine',
          },
          status: 'new' as const,
          supplierTotal: 10000,
          platformCommission: 1500,
          createdAt: new Date(),
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrders,
      });

      const result = await service.getSupplierOrders('sup-1', { status: 'new' });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('new');
    });
  });

  describe('Earnings Calculation', () => {
    it('should get earnings report', async () => {
      const mockReport = {
        totalEarnings: 50000,
        totalOrders: 10,
        totalCommission: 7500,
        netEarnings: 42500,
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
        breakdown: [
          {
            date: '2024-01-15',
            orders: 5,
            earnings: 25000,
            commission: 3750,
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockReport,
      });

      const result = await service.getEarnings('sup-1', {
        from: new Date('2024-01-01'),
        to: new Date('2024-01-31'),
      });

      expect(result.totalEarnings).toBe(50000);
      expect(result.netEarnings).toBe(42500);
      expect(result.totalCommission).toBe(7500);
    });

    it('should request payout', async () => {
      const mockPayout = {
        id: 'payout-1',
        amount: 10000,
        status: 'pending' as const,
        requestedAt: new Date(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayout,
      });

      const result = await service.requestPayout('sup-1', 10000);

      expect(result.id).toBe('payout-1');
      expect(result.amount).toBe(10000);
      expect(result.status).toBe('pending');
    });

    it('should get pending payouts', async () => {
      const mockPayouts = [
        {
          id: 'payout-1',
          supplierId: 'sup-1',
          amount: 5000,
          status: 'pending' as const,
          requestedAt: new Date(),
          method: 'bank_transfer' as const,
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayouts,
      });

      const result = await service.getPendingPayouts('sup-1');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });
  });

  describe('Bulk Operations', () => {
    it('should import products from file', async () => {
      const file = new File(['test'], 'products.csv', { type: 'text/csv' });
      const mockResult = {
        success: true,
        imported: 10,
        failed: 0,
        errors: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      const result = await service.importProducts('sup-1', file, 'csv');

      expect(result.success).toBe(true);
      expect(result.imported).toBe(10);
    });

    it('should handle import errors', async () => {
      const file = new File(['test'], 'products.csv', { type: 'text/csv' });
      const mockResult = {
        success: false,
        imported: 5,
        failed: 5,
        errors: ['Invalid SKU on row 3', 'Missing price on row 7'],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      const result = await service.importProducts('sup-1', file, 'csv');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it('should export products', async () => {
      const mockBlob = new Blob(['test data'], { type: 'text/csv' });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      });

      const result = await service.exportProducts('sup-1', 'csv');

      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('Stock Management', () => {
    it('should update stock for multiple products', async () => {
      const updates = [
        { sku: 'PROD-001', stock: 100 },
        { sku: 'PROD-002', stock: 50, price: 1200 },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      await expect(
        service.updateStock('sup-1', updates)
      ).resolves.not.toThrow();
    });

    it('should sync stock from feed URL', async () => {
      const mockResult = {
        success: true,
        updated: 25,
        errors: [],
        timestamp: new Date(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      const result = await service.syncStockFromFeed(
        'sup-1',
        'https://example.com/feed.xml'
      );

      expect(result.success).toBe(true);
      expect(result.updated).toBe(25);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(service.getSupplier('sup-1')).rejects.toThrow();
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(service.getSupplier('non-existent')).rejects.toThrow();
    });
  });
});
