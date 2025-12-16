# UI Components Guide

Документація по UI компонентах Shop Platform.

## Огляд архітектури

Shop Platform використовує компонентний підхід на базі:
- **React 18** з Server Components
- **Next.js 14** App Router
- **Tailwind CSS** для стилізації
- **shadcn/ui** як базова бібліотека
- **Radix UI** для доступності

## Структура компонентів

```
frontend/src/
├── components/
│   ├── ui/              # Базові UI компоненти (shadcn/ui)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── forms/           # Форми та поля
│   │   ├── FormField.tsx
│   │   ├── SearchForm.tsx
│   │   └── ...
│   ├── layout/          # Макетні компоненти
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── Sidebar.tsx
│   │   └── ...
│   ├── products/        # Компоненти товарів
│   │   ├── ProductCard.tsx
│   │   ├── ProductGrid.tsx
│   │   ├── ProductFilters.tsx
│   │   └── ...
│   ├── cart/            # Кошик
│   │   ├── CartDrawer.tsx
│   │   ├── CartItem.tsx
│   │   └── ...
│   └── shared/          # Спільні компоненти
│       ├── LoadingSpinner.tsx
│       ├── ErrorBoundary.tsx
│       └── ...
└── app/                 # Next.js App Router
    ├── (shop)/          # Публічні сторінки
    └── (admin)/         # Адмін панель
```

## Базові UI компоненти

### Button

```tsx
// components/ui/button.tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="mr-2 h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Loading...
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

Використання:

```tsx
<Button>Default</Button>
<Button variant="outline">Outline</Button>
<Button variant="destructive" size="lg">Delete</Button>
<Button loading>Submitting...</Button>
<Button asChild>
  <Link href="/shop">Go to Shop</Link>
</Button>
```

### Input

```tsx
// components/ui/input.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, icon, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            icon && 'pl-10',
            error && 'border-destructive focus-visible:ring-destructive',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
```

### Card

```tsx
// components/ui/card.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-xl border bg-card text-card-foreground shadow', className)}
      {...props}
    />
  )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('font-semibold leading-none tracking-tight', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
```

## Продуктові компоненти

### ProductCard

```tsx
// components/products/ProductCard.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Heart, ShoppingCart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/utils';
import { useCart } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
import type { Product } from '@/types/product';

interface ProductCardProps {
  product: Product;
  showQuickAdd?: boolean;
}

export function ProductCard({ product, showQuickAdd = true }: ProductCardProps) {
  const { addItem, isLoading: cartLoading } = useCart();
  const { toggle, isInWishlist } = useWishlist();

  const mainImage = product.images?.[0]?.url || '/placeholder.png';
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / product.compare_at_price!) * 100)
    : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({
      product_id: product.id,
      variant_id: product.variants?.[0]?.id,
      quantity: 1,
    });
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    toggle(product.id);
  };

  return (
    <Card className="group overflow-hidden">
      <Link href={`/products/${product.slug}`}>
        <div className="relative aspect-square overflow-hidden">
          <Image
            src={mainImage}
            alt={product.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />

          {/* Badges */}
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {hasDiscount && (
              <Badge variant="destructive">-{discountPercent}%</Badge>
            )}
            {product.is_new && <Badge>New</Badge>}
            {!product.in_stock && (
              <Badge variant="secondary">Out of Stock</Badge>
            )}
          </div>

          {/* Wishlist button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 bg-white/80 hover:bg-white"
            onClick={handleToggleWishlist}
          >
            <Heart
              className={cn(
                'h-5 w-5',
                isInWishlist(product.id) && 'fill-red-500 text-red-500'
              )}
            />
          </Button>

          {/* Quick add overlay */}
          {showQuickAdd && product.in_stock && (
            <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/60 to-transparent p-4 transition-transform group-hover:translate-y-0">
              <Button
                className="w-full"
                onClick={handleAddToCart}
                loading={cartLoading}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Add to Cart
              </Button>
            </div>
          )}
        </div>

        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{product.brand}</p>
          <h3 className="mt-1 font-medium line-clamp-2">{product.name}</h3>

          <div className="mt-2 flex items-center gap-2">
            <span className="font-bold">{formatPrice(product.price)}</span>
            {hasDiscount && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(product.compare_at_price!)}
              </span>
            )}
          </div>

          {/* Rating */}
          {product.rating > 0 && (
            <div className="mt-2 flex items-center gap-1">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    className={cn(
                      'h-4 w-4',
                      star <= product.rating ? 'text-yellow-400' : 'text-gray-200'
                    )}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                ({product.reviews_count})
              </span>
            </div>
          )}
        </CardContent>
      </Link>
    </Card>
  );
}
```

### ProductGrid

```tsx
// components/products/ProductGrid.tsx
import { ProductCard } from './ProductCard';
import { ProductSkeleton } from './ProductSkeleton';
import type { Product } from '@/types/product';

interface ProductGridProps {
  products: Product[];
  loading?: boolean;
  columns?: 2 | 3 | 4;
}

export function ProductGrid({ products, loading, columns = 4 }: ProductGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  };

  if (loading) {
    return (
      <div className={cn('grid gap-4', gridCols[columns])}>
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No products found</p>
      </div>
    );
  }

  return (
    <div className={cn('grid gap-4', gridCols[columns])}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

### ProductFilters

```tsx
// components/products/ProductFilters.tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { FilterOptions } from '@/types/product';

interface ProductFiltersProps {
  filters: FilterOptions;
  activeFilters: Record<string, string[]>;
}

export function ProductFilters({ filters, activeFilters }: ProductFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [priceRange, setPriceRange] = useState([
    filters.price.min,
    filters.price.max,
  ]);

  const updateFilters = (key: string, values: string[]) => {
    const params = new URLSearchParams(searchParams.toString());

    if (values.length > 0) {
      params.set(key, values.join(','));
    } else {
      params.delete(key);
    }

    params.delete('page'); // Reset pagination
    router.push(`?${params.toString()}`);
  };

  const clearAllFilters = () => {
    router.push(window.location.pathname);
  };

  const hasActiveFilters = Object.keys(activeFilters).length > 0;

  const FiltersContent = () => (
    <div className="space-y-6">
      {/* Price Range */}
      <Accordion type="single" collapsible defaultValue="price">
        <AccordionItem value="price">
          <AccordionTrigger>Price</AccordionTrigger>
          <AccordionContent>
            <div className="px-2">
              <Slider
                value={priceRange}
                min={filters.price.min}
                max={filters.price.max}
                step={10}
                onValueChange={setPriceRange}
                onValueCommit={(value) => {
                  updateFilters('price', [`${value[0]}-${value[1]}`]);
                }}
              />
              <div className="mt-2 flex justify-between text-sm">
                <span>{priceRange[0]} ₴</span>
                <span>{priceRange[1]} ₴</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Categories */}
      {filters.categories.length > 0 && (
        <Accordion type="single" collapsible defaultValue="categories">
          <AccordionItem value="categories">
            <AccordionTrigger>Categories</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {filters.categories.map((category) => (
                  <label
                    key={category.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={activeFilters.category?.includes(category.slug)}
                      onCheckedChange={(checked) => {
                        const current = activeFilters.category || [];
                        const updated = checked
                          ? [...current, category.slug]
                          : current.filter((c) => c !== category.slug);
                        updateFilters('category', updated);
                      }}
                    />
                    <span className="text-sm">{category.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      ({category.count})
                    </span>
                  </label>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Brands */}
      {filters.brands.length > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value="brands">
            <AccordionTrigger>Brands</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {filters.brands.map((brand) => (
                  <label
                    key={brand.slug}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={activeFilters.brand?.includes(brand.slug)}
                      onCheckedChange={(checked) => {
                        const current = activeFilters.brand || [];
                        const updated = checked
                          ? [...current, brand.slug]
                          : current.filter((b) => b !== brand.slug);
                        updateFilters('brand', updated);
                      }}
                    />
                    <span className="text-sm">{brand.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      ({brand.count})
                    </span>
                  </label>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Dynamic Attributes */}
      {filters.attributes.map((attr) => (
        <Accordion key={attr.key} type="single" collapsible>
          <AccordionItem value={attr.key}>
            <AccordionTrigger>{attr.name}</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {attr.values.map((value) => (
                  <label
                    key={value.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={activeFilters[attr.key]?.includes(value.value)}
                      onCheckedChange={(checked) => {
                        const current = activeFilters[attr.key] || [];
                        const updated = checked
                          ? [...current, value.value]
                          : current.filter((v) => v !== value.value);
                        updateFilters(attr.key, updated);
                      }}
                    />
                    {attr.type === 'color' && (
                      <span
                        className="h-4 w-4 rounded-full border"
                        style={{ backgroundColor: value.value }}
                      />
                    )}
                    <span className="text-sm">{value.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      ({value.count})
                    </span>
                  </label>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ))}

      {hasActiveFilters && (
        <Button
          variant="outline"
          className="w-full"
          onClick={clearAllFilters}
        >
          <X className="mr-2 h-4 w-4" />
          Clear All Filters
        </Button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:block w-64 shrink-0">
        <FiltersContent />
      </aside>

      {/* Mobile */}
      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {Object.values(activeFilters).flat().length}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <FiltersContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
```

## Cart компоненти

### CartDrawer

```tsx
// components/cart/CartDrawer.tsx
'use client';

import { ShoppingCart, X, Minus, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/hooks/useCart';
import { formatPrice } from '@/lib/utils';

export function CartDrawer() {
  const { cart, updateQuantity, removeItem, isLoading } = useCart();
  const itemCount = cart?.items?.length || 0;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <ShoppingCart className="h-5 w-5" />
          {itemCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              {itemCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Shopping Cart ({itemCount})</SheetTitle>
        </SheetHeader>

        {itemCount === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center">
            <ShoppingCart className="h-16 w-16 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">Your cart is empty</p>
            <p className="text-sm text-muted-foreground">
              Add items to get started
            </p>
            <Button asChild className="mt-6">
              <Link href="/products">Browse Products</Link>
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4">
                {cart?.items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border">
                      <Image
                        src={item.image_url || '/placeholder.png'}
                        alt={item.name}
                        fill
                        className="object-cover"
                      />
                    </div>

                    <div className="flex flex-1 flex-col">
                      <div className="flex justify-between">
                        <div>
                          <Link
                            href={`/products/${item.product_slug}`}
                            className="font-medium hover:underline line-clamp-1"
                          >
                            {item.name}
                          </Link>
                          {item.variant_name && (
                            <p className="text-sm text-muted-foreground">
                              {item.variant_name}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="font-medium">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="space-y-4 pt-4">
              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatPrice(cart?.subtotal || 0)}</span>
                </div>
                {cart?.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-{formatPrice(cart.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>{formatPrice(cart?.total || 0)}</span>
                </div>
              </div>

              <Button asChild className="w-full" size="lg">
                <Link href="/checkout">Proceed to Checkout</Link>
              </Button>

              <Button asChild variant="outline" className="w-full">
                <Link href="/cart">View Cart</Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

## Форми

### SearchForm

```tsx
// components/forms/SearchForm.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/useDebounce';
import { searchProducts } from '@/lib/api/products';
import type { Product } from '@/types/product';

export function SearchForm() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    const search = async () => {
      setIsLoading(true);
      try {
        const data = await searchProducts({ q: debouncedQuery, limit: 5 });
        setResults(data.products);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    search();
  }, [debouncedQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            placeholder="Search products..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="pl-10 pr-10"
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>

      {/* Suggestions dropdown */}
      {isOpen && query.length >= 2 && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : results.length > 0 ? (
            <ul className="py-2">
              {results.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/products/${product.slug}`}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-accent"
                    onClick={() => setIsOpen(false)}
                  >
                    <Image
                      src={product.images?.[0]?.url || '/placeholder.png'}
                      alt={product.name}
                      width={40}
                      height={40}
                      className="rounded object-cover"
                    />
                    <div>
                      <p className="font-medium line-clamp-1">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatPrice(product.price)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={`/search?q=${encodeURIComponent(query)}`}
                  className="block px-4 py-2 text-center text-sm text-primary hover:underline"
                  onClick={() => setIsOpen(false)}
                >
                  View all results
                </Link>
              </li>
            </ul>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No products found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Hooks

### useCart

```tsx
// hooks/useCart.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cartApi } from '@/lib/api/cart';
import { toast } from 'sonner';
import type { AddToCartRequest, UpdateCartItemRequest } from '@/types/cart';

export function useCart() {
  const queryClient = useQueryClient();

  const { data: cart, isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: cartApi.getCart,
    staleTime: 1000 * 60 * 5,
  });

  const addItemMutation = useMutation({
    mutationFn: (data: AddToCartRequest) => cartApi.addItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      toast.success('Added to cart');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add item');
    },
  });

  const updateQuantityMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      cartApi.updateItem(itemId, { quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => cartApi.removeItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      toast.success('Item removed');
    },
  });

  return {
    cart,
    isLoading,
    addItem: addItemMutation.mutate,
    updateQuantity: (itemId: string, quantity: number) =>
      updateQuantityMutation.mutate({ itemId, quantity }),
    removeItem: removeItemMutation.mutate,
    isUpdating: updateQuantityMutation.isPending || removeItemMutation.isPending,
  };
}
```

## Див. також

- [Styling Guide](./STYLING.md)
- [Storybook](./STORYBOOK.md)
- [Forms Guide](./FORMS.md)
- [Accessibility](./A11Y.md)
