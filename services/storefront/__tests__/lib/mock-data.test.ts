import {
  products,
  categories,
  promotions,
  getProductsByCategory,
  getProductById,
  searchProducts,
  getActivePromotions,
  getPromotionByCode,
  getCategoryById,
  getSubcategories,
  getRootCategories,
  stats,
  Product,
  Category,
  Promotion,
} from '@/lib/mock-data';

describe('Mock Data Generation', () => {
  describe('Products', () => {
    it('should generate exactly 5000 products', () => {
      expect(products.length).toBe(5000);
    });

    it('should have valid product structure', () => {
      const product = products[0];
      expect(product).toHaveProperty('id');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('price');
      expect(product).toHaveProperty('sku');
      expect(product).toHaveProperty('stock');
      expect(product).toHaveProperty('category_id');
      expect(product).toHaveProperty('brand');
      expect(product).toHaveProperty('rating');
      expect(product).toHaveProperty('reviewCount');
    });

    it('should have prices greater than 0', () => {
      products.forEach((product) => {
        expect(product.price).toBeGreaterThanOrEqual(99);
      });
    });

    it('should have valid ratings between 0 and 5', () => {
      products.forEach((product) => {
        expect(product.rating).toBeGreaterThanOrEqual(0);
        expect(product.rating).toBeLessThanOrEqual(5);
      });
    });

    it('should have stock >= 0', () => {
      products.forEach((product) => {
        expect(product.stock).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have some products with discounts (oldPrice)', () => {
      const productsWithDiscount = products.filter((p) => p.oldPrice);
      expect(productsWithDiscount.length).toBeGreaterThan(0);
    });

    it('should have oldPrice greater than price when present', () => {
      products.forEach((product) => {
        if (product.oldPrice) {
          expect(product.oldPrice).toBeGreaterThan(product.price);
        }
      });
    });

    it('should have some new products', () => {
      const newProducts = products.filter((p) => p.isNew);
      expect(newProducts.length).toBeGreaterThan(0);
    });

    it('should have some bestsellers', () => {
      const bestsellers = products.filter((p) => p.isBestseller);
      expect(bestsellers.length).toBeGreaterThan(0);
    });
  });

  describe('Categories', () => {
    it('should have categories defined', () => {
      expect(categories.length).toBeGreaterThan(0);
    });

    it('should have root categories (without parentId)', () => {
      const rootCats = categories.filter((c) => !c.parentId);
      expect(rootCats.length).toBeGreaterThan(0);
    });

    it('should have subcategories (with parentId)', () => {
      const subCats = categories.filter((c) => c.parentId);
      expect(subCats.length).toBeGreaterThan(0);
    });

    it('should have valid category structure', () => {
      categories.forEach((category) => {
        expect(category).toHaveProperty('id');
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('slug');
      });
    });
  });

  describe('Promotions', () => {
    it('should generate exactly 100 promotions', () => {
      expect(promotions.length).toBe(100);
    });

    it('should have valid promotion structure', () => {
      const promo = promotions[0];
      expect(promo).toHaveProperty('id');
      expect(promo).toHaveProperty('name');
      expect(promo).toHaveProperty('type');
      expect(promo).toHaveProperty('discount');
      expect(promo).toHaveProperty('startDate');
      expect(promo).toHaveProperty('endDate');
      expect(promo).toHaveProperty('isActive');
    });

    it('should have valid promotion types', () => {
      const validTypes = ['percentage', 'fixed', 'bundle', 'gift'];
      promotions.forEach((promo) => {
        expect(validTypes).toContain(promo.type);
      });
    });

    it('should have discount > 0', () => {
      promotions.forEach((promo) => {
        expect(promo.discount).toBeGreaterThan(0);
      });
    });

    it('should have some active promotions', () => {
      const activePromos = promotions.filter((p) => p.isActive);
      expect(activePromos.length).toBeGreaterThan(0);
    });
  });
});

describe('Helper Functions', () => {
  describe('getProductsByCategory', () => {
    it('should return products for a valid category', () => {
      const subcategories = categories.filter((c) => c.parentId);
      if (subcategories.length > 0) {
        const categoryId = subcategories[0].id;
        const categoryProducts = getProductsByCategory(categoryId);
        expect(Array.isArray(categoryProducts)).toBe(true);
        categoryProducts.forEach((p) => {
          expect(p.category_id).toBe(categoryId);
        });
      }
    });

    it('should return empty array for non-existent category', () => {
      const result = getProductsByCategory('non-existent-category');
      expect(result).toEqual([]);
    });
  });

  describe('getProductById', () => {
    it('should return product for valid id', () => {
      const product = getProductById('prod-1');
      expect(product).toBeDefined();
      expect(product?.id).toBe('prod-1');
    });

    it('should return undefined for non-existent id', () => {
      const product = getProductById('non-existent-id');
      expect(product).toBeUndefined();
    });
  });

  describe('searchProducts', () => {
    it('should find products by name', () => {
      const firstProduct = products[0];
      const brandName = firstProduct.brand;
      const results = searchProducts(brandName);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should be case-insensitive', () => {
      const results1 = searchProducts('apple');
      const results2 = searchProducts('APPLE');
      expect(results1.length).toBe(results2.length);
    });

    it('should return empty array for no matches', () => {
      const results = searchProducts('xyznonexistentproduct123');
      expect(results).toEqual([]);
    });
  });

  describe('getActivePromotions', () => {
    it('should return only active promotions', () => {
      const activePromos = getActivePromotions();
      activePromos.forEach((promo) => {
        expect(promo.isActive).toBe(true);
      });
    });
  });

  describe('getPromotionByCode', () => {
    it('should find promotion by code', () => {
      const activePromo = promotions.find((p) => p.isActive && p.code);
      if (activePromo && activePromo.code) {
        const found = getPromotionByCode(activePromo.code);
        expect(found).toBeDefined();
        expect(found?.code).toBe(activePromo.code);
      }
    });

    it('should be case-insensitive', () => {
      const activePromo = promotions.find((p) => p.isActive && p.code);
      if (activePromo && activePromo.code) {
        const found = getPromotionByCode(activePromo.code.toLowerCase());
        expect(found).toBeDefined();
      }
    });

    it('should return undefined for non-existent code', () => {
      const result = getPromotionByCode('NONEXISTENTCODE123');
      expect(result).toBeUndefined();
    });
  });

  describe('getCategoryById', () => {
    it('should return category for valid id', () => {
      const category = getCategoryById('cat-1');
      expect(category).toBeDefined();
      expect(category?.id).toBe('cat-1');
    });

    it('should return undefined for non-existent id', () => {
      const category = getCategoryById('non-existent-id');
      expect(category).toBeUndefined();
    });
  });

  describe('getSubcategories', () => {
    it('should return subcategories for parent category', () => {
      const subcats = getSubcategories('cat-1');
      expect(Array.isArray(subcats)).toBe(true);
      subcats.forEach((sub) => {
        expect(sub.parentId).toBe('cat-1');
      });
    });

    it('should return empty array for category without subcategories', () => {
      const subcats = getSubcategories('cat-1-1');
      expect(subcats).toEqual([]);
    });
  });

  describe('getRootCategories', () => {
    it('should return only root categories', () => {
      const rootCats = getRootCategories();
      rootCats.forEach((cat) => {
        expect(cat.parentId).toBeUndefined();
      });
    });

    it('should return non-empty array', () => {
      const rootCats = getRootCategories();
      expect(rootCats.length).toBeGreaterThan(0);
    });
  });
});

describe('Stats', () => {
  it('should have correct totalProducts', () => {
    expect(stats.totalProducts).toBe(products.length);
  });

  it('should have correct totalCategories', () => {
    expect(stats.totalCategories).toBe(categories.length);
  });

  it('should have correct totalPromotions', () => {
    expect(stats.totalPromotions).toBe(promotions.length);
  });

  it('should have activePromotions count', () => {
    const activeCount = promotions.filter((p) => p.isActive).length;
    expect(stats.activePromotions).toBe(activeCount);
  });

  it('should have productsWithDiscount count', () => {
    const discountCount = products.filter((p) => p.oldPrice).length;
    expect(stats.productsWithDiscount).toBe(discountCount);
  });

  it('should have newProducts count', () => {
    const newCount = products.filter((p) => p.isNew).length;
    expect(stats.newProducts).toBe(newCount);
  });

  it('should have bestsellers count', () => {
    const bestsellerCount = products.filter((p) => p.isBestseller).length;
    expect(stats.bestsellers).toBe(bestsellerCount);
  });
});
