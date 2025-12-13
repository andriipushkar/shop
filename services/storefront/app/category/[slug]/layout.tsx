import { Metadata } from 'next';
import { categories, getCategoryById, getCategoryBySlug, products as allProducts } from '@/lib/mock-data';
import { CollectionPageJsonLd } from '@/components/ProductJsonLd';
import { generateHreflangAlternates } from '@/lib/seo-config';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://techshop.ua';

// Disable static generation for category pages due to useSearchParams in page.tsx
// Generate static params for all categories (commented out due to dynamic rendering)
// export function generateStaticParams() {
//   return categories.map((category) => ({
//     slug: category.slug,
//   }));
// }

// Force dynamic rendering for category pages
export const dynamic = 'force-dynamic';

// Dynamic metadata for each category
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  // Find category by slug
  const category = getCategoryBySlug(slug);

  if (!category) {
    return {
      title: 'Категорію не знайдено | TechShop',
      description: 'На жаль, категорію не знайдено. Перегляньте інші категорії нашого магазину.',
      robots: { index: false, follow: true },
    };
  }

  // Get parent category for breadcrumb context
  const parentCategory = category.parentId ? getCategoryById(category.parentId) ?? null : null;

  // Calculate product count and price range (in real app, this would come from API)
  const productCount = Math.floor(Math.random() * 500) + 50; // Mock
  const minPrice = 500;
  const maxPrice = 100000;

  // Build dynamic description
  const description = buildCategoryDescription(category, parentCategory, productCount);

  // Generate hreflang alternates
  const hreflang = generateHreflangAlternates(`/category/${slug}`);

  return {
    title: `${category.name} - купити в інтернет-магазині TechShop`,
    description,
    keywords: buildCategoryKeywords(category, parentCategory),
    alternates: {
      canonical: hreflang.canonical,
      languages: hreflang.languages,
    },
    openGraph: {
      title: `${category.name} | TechShop`,
      description,
      url: `${BASE_URL}/category/${slug}`,
      siteName: 'TechShop',
      locale: 'uk_UA',
      type: 'website',
      images: [
        {
          url: `${BASE_URL}/api/og?type=category&title=${encodeURIComponent(category.name)}&subtitle=${encodeURIComponent(`${productCount}+ товарів в категорії`)}`,
          width: 1200,
          height: 630,
          alt: category.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${category.name} | TechShop`,
      description,
    },
    other: {
      'price:currency': 'UAH',
      'price:amount:min': String(minPrice),
      'price:amount:max': String(maxPrice),
    },
  };
}

function buildCategoryDescription(
  category: { name: string; slug: string; icon?: string },
  parentCategory: { name: string } | null,
  productCount: number
): string {
  const categoryContext = parentCategory
    ? `${parentCategory.name} > ${category.name}`
    : category.name;

  const descriptions: Record<string, string> = {
    smartphones: `Купити смартфон в TechShop ⭐ ${productCount}+ моделей ✓ iPhone, Samsung, Xiaomi ✓ Офіційна гарантія ✓ Доставка по Україні ✓ Оплата частинами`,
    laptops: `Ноутбуки в TechShop ⭐ ${productCount}+ моделей ✓ Gaming, ультрабуки, робочі станції ✓ Apple, Dell, HP, Lenovo ✓ Безкоштовна доставка`,
    tablets: `Планшети в TechShop ⭐ ${productCount}+ моделей ✓ iPad, Samsung Galaxy Tab, Xiaomi ✓ Офіційна гарантія ✓ Кредит 0%`,
    tvs: `Телевізори в TechShop ⭐ ${productCount}+ моделей ✓ Smart TV, OLED, QLED ✓ Samsung, LG, Sony ✓ Безкоштовна доставка та встановлення`,
    audio: `Аудіотехніка в TechShop ⭐ ${productCount}+ моделей ✓ Навушники, колонки, саундбари ✓ Sony, JBL, Bose ✓ Гарантія якості`,
    electronics: `Електроніка в TechShop ⭐ ${productCount}+ товарів ✓ Смартфони, ноутбуки, гаджети ✓ Офіційна гарантія ✓ Доставка по всій Україні`,
    appliances: `Побутова техніка в TechShop ⭐ ${productCount}+ моделей ✓ Холодильники, пральні машини, кондиціонери ✓ Доставка та встановлення`,
  };

  // Return specific description or generate generic one
  return (
    descriptions[category.slug] ||
    `${category.name} в інтернет-магазині TechShop ⭐ ${productCount}+ товарів ✓ Низькі ціни ✓ Офіційна гарантія ✓ Безкоштовна доставка від 1000 грн ✓ Зручна оплата`
  );
}

function buildCategoryKeywords(
  category: { name: string; slug: string },
  parentCategory: { name: string } | null
): string[] {
  const baseKeywords = [
    category.name,
    `купити ${category.name.toLowerCase()}`,
    `${category.name.toLowerCase()} ціна`,
    `${category.name.toLowerCase()} Україна`,
    `${category.name.toLowerCase()} Київ`,
    'інтернет-магазин',
    'TechShop',
  ];

  if (parentCategory) {
    baseKeywords.push(
      parentCategory.name,
      `${parentCategory.name.toLowerCase()} ${category.name.toLowerCase()}`
    );
  }

  // Add category-specific keywords
  const specificKeywords: Record<string, string[]> = {
    smartphones: ['iPhone', 'Samsung', 'Xiaomi', 'смартфон', 'мобільний телефон'],
    laptops: ['ноутбук', 'laptop', 'MacBook', 'gaming laptop', 'ультрабук'],
    tablets: ['планшет', 'iPad', 'Galaxy Tab', 'tablet'],
    tvs: ['телевізор', 'Smart TV', 'OLED', 'QLED', '4K'],
    audio: ['навушники', 'колонки', 'саундбар', 'аудіо'],
  };

  return [...baseKeywords, ...(specificKeywords[category.slug] || [])];
}

// Calculate category statistics for JSON-LD
function getCategoryStats(categoryId: string) {
  const categoryProducts = allProducts.filter(p => p.category_id === categoryId);

  if (categoryProducts.length === 0) {
    return null;
  }

  const prices = categoryProducts.map(p => p.price);
  const ratings = categoryProducts.filter(p => p.rating).map(p => p.rating);
  const reviewCounts = categoryProducts.map(p => p.reviewCount || 0);

  return {
    productCount: categoryProducts.length,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    avgRating: ratings.length > 0
      ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
      : 0,
    totalReviews: reviewCounts.reduce((a, b) => a + b, 0),
  };
}

export default async function CategoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    return children;
  }

  const stats = getCategoryStats(category.id);
  const parentCategory = category.parentId ? getCategoryById(category.parentId) : null;

  // Build breadcrumb items for JSON-LD
  const breadcrumbItems = [];
  if (parentCategory) {
    breadcrumbItems.push({
      name: parentCategory.name,
      url: `/category/${parentCategory.slug}`,
    });
  }
  breadcrumbItems.push({
    name: category.name,
    url: `/category/${slug}`,
  });

  return (
    <>
      {/* Structured Data for Category Page */}
      <CollectionPageJsonLd
        name={category.name}
        description={`${category.name} - купити в інтернет-магазині TechShop. ${stats?.productCount || 0} товарів з доставкою по Україні.`}
        url={`/category/${slug}`}
        itemCount={stats?.productCount}
        aggregateRating={stats && stats.totalReviews > 0 ? {
          ratingValue: stats.avgRating,
          reviewCount: stats.totalReviews,
        } : undefined}
        priceRange={stats ? {
          minPrice: stats.minPrice,
          maxPrice: stats.maxPrice,
        } : undefined}
        breadcrumbItems={breadcrumbItems}
      />
      {children}
    </>
  );
}
