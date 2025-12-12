'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type DiscountType = 'percentage' | 'fixed' | 'free_shipping' | 'buy_x_get_y';

export interface PromoCode {
    id: string;
    code: string;
    name: string;
    description: string;
    discountType: DiscountType;
    discountValue: number; // percentage or fixed amount
    minOrderAmount?: number;
    maxDiscountAmount?: number; // cap for percentage discounts
    buyQuantity?: number; // for buy_x_get_y
    getQuantity?: number; // for buy_x_get_y
    applicableCategories?: string[]; // empty = all categories
    applicableProducts?: string[]; // empty = all products
    usageLimit?: number;
    usageCount: number;
    userUsageLimit?: number; // per user
    startDate: string;
    endDate: string;
    isActive: boolean;
    createdAt: string;
}

export interface AppliedPromo {
    code: PromoCode;
    discountAmount: number;
}

interface PromoContextType {
    promoCodes: PromoCode[];
    appliedPromo: AppliedPromo | null;
    applyPromoCode: (code: string, orderAmount: number, cartItems?: CartItem[]) => { success: boolean; message: string; discount?: number };
    removePromoCode: () => void;
    calculateDiscount: (code: PromoCode, orderAmount: number, cartItems?: CartItem[]) => number;
    validatePromoCode: (code: string) => { valid: boolean; message: string; promoCode?: PromoCode };
    // Admin functions
    addPromoCode: (promo: Omit<PromoCode, 'id' | 'usageCount' | 'createdAt'>) => void;
    updatePromoCode: (id: string, updates: Partial<PromoCode>) => void;
    deletePromoCode: (id: string) => void;
    getPromoCodeStats: (id: string) => { totalUsage: number; totalDiscount: number };
}

interface CartItem {
    id: string;
    productId: string;
    name: string;
    price: number;
    quantity: number;
    category?: string;
}

const PromoContext = createContext<PromoContextType | undefined>(undefined);

// Mock promo codes
const initialPromoCodes: PromoCode[] = [
    {
        id: '1',
        code: 'WELCOME10',
        name: 'Знижка для нових клієнтів',
        description: '10% знижка на перше замовлення',
        discountType: 'percentage',
        discountValue: 10,
        minOrderAmount: 500,
        maxDiscountAmount: 1000,
        usageLimit: 1000,
        usageCount: 234,
        userUsageLimit: 1,
        startDate: '2024-01-01',
        endDate: '2025-12-31',
        isActive: true,
        createdAt: '2024-01-01T00:00:00',
    },
    {
        id: '2',
        code: 'SUMMER500',
        name: 'Літня акція',
        description: 'Знижка 500 грн на замовлення від 3000 грн',
        discountType: 'fixed',
        discountValue: 500,
        minOrderAmount: 3000,
        usageLimit: 500,
        usageCount: 156,
        startDate: '2024-06-01',
        endDate: '2025-08-31',
        isActive: true,
        createdAt: '2024-06-01T00:00:00',
    },
    {
        id: '3',
        code: 'FREESHIP',
        name: 'Безкоштовна доставка',
        description: 'Безкоштовна доставка на будь-яке замовлення',
        discountType: 'free_shipping',
        discountValue: 0,
        usageCount: 89,
        startDate: '2024-01-01',
        endDate: '2025-12-31',
        isActive: true,
        createdAt: '2024-01-01T00:00:00',
    },
    {
        id: '4',
        code: 'BUY2GET1',
        name: 'Купи 2 отримай 1',
        description: 'При покупці 2 товарів - 3й безкоштовно',
        discountType: 'buy_x_get_y',
        discountValue: 100,
        buyQuantity: 2,
        getQuantity: 1,
        applicableCategories: ['accessories'],
        usageCount: 45,
        startDate: '2024-01-01',
        endDate: '2025-12-31',
        isActive: true,
        createdAt: '2024-01-01T00:00:00',
    },
    {
        id: '5',
        code: 'VIP25',
        name: 'VIP знижка',
        description: '25% знижка для VIP клієнтів',
        discountType: 'percentage',
        discountValue: 25,
        minOrderAmount: 1000,
        maxDiscountAmount: 5000,
        usageCount: 12,
        startDate: '2024-01-01',
        endDate: '2025-12-31',
        isActive: true,
        createdAt: '2024-01-01T00:00:00',
    },
];

export function PromoProvider({ children }: { children: ReactNode }) {
    const [promoCodes, setPromoCodes] = useState<PromoCode[]>(initialPromoCodes);
    const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);

    const validatePromoCode = useCallback((code: string): { valid: boolean; message: string; promoCode?: PromoCode } => {
        const promo = promoCodes.find(p => p.code.toUpperCase() === code.toUpperCase());

        if (!promo) {
            return { valid: false, message: 'Промокод не знайдено' };
        }

        if (!promo.isActive) {
            return { valid: false, message: 'Промокод неактивний' };
        }

        const now = new Date();
        const startDate = new Date(promo.startDate);
        const endDate = new Date(promo.endDate);

        if (now < startDate) {
            return { valid: false, message: 'Промокод ще не активний' };
        }

        if (now > endDate) {
            return { valid: false, message: 'Термін дії промокоду закінчився' };
        }

        if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
            return { valid: false, message: 'Ліміт використань промокоду вичерпано' };
        }

        return { valid: true, message: 'Промокод валідний', promoCode: promo };
    }, [promoCodes]);

    const calculateDiscount = useCallback((code: PromoCode, orderAmount: number, cartItems?: CartItem[]): number => {
        if (code.minOrderAmount && orderAmount < code.minOrderAmount) {
            return 0;
        }

        let discount = 0;

        switch (code.discountType) {
            case 'percentage':
                discount = (orderAmount * code.discountValue) / 100;
                if (code.maxDiscountAmount) {
                    discount = Math.min(discount, code.maxDiscountAmount);
                }
                break;
            case 'fixed':
                discount = code.discountValue;
                break;
            case 'free_shipping':
                discount = 0; // Handled separately in checkout
                break;
            case 'buy_x_get_y':
                if (cartItems && code.buyQuantity && code.getQuantity) {
                    // Find cheapest applicable item for free
                    const applicableItems = cartItems.filter(item => {
                        if (code.applicableCategories?.length) {
                            return code.applicableCategories.includes(item.category || '');
                        }
                        if (code.applicableProducts?.length) {
                            return code.applicableProducts.includes(item.productId);
                        }
                        return true;
                    });

                    const totalQuantity = applicableItems.reduce((sum, item) => sum + item.quantity, 0);
                    if (totalQuantity >= code.buyQuantity + code.getQuantity) {
                        const sortedByPrice = [...applicableItems].sort((a, b) => a.price - b.price);
                        const freeItems = sortedByPrice.slice(0, code.getQuantity);
                        discount = freeItems.reduce((sum, item) => sum + item.price, 0);
                    }
                }
                break;
        }

        return Math.round(discount);
    }, []);

    const applyPromoCode = useCallback((code: string, orderAmount: number, cartItems?: CartItem[]): { success: boolean; message: string; discount?: number } => {
        const validation = validatePromoCode(code);

        if (!validation.valid || !validation.promoCode) {
            return { success: false, message: validation.message };
        }

        const promo = validation.promoCode;

        if (promo.minOrderAmount && orderAmount < promo.minOrderAmount) {
            return {
                success: false,
                message: `Мінімальна сума замовлення для цього промокоду: ${promo.minOrderAmount} ₴`
            };
        }

        const discount = calculateDiscount(promo, orderAmount, cartItems);

        setAppliedPromo({ code: promo, discountAmount: discount });

        // Increment usage count
        setPromoCodes(prev => prev.map(p =>
            p.id === promo.id ? { ...p, usageCount: p.usageCount + 1 } : p
        ));

        if (promo.discountType === 'free_shipping') {
            return { success: true, message: 'Безкоштовна доставка застосована!', discount: 0 };
        }

        return {
            success: true,
            message: `Промокод застосовано! Знижка: ${discount} ₴`,
            discount
        };
    }, [validatePromoCode, calculateDiscount]);

    const removePromoCode = useCallback(() => {
        if (appliedPromo) {
            // Decrement usage count
            setPromoCodes(prev => prev.map(p =>
                p.id === appliedPromo.code.id ? { ...p, usageCount: Math.max(0, p.usageCount - 1) } : p
            ));
        }
        setAppliedPromo(null);
    }, [appliedPromo]);

    const addPromoCode = useCallback((promo: Omit<PromoCode, 'id' | 'usageCount' | 'createdAt'>) => {
        const newPromo: PromoCode = {
            ...promo,
            id: Date.now().toString(),
            usageCount: 0,
            createdAt: new Date().toISOString(),
        };
        setPromoCodes(prev => [...prev, newPromo]);
    }, []);

    const updatePromoCode = useCallback((id: string, updates: Partial<PromoCode>) => {
        setPromoCodes(prev => prev.map(p =>
            p.id === id ? { ...p, ...updates } : p
        ));
    }, []);

    const deletePromoCode = useCallback((id: string) => {
        setPromoCodes(prev => prev.filter(p => p.id !== id));
    }, []);

    const getPromoCodeStats = useCallback((id: string) => {
        const promo = promoCodes.find(p => p.id === id);
        if (!promo) return { totalUsage: 0, totalDiscount: 0 };

        // Mock calculation - in real app would come from database
        const avgOrderAmount = 2500;
        const avgDiscount = promo.discountType === 'percentage'
            ? (avgOrderAmount * promo.discountValue) / 100
            : promo.discountValue;

        return {
            totalUsage: promo.usageCount,
            totalDiscount: promo.usageCount * avgDiscount,
        };
    }, [promoCodes]);

    return (
        <PromoContext.Provider value={{
            promoCodes,
            appliedPromo,
            applyPromoCode,
            removePromoCode,
            calculateDiscount,
            validatePromoCode,
            addPromoCode,
            updatePromoCode,
            deletePromoCode,
            getPromoCodeStats,
        }}>
            {children}
        </PromoContext.Provider>
    );
}

export function usePromo() {
    const context = useContext(PromoContext);
    if (context === undefined) {
        throw new Error('usePromo must be used within a PromoProvider');
    }
    return context;
}
