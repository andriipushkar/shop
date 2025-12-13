/**
 * Product Recommendation System
 * Система рекомендацій товарів
 *
 * @module recommendations
 */

// Export recommendation engine
export { recommendationEngine, RecommendationEngine } from './recommendation-engine';
export type {
  RecommendationOptions,
  Recommendation,
  TrendingProduct,
  UserBehavior,
} from './recommendation-engine';

// Export similarity algorithms
export {
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
} from './similarity';
export type {
  ProductVector,
  SimilarityScore,
} from './similarity';
