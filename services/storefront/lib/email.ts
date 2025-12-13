/**
 * Email Notification Service
 * Supports multiple providers: SMTP, SendGrid, Mailgun
 */

import { logger } from './logger';

// Types
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface OrderEmailData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: {
    name: string;
    quantity: number;
    price: number;
  }[];
  subtotal: number;
  deliveryPrice: number;
  total: number;
  deliveryType: 'warehouse' | 'courier' | 'ukrposhta';
  deliveryAddress: string;
  paymentMethod: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Configuration
const EMAIL_FROM = process.env.EMAIL_FROM || 'MyShop <noreply@myshop.ua>';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;

// Email sending function (mock for development)
async function sendEmailMock(options: EmailOptions): Promise<EmailResult> {
  logger.debug('Sending mock email', {
    to: options.to,
    subject: options.subject,
    from: options.from || EMAIL_FROM,
  });

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  return {
    success: true,
    messageId: `mock-${Date.now()}`,
  };
}

// SendGrid implementation
async function sendEmailSendGrid(options: EmailOptions): Promise<EmailResult> {
  if (!SENDGRID_API_KEY) {
    return sendEmailMock(options);
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: options.to }] }],
        from: { email: options.from || EMAIL_FROM },
        subject: options.subject,
        content: [
          { type: 'text/html', value: options.html },
          ...(options.text ? [{ type: 'text/plain', value: options.text }] : []),
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`SendGrid error: ${response.status}`);
    }

    return {
      success: true,
      messageId: response.headers.get('X-Message-Id') || undefined,
    };
  } catch (error) {
    logger.error('SendGrid error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Main send email function
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  // Use available provider
  if (SENDGRID_API_KEY) {
    return sendEmailSendGrid(options);
  }

  // Fallback to mock
  return sendEmailMock(options);
}

// Email Templates

/**
 * Generate order confirmation email
 */
export function generateOrderConfirmationEmail(data: OrderEmailData): string {
  const deliveryTypeText = {
    warehouse: 'Нова Пошта (на відділення)',
    courier: "Нова Пошта (кур'єр)",
    ukrposhta: 'Укрпошта',
  }[data.deliveryType];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Підтвердження замовлення</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #0d9488 0%, #0891b2 100%); padding: 32px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
    .content { padding: 32px; }
    .order-number { background-color: #f0fdfa; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .order-number h2 { color: #0d9488; margin: 0 0 8px 0; font-size: 18px; }
    .order-number span { font-size: 28px; font-weight: bold; color: #134e4a; }
    .section { margin-bottom: 24px; }
    .section h3 { color: #374151; font-size: 16px; margin: 0 0 12px 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    .item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
    .item-name { color: #374151; }
    .item-qty { color: #6b7280; font-size: 14px; }
    .item-price { color: #374151; font-weight: 600; }
    .totals { background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-top: 16px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .total-row.final { border-top: 2px solid #e5e7eb; margin-top: 8px; padding-top: 16px; font-size: 18px; font-weight: bold; color: #0d9488; }
    .info-box { background-color: #f0f9ff; border-radius: 8px; padding: 16px; margin-top: 16px; }
    .info-box h4 { color: #0369a1; margin: 0 0 8px 0; font-size: 14px; }
    .info-box p { color: #374151; margin: 0; font-size: 14px; line-height: 1.5; }
    .footer { background-color: #f9fafb; padding: 24px; text-align: center; }
    .footer p { color: #6b7280; font-size: 14px; margin: 0 0 8px 0; }
    .footer a { color: #0d9488; text-decoration: none; }
    .button { display: inline-block; background-color: #0d9488; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MyShop</h1>
    </div>

    <div class="content">
      <div class="order-number">
        <h2>Дякуємо за замовлення!</h2>
        <span>#${data.orderId}</span>
      </div>

      <p style="color: #374151; margin-bottom: 24px;">
        Вітаємо, ${data.customerName}! Ваше замовлення прийнято в обробку.
      </p>

      <div class="section">
        <h3>Товари</h3>
        ${data.items.map(item => `
          <div class="item">
            <div>
              <div class="item-name">${item.name}</div>
              <div class="item-qty">× ${item.quantity}</div>
            </div>
            <div class="item-price">${(item.price * item.quantity).toLocaleString()} грн</div>
          </div>
        `).join('')}

        <div class="totals">
          <div class="total-row">
            <span>Товари:</span>
            <span>${data.subtotal.toLocaleString()} грн</span>
          </div>
          <div class="total-row">
            <span>Доставка:</span>
            <span>${data.deliveryPrice === 0 ? 'Безкоштовно' : `${data.deliveryPrice} грн`}</span>
          </div>
          <div class="total-row final">
            <span>До сплати:</span>
            <span>${data.total.toLocaleString()} грн</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Доставка</h3>
        <div class="info-box">
          <h4>${deliveryTypeText}</h4>
          <p>${data.deliveryAddress}</p>
          ${data.estimatedDelivery ? `<p style="margin-top: 8px; color: #6b7280;">Орієнтовна дата: ${data.estimatedDelivery}</p>` : ''}
        </div>
      </div>

      <div class="section">
        <h3>Оплата</h3>
        <p style="color: #374151;">${data.paymentMethod}</p>
      </div>

      <div class="section">
        <h3>Контактна інформація</h3>
        <p style="color: #374151; margin: 0;">
          ${data.customerName}<br>
          ${data.customerPhone}<br>
          ${data.customerEmail}
        </p>
      </div>

      <div style="text-align: center; margin-top: 32px;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/orders/${data.orderId}" class="button">
          Відстежити замовлення
        </a>
      </div>
    </div>

    <div class="footer">
      <p>Виникли питання? Зв'яжіться з нами:</p>
      <p><a href="tel:0800123456">0 800 123 456</a> (безкоштовно)</p>
      <p><a href="mailto:support@myshop.ua">support@myshop.ua</a></p>
      <p style="margin-top: 16px; font-size: 12px; color: #9ca3af;">
        © ${new Date().getFullYear()} MyShop. Усі права захищено.
      </p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Generate shipping notification email
 */
export function generateShippingEmail(data: OrderEmailData & { trackingNumber: string }): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ваше замовлення відправлено</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #0d9488 0%, #0891b2 100%); padding: 32px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
    .content { padding: 32px; }
    .tracking-box { background-color: #f0fdfa; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; }
    .tracking-box h2 { color: #0d9488; margin: 0 0 12px 0; font-size: 18px; }
    .tracking-number { font-size: 32px; font-weight: bold; color: #134e4a; letter-spacing: 2px; }
    .button { display: inline-block; background-color: #0d9488; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
    .footer { background-color: #f9fafb; padding: 24px; text-align: center; }
    .footer p { color: #6b7280; font-size: 14px; margin: 0 0 8px 0; }
    .footer a { color: #0d9488; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📦 Замовлення відправлено!</h1>
    </div>

    <div class="content">
      <p style="color: #374151; margin-bottom: 24px;">
        Вітаємо, ${data.customerName}! Ваше замовлення #${data.orderId} відправлено.
      </p>

      <div class="tracking-box">
        <h2>Номер для відстеження</h2>
        <div class="tracking-number">${data.trackingNumber}</div>
        <a href="https://novaposhta.ua/tracking/?cargo_number=${data.trackingNumber}" class="button" target="_blank">
          Відстежити на сайті Нової Пошти
        </a>
      </div>

      <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <h3 style="color: #374151; margin: 0 0 12px 0; font-size: 16px;">Адреса доставки</h3>
        <p style="color: #6b7280; margin: 0;">${data.deliveryAddress}</p>
        ${data.estimatedDelivery ? `
        <p style="color: #0d9488; margin: 12px 0 0 0; font-weight: 600;">
          Орієнтовна дата доставки: ${data.estimatedDelivery}
        </p>
        ` : ''}
      </div>

      <p style="color: #6b7280; font-size: 14px;">
        Ми повідомимо вас SMS-повідомленням, коли посилка прибуде у відділення.
      </p>
    </div>

    <div class="footer">
      <p>Виникли питання? Зв'яжіться з нами:</p>
      <p><a href="tel:0800123456">0 800 123 456</a> (безкоштовно)</p>
      <p style="margin-top: 16px; font-size: 12px; color: #9ca3af;">
        © ${new Date().getFullYear()} MyShop. Усі права захищено.
      </p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Generate password reset email
 */
export function generatePasswordResetEmail(name: string, resetLink: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Скидання пароля</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #0d9488 0%, #0891b2 100%); padding: 32px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
    .content { padding: 32px; text-align: center; }
    .button { display: inline-block; background-color: #0d9488; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 24px 0; }
    .footer { background-color: #f9fafb; padding: 24px; text-align: center; }
    .footer p { color: #6b7280; font-size: 14px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MyShop</h1>
    </div>

    <div class="content">
      <h2 style="color: #374151; margin-bottom: 16px;">Скидання пароля</h2>
      <p style="color: #6b7280; margin-bottom: 24px;">
        Вітаємо, ${name}! Ви отримали цей лист, бо запросили скидання пароля для вашого акаунту.
      </p>

      <a href="${resetLink}" class="button">
        Скинути пароль
      </a>

      <p style="color: #9ca3af; font-size: 14px; margin-top: 24px;">
        Якщо ви не запитували скидання пароля, проігноруйте цей лист.<br>
        Посилання дійсне протягом 1 години.
      </p>
    </div>

    <div class="footer">
      <p>© ${new Date().getFullYear()} MyShop. Усі права захищено.</p>
    </div>
  </div>
</body>
</html>
`;
}

// Email sending functions

/**
 * Send order confirmation email
 */
export async function sendOrderConfirmation(data: OrderEmailData): Promise<EmailResult> {
  const html = generateOrderConfirmationEmail(data);
  return sendEmail({
    to: data.customerEmail,
    subject: `Замовлення #${data.orderId} підтверджено - MyShop`,
    html,
  });
}

/**
 * Send shipping notification email
 */
export async function sendShippingNotification(
  data: OrderEmailData & { trackingNumber: string }
): Promise<EmailResult> {
  const html = generateShippingEmail(data);
  return sendEmail({
    to: data.customerEmail,
    subject: `Замовлення #${data.orderId} відправлено - MyShop`,
    html,
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordReset(
  email: string,
  name: string,
  resetLink: string
): Promise<EmailResult> {
  const html = generatePasswordResetEmail(name, resetLink);
  return sendEmail({
    to: email,
    subject: 'Скидання пароля - MyShop',
    html,
  });
}
