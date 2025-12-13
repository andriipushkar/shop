// Wishlist Sharing Service

import { Product } from '@/lib/mock-data';

export interface SharedWishlist {
    id: string;
    userId: string;
    userName: string;
    title: string;
    description?: string;
    items: WishlistItem[];
    visibility: 'public' | 'private' | 'link_only';
    shareUrl: string;
    shortCode: string;
    createdAt: string;
    updatedAt: string;
    viewCount: number;
    likeCount: number;
}

export interface WishlistItem {
    productId: string;
    product: Product;
    addedAt: string;
    priority: 'low' | 'medium' | 'high';
    notes?: string;
    isPurchased?: boolean;
    purchasedBy?: string;
}

export interface WishlistShareOptions {
    title: string;
    description?: string;
    visibility: 'public' | 'private' | 'link_only';
    allowPurchaseMarking: boolean;
    expiresAt?: string;
}

export interface SharePlatform {
    id: string;
    name: string;
    icon: string;
    color: string;
    shareUrl: (url: string, title: string, description?: string) => string;
}

// Available share platforms
export const sharePlatforms: SharePlatform[] = [
    {
        id: 'facebook',
        name: 'Facebook',
        icon: 'facebook',
        color: '#1877F2',
        shareUrl: (url, title) =>
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(title)}`,
    },
    {
        id: 'twitter',
        name: 'Twitter',
        icon: 'twitter',
        color: '#1DA1F2',
        shareUrl: (url, title) =>
            `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    },
    {
        id: 'telegram',
        name: 'Telegram',
        icon: 'telegram',
        color: '#0088CC',
        shareUrl: (url, title) =>
            `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    },
    {
        id: 'viber',
        name: 'Viber',
        icon: 'viber',
        color: '#7360F2',
        shareUrl: (url, title) =>
            `viber://forward?text=${encodeURIComponent(title + ' ' + url)}`,
    },
    {
        id: 'whatsapp',
        name: 'WhatsApp',
        icon: 'whatsapp',
        color: '#25D366',
        shareUrl: (url, title) =>
            `https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`,
    },
    {
        id: 'email',
        name: 'Email',
        icon: 'email',
        color: '#EA4335',
        shareUrl: (url, title, description) =>
            `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent((description || '') + '\n\n' + url)}`,
    },
    {
        id: 'copy',
        name: 'Копіювати посилання',
        icon: 'link',
        color: '#6B7280',
        shareUrl: (url) => url,
    },
];

// Generate short code for wishlist
function generateShortCode(length: number = 8): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Wishlist sharing service class
class WishlistSharingService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://techshop.ua';
    }

    // Create shareable wishlist
    async createSharedWishlist(
        userId: string,
        userName: string,
        items: WishlistItem[],
        options: WishlistShareOptions
    ): Promise<SharedWishlist> {
        const shortCode = generateShortCode();
        const shareUrl = `${this.baseUrl}/wishlist/shared/${shortCode}`;

        const sharedWishlist: SharedWishlist = {
            id: Date.now().toString(),
            userId,
            userName,
            title: options.title,
            description: options.description,
            items,
            visibility: options.visibility,
            shareUrl,
            shortCode,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            viewCount: 0,
            likeCount: 0,
        };

        // In production, save to database
        await this.saveWishlist(sharedWishlist);

        return sharedWishlist;
    }

    // Get shared wishlist by short code
    async getSharedWishlist(shortCode: string): Promise<SharedWishlist | null> {
        try {
            const response = await fetch(`/api/wishlists/shared/${shortCode}`);
            if (!response.ok) return null;
            return await response.json();
        } catch {
            // Return mock data for development
            return null;
        }
    }

    // Update shared wishlist
    async updateSharedWishlist(
        wishlistId: string,
        updates: Partial<SharedWishlist>
    ): Promise<SharedWishlist | null> {
        try {
            const response = await fetch(`/api/wishlists/${wishlistId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!response.ok) return null;
            return await response.json();
        } catch {
            return null;
        }
    }

    // Delete shared wishlist
    async deleteSharedWishlist(wishlistId: string): Promise<boolean> {
        try {
            const response = await fetch(`/api/wishlists/${wishlistId}`, {
                method: 'DELETE',
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    // Mark item as purchased
    async markItemPurchased(
        wishlistId: string,
        productId: string,
        purchasedBy: string
    ): Promise<boolean> {
        try {
            const response = await fetch(`/api/wishlists/${wishlistId}/items/${productId}/purchased`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ purchasedBy }),
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    // Increment view count
    async incrementViewCount(shortCode: string): Promise<void> {
        try {
            await fetch(`/api/wishlists/shared/${shortCode}/view`, {
                method: 'POST',
            });
        } catch {
            // Ignore errors
        }
    }

    // Like wishlist
    async likeWishlist(wishlistId: string): Promise<boolean> {
        try {
            const response = await fetch(`/api/wishlists/${wishlistId}/like`, {
                method: 'POST',
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    // Get user's shared wishlists
    async getUserWishlists(userId: string): Promise<SharedWishlist[]> {
        try {
            const response = await fetch(`/api/users/${userId}/wishlists`);
            if (!response.ok) return [];
            return await response.json();
        } catch {
            return [];
        }
    }

    // Share to platform
    shareToPlatform(platform: SharePlatform, wishlist: SharedWishlist): void {
        const url = platform.shareUrl(
            wishlist.shareUrl,
            `${wishlist.title} - Список бажань`,
            wishlist.description
        );

        if (platform.id === 'copy') {
            this.copyToClipboard(wishlist.shareUrl);
        } else {
            window.open(url, '_blank', 'width=600,height=400');
        }
    }

    // Copy link to clipboard
    async copyToClipboard(text: string): Promise<boolean> {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        }
    }

    // Generate QR code URL for wishlist
    getQRCodeUrl(shareUrl: string, size: number = 200): string {
        return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(shareUrl)}`;
    }

    // Export wishlist to different formats
    exportWishlist(wishlist: SharedWishlist, format: 'json' | 'csv' | 'pdf'): string | Blob {
        switch (format) {
            case 'json':
                return JSON.stringify(wishlist, null, 2);

            case 'csv': {
                const headers = ['Назва', 'Ціна', 'Пріоритет', 'Нотатки', 'Куплено'];
                const rows = wishlist.items.map((item) => [
                    item.product.name,
                    item.product.price.toString(),
                    item.priority,
                    item.notes || '',
                    item.isPurchased ? 'Так' : 'Ні',
                ]);
                return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
            }

            case 'pdf':
                // In production, generate PDF
                return new Blob(['PDF export not implemented'], { type: 'application/pdf' });

            default:
                return '';
        }
    }

    // Private methods
    private async saveWishlist(wishlist: SharedWishlist): Promise<void> {
        try {
            await fetch('/api/wishlists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(wishlist),
            });
        } catch {
            // Store locally as fallback
            const wishlists = JSON.parse(localStorage.getItem('shared_wishlists') || '[]');
            wishlists.push(wishlist);
            localStorage.setItem('shared_wishlists', JSON.stringify(wishlists));
        }
    }
}

// Singleton instance
export const wishlistSharing = new WishlistSharingService();

// React hook
export function useWishlistSharing() {
    return wishlistSharing;
}
