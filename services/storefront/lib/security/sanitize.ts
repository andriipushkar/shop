/**
 * Input Sanitization
 * Protection against XSS, SQL injection, and other attacks
 */

// ==================== HTML SANITIZATION ====================

/**
 * HTML entities to escape
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(str: string): string {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"'`=/]/g, char => HTML_ENTITIES[char] || char);
}

/**
 * Unescape HTML entities
 */
export function unescapeHtml(str: string): string {
  if (typeof str !== 'string') return '';

  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '=',
    '&#39;': "'",
    '&#47;': '/',
  };

  return str.replace(/&(?:amp|lt|gt|quot|#x27|#x2F|#x60|#x3D|#39|#47);/g, entity => entities[entity] || entity);
}

/**
 * Strip all HTML tags
 */
export function stripHtml(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Allowed HTML tags for rich text (e.g., reviews)
 */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
]);

/**
 * Allowed attributes for tags
 */
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
};

/**
 * Sanitize HTML allowing only safe tags
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') return '';

  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags and their content
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove event handlers (onclick, onload, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove data: URLs (except images)
  sanitized = sanitized.replace(/data:(?!image\/)/gi, '');

  // Remove vbscript: URLs
  sanitized = sanitized.replace(/vbscript:/gi, '');

  // Process tags
  sanitized = sanitized.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tagName) => {
    const tag = tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      return '';
    }

    // For closing tags
    if (match.startsWith('</')) {
      return `</${tag}>`;
    }

    // For opening tags, check attributes
    const allowedAttrs = ALLOWED_ATTRIBUTES[tag];
    if (!allowedAttrs) {
      return `<${tag}>`;
    }

    // Extract and filter attributes
    const attrMatch = match.match(/\s+([a-z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/gi);
    if (!attrMatch) {
      return `<${tag}>`;
    }

    const safeAttrs: string[] = [];
    for (const attr of attrMatch) {
      const [name, ...valueParts] = attr.trim().split('=');
      const attrName = name.toLowerCase().trim();

      if (allowedAttrs.has(attrName)) {
        let value = valueParts.join('=').trim();
        // Remove quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        // Sanitize href/src values
        if (attrName === 'href' || attrName === 'src') {
          if (value.toLowerCase().startsWith('javascript:') ||
              value.toLowerCase().startsWith('vbscript:') ||
              value.toLowerCase().startsWith('data:')) {
            continue;
          }
        }

        safeAttrs.push(`${attrName}="${escapeHtml(value)}"`);
      }
    }

    return safeAttrs.length > 0
      ? `<${tag} ${safeAttrs.join(' ')}>`
      : `<${tag}>`;
  });

  return sanitized;
}

// ==================== TEXT SANITIZATION ====================

/**
 * Trim and normalize whitespace
 */
export function normalizeWhitespace(str: string): string {
  if (typeof str !== 'string') return '';
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Remove control characters
 */
export function removeControlChars(str: string): string {
  if (typeof str !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Remove zero-width characters
 */
export function removeZeroWidth(str: string): string {
  if (typeof str !== 'string') return '';
  return str.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '');
}

/**
 * Sanitize plain text input
 */
export function sanitizeText(str: string): string {
  if (typeof str !== 'string') return '';

  let sanitized = str;

  // Remove control characters
  sanitized = removeControlChars(sanitized);

  // Remove zero-width characters
  sanitized = removeZeroWidth(sanitized);

  // Normalize unicode
  sanitized = sanitized.normalize('NFC');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Sanitize for safe display (escape HTML)
 */
export function sanitizeForDisplay(str: string): string {
  return escapeHtml(sanitizeText(str));
}

// ==================== SQL INJECTION PREVENTION ====================

/**
 * Characters that need escaping in SQL
 */
const SQL_ESCAPE_CHARS: Record<string, string> = {
  '\0': '\\0',
  '\x08': '\\b',
  '\x09': '\\t',
  '\x1a': '\\Z',
  '\n': '\\n',
  '\r': '\\r',
  "'": "\\'",
  '"': '\\"',
  '\\': '\\\\',
  '%': '\\%',
  '_': '\\_',
};

/**
 * Escape SQL special characters
 * Note: Always use parameterized queries instead when possible
 */
export function escapeSql(str: string): string {
  if (typeof str !== 'string') return '';
  return str.replace(/[\0\x08\x09\x1a\n\r"'\\%_]/g, char => SQL_ESCAPE_CHARS[char] || char);
}

/**
 * Remove SQL injection attempts
 */
export function sanitizeSqlInput(str: string): string {
  if (typeof str !== 'string') return '';

  // Remove common SQL injection patterns
  let sanitized = str;

  // Remove SQL comments
  sanitized = sanitized.replace(/--/g, '');
  sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove semicolons (prevent multiple statements)
  sanitized = sanitized.replace(/;/g, '');

  // Remove common SQL keywords in suspicious contexts
  const sqlKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE|UNION|OR|AND)\b/gi;
  sanitized = sanitized.replace(sqlKeywords, '');

  return sanitized;
}

// ==================== PATH TRAVERSAL PREVENTION ====================

/**
 * Sanitize file path to prevent directory traversal
 */
export function sanitizePath(path: string): string {
  if (typeof path !== 'string') return '';

  let sanitized = path;

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove path traversal sequences
  sanitized = sanitized.replace(/\.\./g, '');
  sanitized = sanitized.replace(/\/\//g, '/');

  // Remove backslashes (Windows)
  sanitized = sanitized.replace(/\\/g, '/');

  // Remove leading slashes
  sanitized = sanitized.replace(/^\/+/, '');

  return sanitized;
}

/**
 * Validate filename
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== 'string') return '';

  let sanitized = filename;

  // Remove path separators
  sanitized = sanitized.replace(/[/\\]/g, '');

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove special characters
  sanitized = sanitized.replace(/[<>:"|?*]/g, '');

  // Remove control characters
  sanitized = removeControlChars(sanitized);

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop() || '';
    const name = sanitized.slice(0, 255 - ext.length - 1);
    sanitized = `${name}.${ext}`;
  }

  return sanitized;
}

// ==================== URL SANITIZATION ====================

/**
 * Sanitize URL
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') return '';

  let sanitized = url.trim();

  // Remove javascript: protocol
  if (sanitized.toLowerCase().startsWith('javascript:')) {
    return '';
  }

  // Remove data: protocol (except images)
  if (sanitized.toLowerCase().startsWith('data:') && !sanitized.toLowerCase().startsWith('data:image/')) {
    return '';
  }

  // Remove vbscript: protocol
  if (sanitized.toLowerCase().startsWith('vbscript:')) {
    return '';
  }

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  return sanitized;
}

/**
 * Validate and sanitize redirect URL (prevent open redirect)
 */
export function sanitizeRedirectUrl(url: string, allowedHosts: string[]): string | null {
  if (typeof url !== 'string') return null;

  try {
    const sanitized = sanitizeUrl(url);
    if (!sanitized) return null;

    // Allow relative URLs
    if (sanitized.startsWith('/') && !sanitized.startsWith('//')) {
      return sanitized;
    }

    // Check absolute URLs against allowed hosts
    const parsed = new URL(sanitized);
    if (allowedHosts.includes(parsed.hostname)) {
      return sanitized;
    }

    return null;
  } catch {
    // Invalid URL
    return null;
  }
}

// ==================== JSON SANITIZATION ====================

/**
 * Sanitize JSON string
 */
export function sanitizeJson(json: string): string {
  if (typeof json !== 'string') return '{}';

  // Remove BOM
  let sanitized = json.replace(/^\uFEFF/, '');

  // Remove control characters except whitespace
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  return sanitized;
}

/**
 * Deep sanitize object values
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: {
    escapeHtml?: boolean;
    trimStrings?: boolean;
    maxDepth?: number;
  } = {}
): T {
  const { escapeHtml: shouldEscapeHtml = true, trimStrings = true, maxDepth = 10 } = options;

  function sanitizeValue(value: unknown, depth: number): unknown {
    if (depth > maxDepth) return value;

    if (typeof value === 'string') {
      let sanitized = value;
      if (trimStrings) sanitized = sanitized.trim();
      if (shouldEscapeHtml) sanitized = escapeHtml(sanitized);
      return sanitized;
    }

    if (Array.isArray(value)) {
      return value.map(item => sanitizeValue(item, depth + 1));
    }

    if (value !== null && typeof value === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val, depth + 1);
      }
      return sanitized;
    }

    return value;
  }

  return sanitizeValue(obj, 0) as T;
}

// ==================== REVIEW-SPECIFIC SANITIZATION ====================

/**
 * Sanitize review content
 */
export function sanitizeReview(content: string): string {
  if (typeof content !== 'string') return '';

  let sanitized = content;

  // Basic text sanitization
  sanitized = sanitizeText(sanitized);

  // Remove excessive line breaks
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

  // Remove URLs (optional, adjust based on policy)
  // sanitized = sanitized.replace(/https?:\/\/[^\s]+/gi, '[посилання видалено]');

  // Remove phone numbers
  sanitized = sanitized.replace(/(\+?38)?0\d{9}/g, '[телефон видалено]');

  // Remove email addresses
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email видалено]');

  // Escape HTML for display
  sanitized = escapeHtml(sanitized);

  return sanitized;
}

/**
 * Check content for spam/abuse patterns
 */
export function detectSpamPatterns(content: string): {
  isSpam: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  // All caps (more than 50% uppercase)
  const uppercaseRatio = (content.match(/[A-ZА-ЯІЇЄҐ]/g) || []).length / content.length;
  if (uppercaseRatio > 0.5 && content.length > 20) {
    reasons.push('Занадто багато великих літер');
  }

  // Repeated characters
  if (/(.)\1{4,}/i.test(content)) {
    reasons.push('Повторювані символи');
  }

  // Excessive exclamation/question marks
  if (/[!?]{3,}/.test(content)) {
    reasons.push('Занадто багато знаків пунктуації');
  }

  // Common spam phrases
  const spamPhrases = [
    /безкоштовн.*грош/i,
    /заробіток.*без.*вкладень/i,
    /казино/i,
    /ставки.*спорт/i,
    /кредит.*без.*відмов/i,
  ];

  for (const pattern of spamPhrases) {
    if (pattern.test(content)) {
      reasons.push('Підозрілий контент');
      break;
    }
  }

  return {
    isSpam: reasons.length > 0,
    reasons,
  };
}

// ==================== EXPORTS ====================

export const sanitizers = {
  html: sanitizeHtml,
  text: sanitizeText,
  display: sanitizeForDisplay,
  sql: sanitizeSqlInput,
  path: sanitizePath,
  filename: sanitizeFilename,
  url: sanitizeUrl,
  redirect: sanitizeRedirectUrl,
  json: sanitizeJson,
  object: sanitizeObject,
  review: sanitizeReview,
};

export default sanitizers;
