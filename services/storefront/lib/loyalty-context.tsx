'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface LoyaltyTierConfig {
    name: string;
    nameUk: string;
    minPoints: number;
    pointsMultiplier: number; // bonus points multiplier
    discountPercent: number;
    freeShippingThreshold: number;
    birthdayBonus: number;
    exclusiveAccess: boolean;
    color: string;
    icon: string;
}

export interface LoyaltyTransaction {
    id: string;
    type: 'earn' | 'redeem' | 'expire' | 'bonus' | 'adjustment';
    points: number;
    description: string;
    orderId?: string;
    createdAt: string;
    expiresAt?: string;
}

export interface LoyaltyAccount {
    id: string;
    userId: string;
    currentPoints: number;
    lifetimePoints: number;
    tier: LoyaltyTier;
    transactions: LoyaltyTransaction[];
    joinedAt: string;
    lastActivityAt: string;
}

interface LoyaltyContextType {
    account: LoyaltyAccount | null;
    tierConfig: Record<LoyaltyTier, LoyaltyTierConfig>;
    earnPoints: (orderId: string, orderAmount: number, description?: string) => number;
    redeemPoints: (points: number, description: string) => { success: boolean; message: string };
    getPointsValue: (points: number) => number; // converts points to UAH
    getRequiredPoints: (amount: number) => number; // UAH to points
    getTierProgress: () => { current: LoyaltyTier; next: LoyaltyTier | null; progress: number; pointsToNext: number };
    getExpiringPoints: (days: number) => number;
    addBonusPoints: (points: number, description: string) => void;
    initializeAccount: (userId: string) => void;
}

const tierConfig: Record<LoyaltyTier, LoyaltyTierConfig> = {
    bronze: {
        name: 'Bronze',
        nameUk: 'Бронзовий',
        minPoints: 0,
        pointsMultiplier: 1,
        discountPercent: 0,
        freeShippingThreshold: 2000,
        birthdayBonus: 100,
        exclusiveAccess: false,
        color: '#CD7F32',
        icon: '🥉',
    },
    silver: {
        name: 'Silver',
        nameUk: 'Срібний',
        minPoints: 1000,
        pointsMultiplier: 1.25,
        discountPercent: 3,
        freeShippingThreshold: 1500,
        birthdayBonus: 250,
        exclusiveAccess: false,
        color: '#C0C0C0',
        icon: '🥈',
    },
    gold: {
        name: 'Gold',
        nameUk: 'Золотий',
        minPoints: 5000,
        pointsMultiplier: 1.5,
        discountPercent: 5,
        freeShippingThreshold: 1000,
        birthdayBonus: 500,
        exclusiveAccess: true,
        color: '#FFD700',
        icon: '🥇',
    },
    platinum: {
        name: 'Platinum',
        nameUk: 'Платиновий',
        minPoints: 15000,
        pointsMultiplier: 2,
        discountPercent: 10,
        freeShippingThreshold: 0,
        birthdayBonus: 1000,
        exclusiveAccess: true,
        color: '#E5E4E2',
        icon: '💎',
    },
};

const POINTS_PER_UAH = 1; // 1 point per 1 UAH spent
const UAH_PER_POINT = 0.5; // 1 point = 0.5 UAH discount

const LoyaltyContext = createContext<LoyaltyContextType | undefined>(undefined);

// Mock account
const mockAccount: LoyaltyAccount = {
    id: '1',
    userId: '1',
    currentPoints: 2450,
    lifetimePoints: 8750,
    tier: 'silver',
    transactions: [
        {
            id: '1',
            type: 'earn',
            points: 350,
            description: 'Замовлення #12350',
            orderId: '12350',
            createdAt: '2024-01-15T10:30:00',
            expiresAt: '2025-01-15T10:30:00',
        },
        {
            id: '2',
            type: 'earn',
            points: 500,
            description: 'Замовлення #12345',
            orderId: '12345',
            createdAt: '2024-01-10T14:20:00',
            expiresAt: '2025-01-10T14:20:00',
        },
        {
            id: '3',
            type: 'redeem',
            points: -200,
            description: 'Знижка на замовлення #12340',
            orderId: '12340',
            createdAt: '2024-01-05T09:15:00',
        },
        {
            id: '4',
            type: 'bonus',
            points: 500,
            description: 'Бонус до дня народження',
            createdAt: '2024-01-01T00:00:00',
            expiresAt: '2024-02-01T00:00:00',
        },
        {
            id: '5',
            type: 'earn',
            points: 1300,
            description: 'Замовлення #12330',
            orderId: '12330',
            createdAt: '2023-12-20T11:45:00',
            expiresAt: '2024-12-20T11:45:00',
        },
    ],
    joinedAt: '2023-06-15T00:00:00',
    lastActivityAt: '2024-01-15T10:30:00',
};

export function LoyaltyProvider({ children }: { children: ReactNode }) {
    const [account, setAccount] = useState<LoyaltyAccount | null>(null);

    useEffect(() => {
        // Load from localStorage in real app
        setAccount(mockAccount);
    }, []);

    const calculateTier = useCallback((lifetimePoints: number): LoyaltyTier => {
        if (lifetimePoints >= tierConfig.platinum.minPoints) return 'platinum';
        if (lifetimePoints >= tierConfig.gold.minPoints) return 'gold';
        if (lifetimePoints >= tierConfig.silver.minPoints) return 'silver';
        return 'bronze';
    }, []);

    const earnPoints = useCallback((orderId: string, orderAmount: number, description?: string): number => {
        if (!account) return 0;

        const currentTierConfig = tierConfig[account.tier];
        const basePoints = Math.floor(orderAmount * POINTS_PER_UAH);
        const earnedPoints = Math.floor(basePoints * currentTierConfig.pointsMultiplier);

        const transaction: LoyaltyTransaction = {
            id: Date.now().toString(),
            type: 'earn',
            points: earnedPoints,
            description: description || `Замовлення #${orderId}`,
            orderId,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        };

        const newLifetimePoints = account.lifetimePoints + earnedPoints;
        const newTier = calculateTier(newLifetimePoints);

        setAccount(prev => prev ? {
            ...prev,
            currentPoints: prev.currentPoints + earnedPoints,
            lifetimePoints: newLifetimePoints,
            tier: newTier,
            transactions: [transaction, ...prev.transactions],
            lastActivityAt: new Date().toISOString(),
        } : null);

        return earnedPoints;
    }, [account, calculateTier]);

    const redeemPoints = useCallback((points: number, description: string): { success: boolean; message: string } => {
        if (!account) {
            return { success: false, message: 'Акаунт не знайдено' };
        }

        if (points <= 0) {
            return { success: false, message: 'Невірна кількість балів' };
        }

        if (points > account.currentPoints) {
            return { success: false, message: `Недостатньо балів. Доступно: ${account.currentPoints}` };
        }

        const transaction: LoyaltyTransaction = {
            id: Date.now().toString(),
            type: 'redeem',
            points: -points,
            description,
            createdAt: new Date().toISOString(),
        };

        setAccount(prev => prev ? {
            ...prev,
            currentPoints: prev.currentPoints - points,
            transactions: [transaction, ...prev.transactions],
            lastActivityAt: new Date().toISOString(),
        } : null);

        const discount = getPointsValue(points);
        return { success: true, message: `Списано ${points} балів. Знижка: ${discount} ₴` };
    }, [account]);

    const getPointsValue = useCallback((points: number): number => {
        return Math.floor(points * UAH_PER_POINT);
    }, []);

    const getRequiredPoints = useCallback((amount: number): number => {
        return Math.ceil(amount / UAH_PER_POINT);
    }, []);

    const getTierProgress = useCallback(() => {
        if (!account) {
            return { current: 'bronze' as LoyaltyTier, next: 'silver' as LoyaltyTier, progress: 0, pointsToNext: 1000 };
        }

        const tiers: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum'];
        const currentIndex = tiers.indexOf(account.tier);
        const nextTier = currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;

        if (!nextTier) {
            return { current: account.tier, next: null, progress: 100, pointsToNext: 0 };
        }

        const currentMin = tierConfig[account.tier].minPoints;
        const nextMin = tierConfig[nextTier].minPoints;
        const progress = Math.min(100, ((account.lifetimePoints - currentMin) / (nextMin - currentMin)) * 100);
        const pointsToNext = Math.max(0, nextMin - account.lifetimePoints);

        return { current: account.tier, next: nextTier, progress, pointsToNext };
    }, [account]);

    const getExpiringPoints = useCallback((days: number): number => {
        if (!account) return 0;

        const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

        return account.transactions
            .filter(t => t.type === 'earn' || t.type === 'bonus')
            .filter(t => t.expiresAt && new Date(t.expiresAt) <= expiryDate)
            .reduce((sum, t) => sum + t.points, 0);
    }, [account]);

    const addBonusPoints = useCallback((points: number, description: string) => {
        if (!account) return;

        const transaction: LoyaltyTransaction = {
            id: Date.now().toString(),
            type: 'bonus',
            points,
            description,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        };

        setAccount(prev => prev ? {
            ...prev,
            currentPoints: prev.currentPoints + points,
            lifetimePoints: prev.lifetimePoints + points,
            transactions: [transaction, ...prev.transactions],
            lastActivityAt: new Date().toISOString(),
        } : null);
    }, [account]);

    const initializeAccount = useCallback((userId: string) => {
        const newAccount: LoyaltyAccount = {
            id: Date.now().toString(),
            userId,
            currentPoints: 0,
            lifetimePoints: 0,
            tier: 'bronze',
            transactions: [],
            joinedAt: new Date().toISOString(),
            lastActivityAt: new Date().toISOString(),
        };
        setAccount(newAccount);
    }, []);

    return (
        <LoyaltyContext.Provider value={{
            account,
            tierConfig,
            earnPoints,
            redeemPoints,
            getPointsValue,
            getRequiredPoints,
            getTierProgress,
            getExpiringPoints,
            addBonusPoints,
            initializeAccount,
        }}>
            {children}
        </LoyaltyContext.Provider>
    );
}

export function useLoyalty() {
    const context = useContext(LoyaltyContext);
    if (context === undefined) {
        throw new Error('useLoyalty must be used within a LoyaltyProvider');
    }
    return context;
}
