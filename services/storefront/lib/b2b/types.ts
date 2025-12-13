/**
 * B2B System Types
 * Типи для системи оптової торгівлі
 */

export type PriceTier = 'retail' | 'wholesale_small' | 'wholesale_medium' | 'wholesale_large' | 'partner' | 'distributor';

export interface PriceConfig {
  tier: PriceTier;
  name: string;
  nameUk: string;
  minOrderValue: number; // Мінімальна сума замовлення
  minQuantity: number; // Мінімальна кількість товару
  discountPercent: number; // Базова знижка від роздрібної ціни
}

export interface ProductPrice {
  productId: string;
  retail: number;
  wholesale_small?: number;
  wholesale_medium?: number;
  wholesale_large?: number;
  partner?: number;
  distributor?: number;
  customPrices?: Map<string, number>; // partnerId -> price
}

export interface CustomerPricing {
  customerId: string;
  tier: PriceTier;
  customDiscounts?: CategoryDiscount[];
  individualPrices?: Map<string, number>; // productId -> price
}

export interface CategoryDiscount {
  categoryId: string;
  discountPercent: number;
}

export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  basePrice: number;
}

export interface B2BCartTotal {
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  taxAmount: number;
  total: number;
  items: B2BCartItem[];
}

export interface B2BCartItem extends CartItem {
  customerPrice: number;
  lineTotal: number;
  appliedDiscount?: number;
}

export interface CreditAccount {
  customerId: string;
  creditLimit: number; // Кредитний ліміт
  usedCredit: number; // Використаний кредит
  availableCredit: number; // Доступний кредит
  paymentTermDays: number; // Термін оплати (днів)
  overdueDays: number; // Прострочені дні
  isBlocked: boolean; // Заблоковано за прострочення
}

export interface CreditTransaction {
  id: string;
  customerId: string;
  type: 'order' | 'payment' | 'adjustment';
  amount: number;
  orderId?: string;
  paymentId?: string;
  description: string;
  createdAt: Date;
  dueDate?: Date;
}

export interface Invoice {
  id: string;
  customerId: string;
  orderId: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: Date;
  isOverdue: boolean;
  createdAt: Date;
}

export interface PriceListConfig {
  customerId: string;
  format: 'xlsx' | 'csv' | 'xml' | 'yml'; // YML for marketplaces
  includeImages: boolean;
  includeStock: boolean;
  categories?: string[]; // Filter by categories
  minStock?: number;
}

export interface PriceListProduct {
  sku: string;
  name: string;
  nameUk?: string;
  description?: string;
  descriptionUk?: string;
  category: string;
  categoryUk?: string;
  brand: string;
  price: number;
  oldPrice?: number;
  stock: number;
  imageUrl?: string;
  barcode?: string;
  weight?: number;
  dimensions?: { length: number; width: number; height: number };
}

export interface ShopInfo {
  name: string;
  company: string;
  url: string;
  currencies: string[];
}

export interface B2BCustomer {
  id: string;
  companyName: string;
  companyNameUk?: string;
  taxId: string; // ЄДРПОУ / ІПН
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  tier: PriceTier;
  creditLimit: number;
  paymentTermDays: number;
  managerId?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface B2BOrder {
  id: string;
  customerId: string;
  orderNumber: string;
  items: B2BCartItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  paymentMethod: 'credit' | 'prepaid' | 'cash_on_delivery';
  deliveryAddress: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuickOrderRow {
  id: string;
  sku: string;
  productId?: string;
  name?: string;
  price?: number;
  quantity: number;
  total?: number;
  error?: string;
}
