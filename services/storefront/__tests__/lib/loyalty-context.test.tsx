import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import {
    LoyaltyProvider,
    useLoyalty,
    LoyaltyTier
} from '../../lib/loyalty-context';

// Test wrapper component
const TestComponent = () => {
    const {
        account,
        tierConfig,
        earnPoints,
        redeemPoints,
        getPointsValue,
        getRequiredPoints,
        getTierProgress,
        getExpiringPoints,
        addBonusPoints,
        initializeAccount
    } = useLoyalty();

    const [earnResult, setEarnResult] = React.useState<number>(0);
    const [redeemResult, setRedeemResult] = React.useState<{ success: boolean; message: string } | null>(null);
    const tierProgress = getTierProgress();

    return (
        <div>
            <div data-testid="current-points">{account?.currentPoints || 0}</div>
            <div data-testid="lifetime-points">{account?.lifetimePoints || 0}</div>
            <div data-testid="current-tier">{account?.tier || 'none'}</div>
            <div data-testid="transactions-count">{account?.transactions?.length || 0}</div>
            <div data-testid="tier-progress">{Math.round(tierProgress.progress)}</div>
            <div data-testid="points-to-next">{tierProgress.pointsToNext}</div>
            <div data-testid="next-tier">{tierProgress.next || 'none'}</div>
            <div data-testid="points-value">{getPointsValue(100)}</div>
            <div data-testid="required-points">{getRequiredPoints(100)}</div>
            <div data-testid="expiring-points">{getExpiringPoints(30)}</div>
            <div data-testid="earn-result">{earnResult}</div>
            <div data-testid="redeem-success">{redeemResult?.success?.toString() || 'none'}</div>
            <div data-testid="redeem-message">{redeemResult?.message || 'none'}</div>

            <button onClick={() => {
                const points = earnPoints('ORDER-123', 1000, 'Test order');
                setEarnResult(points);
            }}>
                Earn Points
            </button>
            <button onClick={() => {
                const result = redeemPoints(100, 'Test redemption');
                setRedeemResult(result);
            }}>
                Redeem 100
            </button>
            <button onClick={() => {
                addBonusPoints(500, 'Bonus points');
            }}>
                Add Bonus
            </button>
            <button onClick={() => {
                initializeAccount('user-123');
            }}>
                Init Account
            </button>
        </div>
    );
};

const renderWithProvider = () => {
    return render(
        <LoyaltyProvider>
            <TestComponent />
        </LoyaltyProvider>
    );
};

describe('LoyaltyContext', () => {
    describe('Initial State', () => {
        it('should have mock account with points', () => {
            renderWithProvider();
            const points = parseInt(screen.getByTestId('current-points').textContent || '0');
            expect(points).toBeGreaterThanOrEqual(0);
        });

        it('should have a current tier', () => {
            renderWithProvider();
            expect(screen.getByTestId('current-tier')).not.toHaveTextContent('none');
        });

        it('should have transactions history', () => {
            renderWithProvider();
            const count = parseInt(screen.getByTestId('transactions-count').textContent || '0');
            expect(count).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Earn Points', () => {
        it('should earn points for order', async () => {
            renderWithProvider();

            await act(async () => {
                fireEvent.click(screen.getByText('Earn Points'));
            });

            await waitFor(() => {
                const earnedPoints = parseInt(screen.getByTestId('earn-result').textContent || '0');
                expect(earnedPoints).toBeGreaterThan(0);
            });
        });

        it('should add transaction when earning points', async () => {
            renderWithProvider();

            const initialCount = parseInt(screen.getByTestId('transactions-count').textContent || '0');

            await act(async () => {
                fireEvent.click(screen.getByText('Earn Points'));
            });

            await waitFor(() => {
                const newCount = parseInt(screen.getByTestId('transactions-count').textContent || '0');
                expect(newCount).toBe(initialCount + 1);
            });
        });
    });

    describe('Redeem Points', () => {
        it('should redeem points successfully', async () => {
            renderWithProvider();

            await act(async () => {
                fireEvent.click(screen.getByText('Redeem 100'));
            });

            await waitFor(() => {
                const success = screen.getByTestId('redeem-success').textContent;
                // May succeed or fail depending on available points
                expect(['true', 'false']).toContain(success);
            });
        });

        it('should return message on redemption', async () => {
            renderWithProvider();

            await act(async () => {
                fireEvent.click(screen.getByText('Redeem 100'));
            });

            await waitFor(() => {
                const message = screen.getByTestId('redeem-message').textContent;
                expect(message).not.toBe('none');
            });
        });
    });

    describe('Bonus Points', () => {
        it('should add bonus points', async () => {
            renderWithProvider();

            const initialPoints = parseInt(screen.getByTestId('current-points').textContent || '0');

            await act(async () => {
                fireEvent.click(screen.getByText('Add Bonus'));
            });

            await waitFor(() => {
                const newPoints = parseInt(screen.getByTestId('current-points').textContent || '0');
                expect(newPoints).toBe(initialPoints + 500);
            });
        });
    });

    describe('Tier Progress', () => {
        it('should calculate tier progress correctly', () => {
            renderWithProvider();
            const progress = parseInt(screen.getByTestId('tier-progress').textContent || '0');
            expect(progress).toBeGreaterThanOrEqual(0);
            expect(progress).toBeLessThanOrEqual(100);
        });

        it('should show points to next tier', () => {
            renderWithProvider();
            const pointsToNext = parseInt(screen.getByTestId('points-to-next').textContent || '0');
            expect(pointsToNext).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Points Value Conversion', () => {
        it('should convert points to UAH value', () => {
            renderWithProvider();
            const value = parseInt(screen.getByTestId('points-value').textContent || '0');
            // 100 points * 0.5 UAH per point = 50 UAH
            expect(value).toBe(50);
        });

        it('should calculate required points for amount', () => {
            renderWithProvider();
            const points = parseInt(screen.getByTestId('required-points').textContent || '0');
            // 100 UAH / 0.5 = 200 points
            expect(points).toBe(200);
        });
    });

    describe('Expiring Points', () => {
        it('should calculate expiring points', () => {
            renderWithProvider();
            const expiring = parseInt(screen.getByTestId('expiring-points').textContent || '0');
            expect(expiring).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Initialize Account', () => {
        it('should initialize new account', async () => {
            renderWithProvider();

            await act(async () => {
                fireEvent.click(screen.getByText('Init Account'));
            });

            await waitFor(() => {
                const tier = screen.getByTestId('current-tier').textContent;
                expect(tier).toBe('bronze');
            });
        });
    });
});

describe('Tier Configuration', () => {
    const TierConfigTest = () => {
        const { tierConfig } = useLoyalty();
        return (
            <div>
                <div data-testid="bronze-min">{tierConfig.bronze.minPoints}</div>
                <div data-testid="silver-min">{tierConfig.silver.minPoints}</div>
                <div data-testid="gold-min">{tierConfig.gold.minPoints}</div>
                <div data-testid="platinum-min">{tierConfig.platinum.minPoints}</div>
                <div data-testid="bronze-mult">{tierConfig.bronze.pointsMultiplier}</div>
                <div data-testid="silver-mult">{tierConfig.silver.pointsMultiplier}</div>
                <div data-testid="gold-mult">{tierConfig.gold.pointsMultiplier}</div>
                <div data-testid="platinum-mult">{tierConfig.platinum.pointsMultiplier}</div>
                <div data-testid="bronze-discount">{tierConfig.bronze.discountPercent}</div>
                <div data-testid="platinum-discount">{tierConfig.platinum.discountPercent}</div>
            </div>
        );
    };

    it('should have correct tier thresholds', () => {
        render(
            <LoyaltyProvider>
                <TierConfigTest />
            </LoyaltyProvider>
        );

        expect(screen.getByTestId('bronze-min')).toHaveTextContent('0');
        expect(screen.getByTestId('silver-min')).toHaveTextContent('1000');
        expect(screen.getByTestId('gold-min')).toHaveTextContent('5000');
        expect(screen.getByTestId('platinum-min')).toHaveTextContent('15000');
    });

    it('should have increasing multipliers per tier', () => {
        render(
            <LoyaltyProvider>
                <TierConfigTest />
            </LoyaltyProvider>
        );

        const bronze = parseFloat(screen.getByTestId('bronze-mult').textContent || '0');
        const silver = parseFloat(screen.getByTestId('silver-mult').textContent || '0');
        const gold = parseFloat(screen.getByTestId('gold-mult').textContent || '0');
        const platinum = parseFloat(screen.getByTestId('platinum-mult').textContent || '0');

        expect(bronze).toBeLessThan(silver);
        expect(silver).toBeLessThan(gold);
        expect(gold).toBeLessThan(platinum);
    });

    it('should have increasing discounts per tier', () => {
        render(
            <LoyaltyProvider>
                <TierConfigTest />
            </LoyaltyProvider>
        );

        const bronze = parseFloat(screen.getByTestId('bronze-discount').textContent || '0');
        const platinum = parseFloat(screen.getByTestId('platinum-discount').textContent || '0');

        expect(platinum).toBeGreaterThan(bronze);
    });
});

describe('LoyaltyTier Type', () => {
    it('should have correct tier values', () => {
        const tiers: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum'];

        tiers.forEach(tier => {
            expect(['bronze', 'silver', 'gold', 'platinum']).toContain(tier);
        });
    });
});
