'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type GiftCardStatus = 'active' | 'used' | 'expired' | 'cancelled';

export interface GiftCard {
    id: string;
    code: string;
    initialBalance: number;
    currentBalance: number;
    currency: string;
    status: GiftCardStatus;
    purchasedBy?: string;
    recipientEmail?: string;
    recipientName?: string;
    message?: string;
    design: string;
    purchasedAt: string;
    activatedAt?: string;
    expiresAt: string;
    usedAt?: string;
    transactions: GiftCardTransaction[];
}

export interface GiftCardTransaction {
    id: string;
    type: 'purchase' | 'redeem' | 'refund';
    amount: number;
    orderId?: string;
    description: string;
    createdAt: string;
}

export interface GiftCardDesign {
    id: string;
    name: string;
    imageUrl: string;
    category: 'birthday' | 'holiday' | 'general' | 'corporate';
}

interface GiftCardContextType {
    giftCards: GiftCard[];
    designs: GiftCardDesign[];
    purchaseGiftCard: (data: PurchaseGiftCardData) => { success: boolean; giftCard?: GiftCard; message: string };
    redeemGiftCard: (code: string, amount: number, orderId: string) => { success: boolean; message: string; remainingBalance?: number };
    checkBalance: (code: string) => { success: boolean; balance?: number; expiresAt?: string; message: string };
    getGiftCard: (code: string) => GiftCard | undefined;
    getUserGiftCards: (userId: string) => GiftCard[];
    cancelGiftCard: (id: string) => { success: boolean; message: string };
}

interface PurchaseGiftCardData {
    amount: number;
    designId: string;
    purchasedBy: string;
    recipientEmail?: string;
    recipientName?: string;
    message?: string;
    sendDate?: string; // for scheduled delivery
}

const GiftCardContext = createContext<GiftCardContextType | undefined>(undefined);

const designs: GiftCardDesign[] = [
    { id: '1', name: 'День народження', imageUrl: '/gift-cards/birthday.jpg', category: 'birthday' },
    { id: '2', name: 'Новий рік', imageUrl: '/gift-cards/newyear.jpg', category: 'holiday' },
    { id: '3', name: 'Різдво', imageUrl: '/gift-cards/christmas.jpg', category: 'holiday' },
    { id: '4', name: 'Подяка', imageUrl: '/gift-cards/thankyou.jpg', category: 'general' },
    { id: '5', name: 'Вітання', imageUrl: '/gift-cards/congrats.jpg', category: 'general' },
    { id: '6', name: 'Корпоративний', imageUrl: '/gift-cards/corporate.jpg', category: 'corporate' },
];

const generateCode = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) code += '-';
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// Mock gift cards
const initialGiftCards: GiftCard[] = [
    {
        id: '1',
        code: 'GIFT-ABCD-1234-EFGH',
        initialBalance: 1000,
        currentBalance: 750,
        currency: 'UAH',
        status: 'active',
        purchasedBy: 'user1',
        recipientEmail: 'friend@example.com',
        recipientName: 'Олена',
        message: 'З Днем народження!',
        design: '1',
        purchasedAt: '2024-01-01T10:00:00',
        activatedAt: '2024-01-02T15:30:00',
        expiresAt: '2025-01-01T23:59:59',
        transactions: [
            {
                id: '1',
                type: 'purchase',
                amount: 1000,
                description: 'Придбання сертифікату',
                createdAt: '2024-01-01T10:00:00',
            },
            {
                id: '2',
                type: 'redeem',
                amount: -250,
                orderId: '12345',
                description: 'Оплата замовлення #12345',
                createdAt: '2024-01-15T14:20:00',
            },
        ],
    },
    {
        id: '2',
        code: 'GIFT-WXYZ-5678-IJKL',
        initialBalance: 500,
        currentBalance: 500,
        currency: 'UAH',
        status: 'active',
        purchasedBy: 'user2',
        design: '3',
        purchasedAt: '2024-01-10T12:00:00',
        expiresAt: '2025-01-10T23:59:59',
        transactions: [
            {
                id: '1',
                type: 'purchase',
                amount: 500,
                description: 'Придбання сертифікату',
                createdAt: '2024-01-10T12:00:00',
            },
        ],
    },
    {
        id: '3',
        code: 'GIFT-TEST-0000-DEMO',
        initialBalance: 2000,
        currentBalance: 0,
        currency: 'UAH',
        status: 'used',
        purchasedBy: 'user1',
        recipientEmail: 'test@example.com',
        design: '5',
        purchasedAt: '2023-06-01T09:00:00',
        activatedAt: '2023-06-05T11:00:00',
        expiresAt: '2024-06-01T23:59:59',
        usedAt: '2023-12-20T16:45:00',
        transactions: [
            {
                id: '1',
                type: 'purchase',
                amount: 2000,
                description: 'Придбання сертифікату',
                createdAt: '2023-06-01T09:00:00',
            },
            {
                id: '2',
                type: 'redeem',
                amount: -1500,
                orderId: '11000',
                description: 'Оплата замовлення #11000',
                createdAt: '2023-10-15T10:30:00',
            },
            {
                id: '3',
                type: 'redeem',
                amount: -500,
                orderId: '11500',
                description: 'Оплата замовлення #11500',
                createdAt: '2023-12-20T16:45:00',
            },
        ],
    },
];

export function GiftCardProvider({ children }: { children: ReactNode }) {
    const [giftCards, setGiftCards] = useState<GiftCard[]>(initialGiftCards);

    const purchaseGiftCard = useCallback((data: PurchaseGiftCardData): { success: boolean; giftCard?: GiftCard; message: string } => {
        if (data.amount < 100) {
            return { success: false, message: 'Мінімальна сума сертифікату: 100 ₴' };
        }

        if (data.amount > 10000) {
            return { success: false, message: 'Максимальна сума сертифікату: 10 000 ₴' };
        }

        const code = generateCode();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

        const newGiftCard: GiftCard = {
            id: Date.now().toString(),
            code,
            initialBalance: data.amount,
            currentBalance: data.amount,
            currency: 'UAH',
            status: 'active',
            purchasedBy: data.purchasedBy,
            recipientEmail: data.recipientEmail,
            recipientName: data.recipientName,
            message: data.message,
            design: data.designId,
            purchasedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            transactions: [{
                id: '1',
                type: 'purchase',
                amount: data.amount,
                description: 'Придбання сертифікату',
                createdAt: now.toISOString(),
            }],
        };

        setGiftCards(prev => [...prev, newGiftCard]);

        return {
            success: true,
            giftCard: newGiftCard,
            message: `Сертифікат на ${data.amount} ₴ успішно створено!`,
        };
    }, []);

    const redeemGiftCard = useCallback((code: string, amount: number, orderId: string): { success: boolean; message: string; remainingBalance?: number } => {
        const giftCard = giftCards.find(gc => gc.code.toUpperCase() === code.toUpperCase());

        if (!giftCard) {
            return { success: false, message: 'Сертифікат не знайдено' };
        }

        if (giftCard.status !== 'active') {
            return { success: false, message: `Сертифікат ${giftCard.status === 'used' ? 'вже використано' : giftCard.status === 'expired' ? 'прострочено' : 'скасовано'}` };
        }

        if (new Date(giftCard.expiresAt) < new Date()) {
            setGiftCards(prev => prev.map(gc =>
                gc.id === giftCard.id ? { ...gc, status: 'expired' as GiftCardStatus } : gc
            ));
            return { success: false, message: 'Термін дії сертифікату закінчився' };
        }

        if (amount > giftCard.currentBalance) {
            return { success: false, message: `Недостатньо коштів на сертифікаті. Баланс: ${giftCard.currentBalance} ₴` };
        }

        const newBalance = giftCard.currentBalance - amount;
        const transaction: GiftCardTransaction = {
            id: Date.now().toString(),
            type: 'redeem',
            amount: -amount,
            orderId,
            description: `Оплата замовлення #${orderId}`,
            createdAt: new Date().toISOString(),
        };

        setGiftCards(prev => prev.map(gc =>
            gc.id === giftCard.id ? {
                ...gc,
                currentBalance: newBalance,
                status: newBalance === 0 ? 'used' as GiftCardStatus : gc.status,
                usedAt: newBalance === 0 ? new Date().toISOString() : gc.usedAt,
                activatedAt: gc.activatedAt || new Date().toISOString(),
                transactions: [...gc.transactions, transaction],
            } : gc
        ));

        return {
            success: true,
            message: `Списано ${amount} ₴ з сертифікату`,
            remainingBalance: newBalance,
        };
    }, [giftCards]);

    const checkBalance = useCallback((code: string): { success: boolean; balance?: number; expiresAt?: string; message: string } => {
        const giftCard = giftCards.find(gc => gc.code.toUpperCase() === code.toUpperCase());

        if (!giftCard) {
            return { success: false, message: 'Сертифікат не знайдено' };
        }

        if (giftCard.status === 'expired' || new Date(giftCard.expiresAt) < new Date()) {
            return { success: false, message: 'Термін дії сертифікату закінчився', balance: 0 };
        }

        if (giftCard.status === 'cancelled') {
            return { success: false, message: 'Сертифікат скасовано', balance: 0 };
        }

        return {
            success: true,
            balance: giftCard.currentBalance,
            expiresAt: giftCard.expiresAt,
            message: `Баланс: ${giftCard.currentBalance} ₴`,
        };
    }, [giftCards]);

    const getGiftCard = useCallback((code: string): GiftCard | undefined => {
        return giftCards.find(gc => gc.code.toUpperCase() === code.toUpperCase());
    }, [giftCards]);

    const getUserGiftCards = useCallback((userId: string): GiftCard[] => {
        return giftCards.filter(gc => gc.purchasedBy === userId);
    }, [giftCards]);

    const cancelGiftCard = useCallback((id: string): { success: boolean; message: string } => {
        const giftCard = giftCards.find(gc => gc.id === id);

        if (!giftCard) {
            return { success: false, message: 'Сертифікат не знайдено' };
        }

        if (giftCard.status !== 'active') {
            return { success: false, message: 'Можна скасувати тільки активні сертифікати' };
        }

        if (giftCard.currentBalance !== giftCard.initialBalance) {
            return { success: false, message: 'Неможливо скасувати частково використаний сертифікат' };
        }

        setGiftCards(prev => prev.map(gc =>
            gc.id === id ? { ...gc, status: 'cancelled' as GiftCardStatus } : gc
        ));

        return { success: true, message: 'Сертифікат скасовано' };
    }, [giftCards]);

    return (
        <GiftCardContext.Provider value={{
            giftCards,
            designs,
            purchaseGiftCard,
            redeemGiftCard,
            checkBalance,
            getGiftCard,
            getUserGiftCards,
            cancelGiftCard,
        }}>
            {children}
        </GiftCardContext.Provider>
    );
}

export function useGiftCards() {
    const context = useContext(GiftCardContext);
    if (context === undefined) {
        throw new Error('useGiftCards must be used within a GiftCardProvider');
    }
    return context;
}
