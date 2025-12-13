import { Metadata } from 'next';
import { generateHreflangAlternates } from '@/lib/seo-config';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://techshop.ua';

// Force dynamic rendering for search pages
export const dynamic = 'force-dynamic';

// Dynamic metadata for search page
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const query = params?.q || '';
  const page = params?.page ? parseInt(params.page) : 1;

  // Generate hreflang alternates
  const hreflang = generateHreflangAlternates('/search');

  // Base metadata for empty search
  if (!query) {
    return {
      title: 'Пошук товарів | TechShop',
      description: 'Пошук товарів в інтернет-магазині TechShop. Електроніка, смартфони, ноутбуки та аксесуари з доставкою по Україні.',
      alternates: {
        canonical: `${BASE_URL}/search`,
        languages: hreflang.languages,
      },
      openGraph: {
        title: 'Пошук товарів | TechShop',
        description: 'Пошук товарів в інтернет-магазині TechShop',
        url: `${BASE_URL}/search`,
        type: 'website',
      },
    };
  }

  // Dynamic metadata for search with query
  const title = `"${query}" - пошук товарів${page > 1 ? ` (сторінка ${page})` : ''} | TechShop`;
  const description = `Результати пошуку за запитом "${query}" в TechShop. Знайдіть смартфони, ноутбуки, електроніку та аксесуари за найкращими цінами.`;
  const canonicalUrl = `${BASE_URL}/search?q=${encodeURIComponent(query)}${page > 1 ? `&page=${page}` : ''}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        'uk-UA': canonicalUrl,
        'en-US': `${BASE_URL}/en/search?q=${encodeURIComponent(query)}${page > 1 ? `&page=${page}` : ''}`,
        'x-default': canonicalUrl,
      },
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website',
      images: [
        {
          url: `${BASE_URL}/api/og?type=default&title=${encodeURIComponent(`Пошук: ${query}`)}&subtitle=${encodeURIComponent('Результати пошуку в TechShop')}`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    // Don't index empty searches or deep pagination
    robots: {
      index: !!query && page <= 5,
      follow: true,
    },
  };
}

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
