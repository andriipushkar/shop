import { getProducts, getCategories } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { Suspense } from "react";
import SearchFilterWrapper from "@/components/SearchFilterWrapper";

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;

  const filter = {
    search: typeof params.search === 'string' ? params.search : undefined,
    minPrice: typeof params.min_price === 'string' ? Number(params.min_price) : undefined,
    maxPrice: typeof params.max_price === 'string' ? Number(params.max_price) : undefined,
    categoryId: typeof params.category_id === 'string' ? params.category_id : undefined,
  };

  const [products, categories] = await Promise.all([
    getProducts(filter),
    getCategories()
  ]);
  const hasFilters = filter.search || filter.minPrice || filter.maxPrice || filter.categoryId;

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
            Наші товари
          </h1>
          <p className="text-lg text-gray-600">
            Оберіть товари та додайте їх до кошика
          </p>
        </div>

        <Suspense fallback={<div className="bg-white rounded-xl shadow-sm p-6 mb-8 animate-pulse h-24" />}>
          <SearchFilterWrapper categories={categories} />
        </Suspense>

        {products.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-xl shadow-sm">
            <p className="text-gray-500">
              {hasFilters ? 'Товарів за вашим запитом не знайдено' : 'Товари не знайдено. Чи працює бекенд?'}
            </p>
          </div>
        ) : (
          <>
            {hasFilters && (
              <p className="text-gray-600 mb-4">Знайдено товарів: {products.length}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
