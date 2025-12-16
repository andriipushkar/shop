# Styling Guide

Документація по стилізації Shop Platform.

## Огляд

Shop Platform використовує:
- **Tailwind CSS 3.4** для утилітарних класів
- **CSS Variables** для темізації
- **class-variance-authority (CVA)** для варіантів компонентів
- **tailwind-merge** для злиття класів
- **clsx** для умовних класів

## Конфігурація Tailwind

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';
import { fontFamily } from 'tailwindcss/defaultTheme';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', ...fontFamily.sans],
        heading: ['var(--font-cal-sans)', ...fontFamily.sans],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'slide-in-from-top': {
          from: { transform: 'translateY(-100%)' },
          to: { transform: 'translateY(0)' },
        },
        'slide-in-from-bottom': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-out': 'fade-out 0.2s ease-out',
        'slide-in-from-top': 'slide-in-from-top 0.3s ease-out',
        'slide-in-from-bottom': 'slide-in-from-bottom 0.3s ease-out',
        shimmer: 'shimmer 2s infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
```

## CSS Variables (Theme)

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --success: 142.1 76.2% 36.3%;
    --success-foreground: 355.7 100% 97.3%;
    --warning: 45.4 93.4% 47.5%;
    --warning-foreground: 26 83.3% 14.1%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --success: 142.1 70.6% 45.3%;
    --success-foreground: 144.9 80.4% 10%;
    --warning: 48 96.5% 53.1%;
    --warning-foreground: 26 83.3% 14.1%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: 'rlig' 1, 'calt' 1;
  }
}
```

## Multi-tenant Theming

```typescript
// lib/theme.ts
export interface TenantTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  fontFamily: string;
  logo: string;
}

export function generateThemeCSS(theme: TenantTheme): string {
  const hsl = hexToHSL(theme.colors.primary);

  return `
    :root {
      --primary: ${hsl.h} ${hsl.s}% ${hsl.l}%;
      --primary-foreground: ${hsl.l > 50 ? '222.2 47.4% 11.2%' : '210 40% 98%'};
      --radius: ${getRadius(theme.borderRadius)};
      --font-sans: '${theme.fontFamily}', system-ui, sans-serif;
    }
  `;
}

function getRadius(radius: TenantTheme['borderRadius']): string {
  const map = {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    full: '9999px',
  };
  return map[radius];
}

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 221, s: 83, l: 53 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}
```

### Theme Provider

```tsx
// components/providers/ThemeProvider.tsx
'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useEffect, useState } from 'react';

interface ThemeProviderProps {
  children: React.ReactNode;
  tenantTheme?: string; // CSS string from API
}

export function ThemeProvider({ children, tenantTheme }: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (tenantTheme) {
      const style = document.createElement('style');
      style.id = 'tenant-theme';
      style.textContent = tenantTheme;
      document.head.appendChild(style);

      return () => {
        document.getElementById('tenant-theme')?.remove();
      };
    }
  }, [tenantTheme]);

  if (!mounted) {
    return null;
  }

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```

## Utility Functions

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Приклади використання
cn('px-4 py-2', 'bg-blue-500');
// => 'px-4 py-2 bg-blue-500'

cn('px-4', condition && 'py-2');
// => 'px-4 py-2' або 'px-4'

cn('text-red-500', 'text-blue-500');
// => 'text-blue-500' (twMerge об'єднує)

cn({
  'bg-primary': isPrimary,
  'bg-secondary': !isPrimary,
});
```

## CVA (Class Variance Authority)

```typescript
// components/ui/badge.tsx
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        success: 'border-transparent bg-success text-success-foreground',
        warning: 'border-transparent bg-warning text-warning-foreground',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-2 py-0.5 text-[10px]',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

## Responsive Design

```tsx
// Breakpoints (Tailwind defaults)
// sm: 640px
// md: 768px
// lg: 1024px
// xl: 1280px
// 2xl: 1536px

// Mobile-first approach
<div className="
  px-4        // default (mobile)
  sm:px-6     // >= 640px
  lg:px-8     // >= 1024px
  xl:px-12    // >= 1280px
">

// Grid responsive
<div className="
  grid
  grid-cols-1       // 1 column on mobile
  sm:grid-cols-2    // 2 columns on tablet
  lg:grid-cols-3    // 3 columns on desktop
  xl:grid-cols-4    // 4 columns on large screens
  gap-4
">

// Hide/Show elements
<div className="hidden md:block">Desktop only</div>
<div className="md:hidden">Mobile only</div>
```

## Typography

```css
/* Typography scale */
@layer components {
  .text-display-2xl {
    @apply text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl;
  }

  .text-display-xl {
    @apply text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl;
  }

  .text-display-lg {
    @apply text-2xl font-bold tracking-tight sm:text-3xl;
  }

  .text-display-md {
    @apply text-xl font-semibold sm:text-2xl;
  }

  .text-body-lg {
    @apply text-lg leading-7;
  }

  .text-body {
    @apply text-base leading-6;
  }

  .text-body-sm {
    @apply text-sm leading-5;
  }

  .text-caption {
    @apply text-xs leading-4;
  }
}
```

```tsx
// Usage
<h1 className="text-display-2xl">Main Heading</h1>
<h2 className="text-display-lg">Section Title</h2>
<p className="text-body text-muted-foreground">Body text...</p>
<span className="text-caption text-muted-foreground">Small caption</span>
```

## Spacing System

```tsx
// Consistent spacing scale
// 0: 0
// 1: 0.25rem (4px)
// 2: 0.5rem (8px)
// 3: 0.75rem (12px)
// 4: 1rem (16px)
// 5: 1.25rem (20px)
// 6: 1.5rem (24px)
// 8: 2rem (32px)
// 10: 2.5rem (40px)
// 12: 3rem (48px)
// 16: 4rem (64px)
// 20: 5rem (80px)
// 24: 6rem (96px)

// Section spacing
<section className="py-12 md:py-16 lg:py-24">
  <div className="container">
    <div className="space-y-8">
      {/* Content with consistent vertical spacing */}
    </div>
  </div>
</section>

// Card spacing
<div className="p-4 md:p-6">
  <h3 className="mb-2">Title</h3>
  <p className="mb-4">Description</p>
  <div className="flex gap-2">
    {/* Actions */}
  </div>
</div>
```

## Animations

```tsx
// Tailwind animations
<div className="animate-pulse">Loading skeleton</div>
<div className="animate-spin">Spinner</div>
<div className="animate-bounce">Bouncing</div>
<div className="animate-fade-in">Fade in</div>

// Transitions
<button className="
  transition-colors
  duration-200
  hover:bg-primary/90
">
  Hover me
</button>

<div className="
  transition-transform
  duration-300
  ease-out
  hover:scale-105
">
  Scale on hover
</div>

// Custom animations
<div className="
  animate-in
  fade-in-0
  slide-in-from-bottom-4
  duration-500
">
  Animated entrance
</div>
```

### Skeleton Loader

```tsx
// components/ui/skeleton.tsx
import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-muted',
        'before:absolute before:inset-0',
        'before:-translate-x-full',
        'before:animate-shimmer',
        'before:bg-gradient-to-r',
        'before:from-transparent before:via-white/20 before:to-transparent',
        className
      )}
      {...props}
    />
  );
}

// Usage
<div className="space-y-4">
  <Skeleton className="h-48 w-full" /> {/* Image */}
  <Skeleton className="h-4 w-3/4" />   {/* Title */}
  <Skeleton className="h-4 w-1/2" />   {/* Price */}
</div>
```

## Dark Mode

```tsx
// Automatic dark mode support
<div className="
  bg-white dark:bg-gray-900
  text-gray-900 dark:text-gray-100
  border-gray-200 dark:border-gray-700
">

// Using semantic colors (recommended)
<div className="bg-background text-foreground border-border">
  {/* Automatically adapts to theme */}
</div>

// Dark mode toggle
'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
```

## Best Practices

### 1. Використовуйте семантичні кольори

```tsx
// Погано
<div className="bg-blue-500 text-white">

// Добре
<div className="bg-primary text-primary-foreground">
```

### 2. Mobile-first підхід

```tsx
// Починайте з мобільних стилів
<div className="text-sm md:text-base lg:text-lg">
```

### 3. Уникайте arbitrary values

```tsx
// Погано
<div className="mt-[13px] w-[247px]">

// Добре
<div className="mt-3 w-60">
```

### 4. Використовуйте cn() для умовних класів

```tsx
// Погано
<div className={`btn ${isActive ? 'btn-active' : ''}`}>

// Добре
<div className={cn('btn', isActive && 'btn-active')}>
```

### 5. Компонентний підхід

```tsx
// Погано - повторення стилів
<button className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90">
<button className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90">

// Добре - використання компонента
<Button>Click me</Button>
<Button>Another button</Button>
```

## Див. також

- [Components Guide](./COMPONENTS.md)
- [Storybook](./STORYBOOK.md)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com)
