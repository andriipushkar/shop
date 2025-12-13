/**
 * Unit tests for recommendation system
 */

import {
  cosineSimilarity,
  jaccardSimilarity,
  categorySimilarity,
  priceSimilarity,
  priceRangeMatch,
  attributeSimilarity,
  hybridProductSimilarity,
  userSimilarity,
  findMostSimilar,
  normalizeScores,
  weightedRandomSelection,
  type ProductVector,
} from '@/lib/recommendations/similarity';

describe('Similarity Algorithms', () => {
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [1, 2, 3, 4];
      expect(cosineSimilarity(vec, vec)).toBe(1);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vecA = [1, 0];
      const vecB = [0, 1];
      expect(cosineSimilarity(vecA, vecB)).toBe(0);
    });

    it('should return value between 0 and 1 for similar vectors', () => {
      const vecA = [1, 2, 3];
      const vecB = [2, 3, 4];
      const similarity = cosineSimilarity(vecA, vecB);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it('should throw error for vectors of different lengths', () => {
      expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
    });

    it('should handle zero vectors', () => {
      expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    });
  });

  describe('jaccardSimilarity', () => {
    it('should return 1 for identical sets', () => {
      const set = ['a', 'b', 'c'];
      expect(jaccardSimilarity(set, set)).toBe(1);
    });

    it('should return 0 for disjoint sets', () => {
      const setA = ['a', 'b'];
      const setB = ['c', 'd'];
      expect(jaccardSimilarity(setA, setB)).toBe(0);
    });

    it('should calculate correct similarity for overlapping sets', () => {
      const setA = ['a', 'b', 'c'];
      const setB = ['b', 'c', 'd'];
      // Intersection: {b, c} = 2, Union: {a, b, c, d} = 4
      expect(jaccardSimilarity(setA, setB)).toBe(0.5);
    });

    it('should handle empty sets', () => {
      expect(jaccardSimilarity([], [])).toBe(0);
    });
  });

  describe('categorySimilarity', () => {
    it('should return 1 for same category', () => {
      expect(categorySimilarity('cat1', 'cat1')).toBe(1.0);
    });

    it('should return 0 for different categories without tree', () => {
      expect(categorySimilarity('cat1', 'cat2')).toBe(0.0);
    });

    it('should return 0.5 for parent-child relationship', () => {
      const tree = new Map([
        ['parent', { children: ['child1', 'child2'] }],
        ['child1', { parentId: 'parent', children: [] }],
      ]);

      expect(categorySimilarity('parent', 'child1', tree)).toBe(0.5);
      expect(categorySimilarity('child1', 'parent', tree)).toBe(0.5);
    });

    it('should return 0.3 for siblings (same parent)', () => {
      const tree = new Map([
        ['parent', { children: ['child1', 'child2'] }],
        ['child1', { parentId: 'parent', children: [] }],
        ['child2', { parentId: 'parent', children: [] }],
      ]);

      expect(categorySimilarity('child1', 'child2', tree)).toBe(0.3);
    });
  });

  describe('priceSimilarity', () => {
    it('should return 1 for identical prices', () => {
      expect(priceSimilarity(100, 100)).toBe(1);
    });

    it('should return high similarity for close prices', () => {
      const sim = priceSimilarity(100, 110);
      expect(sim).toBeGreaterThan(0.9);
    });

    it('should return low similarity for very different prices', () => {
      const sim = priceSimilarity(100, 1000);
      expect(sim).toBeLessThan(0.5);
    });

    it('should handle zero prices', () => {
      expect(priceSimilarity(0, 100)).toBe(0);
      expect(priceSimilarity(100, 0)).toBe(0);
    });
  });

  describe('priceRangeMatch', () => {
    it('should return true for prices within threshold', () => {
      expect(priceRangeMatch(100, 120, 0.3)).toBe(true);
    });

    it('should return false for prices outside threshold', () => {
      expect(priceRangeMatch(100, 200, 0.3)).toBe(false);
    });

    it('should work with custom threshold', () => {
      expect(priceRangeMatch(100, 150, 0.5)).toBe(true);
      expect(priceRangeMatch(100, 150, 0.3)).toBe(false);
    });
  });

  describe('attributeSimilarity', () => {
    it('should return 1 for identical attributes', () => {
      const attrs = { color: 'red', size: 'M', weight: 100 };
      expect(attributeSimilarity(attrs, attrs)).toBe(1);
    });

    it('should return 0 for completely different attributes', () => {
      const attrsA = { color: 'red', size: 'M' };
      const attrsB = { brand: 'Nike', material: 'Cotton' };
      expect(attributeSimilarity(attrsA, attrsB)).toBe(0);
    });

    it('should calculate partial similarity for overlapping attributes', () => {
      const attrsA = { color: 'red', size: 'M', brand: 'Nike' };
      const attrsB = { color: 'red', size: 'L', brand: 'Adidas' };
      const sim = attributeSimilarity(attrsA, attrsB);
      expect(sim).toBeGreaterThan(0);
      expect(sim).toBeLessThan(1);
    });

    it('should handle numeric attributes with similarity', () => {
      const attrsA = { weight: 100 };
      const attrsB = { weight: 90 };
      const sim = attributeSimilarity(attrsA, attrsB);
      expect(sim).toBe(0.9); // 90/100
    });

    it('should handle partial string matches', () => {
      const attrsA = { description: 'wireless headphones' };
      const attrsB = { description: 'wireless' };
      const sim = attributeSimilarity(attrsA, attrsB);
      expect(sim).toBe(0.5);
    });
  });

  describe('hybridProductSimilarity', () => {
    const productA: ProductVector = {
      productId: 'p1',
      categoryId: 'cat1',
      brandId: 'brand1',
      price: 1000,
      attributes: { color: 'red', size: 'M' },
      tags: ['electronics', 'wireless'],
    };

    it('should give high score for identical products', () => {
      const result = hybridProductSimilarity(productA, productA);
      expect(result.score).toBeGreaterThan(0.9);
    });

    it('should include reasons for similarity', () => {
      const productB: ProductVector = {
        ...productA,
        productId: 'p2',
      };
      const result = hybridProductSimilarity(productA, productB);
      expect(result.reasons).toContain('Та сама категорія');
      expect(result.reasons).toContain('Той самий бренд');
    });

    it('should calculate lower score for different products', () => {
      const productB: ProductVector = {
        productId: 'p2',
        categoryId: 'cat2',
        brandId: 'brand2',
        price: 5000,
        attributes: { material: 'plastic' },
        tags: ['outdoor'],
      };
      const result = hybridProductSimilarity(productA, productB);
      expect(result.score).toBeLessThan(0.3);
    });

    it('should use custom weights', () => {
      const weights = {
        category: 1.0,
        brand: 0,
        price: 0,
        attributes: 0,
        tags: 0,
      };
      const productB: ProductVector = {
        ...productA,
        productId: 'p2',
        price: 5000,
        brandId: 'brand2',
      };
      const result = hybridProductSimilarity(productA, productB, weights);
      expect(result.score).toBe(1.0); // Only category matters
    });
  });

  describe('userSimilarity', () => {
    it('should return high similarity for users with similar ratings', () => {
      const userA = new Map([
        ['p1', 5],
        ['p2', 4],
        ['p3', 3],
      ]);
      const userB = new Map([
        ['p1', 5],
        ['p2', 4],
        ['p3', 3],
      ]);
      const sim = userSimilarity(userA, userB);
      expect(sim).toBeGreaterThan(0.9);
    });

    it('should return 0 for users with no common products', () => {
      const userA = new Map([['p1', 5]]);
      const userB = new Map([['p2', 5]]);
      expect(userSimilarity(userA, userB)).toBe(0);
    });

    it('should return 0 for users with only one common product', () => {
      const userA = new Map([
        ['p1', 5],
        ['p2', 4],
      ]);
      const userB = new Map([['p1', 5]]);
      expect(userSimilarity(userA, userB)).toBe(0);
    });

    it('should calculate negative similarity for opposite ratings', () => {
      const userA = new Map([
        ['p1', 5],
        ['p2', 5],
        ['p3', 4],
      ]);
      const userB = new Map([
        ['p1', 1],
        ['p2', 1],
        ['p3', 2],
      ]);
      const sim = userSimilarity(userA, userB);
      expect(sim).toBeLessThan(0);
    });
  });

  describe('findMostSimilar', () => {
    const target: ProductVector = {
      productId: 'target',
      categoryId: 'cat1',
      brandId: 'brand1',
      price: 1000,
      attributes: { color: 'red' },
    };

    const candidates: ProductVector[] = [
      {
        productId: 'p1',
        categoryId: 'cat1',
        brandId: 'brand1',
        price: 1100,
        attributes: { color: 'red' },
      },
      {
        productId: 'p2',
        categoryId: 'cat1',
        brandId: 'brand2',
        price: 2000,
        attributes: { color: 'blue' },
      },
      {
        productId: 'p3',
        categoryId: 'cat2',
        brandId: 'brand3',
        price: 5000,
        attributes: { color: 'green' },
      },
    ];

    it('should return top N most similar products', () => {
      const results = findMostSimilar(target, candidates, 2);
      expect(results).toHaveLength(2);
      expect(results[0].productId).toBe('p1'); // Most similar
    });

    it('should exclude products below minimum score', () => {
      const results = findMostSimilar(target, candidates, 10, 0.5);
      expect(results.length).toBeLessThan(3);
    });

    it('should not include target product', () => {
      const candidatesWithTarget = [...candidates, target];
      const results = findMostSimilar(target, candidatesWithTarget, 10);
      expect(results.every(r => r.productId !== 'target')).toBe(true);
    });
  });

  describe('normalizeScores', () => {
    it('should normalize scores to [0, 1] range', () => {
      const scores = [
        { productId: 'p1', score: 0.5, reasons: [] },
        { productId: 'p2', score: 0.8, reasons: [] },
        { productId: 'p3', score: 0.3, reasons: [] },
      ];
      const normalized = normalizeScores(scores);

      expect(normalized[0].score).toBeLessThanOrEqual(1);
      expect(normalized[0].score).toBeGreaterThanOrEqual(0);
      expect(Math.max(...normalized.map(s => s.score))).toBe(1);
      expect(Math.min(...normalized.map(s => s.score))).toBe(0);
    });

    it('should handle empty array', () => {
      expect(normalizeScores([])).toEqual([]);
    });

    it('should handle single score', () => {
      const scores = [{ productId: 'p1', score: 0.5, reasons: [] }];
      const normalized = normalizeScores(scores);
      expect(normalized[0].score).toBe(1);
    });

    it('should handle identical scores', () => {
      const scores = [
        { productId: 'p1', score: 0.5, reasons: [] },
        { productId: 'p2', score: 0.5, reasons: [] },
      ];
      const normalized = normalizeScores(scores);
      expect(normalized.every(s => s.score === 1)).toBe(true);
    });
  });

  describe('weightedRandomSelection', () => {
    const items = [
      { productId: 'p1', score: 0.8, reasons: [] },
      { productId: 'p2', score: 0.5, reasons: [] },
      { productId: 'p3', score: 0.3, reasons: [] },
      { productId: 'p4', score: 0.1, reasons: [] },
    ];

    it('should return requested number of items', () => {
      const selected = weightedRandomSelection(items, 2);
      expect(selected).toHaveLength(2);
    });

    it('should return all items if count >= items.length', () => {
      const selected = weightedRandomSelection(items, 10);
      expect(selected).toHaveLength(items.length);
    });

    it('should favor higher scored items', () => {
      // Run multiple times and check that p1 (highest score) is selected more often
      const selections = new Map<string, number>();
      for (let i = 0; i < 100; i++) {
        const selected = weightedRandomSelection(items, 1);
        const id = selected[0].productId;
        selections.set(id, (selections.get(id) || 0) + 1);
      }

      // p1 should be selected most frequently
      const p1Count = selections.get('p1') || 0;
      const p4Count = selections.get('p4') || 0;
      expect(p1Count).toBeGreaterThan(p4Count);
    });

    it('should not select same item twice', () => {
      const selected = weightedRandomSelection(items, 3);
      const ids = selected.map(s => s.productId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});

describe('Edge Cases', () => {
  it('should handle products without optional fields', () => {
    const productA: ProductVector = {
      productId: 'p1',
      categoryId: 'cat1',
      price: 1000,
      attributes: {},
    };

    const productB: ProductVector = {
      productId: 'p2',
      categoryId: 'cat1',
      price: 1100,
      attributes: {},
    };

    const result = hybridProductSimilarity(productA, productB);
    expect(result.score).toBeGreaterThan(0);
  });

  it('should handle empty attributes', () => {
    expect(attributeSimilarity({}, {})).toBe(0);
  });

  it('should handle very large numbers in price similarity', () => {
    const sim = priceSimilarity(1000000, 1100000);
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThanOrEqual(1);
  });
});
