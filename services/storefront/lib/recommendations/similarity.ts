/**
 * Similarity Algorithms for Product Recommendations
 * Алгоритми схожості для рекомендацій товарів
 */

export interface ProductVector {
  productId: string;
  categoryId: string;
  brandId?: string;
  price: number;
  attributes: Record<string, string | number>;
  tags?: string[];
}

export interface SimilarityScore {
  productId: string;
  score: number;
  reasons: string[];
}

/**
 * Косинусна схожість між двома векторами
 * Використовується для порівняння атрибутів продуктів
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Індекс Жаккара для порівняння множин
 * Використовується для порівняння тегів, категорій, користувачів
 */
export function jaccardSimilarity<T>(setA: T[], setB: T[]): number {
  const a = new Set(setA);
  const b = new Set(setB);

  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);

  if (union.size === 0) {
    return 0;
  }

  return intersection.size / union.size;
}

/**
 * Схожість на основі категорії
 * 1.0 - та сама категорія
 * 0.5 - батьківська/дочірня категорія
 * 0.0 - різні категорії
 */
export function categorySimilarity(
  categoryA: string,
  categoryB: string,
  categoryTree?: Map<string, { parentId?: string; children: string[] }>
): number {
  if (categoryA === categoryB) {
    return 1.0;
  }

  if (!categoryTree) {
    return 0.0;
  }

  const categoryAData = categoryTree.get(categoryA);
  const categoryBData = categoryTree.get(categoryB);

  if (!categoryAData || !categoryBData) {
    return 0.0;
  }

  // Перевіряємо чи B є дочірньою категорією A
  if (categoryAData.children.includes(categoryB)) {
    return 0.5;
  }

  // Перевіряємо чи A є дочірньою категорією B
  if (categoryBData.children.includes(categoryA)) {
    return 0.5;
  }

  // Перевіряємо чи мають спільного батька
  if (categoryAData.parentId && categoryAData.parentId === categoryBData.parentId) {
    return 0.3;
  }

  return 0.0;
}

/**
 * Схожість на основі ціни
 * Чим ближче ціни, тим вища схожість
 */
export function priceSimilarity(priceA: number, priceB: number): number {
  if (priceA === 0 || priceB === 0) {
    return 0;
  }

  const maxPrice = Math.max(priceA, priceB);
  const minPrice = Math.min(priceA, priceB);
  const ratio = minPrice / maxPrice;

  // Логарифмічна шкала для кращого розподілу
  return Math.pow(ratio, 0.5);
}

/**
 * Схожість на основі діапазону цін
 * Повертає true якщо продукти в одному ціновому діапазоні
 */
export function priceRangeMatch(priceA: number, priceB: number, threshold = 0.3): boolean {
  const maxPrice = Math.max(priceA, priceB);
  const minPrice = Math.min(priceA, priceB);
  const diff = Math.abs(maxPrice - minPrice);
  const avgPrice = (maxPrice + minPrice) / 2;

  return diff / avgPrice <= threshold;
}

/**
 * Схожість на основі атрибутів (EAV)
 * Порівнює атрибути продуктів з урахуванням типів даних
 */
export function attributeSimilarity(
  attributesA: Record<string, string | number>,
  attributesB: Record<string, string | number>
): number {
  const keysA = Object.keys(attributesA);
  const keysB = Object.keys(attributesB);
  const commonKeys = keysA.filter(key => keysB.includes(key));

  if (commonKeys.length === 0) {
    return 0;
  }

  let matchCount = 0;
  for (const key of commonKeys) {
    const valueA = attributesA[key];
    const valueB = attributesB[key];

    // Точне співпадіння
    if (valueA === valueB) {
      matchCount += 1;
    }
    // Для числових значень - схожість на основі відстані
    else if (typeof valueA === 'number' && typeof valueB === 'number') {
      const max = Math.max(valueA, valueB);
      const min = Math.min(valueA, valueB);
      if (max > 0) {
        matchCount += min / max;
      }
    }
    // Для строкових значень - часткове співпадіння
    else if (typeof valueA === 'string' && typeof valueB === 'string') {
      const lowerA = valueA.toLowerCase();
      const lowerB = valueB.toLowerCase();
      if (lowerA.includes(lowerB) || lowerB.includes(lowerA)) {
        matchCount += 0.5;
      }
    }
  }

  return matchCount / commonKeys.length;
}

/**
 * Гібридна схожість продуктів
 * Комбінує всі метрики з вагами
 */
export function hybridProductSimilarity(
  productA: ProductVector,
  productB: ProductVector,
  weights = {
    category: 0.3,
    brand: 0.15,
    price: 0.2,
    attributes: 0.25,
    tags: 0.1,
  }
): SimilarityScore {
  const reasons: string[] = [];
  let totalScore = 0;

  // Схожість категорії
  const categorySim = productA.categoryId === productB.categoryId ? 1.0 : 0.0;
  totalScore += categorySim * weights.category;
  if (categorySim > 0) {
    reasons.push('Та сама категорія');
  }

  // Схожість бренду
  if (productA.brandId && productB.brandId) {
    const brandSim = productA.brandId === productB.brandId ? 1.0 : 0.0;
    totalScore += brandSim * weights.brand;
    if (brandSim > 0) {
      reasons.push('Той самий бренд');
    }
  }

  // Схожість ціни
  const priceSim = priceSimilarity(productA.price, productB.price);
  totalScore += priceSim * weights.price;
  if (priceSim > 0.8) {
    reasons.push('Схожий ціновий діапазон');
  }

  // Схожість атрибутів
  const attrSim = attributeSimilarity(productA.attributes, productB.attributes);
  totalScore += attrSim * weights.attributes;
  if (attrSim > 0.5) {
    reasons.push('Схожі характеристики');
  }

  // Схожість тегів
  if (productA.tags && productB.tags) {
    const tagSim = jaccardSimilarity(productA.tags, productB.tags);
    totalScore += tagSim * weights.tags;
    if (tagSim > 0.3) {
      reasons.push('Схожі теги');
    }
  }

  return {
    productId: productB.productId,
    score: totalScore,
    reasons,
  };
}

/**
 * Колаборативна фільтрація - схожість користувачів
 * Pearson correlation coefficient
 */
export function userSimilarity(
  userARatings: Map<string, number>,
  userBRatings: Map<string, number>
): number {
  // Знаходимо спільні продукти
  const commonProducts = [...userARatings.keys()].filter(
    productId => userBRatings.has(productId)
  );

  if (commonProducts.length < 2) {
    return 0;
  }

  // Середні оцінки
  const avgA = commonProducts.reduce((sum, id) => sum + userARatings.get(id)!, 0) / commonProducts.length;
  const avgB = commonProducts.reduce((sum, id) => sum + userBRatings.get(id)!, 0) / commonProducts.length;

  let numerator = 0;
  let denomA = 0;
  let denomB = 0;

  for (const productId of commonProducts) {
    const diffA = userARatings.get(productId)! - avgA;
    const diffB = userBRatings.get(productId)! - avgB;

    numerator += diffA * diffB;
    denomA += diffA * diffA;
    denomB += diffB * diffB;
  }

  if (denomA === 0 || denomB === 0) {
    return 0;
  }

  return numerator / Math.sqrt(denomA * denomB);
}

/**
 * Обчислення Top-N найбільш схожих продуктів
 */
export function findMostSimilar(
  targetProduct: ProductVector,
  candidateProducts: ProductVector[],
  topN = 10,
  minScore = 0.3
): SimilarityScore[] {
  const scores = candidateProducts
    .filter(p => p.productId !== targetProduct.productId)
    .map(product => hybridProductSimilarity(targetProduct, product))
    .filter(score => score.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return scores;
}

/**
 * Нормалізація оцінок до діапазону [0, 1]
 */
export function normalizeScores(scores: SimilarityScore[]): SimilarityScore[] {
  if (scores.length === 0) return [];

  const maxScore = Math.max(...scores.map(s => s.score));
  const minScore = Math.min(...scores.map(s => s.score));
  const range = maxScore - minScore;

  if (range === 0) {
    return scores.map(s => ({ ...s, score: 1.0 }));
  }

  return scores.map(s => ({
    ...s,
    score: (s.score - minScore) / range,
  }));
}

/**
 * Weighted Random Selection
 * Випадковий вибір з урахуванням ваг (для різноманітності рекомендацій)
 */
export function weightedRandomSelection<T extends { score: number }>(
  items: T[],
  count: number
): T[] {
  if (items.length <= count) {
    return items;
  }

  const selected: T[] = [];
  const remaining = [...items];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalScore = remaining.reduce((sum, item) => sum + item.score, 0);
    let random = Math.random() * totalScore;

    for (let j = 0; j < remaining.length; j++) {
      random -= remaining[j].score;
      if (random <= 0) {
        selected.push(remaining[j]);
        remaining.splice(j, 1);
        break;
      }
    }
  }

  return selected;
}
