import { Metadata } from 'next';
import { notFound } from 'next/navigation';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://techshop.ua';

// Mock product fetcher - in real app, this would fetch from API
async function getProduct(id: string) {
  // Mock product data
  const products: Record<string, {
    id: string;
    name: string;
    description: string;
    price: number;
    compare_price?: number;
    sku: string;
    stock: number;
    brand: string;
    images: string[];
    category: { id: string; name: string; slug: string };
    rating: number;
    reviews_count: number;
  }> = {
    '1': {
      id: '1',
      name: 'Смартфон Apple iPhone 15 Pro Max 256GB',
      description: 'iPhone 15 Pro Max — це найпотужніший iPhone з-поміж усіх. Він оснащений чипом A17 Pro, який забезпечує неймовірну продуктивність для ігор та додатків. Титановий корпус робить його одночасно легким та міцним.',
      price: 54999,
      compare_price: 59999,
      sku: 'IPHONE15PM256-BLK',
      stock: 15,
      brand: 'Apple',
      images: ['/products/iphone-1.jpg', '/products/iphone-2.jpg'],
      category: { id: 'smartphones', name: 'Смартфони', slug: 'smartphones' },
      rating: 4.8,
      reviews_count: 234,
    },
    '2': {
      id: '2',
      name: 'Samsung Galaxy S24 Ultra 512GB',
      description: 'Samsung Galaxy S24 Ultra - флагманський смартфон з потужним процесором, професійною камерою та великим AMOLED дисплеєм.',
      price: 49999,
      compare_price: 54999,
      sku: 'SAMSUNG-S24-ULTRA-512',
      stock: 23,
      brand: 'Samsung',
      images: ['/products/samsung-1.jpg', '/products/samsung-2.jpg'],
      category: { id: 'smartphones', name: 'Смартфони', slug: 'smartphones' },
      rating: 4.7,
      reviews_count: 189,
    },
  };

  return products[id] || null;
}

// Generate static params for common products
export async function generateStaticParams() {
  // In production, fetch from API
  return [
    { id: '1' },
    { id: '2' },
  ];
}

// Dynamic metadata for each product
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    return {
      title: 'Товар не знайдено | TechShop',
      description: 'На жаль, товар не знайдено. Перегляньте інші товари нашого магазину.',
      robots: { index: false, follow: true },
    };
  }

  // Build SEO-optimized title and description
  const title = `${product.name} - купити в TechShop | Ціна ${product.price.toLocaleString('uk-UA')} ₴`;
  const description = `${product.name} ⭐ ${product.rating}/5 (${product.reviews_count} відгуків) ✓ Ціна ${product.price.toLocaleString('uk-UA')} грн ${product.compare_price ? `(знижка ${Math.round((1 - product.price / product.compare_price) * 100)}%)` : ''} ✓ Офіційна гарантія ✓ Доставка по Україні`;

  const productUrl = `${BASE_URL}/product/${id}`;
  const productImageUrl = product.images[0]?.startsWith('http')
    ? product.images[0]
    : `${BASE_URL}${product.images[0]}`;

  // Dynamic OG image URL with product details
  const ogImageUrl = `${BASE_URL}/api/og?` + new URLSearchParams({
    type: 'product',
    title: product.name,
    price: String(product.price),
    ...(product.compare_price && { oldPrice: String(product.compare_price) }),
    rating: String(product.rating),
    brand: product.brand,
  }).toString();

  return {
    title,
    description,
    keywords: [
      product.name,
      product.brand,
      product.category.name,
      `купити ${product.name.toLowerCase()}`,
      `${product.brand} ціна`,
      `${product.category.name.toLowerCase()} ${product.brand}`,
      'TechShop',
      'інтернет-магазин',
      'Україна',
    ],
    alternates: {
      canonical: productUrl,
      languages: {
        'uk-UA': productUrl,
        'en-US': `${BASE_URL}/en/product/${id}`,
      },
    },
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 160),
      url: productUrl,
      siteName: 'TechShop',
      locale: 'uk_UA',
      alternateLocale: 'en_US',
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: product.name,
        },
        ...product.images.map((img, index) => ({
          url: img.startsWith('http') ? img : `${BASE_URL}${img}`,
          width: 800,
          height: 800,
          alt: `${product.name} - зображення ${index + 1}`,
        })),
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description: product.description.slice(0, 160),
      images: [ogImageUrl],
    },
    other: {
      // Product-specific meta tags for rich snippets
      'product:price:amount': String(product.price),
      'product:price:currency': 'UAH',
      'product:availability': product.stock > 0 ? 'in stock' : 'out of stock',
      'product:brand': product.brand,
      'product:condition': 'new',
      'product:retailer_item_id': product.sku,
    },
  };
}

export default async function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
