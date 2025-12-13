/**
 * Monitoring & Alerting System
 * Система моніторингу та алертів для Shop Storefront
 */

// ============================================
// ТИПИ
// ============================================

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertChannel = 'console' | 'slack' | 'telegram' | 'email' | 'sentry';

export interface Alert {
    id: string;
    title: string;
    message: string;
    severity: AlertSeverity;
    source: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
    acknowledged?: boolean;
    resolvedAt?: Date;
}

export interface MetricPoint {
    name: string;
    value: number;
    timestamp: Date;
    tags?: Record<string, string>;
}

export interface HealthCheck {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    responseTime?: number;
    lastCheck: Date;
}

export interface MonitoringConfig {
    enabled: boolean;
    channels: AlertChannel[];
    slackWebhookUrl?: string;
    telegramBotToken?: string;
    telegramChatId?: string;
    emailRecipients?: string[];
    thresholds: {
        errorRatePercent: number;
        responseTimeMs: number;
        memoryUsagePercent: number;
        cpuUsagePercent: number;
    };
}

// ============================================
// MONITORING SERVICE
// ============================================

class MonitoringService {
    private config: MonitoringConfig;
    private alerts: Alert[] = [];
    private metrics: MetricPoint[] = [];
    private healthChecks: Map<string, HealthCheck> = new Map();

    constructor(config?: Partial<MonitoringConfig>) {
        this.config = {
            enabled: process.env.NODE_ENV === 'production',
            channels: ['console'],
            thresholds: {
                errorRatePercent: 5,
                responseTimeMs: 2000,
                memoryUsagePercent: 85,
                cpuUsagePercent: 80,
            },
            ...config,
        };
    }

    // ============================================
    // ALERTS
    // ============================================

    /**
     * Створити алерт
     */
    async createAlert(
        title: string,
        message: string,
        severity: AlertSeverity,
        source: string,
        metadata?: Record<string, unknown>
    ): Promise<Alert> {
        const alert: Alert = {
            id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title,
            message,
            severity,
            source,
            timestamp: new Date(),
            metadata,
            acknowledged: false,
        };

        this.alerts.push(alert);

        // Зберігати тільки останні 1000 алертів
        if (this.alerts.length > 1000) {
            this.alerts = this.alerts.slice(-1000);
        }

        // Відправити через канали
        await this.sendAlert(alert);

        return alert;
    }

    /**
     * Відправити алерт через налаштовані канали
     */
    private async sendAlert(alert: Alert): Promise<void> {
        if (!this.config.enabled) {
            console.log('[Monitoring] Alert (disabled):', alert);
            return;
        }

        const promises = this.config.channels.map(async (channel) => {
            try {
                switch (channel) {
                    case 'console':
                        this.sendToConsole(alert);
                        break;
                    case 'slack':
                        await this.sendToSlack(alert);
                        break;
                    case 'telegram':
                        await this.sendToTelegram(alert);
                        break;
                    case 'email':
                        await this.sendToEmail(alert);
                        break;
                    case 'sentry':
                        this.sendToSentry(alert);
                        break;
                }
            } catch (error) {
                console.error(`[Monitoring] Failed to send alert via ${channel}:`, error);
            }
        });

        await Promise.allSettled(promises);
    }

    private sendToConsole(alert: Alert): void {
        const emoji = {
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌',
            critical: '🚨',
        };

        console.log(
            `${emoji[alert.severity]} [${alert.severity.toUpperCase()}] ${alert.title}\n` +
            `   Source: ${alert.source}\n` +
            `   Message: ${alert.message}\n` +
            `   Time: ${alert.timestamp.toISOString()}`
        );
    }

    private async sendToSlack(alert: Alert): Promise<void> {
        if (!this.config.slackWebhookUrl) return;

        const color = {
            info: '#36a64f',
            warning: '#ffcc00',
            error: '#ff6600',
            critical: '#ff0000',
        };

        await fetch(this.config.slackWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                attachments: [
                    {
                        color: color[alert.severity],
                        title: `${alert.severity.toUpperCase()}: ${alert.title}`,
                        text: alert.message,
                        fields: [
                            { title: 'Source', value: alert.source, short: true },
                            { title: 'Time', value: alert.timestamp.toISOString(), short: true },
                        ],
                        footer: 'Shop Monitoring',
                    },
                ],
            }),
        });
    }

    private async sendToTelegram(alert: Alert): Promise<void> {
        if (!this.config.telegramBotToken || !this.config.telegramChatId) return;

        const emoji = {
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌',
            critical: '🚨',
        };

        const text = `${emoji[alert.severity]} *${alert.severity.toUpperCase()}*\n\n` +
            `*${alert.title}*\n\n` +
            `${alert.message}\n\n` +
            `📍 Source: ${alert.source}\n` +
            `🕐 Time: ${alert.timestamp.toISOString()}`;

        await fetch(
            `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: this.config.telegramChatId,
                    text,
                    parse_mode: 'Markdown',
                }),
            }
        );
    }

    private async sendToEmail(alert: Alert): Promise<void> {
        // Інтеграція з email сервісом (напр. SendGrid, AWS SES)
        // Тут можна додати реалізацію
        console.log('[Monitoring] Email alert would be sent to:', this.config.emailRecipients);
    }

    private sendToSentry(alert: Alert): void {
        // Sentry вже інтегровано через @sentry/nextjs
        // Помилки автоматично відправляються
        if (typeof window !== 'undefined' && (window as unknown as { Sentry?: { captureMessage: (msg: string, level: string) => void } }).Sentry) {
            (window as unknown as { Sentry: { captureMessage: (msg: string, level: string) => void } }).Sentry.captureMessage(
                `${alert.title}: ${alert.message}`,
                alert.severity
            );
        }
    }

    /**
     * Підтвердити алерт
     */
    acknowledgeAlert(alertId: string): boolean {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            return true;
        }
        return false;
    }

    /**
     * Вирішити алерт
     */
    resolveAlert(alertId: string): boolean {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.resolvedAt = new Date();
            return true;
        }
        return false;
    }

    /**
     * Отримати активні алерти
     */
    getActiveAlerts(): Alert[] {
        return this.alerts.filter(a => !a.resolvedAt);
    }

    /**
     * Отримати всі алерти
     */
    getAllAlerts(limit: number = 100): Alert[] {
        return this.alerts.slice(-limit);
    }

    // ============================================
    // METRICS
    // ============================================

    /**
     * Записати метрику
     */
    recordMetric(
        name: string,
        value: number,
        tags?: Record<string, string>
    ): void {
        const point: MetricPoint = {
            name,
            value,
            timestamp: new Date(),
            tags,
        };

        this.metrics.push(point);

        // Зберігати тільки останні 10000 точок
        if (this.metrics.length > 10000) {
            this.metrics = this.metrics.slice(-10000);
        }

        // Перевірити пороги
        this.checkThresholds(point);
    }

    /**
     * Перевірити пороги та створити алерти
     */
    private async checkThresholds(metric: MetricPoint): Promise<void> {
        const { thresholds } = this.config;

        // Response time
        if (metric.name === 'response_time' && metric.value > thresholds.responseTimeMs) {
            await this.createAlert(
                'Повільний час відповіді',
                `Час відповіді ${metric.value}ms перевищує поріг ${thresholds.responseTimeMs}ms`,
                'warning',
                metric.tags?.endpoint || 'unknown'
            );
        }

        // Error rate
        if (metric.name === 'error_rate' && metric.value > thresholds.errorRatePercent) {
            await this.createAlert(
                'Високий рівень помилок',
                `Рівень помилок ${metric.value}% перевищує поріг ${thresholds.errorRatePercent}%`,
                'error',
                metric.tags?.service || 'unknown'
            );
        }

        // Memory usage
        if (metric.name === 'memory_usage' && metric.value > thresholds.memoryUsagePercent) {
            await this.createAlert(
                "Високе використання пам'яті",
                `Використання пам'яті ${metric.value}% перевищує поріг ${thresholds.memoryUsagePercent}%`,
                metric.value > 95 ? 'critical' : 'warning',
                'system'
            );
        }

        // CPU usage
        if (metric.name === 'cpu_usage' && metric.value > thresholds.cpuUsagePercent) {
            await this.createAlert(
                'Високе навантаження CPU',
                `Використання CPU ${metric.value}% перевищує поріг ${thresholds.cpuUsagePercent}%`,
                metric.value > 95 ? 'critical' : 'warning',
                'system'
            );
        }
    }

    /**
     * Отримати метрики за період
     */
    getMetrics(
        name?: string,
        since?: Date,
        until?: Date
    ): MetricPoint[] {
        return this.metrics.filter(m => {
            if (name && m.name !== name) return false;
            if (since && m.timestamp < since) return false;
            if (until && m.timestamp > until) return false;
            return true;
        });
    }

    /**
     * Отримати агреговані метрики
     */
    getAggregatedMetrics(name: string, periodMinutes: number = 60): {
        avg: number;
        min: number;
        max: number;
        count: number;
    } {
        const since = new Date(Date.now() - periodMinutes * 60 * 1000);
        const metrics = this.getMetrics(name, since);

        if (metrics.length === 0) {
            return { avg: 0, min: 0, max: 0, count: 0 };
        }

        const values = metrics.map(m => m.value);
        return {
            avg: values.reduce((a, b) => a + b, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            count: values.length,
        };
    }

    // ============================================
    // HEALTH CHECKS
    // ============================================

    /**
     * Зареєструвати health check
     */
    registerHealthCheck(
        name: string,
        checkFn: () => Promise<{ status: HealthCheck['status']; message?: string }>
    ): void {
        this.healthChecks.set(name, {
            name,
            status: 'healthy',
            lastCheck: new Date(0),
        });

        // Запустити періодичну перевірку
        this.runHealthCheck(name, checkFn);
    }

    /**
     * Запустити health check
     */
    private async runHealthCheck(
        name: string,
        checkFn: () => Promise<{ status: HealthCheck['status']; message?: string }>
    ): Promise<void> {
        const startTime = Date.now();

        try {
            const result = await checkFn();
            const responseTime = Date.now() - startTime;

            const previousStatus = this.healthChecks.get(name)?.status;

            this.healthChecks.set(name, {
                name,
                status: result.status,
                message: result.message,
                responseTime,
                lastCheck: new Date(),
            });

            // Алерт при зміні статусу
            if (previousStatus && previousStatus !== result.status) {
                if (result.status === 'unhealthy') {
                    await this.createAlert(
                        `Health check failed: ${name}`,
                        result.message || 'Service is unhealthy',
                        'critical',
                        'health-check'
                    );
                } else if (previousStatus === 'unhealthy' && result.status === 'healthy') {
                    await this.createAlert(
                        `Health check recovered: ${name}`,
                        'Service is healthy again',
                        'info',
                        'health-check'
                    );
                }
            }
        } catch (error) {
            this.healthChecks.set(name, {
                name,
                status: 'unhealthy',
                message: error instanceof Error ? error.message : 'Unknown error',
                responseTime: Date.now() - startTime,
                lastCheck: new Date(),
            });

            await this.createAlert(
                `Health check error: ${name}`,
                error instanceof Error ? error.message : 'Unknown error',
                'critical',
                'health-check'
            );
        }
    }

    /**
     * Отримати всі health checks
     */
    getHealthChecks(): HealthCheck[] {
        return Array.from(this.healthChecks.values());
    }

    /**
     * Отримати загальний статус системи
     */
    getOverallHealth(): {
        status: HealthCheck['status'];
        checks: HealthCheck[];
        timestamp: Date;
    } {
        const checks = this.getHealthChecks();

        let status: HealthCheck['status'] = 'healthy';
        if (checks.some(c => c.status === 'unhealthy')) {
            status = 'unhealthy';
        } else if (checks.some(c => c.status === 'degraded')) {
            status = 'degraded';
        }

        return {
            status,
            checks,
            timestamp: new Date(),
        };
    }
}

// Серверні функції моніторингу винесені в monitoring-server.ts
// щоб уникнути імпорту серверних модулів на клієнті

// ============================================
// SINGLETON EXPORT
// ============================================

const monitoringConfig: Partial<MonitoringConfig> = {
    enabled: process.env.NODE_ENV === 'production',
    channels: ['console'],
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
};

export const monitoring = new MonitoringService(monitoringConfig);

// Health checks реєструються в monitoring-server.ts
// для уникнення імпорту серверних модулів на клієнті

// ============================================
// CLIENT-SIDE MONITORING FUNCTIONS
// Для сумісності з AppInitializer
// ============================================

let isInitialized = false;
let currentUser: { id: string; email?: string; name?: string } | null = null;

/**
 * Ініціалізація моніторингу на клієнті
 */
export function initMonitoring(): void {
    if (isInitialized) return;
    isInitialized = true;

    // Підключення до аналітики (Google Analytics, Mixpanel, etc.)
    if (typeof window !== 'undefined') {
        console.log('[Monitoring] Client-side monitoring initialized');

        // Відправка помилок JavaScript
        window.onerror = (message, source, lineno, colno, error) => {
            monitoring.createAlert(
                'JavaScript Error',
                `${message} at ${source}:${lineno}:${colno}`,
                'error',
                'client-js',
                { error: error?.stack }
            );
        };

        // Відправка unhandled promise rejections
        window.onunhandledrejection = (event) => {
            monitoring.createAlert(
                'Unhandled Promise Rejection',
                event.reason?.message || String(event.reason),
                'error',
                'client-promise',
                { reason: event.reason }
            );
        };
    }
}

/**
 * Відстеження перегляду сторінки
 */
export function trackPageView(path: string): void {
    if (typeof window === 'undefined') return;

    monitoring.recordMetric('page_view', 1, {
        path,
        referrer: document.referrer || 'direct',
        userId: currentUser?.id || 'anonymous',
    });

    // Google Analytics (якщо підключено)
    if ((window as unknown as { gtag?: (cmd: string, event: string, params: object) => void }).gtag) {
        (window as unknown as { gtag: (cmd: string, event: string, params: object) => void }).gtag('event', 'page_view', {
            page_path: path,
            page_title: document.title,
        });
    }
}

/**
 * Встановлення поточного користувача
 */
export function setUser(user: { id: string; email?: string; name?: string } | null): void {
    currentUser = user;

    if (typeof window === 'undefined') return;

    // Google Analytics (якщо підключено)
    if (user && (window as unknown as { gtag?: (cmd: string, prop: string, val: string) => void }).gtag) {
        (window as unknown as { gtag: (cmd: string, prop: string, val: string) => void }).gtag('set', 'user_id', user.id);
    }

    // Sentry (якщо підключено)
    if ((window as unknown as { Sentry?: { setUser: (u: { id: string; email?: string } | null) => void } }).Sentry) {
        (window as unknown as { Sentry: { setUser: (u: { id: string; email?: string } | null) => void } }).Sentry.setUser(
            user ? { id: user.id, email: user.email } : null
        );
    }
}

/**
 * Відстеження події
 */
export function trackEvent(
    eventName: string,
    properties?: Record<string, unknown>
): void {
    if (typeof window === 'undefined') return;

    monitoring.recordMetric('custom_event', 1, {
        event: eventName,
        ...properties,
        userId: currentUser?.id || 'anonymous',
    });

    // Google Analytics (якщо підключено)
    if ((window as unknown as { gtag?: (cmd: string, event: string, params: object) => void }).gtag) {
        (window as unknown as { gtag: (cmd: string, event: string, params: object) => void }).gtag('event', eventName, properties || {});
    }
}

/**
 * Відстеження часу виконання
 */
export function trackTiming(
    category: string,
    variable: string,
    timeMs: number
): void {
    monitoring.recordMetric('timing', timeMs, {
        category,
        variable,
    });
}

export default monitoring;
