import {
  getProducts,
  getCategories,
  getProduct,
  createOrder,
  getOrders,
  getCart,
  addToCartApi,
  clearCartApi,
  removeFromCartApi,
  updateCartQuantityApi,
  validatePromoCode,
  usePromoCode,
} from '@/lib/api';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('API Functions', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('getProducts', () => {
    it('should fetch products successfully', async () => {
      const mockProducts = [
        { id: '1', name: 'Product 1', price: 100 },
        { id: '2', name: 'Product 2', price: 200 },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProducts),
      });

      const result = await getProducts();
      expect(result).toEqual(mockProducts);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should return empty array on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getProducts();
      expect(result).toEqual([]);
    });

    it('should return empty array on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await getProducts();
      expect(result).toEqual([]);
    });

    it('should apply filters to request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await getProducts({
        search: 'test',
        minPrice: 100,
        maxPrice: 500,
        categoryId: 'cat-1',
      });

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('search=test');
      expect(calledUrl).toContain('min_price=100');
      expect(calledUrl).toContain('max_price=500');
      expect(calledUrl).toContain('category_id=cat-1');
    });
  });

  describe('getCategories', () => {
    it('should fetch categories successfully', async () => {
      const mockCategories = [
        { id: '1', name: 'Category 1' },
        { id: '2', name: 'Category 2' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCategories),
      });

      const result = await getCategories();
      expect(result).toEqual(mockCategories);
    });

    it('should return empty array on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getCategories();
      expect(result).toEqual([]);
    });

    it('should return empty array on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await getCategories();
      expect(result).toEqual([]);
    });
  });

  describe('getProduct', () => {
    it('should fetch single product successfully', async () => {
      const mockProduct = { id: '1', name: 'Product 1', price: 100 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProduct),
      });

      const result = await getProduct('1');
      expect(result).toEqual(mockProduct);
    });

    it('should return null on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await getProduct('nonexistent');
      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getProduct('1');
      expect(result).toBeNull();
    });
  });

  describe('createOrder', () => {
    it('should create order successfully', async () => {
      const mockOrder = { id: '1', product_id: 'prod-1', quantity: 2 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOrder),
      });

      const result = await createOrder('prod-1', 2, 1);
      expect(result).toEqual(mockOrder);
    });

    it('should return null on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await createOrder('prod-1', 2, 1);
      expect(result).toBeNull();
    });

    it('should return null on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      const result = await createOrder('prod-1', 2, 1);
      expect(result).toBeNull();
    });
  });

  describe('getOrders', () => {
    it('should fetch orders successfully', async () => {
      const mockOrders = [{ id: '1', product_id: 'prod-1', quantity: 2 }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOrders),
      });
      // Mock getProduct for enrichment
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'prod-1', name: 'Product' }),
      });

      const result = await getOrders(1);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should enrich orders with product=undefined when getProduct returns null', async () => {
      const mockOrders = [{ id: '1', product_id: 'prod-nonexistent', quantity: 2 }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOrders),
      });
      // Mock getProduct returning null (product not found)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await getOrders(1);
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].product).toBeUndefined();
    });

    it('should return empty array on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getOrders(1);
      expect(result).toEqual([]);
    });

    it('should return empty array on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await getOrders(1);
      expect(result).toEqual([]);
    });
  });

  describe('Cart API Functions', () => {
    describe('getCart', () => {
      it('should fetch cart successfully', async () => {
        const mockCart = [{ product_id: '1', quantity: 2 }];
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCart),
        });

        const result = await getCart(1);
        expect(result).toEqual(mockCart);
      });

      it('should return empty array on error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await getCart(1);
        expect(result).toEqual([]);
      });

      it('should return empty array on non-ok response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

        const result = await getCart(1);
        expect(result).toEqual([]);
      });
    });

    describe('addToCartApi', () => {
      it('should add to cart successfully', async () => {
        mockFetch.mockResolvedValueOnce({ ok: true });

        const result = await addToCartApi(1, 'prod-1', 2);
        expect(result).toBe(true);
      });

      it('should use default quantity of 1 when not specified', async () => {
        mockFetch.mockResolvedValueOnce({ ok: true });

        const result = await addToCartApi(1, 'prod-1');
        expect(result).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({ product_id: 'prod-1', quantity: 1 }),
          })
        );
      });

      it('should return false on error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await addToCartApi(1, 'prod-1', 2);
        expect(result).toBe(false);
      });
    });

    describe('clearCartApi', () => {
      it('should clear cart successfully', async () => {
        mockFetch.mockResolvedValueOnce({ ok: true });

        const result = await clearCartApi(1);
        expect(result).toBe(true);
      });

      it('should return false on error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await clearCartApi(1);
        expect(result).toBe(false);
      });
    });

    describe('removeFromCartApi', () => {
      it('should remove from cart successfully', async () => {
        mockFetch.mockResolvedValueOnce({ ok: true });

        const result = await removeFromCartApi(1, 'prod-1');
        expect(result).toBe(true);
      });

      it('should return false on error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await removeFromCartApi(1, 'prod-1');
        expect(result).toBe(false);
      });
    });

    describe('updateCartQuantityApi', () => {
      it('should update quantity successfully', async () => {
        mockFetch.mockResolvedValueOnce({ ok: true });

        const result = await updateCartQuantityApi(1, 'prod-1', 5);
        expect(result).toBe(true);
      });

      it('should return false on error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await updateCartQuantityApi(1, 'prod-1', 5);
        expect(result).toBe(false);
      });
    });
  });

  describe('Promo Code Functions', () => {
    describe('validatePromoCode', () => {
      it('should validate promo code successfully', async () => {
        const mockResponse = { discount: 10, code: 'TEST10' };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const result = await validatePromoCode('TEST10');
        expect(result.valid).toBe(true);
        expect(result.discount).toBe(10);
      });

      it('should return invalid on non-ok response', async () => {
        mockFetch.mockResolvedValueOnce({ ok: false });

        const result = await validatePromoCode('INVALID');
        expect(result.valid).toBe(false);
        expect(result.discount).toBe(0);
      });

      it('should return invalid on error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await validatePromoCode('TEST');
        expect(result.valid).toBe(false);
      });
    });

    describe('usePromoCode', () => {
      it('should use promo code successfully', async () => {
        mockFetch.mockResolvedValueOnce({ ok: true });

        const result = await usePromoCode('TEST10');
        expect(result).toBe(true);
      });

      it('should return false on error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await usePromoCode('TEST10');
        expect(result).toBe(false);
      });
    });
  });
});
