'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PlusIcon, CheckIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import { useCart } from '@/lib/cart-context';
import { logger } from '@/lib/logger';

export interface ProductItem {
  id: string;
  name: string;
  price: number;
  comparePrice?: number;
  image: string;
  url: string;
  inStock: boolean;
}

export interface FrequentlyBoughtTogetherProps {
  currentProduct: ProductItem;
  recommendedProducts: ProductItem[];
  className?: string;
  title?: string;
}

/**
 * Frequently Bought Together Component
 * Shows complementary products that are often purchased together
 */
export default function FrequentlyBoughtTogether({
  currentProduct,
  recommendedProducts,
  className = '',
  title = 'Часто купують разом',
}: FrequentlyBoughtTogetherProps) {
  const { addToCart } = useCart();
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set([currentProduct.id, ...recommendedProducts.slice(0, 2).map(p => p.id)])
  );
  const [isAdded, setIsAdded] = useState(false);

  // Calculate total price
  const allProducts = [currentProduct, ...recommendedProducts];
  const selectedItems = allProducts.filter(p => selectedProducts.has(p.id));
  const totalPrice = selectedItems.reduce((sum, p) => sum + p.price, 0);
  const totalComparePrice = selectedItems.reduce((sum, p) => sum + (p.comparePrice || p.price), 0);
  const totalDiscount = totalComparePrice - totalPrice;
  const bundleDiscount = Math.round(totalPrice * 0.05); // Additional 5% bundle discount
  const finalPrice = totalPrice - bundleDiscount;

  // Toggle product selection
  const toggleProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      // Don't allow deselecting the current product
      if (productId !== currentProduct.id) {
        newSelected.delete(productId);
      }
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  // Add all selected to cart
  const handleAddAllToCart = () => {
    selectedItems.forEach(product => {
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image,
        sku: product.id,
        stock: product.inStock ? 10 : 0,
      });
    });
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  if (recommendedProducts.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white rounded-2xl shadow-sm p-6 ${className}`}>
      <h3 className="text-xl font-bold text-gray-900 mb-6">{title}</h3>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Products Grid */}
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* Current Product */}
            <ProductCard
              product={currentProduct}
              isSelected={selectedProducts.has(currentProduct.id)}
              onToggle={() => {}} // Current product can't be deselected
              isMain
            />

            {/* Plus icons and recommended products */}
            {recommendedProducts.map((product, index) => (
              <div key={product.id} className="flex items-center gap-2">
                <PlusIcon className="w-6 h-6 text-gray-400 flex-shrink-0" />
                <ProductCard
                  product={product}
                  isSelected={selectedProducts.has(product.id)}
                  onToggle={() => toggleProduct(product.id)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Price Summary */}
        <div className="lg:w-72 flex-shrink-0">
          <div className="bg-gray-50 rounded-xl p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Товарів вибрано:</span>
                <span className="font-medium">{selectedItems.length}</span>
              </div>

              {totalDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Звичайна ціна:</span>
                  <span className="text-gray-400 line-through">
                    {totalComparePrice.toLocaleString('uk-UA')} ₴
                  </span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Ціна комплекту:</span>
                <span className="font-medium">{totalPrice.toLocaleString('uk-UA')} ₴</span>
              </div>

              {bundleDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Знижка за комплект (-5%):</span>
                  <span>-{bundleDiscount.toLocaleString('uk-UA')} ₴</span>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between items-baseline mb-4">
                <span className="text-gray-700 font-medium">Разом:</span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-gray-900">
                    {finalPrice.toLocaleString('uk-UA')} ₴
                  </span>
                  {totalDiscount + bundleDiscount > 0 && (
                    <p className="text-sm text-green-600">
                      Економія {(totalDiscount + bundleDiscount).toLocaleString('uk-UA')} ₴
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={handleAddAllToCart}
                disabled={selectedItems.length === 0 || isAdded}
                className={`w-full py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                  isAdded
                    ? 'bg-green-500 text-white'
                    : 'bg-teal-600 hover:bg-teal-700 text-white'
                } disabled:bg-gray-300 disabled:cursor-not-allowed`}
              >
                {isAdded ? (
                  <>
                    <CheckIcon className="w-5 h-5" />
                    Додано до кошика!
                  </>
                ) : (
                  <>
                    <ShoppingCartIcon className="w-5 h-5" />
                    Додати {selectedItems.length} товарів
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual product card
 */
function ProductCard({
  product,
  isSelected,
  onToggle,
  isMain = false,
}: {
  product: ProductItem;
  isSelected: boolean;
  onToggle: () => void;
  isMain?: boolean;
}) {
  return (
    <div
      className={`relative p-3 rounded-xl border-2 transition-all cursor-pointer ${
        isSelected
          ? 'border-teal-500 bg-teal-50'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      } ${isMain ? 'ring-2 ring-teal-200' : ''}`}
      onClick={onToggle}
      style={{ width: '140px' }}
    >
      {/* Selection checkbox */}
      <div
        className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
          isSelected
            ? 'bg-teal-500 border-teal-500'
            : 'bg-white border-gray-300'
        }`}
      >
        {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
      </div>

      {/* Main product badge */}
      {isMain && (
        <div className="absolute top-2 left-2 bg-teal-600 text-white text-xs px-1.5 py-0.5 rounded">
          Цей товар
        </div>
      )}

      {/* Product Image */}
      <div className="relative w-full aspect-square mb-2">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-contain"
        />
      </div>

      {/* Product Info */}
      <Link href={product.url} onClick={e => e.stopPropagation()}>
        <h4 className="text-xs text-gray-700 line-clamp-2 hover:text-teal-600 transition-colors min-h-[2.5rem]">
          {product.name}
        </h4>
      </Link>

      <div className="mt-1">
        <span className="text-sm font-bold text-gray-900">
          {product.price.toLocaleString('uk-UA')} ₴
        </span>
        {product.comparePrice && product.comparePrice > product.price && (
          <span className="text-xs text-gray-400 line-through ml-1">
            {product.comparePrice.toLocaleString('uk-UA')} ₴
          </span>
        )}
      </div>

      {!product.inStock && (
        <p className="text-xs text-red-500 mt-1">Немає в наявності</p>
      )}
    </div>
  );
}

/**
 * Hook to fetch frequently bought together products
 */
export function useFrequentlyBoughtTogether(productId: string) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch(`/api/products/${productId}/frequently-bought`);
        if (response.ok) {
          const data = await response.json();
          setProducts(data.products || []);
        }
      } catch (error) {
        logger.error('Failed to fetch frequently bought products:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [productId]);

  return { products, isLoading };
}
