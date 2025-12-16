# Admin Panel Architecture

Архітектура адміністративної панелі.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ADMIN ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Admin User ──▶ Admin Panel ──▶ API Gateway ──▶ Backend Services           │
│                     │                                                        │
│                     ├── Dashboard & Analytics                               │
│                     ├── Order Management                                    │
│                     ├── Product Management                                  │
│                     ├── Customer Management                                 │
│                     └── Settings & Configuration                            │
│                                                                              │
│  Tech Stack:                                                                │
│  ├── Framework: Next.js 14                                                 │
│  ├── UI Library: shadcn/ui                                                 │
│  ├── Data Tables: TanStack Table                                           │
│  ├── Forms: React Hook Form + Zod                                          │
│  └── Charts: Recharts                                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
services/admin/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── forgot-password/
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Dashboard layout with sidebar
│   │   ├── page.tsx            # Dashboard home
│   │   ├── orders/
│   │   │   ├── page.tsx        # Orders list
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Order detail
│   │   ├── products/
│   │   │   ├── page.tsx        # Products list
│   │   │   ├── new/
│   │   │   │   └── page.tsx    # Create product
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Edit product
│   │   ├── customers/
│   │   ├── categories/
│   │   ├── inventory/
│   │   ├── promotions/
│   │   ├── analytics/
│   │   └── settings/
│   └── api/
│       └── [...path]/
│           └── route.ts        # API proxy
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── dashboard/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── StatsCards.tsx
│   ├── orders/
│   │   ├── OrdersTable.tsx
│   │   ├── OrderDetails.tsx
│   │   └── OrderStatusBadge.tsx
│   ├── products/
│   │   ├── ProductForm.tsx
│   │   ├── ProductsTable.tsx
│   │   └── ImageUploader.tsx
│   └── common/
│       ├── DataTable.tsx
│       ├── Pagination.tsx
│       └── SearchFilter.tsx
├── lib/
│   ├── api/
│   ├── hooks/
│   └── utils/
└── styles/
```

## Dashboard Layout

### Sidebar Navigation

```typescript
// components/dashboard/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  FolderTree,
  Warehouse,
  Tag,
  BarChart3,
  Settings,
} from 'lucide-react';

const navigation = [
  { name: 'Дашборд', href: '/', icon: LayoutDashboard },
  { name: 'Замовлення', href: '/orders', icon: ShoppingCart, badge: 12 },
  { name: 'Товари', href: '/products', icon: Package },
  { name: 'Клієнти', href: '/customers', icon: Users },
  { name: 'Категорії', href: '/categories', icon: FolderTree },
  { name: 'Склад', href: '/inventory', icon: Warehouse },
  { name: 'Акції', href: '/promotions', icon: Tag },
  { name: 'Аналітика', href: '/analytics', icon: BarChart3 },
  { name: 'Налаштування', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-card">
      <div className="p-6">
        <Logo />
      </div>
      <nav className="space-y-1 px-3">
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
            pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
              {item.badge && (
                <span className="ml-auto bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

## Data Tables

### Generic DataTable Component

```typescript
// components/common/DataTable.tsx
'use client';

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  pagination?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  pagination = true,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  });

  return (
    <div>
      {searchKey && (
        <Input
          placeholder="Пошук..."
          value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ''}
          onChange={(e) =>
            table.getColumn(searchKey)?.setFilterValue(e.target.value)
          }
          className="max-w-sm mb-4"
        />
      )}

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pagination && <DataTablePagination table={table} />}
    </div>
  );
}
```

### Orders Table

```typescript
// components/orders/OrdersTable.tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Order } from '@/lib/api/orders';
import { DataTable } from '@/components/common/DataTable';

const columns: ColumnDef<Order>[] = [
  {
    accessorKey: 'number',
    header: '№ Замовлення',
    cell: ({ row }) => (
      <Link href={`/orders/${row.original.id}`} className="font-medium">
        {row.getValue('number')}
      </Link>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Дата',
    cell: ({ row }) => formatDate(row.getValue('createdAt')),
  },
  {
    accessorKey: 'customer',
    header: 'Клієнт',
    cell: ({ row }) => row.original.customer.name,
  },
  {
    accessorKey: 'status',
    header: 'Статус',
    cell: ({ row }) => <OrderStatusBadge status={row.getValue('status')} />,
  },
  {
    accessorKey: 'total',
    header: 'Сума',
    cell: ({ row }) => formatPrice(row.getValue('total')),
  },
  {
    id: 'actions',
    cell: ({ row }) => <OrderActions order={row.original} />,
  },
];

export function OrdersTable({ orders }: { orders: Order[] }) {
  return (
    <DataTable
      columns={columns}
      data={orders}
      searchKey="number"
    />
  );
}
```

## Forms

### Product Form

```typescript
// components/products/ProductForm.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const productSchema = z.object({
  name: z.string().min(1, "Назва обов'язкова"),
  slug: z.string().min(1, "Slug обов'язковий"),
  sku: z.string().min(1, "SKU обов'язковий"),
  description: z.string().optional(),
  price: z.number().min(0, 'Ціна не може бути від\'ємною'),
  compareAtPrice: z.number().optional(),
  categoryId: z.string().min(1, "Категорія обов'язкова"),
  stock: z.number().int().min(0),
  images: z.array(z.string()).min(1, 'Додайте хоча б одне зображення'),
  isActive: z.boolean().default(true),
});

type ProductFormData = z.infer<typeof productSchema>;

export function ProductForm({
  product,
  onSubmit,
}: {
  product?: Product;
  onSubmit: (data: ProductFormData) => Promise<void>;
}) {
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product || {
      name: '',
      slug: '',
      sku: '',
      description: '',
      price: 0,
      stock: 0,
      images: [],
      isActive: true,
    },
  });

  const { isSubmitting } = form.formState;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Назва товару</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SKU</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ціна (грн)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Категорія</FormLabel>
                <CategorySelect
                  value={field.value}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Опис</FormLabel>
              <FormControl>
                <RichTextEditor {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="images"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Зображення</FormLabel>
              <ImageUploader
                images={field.value}
                onChange={field.onChange}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline">
            Скасувати
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Збереження...' : 'Зберегти'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

## Analytics Dashboard

### Stats Cards

```typescript
// components/dashboard/StatsCards.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface Stat {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
}

export function StatsCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            {stat.icon}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className={cn(
              'text-xs flex items-center gap-1',
              stat.change > 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {stat.change > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(stat.change)}% від минулого місяця
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### Revenue Chart

```typescript
// components/analytics/RevenueChart.tsx
'use client';

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function RevenueChart({ data }: { data: RevenueData[] }) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={data}>
        <XAxis
          dataKey="date"
          tickFormatter={(value) => formatDate(value, 'dd.MM')}
        />
        <YAxis tickFormatter={(value) => formatPrice(value)} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="bg-background border rounded-lg p-3 shadow">
                <p className="text-sm text-muted-foreground">
                  {formatDate(payload[0].payload.date)}
                </p>
                <p className="text-lg font-bold">
                  {formatPrice(payload[0].value as number)}
                </p>
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary) / 0.2)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

## Role-Based Access Control

```typescript
// lib/auth/permissions.ts
export const permissions = {
  orders: {
    view: ['admin', 'manager', 'support'],
    update: ['admin', 'manager'],
    delete: ['admin'],
  },
  products: {
    view: ['admin', 'manager', 'content'],
    create: ['admin', 'manager', 'content'],
    update: ['admin', 'manager', 'content'],
    delete: ['admin'],
  },
  customers: {
    view: ['admin', 'manager', 'support'],
    update: ['admin', 'manager'],
    delete: ['admin'],
  },
  settings: {
    view: ['admin'],
    update: ['admin'],
  },
};

export function hasPermission(
  userRole: string,
  resource: keyof typeof permissions,
  action: string
): boolean {
  return permissions[resource]?.[action]?.includes(userRole) ?? false;
}

// Component wrapper
export function ProtectedAction({
  resource,
  action,
  children,
}: {
  resource: keyof typeof permissions;
  action: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  if (!hasPermission(user.role, resource, action)) {
    return null;
  }

  return <>{children}</>;
}
```

## See Also

- [Storefront Architecture](./STOREFRONT_ARCHITECTURE.md)
- [CRM Architecture](./CRM_ARCHITECTURE.md)
- [Components Guide](../guides/COMPONENTS.md)
