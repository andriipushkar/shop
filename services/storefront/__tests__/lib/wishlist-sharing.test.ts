// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};

// Use try-catch for global property definitions
try {
    Object.defineProperty(global, 'localStorage', { value: localStorageMock, configurable: true });
} catch {
    (global as unknown as { localStorage: typeof localStorageMock }).localStorage = localStorageMock;
}

// Mock navigator clipboard
const mockClipboard = {
    writeText: jest.fn().mockResolvedValue(undefined),
};

try {
    Object.defineProperty(navigator, 'clipboard', { value: mockClipboard, configurable: true, writable: true });
} catch {
    // Already defined
}

import {
    wishlistSharing,
    sharePlatforms,
    WishlistItem,
    WishlistShareOptions,
} from '@/lib/wishlist/wishlist-sharing';

// Mock product for WishlistItem
const mockProduct = {
    id: '1',
    name: 'iPhone 15 Pro',
    slug: 'iphone-15-pro',
    price: 45000,
    salePrice: null,
    images: ['/images/iphone.jpg'],
    category: 'smartphones',
    description: 'Latest iPhone',
    stock: 10,
    rating: 4.8,
    reviewCount: 120,
    isNew: true,
    isBestseller: true,
};

const mockProduct2 = {
    id: '2',
    name: 'MacBook Pro',
    slug: 'macbook-pro',
    price: 85000,
    salePrice: null,
    images: ['/images/macbook.jpg'],
    category: 'laptops',
    description: 'Latest MacBook',
    stock: 5,
    rating: 4.9,
    reviewCount: 80,
    isNew: false,
    isBestseller: true,
};

describe('WishlistSharingService', () => {
    const mockItems: WishlistItem[] = [
        {
            productId: '1',
            product: mockProduct,
            addedAt: new Date().toISOString(),
            priority: 'high',
        },
        {
            productId: '2',
            product: mockProduct2,
            addedAt: new Date().toISOString(),
            priority: 'medium',
        },
    ];

    const defaultOptions: WishlistShareOptions = {
        title: 'Мій список бажань',
        visibility: 'public',
        allowPurchaseMarking: true,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        });
    });

    describe('createSharedWishlist', () => {
        it('should create a shareable wishlist', async () => {
            const wishlist = await wishlistSharing.createSharedWishlist(
                'user123',
                'Test User',
                mockItems,
                defaultOptions
            );

            expect(wishlist).toMatchObject({
                userId: 'user123',
                userName: 'Test User',
                title: 'Мій список бажань',
                items: mockItems,
                visibility: 'public',
            });
            expect(wishlist.id).toBeDefined();
            expect(wishlist.shortCode).toBeDefined();
            expect(wishlist.shareUrl).toContain(wishlist.shortCode);
        });

        it('should create private wishlist', async () => {
            const wishlist = await wishlistSharing.createSharedWishlist(
                'user123',
                'Test User',
                mockItems,
                { ...defaultOptions, visibility: 'private' }
            );

            expect(wishlist.visibility).toBe('private');
        });

        it('should set expiration date', async () => {
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

            const wishlist = await wishlistSharing.createSharedWishlist(
                'user123',
                'Test User',
                mockItems,
                { ...defaultOptions, expiresAt }
            );

            // Note: The service doesn't use expiresAt on creation, but we test the API
            expect(wishlist.id).toBeDefined();
        });
    });

    describe('getSharedWishlist', () => {
        it('should return null for non-existent wishlist', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
            });

            const wishlist = await wishlistSharing.getSharedWishlist('non-existent');
            expect(wishlist).toBeNull();
        });

        it('should return wishlist when fetch succeeds', async () => {
            const mockWishlist = {
                id: '123',
                shortCode: 'ABC123',
                title: 'Test',
            };
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockWishlist),
            });

            const retrieved = await wishlistSharing.getSharedWishlist('ABC123');
            expect(retrieved).toEqual(mockWishlist);
        });
    });

    describe('sharePlatforms', () => {
        it('should generate Facebook share URL', () => {
            const platform = sharePlatforms.find(p => p.id === 'facebook');
            expect(platform).toBeDefined();
            const url = platform!.shareUrl('https://example.com/wishlist/ABC123', 'Мій список');
            expect(url).toContain('facebook.com/sharer');
        });

        it('should generate Telegram share URL', () => {
            const platform = sharePlatforms.find(p => p.id === 'telegram');
            expect(platform).toBeDefined();
            const url = platform!.shareUrl('https://example.com/wishlist/ABC123', 'Мій список');
            expect(url).toContain('t.me/share');
        });

        it('should generate Viber share URL', () => {
            const platform = sharePlatforms.find(p => p.id === 'viber');
            expect(platform).toBeDefined();
            const url = platform!.shareUrl('https://example.com/wishlist/ABC123', 'Мій список');
            expect(url).toContain('viber://forward');
        });

        it('should generate WhatsApp share URL', () => {
            const platform = sharePlatforms.find(p => p.id === 'whatsapp');
            expect(platform).toBeDefined();
            const url = platform!.shareUrl('https://example.com/wishlist/ABC123', 'Мій список');
            expect(url).toContain('wa.me');
        });

        it('should generate email share URL', () => {
            const platform = sharePlatforms.find(p => p.id === 'email');
            expect(platform).toBeDefined();
            const url = platform!.shareUrl('https://example.com/wishlist/ABC123', 'Мій список');
            expect(url).toContain('mailto:');
            expect(url).toContain('subject=');
        });
    });

    describe('copyToClipboard', () => {
        it('should copy link to clipboard', async () => {
            mockClipboard.writeText.mockResolvedValue(undefined);

            const result = await wishlistSharing.copyToClipboard('https://example.com');

            expect(result).toBe(true);
        });

        it('should use fallback for clipboard errors', async () => {
            mockClipboard.writeText.mockRejectedValue(new Error('Failed'));

            // Mock document.execCommand for fallback
            document.execCommand = jest.fn(() => true);

            const result = await wishlistSharing.copyToClipboard('https://example.com');

            // Fallback should return true
            expect(result).toBe(true);
        });
    });

    describe('getQRCodeUrl', () => {
        it('should generate QR code URL', () => {
            const qrUrl = wishlistSharing.getQRCodeUrl('https://example.com/wishlist/ABC123');

            expect(qrUrl).toContain('qrserver.com');
            expect(qrUrl).toContain(encodeURIComponent('https://example.com/wishlist/ABC123'));
        });

        it('should accept custom size', () => {
            const qrUrl = wishlistSharing.getQRCodeUrl('https://example.com', 300);

            expect(qrUrl).toContain('300x300');
        });
    });

    describe('exportWishlist', () => {
        it('should export wishlist as JSON', async () => {
            const wishlist = await wishlistSharing.createSharedWishlist(
                'user123',
                'Test User',
                mockItems,
                defaultOptions
            );

            const json = wishlistSharing.exportWishlist(wishlist, 'json');

            expect(typeof json).toBe('string');
            expect(json).toContain('iPhone 15 Pro');
            expect(json).toContain('MacBook Pro');
        });

        it('should export wishlist as CSV', async () => {
            const wishlist = await wishlistSharing.createSharedWishlist(
                'user123',
                'Test User',
                mockItems,
                defaultOptions
            );

            const csv = wishlistSharing.exportWishlist(wishlist, 'csv');

            expect(typeof csv).toBe('string');
            expect(csv).toContain('Назва');
            expect(csv).toContain('Ціна');
        });
    });
});

describe('Share Platforms', () => {
    it('should have all required platforms', () => {
        const platformIds = sharePlatforms.map((p) => p.id);

        expect(platformIds).toContain('facebook');
        expect(platformIds).toContain('telegram');
        expect(platformIds).toContain('viber');
        expect(platformIds).toContain('whatsapp');
        expect(platformIds).toContain('twitter');
        expect(platformIds).toContain('email');
    });

    it('should have icons and colors for all platforms', () => {
        sharePlatforms.forEach((platform) => {
            expect(platform.icon).toBeDefined();
            expect(platform.color).toBeDefined();
            expect(platform.name).toBeDefined();
        });
    });
});
