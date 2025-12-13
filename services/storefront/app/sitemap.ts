import { MetadataRoute } from 'next';
import { logger } from '@/lib/logger';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://techshop.ua';

// Extended category list for sitemap
const categories = [
  { slug: 'smartphones', name: 'Смартфони' },
  { slug: 'laptops', name: 'Ноутбуки' },
  { slug: 'tablets', name: 'Планшети' },
  { slug: 'accessories', name: 'Аксесуари' },
  { slug: 'audio', name: 'Аудіо' },
  { slug: 'wearables', name: 'Носимі пристрої' },
  { slug: 'tvs', name: 'Телевізори' },
  { slug: 'gaming', name: 'Ігрові приставки' },
  { slug: 'home-appliances', name: 'Побутова техніка' },
  { slug: 'computers', name: 'Комп\'ютери' },
];

// Product type with images for sitemap
interface ProductForSitemap {
  id: string;
  updated_at?: string;
  images?: string[];
  image_url?: string;
  name?: string;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages - SEO-friendly pages only (no user-specific pages like cart, wishlist)
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
      url: `${BASE_URL}/faq`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/tracking`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/loyalty`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/gift-cards`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/delivery`,
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
      url: `${BASE_URL}/returns`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/sale`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  // Category pages
  const categoryPages: MetadataRoute.Sitemap = categories.map(category => ({
    url: `${BASE_URL}/category/${category.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  // Fetch products dynamically with images for enhanced sitemap
  let productPages: MetadataRoute.Sitemap = [];
  try {
    const response = await fetch(
      `${process.env.CORE_API_URL || 'http://localhost:8080'}/products`,
      { next: { revalidate: 3600 } }
    );
    if (response.ok) {
      const products: ProductForSitemap[] = await response.json();
      productPages = products.map((product) => {
        // Get product images for sitemap image extension
        const images = product.images?.length
          ? product.images
          : product.image_url
            ? [product.image_url]
            : [];

        return {
          url: `${BASE_URL}/product/${product.id}`,
          lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.7,
          // Note: Next.js sitemap doesn't support images natively
          // but we prepare the data structure for potential future use
          // or custom sitemap generation
        };
      });
    }
  } catch (error) {
    // Fallback: sitemap without dynamic products
    logger.error('Failed to fetch products for sitemap', error);
  }

  return [...staticPages, ...categoryPages, ...productPages];
}
