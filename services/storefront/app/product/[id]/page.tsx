'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/lib/cart-context'
import { useWishlist } from '@/lib/wishlist-context'
import { useComparison } from '@/lib/comparison-context'
import { useRecentlyViewed } from '@/lib/recently-viewed-context'
import ProductReviews from '@/components/ProductReviews'
import RecentlyViewed from '@/components/RecentlyViewed'
import ProductJsonLd, { ExtendedProductJsonLd, PinterestMeta } from '@/components/ProductJsonLd'
import Breadcrumb from '@/components/Breadcrumb'
import RelatedProducts, { CrossSellProducts } from '@/components/RelatedProducts'
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
  ChevronDownIcon,
  ChevronUpIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'

// Types for EAV-based attributes
type AttributeType = 'text' | 'number' | 'select' | 'multiselect' | 'bool' | 'color' | 'range'

interface AttributeOption {
  id: string
  value: string
  label: { uk: string; en: string }
  color_hex?: string
  sort_order: number
}

interface ProductAttribute {
  id: string
  code: string
  name: { uk: string; en: string }
  type: AttributeType
  unit?: string
  value: string | number | boolean | string[]
  display_value: string
  option?: AttributeOption
  options?: AttributeOption[]
  group_id?: string
  group_name?: { uk: string; en: string }
  is_comparable: boolean
}

interface AttributeGroup {
  id: string
  name: { uk: string; en: string }
  sort_order: number
  attributes: ProductAttribute[]
}

interface ProductVariant {
  id: string
  sku: string
  price: number
  compare_price?: number
  stock: number
  attributes: { code: string; value: string; label: string }[]
  image_url?: string
}

// Mock product data with EAV attributes
const mockProduct = {
  id: '1',
  name: 'Смартфон Apple iPhone 15 Pro Max 256GB',
  slug: 'iphone-15-pro-max-256gb',
  description: `
    iPhone 15 Pro Max — це найпотужніший iPhone з-поміж усіх. Він оснащений чипом A17 Pro,
    який забезпечує неймовірну продуктивність для ігор та додатків. Титановий корпус робить
    його одночасно легким та міцним.

    Система камер Pro — це справжній проривний у мобільній фотографії та відеозйомці.
    48 Мп головна камера з сенсором quad-pixel забезпечує неймовірну деталізацію.
  `,
  price: 54999,
  compare_price: 59999,
  sku: 'IPHONE15PM256-BLK',
  stock: 15,
  category: {
    id: 'smartphones',
    name: 'Смартфони',
    path: ['Електроніка', 'Телефони та гаджети', 'Смартфони'],
  },
  brand: 'Apple',
  images: [
    '/products/iphone-1.jpg',
    '/products/iphone-2.jpg',
    '/products/iphone-3.jpg',
    '/products/iphone-4.jpg',
  ],
  // New EAV-based attribute groups
  attributeGroups: [
    {
      id: 'general',
      name: { uk: 'Загальні характеристики', en: 'General' },
      sort_order: 1,
      attributes: [
        {
          id: 'attr-1',
          code: 'brand',
          name: { uk: 'Бренд', en: 'Brand' },
          type: 'select' as AttributeType,
          value: 'apple',
          display_value: 'Apple',
          option: { id: 'opt-1', value: 'apple', label: { uk: 'Apple', en: 'Apple' }, sort_order: 1 },
          is_comparable: true,
        },
        {
          id: 'attr-2',
          code: 'country',
          name: { uk: 'Країна виробника', en: 'Country of Origin' },
          type: 'select' as AttributeType,
          value: 'china',
          display_value: 'Китай',
          is_comparable: false,
        },
        {
          id: 'attr-3',
          code: 'warranty',
          name: { uk: 'Гарантія', en: 'Warranty' },
          type: 'number' as AttributeType,
          unit: 'міс',
          value: 12,
          display_value: '12 міс',
          is_comparable: true,
        },
      ],
    },
    {
      id: 'display',
      name: { uk: 'Дисплей', en: 'Display' },
      sort_order: 2,
      attributes: [
        {
          id: 'attr-4',
          code: 'screen_diag',
          name: { uk: 'Діагональ екрану', en: 'Screen Diagonal' },
          type: 'number' as AttributeType,
          unit: '"',
          value: 6.7,
          display_value: '6.7"',
          is_comparable: true,
        },
        {
          id: 'attr-5',
          code: 'screen_res',
          name: { uk: 'Роздільна здатність', en: 'Screen Resolution' },
          type: 'select' as AttributeType,
          value: '2796x1290',
          display_value: '2796x1290 (Super Retina XDR)',
          is_comparable: true,
        },
        {
          id: 'attr-6',
          code: 'screen_refresh',
          name: { uk: 'Частота оновлення', en: 'Refresh Rate' },
          type: 'number' as AttributeType,
          unit: 'Гц',
          value: 120,
          display_value: '120 Гц (ProMotion)',
          is_comparable: true,
        },
        {
          id: 'attr-7',
          code: 'screen_type',
          name: { uk: 'Тип матриці', en: 'Screen Type' },
          type: 'select' as AttributeType,
          value: 'oled',
          display_value: 'OLED',
          is_comparable: true,
        },
      ],
    },
    {
      id: 'performance',
      name: { uk: 'Продуктивність', en: 'Performance' },
      sort_order: 3,
      attributes: [
        {
          id: 'attr-8',
          code: 'cpu',
          name: { uk: 'Процесор', en: 'CPU' },
          type: 'text' as AttributeType,
          value: 'A17 Pro',
          display_value: 'Apple A17 Pro (6 ядер)',
          is_comparable: true,
        },
        {
          id: 'attr-9',
          code: 'ram',
          name: { uk: "Оперативна пам'ять", en: 'RAM' },
          type: 'select' as AttributeType,
          unit: 'GB',
          value: '8',
          display_value: '8 GB',
          is_comparable: true,
        },
        {
          id: 'attr-10',
          code: 'storage',
          name: { uk: "Вбудована пам'ять", en: 'Storage' },
          type: 'select' as AttributeType,
          unit: 'GB',
          value: '256',
          display_value: '256 GB',
          is_comparable: true,
        },
      ],
    },
    {
      id: 'camera',
      name: { uk: 'Камера', en: 'Camera' },
      sort_order: 4,
      attributes: [
        {
          id: 'attr-11',
          code: 'main_camera',
          name: { uk: 'Основна камера', en: 'Main Camera' },
          type: 'text' as AttributeType,
          value: '48 MP + 12 MP + 12 MP',
          display_value: '48 MP + 12 MP (ultrawide) + 12 MP (telephoto 5x)',
          is_comparable: true,
        },
        {
          id: 'attr-12',
          code: 'front_camera',
          name: { uk: 'Фронтальна камера', en: 'Front Camera' },
          type: 'text' as AttributeType,
          value: '12 MP',
          display_value: '12 MP TrueDepth',
          is_comparable: true,
        },
        {
          id: 'attr-13',
          code: 'video_res',
          name: { uk: 'Відеозйомка', en: 'Video Recording' },
          type: 'select' as AttributeType,
          value: '4k60',
          display_value: '4K @ 60fps, ProRes',
          is_comparable: true,
        },
      ],
    },
    {
      id: 'battery',
      name: { uk: 'Акумулятор', en: 'Battery' },
      sort_order: 5,
      attributes: [
        {
          id: 'attr-14',
          code: 'battery_cap',
          name: { uk: 'Ємність батареї', en: 'Battery Capacity' },
          type: 'number' as AttributeType,
          unit: 'мАг',
          value: 4422,
          display_value: '4422 мАг',
          is_comparable: true,
        },
        {
          id: 'attr-15',
          code: 'fast_charge',
          name: { uk: 'Швидка зарядка', en: 'Fast Charging' },
          type: 'bool' as AttributeType,
          value: true,
          display_value: 'Так (USB-C PD до 27W)',
          is_comparable: true,
        },
        {
          id: 'attr-16',
          code: 'wireless_charge',
          name: { uk: 'Бездротова зарядка', en: 'Wireless Charging' },
          type: 'bool' as AttributeType,
          value: true,
          display_value: 'Так (MagSafe 15W, Qi 7.5W)',
          is_comparable: true,
        },
      ],
    },
    {
      id: 'connectivity',
      name: { uk: "Зв'язок", en: 'Connectivity' },
      sort_order: 6,
      attributes: [
        {
          id: 'attr-17',
          code: 'sim_type',
          name: { uk: 'SIM-карта', en: 'SIM Card' },
          type: 'select' as AttributeType,
          value: 'nano_esim',
          display_value: 'Nano-SIM + eSIM',
          is_comparable: true,
        },
        {
          id: 'attr-18',
          code: '5g',
          name: { uk: 'Підтримка 5G', en: '5G Support' },
          type: 'bool' as AttributeType,
          value: true,
          display_value: 'Так',
          is_comparable: true,
        },
        {
          id: 'attr-19',
          code: 'nfc',
          name: { uk: 'NFC', en: 'NFC' },
          type: 'bool' as AttributeType,
          value: true,
          display_value: 'Так (Apple Pay)',
          is_comparable: true,
        },
      ],
    },
    {
      id: 'physical',
      name: { uk: 'Фізичні характеристики', en: 'Physical' },
      sort_order: 7,
      attributes: [
        {
          id: 'attr-20',
          code: 'color',
          name: { uk: 'Колір', en: 'Color' },
          type: 'color' as AttributeType,
          value: 'titan_black',
          display_value: 'Титановий чорний',
          option: { id: 'opt-color', value: 'titan_black', label: { uk: 'Титановий чорний', en: 'Black Titanium' }, color_hex: '#3C3C3C', sort_order: 1 },
          is_comparable: false,
        },
        {
          id: 'attr-21',
          code: 'weight',
          name: { uk: 'Вага', en: 'Weight' },
          type: 'number' as AttributeType,
          unit: 'г',
          value: 221,
          display_value: '221 г',
          is_comparable: true,
        },
        {
          id: 'attr-22',
          code: 'dimensions',
          name: { uk: 'Розміри', en: 'Dimensions' },
          type: 'text' as AttributeType,
          value: '159.9 x 76.7 x 8.25',
          display_value: '159.9 x 76.7 x 8.25 мм',
          is_comparable: true,
        },
        {
          id: 'attr-23',
          code: 'ip_rating',
          name: { uk: 'Захист від води', en: 'Water Resistance' },
          type: 'select' as AttributeType,
          value: 'ip68',
          display_value: 'IP68',
          is_comparable: true,
        },
        {
          id: 'attr-24',
          code: 'material',
          name: { uk: 'Матеріал корпусу', en: 'Body Material' },
          type: 'select' as AttributeType,
          value: 'titanium',
          display_value: 'Титан',
          is_comparable: true,
        },
      ],
    },
  ] as AttributeGroup[],
  // Product variants (for color/storage selection)
  variants: [
    { id: 'v1', sku: 'IPHONE15PM256-BLK', price: 54999, compare_price: 59999, stock: 15, attributes: [{ code: 'color', value: 'titan_black', label: 'Титановий чорний' }, { code: 'storage', value: '256', label: '256 GB' }] },
    { id: 'v2', sku: 'IPHONE15PM256-WHT', price: 54999, compare_price: 59999, stock: 8, attributes: [{ code: 'color', value: 'titan_white', label: 'Титановий білий' }, { code: 'storage', value: '256', label: '256 GB' }] },
    { id: 'v3', sku: 'IPHONE15PM256-BLU', price: 54999, compare_price: 59999, stock: 3, attributes: [{ code: 'color', value: 'titan_blue', label: 'Титановий синій' }, { code: 'storage', value: '256', label: '256 GB' }] },
    { id: 'v4', sku: 'IPHONE15PM512-BLK', price: 64999, compare_price: 69999, stock: 10, attributes: [{ code: 'color', value: 'titan_black', label: 'Титановий чорний' }, { code: 'storage', value: '512', label: '512 GB' }] },
    { id: 'v5', sku: 'IPHONE15PM1TB-BLK', price: 74999, compare_price: 79999, stock: 5, attributes: [{ code: 'color', value: 'titan_black', label: 'Титановий чорний' }, { code: 'storage', value: '1024', label: '1 TB' }] },
  ] as ProductVariant[],
  // Color options for variant selector
  colorOptions: [
    { value: 'titan_black', label: 'Титановий чорний', hex: '#3C3C3C' },
    { value: 'titan_white', label: 'Титановий білий', hex: '#F5F5F0' },
    { value: 'titan_blue', label: 'Титановий синій', hex: '#4A5568' },
    { value: 'titan_natural', label: 'Натуральний титан', hex: '#C4B8A5' },
  ],
  storageOptions: [
    { value: '256', label: '256 GB' },
    { value: '512', label: '512 GB' },
    { value: '1024', label: '1 TB' },
  ],
  rating: 4.8,
  reviews_count: 234,
}

export default function ProductPage() {
  const params = useParams()
  const router = useRouter()
  const { addToCart } = useCart()
  const { isInWishlist, toggleWishlist } = useWishlist()
  const { isInComparison, toggleComparison, canAdd } = useComparison()
  const { addToRecentlyViewed } = useRecentlyViewed()
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [isAdded, setIsAdded] = useState(false)
  const [selectedColor, setSelectedColor] = useState('titan_black')
  const [selectedStorage, setSelectedStorage] = useState('256')
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['general', 'display', 'performance'])
  const [specsTab, setSpecsTab] = useState<'all' | 'key'>('key')

  // In real app, fetch product by params.id
  const product = mockProduct

  const isFavorite = isInWishlist(product.id)
  const isCompared = isInComparison(product.id)

  // Add to recently viewed on mount
  useEffect(() => {
    addToRecentlyViewed({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0],
    })
  }, [product.id])

  // Find current variant based on selections
  const currentVariant = product.variants.find(v =>
    v.attributes.some(a => a.code === 'color' && a.value === selectedColor) &&
    v.attributes.some(a => a.code === 'storage' && a.value === selectedStorage)
  ) || product.variants[0]

  const currentPrice = currentVariant?.price || product.price
  const currentComparePrice = currentVariant?.compare_price || product.compare_price
  const currentStock = currentVariant?.stock || product.stock

  const handleAddToCart = () => {
    const productForCart = {
      id: product.id,
      name: product.name,
      price: currentPrice,
      sku: currentVariant?.sku || product.sku,
      stock: currentStock,
      image_url: product.images[0],
    }
    for (let i = 0; i < quantity; i++) {
      addToCart(productForCart)
    }
    setIsAdded(true)
    setTimeout(() => setIsAdded(false), 2000)
  }

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    )
  }

  // Get key specs (first 6 comparable attributes)
  const keySpecs = product.attributeGroups
    .flatMap(g => g.attributes)
    .filter(a => a.is_comparable)
    .slice(0, 6)

  const discount = currentComparePrice
    ? Math.round(((currentComparePrice - currentPrice) / currentComparePrice) * 100)
    : 0

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Structured Data - Extended Product JSON-LD with warranty, shipping, returns */}
      <ExtendedProductJsonLd
        product={{
          id: product.id,
          name: product.name,
          description: product.description,
          price: currentPrice,
          compare_price: currentComparePrice,
          sku: currentVariant?.sku || product.sku,
          stock: currentVariant?.stock ?? product.stock,
          brand: product.brand,
          images: product.images,
          category: product.category,
          rating: product.rating,
          reviewCount: product.reviews_count,
        }}
        warranty={{
          durationMonths: 12,
          type: 'manufacturer',
        }}
        shipping={{
          freeShippingThreshold: 2000,
          deliveryDays: { min: 1, max: 3 },
        }}
        returnPolicy={{
          days: 14,
          type: 'full',
        }}
      />
      {/* Pinterest Rich Pins metadata */}
      <PinterestMeta
        product={{
          name: product.name,
          price: currentPrice,
          availability: currentStock > 0 ? 'in stock' : 'out of stock',
          brand: product.brand,
        }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb with JSON-LD */}
        <Breadcrumb
          items={[
            { name: product.category.name, url: `/category/${product.category.id}` },
            { name: product.name, url: `/product/${product.id}` },
          ]}
          className="mb-6"
        />

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
                {currentPrice.toLocaleString()} ₴
              </span>
              {currentComparePrice && (
                <span className="text-xl text-gray-400 line-through">
                  {currentComparePrice.toLocaleString()} ₴
                </span>
              )}
            </div>

            {/* Stock Status */}
            <div className="flex items-center space-x-2">
              {currentStock > 0 ? (
                <>
                  <CheckIcon className="w-5 h-5 text-green-500" />
                  <span className="text-green-600 font-medium">
                    В наявності ({currentStock} шт.)
                  </span>
                </>
              ) : (
                <span className="text-red-500 font-medium">Немає в наявності</span>
              )}
            </div>

            {/* Variant Selectors */}
            <div className="space-y-4 py-4 border-t border-b border-gray-200">
              {/* Color Selector */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Колір: <span className="text-gray-900">{product.colorOptions.find(c => c.value === selectedColor)?.label}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.colorOptions.map((color) => {
                    const hasVariant = product.variants.some(v =>
                      v.attributes.some(a => a.code === 'color' && a.value === color.value) &&
                      v.attributes.some(a => a.code === 'storage' && a.value === selectedStorage)
                    )
                    return (
                      <button
                        key={color.value}
                        onClick={() => hasVariant && setSelectedColor(color.value)}
                        disabled={!hasVariant}
                        className={`relative w-10 h-10 rounded-full border-2 transition-all ${
                          selectedColor === color.value
                            ? 'border-primary-500 ring-2 ring-primary-200'
                            : hasVariant
                            ? 'border-gray-300 hover:border-gray-400'
                            : 'border-gray-200 opacity-40 cursor-not-allowed'
                        }`}
                        title={color.label}
                      >
                        <span
                          className="absolute inset-1 rounded-full"
                          style={{ backgroundColor: color.hex }}
                        />
                        {selectedColor === color.value && (
                          <CheckIcon className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow-md" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Storage Selector */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Пам&apos;ять:
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.storageOptions.map((storage) => {
                    const variant = product.variants.find(v =>
                      v.attributes.some(a => a.code === 'color' && a.value === selectedColor) &&
                      v.attributes.some(a => a.code === 'storage' && a.value === storage.value)
                    )
                    const hasVariant = !!variant
                    return (
                      <button
                        key={storage.value}
                        onClick={() => hasVariant && setSelectedStorage(storage.value)}
                        disabled={!hasVariant}
                        className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                          selectedStorage === storage.value
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : hasVariant
                            ? 'border-gray-300 hover:border-gray-400 text-gray-700'
                            : 'border-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {storage.label}
                        {variant && variant.price !== product.variants[0].price && (
                          <span className="ml-1 text-xs text-gray-500">
                            (+{(variant.price - product.variants[0].price).toLocaleString()} ₴)
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
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
                  onClick={() => setQuantity((q) => Math.min(currentStock, q + 1))}
                  className="p-2 hover:bg-gray-100 transition-colors"
                  disabled={quantity >= currentStock}
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-4">
              <button
                onClick={handleAddToCart}
                disabled={currentStock === 0}
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
                onClick={() => toggleWishlist({
                  productId: product.id,
                  name: product.name,
                  price: currentPrice,
                  image: product.images[0],
                })}
                className={`p-4 border rounded-xl transition-colors ${
                  isFavorite
                    ? 'border-red-300 bg-red-50 hover:bg-red-100'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title={isFavorite ? 'Видалити з бажань' : 'Додати до бажань'}
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

            {/* Quick Specs */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Основні характеристики</h3>
                <button
                  onClick={() => document.getElementById('full-specs')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Усі характеристики →
                </button>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                {keySpecs.map((attr) => (
                  <div key={attr.id} className="flex justify-between py-1.5 text-sm">
                    <dt className="text-gray-500">{attr.name.uk}</dt>
                    <dd className="text-gray-900 font-medium text-right">{attr.display_value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Compare Button */}
            <button
              onClick={() => toggleComparison({
                productId: product.id,
                name: product.name,
                price: currentPrice,
                image: product.images[0],
              })}
              disabled={!isCompared && !canAdd}
              className={`w-full flex items-center justify-center gap-2 py-3 border rounded-xl transition-colors ${
                isCompared
                  ? 'border-teal-500 bg-teal-50 text-teal-700 hover:bg-teal-100'
                  : !canAdd
                    ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ScaleIcon className="w-5 h-5" />
              {isCompared ? 'У порівнянні' : canAdd ? 'Додати до порівняння' : 'Максимум 4 товари'}
            </button>
          </div>
        </div>

        {/* Full Specifications */}
        <div id="full-specs" className="mt-12 bg-white rounded-2xl shadow-sm p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Характеристики</h2>
            <div className="flex rounded-lg border border-gray-200 p-1">
              <button
                onClick={() => setSpecsTab('key')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  specsTab === 'key'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Основні
              </button>
              <button
                onClick={() => setSpecsTab('all')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  specsTab === 'all'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Усі
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {product.attributeGroups
              .filter(group => specsTab === 'all' || group.attributes.some(a => a.is_comparable))
              .map((group) => {
                const isExpanded = expandedGroups.includes(group.id)
                const visibleAttrs = specsTab === 'key'
                  ? group.attributes.filter(a => a.is_comparable)
                  : group.attributes

                if (visibleAttrs.length === 0) return null

                return (
                  <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <h3 className="font-semibold text-gray-900">{group.name.uk}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">{visibleAttrs.length} параметрів</span>
                        {isExpanded ? (
                          <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-6 py-4">
                        <dl className="divide-y divide-gray-100">
                          {visibleAttrs.map((attr) => (
                            <div key={attr.id} className="flex justify-between py-3">
                              <dt className="text-gray-600 flex items-center gap-2">
                                {attr.name.uk}
                                {attr.unit && <span className="text-xs text-gray-400">({attr.unit})</span>}
                              </dt>
                              <dd className="text-gray-900 font-medium flex items-center gap-2">
                                {attr.type === 'color' && attr.option?.color_hex && (
                                  <span
                                    className="w-4 h-4 rounded-full border border-gray-200"
                                    style={{ backgroundColor: attr.option.color_hex }}
                                  />
                                )}
                                {attr.type === 'bool' ? (
                                  attr.value ? (
                                    <span className="flex items-center gap-1 text-green-600">
                                      <CheckIcon className="w-4 h-4" />
                                      {attr.display_value}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">Ні</span>
                                  )
                                ) : (
                                  attr.display_value
                                )}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        </div>

        {/* Description */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Опис товару</h2>
          <div className="prose max-w-none text-gray-600 whitespace-pre-line">
            {product.description}
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Відгуки покупців</h2>
          <ProductReviews productId={product.id} />
        </div>

        {/* Related Products Section - improves internal linking for SEO */}
        <div className="mt-12">
          <RelatedProducts
            currentProductId={product.id}
            categoryId={product.category.id}
            brand={product.brand}
            maxProducts={4}
            title="Схожі товари"
            viewAllLink={`/category/${product.category.id}`}
          />
        </div>

        {/* Cross-sell Section - shows complementary products */}
        <div className="mt-8">
          <CrossSellProducts
            currentProductId={product.id}
            categoryId={product.category.id}
            maxProducts={4}
          />
        </div>

        {/* Recently Viewed Section */}
        <div className="mt-12">
          <RecentlyViewed excludeProductId={product.id} />
        </div>
      </div>
    </main>
  )
}
