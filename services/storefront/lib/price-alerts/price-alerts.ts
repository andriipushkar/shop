// Price Alerts Service

export interface PriceAlert {
    id: string;
    userId: string;
    productId: string;
    productName: string;
    productImage?: string;
    currentPrice: number;
    targetPrice: number;
    alertType: 'any_drop' | 'target_price' | 'percentage_drop';
    percentageThreshold?: number;
    status: 'active' | 'triggered' | 'expired' | 'cancelled';
    notifyVia: ('email' | 'push' | 'sms')[];
    createdAt: string;
    triggeredAt?: string;
    expiresAt?: string;
    priceHistory: PricePoint[];
}

export interface PricePoint {
    price: number;
    date: string;
}

export interface PriceAlertCreateRequest {
    productId: string;
    productName: string;
    productImage?: string;
    currentPrice: number;
    targetPrice?: number;
    alertType: PriceAlert['alertType'];
    percentageThreshold?: number;
    notifyVia: ('email' | 'push' | 'sms')[];
    expiresAt?: string;
}

export interface PriceAlertStats {
    totalAlerts: number;
    activeAlerts: number;
    triggeredAlerts: number;
    totalSaved: number;
}

class PriceAlertService {
    private alerts: Map<string, PriceAlert> = new Map();
    private readonly storageKey = 'price_alerts';

    constructor() {
        this.loadFromStorage();
    }

    // Create new price alert
    async createAlert(
        userId: string,
        request: PriceAlertCreateRequest
    ): Promise<PriceAlert> {
        const alert: PriceAlert = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId,
            productId: request.productId,
            productName: request.productName,
            productImage: request.productImage,
            currentPrice: request.currentPrice,
            targetPrice: request.targetPrice || request.currentPrice * 0.9,
            alertType: request.alertType,
            percentageThreshold: request.percentageThreshold,
            status: 'active',
            notifyVia: request.notifyVia,
            createdAt: new Date().toISOString(),
            expiresAt: request.expiresAt || this.getDefaultExpiry(),
            priceHistory: [{ price: request.currentPrice, date: new Date().toISOString() }],
        };

        this.alerts.set(alert.id, alert);
        this.saveToStorage();

        // Send to server
        await this.syncWithServer(alert);

        return alert;
    }

    // Get all alerts for user
    getUserAlerts(userId: string): PriceAlert[] {
        return Array.from(this.alerts.values())
            .filter((alert) => alert.userId === userId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // Get active alerts for user
    getActiveAlerts(userId: string): PriceAlert[] {
        return this.getUserAlerts(userId).filter((alert) => alert.status === 'active');
    }

    // Get alert by ID
    getAlert(alertId: string): PriceAlert | undefined {
        return this.alerts.get(alertId);
    }

    // Check if product has active alert
    hasActiveAlert(userId: string, productId: string): boolean {
        return this.getUserAlerts(userId).some(
            (alert) => alert.productId === productId && alert.status === 'active'
        );
    }

    // Update alert
    async updateAlert(
        alertId: string,
        updates: Partial<Pick<PriceAlert, 'targetPrice' | 'alertType' | 'percentageThreshold' | 'notifyVia' | 'expiresAt'>>
    ): Promise<PriceAlert | null> {
        const alert = this.alerts.get(alertId);
        if (!alert) return null;

        const updatedAlert = { ...alert, ...updates };
        this.alerts.set(alertId, updatedAlert);
        this.saveToStorage();

        await this.syncWithServer(updatedAlert);

        return updatedAlert;
    }

    // Cancel alert
    async cancelAlert(alertId: string): Promise<boolean> {
        const alert = this.alerts.get(alertId);
        if (!alert) return false;

        alert.status = 'cancelled';
        this.alerts.set(alertId, alert);
        this.saveToStorage();

        await this.syncWithServer(alert);

        return true;
    }

    // Delete alert
    async deleteAlert(alertId: string): Promise<boolean> {
        const deleted = this.alerts.delete(alertId);
        if (deleted) {
            this.saveToStorage();
            await this.deleteFromServer(alertId);
        }
        return deleted;
    }

    // Check if price drop triggers alert
    checkPriceDrop(alert: PriceAlert, newPrice: number): boolean {
        if (alert.status !== 'active') return false;

        switch (alert.alertType) {
            case 'any_drop':
                return newPrice < alert.currentPrice;

            case 'target_price':
                return newPrice <= alert.targetPrice;

            case 'percentage_drop':
                const dropPercentage = ((alert.currentPrice - newPrice) / alert.currentPrice) * 100;
                return dropPercentage >= (alert.percentageThreshold || 10);

            default:
                return false;
        }
    }

    // Process price update
    async processPriceUpdate(productId: string, newPrice: number): Promise<PriceAlert[]> {
        const triggeredAlerts: PriceAlert[] = [];

        this.alerts.forEach((alert) => {
            if (alert.productId === productId && alert.status === 'active') {
                // Add to price history
                alert.priceHistory.push({ price: newPrice, date: new Date().toISOString() });

                // Check if alert should trigger
                if (this.checkPriceDrop(alert, newPrice)) {
                    alert.status = 'triggered';
                    alert.triggeredAt = new Date().toISOString();
                    triggeredAlerts.push(alert);

                    // Send notifications
                    this.sendNotifications(alert, newPrice);
                }
            }
        });

        if (triggeredAlerts.length > 0) {
            this.saveToStorage();
        }

        return triggeredAlerts;
    }

    // Get statistics
    getStats(userId: string): PriceAlertStats {
        const userAlerts = this.getUserAlerts(userId);
        const triggered = userAlerts.filter((a) => a.status === 'triggered');

        const totalSaved = triggered.reduce((sum, alert) => {
            const lastPrice = alert.priceHistory[alert.priceHistory.length - 1]?.price || alert.currentPrice;
            return sum + (alert.currentPrice - lastPrice);
        }, 0);

        return {
            totalAlerts: userAlerts.length,
            activeAlerts: userAlerts.filter((a) => a.status === 'active').length,
            triggeredAlerts: triggered.length,
            totalSaved: Math.max(0, totalSaved),
        };
    }

    // Get price history for product
    getPriceHistory(productId: string, days: number = 30): PricePoint[] {
        const alert = Array.from(this.alerts.values()).find((a) => a.productId === productId);
        if (!alert) return [];

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        return alert.priceHistory.filter(
            (point) => new Date(point.date) >= cutoffDate
        );
    }

    // Calculate potential savings
    calculateSavings(currentPrice: number, targetPrice: number): {
        amount: number;
        percentage: number;
    } {
        const amount = currentPrice - targetPrice;
        const percentage = (amount / currentPrice) * 100;
        return { amount, percentage };
    }

    // Get suggested target price
    getSuggestedTargetPrice(currentPrice: number): number {
        // Suggest 10% discount
        return Math.round(currentPrice * 0.9);
    }

    // Check expired alerts
    checkExpiredAlerts(): void {
        const now = new Date();

        this.alerts.forEach((alert) => {
            if (alert.status === 'active' && alert.expiresAt) {
                if (new Date(alert.expiresAt) < now) {
                    alert.status = 'expired';
                }
            }
        });

        this.saveToStorage();
    }

    // Private methods
    private getDefaultExpiry(): string {
        const date = new Date();
        date.setMonth(date.getMonth() + 3);
        return date.toISOString();
    }

    private async sendNotifications(alert: PriceAlert, newPrice: number): Promise<void> {
        const savings = this.calculateSavings(alert.currentPrice, newPrice);

        if (alert.notifyVia.includes('push')) {
            // Send push notification
            const { pushNotifications } = await import('@/lib/notifications/push-notifications');
            pushNotifications.showNotification(
                pushNotifications.createPriceDropNotification(
                    alert.productName,
                    alert.currentPrice,
                    newPrice,
                    alert.productId
                )
            );
        }

        if (alert.notifyVia.includes('email')) {
            // Send email via API
            await fetch('/api/notifications/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'price_alert',
                    alertId: alert.id,
                    newPrice,
                    savings,
                }),
            }).catch(() => {});
        }
    }

    private loadFromStorage(): void {
        if (typeof localStorage === 'undefined') return;

        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                const alerts: PriceAlert[] = JSON.parse(data);
                alerts.forEach((alert) => this.alerts.set(alert.id, alert));
            }
        } catch {
            // Ignore errors
        }
    }

    private saveToStorage(): void {
        if (typeof localStorage === 'undefined') return;

        try {
            const data = Array.from(this.alerts.values());
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch {
            // Ignore errors
        }
    }

    private async syncWithServer(alert: PriceAlert): Promise<void> {
        try {
            await fetch('/api/price-alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alert),
            });
        } catch {
            // Ignore errors, local storage is backup
        }
    }

    private async deleteFromServer(alertId: string): Promise<void> {
        try {
            await fetch(`/api/price-alerts/${alertId}`, {
                method: 'DELETE',
            });
        } catch {
            // Ignore errors
        }
    }

    // Clear all alerts (for testing)
    clearAll(): void {
        this.alerts.clear();
    }
}

// Export class for testing
export { PriceAlertService };

// Singleton instance
export const priceAlerts = new PriceAlertService();

// React hook
export function usePriceAlerts() {
    return priceAlerts;
}
