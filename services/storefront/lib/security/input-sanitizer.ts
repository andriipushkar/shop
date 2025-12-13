/**
 * Input Sanitizer - Санітизація вхідних даних
 * Захист від XSS, SQL Injection та інших атак через вхідні дані
 * Реалізація OWASP рекомендацій
 */

/**
 * HTML Entities для екранування
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

/**
 * Екранування HTML спецсимволів для запобігання XSS
 */
export function escapeHtml(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  return input.replace(/[&<>"'/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Видалення всіх HTML тегів
 */
export function stripHtmlTags(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  return input.replace(/<[^>]*>/g, '');
}

/**
 * Санітизація HTML з дозволом безпечних тегів
 */
export function sanitizeHtml(
  input: string,
  allowedTags: string[] = ['b', 'i', 'em', 'strong', 'a', 'p', 'br']
): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  // Видаляємо небезпечні атрибути
  let sanitized = input.replace(
    /<(\w+)([^>]*)>/gi,
    (match, tagName, attributes) => {
      const tag = tagName.toLowerCase();

      // Перевіряємо чи тег дозволений
      if (!allowedTags.includes(tag)) {
        return '';
      }

      // Для посилань дозволяємо тільки href
      if (tag === 'a') {
        const hrefMatch = attributes.match(/href=["']([^"']*)["']/i);
        if (hrefMatch) {
          const href = sanitizeUrl(hrefMatch[1]);
          return `<a href="${href}" rel="noopener noreferrer">`;
        }
        return '<a>';
      }

      // Для інших тегів не дозволяємо атрибути
      return `<${tag}>`;
    }
  );

  // Видаляємо script та style теги повністю з вмістом
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Видаляємо event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

  return sanitized;
}

/**
 * Санітизація URL
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') {
    return '';
  }

  const trimmedUrl = url.trim();

  // Забороняємо javascript: та data: протоколи
  if (/^(javascript|data|vbscript):/i.test(trimmedUrl)) {
    return '';
  }

  // Дозволяємо тільки безпечні протоколи
  const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
  const hasProtocol = /^[a-z]+:/i.test(trimmedUrl);

  if (hasProtocol) {
    const protocol = trimmedUrl.split(':')[0].toLowerCase() + ':';
    if (!allowedProtocols.includes(protocol)) {
      return '';
    }
  }

  return trimmedUrl;
}

/**
 * Валідація email
 */
export function sanitizeEmail(email: string): string | null {
  if (typeof email !== 'string') {
    return null;
  }

  const trimmed = email.trim().toLowerCase();

  // Базова regex для email
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

  if (!emailRegex.test(trimmed)) {
    return null;
  }

  // Перевірка на довжину
  if (trimmed.length > 254) {
    return null;
  }

  const [localPart, domain] = trimmed.split('@');

  // Перевірка локальної частини
  if (localPart.length > 64) {
    return null;
  }

  // Перевірка на послідовні крапки (..не дозволено в email)
  if (localPart.includes('..') || domain.includes('..')) {
    return null;
  }

  // Перевірка домену
  if (domain.length > 253) {
    return null;
  }

  return trimmed;
}

/**
 * Санітизація номера телефону (український формат)
 */
export function sanitizePhoneNumber(phone: string): string | null {
  if (typeof phone !== 'string') {
    return null;
  }

  // Видаляємо всі символи окрім цифр та +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // Український формат: +380XXXXXXXXX
  const ukrainianRegex = /^\+?380\d{9}$/;
  const shortRegex = /^0\d{9}$/;

  if (ukrainianRegex.test(cleaned)) {
    return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
  }

  if (shortRegex.test(cleaned)) {
    return '+38' + cleaned;
  }

  return null;
}

/**
 * Санітизація імені користувача
 */
export function sanitizeUsername(username: string): string | null {
  if (typeof username !== 'string') {
    return null;
  }

  const trimmed = username.trim();

  // Дозволяємо тільки букви, цифри, дефіс та підкреслення
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;

  if (!usernameRegex.test(trimmed)) {
    return null;
  }

  // Перевірка довжини
  if (trimmed.length < 3 || trimmed.length > 30) {
    return null;
  }

  return trimmed;
}

/**
 * Санітизація тексту з українськими символами
 */
export function sanitizeUkrainianText(text: string): string {
  if (typeof text !== 'string') {
    return '';
  }

  // Дозволяємо українські букви, латиницю, цифри та базову пунктуацію
  return text
    .replace(/[^\u0400-\u04FFa-zA-Z0-9\s.,!?:;()\-'"]/g, '')
    .trim();
}

/**
 * Санітизація SQL - базовий захист (краще використовувати prepared statements)
 */
export function sanitizeSqlInput(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  // Видаляємо небезпечні SQL символи та ключові слова
  let sanitized = input
    .replace(/['";\\]/g, '') // Видаляємо лапки та слеші
    .replace(/--/g, '') // Видаляємо SQL коментарі
    .replace(/\/\*/g, '') // Видаляємо блокові коментарі
    .replace(/\*\//g, '');

  // Видаляємо SQL ключові слова
  const sqlKeywords = [
    'DROP',
    'DELETE',
    'INSERT',
    'UPDATE',
    'SELECT',
    'UNION',
    'CREATE',
    'ALTER',
    'EXEC',
    'EXECUTE',
    'SCRIPT',
  ];

  sqlKeywords.forEach((keyword) => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    sanitized = sanitized.replace(regex, '');
  });

  return sanitized.trim();
}

/**
 * Санітизація шляху файлу (запобігання path traversal)
 */
export function sanitizeFilePath(path: string): string | null {
  if (typeof path !== 'string') {
    return null;
  }

  // Забороняємо parent directory traversal
  if (path.includes('..') || path.includes('~')) {
    return null;
  }

  // Забороняємо абсолютні шляхи
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
    return null;
  }

  // Дозволяємо тільки безпечні символи
  const safePathRegex = /^[a-zA-Z0-9_\-./]+$/;
  if (!safePathRegex.test(path)) {
    return null;
  }

  return path;
}

/**
 * Санітизація JSON вводу
 */
export function sanitizeJson<T = any>(input: string, maxDepth: number = 10): T | null {
  if (typeof input !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(input);

    // Перевірка глибини об'єкта (захист від DoS)
    function checkDepth(obj: any, depth: number = 0): boolean {
      if (depth > maxDepth) {
        return false;
      }

      if (obj && typeof obj === 'object') {
        for (const key in obj) {
          if (!checkDepth(obj[key], depth + 1)) {
            return false;
          }
        }
      }

      return true;
    }

    if (!checkDepth(parsed)) {
      return null;
    }

    return parsed as T;
  } catch {
    return null;
  }
}

/**
 * Санітизація числового вводу
 */
export function sanitizeNumber(
  input: string | number,
  options?: {
    min?: number;
    max?: number;
    integer?: boolean;
  }
): number | null {
  const num = typeof input === 'string' ? parseFloat(input) : input;

  if (isNaN(num) || !isFinite(num)) {
    return null;
  }

  // Перевірка чи ціле число
  if (options?.integer && !Number.isInteger(num)) {
    return null;
  }

  // Перевірка меж
  if (options?.min !== undefined && num < options.min) {
    return null;
  }

  if (options?.max !== undefined && num > options.max) {
    return null;
  }

  return num;
}

/**
 * Санітизація ID (UUID або число)
 */
export function sanitizeId(id: string | number): string | null {
  if (typeof id === 'number') {
    return id > 0 ? String(id) : null;
  }

  if (typeof id !== 'string') {
    return null;
  }

  const trimmed = id.trim();

  // UUID формат
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  // Числовий ID
  const numId = parseInt(trimmed, 10);
  if (!isNaN(numId) && numId > 0) {
    return String(numId);
  }

  return null;
}

/**
 * Санітизація масиву значень
 */
export function sanitizeArray<T>(
  input: any[],
  sanitizer: (item: any) => T | null,
  maxLength: number = 1000
): T[] {
  if (!Array.isArray(input)) {
    return [];
  }

  if (input.length > maxLength) {
    return [];
  }

  return input
    .map(sanitizer)
    .filter((item): item is T => item !== null);
}

/**
 * Комплексна санітизація об'єкту
 */
export function sanitizeObject<T extends Record<string, any>>(
  input: any,
  schema: Record<keyof T, (value: any) => any | null>
): Partial<T> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  const sanitized: Partial<T> = {};

  for (const key in schema) {
    if (key in input) {
      const value = schema[key](input[key]);
      if (value !== null) {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

/**
 * Захист від ReDoS (Regular Expression Denial of Service)
 */
export function isSafeForRegex(pattern: string, maxLength: number = 100): boolean {
  if (pattern.length > maxLength) {
    return false;
  }

  // Перевірка на небезпечні патерни
  const dangerousPatterns = [
    /(\.\*){2,}/, // Множинні .*
    /(\.\+){2,}/, // Множинні .+
    /(\[.*\]){2,}\+/, // Вкладені класи символів з +
    /\([^)]*\)\+\([^)]*\)\+/, // Множинні групи з +
  ];

  return !dangerousPatterns.some((regex) => regex.test(pattern));
}

/**
 * Видалення невидимих та контрольних символів
 */
export function removeInvisibleChars(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Видаляємо контрольні символи, залишаємо тільки переноси рядків та табуляцію
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
}

/**
 * Обмеження довжини рядка
 */
export function truncateString(input: string, maxLength: number, suffix: string = '...'): string {
  if (typeof input !== 'string') {
    return '';
  }

  if (input.length <= maxLength) {
    return input;
  }

  return input.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Middleware для санітизації всіх string полів в об'єкті
 */
export function sanitizeAllStrings(obj: any, deep: boolean = true): any {
  if (typeof obj === 'string') {
    return escapeHtml(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeAllStrings(item, deep));
  }

  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (deep) {
        sanitized[key] = sanitizeAllStrings(obj[key], deep);
      } else {
        sanitized[key] = typeof obj[key] === 'string' ? escapeHtml(obj[key]) : obj[key];
      }
    }
    return sanitized;
  }

  return obj;
}
