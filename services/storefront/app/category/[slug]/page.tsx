'use client'

import { useState, useMemo } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ProductCard from '@/components/ProductCard'
import {
  AdjustmentsHorizontalIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'
import {
  products as allProducts,
  categories as allCategories,
  getRootCategories,
  getSubcategories,
  getCategoryById,
  Product,
} from '@/lib/mock-data'

type SortOption = 'popular' | 'price_asc' | 'price_desc' | 'rating' | 'new'
type AttributeType = 'select' | 'multiselect' | 'bool' | 'color' | 'range' | 'number'

interface FilterOption {
  value: string
  label: string
  count: number
  color_hex?: string
}

interface CategoryFilter {
  code: string
  name: string
  type: AttributeType
  unit?: string
  options?: FilterOption[]
  min?: number
  max?: number
  is_expanded?: boolean
}

// Mock category filters - in real app would come from API based on category
const getCategoryFilters = (categorySlug: string): CategoryFilter[] => {
  // Electronics filters
  if (['smartphones', 'electronics', 'laptops', 'tablets'].includes(categorySlug)) {
    return [
      {
        code: 'screen_diag',
        name: 'Діагональ екрану',
        type: 'range',
        unit: '"',
        min: 4,
        max: 17,
        is_expanded: true,
      },
      {
        code: 'ram',
        name: "Оперативна пам'ять",
        type: 'multiselect',
        options: [
          { value: '4', label: '4 GB', count: 45 },
          { value: '6', label: '6 GB', count: 67 },
          { value: '8', label: '8 GB', count: 89 },
          { value: '12', label: '12 GB', count: 34 },
          { value: '16', label: '16 GB', count: 23 },
        ],
        is_expanded: true,
      },
      {
        code: 'storage',
        name: "Вбудована пам'ять",
        type: 'multiselect',
        options: [
          { value: '64', label: '64 GB', count: 23 },
          { value: '128', label: '128 GB', count: 56 },
          { value: '256', label: '256 GB', count: 78 },
          { value: '512', label: '512 GB', count: 45 },
          { value: '1024', label: '1 TB', count: 12 },
        ],
        is_expanded: true,
      },
      {
        code: 'color',
        name: 'Колір',
        type: 'color',
        options: [
          { value: 'black', label: 'Чорний', count: 156, color_hex: '#1a1a1a' },
          { value: 'white', label: 'Білий', count: 89, color_hex: '#f5f5f5' },
          { value: 'blue', label: 'Синій', count: 45, color_hex: '#3b82f6' },
          { value: 'gold', label: 'Золотий', count: 34, color_hex: '#d4af37' },
          { value: 'silver', label: 'Сріблястий', count: 67, color_hex: '#c0c0c0' },
          { value: 'red', label: 'Червоний', count: 23, color_hex: '#ef4444' },
          { value: 'green', label: 'Зелений', count: 18, color_hex: '#22c55e' },
          { value: 'purple', label: 'Фіолетовий', count: 12, color_hex: '#a855f7' },
        ],
        is_expanded: true,
      },
      {
        code: '5g',
        name: 'Підтримка 5G',
        type: 'bool',
        is_expanded: false,
      },
      {
        code: 'nfc',
        name: 'NFC',
        type: 'bool',
        is_expanded: false,
      },
      {
        code: 'wireless_charge',
        name: 'Бездротова зарядка',
        type: 'bool',
        is_expanded: false,
      },
    ]
  }

  // Clothing filters
  if (['clothing', 'fashion', 'shoes'].includes(categorySlug)) {
    return [
      {
        code: 'size',
        name: 'Розмір',
        type: 'multiselect',
        options: [
          { value: 'xs', label: 'XS', count: 45 },
          { value: 's', label: 'S', count: 89 },
          { value: 'm', label: 'M', count: 123 },
          { value: 'l', label: 'L', count: 98 },
          { value: 'xl', label: 'XL', count: 67 },
          { value: 'xxl', label: 'XXL', count: 34 },
        ],
        is_expanded: true,
      },
      {
        code: 'color',
        name: 'Колір',
        type: 'color',
        options: [
          { value: 'black', label: 'Чорний', count: 234, color_hex: '#1a1a1a' },
          { value: 'white', label: 'Білий', count: 189, color_hex: '#f5f5f5' },
          { value: 'blue', label: 'Синій', count: 145, color_hex: '#3b82f6' },
          { value: 'red', label: 'Червоний', count: 87, color_hex: '#ef4444' },
          { value: 'green', label: 'Зелений', count: 56, color_hex: '#22c55e' },
          { value: 'beige', label: 'Бежевий', count: 78, color_hex: '#d4b896' },
        ],
        is_expanded: true,
      },
      {
        code: 'material',
        name: 'Матеріал',
        type: 'multiselect',
        options: [
          { value: 'cotton', label: 'Бавовна', count: 156 },
          { value: 'polyester', label: 'Поліестер', count: 123 },
          { value: 'wool', label: 'Вовна', count: 45 },
          { value: 'silk', label: 'Шовк', count: 23 },
          { value: 'leather', label: 'Шкіра', count: 67 },
        ],
        is_expanded: false,
      },
      {
        code: 'gender',
        name: 'Стать',
        type: 'select',
        options: [
          { value: 'male', label: 'Чоловіча', count: 234 },
          { value: 'female', label: 'Жіноча', count: 289 },
          { value: 'unisex', label: 'Унісекс', count: 78 },
        ],
        is_expanded: true,
      },
    ]
  }

  // Default filters for other categories
  return [
    {
      code: 'color',
      name: 'Колір',
      type: 'color',
      options: [
        { value: 'black', label: 'Чорний', count: 156, color_hex: '#1a1a1a' },
        { value: 'white', label: 'Білий', count: 89, color_hex: '#f5f5f5' },
        { value: 'grey', label: 'Сірий', count: 67, color_hex: '#6b7280' },
        { value: 'brown', label: 'Коричневий', count: 45, color_hex: '#92400e' },
      ],
      is_expanded: true,
    },
    {
      code: 'in_stock',
      name: 'Тільки в наявності',
      type: 'bool',
      is_expanded: false,
    },
    {
      code: 'has_discount',
      name: 'Зі знижкою',
      type: 'bool',
      is_expanded: false,
    },
  ]
}

const PRODUCTS_PER_PAGE = 24

// Filter state type
type FilterState = {
  [key: string]: string[] | [number, number] | boolean
}

export default function CategoryPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const slug = params.slug as string

  const [sortBy, setSortBy] = useState<SortOption>('popular')
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 200000])
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [attributeFilters, setAttributeFilters] = useState<FilterState>({})
  const [expandedFilters, setExpandedFilters] = useState<string[]>(['screen_diag', 'ram', 'storage', 'color', 'size'])

  // Get dynamic filters for this category
  const categoryFilters = useMemo(() => getCategoryFilters(slug), [slug])

  const currentPage = Number(searchParams.get('page')) || 1

  // Find category by slug
  const category = allCategories.find(c => c.slug === slug)
  const isAllProducts = slug === 'all'

  // Get all products for this category and subcategories
  const categoryProducts = useMemo(() => {
    if (isAllProducts) {
      return allProducts
    }

    if (!category) return []

    // Get this category and all its subcategories
    const categoryIds = [category.id]
    const subcats = getSubcategories(category.id)
    subcats.forEach(sub => categoryIds.push(sub.id))

    return allProducts.filter(p => categoryIds.includes(p.category_id))
  }, [category, isAllProducts])

  // Get unique brands from filtered products
  const availableBrands = useMemo(() => {
    const brands = [...new Set(categoryProducts.map(p => p.brand))]
    return brands.sort()
  }, [categoryProducts])

  // Apply filters and sorting
  const filteredProducts = useMemo(() => {
    let products = [...categoryProducts]

    // Filter by price
    products = products.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1])

    // Filter by brands
    if (selectedBrands.length > 0) {
      products = products.filter(p => selectedBrands.includes(p.brand))
    }

    // Sort
    switch (sortBy) {
      case 'price_asc':
        products.sort((a, b) => a.price - b.price)
        break
      case 'price_desc':
        products.sort((a, b) => b.price - a.price)
        break
      case 'rating':
        products.sort((a, b) => b.rating - a.rating)
        break
      case 'new':
        products.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0))
        break
      default:
        // popular - sort by bestseller first, then by review count
        products.sort((a, b) => {
          if (a.isBestseller && !b.isBestseller) return -1
          if (!a.isBestseller && b.isBestseller) return 1
          return b.reviewCount - a.reviewCount
        })
    }

    return products
  }, [categoryProducts, sortBy, priceRange, selectedBrands])

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE
  )

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    router.push(`/category/${slug}?${params.toString()}`)
  }

  const clearFilters = () => {
    setPriceRange([0, 200000])
    setSelectedBrands([])
    setAttributeFilters({})
  }

  const toggleBrand = (brand: string) => {
    setSelectedBrands(prev =>
      prev.includes(brand)
        ? prev.filter(b => b !== brand)
        : [...prev, brand]
    )
  }

  // Toggle multiselect filter value
  const toggleFilterValue = (filterCode: string, value: string) => {
    setAttributeFilters(prev => {
      const current = (prev[filterCode] as string[]) || []
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
      return { ...prev, [filterCode]: updated.length ? updated : [] }
    })
  }

  // Set single select filter value
  const setFilterValue = (filterCode: string, value: string) => {
    setAttributeFilters(prev => ({
      ...prev,
      [filterCode]: value ? [value] : []
    }))
  }

  // Toggle boolean filter
  const toggleBoolFilter = (filterCode: string) => {
    setAttributeFilters(prev => ({
      ...prev,
      [filterCode]: !prev[filterCode]
    }))
  }

  // Set range filter
  const setRangeFilter = (filterCode: string, range: [number, number]) => {
    setAttributeFilters(prev => ({
      ...prev,
      [filterCode]: range
    }))
  }

  // Toggle filter section expansion
  const toggleFilterExpansion = (filterCode: string) => {
    setExpandedFilters(prev =>
      prev.includes(filterCode)
        ? prev.filter(f => f !== filterCode)
        : [...prev, filterCode]
    )
  }

  // Check if any filters are active
  const hasActiveFilters = priceRange[0] > 0 || priceRange[1] < 200000 || selectedBrands.length > 0 ||
    Object.values(attributeFilters).some(v => Array.isArray(v) ? v.length > 0 : !!v)

  // Count active attribute filters
  const activeFilterCount = Object.entries(attributeFilters).reduce((count, [, value]) => {
    if (Array.isArray(value)) return count + value.length
    if (typeof value === 'boolean' && value) return count + 1
    return count
  }, 0) + selectedBrands.length + (priceRange[0] > 0 || priceRange[1] < 200000 ? 1 : 0)

  // Get subcategories for display
  const subcategories = category ? getSubcategories(category.id) : []
  const rootCategories = getRootCategories()

  const categoryName = isAllProducts ? 'Всі товари' : category?.name || 'Категорію не знайдено'
  const categoryDescription = isAllProducts
    ? `${allProducts.length} товарів у каталозі`
    : category
      ? `${categoryProducts.length} товарів`
      : ''

  if (!category && !isAllProducts) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Категорію не знайдено</h1>
          <p className="text-gray-600 mb-4">Спробуйте повернутися на головну сторінку</p>
          <Link href="/" className="text-teal-600 hover:text-teal-700 font-medium">
            На головну
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center space-x-2 text-sm">
            <Link href="/" className="text-gray-500 hover:text-gray-700">Головна</Link>
            <span className="text-gray-400">/</span>
            {category?.parentId && (
              <>
                <Link
                  href={`/category/${getCategoryById(category.parentId)?.slug}`}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {getCategoryById(category.parentId)?.name}
                </Link>
                <span className="text-gray-400">/</span>
              </>
            )}
            <span className="text-gray-900 font-medium">{categoryName}</span>
          </nav>
        </div>
      </div>

      {/* Category Header */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold mb-2">{categoryName}</h1>
          <p className="text-teal-100">{categoryDescription}</p>

          {/* Subcategories or Root Categories */}
          <div className="flex flex-wrap gap-2 mt-4">
            {isAllProducts ? (
              rootCategories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-full text-sm transition-colors"
                >
                  {cat.icon} {cat.name}
                </Link>
              ))
            ) : subcategories.length > 0 ? (
              subcategories.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/category/${sub.slug}`}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-full text-sm transition-colors"
                >
                  {sub.name}
                </Link>
              ))
            ) : null}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters Sidebar - Desktop */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">
                  Фільтри
                  {activeFilterCount > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </h3>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-teal-600 hover:text-teal-700"
                  >
                    Скинути
                  </button>
                )}
              </div>

              {/* Price Range */}
              <div className="mb-6 pb-6 border-b border-gray-100">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Ціна, ₴</h4>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Від"
                  />
                  <span className="text-gray-400">—</span>
                  <input
                    type="number"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="До"
                  />
                </div>
              </div>

              {/* Brands Filter */}
              {availableBrands.length > 0 && (
                <div className="mb-6 pb-6 border-b border-gray-100">
                  <button
                    onClick={() => toggleFilterExpansion('brand')}
                    className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-3"
                  >
                    <span>Бренд</span>
                    {expandedFilters.includes('brand') ? (
                      <ChevronUpIcon className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  {expandedFilters.includes('brand') && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {availableBrands.slice(0, 15).map((brand) => (
                        <label key={brand} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={selectedBrands.includes(brand)}
                            onChange={() => toggleBrand(brand)}
                            className="rounded text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900">{brand}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Dynamic Attribute Filters */}
              {categoryFilters.map((filter) => (
                <div key={filter.code} className="mb-6 pb-6 border-b border-gray-100 last:border-b-0 last:pb-0">
                  <button
                    onClick={() => toggleFilterExpansion(filter.code)}
                    className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-3"
                  >
                    <span>
                      {filter.name}
                      {filter.unit && <span className="text-gray-400 ml-1">({filter.unit})</span>}
                    </span>
                    {expandedFilters.includes(filter.code) ? (
                      <ChevronUpIcon className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {expandedFilters.includes(filter.code) && (
                    <>
                      {/* Boolean Filter */}
                      {filter.type === 'bool' && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!attributeFilters[filter.code]}
                            onChange={() => toggleBoolFilter(filter.code)}
                            className="rounded text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-sm text-gray-700">Так</span>
                        </label>
                      )}

                      {/* Range Filter */}
                      {filter.type === 'range' && filter.min !== undefined && filter.max !== undefined && (
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              value={(attributeFilters[filter.code] as [number, number])?.[0] ?? filter.min}
                              onChange={(e) => setRangeFilter(filter.code, [
                                Number(e.target.value),
                                (attributeFilters[filter.code] as [number, number])?.[1] ?? filter.max!
                              ])}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              placeholder={`Від ${filter.min}`}
                              min={filter.min}
                              max={filter.max}
                            />
                            <span className="text-gray-400">—</span>
                            <input
                              type="number"
                              value={(attributeFilters[filter.code] as [number, number])?.[1] ?? filter.max}
                              onChange={(e) => setRangeFilter(filter.code, [
                                (attributeFilters[filter.code] as [number, number])?.[0] ?? filter.min!,
                                Number(e.target.value)
                              ])}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              placeholder={`До ${filter.max}`}
                              min={filter.min}
                              max={filter.max}
                            />
                          </div>
                        </div>
                      )}

                      {/* Color Filter */}
                      {filter.type === 'color' && filter.options && (
                        <div className="flex flex-wrap gap-2">
                          {filter.options.map((option) => {
                            const isSelected = ((attributeFilters[filter.code] as string[]) || []).includes(option.value)
                            return (
                              <button
                                key={option.value}
                                onClick={() => toggleFilterValue(filter.code, option.value)}
                                className={`relative w-8 h-8 rounded-full border-2 transition-all ${
                                  isSelected
                                    ? 'border-teal-500 ring-2 ring-teal-200'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                                title={`${option.label} (${option.count})`}
                              >
                                <span
                                  className="absolute inset-0.5 rounded-full"
                                  style={{ backgroundColor: option.color_hex }}
                                />
                                {isSelected && (
                                  <CheckIcon className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow-md" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {/* Select / Multiselect Filter */}
                      {(filter.type === 'select' || filter.type === 'multiselect') && filter.options && (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {filter.options.map((option) => (
                            <label key={option.value} className="flex items-center justify-between gap-2 cursor-pointer group">
                              <div className="flex items-center gap-2">
                                <input
                                  type={filter.type === 'select' ? 'radio' : 'checkbox'}
                                  name={filter.type === 'select' ? filter.code : undefined}
                                  checked={((attributeFilters[filter.code] as string[]) || []).includes(option.value)}
                                  onChange={() => filter.type === 'select'
                                    ? setFilterValue(filter.code, option.value)
                                    : toggleFilterValue(filter.code, option.value)
                                  }
                                  className="rounded text-teal-600 focus:ring-teal-500"
                                />
                                <span className="text-sm text-gray-700 group-hover:text-gray-900">{option.label}</span>
                              </div>
                              <span className="text-xs text-gray-400">{option.count}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Toolbar */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center space-x-4">
                  {/* Mobile Filter Button */}
                  <button
                    onClick={() => setShowFilters(true)}
                    className="lg:hidden flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <AdjustmentsHorizontalIcon className="w-5 h-5" />
                    <span>Фільтри</span>
                  </button>

                  <p className="text-sm text-gray-600">
                    Знайдено <span className="font-medium">{filteredProducts.length}</span> товарів
                  </p>
                </div>

                <div className="flex items-center space-x-4">
                  {/* Sort Dropdown */}
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm focus:ring-teal-500 focus:border-teal-500"
                    >
                      <option value="popular">За популярністю</option>
                      <option value="price_asc">Від дешевих</option>
                      <option value="price_desc">Від дорогих</option>
                      <option value="rating">За рейтингом</option>
                      <option value="new">Новинки</option>
                    </select>
                    <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>

                  {/* View Mode */}
                  <div className="hidden sm:flex items-center border border-gray-300 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 ${viewMode === 'grid' ? 'bg-teal-50 text-teal-600' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      <Squares2X2Icon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 ${viewMode === 'list' ? 'bg-teal-50 text-teal-600' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      <ListBulletIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Products Grid */}
            {paginatedProducts.length > 0 ? (
              <>
                <div className={`grid gap-6 ${
                  viewMode === 'grid'
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                    : 'grid-cols-1'
                }`}>
                  {paginatedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeftIcon className="w-5 h-5" />
                    </button>

                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className={`w-10 h-10 rounded-lg font-medium ${
                            currentPage === pageNum
                              ? 'bg-teal-600 text-white'
                              : 'border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}

                    {totalPages > 5 && currentPage < totalPages - 2 && (
                      <>
                        <span className="px-2">...</span>
                        <button
                          onClick={() => goToPage(totalPages)}
                          className="w-10 h-10 rounded-lg font-medium border border-gray-300 hover:bg-gray-50"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRightIcon className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {/* Products count info */}
                <p className="text-center text-sm text-gray-500 mt-4">
                  Показано {(currentPage - 1) * PRODUCTS_PER_PAGE + 1} - {Math.min(currentPage * PRODUCTS_PER_PAGE, filteredProducts.length)} з {filteredProducts.length} товарів
                </p>
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <p className="text-gray-500 mb-4">Товарів за вашим запитом не знайдено</p>
                <button
                  onClick={clearFilters}
                  className="text-teal-600 hover:text-teal-700 font-medium"
                >
                  Скинути фільтри
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filters Modal */}
      {showFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowFilters(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-full bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">
                Фільтри
                {activeFilterCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full">
                    {activeFilterCount}
                  </span>
                )}
              </h3>
              <button
                onClick={() => setShowFilters(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto">
              {/* Price Range */}
              <div className="mb-6 pb-6 border-b border-gray-100">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Ціна, ₴</h4>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Від"
                  />
                  <span className="text-gray-400">—</span>
                  <input
                    type="number"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="До"
                  />
                </div>
              </div>

              {/* Brands Filter */}
              {availableBrands.length > 0 && (
                <div className="mb-6 pb-6 border-b border-gray-100">
                  <button
                    onClick={() => toggleFilterExpansion('brand')}
                    className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-3"
                  >
                    <span>Бренд</span>
                    {expandedFilters.includes('brand') ? (
                      <ChevronUpIcon className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  {expandedFilters.includes('brand') && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {availableBrands.slice(0, 15).map((brand) => (
                        <label key={brand} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedBrands.includes(brand)}
                            onChange={() => toggleBrand(brand)}
                            className="rounded text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-sm text-gray-700">{brand}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Dynamic Attribute Filters - Mobile */}
              {categoryFilters.map((filter) => (
                <div key={filter.code} className="mb-6 pb-6 border-b border-gray-100 last:border-b-0 last:pb-0">
                  <button
                    onClick={() => toggleFilterExpansion(filter.code)}
                    className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-3"
                  >
                    <span>
                      {filter.name}
                      {filter.unit && <span className="text-gray-400 ml-1">({filter.unit})</span>}
                    </span>
                    {expandedFilters.includes(filter.code) ? (
                      <ChevronUpIcon className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {expandedFilters.includes(filter.code) && (
                    <>
                      {/* Boolean Filter */}
                      {filter.type === 'bool' && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!attributeFilters[filter.code]}
                            onChange={() => toggleBoolFilter(filter.code)}
                            className="rounded text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-sm text-gray-700">Так</span>
                        </label>
                      )}

                      {/* Range Filter */}
                      {filter.type === 'range' && filter.min !== undefined && filter.max !== undefined && (
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            value={(attributeFilters[filter.code] as [number, number])?.[0] ?? filter.min}
                            onChange={(e) => setRangeFilter(filter.code, [
                              Number(e.target.value),
                              (attributeFilters[filter.code] as [number, number])?.[1] ?? filter.max!
                            ])}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder={`Від ${filter.min}`}
                          />
                          <span className="text-gray-400">—</span>
                          <input
                            type="number"
                            value={(attributeFilters[filter.code] as [number, number])?.[1] ?? filter.max}
                            onChange={(e) => setRangeFilter(filter.code, [
                              (attributeFilters[filter.code] as [number, number])?.[0] ?? filter.min!,
                              Number(e.target.value)
                            ])}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder={`До ${filter.max}`}
                          />
                        </div>
                      )}

                      {/* Color Filter */}
                      {filter.type === 'color' && filter.options && (
                        <div className="flex flex-wrap gap-2">
                          {filter.options.map((option) => {
                            const isSelected = ((attributeFilters[filter.code] as string[]) || []).includes(option.value)
                            return (
                              <button
                                key={option.value}
                                onClick={() => toggleFilterValue(filter.code, option.value)}
                                className={`relative w-8 h-8 rounded-full border-2 transition-all ${
                                  isSelected
                                    ? 'border-teal-500 ring-2 ring-teal-200'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                                title={option.label}
                              >
                                <span
                                  className="absolute inset-0.5 rounded-full"
                                  style={{ backgroundColor: option.color_hex }}
                                />
                                {isSelected && (
                                  <CheckIcon className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow-md" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {/* Select / Multiselect Filter */}
                      {(filter.type === 'select' || filter.type === 'multiselect') && filter.options && (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {filter.options.map((option) => (
                            <label key={option.value} className="flex items-center justify-between gap-2 cursor-pointer">
                              <div className="flex items-center gap-2">
                                <input
                                  type={filter.type === 'select' ? 'radio' : 'checkbox'}
                                  name={filter.type === 'select' ? `mobile-${filter.code}` : undefined}
                                  checked={((attributeFilters[filter.code] as string[]) || []).includes(option.value)}
                                  onChange={() => filter.type === 'select'
                                    ? setFilterValue(filter.code, option.value)
                                    : toggleFilterValue(filter.code, option.value)
                                  }
                                  className="rounded text-teal-600 focus:ring-teal-500"
                                />
                                <span className="text-sm text-gray-700">{option.label}</span>
                              </div>
                              <span className="text-xs text-gray-400">{option.count}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t bg-white">
              <div className="flex space-x-3">
                <button
                  onClick={clearFilters}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Скинути
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="flex-1 px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  Показати ({filteredProducts.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
