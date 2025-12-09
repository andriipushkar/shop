'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/lib/cart-context'
import {
  ShoppingCartIcon,
  HeartIcon,
  ShareIcon,
  TruckIcon,
  ShieldCheckIcon,
  ArrowLeftIcon,
  MinusIcon,
  PlusIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'

// Mock product data - in real app this would come from API
const mockProduct = {
  id: '1',
  name: 'Смартфон Apple iPhone 15 Pro Max 256GB',
  slug: 'iphone-15-pro-max-256gb',
  description: `
    iPhone 15 Pro Max — це найпотужніший iPhone з-поміж усіх. Він оснащений чипом A17 Pro,
    який забезпечує неймовірну продуктивність для ігор та додатків. Титановий корпус робить
    його одночасно легким та міцним.

    Характеристики:
    • Дисплей 6.7" Super Retina XDR
    • Чип A17 Pro
    • 256GB пам'яті
    • Камера 48 МП + 12 МП + 12 МП
    • USB-C
    • Час роботи до 29 годин відео
  `,
  price: 54999,
  compare_price: 59999,
  sku: 'IPHONE15PM256',
  stock: 15,
  category: {
    id: 'smartphones',
    name: 'Смартфони',
  },
  brand: 'Apple',
  images: [
    '/products/iphone-1.jpg',
    '/products/iphone-2.jpg',
    '/products/iphone-3.jpg',
    '/products/iphone-4.jpg',
  ],
  attributes: {
    'Колір': 'Титановий чорний',
    'Пам\'ять': '256 GB',
    'Діагональ екрану': '6.7"',
    'Операційна система': 'iOS 17',
    'Бездротова зарядка': 'Так',
    'Захист від води': 'IP68',
  },
  rating: 4.8,
  reviews_count: 234,
}

export default function ProductPage() {
  const params = useParams()
  const router = useRouter()
  const { addToCart } = useCart()
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isAdded, setIsAdded] = useState(false)

  // In real app, fetch product by params.id
  const product = mockProduct

  const handleAddToCart = () => {
    const productForCart = {
      id: product.id,
      name: product.name,
      price: product.price,
      sku: product.sku,
      stock: product.stock,
      image_url: product.images[0],
    }
    for (let i = 0; i < quantity; i++) {
      addToCart(productForCart)
    }
    setIsAdded(true)
    setTimeout(() => setIsAdded(false), 2000)
  }

  const discount = product.compare_price
    ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100)
    : 0

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-primary-600">Головна</Link>
          <span>/</span>
          <Link href={`/?category_id=${product.category.id}`} className="hover:text-primary-600">
            {product.category.name}
          </Link>
          <span>/</span>
          <span className="text-gray-900">{product.name}</span>
        </nav>

        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeftIcon className="w-5 h-5 mr-2" />
          Назад
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="aspect-square bg-white rounded-2xl overflow-hidden shadow-sm">
              <div className="relative w-full h-full">
                {product.images[selectedImage] ? (
                  <Image
                    src={product.images[selectedImage]}
                    alt={product.name}
                    fill
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <span className="text-gray-400">Немає зображення</span>
                  </div>
                )}
                {discount > 0 && (
                  <span className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    -{discount}%
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnails */}
            <div className="flex space-x-3 overflow-x-auto pb-2">
              {product.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                    selectedImage === index
                      ? 'border-primary-500 ring-2 ring-primary-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Image
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <p className="text-sm text-primary-600 font-medium mb-2">{product.brand}</p>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-5 h-5 ${
                        i < Math.floor(product.rating)
                          ? 'text-yellow-400'
                          : 'text-gray-200'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="ml-2 text-sm text-gray-600">
                    {product.rating} ({product.reviews_count} відгуків)
                  </span>
                </div>
                <span className="text-sm text-gray-400">SKU: {product.sku}</span>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-baseline space-x-3">
              <span className="text-4xl font-bold text-gray-900">
                {product.price.toLocaleString()} ₴
              </span>
              {product.compare_price && (
                <span className="text-xl text-gray-400 line-through">
                  {product.compare_price.toLocaleString()} ₴
                </span>
              )}
            </div>

            {/* Stock Status */}
            <div className="flex items-center space-x-2">
              {product.stock > 0 ? (
                <>
                  <CheckIcon className="w-5 h-5 text-green-500" />
                  <span className="text-green-600 font-medium">
                    В наявності ({product.stock} шт.)
                  </span>
                </>
              ) : (
                <span className="text-red-500 font-medium">Немає в наявності</span>
              )}
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center space-x-4">
              <span className="text-gray-700 font-medium">Кількість:</span>
              <div className="flex items-center border border-gray-300 rounded-lg">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-2 hover:bg-gray-100 transition-colors"
                  disabled={quantity <= 1}
                >
                  <MinusIcon className="w-5 h-5" />
                </button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                  className="p-2 hover:bg-gray-100 transition-colors"
                  disabled={quantity >= product.stock}
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-4">
              <button
                onClick={handleAddToCart}
                disabled={product.stock === 0}
                className={`flex-1 flex items-center justify-center px-6 py-4 rounded-xl font-semibold text-lg transition-all ${
                  isAdded
                    ? 'bg-green-500 text-white'
                    : 'bg-primary-600 hover:bg-primary-700 text-white'
                } disabled:bg-gray-300 disabled:cursor-not-allowed`}
              >
                {isAdded ? (
                  <>
                    <CheckIcon className="w-6 h-6 mr-2" />
                    Додано!
                  </>
                ) : (
                  <>
                    <ShoppingCartIcon className="w-6 h-6 mr-2" />
                    Додати в кошик
                  </>
                )}
              </button>
              <button
                onClick={() => setIsFavorite(!isFavorite)}
                className="p-4 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                {isFavorite ? (
                  <HeartSolidIcon className="w-6 h-6 text-red-500" />
                ) : (
                  <HeartIcon className="w-6 h-6 text-gray-600" />
                )}
              </button>
              <button className="p-4 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
                <ShareIcon className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Delivery Info */}
            <div className="grid grid-cols-2 gap-4 py-6 border-t border-b border-gray-200">
              <div className="flex items-start space-x-3">
                <TruckIcon className="w-6 h-6 text-primary-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">Доставка</p>
                  <p className="text-sm text-gray-500">Нова Пошта, Укрпошта</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <ShieldCheckIcon className="w-6 h-6 text-primary-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">Гарантія</p>
                  <p className="text-sm text-gray-500">12 місяців</p>
                </div>
              </div>
            </div>

            {/* Attributes */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Характеристики</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {Object.entries(product.attributes).map(([key, value]) => (
                  <div key={key} className="flex justify-between py-2 border-b border-gray-100">
                    <dt className="text-gray-500">{key}</dt>
                    <dd className="text-gray-900 font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="mt-12 bg-white rounded-2xl shadow-sm p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Опис товару</h2>
          <div className="prose max-w-none text-gray-600 whitespace-pre-line">
            {product.description}
          </div>
        </div>
      </div>
    </main>
  )
}
