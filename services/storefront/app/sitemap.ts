import { MetadataRoute } from 'next';

const BASE_URL = 'https://techshop.ua';

// Mock product data - in production would come from API/database
const products = [
    { slug: 'iphone-15-pro-max', updatedAt: '2024-01-15' },
    { slug: 'macbook-pro-14-m3', updatedAt: '2024-01-14' },
    { slug: 'samsung-galaxy-s24-ultra', updatedAt: '2024-01-13' },
    { slug: 'airpods-pro-2', updatedAt: '2024-01-12' },
    { slug: 'apple-watch-series-9', updatedAt: '2024-01-11' },
];

const categories = [
    { slug: 'smartphones', name: 'Смартфони' },
    { slug: 'laptops', name: 'Ноутбуки' },
    { slug: 'tablets', name: 'Планшети' },
    { slug: 'accessories', name: 'Аксесуари' },
    { slug: 'audio', name: 'Аудіо' },
    { slug: 'wearables', name: 'Носимі пристрої' },
];

export default function sitemap(): MetadataRoute.Sitemap {
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: BASE_URL,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1.0,
        },
        {
            url: `${BASE_URL}/catalog`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: `${BASE_URL}/about`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${BASE_URL}/contacts`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${BASE_URL}/delivery`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.6,
        },
        {
            url: `${BASE_URL}/payment`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.6,
        },
        {
            url: `${BASE_URL}/warranty`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${BASE_URL}/gift-cards`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.7,
        },
        {
            url: `${BASE_URL}/tracking`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.4,
        },
    ];

    const categoryPages: MetadataRoute.Sitemap = categories.map(category => ({
        url: `${BASE_URL}/catalog/${category.slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.8,
    }));

    const productPages: MetadataRoute.Sitemap = products.map(product => ({
        url: `${BASE_URL}/products/${product.slug}`,
        lastModified: new Date(product.updatedAt),
        changeFrequency: 'weekly',
        priority: 0.7,
    }));

    return [...staticPages, ...categoryPages, ...productPages];
}
