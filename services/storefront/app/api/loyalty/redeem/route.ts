/**
 * Loyalty Redemption API Route
 * POST - Redeem points for discounts or rewards
 */

import { NextRequest, NextResponse } from 'next/server';
import { PointsTransaction, MIN_REDEMPTION_POINTS } from '../../../../lib/loyalty';
import {
  validateRedemption,
  calculateDiscountFromPoints,
  calculateMaxRedeemablePoints,
} from '../../../../lib/loyalty/loyalty-program';

/**
 * POST /api/loyalty/redeem
 * Redeem points for discount or reward
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, points, orderId, orderTotal, rewardId } = body;

    // Validation
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required', errorUk: 'ID користувача обов\'язковий' },
        { status: 400 }
      );
    }

    if (!points || points <= 0) {
      return NextResponse.json(
        { error: 'Valid points amount is required', errorUk: 'Потрібна дійсна кількість балів' },
        { status: 400 }
      );
    }

    // Mock: In production, fetch member from database
    const mockAvailablePoints = 2450;

    // Check minimum redemption
    if (points < MIN_REDEMPTION_POINTS) {
      return NextResponse.json(
        {
          error: `Minimum redemption is ${MIN_REDEMPTION_POINTS} points`,
          errorUk: `Мінімальне погашення ${MIN_REDEMPTION_POINTS} балів`,
          success: false,
        },
        { status: 400 }
      );
    }

    // Check if user has enough points
    if (points > mockAvailablePoints) {
      return NextResponse.json(
        {
          error: 'Insufficient points',
          errorUk: 'Недостатньо балів',
          success: false,
          availablePoints: mockAvailablePoints,
        },
        { status: 400 }
      );
    }

    // If redeeming for order, validate against order total
    if (orderTotal) {
      const validation = validateRedemption(points, mockAvailablePoints, orderTotal);

      if (!validation.valid) {
        return NextResponse.json(
          {
            error: validation.error,
            errorUk: validation.errorUk,
            success: false,
            maxRedeemable: calculateMaxRedeemablePoints(orderTotal, mockAvailablePoints),
          },
          { status: 400 }
        );
      }
    }

    // Calculate discount value
    const discountValue = calculateDiscountFromPoints(points);

    // Create redemption transaction
    const transaction: PointsTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      memberId: `member_${userId}`,
      type: 'redeemed',
      points: -points,
      balance: mockAvailablePoints - points,
      description: orderId
        ? `Redeemed for order #${orderId}`
        : rewardId
        ? `Redeemed for reward ${rewardId}`
        : 'Points redeemed',
      descriptionUk: orderId
        ? `Використано для замовлення #${orderId}`
        : rewardId
        ? `Використано для винагороди ${rewardId}`
        : 'Бали використані',
      orderId,
      createdAt: new Date(),
    };

    // In production, save to database and update member points
    console.log('Redemption transaction:', transaction);

    // Generate redemption code (for rewards)
    const redemptionCode = rewardId
      ? `REWARD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
      : undefined;

    return NextResponse.json({
      success: true,
      pointsRedeemed: points,
      discountValue,
      newBalance: mockAvailablePoints - points,
      transaction,
      redemptionCode,
      message: `Successfully redeemed ${points} points for ${discountValue} UAH discount`,
      messageUk: `Успішно використано ${points} балів для знижки ${discountValue} грн`,
    });
  } catch (error) {
    console.error('Error redeeming points:', error);
    return NextResponse.json(
      {
        error: 'Failed to redeem points',
        errorUk: 'Помилка використання балів',
        success: false,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/loyalty/redeem
 * Get redemption options and limits for current user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const orderTotal = searchParams.get('orderTotal');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required', errorUk: 'ID користувача обов\'язkovий' },
        { status: 400 }
      );
    }

    // Mock: In production, fetch from database
    const mockAvailablePoints = 2450;
    const orderTotalNumber = orderTotal ? parseFloat(orderTotal) : 0;

    const maxRedeemable = orderTotalNumber > 0
      ? calculateMaxRedeemablePoints(orderTotalNumber, mockAvailablePoints)
      : mockAvailablePoints;

    const maxDiscount = calculateDiscountFromPoints(maxRedeemable);

    return NextResponse.json({
      success: true,
      availablePoints: mockAvailablePoints,
      minRedemption: MIN_REDEMPTION_POINTS,
      maxRedeemable,
      maxDiscount,
      conversionRate: 1, // 1 point = 1 UAH
      orderTotal: orderTotalNumber,
    });
  } catch (error) {
    console.error('Error fetching redemption options:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch redemption options',
        errorUk: 'Помилка отримання опцій погашення',
      },
      { status: 500 }
    );
  }
}
