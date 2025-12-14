# Loyalty Program

Customer loyalty system with points, tiers, and rewards.

## Overview

The loyalty program includes:
- Points earning on purchases
- 5-tier membership system
- Point redemption for discounts
- Birthday bonuses
- Referral rewards
- Tier-based benefits

## Tier System

| Tier | Points Required | Discount | Bonus Points | Benefits |
|------|-----------------|----------|--------------|----------|
| Bronze | 0 | 0% | 1x | Basic |
| Silver | 1,000 | 3% | 1.25x | + Early access |
| Gold | 5,000 | 5% | 1.5x | + Free shipping |
| Platinum | 15,000 | 10% | 2x | + Priority support |
| Diamond | 50,000 | 15% | 3x | + VIP events |

## Points System

### Earning Points

| Action | Points |
|--------|--------|
| Purchase | 1 point per 1 UAH |
| Review | 50 points |
| Birthday | 500 points |
| Referral signup | 200 points |
| Referral purchase | 5% of order value |
| Social share | 25 points |
| Account completion | 100 points |

### Redeeming Points

| Points | Discount |
|--------|----------|
| 100 | 10 UAH |
| 500 | 55 UAH |
| 1,000 | 120 UAH |
| 5,000 | 700 UAH |

Exchange rate: ~10 points = 1 UAH (with bonuses at higher tiers)

## API Endpoints

### Points

```
GET  /api/v1/loyalty/balance           # Get points balance
GET  /api/v1/loyalty/history           # Points history
POST /api/v1/loyalty/redeem            # Redeem points
GET  /api/v1/loyalty/tier              # Current tier info
```

### Referrals

```
GET  /api/v1/loyalty/referral/code     # Get referral code
GET  /api/v1/loyalty/referral/stats    # Referral statistics
POST /api/v1/loyalty/referral/apply    # Apply referral code
```

## Data Models

### Loyalty Account

```typescript
interface LoyaltyAccount {
  customerId: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  totalPoints: number;           // Lifetime earned
  availablePoints: number;       // Can be redeemed
  tierProgress: number;          // Progress to next tier
  tierExpiresAt: Date;           // When tier review happens
  referralCode: string;
  referrals: number;             // Number of referrals
  createdAt: Date;
}
```

### Points Transaction

```typescript
interface PointsTransaction {
  id: string;
  customerId: string;
  type: 'earn' | 'redeem' | 'expire' | 'adjust';
  amount: number;                // Positive or negative
  balance: number;               // Balance after transaction
  source: string;                // order, referral, birthday, etc.
  sourceId?: string;             // Order ID, etc.
  description: string;
  expiresAt?: Date;
  createdAt: Date;
}
```

## Integration

### Order Checkout

```typescript
// Apply loyalty discount at checkout
async function applyLoyaltyDiscount(orderId: string, pointsToRedeem: number) {
  const account = await getLoyaltyAccount(customerId);

  if (pointsToRedeem > account.availablePoints) {
    throw new Error('Insufficient points');
  }

  const discount = calculateDiscount(pointsToRedeem, account.tier);

  await order.applyDiscount(orderId, {
    type: 'loyalty',
    amount: discount,
    pointsUsed: pointsToRedeem,
  });

  await deductPoints(customerId, pointsToRedeem, `Redemption for order ${orderId}`);
}
```

### Order Completion

```typescript
// Award points after order completion
eventBus.on('order.completed', async (order) => {
  const account = await getLoyaltyAccount(order.customerId);
  const multiplier = getTierMultiplier(account.tier);

  const basePoints = Math.floor(order.total);
  const bonusPoints = Math.floor(basePoints * (multiplier - 1));
  const totalPoints = basePoints + bonusPoints;

  await addPoints(order.customerId, totalPoints, {
    source: 'order',
    sourceId: order.id,
    description: `Purchase: ${basePoints} + Tier bonus: ${bonusPoints}`,
  });

  // Check tier upgrade
  await checkTierUpgrade(order.customerId);
});
```

## Referral Program

### Flow

```
1. Customer A gets referral code: REF-ABC123
2. Customer B uses code at signup
3. Customer B gets 200 welcome points
4. Customer A gets 200 points for referral
5. When Customer B makes first purchase:
   - Customer A gets 5% of order value in points
```

### API Usage

```bash
# Get referral code
GET /api/v1/loyalty/referral/code
# { "code": "REF-ABC123", "link": "https://store.com/r/ABC123" }

# Apply referral at signup
POST /api/v1/loyalty/referral/apply
{ "code": "REF-ABC123" }

# Get referral stats
GET /api/v1/loyalty/referral/stats
# { "referrals": 5, "pointsEarned": 2500, "pendingPoints": 500 }
```

## Birthday Bonus

```typescript
// Daily job to send birthday bonuses
async function processBirthdayBonuses() {
  const today = new Date();
  const birthdayCustomers = await getCustomersWithBirthday(today);

  for (const customer of birthdayCustomers) {
    const account = await getLoyaltyAccount(customer.id);
    const bonus = getBirthdayBonus(account.tier);

    await addPoints(customer.id, bonus, {
      source: 'birthday',
      description: 'Birthday bonus!',
      expiresAt: addDays(today, 30), // Expires in 30 days
    });

    await sendBirthdayEmail(customer, bonus);
  }
}
```

## Points Expiration

Points expire based on rules:
- Standard points: 12 months from earning
- Bonus points: 3 months
- Birthday points: 30 days

```typescript
// Monthly job to expire points
async function expirePoints() {
  const expired = await getExpiredPoints();

  for (const transaction of expired) {
    await deductPoints(transaction.customerId, transaction.amount, {
      type: 'expire',
      description: 'Points expired',
    });

    await notifyPointsExpiring(transaction.customerId, transaction.amount);
  }
}
```

## Tier Review

Tiers are reviewed monthly:

```typescript
async function reviewTiers() {
  const customers = await getAllLoyaltyAccounts();

  for (const account of customers) {
    const newTier = calculateTier(account.totalPoints);

    if (newTier !== account.tier) {
      await updateTier(account.customerId, newTier);

      if (tierOrder[newTier] > tierOrder[account.tier]) {
        await sendTierUpgradeEmail(account.customerId, newTier);
      } else {
        await sendTierDowngradeEmail(account.customerId, newTier);
      }
    }
  }
}
```

## Configuration

```bash
# Points
LOYALTY_POINTS_PER_UAH=1
LOYALTY_POINTS_EXPIRY_MONTHS=12
LOYALTY_BONUS_EXPIRY_DAYS=90

# Tiers
LOYALTY_TIER_BRONZE=0
LOYALTY_TIER_SILVER=1000
LOYALTY_TIER_GOLD=5000
LOYALTY_TIER_PLATINUM=15000
LOYALTY_TIER_DIAMOND=50000

# Multipliers
LOYALTY_MULTIPLIER_BRONZE=1
LOYALTY_MULTIPLIER_SILVER=1.25
LOYALTY_MULTIPLIER_GOLD=1.5
LOYALTY_MULTIPLIER_PLATINUM=2
LOYALTY_MULTIPLIER_DIAMOND=3

# Referral
LOYALTY_REFERRAL_SIGNUP_BONUS=200
LOYALTY_REFERRAL_PURCHASE_PERCENT=5

# Birthday
LOYALTY_BIRTHDAY_BONUS_BRONZE=500
LOYALTY_BIRTHDAY_BONUS_DIAMOND=2500
```

## Admin Features

### Manual Adjustments

```bash
# Add points (admin)
POST /api/v1/admin/loyalty/adjust
{
  "customerId": "cust_123",
  "points": 500,
  "reason": "Customer service compensation"
}
```

### Reports

```bash
# Loyalty program report
GET /api/v1/admin/loyalty/report
{
  "totalMembers": 10000,
  "byTier": {
    "bronze": 6000,
    "silver": 2500,
    "gold": 1000,
    "platinum": 400,
    "diamond": 100
  },
  "pointsIssued": 5000000,
  "pointsRedeemed": 3500000,
  "redemptionRate": 0.70
}
```
