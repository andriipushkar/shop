package loyalty

import (
	"context"
	"testing"
	"time"
)

// MockRepository implements Repository for testing
type MockRepository struct {
	accounts     map[string]*Account
	transactions []*Transaction
	rewards      []*Reward
	redemptions  map[string]*RewardRedemption
}

func NewMockRepository() *MockRepository {
	return &MockRepository{
		accounts:     make(map[string]*Account),
		transactions: make([]*Transaction, 0),
		rewards: []*Reward{
			{
				ID:         "reward-1",
				Name:       "10% Discount",
				PointsCost: 1000,
				Type:       "discount",
				Value:      10,
				MinTier:    TierBronze,
				Stock:      -1,
				IsActive:   true,
			},
			{
				ID:         "reward-2",
				Name:       "Free Shipping",
				PointsCost: 500,
				Type:       "shipping",
				Value:      0,
				MinTier:    TierSilver,
				Stock:      100,
				IsActive:   true,
			},
		},
		redemptions: make(map[string]*RewardRedemption),
	}
}

func (m *MockRepository) GetAccount(ctx context.Context, userID string) (*Account, error) {
	if acc, ok := m.accounts[userID]; ok {
		return acc, nil
	}
	return nil, ErrInsufficientPoints
}

func (m *MockRepository) CreateAccount(ctx context.Context, account *Account) error {
	account.ID = "acc-" + account.UserID
	m.accounts[account.UserID] = account
	return nil
}

func (m *MockRepository) UpdateAccount(ctx context.Context, account *Account) error {
	m.accounts[account.UserID] = account
	return nil
}

func (m *MockRepository) CreateTransaction(ctx context.Context, tx *Transaction) error {
	tx.ID = "tx-" + string(rune(len(m.transactions)))
	m.transactions = append(m.transactions, tx)
	return nil
}

func (m *MockRepository) GetTransactions(ctx context.Context, userID string, limit, offset int) ([]*Transaction, int, error) {
	var result []*Transaction
	for _, tx := range m.transactions {
		if tx.UserID == userID {
			result = append(result, tx)
		}
	}
	return result, len(result), nil
}

func (m *MockRepository) GetExpiringPoints(ctx context.Context, userID string, before time.Time) (int, error) {
	return 0, nil
}

func (m *MockRepository) GetRewards(ctx context.Context, tier Tier) ([]*Reward, error) {
	var result []*Reward
	tierOrder := map[Tier]int{TierBronze: 0, TierSilver: 1, TierGold: 2, TierPlatinum: 3}
	userTierLevel := tierOrder[tier]

	for _, r := range m.rewards {
		if tierOrder[r.MinTier] <= userTierLevel && r.IsActive {
			result = append(result, r)
		}
	}
	return result, nil
}

func (m *MockRepository) GetReward(ctx context.Context, id string) (*Reward, error) {
	for _, r := range m.rewards {
		if r.ID == id {
			return r, nil
		}
	}
	return nil, ErrInvalidTier
}

func (m *MockRepository) CreateRedemption(ctx context.Context, redemption *RewardRedemption) error {
	redemption.ID = "red-" + redemption.Code
	m.redemptions[redemption.Code] = redemption
	return nil
}

func (m *MockRepository) GetRedemption(ctx context.Context, code string) (*RewardRedemption, error) {
	if red, ok := m.redemptions[code]; ok {
		return red, nil
	}
	return nil, ErrAlreadyRedeemed
}

func (m *MockRepository) MarkRedemptionUsed(ctx context.Context, code string) error {
	if red, ok := m.redemptions[code]; ok {
		now := time.Now()
		red.UsedAt = &now
		return nil
	}
	return ErrAlreadyRedeemed
}

func TestService_GetOrCreateAccount(t *testing.T) {
	repo := NewMockRepository()
	svc := NewService(repo)
	ctx := context.Background()

	t.Run("Creates new account", func(t *testing.T) {
		account, err := svc.GetOrCreateAccount(ctx, "user-1")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		if account.UserID != "user-1" {
			t.Errorf("Expected user ID 'user-1', got %q", account.UserID)
		}
		if account.Tier != TierBronze {
			t.Errorf("Expected tier Bronze, got %v", account.Tier)
		}
		if account.Points != 0 {
			t.Errorf("Expected 0 points, got %d", account.Points)
		}
	})

	t.Run("Returns existing account", func(t *testing.T) {
		// Get the same account again
		account, err := svc.GetOrCreateAccount(ctx, "user-1")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		if account.UserID != "user-1" {
			t.Errorf("Expected user ID 'user-1', got %q", account.UserID)
		}
	})
}

func TestService_EarnPoints(t *testing.T) {
	repo := NewMockRepository()
	svc := NewService(repo)
	ctx := context.Background()

	t.Run("Earns points for purchase", func(t *testing.T) {
		tx, err := svc.EarnPoints(ctx, "user-1", "order-1", 100.0)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		// 100 * 10 points/dollar * 1.0 multiplier = 1000 points
		if tx.Points != 1000 {
			t.Errorf("Expected 1000 points, got %d", tx.Points)
		}
		if tx.Type != TransactionEarn {
			t.Errorf("Expected type 'earn', got %v", tx.Type)
		}
	})

	t.Run("Accumulates lifetime points", func(t *testing.T) {
		account, _ := svc.GetOrCreateAccount(ctx, "user-1")
		if account.LifetimePoints != 1000 {
			t.Errorf("Expected 1000 lifetime points, got %d", account.LifetimePoints)
		}
	})
}

func TestService_TierUpgrade(t *testing.T) {
	repo := NewMockRepository()
	svc := NewService(repo)
	ctx := context.Background()

	// Earn enough for Silver (1000 points)
	_, _ = svc.EarnPoints(ctx, "user-tier", "order-1", 100.0)

	account, _ := svc.GetOrCreateAccount(ctx, "user-tier")
	if account.Tier != TierSilver {
		t.Errorf("Expected tier Silver after 1000 points, got %v", account.Tier)
	}
}

func TestService_RedeemPoints(t *testing.T) {
	repo := NewMockRepository()
	svc := NewService(repo)
	ctx := context.Background()

	// First earn some points
	_, _ = svc.EarnPoints(ctx, "user-redeem", "order-1", 200.0) // 2000 points

	t.Run("Successful redemption", func(t *testing.T) {
		redemption, err := svc.RedeemPoints(ctx, "user-redeem", "reward-1")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		if redemption.Points != 1000 {
			t.Errorf("Expected 1000 points cost, got %d", redemption.Points)
		}
		if redemption.Code == "" {
			t.Error("Expected reward code to be generated")
		}
	})

	t.Run("Check points deducted", func(t *testing.T) {
		account, _ := svc.GetOrCreateAccount(ctx, "user-redeem")
		// Started with 2000, spent 1000
		if account.Points != 1000 {
			t.Errorf("Expected 1000 remaining points, got %d", account.Points)
		}
	})

	t.Run("Insufficient points", func(t *testing.T) {
		// Try to redeem when not enough points
		_, _ = svc.EarnPoints(ctx, "user-poor", "order-1", 10.0) // Only 100 points

		_, err := svc.RedeemPoints(ctx, "user-poor", "reward-1") // Needs 1000
		if err != ErrInsufficientPoints {
			t.Errorf("Expected ErrInsufficientPoints, got %v", err)
		}
	})
}

func TestService_GetAvailableRewards(t *testing.T) {
	repo := NewMockRepository()
	svc := NewService(repo)
	ctx := context.Background()

	// Create user with Silver tier
	_, _ = svc.EarnPoints(ctx, "user-rewards", "order-1", 100.0) // 1000 points = Silver

	rewards, err := svc.GetAvailableRewards(ctx, "user-rewards")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Silver tier should see both rewards
	if len(rewards) != 2 {
		t.Errorf("Expected 2 rewards for Silver tier, got %d", len(rewards))
	}
}

func TestService_UseRewardCode(t *testing.T) {
	repo := NewMockRepository()
	svc := NewService(repo)
	ctx := context.Background()

	// Earn and redeem
	_, _ = svc.EarnPoints(ctx, "user-code", "order-1", 200.0)
	redemption, _ := svc.RedeemPoints(ctx, "user-code", "reward-1")

	t.Run("Use valid code", func(t *testing.T) {
		used, err := svc.UseRewardCode(ctx, redemption.Code)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if used.UsedAt == nil {
			t.Error("Expected UsedAt to be set")
		}
	})

	t.Run("Cannot use code twice", func(t *testing.T) {
		_, err := svc.UseRewardCode(ctx, redemption.Code)
		if err != ErrAlreadyRedeemed {
			t.Errorf("Expected ErrAlreadyRedeemed, got %v", err)
		}
	})
}

func TestService_GetPointsToNextTier(t *testing.T) {
	svc := NewService(nil)

	tests := []struct {
		points       int
		currentTier  Tier
		expectedNext Tier
		pointsNeeded int
	}{
		{0, TierBronze, TierSilver, 1000},
		{500, TierBronze, TierSilver, 500},
		{1000, TierSilver, TierGold, 4000},
		{3000, TierSilver, TierGold, 2000},
		{15000, TierPlatinum, TierPlatinum, 0}, // Already max
	}

	for _, tt := range tests {
		t.Run(string(tt.currentTier), func(t *testing.T) {
			needed, nextTier := svc.GetPointsToNextTier(tt.points, tt.currentTier)
			if needed != tt.pointsNeeded {
				t.Errorf("Expected %d points needed, got %d", tt.pointsNeeded, needed)
			}
			if nextTier != tt.expectedNext {
				t.Errorf("Expected next tier %v, got %v", tt.expectedNext, nextTier)
			}
		})
	}
}

func TestTierConfigs(t *testing.T) {
	t.Run("Bronze is base tier", func(t *testing.T) {
		config := TierConfigs[TierBronze]
		if config.MinPoints != 0 {
			t.Errorf("Expected Bronze min points 0, got %d", config.MinPoints)
		}
		if config.PointsMultiplier != 1.0 {
			t.Errorf("Expected Bronze multiplier 1.0, got %f", config.PointsMultiplier)
		}
	})

	t.Run("Platinum has best benefits", func(t *testing.T) {
		config := TierConfigs[TierPlatinum]
		if config.PointsMultiplier != 2.0 {
			t.Errorf("Expected Platinum multiplier 2.0, got %f", config.PointsMultiplier)
		}
		if !config.FreeShipping {
			t.Error("Expected Platinum to have free shipping")
		}
		if !config.ExclusiveAccess {
			t.Error("Expected Platinum to have exclusive access")
		}
	})

	t.Run("Tier progression", func(t *testing.T) {
		tiers := []Tier{TierBronze, TierSilver, TierGold, TierPlatinum}
		lastMinPoints := -1
		for _, tier := range tiers {
			config := TierConfigs[tier]
			if config.MinPoints <= lastMinPoints {
				t.Errorf("Tier %s has lower min points than previous tier", tier)
			}
			lastMinPoints = config.MinPoints
		}
	})
}
