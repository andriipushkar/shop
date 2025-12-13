import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://techshop.ua';

    return {
        rules: [
            // Default rules for all bots
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/admin/',
                    '/api/',
                    '/auth/',
                    '/checkout/',
                    '/cart/',
                    '/profile/',
                    '/wishlist/',
                    '/compare/',
                    '/orders/',
                    '/_next/',
                    '/static/',
                    // Session and filter parameters
                    '/*?*session',
                    '/*?*token',
                    '/*?*sort=*&',  // Prevent crawling sorted pages
                    '/*?*filter=*', // Prevent crawling filtered pages without main content
                ],
            },
            // Googlebot specific rules
            {
                userAgent: 'Googlebot',
                allow: [
                    '/',
                    '/category/',
                    '/product/',
                    '/search',
                    '/faq',
                    '/about',
                    '/contact',
                    '/delivery',
                    '/warranty',
                    '/returns',
                    '/*.js',
                    '/*.css',
                ],
                disallow: [
                    '/admin/',
                    '/api/',
                    '/auth/',
                    '/checkout/',
                    '/cart/',
                    '/profile/',
                    '/wishlist/',
                    '/compare/',
                ],
            },
            // Googlebot-Image specific rules
            {
                userAgent: 'Googlebot-Image',
                allow: [
                    '/products/',
                    '/images/',
                    '/icons/',
                ],
                disallow: [
                    '/admin/',
                    '/api/',
                ],
            },
            // Bingbot rules
            {
                userAgent: 'Bingbot',
                allow: '/',
                disallow: [
                    '/admin/',
                    '/api/',
                    '/auth/',
                    '/checkout/',
                    '/cart/',
                    '/profile/',
                ],
                // Crawl-delay for Bing to reduce server load
            },
            // Block aggressive bots
            {
                userAgent: 'AhrefsBot',
                disallow: '/',
            },
            {
                userAgent: 'SemrushBot',
                disallow: '/',
            },
            {
                userAgent: 'MJ12bot',
                disallow: '/',
            },
            // Allow Google Ads bot for shopping
            {
                userAgent: 'AdsBot-Google',
                allow: [
                    '/product/',
                    '/category/',
                ],
                disallow: [
                    '/admin/',
                    '/api/',
                    '/auth/',
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
        host: baseUrl,
    };
}
