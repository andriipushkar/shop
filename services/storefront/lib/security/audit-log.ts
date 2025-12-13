/**
 * Security Audit Logging - Логування подій безпеки
 * Відстеження та реєстрація критичних подій для аудиту безпеки
 * Реалізація OWASP рекомендацій для логування
 */

import { logger } from '@/lib/logger';

/**
 * Типи подій безпеки
 */
export enum SecurityEventType {
  // Аутентифікація
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILED = 'auth.login.failed',
  LOGOUT = 'auth.logout',
  PASSWORD_RESET_REQUESTED = 'auth.password_reset.requested',
  PASSWORD_RESET_COMPLETED = 'auth.password_reset.completed',
  PASSWORD_CHANGED = 'auth.password.changed',
  MFA_ENABLED = 'auth.mfa.enabled',
  MFA_DISABLED = 'auth.mfa.disabled',
  SESSION_EXPIRED = 'auth.session.expired',

  // Авторизація
  ACCESS_DENIED = 'authz.access.denied',
  PERMISSION_VIOLATION = 'authz.permission.violation',
  ROLE_CHANGED = 'authz.role.changed',

  // Адміністративні дії
  ADMIN_USER_CREATED = 'admin.user.created',
  ADMIN_USER_UPDATED = 'admin.user.updated',
  ADMIN_USER_DELETED = 'admin.user.deleted',
  ADMIN_ROLE_ASSIGNED = 'admin.role.assigned',
  ADMIN_SETTINGS_CHANGED = 'admin.settings.changed',
  ADMIN_DATA_EXPORT = 'admin.data.export',
  ADMIN_BULK_ACTION = 'admin.bulk.action',

  // Підозріла активність
  RATE_LIMIT_EXCEEDED = 'security.rate_limit.exceeded',
  SUSPICIOUS_REQUEST = 'security.suspicious.request',
  CSRF_VIOLATION = 'security.csrf.violation',
  XSS_ATTEMPT = 'security.xss.attempt',
  SQL_INJECTION_ATTEMPT = 'security.sql_injection.attempt',
  PATH_TRAVERSAL_ATTEMPT = 'security.path_traversal.attempt',
  INVALID_TOKEN = 'security.token.invalid',
  BRUTE_FORCE_DETECTED = 'security.brute_force.detected',

  // Дані
  DATA_ACCESS = 'data.access',
  DATA_MODIFIED = 'data.modified',
  DATA_DELETED = 'data.deleted',
  SENSITIVE_DATA_ACCESS = 'data.sensitive.access',

  // Платежі
  PAYMENT_INITIATED = 'payment.initiated',
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  REFUND_INITIATED = 'payment.refund.initiated',

  // Система
  SYSTEM_ERROR = 'system.error',
  SECURITY_SCAN_COMPLETED = 'system.security_scan.completed',
  BACKUP_COMPLETED = 'system.backup.completed',
}

/**
 * Рівні серйозності подій
 */
export enum SecurityEventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Інтерфейс події безпеки
 */
export interface SecurityEvent {
  id?: string;
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  timestamp: Date;
  userId?: string;
  username?: string;
  ip?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  status: 'success' | 'failure' | 'warning';
  details?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Інтерфейс для сповіщень
 */
export interface AlertConfig {
  email?: string[];
  slack?: string;
  telegram?: string;
  webhook?: string;
}

/**
 * Конфігурація аудит логу
 */
export interface AuditLogConfig {
  enableConsoleLog?: boolean;
  enableFileLog?: boolean;
  enableDatabaseLog?: boolean;
  alertOnCritical?: boolean;
  alertConfig?: AlertConfig;
  retentionDays?: number;
}

const defaultConfig: AuditLogConfig = {
  enableConsoleLog: true,
  enableFileLog: true,
  enableDatabaseLog: true,
  alertOnCritical: true,
  retentionDays: 90,
};

let config: AuditLogConfig = defaultConfig;

/**
 * Налаштування конфігурації
 */
export function configureAuditLog(newConfig: Partial<AuditLogConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Отримання severity на основі типу події
 */
function getEventSeverity(type: SecurityEventType): SecurityEventSeverity {
  const criticalEvents = [
    SecurityEventType.ADMIN_USER_DELETED,
    SecurityEventType.ADMIN_DATA_EXPORT,
    SecurityEventType.BRUTE_FORCE_DETECTED,
    SecurityEventType.SQL_INJECTION_ATTEMPT,
  ];

  const highEvents = [
    SecurityEventType.LOGIN_FAILED,
    SecurityEventType.ACCESS_DENIED,
    SecurityEventType.CSRF_VIOLATION,
    SecurityEventType.XSS_ATTEMPT,
    SecurityEventType.PATH_TRAVERSAL_ATTEMPT,
    SecurityEventType.INVALID_TOKEN,
  ];

  const mediumEvents = [
    SecurityEventType.RATE_LIMIT_EXCEEDED,
    SecurityEventType.SUSPICIOUS_REQUEST,
    SecurityEventType.PASSWORD_RESET_REQUESTED,
    SecurityEventType.ADMIN_SETTINGS_CHANGED,
  ];

  if (criticalEvents.includes(type)) {
    return SecurityEventSeverity.CRITICAL;
  }
  if (highEvents.includes(type)) {
    return SecurityEventSeverity.HIGH;
  }
  if (mediumEvents.includes(type)) {
    return SecurityEventSeverity.MEDIUM;
  }
  return SecurityEventSeverity.LOW;
}

/**
 * Логування події безпеки
 */
export async function logSecurityEvent(event: Partial<SecurityEvent>): Promise<void> {
  const fullEvent: SecurityEvent = {
    id: generateEventId(),
    severity: event.severity || getEventSeverity(event.type!),
    timestamp: new Date(),
    status: event.status || 'success',
    ...event,
  } as SecurityEvent;

  // Console logging
  if (config.enableConsoleLog) {
    const logMethod = getLogMethod(fullEvent.severity);
    logMethod(`[SECURITY] ${fullEvent.type}`, {
      ...fullEvent,
      timestamp: fullEvent.timestamp.toISOString(),
    });
  }

  // File logging
  if (config.enableFileLog) {
    await logToFile(fullEvent);
  }

  // Database logging
  if (config.enableDatabaseLog) {
    await logToDatabase(fullEvent);
  }

  // Alerting для критичних подій
  if (config.alertOnCritical && fullEvent.severity === SecurityEventSeverity.CRITICAL) {
    await sendAlert(fullEvent);
  }
}

/**
 * Генерація ID події
 */
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Отримання методу логування
 */
function getLogMethod(severity: SecurityEventSeverity) {
  switch (severity) {
    case SecurityEventSeverity.CRITICAL:
    case SecurityEventSeverity.HIGH:
      return logger.error.bind(logger);
    case SecurityEventSeverity.MEDIUM:
      return logger.warn.bind(logger);
    default:
      return logger.info.bind(logger);
  }
}

/**
 * Логування у файл
 */
async function logToFile(event: SecurityEvent): Promise<void> {
  try {
    // Логування через logger який вже налаштований
    logger.info('security_event', {
      ...event,
      timestamp: event.timestamp.toISOString(),
    });
  } catch (error) {
    console.error('Failed to log security event to file:', error);
  }
}

/**
 * Логування в базу даних
 */
async function logToDatabase(event: SecurityEvent): Promise<void> {
  try {
    // TODO: Реалізувати збереження в БД через Prisma
    // await prisma.securityAuditLog.create({
    //   data: {
    //     type: event.type,
    //     severity: event.severity,
    //     userId: event.userId,
    //     ip: event.ip,
    //     resource: event.resource,
    //     action: event.action,
    //     status: event.status,
    //     details: event.details,
    //     metadata: event.metadata,
    //   },
    // });
  } catch (error) {
    console.error('Failed to log security event to database:', error);
  }
}

/**
 * Відправка сповіщення
 */
async function sendAlert(event: SecurityEvent): Promise<void> {
  if (!config.alertConfig) return;

  const message = formatAlertMessage(event);

  try {
    // Email alerts
    if (config.alertConfig.email) {
      // TODO: Реалізувати відправку email
      console.log('Email alert:', message);
    }

    // Slack alerts
    if (config.alertConfig.slack) {
      await sendSlackAlert(config.alertConfig.slack, message);
    }

    // Telegram alerts
    if (config.alertConfig.telegram) {
      await sendTelegramAlert(config.alertConfig.telegram, message);
    }

    // Webhook alerts
    if (config.alertConfig.webhook) {
      await sendWebhookAlert(config.alertConfig.webhook, event);
    }
  } catch (error) {
    console.error('Failed to send security alert:', error);
  }
}

/**
 * Форматування повідомлення для сповіщення
 */
function formatAlertMessage(event: SecurityEvent): string {
  return `
🚨 КРИТИЧНА ПОДІЯ БЕЗПЕКИ

Тип: ${event.type}
Час: ${event.timestamp.toISOString()}
Користувач: ${event.username || event.userId || 'Anonymous'}
IP: ${event.ip || 'Unknown'}
Статус: ${event.status}

${event.details ? 'Деталі: ' + JSON.stringify(event.details, null, 2) : ''}
  `.trim();
}

/**
 * Відправка в Slack
 */
async function sendSlackAlert(webhookUrl: string, message: string): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
  } catch (error) {
    console.error('Failed to send Slack alert:', error);
  }
}

/**
 * Відправка в Telegram
 */
async function sendTelegramAlert(botToken: string, message: string): Promise<void> {
  try {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) return;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
  } catch (error) {
    console.error('Failed to send Telegram alert:', error);
  }
}

/**
 * Відправка на webhook
 */
async function sendWebhookAlert(webhookUrl: string, event: SecurityEvent): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch (error) {
    console.error('Failed to send webhook alert:', error);
  }
}

/**
 * Helper функції для різних типів подій
 */

export async function logLoginAttempt(
  success: boolean,
  userId?: string,
  username?: string,
  ip?: string,
  userAgent?: string,
  details?: Record<string, any>
): Promise<void> {
  await logSecurityEvent({
    type: success ? SecurityEventType.LOGIN_SUCCESS : SecurityEventType.LOGIN_FAILED,
    userId,
    username,
    ip,
    userAgent,
    status: success ? 'success' : 'failure',
    details,
  });
}

export async function logAccessDenied(
  resource: string,
  action: string,
  userId?: string,
  ip?: string,
  reason?: string
): Promise<void> {
  await logSecurityEvent({
    type: SecurityEventType.ACCESS_DENIED,
    userId,
    ip,
    resource,
    action,
    status: 'failure',
    details: { reason },
  });
}

export async function logAdminAction(
  action: string,
  userId: string,
  resource: string,
  details?: Record<string, any>
): Promise<void> {
  let eventType: SecurityEventType;

  switch (action) {
    case 'create':
      eventType = SecurityEventType.ADMIN_USER_CREATED;
      break;
    case 'update':
      eventType = SecurityEventType.ADMIN_USER_UPDATED;
      break;
    case 'delete':
      eventType = SecurityEventType.ADMIN_USER_DELETED;
      break;
    default:
      eventType = SecurityEventType.ADMIN_SETTINGS_CHANGED;
  }

  await logSecurityEvent({
    type: eventType,
    userId,
    resource,
    action,
    status: 'success',
    details,
  });
}

export async function logSuspiciousActivity(
  type: SecurityEventType,
  ip: string,
  userAgent?: string,
  details?: Record<string, any>
): Promise<void> {
  await logSecurityEvent({
    type,
    ip,
    userAgent,
    status: 'warning',
    details,
  });
}

export async function logDataAccess(
  resource: string,
  action: 'read' | 'write' | 'delete',
  userId?: string,
  sensitive: boolean = false
): Promise<void> {
  const eventType = sensitive
    ? SecurityEventType.SENSITIVE_DATA_ACCESS
    : action === 'read'
    ? SecurityEventType.DATA_ACCESS
    : action === 'delete'
    ? SecurityEventType.DATA_DELETED
    : SecurityEventType.DATA_MODIFIED;

  await logSecurityEvent({
    type: eventType,
    userId,
    resource,
    action,
    status: 'success',
  });
}

export async function logPaymentEvent(
  type: 'initiated' | 'completed' | 'failed' | 'refunded',
  userId: string,
  amount: number,
  currency: string,
  orderId: string,
  details?: Record<string, any>
): Promise<void> {
  const eventTypeMap = {
    initiated: SecurityEventType.PAYMENT_INITIATED,
    completed: SecurityEventType.PAYMENT_COMPLETED,
    failed: SecurityEventType.PAYMENT_FAILED,
    refunded: SecurityEventType.REFUND_INITIATED,
  };

  await logSecurityEvent({
    type: eventTypeMap[type],
    userId,
    resource: `order:${orderId}`,
    action: type,
    status: type === 'failed' ? 'failure' : 'success',
    details: {
      amount,
      currency,
      ...details,
    },
  });
}

/**
 * Пошук подій в логах
 */
export async function searchAuditLogs(filters: {
  type?: SecurityEventType;
  severity?: SecurityEventSeverity;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<SecurityEvent[]> {
  // TODO: Реалізувати пошук через БД
  // const logs = await prisma.securityAuditLog.findMany({
  //   where: {
  //     type: filters.type,
  //     severity: filters.severity,
  //     userId: filters.userId,
  //     timestamp: {
  //       gte: filters.startDate,
  //       lte: filters.endDate,
  //     },
  //   },
  //   orderBy: { timestamp: 'desc' },
  //   take: filters.limit || 100,
  // });

  return [];
}

/**
 * Отримання статистики безпеки
 */
export async function getSecurityStats(period: 'day' | 'week' | 'month' = 'day'): Promise<{
  totalEvents: number;
  criticalEvents: number;
  failedLogins: number;
  suspiciousActivity: number;
  topEvents: Array<{ type: string; count: number }>;
}> {
  // TODO: Реалізувати через БД
  return {
    totalEvents: 0,
    criticalEvents: 0,
    failedLogins: 0,
    suspiciousActivity: 0,
    topEvents: [],
  };
}

/**
 * Очистка старих логів
 */
export async function cleanupOldLogs(retentionDays: number = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // TODO: Реалізувати через БД
  // const result = await prisma.securityAuditLog.deleteMany({
  //   where: {
  //     timestamp: {
  //       lt: cutoffDate,
  //     },
  //   },
  // });

  // return result.count;
  return 0;
}
