# Admin Panel

Адміністративна панель для управління магазином.

## Огляд

Адмін панель є частиною Storefront і доступна за шляхом `/admin`. Вона надає повний контроль над:
- Товарами та каталогом
- Замовленнями
- Клієнтами
- Складом (WMS)
- Аналітикою
- Налаштуваннями

## Структура

```
app/admin/
├── layout.tsx              # Admin layout with sidebar
├── page.tsx                # Dashboard
├── products/
│   ├── page.tsx            # Product list
│   ├── [id]/page.tsx       # Edit product
│   └── new/page.tsx        # Create product
├── categories/
├── orders/
│   ├── page.tsx            # Order list
│   └── [id]/page.tsx       # Order detail
├── customers/
├── warehouse/
│   ├── inventory/
│   ├── receipts/
│   ├── shipments/
│   └── pos/
├── analytics/
│   ├── sales/
│   ├── customers/
│   └── products/
├── marketing/
│   ├── promo/
│   ├── campaigns/
│   └── banners/
├── integrations/
│   ├── marketplaces/
│   └── delivery/
└── settings/
    ├── general/
    ├── payments/
    ├── shipping/
    └── users/
```

## Dashboard

### KPI Cards

```tsx
export default async function AdminDashboard() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Виручка сьогодні"
          value={formatMoney(stats.revenueToday)}
          change={stats.revenueChange}
          icon={<CurrencyIcon />}
        />
        <KPICard
          title="Замовлення"
          value={stats.ordersToday}
          change={stats.ordersChange}
          icon={<OrderIcon />}
        />
        <KPICard
          title="Середній чек"
          value={formatMoney(stats.avgOrderValue)}
          change={stats.aovChange}
          icon={<CartIcon />}
        />
        <KPICard
          title="Конверсія"
          value={`${stats.conversionRate}%`}
          change={stats.conversionChange}
          icon={<ChartIcon />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Виручка за тиждень</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={stats.revenueTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Статуси замовлень</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderStatusChart data={stats.ordersByStatus} />
          </CardContent>
        </Card>
      </div>

      {/* Recent */}
      <div className="grid grid-cols-2 gap-6">
        <RecentOrders orders={stats.recentOrders} />
        <LowStockAlerts products={stats.lowStockProducts} />
      </div>
    </div>
  );
}
```

## Управління товарами

### Product List

```tsx
'use client';

import { useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { columns } from './columns';

export default function ProductsPage() {
  const [filters, setFilters] = useState({});

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Товари</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <DownloadIcon /> Експорт
          </Button>
          <Button variant="outline" onClick={handleImport}>
            <UploadIcon /> Імпорт
          </Button>
          <Button asChild>
            <Link href="/admin/products/new">
              <PlusIcon /> Додати товар
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <ProductFilters
        filters={filters}
        onChange={setFilters}
        categories={categories}
        brands={brands}
      />

      {/* Table */}
      <DataTable
        columns={columns}
        data={products}
        pagination
        selectable
        bulkActions={[
          { label: 'Видалити', action: handleBulkDelete },
          { label: 'Активувати', action: handleBulkActivate },
          { label: 'Деактивувати', action: handleBulkDeactivate },
        ]}
      />
    </div>
  );
}
```

### Product Form

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const productSchema = z.object({
  name: z.string().min(1, 'Назва обов\'язкова'),
  sku: z.string().min(1, 'SKU обов\'язковий'),
  price: z.number().positive('Ціна має бути більше 0'),
  categoryId: z.string().min(1, 'Оберіть категорію'),
  description: z.string().optional(),
  images: z.array(z.string()).min(1, 'Додайте хоча б одне зображення'),
});

export function ProductForm({ product, onSubmit }) {
  const form = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: product || {
      name: '',
      sku: '',
      price: 0,
      categoryId: '',
      description: '',
      images: [],
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">Загальне</TabsTrigger>
            <TabsTrigger value="pricing">Ціни</TabsTrigger>
            <TabsTrigger value="inventory">Склад</TabsTrigger>
            <TabsTrigger value="attributes">Характеристики</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <div className="grid grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Назва</FormLabel>
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
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Категорія</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Оберіть категорію" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Опис</FormLabel>
                    <FormControl>
                      <RichTextEditor {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>

          <TabsContent value="pricing">
            <PricingSection form={form} />
          </TabsContent>

          <TabsContent value="inventory">
            <InventorySection form={form} />
          </TabsContent>

          <TabsContent value="attributes">
            <AttributesSection form={form} />
          </TabsContent>

          <TabsContent value="seo">
            <SEOSection form={form} />
          </TabsContent>
        </Tabs>

        {/* Images */}
        <ImageUploader
          images={form.watch('images')}
          onChange={(images) => form.setValue('images', images)}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Скасувати
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Збереження...' : 'Зберегти'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

## Управління замовленнями

### Order List

```tsx
export default function OrdersPage() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Замовлення</h1>
        <div className="flex gap-2">
          <StatusFilter />
          <DateRangePicker />
          <Button variant="outline" onClick={handleExport}>
            Експорт
          </Button>
        </div>
      </div>

      <OrderStats stats={stats} />

      <DataTable
        columns={orderColumns}
        data={orders}
        pagination
      />
    </div>
  );
}

// Order columns
const orderColumns = [
  { header: '#', accessorKey: 'orderNumber' },
  {
    header: 'Клієнт',
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.customerName}</div>
        <div className="text-sm text-gray-500">{row.customerPhone}</div>
      </div>
    ),
  },
  {
    header: 'Статус',
    cell: ({ row }) => <OrderStatusBadge status={row.status} />,
  },
  {
    header: 'Сума',
    cell: ({ row }) => formatMoney(row.total),
  },
  {
    header: 'Дата',
    cell: ({ row }) => formatDate(row.createdAt),
  },
  {
    header: 'Дії',
    cell: ({ row }) => <OrderActions order={row} />,
  },
];
```

### Order Detail

```tsx
export default function OrderDetailPage({ params }) {
  const order = await getOrder(params.id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Замовлення #{order.orderNumber}</h1>
          <p className="text-gray-500">{formatDateTime(order.createdAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} size="lg" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Order Info */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Товари</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderItemsTable items={order.items} />

            <div className="mt-4 space-y-2 text-right">
              <div>Підсумок: {formatMoney(order.subtotal)}</div>
              {order.discount > 0 && (
                <div className="text-green-600">
                  Знижка: -{formatMoney(order.discount)}
                </div>
              )}
              <div>Доставка: {formatMoney(order.shippingCost)}</div>
              <div className="text-lg font-bold">
                Всього: {formatMoney(order.total)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer & Shipping */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Клієнт</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>{order.customerName}</div>
                <div>{order.customerPhone}</div>
                <div>{order.customerEmail}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Доставка</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>{order.shippingMethod}</div>
                <div>{order.shippingAddress.city}</div>
                <div>{order.shippingAddress.warehouse}</div>
                {order.trackingNumber && (
                  <div className="font-mono">ТТН: {order.trackingNumber}</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Оплата</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>{order.paymentMethod}</div>
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Дії</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderActions order={order} />
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Історія</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderTimeline events={order.history} />
        </CardContent>
      </Card>
    </div>
  );
}
```

## Аналітика

### Sales Dashboard

```tsx
export default function SalesAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Аналітика продажів</h1>
        <DateRangePicker />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard title="Виручка" value={formatMoney(metrics.revenue)} />
        <MetricCard title="Замовлення" value={metrics.orders} />
        <MetricCard title="Середній чек" value={formatMoney(metrics.aov)} />
        <MetricCard title="Конверсія" value={`${metrics.conversion}%`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Виручка</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <RevenueChart data={chartData.revenue} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Замовлення</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <OrdersChart data={chartData.orders} />
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle>Топ товари</CardTitle>
        </CardHeader>
        <CardContent>
          <TopProductsTable products={topProducts} />
        </CardContent>
      </Card>

      {/* Sales by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Продажі по категоріях</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <CategoryPieChart data={salesByCategory} />
        </CardContent>
      </Card>
    </div>
  );
}
```

## Права доступу (RBAC)

### Roles

| Роль | Права |
|------|-------|
| `super_admin` | Повний доступ |
| `admin` | Все крім налаштувань системи |
| `manager` | Замовлення, клієнти, звіти |
| `warehouse` | Склад, інвентаризація |
| `support` | Перегляд замовлень, клієнтів |

### Middleware

```tsx
// middleware.ts
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    const session = await getSession();

    if (!session) {
      return NextResponse.redirect('/login');
    }

    // Check permissions
    const requiredPermission = getRequiredPermission(pathname);
    if (!hasPermission(session.user, requiredPermission)) {
      return NextResponse.redirect('/admin/unauthorized');
    }
  }

  return NextResponse.next();
}
```

### Permission Check

```tsx
// components/admin/PermissionGate.tsx
export function PermissionGate({
  permission,
  children,
  fallback = null,
}) {
  const { user } = useSession();

  if (!hasPermission(user, permission)) {
    return fallback;
  }

  return children;
}

// Usage
<PermissionGate permission="products.delete">
  <Button onClick={handleDelete}>Видалити</Button>
</PermissionGate>
```

## Налаштування

### Settings Page

```tsx
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Налаштування</h1>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Загальні</TabsTrigger>
          <TabsTrigger value="payments">Оплата</TabsTrigger>
          <TabsTrigger value="shipping">Доставка</TabsTrigger>
          <TabsTrigger value="notifications">Сповіщення</TabsTrigger>
          <TabsTrigger value="integrations">Інтеграції</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettings />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentSettings />
        </TabsContent>

        <TabsContent value="shipping">
          <ShippingSettings />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="integrations">
          <IntegrationSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

## Компоненти

### Sidebar Navigation

```tsx
const adminNavigation = [
  { name: 'Dashboard', href: '/admin', icon: HomeIcon },
  {
    name: 'Каталог',
    icon: CubeIcon,
    children: [
      { name: 'Товари', href: '/admin/products' },
      { name: 'Категорії', href: '/admin/categories' },
      { name: 'Бренди', href: '/admin/brands' },
      { name: 'Атрибути', href: '/admin/attributes' },
    ],
  },
  { name: 'Замовлення', href: '/admin/orders', icon: ShoppingCartIcon },
  { name: 'Клієнти', href: '/admin/customers', icon: UsersIcon },
  {
    name: 'Склад',
    icon: WarehouseIcon,
    children: [
      { name: 'Залишки', href: '/admin/warehouse/inventory' },
      { name: 'Прихід', href: '/admin/warehouse/receipts' },
      { name: 'Відвантаження', href: '/admin/warehouse/shipments' },
      { name: 'POS', href: '/admin/warehouse/pos' },
    ],
  },
  {
    name: 'Аналітика',
    icon: ChartIcon,
    children: [
      { name: 'Продажі', href: '/admin/analytics/sales' },
      { name: 'Клієнти', href: '/admin/analytics/customers' },
      { name: 'Товари', href: '/admin/analytics/products' },
    ],
  },
  {
    name: 'Маркетинг',
    icon: MegaphoneIcon,
    children: [
      { name: 'Промокоди', href: '/admin/marketing/promo' },
      { name: 'Розсилки', href: '/admin/marketing/campaigns' },
      { name: 'Банери', href: '/admin/marketing/banners' },
    ],
  },
  { name: 'Налаштування', href: '/admin/settings', icon: CogIcon },
];
```

## Гарячі клавіші

| Клавіша | Дія |
|---------|-----|
| `Ctrl+K` | Глобальний пошук |
| `Ctrl+N` | Новий товар/замовлення |
| `Ctrl+S` | Зберегти |
| `Esc` | Закрити модальне вікно |
| `?` | Показати всі гарячі клавіші |
