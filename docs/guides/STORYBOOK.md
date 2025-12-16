# Storybook

Документація компонентної бібліотеки Shop Platform з використанням Storybook.

## Огляд

Storybook використовується для:
- Розробки UI компонентів в ізоляції
- Документації компонентів
- Візуального тестування
- Демонстрації дизайн-системи

## Структура

```
services/web/
├── .storybook/
│   ├── main.ts
│   ├── preview.tsx
│   └── manager.ts
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button/
│   │   │   │   ├── button.tsx
│   │   │   │   ├── button.stories.tsx
│   │   │   │   └── button.test.tsx
│   │   │   ├── input/
│   │   │   ├── card/
│   │   │   └── ...
│   │   ├── features/
│   │   │   ├── product-card/
│   │   │   ├── cart/
│   │   │   └── ...
│   │   └── layouts/
│   └── stories/
│       └── docs/
│           ├── intro.mdx
│           └── design-tokens.mdx
```

## Конфігурація

### Main Configuration

```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
    '@storybook/addon-designs',
    '@chromatic-com/storybook',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  staticDirs: ['../public'],
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => {
        if (prop.parent) {
          return !prop.parent.fileName.includes('node_modules');
        }
        return true;
      },
    },
  },
};

export default config;
```

### Preview Configuration

```typescript
// .storybook/preview.tsx
import type { Preview } from '@storybook/react';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../src/styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
});

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#1a1a1a' },
        { name: 'gray', value: '#f5f5f5' },
      ],
    },
    viewport: {
      viewports: {
        mobile: { name: 'Mobile', styles: { width: '375px', height: '667px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop', styles: { width: '1440px', height: '900px' } },
      },
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light">
          <div className="p-4">
            <Story />
          </div>
        </ThemeProvider>
      </QueryClientProvider>
    ),
  ],
};

export default preview;
```

## UI Components

### Button Component

```typescript
// src/components/ui/button/button.tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
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
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {!loading && leftIcon && <span className="mr-2">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="ml-2">{rightIcon}</span>}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

### Button Stories

```typescript
// src/components/ui/button/button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Button } from './button';
import { Mail, ArrowRight, Download, Trash2 } from 'lucide-react';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Primary UI component for user interactions.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      description: 'The visual style of the button',
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: 'The size of the button',
    },
    loading: {
      control: 'boolean',
      description: 'Shows a loading spinner',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables the button',
    },
  },
  args: {
    onClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Basic variants
export const Default: Story = {
  args: {
    children: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Delete',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost',
  },
};

export const Link: Story = {
  args: {
    variant: 'link',
    children: 'Link Button',
  },
};

// Sizes
export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Small',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Large Button',
  },
};

export const IconOnly: Story = {
  args: {
    size: 'icon',
    children: <Mail className="h-4 w-4" />,
  },
};

// States
export const Loading: Story = {
  args: {
    loading: true,
    children: 'Loading...',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled',
  },
};

// With icons
export const WithLeftIcon: Story = {
  args: {
    leftIcon: <Mail className="h-4 w-4" />,
    children: 'Login with Email',
  },
};

export const WithRightIcon: Story = {
  args: {
    rightIcon: <ArrowRight className="h-4 w-4" />,
    children: 'Next Step',
  },
};

// Complex examples
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon"><Mail className="h-4 w-4" /></Button>
    </div>
  ),
};

export const RealWorldExamples: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button>Add to Cart</Button>
        <Button variant="outline">Buy Now</Button>
      </div>
      <div className="flex gap-2">
        <Button variant="destructive" leftIcon={<Trash2 className="h-4 w-4" />}>
          Delete Account
        </Button>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" leftIcon={<Download className="h-4 w-4" />}>
          Download Invoice
        </Button>
      </div>
    </div>
  ),
};
```

### Input Component

```typescript
// src/components/ui/input/input.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const inputVariants = cva(
  'flex w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-input',
        error: 'border-destructive focus-visible:ring-destructive',
      },
      inputSize: {
        default: 'h-10',
        sm: 'h-9 text-xs',
        lg: 'h-12 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'default',
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  error?: string;
  label?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, inputSize, error, label, helperText, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || React.useId();

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            className={cn(
              inputVariants({ variant: error ? 'error' : variant, inputSize }),
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {rightIcon}
            </div>
          )}
        </div>
        {(error || helperText) && (
          <p className={cn('mt-1.5 text-sm', error ? 'text-destructive' : 'text-muted-foreground')}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input, inputVariants };
```

### Input Stories

```typescript
// src/components/ui/input/input.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './input';
import { Search, Mail, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Email',
    placeholder: 'Enter your email',
    type: 'email',
  },
};

export const WithHelperText: Story = {
  args: {
    label: 'Password',
    type: 'password',
    helperText: 'Must be at least 8 characters',
  },
};

export const WithError: Story = {
  args: {
    label: 'Email',
    value: 'invalid-email',
    error: 'Please enter a valid email address',
  },
};

export const WithLeftIcon: Story = {
  args: {
    placeholder: 'Search products...',
    leftIcon: <Search className="h-4 w-4" />,
  },
};

export const WithRightIcon: Story = {
  args: {
    label: 'Email',
    placeholder: 'Enter email',
    rightIcon: <Mail className="h-4 w-4" />,
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="space-y-4">
      <Input inputSize="sm" placeholder="Small input" />
      <Input inputSize="default" placeholder="Default input" />
      <Input inputSize="lg" placeholder="Large input" />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    label: 'Disabled',
    value: 'Cannot edit',
    disabled: true,
  },
};

export const PasswordInput: Story = {
  render: () => {
    const [show, setShow] = useState(false);
    return (
      <Input
        label="Password"
        type={show ? 'text' : 'password'}
        placeholder="Enter password"
        rightIcon={
          <button type="button" onClick={() => setShow(!show)}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />
    );
  },
};
```

## Feature Components

### Product Card

```typescript
// src/components/features/product-card/product-card.tsx
import Image from 'next/image';
import Link from 'next/link';
import { Heart, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, formatPrice } from '@/lib/utils';

export interface ProductCardProps {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  category?: string;
  isNew?: boolean;
  isSale?: boolean;
  isOutOfStock?: boolean;
  rating?: number;
  reviewCount?: number;
  onAddToCart?: () => void;
  onAddToWishlist?: () => void;
  className?: string;
}

export function ProductCard({
  id,
  name,
  slug,
  price,
  compareAtPrice,
  image,
  category,
  isNew,
  isSale,
  isOutOfStock,
  rating,
  reviewCount,
  onAddToCart,
  onAddToWishlist,
  className,
}: ProductCardProps) {
  const discount = compareAtPrice
    ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
    : 0;

  return (
    <div className={cn('group relative', className)}>
      {/* Image */}
      <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
        <Link href={`/products/${slug}`}>
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
          />
        </Link>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {isNew && <Badge>New</Badge>}
          {isSale && discount > 0 && (
            <Badge variant="destructive">-{discount}%</Badge>
          )}
          {isOutOfStock && <Badge variant="secondary">Out of Stock</Badge>}
        </div>

        {/* Quick actions */}
        <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            size="icon"
            variant="secondary"
            onClick={onAddToWishlist}
            className="h-8 w-8"
          >
            <Heart className="h-4 w-4" />
          </Button>
        </div>

        {/* Add to cart button */}
        <div className="absolute bottom-2 left-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            className="w-full"
            size="sm"
            onClick={onAddToCart}
            disabled={isOutOfStock}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="mt-3">
        {category && (
          <p className="text-xs text-muted-foreground">{category}</p>
        )}
        <Link href={`/products/${slug}`}>
          <h3 className="font-medium line-clamp-2 hover:text-primary">
            {name}
          </h3>
        </Link>

        {/* Rating */}
        {rating !== undefined && (
          <div className="mt-1 flex items-center gap-1">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className={cn(
                    'h-4 w-4',
                    i < Math.floor(rating) ? 'text-yellow-400' : 'text-gray-200'
                  )}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            {reviewCount !== undefined && (
              <span className="text-xs text-muted-foreground">
                ({reviewCount})
              </span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="mt-2 flex items-center gap-2">
          <span className="font-semibold">{formatPrice(price)}</span>
          {compareAtPrice && (
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(compareAtPrice)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Product Card Stories

```typescript
// src/components/features/product-card/product-card.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { ProductCard } from './product-card';

const meta: Meta<typeof ProductCard> = {
  title: 'Features/ProductCard',
  component: ProductCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[280px]">
        <Story />
      </div>
    ),
  ],
  args: {
    onAddToCart: fn(),
    onAddToWishlist: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const defaultProduct = {
  id: '1',
  name: 'Wireless Bluetooth Headphones',
  slug: 'wireless-bluetooth-headphones',
  price: 2499,
  image: 'https://picsum.photos/400/400',
  category: 'Electronics',
  rating: 4.5,
  reviewCount: 128,
};

export const Default: Story = {
  args: defaultProduct,
};

export const WithSale: Story = {
  args: {
    ...defaultProduct,
    compareAtPrice: 3499,
    isSale: true,
  },
};

export const New: Story = {
  args: {
    ...defaultProduct,
    isNew: true,
  },
};

export const OutOfStock: Story = {
  args: {
    ...defaultProduct,
    isOutOfStock: true,
  },
};

export const NoRating: Story = {
  args: {
    ...defaultProduct,
    rating: undefined,
    reviewCount: undefined,
  },
};

export const LongName: Story = {
  args: {
    ...defaultProduct,
    name: 'Apple AirPods Pro (2nd Generation) with MagSafe Charging Case (USB-C)',
  },
};

export const Grid: Story = {
  decorators: [
    (Story) => (
      <div className="grid grid-cols-4 gap-6 w-[1200px]">
        <ProductCard {...defaultProduct} />
        <ProductCard {...defaultProduct} compareAtPrice={3499} isSale />
        <ProductCard {...defaultProduct} isNew />
        <ProductCard {...defaultProduct} isOutOfStock />
      </div>
    ),
  ],
  render: () => <></>,
};
```

## Documentation Pages

### Intro

```mdx
{/* src/stories/docs/intro.mdx */}
import { Meta } from '@storybook/blocks';

<Meta title="Introduction" />

# Shop Platform Design System

Welcome to the Shop Platform component library. This documentation provides
comprehensive examples and guidelines for using our UI components.

## Getting Started

```bash
# Install dependencies
npm install

# Run Storybook
npm run storybook
```

## Component Categories

- **UI Components** - Basic building blocks (Button, Input, Card, etc.)
- **Feature Components** - Complex components (ProductCard, Cart, Checkout)
- **Layout Components** - Page structure (Header, Footer, Sidebar)

## Design Principles

1. **Consistency** - Use consistent spacing, colors, and typography
2. **Accessibility** - All components meet WCAG 2.1 AA standards
3. **Responsiveness** - Components work across all screen sizes
4. **Performance** - Optimized for fast loading and rendering
```

### Design Tokens

```mdx
{/* src/stories/docs/design-tokens.mdx */}
import { Meta, ColorPalette, ColorItem, Typeset } from '@storybook/blocks';

<Meta title="Design Tokens" />

# Design Tokens

## Colors

<ColorPalette>
  <ColorItem
    title="Primary"
    subtitle="Brand color"
    colors={{ Primary: '#0066FF', 'Primary/90': '#1a75ff' }}
  />
  <ColorItem
    title="Secondary"
    subtitle="Supporting color"
    colors={{ Secondary: '#6c757d' }}
  />
  <ColorItem
    title="Destructive"
    subtitle="Error states"
    colors={{ Destructive: '#dc2626' }}
  />
  <ColorItem
    title="Neutral"
    subtitle="Text and backgrounds"
    colors={{
      Foreground: '#0f172a',
      'Muted Foreground': '#64748b',
      Background: '#ffffff',
      Muted: '#f1f5f9',
    }}
  />
</ColorPalette>

## Typography

<Typeset
  fontFamily="Inter, sans-serif"
  fontSizes={['12px', '14px', '16px', '18px', '24px', '30px', '36px']}
  fontWeight={400}
  sampleText="Shop Platform"
/>

## Spacing

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tight spacing |
| sm | 8px | Small elements |
| md | 16px | Default spacing |
| lg | 24px | Large sections |
| xl | 32px | Page sections |
| 2xl | 48px | Major sections |

## Border Radius

| Token | Value |
|-------|-------|
| sm | 4px |
| md | 6px |
| lg | 8px |
| xl | 12px |
| full | 9999px |
```

## Команди

```bash
# Запуск Storybook
npm run storybook

# Build статичної версії
npm run build-storybook

# Запуск тестів
npm run test-storybook

# Chromatic (візуальні тести)
npx chromatic --project-token=<token>
```

## CI/CD Integration

```yaml
# .github/workflows/storybook.yml
name: Storybook

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci
        working-directory: services/web

      - name: Publish to Chromatic
        uses: chromaui/action@latest
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          workingDir: services/web
```

## Див. також

- [Component Guidelines](../guides/COMPONENTS.md)
- [Styling Guide](../guides/STYLING.md)
- [Testing Guide](../guides/TESTING.md)
