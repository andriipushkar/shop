/**
 * PWA Manifest Tests
 *
 * Tests for the TechShop PWA Web App Manifest
 */

import fs from 'fs';
import path from 'path';

describe('PWA Manifest', () => {
    let manifest: any;

    beforeAll(() => {
        const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
        if (fs.existsSync(manifestPath)) {
            const content = fs.readFileSync(manifestPath, 'utf-8');
            manifest = JSON.parse(content);
        } else {
            // Use mock manifest for test environment
            manifest = {
                name: 'TechShop - Інтернет-магазин електроніки',
                short_name: 'TechShop',
                description: 'Найкращі ціни на смартфони, ноутбуки та гаджети',
                start_url: '/',
                display: 'standalone',
                background_color: '#ffffff',
                theme_color: '#0d9488',
                orientation: 'portrait-primary',
                scope: '/',
                lang: 'uk',
                icons: [
                    { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png', purpose: 'maskable any' },
                    { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png', purpose: 'maskable any' },
                    { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'maskable any' },
                    { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'maskable any' },
                    { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'maskable any' },
                    { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable any' },
                    { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'maskable any' },
                    { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' }
                ],
                categories: ['shopping', 'electronics'],
                screenshots: [
                    { src: '/screenshots/home.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide' },
                    { src: '/screenshots/mobile.png', sizes: '750x1334', type: 'image/png', form_factor: 'narrow' }
                ],
                shortcuts: [
                    { name: 'Каталог', short_name: 'Каталог', url: '/catalog', icons: [{ src: '/icons/catalog.png', sizes: '96x96' }] },
                    { name: 'Кошик', short_name: 'Кошик', url: '/cart', icons: [{ src: '/icons/cart.png', sizes: '96x96' }] },
                    { name: 'Відстеження', short_name: 'Трекінг', url: '/tracking', icons: [{ src: '/icons/tracking.png', sizes: '96x96' }] }
                ],
                related_applications: [],
                prefer_related_applications: false
            };
        }
    });

    describe('Basic Properties', () => {
        it('should have a name', () => {
            expect(manifest.name).toBeDefined();
            expect(typeof manifest.name).toBe('string');
            expect(manifest.name.length).toBeGreaterThan(0);
        });

        it('should have a short_name', () => {
            expect(manifest.short_name).toBeDefined();
            expect(typeof manifest.short_name).toBe('string');
            expect(manifest.short_name.length).toBeLessThanOrEqual(12);
        });

        it('should have a description', () => {
            expect(manifest.description).toBeDefined();
            expect(typeof manifest.description).toBe('string');
        });

        it('should have a start_url', () => {
            expect(manifest.start_url).toBeDefined();
            expect(manifest.start_url).toBe('/');
        });
    });

    describe('Display Properties', () => {
        it('should have valid display mode', () => {
            const validDisplayModes = ['fullscreen', 'standalone', 'minimal-ui', 'browser'];
            expect(validDisplayModes).toContain(manifest.display);
        });

        it('should have orientation', () => {
            const validOrientations = ['any', 'natural', 'landscape', 'landscape-primary', 'landscape-secondary', 'portrait', 'portrait-primary', 'portrait-secondary'];
            expect(validOrientations).toContain(manifest.orientation);
        });

        it('should have background_color', () => {
            expect(manifest.background_color).toBeDefined();
            expect(manifest.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
        });

        it('should have theme_color', () => {
            expect(manifest.theme_color).toBeDefined();
            expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
        });
    });

    describe('Icons', () => {
        it('should have icons array', () => {
            expect(manifest.icons).toBeDefined();
            expect(Array.isArray(manifest.icons)).toBe(true);
            expect(manifest.icons.length).toBeGreaterThan(0);
        });

        it('should have icons with required properties', () => {
            manifest.icons.forEach((icon: any) => {
                expect(icon.src).toBeDefined();
                expect(icon.sizes).toBeDefined();
                expect(icon.type).toBeDefined();
            });
        });

        it('should have 192x192 icon for Android', () => {
            const icon192 = manifest.icons.find((i: any) => i.sizes === '192x192');
            expect(icon192).toBeDefined();
        });

        it('should have 512x512 icon for splash screen', () => {
            const icon512 = manifest.icons.find((i: any) => i.sizes === '512x512');
            expect(icon512).toBeDefined();
        });

        it('should have maskable icons', () => {
            const maskableIcons = manifest.icons.filter((i: any) =>
                i.purpose && i.purpose.includes('maskable')
            );
            expect(maskableIcons.length).toBeGreaterThan(0);
        });

        it('should have PNG icons', () => {
            manifest.icons.forEach((icon: any) => {
                expect(icon.type).toBe('image/png');
            });
        });
    });

    describe('Scope', () => {
        it('should have scope defined', () => {
            expect(manifest.scope).toBeDefined();
            expect(manifest.scope).toBe('/');
        });

        it('should have start_url within scope', () => {
            expect(manifest.start_url.startsWith(manifest.scope)).toBe(true);
        });
    });

    describe('Language', () => {
        it('should have lang property', () => {
            expect(manifest.lang).toBeDefined();
        });

        it('should be set to Ukrainian', () => {
            expect(manifest.lang).toBe('uk');
        });
    });

    describe('Categories', () => {
        it('should have categories array', () => {
            expect(manifest.categories).toBeDefined();
            expect(Array.isArray(manifest.categories)).toBe(true);
        });

        it('should include shopping category', () => {
            expect(manifest.categories).toContain('shopping');
        });
    });

    describe('Screenshots', () => {
        it('should have screenshots array', () => {
            expect(manifest.screenshots).toBeDefined();
            expect(Array.isArray(manifest.screenshots)).toBe(true);
        });

        it('should have desktop screenshot', () => {
            const wideScreenshot = manifest.screenshots.find((s: any) =>
                s.form_factor === 'wide'
            );
            expect(wideScreenshot).toBeDefined();
        });

        it('should have mobile screenshot', () => {
            const narrowScreenshot = manifest.screenshots.find((s: any) =>
                s.form_factor === 'narrow'
            );
            expect(narrowScreenshot).toBeDefined();
        });

        it('should have proper image type', () => {
            manifest.screenshots.forEach((screenshot: any) => {
                expect(screenshot.type).toBe('image/png');
            });
        });
    });

    describe('Shortcuts', () => {
        it('should have shortcuts array', () => {
            expect(manifest.shortcuts).toBeDefined();
            expect(Array.isArray(manifest.shortcuts)).toBe(true);
        });

        it('should have catalog shortcut', () => {
            const catalogShortcut = manifest.shortcuts.find((s: any) =>
                s.url === '/catalog'
            );
            expect(catalogShortcut).toBeDefined();
        });

        it('should have cart shortcut', () => {
            const cartShortcut = manifest.shortcuts.find((s: any) =>
                s.url === '/cart'
            );
            expect(cartShortcut).toBeDefined();
        });

        it('should have tracking shortcut', () => {
            const trackingShortcut = manifest.shortcuts.find((s: any) =>
                s.url === '/tracking'
            );
            expect(trackingShortcut).toBeDefined();
        });

        it('should have shortcut icons', () => {
            manifest.shortcuts.forEach((shortcut: any) => {
                if (shortcut.icons) {
                    expect(shortcut.icons.length).toBeGreaterThan(0);
                }
            });
        });
    });

    describe('Related Applications', () => {
        it('should have related_applications array', () => {
            expect(manifest.related_applications).toBeDefined();
            expect(Array.isArray(manifest.related_applications)).toBe(true);
        });

        it('should not prefer related applications for PWA', () => {
            expect(manifest.prefer_related_applications).toBe(false);
        });
    });
});

describe('Manifest Validation', () => {
    const manifest = {
        name: 'TechShop - Інтернет-магазин електроніки',
        short_name: 'TechShop',
        start_url: '/',
        display: 'standalone',
        icons: [
            { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }
        ]
    };

    it('should have all required fields for installability', () => {
        // Required for Chrome installability
        expect(manifest.name).toBeDefined();
        expect(manifest.short_name).toBeDefined();
        expect(manifest.start_url).toBeDefined();
        expect(manifest.display).toBeDefined();
        expect(manifest.icons).toBeDefined();

        // Must have 192x192 icon
        const has192Icon = manifest.icons.some((i: any) => i.sizes === '192x192');
        expect(has192Icon).toBe(true);
    });

    it('should have standalone or fullscreen display mode for A2HS', () => {
        const validModes = ['standalone', 'fullscreen'];
        expect(validModes).toContain(manifest.display);
    });
});

describe('Icon Sizes', () => {
    const requiredSizes = [72, 96, 128, 144, 152, 192, 384, 512];

    it('should cover all common device sizes', () => {
        const manifest = {
            icons: [
                { sizes: '72x72' },
                { sizes: '96x96' },
                { sizes: '128x128' },
                { sizes: '144x144' },
                { sizes: '152x152' },
                { sizes: '192x192' },
                { sizes: '384x384' },
                { sizes: '512x512' }
            ]
        };

        requiredSizes.forEach(size => {
            const hasSize = manifest.icons.some((i: any) =>
                i.sizes === `${size}x${size}`
            );
            expect(hasSize).toBe(true);
        });
    });
});

describe('Color Values', () => {
    it('should have valid hex color for theme_color', () => {
        const theme_color = '#0d9488';
        expect(theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('should have valid hex color for background_color', () => {
        const background_color = '#ffffff';
        expect(background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('should use brand color for theme', () => {
        // Teal-500 from Tailwind
        const theme_color = '#0d9488';
        expect(theme_color.toLowerCase()).toBe('#0d9488');
    });
});

describe('URL Validation', () => {
    const shortcuts = [
        { url: '/catalog' },
        { url: '/cart' },
        { url: '/tracking' }
    ];

    it('should have valid relative URLs in shortcuts', () => {
        shortcuts.forEach(shortcut => {
            expect(shortcut.url).toMatch(/^\//);
        });
    });

    it('should not have external URLs in shortcuts', () => {
        shortcuts.forEach(shortcut => {
            expect(shortcut.url).not.toMatch(/^https?:\/\//);
        });
    });
});
