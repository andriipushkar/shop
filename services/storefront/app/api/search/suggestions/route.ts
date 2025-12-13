import { NextRequest, NextResponse } from 'next/server';
import { products, categories } from '@/lib/mock-data';

// Simple fuzzy matching function
function fuzzyMatch(text: string, query: string): boolean {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // Exact match
  if (textLower.includes(queryLower)) return true;

  // Fuzzy match - check if characters appear in order
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }
  return queryIndex === queryLower.length;
}

// Calculate match score for ranking
function calculateMatchScore(text: string, query: string): number {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // Exact match at start = highest score
  if (textLower.startsWith(queryLower)) return 100;

  // Exact match somewhere = high score
  if (textLower.includes(queryLower)) return 80;

  // Word start match
  const words = textLower.split(/\s+/);
  if (words.some(word => word.startsWith(queryLower))) return 60;

  // Fuzzy match = lower score
  if (fuzzyMatch(textLower, queryLower)) return 40;

  return 0;
}

// Highlight matching text
function highlightMatch(text: string, query: string): string {
  if (!query) return text;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '10');

  if (query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions: Array<{
    id: string;
    type: 'product' | 'category' | 'brand' | 'query';
    text: string;
    url?: string;
    image?: string;
    price?: number;
    oldPrice?: number;
    rating?: number;
    highlight?: string;
    score: number;
  }> = [];

  // Search products
  for (const product of products) {
    const nameScore = calculateMatchScore(product.name, query);
    const brandScore = product.brand ? calculateMatchScore(product.brand, query) * 0.8 : 0;
    const score = Math.max(nameScore, brandScore);

    if (score > 0) {
      suggestions.push({
        id: `product-${product.id}`,
        type: 'product',
        text: product.name,
        url: `/product/${product.id}`,
        image: product.image_url,
        price: product.price,
        oldPrice: product.compare_price,
        rating: product.rating,
        highlight: highlightMatch(product.name, query),
        score,
      });
    }
  }

  // Search categories
  for (const category of categories) {
    const score = calculateMatchScore(category.name, query);
    if (score > 0) {
      suggestions.push({
        id: `category-${category.id}`,
        type: 'category',
        text: category.name,
        url: `/category/${category.slug}`,
        highlight: highlightMatch(category.name, query),
        score: score * 1.2, // Boost categories slightly
      });
    }
  }

  // Extract unique brands and search them
  const brands = [...new Set(products.map(p => p.brand).filter(Boolean))] as string[];
  for (const brand of brands) {
    const score = calculateMatchScore(brand, query);
    if (score > 0) {
      suggestions.push({
        id: `brand-${brand}`,
        type: 'brand',
        text: brand,
        url: `/search?brand=${encodeURIComponent(brand)}`,
        highlight: highlightMatch(brand, query),
        score: score * 1.1, // Slight boost for brands
      });
    }
  }

  // Sort by score and limit
  suggestions.sort((a, b) => b.score - a.score);
  const limitedSuggestions = suggestions.slice(0, limit).map(({ score, ...rest }) => rest);

  // Add query suggestion if no exact match
  if (!suggestions.some(s => s.text.toLowerCase() === query.toLowerCase())) {
    limitedSuggestions.push({
      id: `query-${query}`,
      type: 'query',
      text: query,
      url: `/search?q=${encodeURIComponent(query)}`,
      highlight: query,
    });
  }

  return NextResponse.json({
    suggestions: limitedSuggestions,
    query,
  });
}
