/**
 * SMS Notifications System
 * Supports multiple Ukrainian SMS providers: Turbosms, SMS.ua, AlphaSMS
 */

// ==================== TYPES ====================

export type SmsProvider = 'turbosms' | 'smsua' | 'alphasms';

export type SmsNotificationType =
  | 'order_created'
  | 'order_confirmed'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'payment_received'
  | 'payment_failed'
  | 'delivery_attempt'
  | 'back_in_stock'
  | 'price_drop'
  | 'promo_code'
  | 'verification_code'
  | 'password_reset';

export interface SmsTemplate {
  id: string;
  type: SmsNotificationType;
  template: string;
  templateUk: string;
  variables: string[];
  maxLength: number;
  enabled: boolean;
}

export interface SmsMessage {
  id: string;
  phone: string;
  text: string;
  type: SmsNotificationType;
  status: SmsStatus;
  provider: SmsProvider;
  externalId?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  errorMessage?: string;
  cost?: number;
  orderId?: string;
  userId?: string;
}

export type SmsStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'expired'
  | 'rejected';

export interface SmsConfig {
  provider: SmsProvider;
  apiKey: string;
  sender: string;
  enabled: boolean;
  testMode: boolean;
  webhookUrl?: string;
}

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  externalId?: string;
  error?: string;
  cost?: number;
}

export interface SmsBalance {
  balance: number;
  currency: string;
  messagesLeft?: number;
}

// ==================== TEMPLATES ====================

export const SMS_TEMPLATES: SmsTemplate[] = [
  {
    id: 'order_created',
    type: 'order_created',
    template: 'Order #{orderId} created. Total: {total} UAH. Track: {trackingUrl}',
    templateUk: 'Замовлення #{orderId} створено. Сума: {total} грн. Відстежити: {trackingUrl}',
    variables: ['orderId', 'total', 'trackingUrl'],
    maxLength: 160,
    enabled: true,
  },
  {
    id: 'order_confirmed',
    type: 'order_confirmed',
    template: 'Order #{orderId} confirmed! Preparing for shipment.',
    templateUk: 'Замовлення #{orderId} підтверджено! Готуємо до відправки.',
    variables: ['orderId'],
    maxLength: 160,
    enabled: true,
  },
  {
    id: 'order_shipped',
    type: 'order_shipped',
    template: 'Order #{orderId} shipped via {carrier}. Track: {trackingNumber}',
    templateUk: 'Замовлення #{orderId} відправлено {carrier}. ТТН: {trackingNumber}',
    variables: ['orderId', 'carrier', 'trackingNumber'],
    maxLength: 160,
    enabled: true,
  },
  {
    id: 'order_delivered',
    type: 'order_delivered',
    template: 'Order #{orderId} delivered! Thank you for your purchase.',
    templateUk: 'Замовлення #{orderId} доставлено! Дякуємо за покупку.',
    variables: ['orderId'],
    maxLength: 160,
    enabled: true,
  },
  {
    id: 'order_cancelled',
    type: 'order_cancelled',
    template: 'Order #{orderId} cancelled. Refund will be processed within 3 days.',
    templateUk: 'Замовлення #{orderId} скасовано. Повернення коштів протягом 3 днів.',
    variables: ['orderId'],
    maxLength: 160,
    enabled: true,
  },
  {
    id: 'payment_received',
    type: 'payment_received',
    template: 'Payment of {amount} UAH for order #{orderId} received. Thank you!',
    templateUk: 'Оплата {amount} грн за замовлення #{orderId} отримана. Дякуємо!',
    variables: ['amount', 'orderId'],
    maxLength: 160,
    enabled: true,
  },
  {
    id: 'payment_failed',
    type: 'payment_failed',
    template: 'Payment for order #{orderId} failed. Please try again: {paymentUrl}',
    templateUk: 'Оплата замовлення #{orderId} не пройшла. Спробуйте ще раз: {paymentUrl}',
    variables: ['orderId', 'paymentUrl'],
    maxLength: 160,
    enabled: true,
  },
  {
    id: 'delivery_attempt',
    type: 'delivery_attempt',
    template: 'Delivery attempt for order #{orderId}. Contact courier: {courierPhone}',
    templateUk: 'Спроба доставки замовлення #{orderId}. Зв\'язок з кур\'єром: {courierPhone}',
    variables: ['orderId', 'courierPhone'],
    maxLength: 160,
    enabled: true,
  },
  {
    id: 'back_in_stock',
    type: 'back_in_stock',
    template: '{productName} is back in stock! Order now: {productUrl}',
    templateUk: '{productName} знову в наявності! Замовити: {productUrl}',
    variables: ['productName', 'productUrl'],
    maxLength: 160,
    enabled: true,
  },
  {
    id: 'price_drop',
    type: 'price_drop',
    template: '{productName} price dropped to {newPrice} UAH! {productUrl}',
    templateUk: 'Ціна на {productName} знижена до {newPrice} грн! {productUrl}',
    variables: ['productName', 'newPrice', 'productUrl'],
    maxLength: 160,
    enabled: true,
  },
  {
    id: 'promo_code',
    type: 'promo_code',
    template: 'Your promo code: {promoCode}. {discount}% off until {expiryDate}!',
    templateUk: 'Ваш промокод: {promoCode}. {discount}% знижки до {expiryDate}!',
    variables: ['promoCode', 'discount', 'expiryDate'],
    maxLength: 160,
    enabled: true,
  },
  {
    id: 'verification_code',
    type: 'verification_code',
    template: 'Your verification code: {code}. Valid for {minutes} minutes.',
    templateUk: 'Код підтвердження: {code}. Дійсний {minutes} хвилин.',
    variables: ['code', 'minutes'],
    maxLength: 160,
    enabled: true,
  },
  {
    id: 'password_reset',
    type: 'password_reset',
    template: 'Password reset code: {code}. If you didn\'t request this, ignore this message.',
    templateUk: 'Код скидання пароля: {code}. Якщо ви не запитували, ігноруйте.',
    variables: ['code'],
    maxLength: 160,
    enabled: true,
  },
];

// ==================== SMS SERVICE ====================

const config: SmsConfig = {
  provider: (process.env.SMS_PROVIDER as SmsProvider) || 'turbosms',
  apiKey: process.env.SMS_API_KEY || '',
  sender: process.env.SMS_SENDER || 'TechShop',
  enabled: process.env.SMS_ENABLED === 'true',
  testMode: process.env.SMS_TEST_MODE === 'true',
};

/**
 * Format phone number to Ukrainian format
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Handle different formats
  if (digits.startsWith('380')) {
    return '+' + digits;
  } else if (digits.startsWith('80')) {
    return '+3' + digits;
  } else if (digits.startsWith('0')) {
    return '+38' + digits;
  } else if (digits.length === 9) {
    return '+380' + digits;
  }

  return '+380' + digits;
}

/**
 * Validate Ukrainian phone number
 */
export function validatePhoneNumber(phone: string): boolean {
  const formatted = formatPhoneNumber(phone);
  return /^\+380\d{9}$/.test(formatted);
}

/**
 * Render SMS template with variables
 */
export function renderTemplate(
  template: SmsTemplate,
  variables: Record<string, string>,
  language: 'en' | 'uk' = 'uk'
): string {
  let text = language === 'uk' ? template.templateUk : template.template;

  Object.entries(variables).forEach(([key, value]) => {
    text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  });

  // Truncate if exceeds max length
  if (text.length > template.maxLength) {
    text = text.substring(0, template.maxLength - 3) + '...';
  }

  return text;
}

/**
 * Get template by type
 */
export function getTemplate(type: SmsNotificationType): SmsTemplate | undefined {
  return SMS_TEMPLATES.find(t => t.type === type);
}

/**
 * Send SMS via TurboSMS
 */
async function sendViaTurboSms(
  phone: string,
  text: string
): Promise<SendSmsResult> {
  try {
    const response = await fetch('https://api.turbosms.ua/message/send.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        recipients: [phone],
        sms: {
          sender: config.sender,
          text: text,
        },
      }),
    });

    const data = await response.json();

    if (data.response_code === 0) {
      return {
        success: true,
        messageId: data.response_result?.[0]?.message_id,
        externalId: data.response_result?.[0]?.response_code,
      };
    }

    return {
      success: false,
      error: data.response_status || 'Unknown error',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Send SMS via SMS.ua
 */
async function sendViaSmsUa(
  phone: string,
  text: string
): Promise<SendSmsResult> {
  try {
    const response = await fetch('https://api.sms.ua/v1/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        phone: phone,
        message: text,
        src_addr: config.sender,
      }),
    });

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        messageId: data.id,
        externalId: data.external_id,
        cost: data.cost,
      };
    }

    return {
      success: false,
      error: data.error || 'Unknown error',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Send SMS via AlphaSMS
 */
async function sendViaAlphaSms(
  phone: string,
  text: string
): Promise<SendSmsResult> {
  try {
    const response = await fetch('https://alphasms.ua/api/http.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        key: config.apiKey,
        command: 'send',
        from: config.sender,
        to: phone,
        message: text,
      }),
    });

    const data = await response.json();

    if (data.id) {
      return {
        success: true,
        messageId: data.id,
        externalId: data.id,
        cost: data.price,
      };
    }

    return {
      success: false,
      error: data.error || 'Unknown error',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Send SMS using configured provider
 */
export async function sendSms(
  phone: string,
  text: string,
  type: SmsNotificationType
): Promise<SendSmsResult> {
  if (!config.enabled) {
    console.log('[SMS] Disabled, would send:', { phone, text, type });
    return { success: true, messageId: 'test-disabled' };
  }

  if (config.testMode) {
    console.log('[SMS] Test mode, would send:', { phone, text, type });
    return { success: true, messageId: 'test-mode-' + Date.now() };
  }

  if (!validatePhoneNumber(phone)) {
    return { success: false, error: 'Invalid phone number' };
  }

  const formattedPhone = formatPhoneNumber(phone);

  switch (config.provider) {
    case 'turbosms':
      return sendViaTurboSms(formattedPhone, text);
    case 'smsua':
      return sendViaSmsUa(formattedPhone, text);
    case 'alphasms':
      return sendViaAlphaSms(formattedPhone, text);
    default:
      return { success: false, error: 'Unknown SMS provider' };
  }
}

/**
 * Send notification using template
 */
export async function sendNotification(
  phone: string,
  type: SmsNotificationType,
  variables: Record<string, string>,
  language: 'en' | 'uk' = 'uk'
): Promise<SendSmsResult> {
  const template = getTemplate(type);

  if (!template) {
    return { success: false, error: `Template not found for type: ${type}` };
  }

  if (!template.enabled) {
    return { success: false, error: `Template disabled: ${type}` };
  }

  const text = renderTemplate(template, variables, language);
  return sendSms(phone, text, type);
}

/**
 * Send order confirmation SMS
 */
export async function sendOrderConfirmation(
  phone: string,
  orderId: string,
  total: number,
  trackingUrl: string
): Promise<SendSmsResult> {
  return sendNotification(phone, 'order_created', {
    orderId,
    total: total.toLocaleString('uk-UA'),
    trackingUrl,
  });
}

/**
 * Send shipping notification SMS
 */
export async function sendShippingNotification(
  phone: string,
  orderId: string,
  carrier: string,
  trackingNumber: string
): Promise<SendSmsResult> {
  return sendNotification(phone, 'order_shipped', {
    orderId,
    carrier,
    trackingNumber,
  });
}

/**
 * Send delivery notification SMS
 */
export async function sendDeliveryNotification(
  phone: string,
  orderId: string
): Promise<SendSmsResult> {
  return sendNotification(phone, 'order_delivered', { orderId });
}

/**
 * Send back in stock notification SMS
 */
export async function sendBackInStockNotification(
  phone: string,
  productName: string,
  productUrl: string
): Promise<SendSmsResult> {
  return sendNotification(phone, 'back_in_stock', {
    productName,
    productUrl,
  });
}

/**
 * Send verification code SMS
 */
export async function sendVerificationCode(
  phone: string,
  code: string,
  minutes: number = 10
): Promise<SendSmsResult> {
  return sendNotification(phone, 'verification_code', {
    code,
    minutes: String(minutes),
  });
}

/**
 * Get SMS balance
 */
export async function getSmsBalance(): Promise<SmsBalance | null> {
  try {
    let url: string;
    let headers: Record<string, string>;

    switch (config.provider) {
      case 'turbosms':
        url = 'https://api.turbosms.ua/user/balance.json';
        headers = { 'Authorization': `Bearer ${config.apiKey}` };
        break;
      case 'smsua':
        url = 'https://api.sms.ua/v1/balance';
        headers = { 'Authorization': `Bearer ${config.apiKey}` };
        break;
      case 'alphasms':
        url = `https://alphasms.ua/api/http.php?key=${config.apiKey}&command=balance`;
        headers = {};
        break;
      default:
        return null;
    }

    const response = await fetch(url, { headers });
    const data = await response.json();

    return {
      balance: data.balance || data.response_result?.balance || 0,
      currency: 'UAH',
      messagesLeft: data.messages_left,
    };
  } catch {
    return null;
  }
}

/**
 * Get SMS status
 */
export async function getSmsStatus(messageId: string): Promise<SmsStatus> {
  try {
    let url: string;
    let headers: Record<string, string>;

    switch (config.provider) {
      case 'turbosms':
        url = `https://api.turbosms.ua/message/status.json?message_id=${messageId}`;
        headers = { 'Authorization': `Bearer ${config.apiKey}` };
        break;
      default:
        return 'pending';
    }

    const response = await fetch(url, { headers });
    const data = await response.json();

    // Map provider status to our status
    const status = data.response_result?.status || data.status;
    switch (status?.toLowerCase()) {
      case 'delivered':
        return 'delivered';
      case 'sent':
        return 'sent';
      case 'failed':
      case 'error':
        return 'failed';
      case 'expired':
        return 'expired';
      case 'rejected':
        return 'rejected';
      default:
        return 'pending';
    }
  } catch {
    return 'pending';
  }
}

// Export config for admin
export function getSmsConfig(): Omit<SmsConfig, 'apiKey'> {
  return {
    provider: config.provider,
    sender: config.sender,
    enabled: config.enabled,
    testMode: config.testMode,
    webhookUrl: config.webhookUrl,
  };
}
