/**
 * Security Module
 * Comprehensive security utilities for the storefront
 */

// Rate Limiting
export {
  checkRateLimit,
  consumeRateLimit,
  recordRequest,
  getRateLimitStatus,
  resetRateLimit,
  isBlocked,
  getRateLimitHeaders,
  createRateLimitMiddleware,
  rateLimitByIP,
  rateLimitByUser,
  rateLimitByIPAndUser,
  clearRateLimits,
  startCleanup as startRateLimitCleanup,
  stopCleanup as stopRateLimitCleanup,
  RATE_LIMIT_CONFIGS,
  type RateLimitConfig,
  type RateLimitResult,
  type RateLimitType,
} from './rate-limiter';

// CSRF Protection
export {
  generateCSRFToken,
  validateCSRFToken,
  consumeCSRFToken,
  invalidateCSRFToken,
  invalidateSessionTokens,
  getCSRFTokenFromHeaders,
  getCSRFTokenFromFormData,
  createCSRFMiddleware,
  generateDoubleSubmitToken,
  validateDoubleSubmit,
  generateTokenWithMetadata,
  csrfInputField,
  requiresCSRFProtection,
  isCSRFExempted,
  clearCSRFTokens,
  startCSRFCleanup,
  stopCSRFCleanup,
  type CSRFToken,
  type CSRFValidationResult,
} from './csrf';

// Input Validation
export {
  // Common schemas
  phoneSchema,
  emailSchema,
  passwordSchema,
  simplePasswordSchema,
  nameSchema,
  uuidSchema,
  positiveIntSchema,
  quantitySchema,
  priceSchema,
  urlSchema,
  dateStringSchema,
  dateSchema,
  paginationSchema,

  // Auth schemas
  loginSchema,
  registerSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  changePasswordSchema,

  // Checkout schemas
  addressSchema,
  customerInfoSchema,
  deliveryInfoSchema,
  paymentInfoSchema,
  checkoutSchema,

  // Cart schemas
  cartItemSchema,
  addToCartSchema,
  updateCartItemSchema,
  applyCouponSchema,

  // Review schemas
  reviewSchema,
  reviewVoteSchema,
  reviewReportSchema,

  // Contact schemas
  contactFormSchema,
  supportTicketSchema,

  // Product schemas
  productSearchSchema,
  productFilterSchema,

  // Admin schemas
  adminProductSchema,
  adminOrderStatusSchema,
  adminCouponSchema,

  // Notification schemas
  stockNotificationSchema,
  priceAlertSchema,

  // Wishlist schemas
  wishlistSchema,
  wishlistItemSchema,

  // Helper functions
  validate,
  validateOrThrow,
  getFirstError,
  formatValidationErrors,

  // Types
  type LoginInput,
  type RegisterInput,
  type CheckoutInput,
  type ReviewInput,
  type ContactFormInput,
  type ProductSearchInput,
  type AdminProductInput,
  type AdminCouponInput,
} from './validation';

// Input Sanitization
export {
  escapeHtml,
  unescapeHtml,
  stripHtml,
  sanitizeHtml,
  normalizeWhitespace,
  removeControlChars,
  removeZeroWidth,
  sanitizeText,
  sanitizeForDisplay,
  escapeSql,
  sanitizeSqlInput,
  sanitizePath,
  sanitizeFilename,
  sanitizeUrl,
  sanitizeRedirectUrl,
  sanitizeJson,
  sanitizeObject,
  sanitizeReview,
  detectSpamPatterns,
  sanitizers,
} from './sanitize';
