/**
 * Loyalty Points API Routes
 * GET - Get user's points balance and transactions
 * POST - Add points to user account
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  LoyaltyMember,
  PointsTransaction,
  LOYALTY_TIERS,
} from '../../../../lib/loyalty';
import {
  calculatePointsEarned,
  determineTier,
  calculatePointsExpiry,
} from '../../../../lib/loyalty/loyalty-program';

// Mock storage (in production, use database)
const STORAGE_KEYS = {
  MEMBERS: 'loyalty_members',
  TRANSACTIONS: 'loyalty_transactions',
};

/**
 * GET /api/loyalty/points
 * Get user's points balance and recent transactions
 */
export async function GET(request: NextRequest) {
  try {
    // In production, get userId from session/auth
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required', errorUk: 'ID користувача обов\'язковий' },
        { status: 400 }
      );
    }

    // Mock: In production, query database
    // For now, return mock data structure
    const mockMember: LoyaltyMember = {
      id: 'member_1',
      userId: userId,
      email: 'user@example.com',
      firstName: 'Іван',
      lastName: 'Петренко',
      tier: LOYALTY_TIERS[0],
      points: {
        available: 2450,
        pending: 0,
        expiringSoon: 500,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lifetime: 8750,
      },
      stats: {
        totalOrders: 15,
        totalSpent: 25000,
        avgOrderValue: 1666,
        pointsEarned: 8750,
        pointsRedeemed: 6300,
        referralsCount: 2,
        reviewsCount: 8,
        currentStreak: 3,
        longestStreak: 5,
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
      joinedAt: new Date('2024-01-01'),
      tierUpdatedAt: new Date('2024-06-15'),
      lastActivityAt: new Date(),
    };

    const mockTransactions: PointsTransaction[] = [
      {
        id: 'tx_1',
        memberId: 'member_1',
        type: 'earned_purchase',
        points: 350,
        balance: 2450,
        description: 'Purchase #12350',
        descriptionUk: 'Покупка #12350',
        orderId: '12350',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        createdAt: new Date('2024-12-10'),
      },
      {
        id: 'tx_2',
        memberId: 'member_1',
        type: 'redeemed',
        points: -200,
        balance: 2100,
        description: 'Redeemed for order #12340',
        descriptionUk: 'Використано для замовлення #12340',
        orderId: '12340',
        createdAt: new Date('2024-12-05'),
      },
    ];

    return NextResponse.json({
      member: mockMember,
      transactions: mockTransactions,
      success: true,
    });
  } catch (error) {
    console.error('Error fetching points:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch points',
        errorUk: 'Помилка отримання балів',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/loyalty/points
 * Add points to user account (e.g., from purchase, review, referral)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, orderId, orderAmount, type, description, descriptionUk } = body;

    // Validation
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required', errorUk: 'ID користувача обов\'язковий' },
        { status: 400 }
      );
    }

    if (type === 'earned_purchase' && (!orderId || !orderAmount)) {
      return NextResponse.json(
        {
          error: 'Order ID and amount are required for purchase points',
          errorUk: 'ID замовлення та сума обов\'язкові для балів за покупку',
        },
        { status: 400 }
      );
    }

    // In production, fetch member from database
    // For now, use mock data
    const memberTier = determineTier(8750); // Mock lifetime points

    // Calculate points
    let pointsEarned = 0;

    if (type === 'earned_purchase' && orderAmount) {
      pointsEarned = calculatePointsEarned(orderAmount, memberTier, false);
    } else if (type === 'earned_review') {
      pointsEarned = 20; // Fixed points for review
    } else if (type === 'earned_referral') {
      pointsEarned = 100; // Fixed points for referral
    } else if (type === 'earned_birthday') {
      const birthdayBonus = memberTier.benefits.find(b => b.type === 'birthday_bonus');
      pointsEarned = birthdayBonus?.value || 100;
    } else {
      pointsEarned = body.points || 0;
    }

    // Create transaction
    const transaction: PointsTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      memberId: `member_${userId}`,
      type: type || 'earned_bonus',
      points: pointsEarned,
      balance: 2450 + pointsEarned, // Mock: In production, calculate from current balance
      description: description || `Points earned`,
      descriptionUk: descriptionUk || `Бали нараховані`,
      orderId,
      expiresAt: calculatePointsExpiry(),
      createdAt: new Date(),
    };

    // In production, save to database
    console.log('Transaction created:', transaction);

    return NextResponse.json({
      success: true,
      pointsEarned,
      transaction,
      message: `${pointsEarned} points added successfully`,
      messageUk: `${pointsEarned} балів успішно додано`,
    });
  } catch (error) {
    console.error('Error adding points:', error);
    return NextResponse.json(
      {
        error: 'Failed to add points',
        errorUk: 'Помилка додавання балів',
      },
      { status: 500 }
    );
  }
}
