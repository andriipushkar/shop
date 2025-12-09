package loyalty

import (
	"context"
	"errors"
	"fmt"
	"time"
)

var (
	ErrInsufficientPoints = errors.New("insufficient points")
	ErrInvalidTier        = errors.New("invalid tier")
	ErrExpiredPoints      = errors.New("points have expired")
	ErrAlreadyRedeemed    = errors.New("reward already redeemed")
)

// Tier represents a loyalty tier
type Tier string

const (
	TierBronze   Tier = "bronze"
	TierSilver   Tier = "silver"
	TierGold     Tier = "gold"
	TierPlatinum Tier = "platinum"
)

// TierConfig defines tier configuration
type TierConfig struct {
	Name              string
	MinPoints         int
	PointsMultiplier  float64 // Multiplier for earning points
	DiscountPercent   float64 // Base discount percentage
	FreeShipping      bool
	PrioritySupport   bool
	ExclusiveAccess   bool
	BirthdayBonus     int  // Bonus points on birthday
	PointsExpiryDays  int  // Days until points expire (0 = never)
	RedemptionMinimum int  // Minimum points for redemption
}

var TierConfigs = map[Tier]TierConfig{
	TierBronze: {
		Name:              "Bronze",
		MinPoints:         0,
		PointsMultiplier:  1.0,
		DiscountPercent:   0,
		FreeShipping:      false,
		PrioritySupport:   false,
		ExclusiveAccess:   false,
		BirthdayBonus:     100,
		PointsExpiryDays:  365,
		RedemptionMinimum: 500,
	},
	TierSilver: {
		Name:              "Silver",
		MinPoints:         1000,
		PointsMultiplier:  1.25,
		DiscountPercent:   5,
		FreeShipping:      false,
		PrioritySupport:   false,
		ExclusiveAccess:   false,
		BirthdayBonus:     250,
		PointsExpiryDays:  365,
		RedemptionMinimum: 250,
	},
	TierGold: {
		Name:              "Gold",
		MinPoints:         5000,
		PointsMultiplier:  1.5,
		DiscountPercent:   10,
		FreeShipping:      true,
		PrioritySupport:   true,
		ExclusiveAccess:   false,
		BirthdayBonus:     500,
		PointsExpiryDays:  730,
		RedemptionMinimum: 100,
	},
	TierPlatinum: {
		Name:              "Platinum",
		MinPoints:         15000,
		PointsMultiplier:  2.0,
		DiscountPercent:   15,
		FreeShipping:      true,
		PrioritySupport:   true,
		ExclusiveAccess:   true,
		BirthdayBonus:     1000,
		PointsExpiryDays:  0, // Never expire
		RedemptionMinimum: 50,
	},
}

// TransactionType represents type of points transaction
type TransactionType string

const (
	TransactionEarn      TransactionType = "earn"
	TransactionRedeem    TransactionType = "redeem"
	TransactionExpire    TransactionType = "expire"
	TransactionBonus     TransactionType = "bonus"
	TransactionRefund    TransactionType = "refund"
	TransactionAdjust    TransactionType = "adjust"
)

// Transaction represents a points transaction
type Transaction struct {
	ID          string          `json:"id"`
	UserID      string          `json:"user_id"`
	Type        TransactionType `json:"type"`
	Points      int             `json:"points"`
	Balance     int             `json:"balance"`
	Description string          `json:"description"`
	OrderID     string          `json:"order_id,omitempty"`
	ExpiresAt   *time.Time      `json:"expires_at,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
}

// Account represents a loyalty account
type Account struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	Points          int       `json:"points"`
	LifetimePoints  int       `json:"lifetime_points"`
	Tier            Tier      `json:"tier"`
	TierExpiresAt   time.Time `json:"tier_expires_at"`
	JoinedAt        time.Time `json:"joined_at"`
	LastActivityAt  time.Time `json:"last_activity_at"`
}

// Reward represents a redeemable reward
type Reward struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	PointsCost  int       `json:"points_cost"`
	Type        string    `json:"type"` // discount, product, shipping, etc.
	Value       float64   `json:"value"`
	MinTier     Tier      `json:"min_tier"`
	Stock       int       `json:"stock"` // -1 for unlimited
	IsActive    bool      `json:"is_active"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// RewardRedemption represents a reward redemption
type RewardRedemption struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	RewardID    string    `json:"reward_id"`
	Points      int       `json:"points"`
	Code        string    `json:"code"`
	UsedAt      *time.Time `json:"used_at,omitempty"`
	ExpiresAt   time.Time `json:"expires_at"`
	CreatedAt   time.Time `json:"created_at"`
}

// Repository defines the loyalty data store interface
type Repository interface {
	// Account
	GetAccount(ctx context.Context, userID string) (*Account, error)
	CreateAccount(ctx context.Context, account *Account) error
	UpdateAccount(ctx context.Context, account *Account) error

	// Transactions
	CreateTransaction(ctx context.Context, tx *Transaction) error
	GetTransactions(ctx context.Context, userID string, limit, offset int) ([]*Transaction, int, error)
	GetExpiringPoints(ctx context.Context, userID string, before time.Time) (int, error)

	// Rewards
	GetRewards(ctx context.Context, tier Tier) ([]*Reward, error)
	GetReward(ctx context.Context, id string) (*Reward, error)

	// Redemptions
	CreateRedemption(ctx context.Context, redemption *RewardRedemption) error
	GetRedemption(ctx context.Context, code string) (*RewardRedemption, error)
	MarkRedemptionUsed(ctx context.Context, code string) error
}

// Service handles loyalty program business logic
type Service struct {
	repo            Repository
	pointsPerDollar int // Points earned per dollar spent
}

// NewService creates a new loyalty service
func NewService(repo Repository) *Service {
	return &Service{
		repo:            repo,
		pointsPerDollar: 10, // Default: 10 points per $1
	}
}

// GetOrCreateAccount gets or creates a loyalty account
func (s *Service) GetOrCreateAccount(ctx context.Context, userID string) (*Account, error) {
	account, err := s.repo.GetAccount(ctx, userID)
	if err == nil {
		return account, nil
	}

	// Create new account
	account = &Account{
		UserID:         userID,
		Points:         0,
		LifetimePoints: 0,
		Tier:           TierBronze,
		JoinedAt:       time.Now(),
		LastActivityAt: time.Now(),
	}

	if err := s.repo.CreateAccount(ctx, account); err != nil {
		return nil, err
	}

	return account, nil
}

// EarnPoints adds points for a purchase
func (s *Service) EarnPoints(ctx context.Context, userID string, orderID string, amount float64) (*Transaction, error) {
	account, err := s.GetOrCreateAccount(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Calculate points with tier multiplier
	config := TierConfigs[account.Tier]
	basePoints := int(amount * float64(s.pointsPerDollar))
	earnedPoints := int(float64(basePoints) * config.PointsMultiplier)

	// Set expiry
	var expiresAt *time.Time
	if config.PointsExpiryDays > 0 {
		exp := time.Now().AddDate(0, 0, config.PointsExpiryDays)
		expiresAt = &exp
	}

	// Create transaction
	tx := &Transaction{
		UserID:      userID,
		Type:        TransactionEarn,
		Points:      earnedPoints,
		Balance:     account.Points + earnedPoints,
		Description: fmt.Sprintf("Points for order %s", orderID),
		OrderID:     orderID,
		ExpiresAt:   expiresAt,
		CreatedAt:   time.Now(),
	}

	if err := s.repo.CreateTransaction(ctx, tx); err != nil {
		return nil, err
	}

	// Update account
	account.Points += earnedPoints
	account.LifetimePoints += earnedPoints
	account.LastActivityAt = time.Now()

	// Check for tier upgrade
	newTier := s.calculateTier(account.LifetimePoints)
	if newTier != account.Tier {
		account.Tier = newTier
		account.TierExpiresAt = time.Now().AddDate(1, 0, 0)
	}

	if err := s.repo.UpdateAccount(ctx, account); err != nil {
		return nil, err
	}

	return tx, nil
}

// RedeemPoints redeems points for a reward
func (s *Service) RedeemPoints(ctx context.Context, userID, rewardID string) (*RewardRedemption, error) {
	account, err := s.repo.GetAccount(ctx, userID)
	if err != nil {
		return nil, err
	}

	reward, err := s.repo.GetReward(ctx, rewardID)
	if err != nil {
		return nil, err
	}

	// Check tier requirement
	if !s.isTierEligible(account.Tier, reward.MinTier) {
		return nil, fmt.Errorf("tier %s required for this reward", reward.MinTier)
	}

	// Check points
	config := TierConfigs[account.Tier]
	if account.Points < reward.PointsCost || account.Points < config.RedemptionMinimum {
		return nil, ErrInsufficientPoints
	}

	// Check stock
	if reward.Stock == 0 {
		return nil, errors.New("reward out of stock")
	}

	// Create redemption
	redemption := &RewardRedemption{
		UserID:    userID,
		RewardID:  rewardID,
		Points:    reward.PointsCost,
		Code:      generateRewardCode(),
		ExpiresAt: time.Now().AddDate(0, 0, 30), // 30 days to use
		CreatedAt: time.Now(),
	}

	if err := s.repo.CreateRedemption(ctx, redemption); err != nil {
		return nil, err
	}

	// Create transaction
	tx := &Transaction{
		UserID:      userID,
		Type:        TransactionRedeem,
		Points:      -reward.PointsCost,
		Balance:     account.Points - reward.PointsCost,
		Description: fmt.Sprintf("Redeemed: %s", reward.Name),
		CreatedAt:   time.Now(),
	}

	if err := s.repo.CreateTransaction(ctx, tx); err != nil {
		return nil, err
	}

	// Update account
	account.Points -= reward.PointsCost
	account.LastActivityAt = time.Now()
	if err := s.repo.UpdateAccount(ctx, account); err != nil {
		return nil, err
	}

	return redemption, nil
}

// UseRewardCode marks a reward code as used
func (s *Service) UseRewardCode(ctx context.Context, code string) (*RewardRedemption, error) {
	redemption, err := s.repo.GetRedemption(ctx, code)
	if err != nil {
		return nil, err
	}

	if redemption.UsedAt != nil {
		return nil, ErrAlreadyRedeemed
	}

	if time.Now().After(redemption.ExpiresAt) {
		return nil, ErrExpiredPoints
	}

	if err := s.repo.MarkRedemptionUsed(ctx, code); err != nil {
		return nil, err
	}

	now := time.Now()
	redemption.UsedAt = &now
	return redemption, nil
}

// GetAvailableRewards returns rewards available to user
func (s *Service) GetAvailableRewards(ctx context.Context, userID string) ([]*Reward, error) {
	account, err := s.GetOrCreateAccount(ctx, userID)
	if err != nil {
		return nil, err
	}

	return s.repo.GetRewards(ctx, account.Tier)
}

// GetHistory returns transaction history
func (s *Service) GetHistory(ctx context.Context, userID string, limit, offset int) ([]*Transaction, int, error) {
	return s.repo.GetTransactions(ctx, userID, limit, offset)
}

// GetTierBenefits returns benefits for a tier
func (s *Service) GetTierBenefits(tier Tier) (*TierConfig, error) {
	config, ok := TierConfigs[tier]
	if !ok {
		return nil, ErrInvalidTier
	}
	return &config, nil
}

// GetPointsToNextTier calculates points needed for next tier
func (s *Service) GetPointsToNextTier(currentPoints int, currentTier Tier) (int, Tier) {
	tiers := []Tier{TierBronze, TierSilver, TierGold, TierPlatinum}

	for i, t := range tiers {
		if t == currentTier && i < len(tiers)-1 {
			nextTier := tiers[i+1]
			needed := TierConfigs[nextTier].MinPoints - currentPoints
			if needed < 0 {
				needed = 0
			}
			return needed, nextTier
		}
	}

	return 0, TierPlatinum // Already at max tier
}

func (s *Service) calculateTier(lifetimePoints int) Tier {
	if lifetimePoints >= TierConfigs[TierPlatinum].MinPoints {
		return TierPlatinum
	}
	if lifetimePoints >= TierConfigs[TierGold].MinPoints {
		return TierGold
	}
	if lifetimePoints >= TierConfigs[TierSilver].MinPoints {
		return TierSilver
	}
	return TierBronze
}

func (s *Service) isTierEligible(userTier, requiredTier Tier) bool {
	tierOrder := map[Tier]int{
		TierBronze:   0,
		TierSilver:   1,
		TierGold:     2,
		TierPlatinum: 3,
	}
	return tierOrder[userTier] >= tierOrder[requiredTier]
}

func generateRewardCode() string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	code := make([]byte, 8)
	for i := range code {
		code[i] = chars[time.Now().UnixNano()%int64(len(chars))]
	}
	return string(code)
}
