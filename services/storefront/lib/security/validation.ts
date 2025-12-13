/**
 * Input Validation with Zod Schemas
 * Comprehensive validation for all API inputs
 */

import { z } from 'zod';

// ==================== COMMON SCHEMAS ====================

/**
 * Ukrainian phone number validation
 */
export const phoneSchema = z
  .string()
  .min(1, 'Телефон обов\'язковий')
  .transform(val => val.replace(/[\s\-\(\)]/g, ''))
  .refine(
    val => /^(\+?38)?0\d{9}$/.test(val) || /^\+380\d{9}$/.test(val),
    'Невірний формат телефону'
  );

/**
 * Email validation
 */
export const emailSchema = z
  .string()
  .min(1, 'Email обов\'язковий')
  .email('Невірний формат email')
  .max(255, 'Email занадто довгий');

/**
 * Password validation
 */
export const passwordSchema = z
  .string()
  .min(8, 'Пароль має бути мінімум 8 символів')
  .max(128, 'Пароль занадто довгий')
  .regex(/[A-Z]/, 'Пароль має містити велику літеру')
  .regex(/[a-z]/, 'Пароль має містити малу літеру')
  .regex(/[0-9]/, 'Пароль має містити цифру');

/**
 * Simple password (for guest checkout)
 */
export const simplePasswordSchema = z
  .string()
  .min(6, 'Пароль має бути мінімум 6 символів')
  .max(128, 'Пароль занадто довгий');

/**
 * Name validation (Ukrainian/English)
 */
export const nameSchema = z
  .string()
  .min(2, 'Ім\'я має бути мінімум 2 символи')
  .max(100, 'Ім\'я занадто довге')
  .regex(/^[a-zA-Zа-яА-ЯіїєґІЇЄҐ'\-\s]+$/, 'Ім\'я містить недопустимі символи');

/**
 * UUID validation
 */
export const uuidSchema = z.string().uuid('Невірний формат ID');

/**
 * Positive integer validation
 */
export const positiveIntSchema = z
  .number()
  .int('Має бути цілим числом')
  .positive('Має бути більше 0');

/**
 * Non-negative integer (for quantities)
 */
export const quantitySchema = z
  .number()
  .int('Має бути цілим числом')
  .min(0, 'Не може бути від\'ємним')
  .max(9999, 'Занадто велика кількість');

/**
 * Price validation (in kopecks or whole units)
 */
export const priceSchema = z
  .number()
  .min(0, 'Ціна не може бути від\'ємною')
  .max(100000000, 'Ціна занадто велика');

/**
 * URL validation
 */
export const urlSchema = z
  .string()
  .url('Невірний формат URL')
  .max(2048, 'URL занадто довгий');

/**
 * Date string validation
 */
export const dateStringSchema = z.string().datetime('Невірний формат дати');

/**
 * Date validation (accepts string or Date)
 */
export const dateSchema = z.coerce.date();

// ==================== AUTH SCHEMAS ====================

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Пароль обов\'язковий'),
  rememberMe: z.boolean().optional().default(false),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema.optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'Необхідно прийняти умови використання' }),
  }),
  subscribeNewsletter: z.boolean().optional().default(false),
});

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export const passwordResetSchema = z.object({
  token: z.string().min(1, 'Токен обов\'язковий'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Паролі не співпадають',
  path: ['confirmPassword'],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Поточний пароль обов\'язковий'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Паролі не співпадають',
  path: ['confirmPassword'],
});

// ==================== CHECKOUT SCHEMAS ====================

export const addressSchema = z.object({
  street: z.string().min(1, 'Вулиця обов\'язкова').max(200),
  building: z.string().min(1, 'Номер будинку обов\'язковий').max(20),
  apartment: z.string().max(20).optional(),
  floor: z.string().max(10).optional(),
  entrance: z.string().max(10).optional(),
  cityRef: z.string().min(1, 'Місто обов\'язкове'),
  cityName: z.string().min(1, 'Назва міста обов\'язкова'),
  postalCode: z.string().max(10).optional(),
  isDefault: z.boolean().optional().default(false),
});

export const customerInfoSchema = z.object({
  email: emailSchema,
  phone: phoneSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  middleName: nameSchema.optional(),
});

export const deliveryInfoSchema = z.object({
  method: z.enum([
    'nova_poshta_warehouse',
    'nova_poshta_postomat',
    'nova_poshta_courier',
    'meest_warehouse',
    'meest_courier',
    'justin_warehouse',
    'ukrposhta',
    'pickup',
  ], { errorMap: () => ({ message: 'Виберіть спосіб доставки' }) }),
  cityRef: z.string().min(1, 'Виберіть місто'),
  cityName: z.string().min(1),
  warehouseRef: z.string().optional(),
  warehouseName: z.string().optional(),
  address: addressSchema.optional(),
  timeSlot: z.string().optional(),
  comment: z.string().max(500, 'Коментар занадто довгий').optional(),
});

export const paymentInfoSchema = z.object({
  method: z.enum([
    'card',
    'cash',
    'liqpay',
    'monobank',
    'privat24',
    'installment',
    'apple_pay',
    'google_pay',
  ], { errorMap: () => ({ message: 'Виберіть спосіб оплати' }) }),
  installmentMonths: z.number().int().min(2).max(24).optional(),
  saveCard: z.boolean().optional(),
});

export const checkoutSchema = z.object({
  customer: customerInfoSchema,
  delivery: deliveryInfoSchema,
  payment: paymentInfoSchema,
  couponCode: z.string().max(50).optional(),
  useLoyaltyPoints: z.number().int().min(0).optional(),
  comment: z.string().max(1000, 'Коментар занадто довгий').optional(),
  giftWrap: z.boolean().optional(),
  giftMessage: z.string().max(500).optional(),
});

// ==================== CART SCHEMAS ====================

export const cartItemSchema = z.object({
  productId: z.string().min(1, 'ID товару обов\'язковий'),
  quantity: quantitySchema.min(1, 'Кількість має бути більше 0'),
  variantId: z.string().optional(),
});

export const addToCartSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(100).default(1),
  variantId: z.string().optional(),
});

export const updateCartItemSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(0).max(100),
});

export const applyCouponSchema = z.object({
  code: z.string().min(1, 'Введіть промокод').max(50),
});

// ==================== REVIEW SCHEMAS ====================

export const reviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1, 'Мінімальна оцінка 1').max(5, 'Максимальна оцінка 5'),
  title: z.string().min(3, 'Заголовок занадто короткий').max(200, 'Заголовок занадто довгий'),
  content: z.string().min(10, 'Відгук занадто короткий').max(5000, 'Відгук занадто довгий'),
  pros: z.string().max(1000).optional(),
  cons: z.string().max(1000).optional(),
  recommended: z.boolean().optional(),
  anonymous: z.boolean().optional().default(false),
});

export const reviewVoteSchema = z.object({
  reviewId: z.string().min(1),
  helpful: z.boolean(),
});

export const reviewReportSchema = z.object({
  reviewId: z.string().min(1),
  reason: z.enum(['spam', 'offensive', 'fake', 'irrelevant', 'other']),
  details: z.string().max(500).optional(),
});

// ==================== CONTACT SCHEMAS ====================

export const contactFormSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional(),
  subject: z.string().min(3, 'Тема занадто коротка').max(200, 'Тема занадто довга'),
  message: z.string().min(10, 'Повідомлення занадто коротке').max(5000, 'Повідомлення занадто довге'),
  orderNumber: z.string().max(50).optional(),
});

export const supportTicketSchema = z.object({
  subject: z.string().min(3).max(200),
  category: z.enum(['order', 'payment', 'delivery', 'return', 'product', 'technical', 'other']),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  message: z.string().min(10).max(5000),
  orderId: z.string().optional(),
  attachments: z.array(z.string().url()).max(5).optional(),
});

// ==================== PRODUCT SCHEMAS ====================

export const productSearchSchema = z.object({
  query: z.string().max(200),
  categoryId: z.string().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  brands: z.array(z.string()).optional(),
  attributes: z.record(z.array(z.string())).optional(),
  inStock: z.boolean().optional(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'newest', 'popular', 'rating']).optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export const productFilterSchema = z.object({
  categoryId: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  brands: z.string().transform(s => s.split(',')).optional(),
  inStock: z.coerce.boolean().optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest', 'popular', 'rating']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ==================== ADMIN SCHEMAS ====================

export const adminProductSchema = z.object({
  name: z.string().min(1).max(500),
  nameUk: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  descriptionUk: z.string().max(10000).optional(),
  sku: z.string().min(1).max(100),
  price: priceSchema,
  comparePrice: priceSchema.optional(),
  costPrice: priceSchema.optional(),
  categoryId: z.string().min(1),
  brandId: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional().default('draft'),
  stock: quantitySchema.optional().default(0),
  weight: z.number().min(0).optional(),
  dimensions: z.object({
    length: z.number().min(0).optional(),
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional(),
  }).optional(),
  images: z.array(z.string().url()).max(20).optional(),
  attributes: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional(),
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(500).optional(),
});

export const adminOrderStatusSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  trackingNumber: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
  notifyCustomer: z.boolean().optional().default(true),
});

export const adminCouponSchema = z.object({
  code: z.string().min(3).max(50).regex(/^[A-Z0-9_-]+$/i, 'Код може містити лише букви, цифри, _ та -'),
  name: z.string().min(1).max(200),
  type: z.enum(['percent', 'fixed', 'free_shipping', 'buy_x_get_y', 'bundle', 'cashback']),
  value: z.number().min(0),
  minOrderAmount: z.number().min(0).optional(),
  maxDiscount: z.number().min(0).optional(),
  usageLimit: z.number().int().min(0).optional(),
  perUserLimit: z.number().int().min(0).optional(),
  startDate: dateSchema,
  endDate: dateSchema,
  isActive: z.boolean().optional().default(true),
  appliedCategories: z.array(z.string()).optional(),
  appliedProducts: z.array(z.string()).optional(),
  excludedCategories: z.array(z.string()).optional(),
  excludedProducts: z.array(z.string()).optional(),
});

// ==================== NOTIFICATION SCHEMAS ====================

export const stockNotificationSchema = z.object({
  productId: z.string().min(1),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  notifyVia: z.array(z.enum(['email', 'sms', 'push'])).min(1, 'Виберіть спосіб сповіщення'),
}).refine(
  data => data.email || data.phone,
  { message: 'Вкажіть email або телефон' }
);

export const priceAlertSchema = z.object({
  productId: z.string().min(1),
  targetPrice: z.number().min(0).optional(),
  alertType: z.enum(['any_drop', 'target_price', 'percentage_drop']),
  percentageDrop: z.number().min(1).max(90).optional(),
  notifyVia: z.array(z.enum(['email', 'sms', 'push'])).min(1),
});

// ==================== WISHLIST SCHEMAS ====================

export const wishlistSchema = z.object({
  name: z.string().min(1, 'Назва обов\'язкова').max(100),
  isPublic: z.boolean().optional().default(false),
  description: z.string().max(500).optional(),
});

export const wishlistItemSchema = z.object({
  wishlistId: z.string().min(1),
  productId: z.string().min(1),
  note: z.string().max(500).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});

// ==================== PAGINATION SCHEMA ====================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Validate data with schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: true;
  data: T;
} | {
  success: false;
  errors: Record<string, string[]>;
} {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string[]> = {};
  for (const error of result.error.errors) {
    const path = error.path.join('.');
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(error.message);
  }

  return { success: false, errors };
}

/**
 * Validate and throw on error
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Get first error message
 */
export function getFirstError(errors: Record<string, string[]>): string {
  const firstKey = Object.keys(errors)[0];
  return firstKey ? errors[firstKey][0] : 'Помилка валідації';
}

/**
 * Format validation errors for API response
 */
export function formatValidationErrors(errors: Record<string, string[]>): {
  message: string;
  errors: { field: string; messages: string[] }[];
} {
  return {
    message: 'Помилка валідації',
    errors: Object.entries(errors).map(([field, messages]) => ({
      field,
      messages,
    })),
  };
}

// Export types
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type ContactFormInput = z.infer<typeof contactFormSchema>;
export type ProductSearchInput = z.infer<typeof productSearchSchema>;
export type AdminProductInput = z.infer<typeof adminProductSchema>;
export type AdminCouponInput = z.infer<typeof adminCouponSchema>;
