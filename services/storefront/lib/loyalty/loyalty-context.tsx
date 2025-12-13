'use client';

/**
 * Loyalty Context - React Context for Loyalty Program State Management
 * Integrates with auth system and provides loyalty functionality throughout the app
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAuth } from '../auth-context';
import {
  LoyaltyMember,
  LoyaltyTier,
  LoyaltyTierId,
  PointsTransaction,
  Reward,
  RedeemedReward,
  LOYALTY_TIERS,
} from '../loyalty';
import {
  calculatePointsEarned,
  calculateDiscountFromPoints,
  calculateMaxRedeemablePoints,
  determineTier,
  getNextTier,
  calculatePointsToNextTier,
  calculateTierProgress,
  getExpiringPoints,
  validateRedemption,
  qualifiesForFreeShipping,
  getTierDiscountPercent,
} from './loyalty-program';

// ==================== TYPES ====================

interface LoyaltyContextType {
  // State
  member: LoyaltyMember | null;
  isLoading: boolean;
  isEnrolled: boolean;

  // Tier information
  currentTier: LoyaltyTier | null;
  nextTier: LoyaltyTier | null;
  tierProgress: number;
  pointsToNextTier: number | null;

  // Points information
  availablePoints: number;
  expiringPoints: { points: number; expiryDate: Date | null };

  // Actions
  enrollInProgram: () => Promise<void>;
  earnPoints: (orderId: string, orderAmount: number, description?: string) => Promise<number>;
  redeemPoints: (points: number, orderId?: string) => Promise<{ success: boolean; discount: number; error?: string }>;
  refreshMemberData: () => Promise<void>;

  // Utilities
  calculatePointsForOrder: (amount: number) => number;
  calculateDiscountValue: (points: number) => number;
  getMaxRedeemableForOrder: (orderTotal: number) => number;
  canRedeemPoints: (points: number, orderTotal: number) => boolean;
  checkFreeShipping: (orderTotal: number) => boolean;
  getTierDiscount: () => number;
}

const LoyaltyContext = createContext<LoyaltyContextType | undefined>(undefined);

// ==================== STORAGE KEYS ====================

const STORAGE_KEYS = {
  MEMBERS: 'loyalty_members',
  TRANSACTIONS: 'loyalty_transactions',
  REDEEMED_REWARDS: 'loyalty_redeemed_rewards',
};

// ==================== HELPER FUNCTIONS ====================

function getStoredMembers(): LoyaltyMember[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEYS.MEMBERS);
  return stored ? JSON.parse(stored) : [];
}

function saveMembers(members: LoyaltyMember[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
}

function getStoredTransactions(): PointsTransaction[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
  return stored ? JSON.parse(stored) : [];
}

function saveTransactions(transactions: PointsTransaction[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
}

// ==================== PROVIDER ====================

export function LoyaltyProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [member, setMember] = useState<LoyaltyMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load member data when user changes
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setMember(null);
      setIsLoading(false);
      return;
    }

    // Load member from storage
    const members = getStoredMembers();
    const userMember = members.find(m => m.userId === user.id);

    if (userMember) {
      setMember(userMember);
    }

    setIsLoading(false);
  }, [user, isAuthenticated]);

  // Calculate derived state
  const currentTier = member ? determineTier(member.points.lifetime) : null;
  const nextTier = currentTier ? getNextTier(currentTier.id) : null;
  const tierProgress = currentTier && member ? calculateTierProgress(member.points.lifetime, currentTier) : 0;
  const pointsToNextTier = currentTier && member ? calculatePointsToNextTier(member.points.lifetime, currentTier.id) : null;
  const availablePoints = member?.points.available || 0;

  // Calculate expiring points
  const transactions = getStoredTransactions().filter(t => t.memberId === member?.id);
  const expiringPoints = getExpiringPoints(transactions, 30);

  /**
   * Enroll user in loyalty program
   */
  const enrollInProgram = useCallback(async () => {
    if (!user) {
      throw new Error('Користувач не авторизований');
    }

    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      const members = getStoredMembers();

      // Check if already enrolled
      if (members.some(m => m.userId === user.id)) {
        throw new Error('Ви вже зареєстровані в програмі лояльності');
      }

      const newMember: LoyaltyMember = {
        id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user.id,
        email: user.email,
        firstName: user.name.split(' ')[0] || user.name,
        lastName: user.name.split(' ')[1] || '',
        phone: user.phone,
        tier: LOYALTY_TIERS[0], // Start with Bronze
        points: {
          available: 0,
          pending: 0,
          expiringSoon: 0,
          lifetime: 0,
        },
        stats: {
          totalOrders: 0,
          totalSpent: 0,
          avgOrderValue: 0,
          pointsEarned: 0,
          pointsRedeemed: 0,
          referralsCount: 0,
          reviewsCount: 0,
          currentStreak: 0,
          longestStreak: 0,
        },
        preferences: {
          emailNotifications: true,
          smsNotifications: false,
          pushNotifications: true,
          marketingConsent: true,
          birthdayReminder: true,
          tierChangeAlerts: true,
          expiryReminders: true,
        },
        joinedAt: new Date(),
        tierUpdatedAt: new Date(),
        lastActivityAt: new Date(),
      };

      members.push(newMember);
      saveMembers(members);
      setMember(newMember);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Earn points from an order
   */
  const earnPoints = useCallback(async (orderId: string, orderAmount: number, description?: string): Promise<number> => {
    if (!member || !currentTier) {
      throw new Error('Не зареєстровано в програмі лояльності');
    }

    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));

      const pointsEarned = calculatePointsEarned(orderAmount, currentTier, false);

      // Create transaction
      const transaction: PointsTransaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        memberId: member.id,
        type: 'earned_purchase',
        points: pointsEarned,
        balance: member.points.available + pointsEarned,
        description: description || `Purchase #${orderId}`,
        descriptionUk: description || `Покупка #${orderId}`,
        orderId,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        createdAt: new Date(),
      };

      // Update member
      const updatedMember: LoyaltyMember = {
        ...member,
        points: {
          ...member.points,
          available: member.points.available + pointsEarned,
          lifetime: member.points.lifetime + pointsEarned,
        },
        stats: {
          ...member.stats,
          totalOrders: member.stats.totalOrders + 1,
          totalSpent: member.stats.totalSpent + orderAmount,
          avgOrderValue: (member.stats.totalSpent + orderAmount) / (member.stats.totalOrders + 1),
          pointsEarned: member.stats.pointsEarned + pointsEarned,
        },
        tier: determineTier(member.points.lifetime + pointsEarned),
        lastActivityAt: new Date(),
      };

      // Save updates
      const members = getStoredMembers();
      const memberIndex = members.findIndex(m => m.id === member.id);
      if (memberIndex !== -1) {
        members[memberIndex] = updatedMember;
        saveMembers(members);
      }

      const transactions = getStoredTransactions();
      transactions.unshift(transaction);
      saveTransactions(transactions);

      setMember(updatedMember);

      return pointsEarned;
    } finally {
      setIsLoading(false);
    }
  }, [member, currentTier]);

  /**
   * Redeem points for discount
   */
  const redeemPoints = useCallback(async (
    points: number,
    orderId?: string
  ): Promise<{ success: boolean; discount: number; error?: string }> => {
    if (!member) {
      return { success: false, discount: 0, error: 'Не зареєстровано в програмі лояльності' };
    }

    if (points <= 0) {
      return { success: false, discount: 0, error: 'Невірна кількість балів' };
    }

    if (points > member.points.available) {
      return { success: false, discount: 0, error: 'Недостатньо балів' };
    }

    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));

      const discount = calculateDiscountFromPoints(points);

      // Create transaction
      const transaction: PointsTransaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        memberId: member.id,
        type: 'redeemed',
        points: -points,
        balance: member.points.available - points,
        description: orderId ? `Redeemed for order #${orderId}` : 'Points redeemed',
        descriptionUk: orderId ? `Використано для замовлення #${orderId}` : 'Бали використані',
        orderId,
        createdAt: new Date(),
      };

      // Update member
      const updatedMember: LoyaltyMember = {
        ...member,
        points: {
          ...member.points,
          available: member.points.available - points,
        },
        stats: {
          ...member.stats,
          pointsRedeemed: member.stats.pointsRedeemed + points,
        },
        lastActivityAt: new Date(),
      };

      // Save updates
      const members = getStoredMembers();
      const memberIndex = members.findIndex(m => m.id === member.id);
      if (memberIndex !== -1) {
        members[memberIndex] = updatedMember;
        saveMembers(members);
      }

      const transactions = getStoredTransactions();
      transactions.unshift(transaction);
      saveTransactions(transactions);

      setMember(updatedMember);

      return { success: true, discount };
    } catch (error) {
      return {
        success: false,
        discount: 0,
        error: error instanceof Error ? error.message : 'Помилка при використанні балів'
      };
    } finally {
      setIsLoading(false);
    }
  }, [member]);

  /**
   * Refresh member data from storage
   */
  const refreshMemberData = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 300));

      const members = getStoredMembers();
      const userMember = members.find(m => m.userId === user.id);

      if (userMember) {
        setMember(userMember);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Calculate points for an order amount
   */
  const calculatePointsForOrder = useCallback((amount: number): number => {
    if (!currentTier) return 0;
    return calculatePointsEarned(amount, currentTier, false);
  }, [currentTier]);

  /**
   * Calculate discount value from points
   */
  const calculateDiscountValue = useCallback((points: number): number => {
    return calculateDiscountFromPoints(points);
  }, []);

  /**
   * Get max redeemable points for order
   */
  const getMaxRedeemableForOrder = useCallback((orderTotal: number): number => {
    return calculateMaxRedeemablePoints(orderTotal, availablePoints, 50);
  }, [availablePoints]);

  /**
   * Check if points can be redeemed
   */
  const canRedeemPoints = useCallback((points: number, orderTotal: number): boolean => {
    const validation = validateRedemption(points, availablePoints, orderTotal);
    return validation.valid;
  }, [availablePoints]);

  /**
   * Check if order qualifies for free shipping
   */
  const checkFreeShipping = useCallback((orderTotal: number): boolean => {
    if (!currentTier) return false;
    return qualifiesForFreeShipping(currentTier, orderTotal);
  }, [currentTier]);

  /**
   * Get tier discount percentage
   */
  const getTierDiscount = useCallback((): number => {
    if (!currentTier) return 0;
    return getTierDiscountPercent(currentTier);
  }, [currentTier]);

  const value: LoyaltyContextType = {
    // State
    member,
    isLoading,
    isEnrolled: !!member,

    // Tier information
    currentTier,
    nextTier,
    tierProgress,
    pointsToNextTier,

    // Points information
    availablePoints,
    expiringPoints,

    // Actions
    enrollInProgram,
    earnPoints,
    redeemPoints,
    refreshMemberData,

    // Utilities
    calculatePointsForOrder,
    calculateDiscountValue,
    getMaxRedeemableForOrder,
    canRedeemPoints,
    checkFreeShipping,
    getTierDiscount,
  };

  return (
    <LoyaltyContext.Provider value={value}>
      {children}
    </LoyaltyContext.Provider>
  );
}

/**
 * Hook to use loyalty context
 */
export function useLoyalty() {
  const context = useContext(LoyaltyContext);

  if (context === undefined) {
    throw new Error('useLoyalty must be used within a LoyaltyProvider');
  }

  return context;
}
