/**
 * Loyalty & Bonus System
 * Система лояльності та бонусів
 */

export interface LoyaltyConfig {
    pointsPerUah: number; // Скільки балів за 1 грн
    uahPerPoint: number; // Скільки грн коштує 1 бал
    minPointsToUse: number; // Мінімальна кількість балів для використання
    maxPointsPercentage: number; // Максимальний % замовлення який можна оплатити балами
    pointsExpireDays: number; // Через скільки днів згорають бали
    welcomeBonus: number; // Вітальний бонус
    birthdayBonus: number; // Бонус на день народження
    referralBonus: number; // Бонус за реферала
    reviewBonus: number; // Бонус за відгук
}

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface LoyaltyTierInfo {
    id: LoyaltyTier;
    name: string;
    nameUk: string;
    minPoints: number;
    cashbackPercent: number;
    pointsMultiplier: number;
    benefits: string[];
    color: string;
    icon: string;
}

export interface LoyaltyAccount {
    userId: string;
    currentPoints: number;
    lifetimePoints: number;
    tier: LoyaltyTier;
    nextTier?: LoyaltyTier;
    pointsToNextTier?: number;
    pendingPoints: number;
    expiringPoints: number;
    expiringDate?: string;
    referralCode: string;
    referralCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface PointsTransaction {
    id: string;
    userId: string;
    type: PointsTransactionType;
    amount: number;
    balance: number;
    description: string;
    orderId?: string;
    expiresAt?: string;
    createdAt: string;
}

export type PointsTransactionType =
    | 'earn_purchase' // Нарахування за покупку
    | 'earn_welcome' // Вітальний бонус
    | 'earn_birthday' // День народження
    | 'earn_referral' // За реферала
    | 'earn_review' // За відгук
    | 'earn_promo' // Промо-акція
    | 'earn_manual' // Ручне нарахування
    | 'spend_purchase' // Списання за покупку
    | 'spend_manual' // Ручне списання
    | 'expire' // Згорання балів
    | 'cancel' // Скасування транзакції
    | 'refund'; // Повернення балів

export interface EarnPointsRequest {
    userId: string;
    type: PointsTransactionType;
    amount: number;
    orderId?: string;
    description?: string;
}

export interface SpendPointsRequest {
    userId: string;
    points: number;
    orderId: string;
}

export interface ReferralInfo {
    code: string;
    userId: string;
    usedCount: number;
    earnedPoints: number;
    shareUrl: string;
}

// Конфігурація за замовчуванням
const DEFAULT_CONFIG: LoyaltyConfig = {
    pointsPerUah: 0.05, // 5% кешбек базовий
    uahPerPoint: 1, // 1 бал = 1 грн
    minPointsToUse: 100,
    maxPointsPercentage: 50, // Максимум 50% замовлення балами
    pointsExpireDays: 365,
    welcomeBonus: 100,
    birthdayBonus: 500,
    referralBonus: 200,
    reviewBonus: 50,
};

// Рівні лояльності
export const LOYALTY_TIERS: LoyaltyTierInfo[] = [
    {
        id: 'bronze',
        name: 'Bronze',
        nameUk: 'Бронза',
        minPoints: 0,
        cashbackPercent: 3,
        pointsMultiplier: 1,
        benefits: ['Базовий кешбек 3%', 'Доступ до акцій'],
        color: '#CD7F32',
        icon: '🥉',
    },
    {
        id: 'silver',
        name: 'Silver',
        nameUk: 'Срібло',
        minPoints: 1000,
        cashbackPercent: 5,
        pointsMultiplier: 1.25,
        benefits: ['Кешбек 5%', 'Множник балів x1.25', 'Ранній доступ до розпродажів'],
        color: '#C0C0C0',
        icon: '🥈',
    },
    {
        id: 'gold',
        name: 'Gold',
        nameUk: 'Золото',
        minPoints: 5000,
        cashbackPercent: 7,
        pointsMultiplier: 1.5,
        benefits: ['Кешбек 7%', 'Множник балів x1.5', 'Безкоштовна доставка від 500 грн', 'Подарунок на день народження'],
        color: '#FFD700',
        icon: '🥇',
    },
    {
        id: 'platinum',
        name: 'Platinum',
        nameUk: 'Платина',
        minPoints: 15000,
        cashbackPercent: 10,
        pointsMultiplier: 2,
        benefits: ['Кешбек 10%', 'Множник балів x2', 'Безкоштовна доставка', 'Пріоритетна підтримка', 'Ексклюзивні пропозиції'],
        color: '#E5E4E2',
        icon: '💎',
    },
    {
        id: 'diamond',
        name: 'Diamond',
        nameUk: 'Діамант',
        minPoints: 50000,
        cashbackPercent: 15,
        pointsMultiplier: 3,
        benefits: ['Кешбек 15%', 'Множник балів x3', 'VIP-доставка', 'Персональний менеджер', 'Запрошення на закриті події'],
        color: '#B9F2FF',
        icon: '👑',
    },
];

class LoyaltyService {
    private config: LoyaltyConfig;
    private accounts: Map<string, LoyaltyAccount> = new Map();
    private transactions: Map<string, PointsTransaction[]> = new Map();

    constructor(config?: Partial<LoyaltyConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Отримання акаунту лояльності
     */
    async getAccount(userId: string): Promise<LoyaltyAccount | null> {
        // В продакшні - запит до БД
        return this.accounts.get(userId) || null;
    }

    /**
     * Створення акаунту лояльності
     */
    async createAccount(userId: string): Promise<LoyaltyAccount> {
        const referralCode = this.generateReferralCode();

        const account: LoyaltyAccount = {
            userId,
            currentPoints: 0,
            lifetimePoints: 0,
            tier: 'bronze',
            pendingPoints: 0,
            expiringPoints: 0,
            referralCode,
            referralCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        this.accounts.set(userId, account);
        this.transactions.set(userId, []);

        // Нарахування вітального бонусу
        if (this.config.welcomeBonus > 0) {
            await this.earnPoints({
                userId,
                type: 'earn_welcome',
                amount: this.config.welcomeBonus,
                description: 'Вітальний бонус',
            });
        }

        return account;
    }

    /**
     * Нарахування балів
     */
    async earnPoints(request: EarnPointsRequest): Promise<PointsTransaction> {
        let account = await this.getAccount(request.userId);
        if (!account) {
            account = await this.createAccount(request.userId);
        }

        const tierInfo = this.getTierInfo(account.tier);
        const multipliedAmount = Math.floor(request.amount * tierInfo.pointsMultiplier);

        const transaction: PointsTransaction = {
            id: Date.now().toString(),
            userId: request.userId,
            type: request.type,
            amount: multipliedAmount,
            balance: account.currentPoints + multipliedAmount,
            description: request.description || this.getTransactionDescription(request.type),
            orderId: request.orderId,
            expiresAt: new Date(Date.now() + this.config.pointsExpireDays * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date().toISOString(),
        };

        // Оновлення акаунту
        account.currentPoints += multipliedAmount;
        account.lifetimePoints += multipliedAmount;
        account.updatedAt = new Date().toISOString();

        // Перевірка рівня
        await this.checkTierUpgrade(account);

        // Збереження транзакції
        const userTransactions = this.transactions.get(request.userId) || [];
        userTransactions.push(transaction);
        this.transactions.set(request.userId, userTransactions);

        return transaction;
    }

    /**
     * Нарахування балів за покупку
     */
    async earnPointsForPurchase(userId: string, orderTotal: number, orderId: string): Promise<PointsTransaction> {
        const account = await this.getAccount(userId);
        const tierInfo = account ? this.getTierInfo(account.tier) : LOYALTY_TIERS[0];

        const basePoints = Math.floor(orderTotal * (tierInfo.cashbackPercent / 100));

        return this.earnPoints({
            userId,
            type: 'earn_purchase',
            amount: basePoints,
            orderId,
            description: `Кешбек ${tierInfo.cashbackPercent}% за замовлення #${orderId}`,
        });
    }

    /**
     * Списання балів
     */
    async spendPoints(request: SpendPointsRequest): Promise<PointsTransaction> {
        const account = await this.getAccount(request.userId);
        if (!account) {
            throw new Error('Loyalty account not found');
        }

        if (account.currentPoints < request.points) {
            throw new Error('Insufficient points');
        }

        if (request.points < this.config.minPointsToUse) {
            throw new Error(`Minimum ${this.config.minPointsToUse} points required`);
        }

        const transaction: PointsTransaction = {
            id: Date.now().toString(),
            userId: request.userId,
            type: 'spend_purchase',
            amount: -request.points,
            balance: account.currentPoints - request.points,
            description: `Списання за замовлення #${request.orderId}`,
            orderId: request.orderId,
            createdAt: new Date().toISOString(),
        };

        // Оновлення акаунту
        account.currentPoints -= request.points;
        account.updatedAt = new Date().toISOString();

        // Збереження транзакції
        const userTransactions = this.transactions.get(request.userId) || [];
        userTransactions.push(transaction);
        this.transactions.set(request.userId, userTransactions);

        return transaction;
    }

    /**
     * Розрахунок знижки за бали
     */
    calculatePointsDiscount(points: number, orderTotal: number): {
        discount: number;
        pointsToUse: number;
        remaining: number;
    } {
        const maxDiscount = orderTotal * (this.config.maxPointsPercentage / 100);
        const pointsValue = points * this.config.uahPerPoint;

        const discount = Math.min(pointsValue, maxDiscount);
        const pointsToUse = Math.ceil(discount / this.config.uahPerPoint);

        return {
            discount,
            pointsToUse,
            remaining: points - pointsToUse,
        };
    }

    /**
     * Отримання історії транзакцій
     */
    async getTransactionHistory(userId: string, limit: number = 50): Promise<PointsTransaction[]> {
        const transactions = this.transactions.get(userId) || [];
        return transactions.slice(-limit).reverse();
    }

    /**
     * Отримання інформації про рівень
     */
    getTierInfo(tier: LoyaltyTier): LoyaltyTierInfo {
        return LOYALTY_TIERS.find(t => t.id === tier) || LOYALTY_TIERS[0];
    }

    /**
     * Перевірка підвищення рівня
     */
    private async checkTierUpgrade(account: LoyaltyAccount): Promise<void> {
        const currentTierIndex = LOYALTY_TIERS.findIndex(t => t.id === account.tier);
        const nextTier = LOYALTY_TIERS[currentTierIndex + 1];

        if (nextTier && account.lifetimePoints >= nextTier.minPoints) {
            account.tier = nextTier.id;
            account.nextTier = LOYALTY_TIERS[currentTierIndex + 2]?.id;
            account.pointsToNextTier = LOYALTY_TIERS[currentTierIndex + 2]
                ? LOYALTY_TIERS[currentTierIndex + 2].minPoints - account.lifetimePoints
                : undefined;
        } else if (nextTier) {
            account.nextTier = nextTier.id;
            account.pointsToNextTier = nextTier.minPoints - account.lifetimePoints;
        }
    }

    /**
     * Застосування реферального коду
     */
    async applyReferralCode(newUserId: string, referralCode: string): Promise<boolean> {
        // Знайти власника коду
        let referrerAccount: LoyaltyAccount | null = null;
        for (const account of this.accounts.values()) {
            if (account.referralCode === referralCode && account.userId !== newUserId) {
                referrerAccount = account;
                break;
            }
        }

        if (!referrerAccount) {
            return false;
        }

        // Нарахувати бонуси обом
        await this.earnPoints({
            userId: referrerAccount.userId,
            type: 'earn_referral',
            amount: this.config.referralBonus,
            description: 'Бонус за запрошеного друга',
        });

        await this.earnPoints({
            userId: newUserId,
            type: 'earn_referral',
            amount: this.config.referralBonus,
            description: 'Бонус за реєстрацію по запрошенню',
        });

        referrerAccount.referralCount++;

        return true;
    }

    /**
     * Нарахування бонусу на день народження
     */
    async applyBirthdayBonus(userId: string): Promise<PointsTransaction | null> {
        const account = await this.getAccount(userId);
        if (!account) return null;

        return this.earnPoints({
            userId,
            type: 'earn_birthday',
            amount: this.config.birthdayBonus,
            description: 'Бонус на день народження! 🎂',
        });
    }

    /**
     * Нарахування бонусу за відгук
     */
    async applyReviewBonus(userId: string, productId: string): Promise<PointsTransaction> {
        return this.earnPoints({
            userId,
            type: 'earn_review',
            amount: this.config.reviewBonus,
            description: `Бонус за відгук про товар`,
        });
    }

    /**
     * Генерація реферального коду
     */
    private generateReferralCode(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    /**
     * Опис транзакції
     */
    private getTransactionDescription(type: PointsTransactionType): string {
        const descriptions: Record<PointsTransactionType, string> = {
            earn_purchase: 'Кешбек за покупку',
            earn_welcome: 'Вітальний бонус',
            earn_birthday: 'Бонус на день народження',
            earn_referral: 'Реферальний бонус',
            earn_review: 'Бонус за відгук',
            earn_promo: 'Промо-акція',
            earn_manual: 'Нарахування',
            spend_purchase: 'Списання за покупку',
            spend_manual: 'Списання',
            expire: 'Згорання балів',
            cancel: 'Скасування',
            refund: 'Повернення балів',
        };
        return descriptions[type] || 'Транзакція';
    }

    /**
     * Отримання реферальної інформації
     */
    async getReferralInfo(userId: string): Promise<ReferralInfo | null> {
        const account = await this.getAccount(userId);
        if (!account) return null;

        const transactions = this.transactions.get(userId) || [];
        const referralEarnings = transactions
            .filter(t => t.type === 'earn_referral')
            .reduce((sum, t) => sum + t.amount, 0);

        return {
            code: account.referralCode,
            userId: account.userId,
            usedCount: account.referralCount,
            earnedPoints: referralEarnings,
            shareUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/register?ref=${account.referralCode}`,
        };
    }

    /**
     * Отримання прогресу до наступного рівня
     */
    async getTierProgress(userId: string): Promise<{
        current: LoyaltyTierInfo;
        next: LoyaltyTierInfo | null;
        progress: number;
        pointsNeeded: number;
    } | null> {
        const account = await this.getAccount(userId);
        if (!account) return null;

        const currentTier = this.getTierInfo(account.tier);
        const currentIndex = LOYALTY_TIERS.findIndex(t => t.id === account.tier);
        const nextTier = LOYALTY_TIERS[currentIndex + 1] || null;

        if (!nextTier) {
            return {
                current: currentTier,
                next: null,
                progress: 100,
                pointsNeeded: 0,
            };
        }

        const pointsInTier = account.lifetimePoints - currentTier.minPoints;
        const pointsForNextTier = nextTier.minPoints - currentTier.minPoints;
        const progress = Math.min(100, Math.round((pointsInTier / pointsForNextTier) * 100));

        return {
            current: currentTier,
            next: nextTier,
            progress,
            pointsNeeded: nextTier.minPoints - account.lifetimePoints,
        };
    }
}

// Singleton instance
export const loyalty = new LoyaltyService();

// React hook
export function useLoyalty() {
    return loyalty;
}
