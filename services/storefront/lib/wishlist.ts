/**
 * Wishlist System
 * Public/Private wishlists with sharing functionality
 */

// ==================== TYPES ====================

export interface WishlistItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  productPrice: number;
  productOriginalPrice?: number;
  productStock: number;
  addedAt: Date;
  priceAtAdd: number;
  notes?: string;
  priority: WishlistPriority;
  notifyOnPriceDrop: boolean;
  notifyOnBackInStock: boolean;
}

export type WishlistPriority = 'high' | 'medium' | 'low';

export interface Wishlist {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isPublic: boolean;
  isDefault: boolean;
  shareToken?: string;
  items: WishlistItem[];
  createdAt: Date;
  updatedAt: Date;
  viewCount: number;
  shareCount: number;
}

export interface WishlistSummary {
  id: string;
  name: string;
  itemCount: number;
  totalValue: number;
  isPublic: boolean;
  isDefault: boolean;
  thumbnails: string[];
}

export interface SharedWishlist {
  wishlist: Wishlist;
  ownerName: string;
  ownerAvatar?: string;
  message?: string;
}

export interface AddToWishlistInput {
  productId: string;
  wishlistId?: string; // If not provided, add to default
  notes?: string;
  priority?: WishlistPriority;
  notifyOnPriceDrop?: boolean;
  notifyOnBackInStock?: boolean;
}

export interface CreateWishlistInput {
  name: string;
  description?: string;
  isPublic?: boolean;
}

export interface WishlistShareOptions {
  platform: SharePlatform;
  message?: string;
}

export type SharePlatform =
  | 'link'
  | 'facebook'
  | 'twitter'
  | 'telegram'
  | 'viber'
  | 'whatsapp'
  | 'email';

export interface PriceDropAlert {
  productId: string;
  productName: string;
  oldPrice: number;
  newPrice: number;
  dropPercent: number;
  wishlistId: string;
  userId: string;
}

// ==================== CONSTANTS ====================

export const MAX_WISHLISTS_PER_USER = 20;
export const MAX_ITEMS_PER_WISHLIST = 100;
export const DEFAULT_WISHLIST_NAME = 'Мій список бажань';

export const PRIORITY_LABELS: Record<WishlistPriority, { en: string; uk: string }> = {
  high: { en: 'High Priority', uk: 'Високий пріоритет' },
  medium: { en: 'Medium Priority', uk: 'Середній пріоритет' },
  low: { en: 'Low Priority', uk: 'Низький пріоритет' },
};

export const SHARE_PLATFORMS: { platform: SharePlatform; name: string; icon: string }[] = [
  { platform: 'link', name: 'Копіювати посилання', icon: 'link' },
  { platform: 'facebook', name: 'Facebook', icon: 'facebook' },
  { platform: 'telegram', name: 'Telegram', icon: 'telegram' },
  { platform: 'viber', name: 'Viber', icon: 'viber' },
  { platform: 'whatsapp', name: 'WhatsApp', icon: 'whatsapp' },
  { platform: 'twitter', name: 'Twitter/X', icon: 'twitter' },
  { platform: 'email', name: 'Email', icon: 'email' },
];

// ==================== LOCAL STORAGE (for anonymous users) ====================

const WISHLIST_STORAGE_KEY = 'techshop_wishlist';

/**
 * Get wishlist from localStorage (for anonymous users)
 */
export function getLocalWishlist(): WishlistItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(WISHLIST_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save wishlist to localStorage
 */
export function saveLocalWishlist(items: WishlistItem[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Failed to save wishlist:', error);
  }
}

/**
 * Add item to local wishlist
 */
export function addToLocalWishlist(item: Omit<WishlistItem, 'id' | 'addedAt'>): WishlistItem {
  const items = getLocalWishlist();

  // Check if already exists
  const existing = items.find(i => i.productId === item.productId);
  if (existing) {
    return existing;
  }

  const newItem: WishlistItem = {
    ...item,
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    addedAt: new Date(),
  };

  items.push(newItem);
  saveLocalWishlist(items);

  return newItem;
}

/**
 * Remove item from local wishlist
 */
export function removeFromLocalWishlist(productId: string): void {
  const items = getLocalWishlist();
  const filtered = items.filter(i => i.productId !== productId);
  saveLocalWishlist(filtered);
}

/**
 * Check if product is in local wishlist
 */
export function isInLocalWishlist(productId: string): boolean {
  const items = getLocalWishlist();
  return items.some(i => i.productId === productId);
}

/**
 * Clear local wishlist
 */
export function clearLocalWishlist(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(WISHLIST_STORAGE_KEY);
}

// ==================== API FUNCTIONS ====================

/**
 * Get user's wishlists
 */
export async function getWishlists(): Promise<WishlistSummary[]> {
  const response = await fetch('/api/wishlists');

  if (!response.ok) {
    throw new Error('Failed to fetch wishlists');
  }

  return response.json();
}

/**
 * Get wishlist by ID
 */
export async function getWishlist(wishlistId: string): Promise<Wishlist> {
  const response = await fetch(`/api/wishlists/${wishlistId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch wishlist');
  }

  return response.json();
}

/**
 * Get default wishlist
 */
export async function getDefaultWishlist(): Promise<Wishlist> {
  const response = await fetch('/api/wishlists/default');

  if (!response.ok) {
    throw new Error('Failed to fetch default wishlist');
  }

  return response.json();
}

/**
 * Create a new wishlist
 */
export async function createWishlist(input: CreateWishlistInput): Promise<Wishlist> {
  const response = await fetch('/api/wishlists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create wishlist');
  }

  return response.json();
}

/**
 * Update wishlist
 */
export async function updateWishlist(
  wishlistId: string,
  updates: Partial<CreateWishlistInput>
): Promise<Wishlist> {
  const response = await fetch(`/api/wishlists/${wishlistId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error('Failed to update wishlist');
  }

  return response.json();
}

/**
 * Delete wishlist
 */
export async function deleteWishlist(wishlistId: string): Promise<void> {
  const response = await fetch(`/api/wishlists/${wishlistId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete wishlist');
  }
}

/**
 * Add item to wishlist
 */
export async function addToWishlist(input: AddToWishlistInput): Promise<WishlistItem> {
  const response = await fetch('/api/wishlists/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to add to wishlist');
  }

  return response.json();
}

/**
 * Remove item from wishlist
 */
export async function removeFromWishlist(wishlistId: string, itemId: string): Promise<void> {
  const response = await fetch(`/api/wishlists/${wishlistId}/items/${itemId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to remove from wishlist');
  }
}

/**
 * Update wishlist item
 */
export async function updateWishlistItem(
  wishlistId: string,
  itemId: string,
  updates: Partial<Pick<WishlistItem, 'notes' | 'priority' | 'notifyOnPriceDrop' | 'notifyOnBackInStock'>>
): Promise<WishlistItem> {
  const response = await fetch(`/api/wishlists/${wishlistId}/items/${itemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error('Failed to update item');
  }

  return response.json();
}

/**
 * Move item to another wishlist
 */
export async function moveItemToWishlist(
  fromWishlistId: string,
  itemId: string,
  toWishlistId: string
): Promise<void> {
  const response = await fetch(`/api/wishlists/${fromWishlistId}/items/${itemId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toWishlistId }),
  });

  if (!response.ok) {
    throw new Error('Failed to move item');
  }
}

/**
 * Check if product is in any wishlist
 */
export async function isInWishlist(productId: string): Promise<{ inWishlist: boolean; wishlistIds: string[] }> {
  const response = await fetch(`/api/wishlists/check?productId=${productId}`);

  if (!response.ok) {
    return { inWishlist: false, wishlistIds: [] };
  }

  return response.json();
}

/**
 * Get shared wishlist
 */
export async function getSharedWishlist(shareToken: string): Promise<SharedWishlist> {
  const response = await fetch(`/api/wishlists/shared/${shareToken}`);

  if (!response.ok) {
    throw new Error('Wishlist not found or not public');
  }

  return response.json();
}

/**
 * Generate share link
 */
export async function generateShareLink(wishlistId: string): Promise<string> {
  const response = await fetch(`/api/wishlists/${wishlistId}/share`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to generate share link');
  }

  const data = await response.json();
  return data.shareUrl;
}

/**
 * Share wishlist
 */
export function shareWishlist(shareUrl: string, options: WishlistShareOptions): void {
  const text = options.message || 'Подивіться мій список бажань!';
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(text);

  let targetUrl: string;

  switch (options.platform) {
    case 'facebook':
      targetUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
      break;
    case 'twitter':
      targetUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
      break;
    case 'telegram':
      targetUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
      break;
    case 'viber':
      targetUrl = `viber://forward?text=${encodedText}%20${encodedUrl}`;
      break;
    case 'whatsapp':
      targetUrl = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
      break;
    case 'email':
      targetUrl = `mailto:?subject=${encodedText}&body=${encodedUrl}`;
      break;
    case 'link':
    default:
      // Copy to clipboard
      navigator.clipboard.writeText(shareUrl);
      return;
  }

  window.open(targetUrl, '_blank', 'width=600,height=400');
}

/**
 * Merge local wishlist with user wishlist after login
 */
export async function mergeLocalWishlist(): Promise<{ merged: number; skipped: number }> {
  const localItems = getLocalWishlist();

  if (localItems.length === 0) {
    return { merged: 0, skipped: 0 };
  }

  const response = await fetch('/api/wishlists/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: localItems }),
  });

  if (!response.ok) {
    throw new Error('Failed to merge wishlist');
  }

  const result = await response.json();

  // Clear local wishlist after successful merge
  clearLocalWishlist();

  return result;
}

/**
 * Calculate wishlist stats
 */
export function calculateWishlistStats(wishlist: Wishlist): {
  totalItems: number;
  totalValue: number;
  totalSavings: number;
  inStockCount: number;
  outOfStockCount: number;
  priceDropCount: number;
} {
  let totalValue = 0;
  let totalSavings = 0;
  let inStockCount = 0;
  let outOfStockCount = 0;
  let priceDropCount = 0;

  wishlist.items.forEach(item => {
    totalValue += item.productPrice;

    if (item.productOriginalPrice && item.productOriginalPrice > item.productPrice) {
      totalSavings += item.productOriginalPrice - item.productPrice;
    }

    if (item.productStock > 0) {
      inStockCount++;
    } else {
      outOfStockCount++;
    }

    if (item.productPrice < item.priceAtAdd) {
      priceDropCount++;
    }
  });

  return {
    totalItems: wishlist.items.length,
    totalValue,
    totalSavings,
    inStockCount,
    outOfStockCount,
    priceDropCount,
  };
}

/**
 * Sort wishlist items
 */
export function sortWishlistItems(
  items: WishlistItem[],
  sortBy: 'added' | 'price_asc' | 'price_desc' | 'name' | 'priority'
): WishlistItem[] {
  const sorted = [...items];

  switch (sortBy) {
    case 'price_asc':
      sorted.sort((a, b) => a.productPrice - b.productPrice);
      break;
    case 'price_desc':
      sorted.sort((a, b) => b.productPrice - a.productPrice);
      break;
    case 'name':
      sorted.sort((a, b) => a.productName.localeCompare(b.productName, 'uk'));
      break;
    case 'priority':
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      sorted.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
      break;
    case 'added':
    default:
      sorted.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }

  return sorted;
}

/**
 * Filter wishlist items
 */
export function filterWishlistItems(
  items: WishlistItem[],
  filters: {
    inStock?: boolean;
    priority?: WishlistPriority;
    priceDrop?: boolean;
    minPrice?: number;
    maxPrice?: number;
  }
): WishlistItem[] {
  return items.filter(item => {
    if (filters.inStock !== undefined) {
      const isInStock = item.productStock > 0;
      if (filters.inStock !== isInStock) return false;
    }

    if (filters.priority && item.priority !== filters.priority) {
      return false;
    }

    if (filters.priceDrop && item.productPrice >= item.priceAtAdd) {
      return false;
    }

    if (filters.minPrice !== undefined && item.productPrice < filters.minPrice) {
      return false;
    }

    if (filters.maxPrice !== undefined && item.productPrice > filters.maxPrice) {
      return false;
    }

    return true;
  });
}
