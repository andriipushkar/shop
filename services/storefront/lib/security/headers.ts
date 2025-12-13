/**
 * Security Headers Configuration - Конфігурація безпекових заголовків
 * Реалізація OWASP рекомендацій для захисту веб-додатків
 */

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: ContentSecurityPolicyConfig;
  strictTransportSecurity?: StrictTransportSecurityConfig;
  permissionsPolicy?: PermissionsPolicyConfig;
  frameOptions?: 'DENY' | 'SAMEORIGIN';
  contentTypeOptions?: boolean;
  referrerPolicy?: ReferrerPolicyValue;
  crossOriginEmbedderPolicy?: 'require-corp' | 'credentialless';
  crossOriginOpenerPolicy?: 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none';
  crossOriginResourcePolicy?: 'same-site' | 'same-origin' | 'cross-origin';
}

export type ReferrerPolicyValue =
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url';

export interface ContentSecurityPolicyConfig {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  fontSrc?: string[];
  connectSrc?: string[];
  mediaSrc?: string[];
  objectSrc?: string[];
  frameSrc?: string[];
  baseUri?: string[];
  formAction?: string[];
  frameAncestors?: string[];
  upgradeInsecureRequests?: boolean;
  blockAllMixedContent?: boolean;
  reportUri?: string;
  reportTo?: string;
}

export interface StrictTransportSecurityConfig {
  maxAge?: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}

export interface PermissionsPolicyConfig {
  camera?: string[];
  microphone?: string[];
  geolocation?: string[];
  payment?: string[];
  usb?: string[];
  magnetometer?: string[];
  gyroscope?: string[];
  accelerometer?: string[];
  ambientLightSensor?: string[];
  autoplay?: string[];
  displayCapture?: string[];
  fullscreen?: string[];
  midi?: string[];
  syncXhr?: string[];
}

/**
 * Default CSP configuration for production
 * Дефолтна CSP конфігурація для production
 */
export const DEFAULT_CSP: ContentSecurityPolicyConfig = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "'unsafe-eval'", // Потрібно для Next.js dev mode
    "'unsafe-inline'", // Розглянути видалення в production з nonce
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://cdn.jsdelivr.net', // Для CDN бібліотек
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'", // Потрібно для динамічних стилів
    'https://fonts.googleapis.com',
  ],
  fontSrc: [
    "'self'",
    'https://fonts.gstatic.com',
    'data:',
  ],
  imgSrc: [
    "'self'",
    'data:',
    'blob:',
    'https:',
    'https://*.rozetka.com.ua',
    'https://*.prom.ua',
    'https://images.unsplash.com',
  ],
  connectSrc: [
    "'self'",
    'https://www.google-analytics.com',
    'https://api.monobank.ua',
    'https://api.liqpay.ua',
    'https://www.liqpay.ua',
    'https://api.novaposhta.ua',
    'https://api.privatbank.ua',
  ],
  mediaSrc: ["'self'"],
  objectSrc: ["'none'"],
  frameSrc: [
    "'self'",
    'https://www.liqpay.ua',
    'https://checkout.monobank.ua',
  ],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  upgradeInsecureRequests: true,
  blockAllMixedContent: true,
};

/**
 * Development CSP - більш дозвільна для dev режиму
 */
export const DEV_CSP: ContentSecurityPolicyConfig = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
  imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
  connectSrc: ["'self'", 'ws:', 'wss:', 'https:'],
  mediaSrc: ["'self'"],
  objectSrc: ["'none'"],
  frameSrc: ["'self'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
};

/**
 * Default HSTS configuration
 */
export const DEFAULT_HSTS: StrictTransportSecurityConfig = {
  maxAge: 31536000, // 1 рік
  includeSubDomains: true,
  preload: true,
};

/**
 * Default Permissions Policy
 */
export const DEFAULT_PERMISSIONS_POLICY: PermissionsPolicyConfig = {
  camera: [],
  microphone: [],
  geolocation: ['self'],
  payment: ['self'],
  usb: [],
  magnetometer: [],
  gyroscope: [],
  accelerometer: [],
  ambientLightSensor: [],
  autoplay: ['self'],
  displayCapture: [],
  fullscreen: ['self'],
  midi: [],
  syncXhr: [],
};

/**
 * Build CSP header value from config
 */
export function buildCSPHeader(config: ContentSecurityPolicyConfig): string {
  const directives: string[] = [];

  // Helper для форматування директиви
  const addDirective = (name: string, values?: string[]) => {
    if (values && values.length > 0) {
      directives.push(`${name} ${values.join(' ')}`);
    }
  };

  addDirective('default-src', config.defaultSrc);
  addDirective('script-src', config.scriptSrc);
  addDirective('style-src', config.styleSrc);
  addDirective('img-src', config.imgSrc);
  addDirective('font-src', config.fontSrc);
  addDirective('connect-src', config.connectSrc);
  addDirective('media-src', config.mediaSrc);
  addDirective('object-src', config.objectSrc);
  addDirective('frame-src', config.frameSrc);
  addDirective('base-uri', config.baseUri);
  addDirective('form-action', config.formAction);
  addDirective('frame-ancestors', config.frameAncestors);

  if (config.upgradeInsecureRequests) {
    directives.push('upgrade-insecure-requests');
  }

  if (config.blockAllMixedContent) {
    directives.push('block-all-mixed-content');
  }

  if (config.reportUri) {
    directives.push(`report-uri ${config.reportUri}`);
  }

  if (config.reportTo) {
    directives.push(`report-to ${config.reportTo}`);
  }

  return directives.join('; ');
}

/**
 * Build HSTS header value
 */
export function buildHSTSHeader(config: StrictTransportSecurityConfig): string {
  const parts: string[] = [`max-age=${config.maxAge ?? DEFAULT_HSTS.maxAge}`];

  if (config.includeSubDomains) {
    parts.push('includeSubDomains');
  }

  if (config.preload) {
    parts.push('preload');
  }

  return parts.join('; ');
}

/**
 * Build Permissions Policy header value
 */
export function buildPermissionsPolicyHeader(config: PermissionsPolicyConfig): string {
  const policies: string[] = [];

  // Helper для форматування політики
  const addPolicy = (name: string, values?: string[]) => {
    if (values !== undefined) {
      if (values.length === 0) {
        policies.push(`${name}=()`);
      } else {
        const formattedValues = values.map(v => v === 'self' ? 'self' : `"${v}"`).join(' ');
        policies.push(`${name}=(${formattedValues})`);
      }
    }
  };

  addPolicy('camera', config.camera);
  addPolicy('microphone', config.microphone);
  addPolicy('geolocation', config.geolocation);
  addPolicy('payment', config.payment);
  addPolicy('usb', config.usb);
  addPolicy('magnetometer', config.magnetometer);
  addPolicy('gyroscope', config.gyroscope);
  addPolicy('accelerometer', config.accelerometer);
  addPolicy('ambient-light-sensor', config.ambientLightSensor);
  addPolicy('autoplay', config.autoplay);
  addPolicy('display-capture', config.displayCapture);
  addPolicy('fullscreen', config.fullscreen);
  addPolicy('midi', config.midi);
  addPolicy('sync-xhr', config.syncXhr);

  return policies.join(', ');
}

/**
 * Get all security headers
 */
export function getSecurityHeaders(config?: SecurityHeadersConfig): Record<string, string> {
  const isDev = process.env.NODE_ENV === 'development';
  const headers: Record<string, string> = {};

  // Content Security Policy
  const cspConfig = config?.contentSecurityPolicy ?? (isDev ? DEV_CSP : DEFAULT_CSP);
  headers['Content-Security-Policy'] = buildCSPHeader(cspConfig);

  // Strict Transport Security (тільки в production і HTTPS)
  if (!isDev && process.env.NODE_ENV === 'production') {
    const hstsConfig = config?.strictTransportSecurity ?? DEFAULT_HSTS;
    headers['Strict-Transport-Security'] = buildHSTSHeader(hstsConfig);
  }

  // X-Frame-Options
  headers['X-Frame-Options'] = config?.frameOptions ?? 'DENY';

  // X-Content-Type-Options
  if (config?.contentTypeOptions !== false) {
    headers['X-Content-Type-Options'] = 'nosniff';
  }

  // Referrer-Policy
  headers['Referrer-Policy'] = config?.referrerPolicy ?? 'strict-origin-when-cross-origin';

  // Permissions-Policy
  const permissionsConfig = config?.permissionsPolicy ?? DEFAULT_PERMISSIONS_POLICY;
  headers['Permissions-Policy'] = buildPermissionsPolicyHeader(permissionsConfig);

  // Cross-Origin-Embedder-Policy
  if (config?.crossOriginEmbedderPolicy) {
    headers['Cross-Origin-Embedder-Policy'] = config.crossOriginEmbedderPolicy;
  }

  // Cross-Origin-Opener-Policy
  if (config?.crossOriginOpenerPolicy) {
    headers['Cross-Origin-Opener-Policy'] = config.crossOriginOpenerPolicy;
  }

  // Cross-Origin-Resource-Policy
  if (config?.crossOriginResourcePolicy) {
    headers['Cross-Origin-Resource-Policy'] = config.crossOriginResourcePolicy;
  }

  // X-DNS-Prefetch-Control
  headers['X-DNS-Prefetch-Control'] = 'on';

  // X-XSS-Protection (застарілий, але для сумісності)
  headers['X-XSS-Protection'] = '1; mode=block';

  return headers;
}

/**
 * Middleware helper для Next.js
 */
export function createSecurityHeadersMiddleware(config?: SecurityHeadersConfig) {
  const headers = getSecurityHeaders(config);

  return (responseHeaders: Headers) => {
    Object.entries(headers).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });
  };
}

/**
 * Generate CSP nonce for inline scripts
 */
export function generateCSPNonce(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Add nonce to CSP header
 */
export function addNonceToCSP(csp: string, nonce: string): string {
  return csp.replace(
    /script-src ([^;]*)/,
    `script-src $1 'nonce-${nonce}'`
  );
}

/**
 * Report-To header configuration для CSP reporting
 */
export function getReportToHeader(endpoint: string, group: string = 'csp-endpoint'): string {
  return JSON.stringify({
    group,
    max_age: 86400,
    endpoints: [{ url: endpoint }],
  });
}

/**
 * Validate security headers
 */
export function validateSecurityHeaders(headers: Record<string, string>): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const required = [
    'Content-Security-Policy',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Referrer-Policy',
  ];

  const missing = required.filter(header => !headers[header]);
  const warnings: string[] = [];

  // Перевірка HSTS в production
  if (process.env.NODE_ENV === 'production' && !headers['Strict-Transport-Security']) {
    warnings.push('HSTS header is recommended in production');
  }

  // Перевірка X-XSS-Protection
  if (headers['X-XSS-Protection'] && headers['X-XSS-Protection'] !== '1; mode=block') {
    warnings.push('X-XSS-Protection should be "1; mode=block"');
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}
