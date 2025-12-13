import { Metadata } from "next";
import { getProducts, getCategories } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import HeroSection from "@/components/HeroSection";
import PromoSection from "@/components/PromoSection";
import HomeRecentlyViewed from "@/components/HomeRecentlyViewed";
import { Suspense } from "react";
import SearchFilterWrapper from "@/components/SearchFilterWrapper";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { products as mockProducts, categories as mockCategories, getRootCategories } from "@/lib/mock-data";
import { ItemListJsonLd } from "@/components/ProductJsonLd";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://techshop.ua';

// Homepage metadata for SEO
export const metadata: Metadata = {
  title: "TechShop - Інтернет-магазин електроніки в Україні",
  description: "Купити смартфони, ноутбуки, планшети та електроніку в TechShop. ⭐ Офіційна гарантія ✓ Доставка по всій Україні ✓ Найкращі ціни ✓ 5000+ товарів",
  keywords: [
    "інтернет-магазин",
    "електроніка",
    "смартфони",
    "ноутбуки",
    "планшети",
    "техніка",
    "Україна",
    "купити",
    "TechShop",
  ],
  alternates: {
    canonical: BASE_URL,
    languages: {
      'uk-UA': BASE_URL,
      'en-US': `${BASE_URL}/en`,
    },
  },
  openGraph: {
    title: "TechShop - Інтернет-магазин електроніки",
    description: "Купити смартфони, ноутбуки, планшети та електроніку з доставкою по Україні. Офіційна гарантія, найкращі ціни.",
    url: BASE_URL,
    siteName: "TechShop",
    locale: "uk_UA",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/api/og?type=default&title=TechShop&subtitle=Інтернет-магазин електроніки`,
        width: 1200,
        height: 630,
        alt: "TechShop - Інтернет-магазин електроніки",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TechShop - Інтернет-магазин електроніки",
    description: "Купити електроніку з доставкою по Україні",
    images: [`${BASE_URL}/api/og?type=default&title=TechShop&subtitle=Інтернет-магазин електроніки`],
  },
};

// Use ISR instead of force-dynamic for better performance
export const revalidate = 60; // Revalidate every 60 seconds

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function ProductsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
          <div className="aspect-square bg-gray-200" />
          <div className="p-4 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-6 bg-gray-200 rounded w-3/4" />
            <div className="h-8 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;

  const filter = {
    search: typeof params.search === 'string' ? params.search : undefined,
    minPrice: typeof params.min_price === 'string' ? Number(params.min_price) : undefined,
    maxPrice: typeof params.max_price === 'string' ? Number(params.max_price) : undefined,
    categoryId: typeof params.category_id === 'string' ? params.category_id : undefined,
  };

  // Try API first, fallback to mock data
  let apiProducts = await getProducts(filter);
  let apiCategories = await getCategories();

  // Use mock data if API returns empty
  let products = apiProducts.length > 0 ? apiProducts : mockProducts.slice(0, 100);
  let categories = apiCategories.length > 0 ? apiCategories : getRootCategories().map(c => ({ id: c.id, name: c.name }));

  // Apply filters to mock data if needed
  if (apiProducts.length === 0 && (filter.search || filter.minPrice || filter.maxPrice || filter.categoryId)) {
    products = mockProducts.filter(p => {
      if (filter.search && !p.name.toLowerCase().includes(filter.search.toLowerCase())) return false;
      if (filter.minPrice && p.price < filter.minPrice) return false;
      if (filter.maxPrice && p.price > filter.maxPrice) return false;
      if (filter.categoryId && p.category_id !== filter.categoryId) return false;
      return true;
    }).slice(0, 100);
  }

  const hasFilters = filter.search || filter.minPrice || filter.maxPrice || filter.categoryId;
  const showHero = !hasFilters;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* SEO: H1 heading (visually hidden but accessible) */}
      <h1 className="sr-only">TechShop - Інтернет-магазин електроніки в Україні</h1>

      {/* ItemList JSON-LD for product listing */}
      {products.length > 0 && (
        <ItemListJsonLd
          name="Популярні товари TechShop"
          description="Найпопулярніші товари електроніки в інтернет-магазині TechShop"
          products={products.slice(0, 20).map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            image_url: p.image_url,
            rating: (p as unknown as { rating?: number }).rating,
          }))}
          url="/"
        />
      )}

      {/* Hero Section - only show on main page without filters */}
      {showHero && <HeroSection />}

      {/* Promo Section - only show on main page without filters */}
      {showHero && <PromoSection />}

      {/* Products Section */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                {hasFilters ? 'Результати пошуку' : 'Наші товари'}
              </h2>
              {hasFilters && products.length > 0 && (
                <p className="text-gray-500 mt-1">
                  Знайдено {products.length} товар{products.length === 1 ? '' : products.length < 5 ? 'и' : 'ів'}
                </p>
              )}
            </div>
            {!hasFilters && (
              <Link
                href="/category/all"
                className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium group"
              >
                Переглянути всі
                <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            )}
          </div>

          {/* Search & Filter */}
          <div className="mb-8">
            <Suspense fallback={<div className="bg-white rounded-2xl shadow-sm p-6 animate-pulse h-24" />}>
              <SearchFilterWrapper categories={categories} />
            </Suspense>
          </div>

          {/* Products Grid */}
          {products.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {hasFilters ? 'Нічого не знайдено' : 'Товари не знайдено'}
              </h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                {hasFilters
                  ? 'Спробуйте змінити параметри пошуку або скинути фільтри'
                  : 'Схоже, що наразі немає товарів. Перевірте, чи працює бекенд.'}
              </p>
              {hasFilters && (
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors"
                >
                  Скинути фільтри
                </Link>
              )}
            </div>
          ) : (
            <Suspense fallback={<ProductsSkeleton />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    priority={index < 8} // Prioritize first 8 products for LCP
                  />
                ))}
              </div>
            </Suspense>
          )}

          {/* Load More Button */}
          {products.length > 0 && products.length >= 8 && !hasFilters && (
            <div className="text-center mt-12">
              <button className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-900 rounded-xl font-semibold border-2 border-gray-200 hover:border-teal-500 hover:text-teal-600 transition-all duration-200">
                Завантажити ще
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Recently Viewed Section */}
      {showHero && (
        <Suspense fallback={null}>
          <HomeRecentlyViewed />
        </Suspense>
      )}

      {/* Why Choose Us Section */}
      {showHero && (
        <section className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                Чому обирають нас
              </h2>
              <p className="text-gray-500 max-w-2xl mx-auto">
                Ми пропонуємо найкращий сервіс та якісні товари за доступними цінами
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-6 rounded-2xl bg-gray-50 hover:bg-teal-50 transition-colors group">
                <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-teal-200 transition-colors">
                  <span className="text-3xl">🏆</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Перевірена якість
                </h3>
                <p className="text-gray-500 text-sm">
                  Всі товари проходять ретельну перевірку перед відправкою
                </p>
              </div>
              <div className="text-center p-6 rounded-2xl bg-gray-50 hover:bg-teal-50 transition-colors group">
                <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-teal-200 transition-colors">
                  <span className="text-3xl">💎</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Найкращі ціни
                </h3>
                <p className="text-gray-500 text-sm">
                  Гарантуємо конкурентні ціни на всі товари в каталозі
                </p>
              </div>
              <div className="text-center p-6 rounded-2xl bg-gray-50 hover:bg-teal-50 transition-colors group">
                <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-teal-200 transition-colors">
                  <span className="text-3xl">🤝</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Підтримка 24/7
                </h3>
                <p className="text-gray-500 text-sm">
                  Наша команда завжди готова допомогти вам з будь-яким питанням
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
