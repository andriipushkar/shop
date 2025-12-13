# Security Documentation - Документація з безпеки

Комплексна система безпеки для storefront застосунку, реалізована згідно з OWASP рекомендаціями.

## Зміст

1. [Огляд](#огляд)
2. [Компоненти безпеки](#компоненти-безпеки)
3. [Rate Limiting](#rate-limiting)
4. [CSRF Protection](#csrf-protection)
5. [Security Headers](#security-headers)
6. [Input Sanitization](#input-sanitization)
7. [Audit Logging](#audit-logging)
8. [Конфігурація](#конфігурація)
9. [Best Practices](#best-practices)
10. [Тестування](#тестування)

---

## Огляд

Система безпеки включає:

- ✅ **Rate Limiting** - захист від DDoS та brute-force атак
- ✅ **CSRF Protection** - захист від підробки міжсайтових запитів
- ✅ **Security Headers** - CSP, HSTS, X-Frame-Options та інші
- ✅ **Input Sanitization** - захист від XSS та SQL Injection
- ✅ **Audit Logging** - реєстрація подій безпеки
- ✅ **Bot Detection** - виявлення підозрілої активності

## Компоненти безпеки

### Структура файлів

```
lib/security/
├── rate-limiter.ts       # Rate limiting з Redis
├── csrf.ts               # CSRF protection
├── headers.ts            # Security headers
├── input-sanitizer.ts    # Санітизація вводу
├── audit-log.ts          # Логування подій
└── index.ts              # Експорт всіх модулів

middleware.ts             # Security middleware
scripts/security-audit.ts # Скрипт аудиту
__tests__/lib/security.test.ts # Тести
```

---

## Rate Limiting

### Можливості

- ✅ Sliding window алгоритм для точного підрахунку
- ✅ Redis backend для розподілених систем
- ✅ In-memory fallback для development
- ✅ Per-IP та per-user обмеження
- ✅ Різні ліміти для різних endpoints

### Використання

```typescript
import { rateLimitByIPAndUser, RATE_LIMIT_CONFIGS } from '@/lib/security/rate-limiter';

// В API route
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const userId = await getUserId(req);

  const rateLimitResult = await rateLimitByIPAndUser(
    ip,
    userId,
    'login'
  );

  if (!rateLimitResult.allowed) {
    return Response.json(
      { error: 'Забагато спроб входу' },
      { status: 429 }
    );
  }

  // Продовжуємо обробку
}
```

### Конфігурація лімітів

```typescript
// lib/security/rate-limiter.ts
export const RATE_LIMIT_CONFIGS = {
  login: {
    windowMs: 15 * 60 * 1000,  // 15 хвилин
    maxRequests: 5,             // 5 спроб
  },
  apiGeneral: {
    windowMs: 60 * 1000,        // 1 хвилина
    maxRequests: 100,           // 100 запитів
  },
  // ... інші конфігурації
};
```

### Redis конфігурація

```bash
# .env
REDIS_URL=redis://localhost:6379
# або
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_DB=0
```

Ініціалізація Redis:

```typescript
import { initRedis } from '@/lib/security/rate-limiter';

// В instrumentation.ts або при запуску
initRedis();
```

---

## CSRF Protection

### Можливості

- ✅ Synchronizer token pattern
- ✅ Double submit cookie pattern
- ✅ Автоматичне закінчення терміну дії токенів
- ✅ Exemption list для webhooks
- ✅ Підтримка single-use та reusable токенів

### Використання

#### Генерація токена

```typescript
import { generateCSRFToken } from '@/lib/security/csrf';

// В API route або сторінці
export async function GET(req: Request) {
  const session = await getSession(req);
  const csrfToken = generateCSRFToken(session.id);

  return Response.json({ csrfToken });
}
```

#### Валідація токена

```typescript
import {
  validateCSRFToken,
  requiresCSRFProtection,
  getCSRFTokenFromHeaders
} from '@/lib/security/csrf';

export async function POST(req: Request) {
  // Перевірка чи потрібна CSRF
  if (!requiresCSRFProtection(req.method)) {
    // GET, HEAD, OPTIONS не потребують CSRF
    return;
  }

  const session = await getSession(req);
  const csrfToken = getCSRFTokenFromHeaders(req.headers);

  const result = validateCSRFToken(csrfToken, session.id);

  if (!result.valid) {
    return Response.json(
      { error: result.error },
      { status: 403 }
    );
  }

  // Продовжуємо обробку
}
```

#### В формах

```tsx
import { generateCSRFToken } from '@/lib/security/csrf';

export default function MyForm({ sessionId }: { sessionId: string }) {
  const [csrfToken] = useState(() => generateCSRFToken(sessionId));

  return (
    <form action="/api/submit" method="POST">
      <input type="hidden" name="_csrf" value={csrfToken} />
      {/* інші поля */}
    </form>
  );
}
```

#### В fetch запитах

```typescript
// Отримання токена
const response = await fetch('/api/csrf-token');
const { csrfToken } = await response.json();

// Використання токена
await fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data),
});
```

### Exemption List

Додавання винятків для webhooks:

```typescript
// lib/security/csrf.ts
const exemptedPaths = [
  '/api/webhooks/',
  '/api/payments/callback',
  '/api/marketplaces/webhook',
];
```

---

## Security Headers

### Реалізовані заголовки

- ✅ **Content-Security-Policy** - запобігання XSS
- ✅ **Strict-Transport-Security** - HSTS для HTTPS
- ✅ **X-Frame-Options** - запобігання clickjacking
- ✅ **X-Content-Type-Options** - nosniff
- ✅ **Referrer-Policy** - контроль referrer
- ✅ **Permissions-Policy** - обмеження API браузера
- ✅ **Cross-Origin-* headers** - CORP, COEP, COOP

### Використання

```typescript
import { getSecurityHeaders } from '@/lib/security/headers';

// В middleware або API route
const headers = getSecurityHeaders();

// Додавання до response
Object.entries(headers).forEach(([key, value]) => {
  response.headers.set(key, value);
});
```

### Кастомізація CSP

```typescript
import { getSecurityHeaders, DEFAULT_CSP } from '@/lib/security/headers';

const customCSP = {
  ...DEFAULT_CSP,
  scriptSrc: [
    ...DEFAULT_CSP.scriptSrc!,
    'https://cdn.example.com',
  ],
};

const headers = getSecurityHeaders({
  contentSecurityPolicy: customCSP,
});
```

### CSP Nonce для inline scripts

```typescript
import { generateCSPNonce, addNonceToCSP } from '@/lib/security/headers';

// Генерація nonce
const nonce = generateCSPNonce();

// Додавання до CSP
const csp = buildCSPHeader(DEFAULT_CSP);
const cspWithNonce = addNonceToCSP(csp, nonce);

// Використання в script
<script nonce={nonce}>
  console.log('Inline script з nonce');
</script>
```

---

## Input Sanitization

### Функції санітизації

#### HTML санітизація

```typescript
import {
  escapeHtml,
  stripHtmlTags,
  sanitizeHtml
} from '@/lib/security/input-sanitizer';

// Екранування HTML
const safe = escapeHtml('<script>alert("XSS")</script>');
// &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;

// Видалення всіх тегів
const plain = stripHtmlTags('<p>Hello <b>World</b></p>');
// Hello World

// Санітизація з дозволеними тегами
const cleaned = sanitizeHtml(
  '<p>Hello <b>World</b><script>bad()</script></p>',
  ['p', 'b']
);
// <p>Hello <b>World</b></p>
```

#### URL санітизація

```typescript
import { sanitizeUrl } from '@/lib/security/input-sanitizer';

sanitizeUrl('https://example.com');  // OK
sanitizeUrl('javascript:alert(1)');  // '' (блокується)
sanitizeUrl('data:text/html,...');   // '' (блокується)
```

#### Email валідація

```typescript
import { sanitizeEmail } from '@/lib/security/input-sanitizer';

sanitizeEmail('test@example.com');     // 'test@example.com'
sanitizeEmail('TEST@EXAMPLE.COM');     // 'test@example.com' (нормалізація)
sanitizeEmail('invalid-email');        // null
```

#### Телефон валідація (український формат)

```typescript
import { sanitizePhoneNumber } from '@/lib/security/input-sanitizer';

sanitizePhoneNumber('+380991234567');      // '+380991234567'
sanitizePhoneNumber('0991234567');         // '+380991234567'
sanitizePhoneNumber('+38 099 123 45 67');  // '+380991234567'
```

#### Числова валідація

```typescript
import { sanitizeNumber } from '@/lib/security/input-sanitizer';

sanitizeNumber('123', { min: 0, max: 1000 });           // 123
sanitizeNumber('10.5', { integer: true });              // null
sanitizeNumber('999', { min: 0, max: 100 });            // null
```

#### Об'єкт санітизація

```typescript
import { sanitizeObject, sanitizeEmail, sanitizeNumber } from '@/lib/security/input-sanitizer';

const schema = {
  email: sanitizeEmail,
  age: (val: any) => sanitizeNumber(val, { min: 0, max: 120, integer: true }),
  name: (val: any) => typeof val === 'string' ? val.trim() : null,
};

const cleaned = sanitizeObject(userData, schema);
```

---

## Audit Logging

### Типи подій

```typescript
export enum SecurityEventType {
  // Аутентифікація
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILED = 'auth.login.failed',
  LOGOUT = 'auth.logout',
  PASSWORD_CHANGED = 'auth.password.changed',

  // Авторізація
  ACCESS_DENIED = 'authz.access.denied',
  PERMISSION_VIOLATION = 'authz.permission.violation',

  // Підозріла активність
  RATE_LIMIT_EXCEEDED = 'security.rate_limit.exceeded',
  CSRF_VIOLATION = 'security.csrf.violation',
  XSS_ATTEMPT = 'security.xss.attempt',
  SQL_INJECTION_ATTEMPT = 'security.sql_injection.attempt',

  // ... інші типи
}
```

### Використання

```typescript
import {
  logLoginAttempt,
  logAccessDenied,
  logSuspiciousActivity,
  logAdminAction,
  SecurityEventType
} from '@/lib/security/audit-log';

// Логування входу
await logLoginAttempt(
  true,                    // success
  'user-123',              // userId
  'john@example.com',      // username
  '192.168.1.1',          // ip
  'Mozilla/5.0...',       // userAgent
  { method: '2FA' }       // details
);

// Логування відмови в доступі
await logAccessDenied(
  '/admin/users',          // resource
  'delete',                // action
  'user-456',              // userId
  '192.168.1.2',          // ip
  'Insufficient role'      // reason
);

// Логування підозрілої активності
await logSuspiciousActivity(
  SecurityEventType.SQL_INJECTION_ATTEMPT,
  '192.168.1.3',
  'curl/7.64.1',
  { query: 'SELECT * FROM users WHERE id=1 OR 1=1' }
);

// Логування адмін дій
await logAdminAction(
  'delete',                // action
  'admin-123',             // userId
  'user:456',              // resource
  { deletedUser: 'user-456@example.com' }
);
```

### Конфігурація сповіщень

```typescript
import { configureAuditLog } from '@/lib/security/audit-log';

configureAuditLog({
  enableConsoleLog: true,
  enableFileLog: true,
  enableDatabaseLog: true,
  alertOnCritical: true,
  alertConfig: {
    email: ['security@example.com'],
    slack: process.env.SLACK_WEBHOOK_URL,
    telegram: process.env.TELEGRAM_BOT_TOKEN,
  },
  retentionDays: 90,
});
```

### Пошук в логах

```typescript
import { searchAuditLogs, SecurityEventType } from '@/lib/security/audit-log';

const logs = await searchAuditLogs({
  type: SecurityEventType.LOGIN_FAILED,
  userId: 'user-123',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-12-31'),
  limit: 100,
});
```

---

## Конфігурація

### Змінні оточення

```bash
# .env

# Next Auth
NEXTAUTH_SECRET=your-very-secret-key-min-32-chars
NEXTAUTH_URL=http://localhost:3000

# CSRF Protection
CSRF_SECRET=your-csrf-secret-key

# Redis (для rate limiting)
REDIS_URL=redis://localhost:6379
# або
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Security Alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/db
```

### Генерація секретів

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# CSRF_SECRET
openssl rand -hex 32

# Або через Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Best Practices

### 1. Завжди валідуйте вхідні дані

```typescript
// ❌ Погано
const userId = req.query.id;
await db.user.findOne({ id: userId });

// ✅ Добре
import { sanitizeId } from '@/lib/security/input-sanitizer';

const userId = sanitizeId(req.query.id as string);
if (!userId) {
  return Response.json({ error: 'Invalid ID' }, { status: 400 });
}
await db.user.findOne({ id: userId });
```

### 2. Використовуйте CSRF захист для мутаційних операцій

```typescript
// ❌ Погано
export async function POST(req: Request) {
  const data = await req.json();
  await db.create(data);
}

// ✅ Добре
export async function POST(req: Request) {
  const csrfToken = getCSRFTokenFromHeaders(req.headers);
  const session = await getSession(req);

  if (!validateCSRFToken(csrfToken, session.id).valid) {
    return Response.json({ error: 'Invalid CSRF' }, { status: 403 });
  }

  const data = await req.json();
  await db.create(data);
}
```

### 3. Логуйте важливі події безпеки

```typescript
// ✅ Добре
try {
  await deleteUser(userId);
  await logAdminAction('delete', adminId, `user:${userId}`, { email });
} catch (error) {
  await logSecurityEvent({
    type: SecurityEventType.SYSTEM_ERROR,
    severity: SecurityEventSeverity.HIGH,
    details: { error: error.message, action: 'user_deletion' },
  });
  throw error;
}
```

### 4. Застосовуйте принцип найменших привілеїв

```typescript
// Перевірка ролей
if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
  await logAccessDenied(resource, action, userId, ip, 'Insufficient role');
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}
```

### 5. Завжди використовуйте HTTPS в production

```typescript
// next.config.ts
if (process.env.NODE_ENV === 'production') {
  headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
}
```

---

## Тестування

### Запуск тестів безпеки

```bash
# Всі тести
npm test

# Тільки тести безпеки
npm test -- __tests__/lib/security.test.ts

# З покриттям
npm run test:coverage

# Security audit
npm run security-audit
```

### Скрипт аудиту

```bash
# Запуск повного аудиту безпеки
npm run security-audit

# або
ts-node scripts/security-audit.ts
```

Скрипт перевіряє:
- ✅ Вразливості в npm пакетах
- ✅ Конфігурацію файлів (.env, .gitignore)
- ✅ Змінні оточення
- ✅ Небезпечні паттерни в коді
- ✅ Security headers конфігурацію
- ✅ Middleware безпеки

### Приклад тесту

```typescript
import { consumeRateLimit } from '@/lib/security/rate-limiter';

describe('Rate Limiter', () => {
  it('повинен блокувати після перевищення ліміту', async () => {
    const config = { windowMs: 1000, maxRequests: 2 };

    // Використовуємо весь ліміт
    await consumeRateLimit('test', 'apiGeneral', config);
    await consumeRateLimit('test', 'apiGeneral', config);

    // Наступний запит блокується
    const result = await consumeRateLimit('test', 'apiGeneral', config);

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });
});
```

---

## Моніторинг безпеки

### Метрики для відстеження

1. **Rate Limiting**
   - Кількість заблокованих запитів
   - Top IP з найбільшою кількістю запитів
   - Ендпоінти з найчастішим перевищенням лімітів

2. **CSRF**
   - Кількість невалідних CSRF токенів
   - Джерела CSRF порушень

3. **Authentication**
   - Невдалі спроби входу
   - Спроби brute-force
   - Підозрілі IP адреси

4. **Audit Logs**
   - Критичні події за день/тиждень
   - Топ категорій подій
   - Географічне розподілення подій

### Dashboard приклад

```typescript
import { getSecurityStats } from '@/lib/security/audit-log';

const stats = await getSecurityStats('day');

console.log({
  totalEvents: stats.totalEvents,
  criticalEvents: stats.criticalEvents,
  failedLogins: stats.failedLogins,
  topEvents: stats.topEvents,
});
```

---

## Troubleshooting

### Rate Limiting не працює

1. Перевірте Redis з'єднання
```bash
redis-cli ping
# PONG
```

2. Перевірте змінні оточення
```bash
echo $REDIS_URL
```

3. Перевірте ініціалізацію
```typescript
import { isRedisAvailable } from '@/lib/security/rate-limiter';
console.log(isRedisAvailable()); // повинно бути true
```

### CSRF токени не валідуються

1. Перевірте що токен передається правильно
```typescript
console.log('Token from header:', req.headers.get('X-CSRF-Token'));
console.log('Session ID:', sessionId);
```

2. Перевірте exemption list
```typescript
console.log('Is exempted:', isCSRFExempted(pathname));
```

### Security Headers не застосовуються

1. Перевірте middleware
```bash
cat middleware.ts | grep getSecurityHeaders
```

2. Перевірте production mode
```bash
echo $NODE_ENV
```

---

## Додаткові ресурси

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [Content Security Policy Reference](https://content-security-policy.com/)

---

## Підтримка

Якщо ви знайшли вразливість безпеки, будь ласка, повідомте команду через:
- Email: security@example.com
- GitHub Security Advisory

**Не створюйте публічні issue для вразливостей безпеки!**

---

**Останнє оновлення:** 2025-12-13
**Версія:** 1.0.0
