// Package onboarding provides tenant onboarding flow management
package onboarding

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// OnboardingStatus represents the status of onboarding
type OnboardingStatus string

const (
	StatusPending    OnboardingStatus = "pending"
	StatusInProgress OnboardingStatus = "in_progress"
	StatusCompleted  OnboardingStatus = "completed"
	StatusSkipped    OnboardingStatus = "skipped"
)

// StepType represents different onboarding step types
type StepType string

const (
	StepWelcome          StepType = "welcome"
	StepStoreSetup       StepType = "store_setup"
	StepBrandingSetup    StepType = "branding_setup"
	StepProductsImport   StepType = "products_import"
	StepPaymentSetup     StepType = "payment_setup"
	StepShippingSetup    StepType = "shipping_setup"
	StepDomainSetup      StepType = "domain_setup"
	StepFirstProduct     StepType = "first_product"
	StepInviteTeam       StepType = "invite_team"
	StepGoLive           StepType = "go_live"
)

// OnboardingFlow represents the complete onboarding flow for a tenant
type OnboardingFlow struct {
	ID          string            `json:"id" db:"id"`
	TenantID    string            `json:"tenant_id" db:"tenant_id"`
	Status      OnboardingStatus  `json:"status" db:"status"`
	CurrentStep StepType          `json:"current_step" db:"current_step"`
	Steps       []OnboardingStep  `json:"steps" db:"steps"`
	Progress    int               `json:"progress"` // 0-100
	StartedAt   time.Time         `json:"started_at" db:"started_at"`
	CompletedAt *time.Time        `json:"completed_at,omitempty" db:"completed_at"`
	Metadata    map[string]string `json:"metadata,omitempty" db:"metadata"`
}

// OnboardingStep represents a single onboarding step
type OnboardingStep struct {
	Type        StepType          `json:"type"`
	Title       string            `json:"title"`
	Description string            `json:"description"`
	Status      OnboardingStatus  `json:"status"`
	Required    bool              `json:"required"`
	Order       int               `json:"order"`
	Data        map[string]any    `json:"data,omitempty"`
	CompletedAt *time.Time        `json:"completed_at,omitempty"`
}

// DefaultSteps defines the default onboarding steps
var DefaultSteps = []OnboardingStep{
	{
		Type:        StepWelcome,
		Title:       "Ласкаво просимо",
		Description: "Познайомтесь з платформою та її можливостями",
		Required:    true,
		Order:       1,
		Status:      StatusPending,
	},
	{
		Type:        StepStoreSetup,
		Title:       "Налаштування магазину",
		Description: "Вкажіть назву, опис та контактну інформацію",
		Required:    true,
		Order:       2,
		Status:      StatusPending,
	},
	{
		Type:        StepBrandingSetup,
		Title:       "Брендинг",
		Description: "Завантажте логотип та налаштуйте кольори",
		Required:    false,
		Order:       3,
		Status:      StatusPending,
	},
	{
		Type:        StepFirstProduct,
		Title:       "Перший товар",
		Description: "Додайте ваш перший товар до каталогу",
		Required:    true,
		Order:       4,
		Status:      StatusPending,
	},
	{
		Type:        StepProductsImport,
		Title:       "Імпорт товарів",
		Description: "Імпортуйте товари з CSV або іншої платформи",
		Required:    false,
		Order:       5,
		Status:      StatusPending,
	},
	{
		Type:        StepPaymentSetup,
		Title:       "Налаштування оплати",
		Description: "Підключіть платіжну систему для прийому оплат",
		Required:    true,
		Order:       6,
		Status:      StatusPending,
	},
	{
		Type:        StepShippingSetup,
		Title:       "Налаштування доставки",
		Description: "Налаштуйте способи та зони доставки",
		Required:    true,
		Order:       7,
		Status:      StatusPending,
	},
	{
		Type:        StepDomainSetup,
		Title:       "Домен",
		Description: "Підключіть власний домен або використовуйте наш",
		Required:    false,
		Order:       8,
		Status:      StatusPending,
	},
	{
		Type:        StepInviteTeam,
		Title:       "Запросіть команду",
		Description: "Додайте співробітників до вашого магазину",
		Required:    false,
		Order:       9,
		Status:      StatusPending,
	},
	{
		Type:        StepGoLive,
		Title:       "Запуск магазину",
		Description: "Зробіть магазин доступним для покупців",
		Required:    true,
		Order:       10,
		Status:      StatusPending,
	},
}

// Service handles onboarding flow management
type Service struct {
	db     *sql.DB
	logger *zap.Logger
}

// NewService creates a new onboarding service
func NewService(db *sql.DB, logger *zap.Logger) *Service {
	return &Service{
		db:     db,
		logger: logger,
	}
}

// CreateFlow creates a new onboarding flow for a tenant
func (s *Service) CreateFlow(ctx context.Context, tenantID string) (*OnboardingFlow, error) {
	// Check if flow already exists
	existing, err := s.GetFlow(ctx, tenantID)
	if err == nil && existing != nil {
		return existing, nil
	}

	// Create new flow with default steps
	steps := make([]OnboardingStep, len(DefaultSteps))
	copy(steps, DefaultSteps)

	flow := &OnboardingFlow{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Status:      StatusInProgress,
		CurrentStep: StepWelcome,
		Steps:       steps,
		Progress:    0,
		StartedAt:   time.Now(),
		Metadata:    make(map[string]string),
	}

	if err := s.saveFlow(ctx, flow); err != nil {
		return nil, fmt.Errorf("failed to save onboarding flow: %w", err)
	}

	s.logger.Info("Onboarding flow created",
		zap.String("tenant_id", tenantID),
		zap.String("flow_id", flow.ID),
	)

	return flow, nil
}

// GetFlow retrieves the onboarding flow for a tenant
func (s *Service) GetFlow(ctx context.Context, tenantID string) (*OnboardingFlow, error) {
	flow := &OnboardingFlow{}
	err := s.db.QueryRowContext(ctx, `
		SELECT id, tenant_id, status, current_step, steps, progress,
			   started_at, completed_at, metadata
		FROM onboarding_flows
		WHERE tenant_id = $1
	`, tenantID).Scan(
		&flow.ID, &flow.TenantID, &flow.Status, &flow.CurrentStep,
		&flow.Steps, &flow.Progress, &flow.StartedAt, &flow.CompletedAt, &flow.Metadata,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("onboarding flow not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get onboarding flow: %w", err)
	}

	return flow, nil
}

// CompleteStep marks a step as completed
func (s *Service) CompleteStep(ctx context.Context, tenantID string, stepType StepType, data map[string]any) error {
	flow, err := s.GetFlow(ctx, tenantID)
	if err != nil {
		return err
	}

	// Find and update the step
	stepFound := false
	now := time.Now()
	for i := range flow.Steps {
		if flow.Steps[i].Type == stepType {
			flow.Steps[i].Status = StatusCompleted
			flow.Steps[i].CompletedAt = &now
			flow.Steps[i].Data = data
			stepFound = true
			break
		}
	}

	if !stepFound {
		return fmt.Errorf("step not found: %s", stepType)
	}

	// Update progress and current step
	flow.Progress = s.calculateProgress(flow.Steps)
	flow.CurrentStep = s.findNextStep(flow.Steps)

	// Check if all required steps are completed
	if s.allRequiredStepsCompleted(flow.Steps) {
		flow.Status = StatusCompleted
		flow.CompletedAt = &now
	}

	if err := s.updateFlow(ctx, flow); err != nil {
		return fmt.Errorf("failed to update onboarding flow: %w", err)
	}

	s.logger.Info("Onboarding step completed",
		zap.String("tenant_id", tenantID),
		zap.String("step", string(stepType)),
		zap.Int("progress", flow.Progress),
	)

	return nil
}

// SkipStep marks a step as skipped (only for non-required steps)
func (s *Service) SkipStep(ctx context.Context, tenantID string, stepType StepType) error {
	flow, err := s.GetFlow(ctx, tenantID)
	if err != nil {
		return err
	}

	// Find and update the step
	for i := range flow.Steps {
		if flow.Steps[i].Type == stepType {
			if flow.Steps[i].Required {
				return errors.New("cannot skip required step")
			}
			flow.Steps[i].Status = StatusSkipped
			break
		}
	}

	// Update progress and current step
	flow.Progress = s.calculateProgress(flow.Steps)
	flow.CurrentStep = s.findNextStep(flow.Steps)

	if err := s.updateFlow(ctx, flow); err != nil {
		return fmt.Errorf("failed to update onboarding flow: %w", err)
	}

	s.logger.Info("Onboarding step skipped",
		zap.String("tenant_id", tenantID),
		zap.String("step", string(stepType)),
	)

	return nil
}

// GetCurrentStep returns the current step with its details
func (s *Service) GetCurrentStep(ctx context.Context, tenantID string) (*OnboardingStep, error) {
	flow, err := s.GetFlow(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	for _, step := range flow.Steps {
		if step.Type == flow.CurrentStep {
			return &step, nil
		}
	}

	return nil, errors.New("current step not found")
}

// GetStepData returns the data collected for a step
func (s *Service) GetStepData(ctx context.Context, tenantID string, stepType StepType) (map[string]any, error) {
	flow, err := s.GetFlow(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	for _, step := range flow.Steps {
		if step.Type == stepType {
			return step.Data, nil
		}
	}

	return nil, errors.New("step not found")
}

// IsCompleted checks if onboarding is completed
func (s *Service) IsCompleted(ctx context.Context, tenantID string) (bool, error) {
	flow, err := s.GetFlow(ctx, tenantID)
	if err != nil {
		return false, err
	}
	return flow.Status == StatusCompleted, nil
}

// ResetFlow resets the onboarding flow
func (s *Service) ResetFlow(ctx context.Context, tenantID string) error {
	if err := s.deleteFlow(ctx, tenantID); err != nil {
		return err
	}

	_, err := s.CreateFlow(ctx, tenantID)
	return err
}

// Helper methods

func (s *Service) calculateProgress(steps []OnboardingStep) int {
	if len(steps) == 0 {
		return 0
	}

	completed := 0
	for _, step := range steps {
		if step.Status == StatusCompleted || step.Status == StatusSkipped {
			completed++
		}
	}

	return (completed * 100) / len(steps)
}

func (s *Service) findNextStep(steps []OnboardingStep) StepType {
	for _, step := range steps {
		if step.Status == StatusPending {
			return step.Type
		}
	}
	return steps[len(steps)-1].Type
}

func (s *Service) allRequiredStepsCompleted(steps []OnboardingStep) bool {
	for _, step := range steps {
		if step.Required && step.Status != StatusCompleted {
			return false
		}
	}
	return true
}

func (s *Service) saveFlow(ctx context.Context, flow *OnboardingFlow) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO onboarding_flows (
			id, tenant_id, status, current_step, steps, progress,
			started_at, completed_at, metadata
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`,
		flow.ID, flow.TenantID, flow.Status, flow.CurrentStep,
		flow.Steps, flow.Progress, flow.StartedAt, flow.CompletedAt, flow.Metadata,
	)
	return err
}

func (s *Service) updateFlow(ctx context.Context, flow *OnboardingFlow) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE onboarding_flows SET
			status = $2, current_step = $3, steps = $4, progress = $5,
			completed_at = $6, metadata = $7
		WHERE id = $1
	`,
		flow.ID, flow.Status, flow.CurrentStep, flow.Steps,
		flow.Progress, flow.CompletedAt, flow.Metadata,
	)
	return err
}

func (s *Service) deleteFlow(ctx context.Context, tenantID string) error {
	_, err := s.db.ExecContext(ctx,
		"DELETE FROM onboarding_flows WHERE tenant_id = $1", tenantID,
	)
	return err
}

// StepGuide provides help content for each step
type StepGuide struct {
	StepType    StepType  `json:"step_type"`
	Title       string    `json:"title"`
	Content     string    `json:"content"`
	VideoURL    string    `json:"video_url,omitempty"`
	HelpArticle string    `json:"help_article,omitempty"`
	Tips        []string  `json:"tips,omitempty"`
}

// GetStepGuide returns the guide content for a step
func GetStepGuide(stepType StepType) *StepGuide {
	guides := map[StepType]*StepGuide{
		StepWelcome: {
			StepType: StepWelcome,
			Title:    "Ласкаво просимо до Shop Platform!",
			Content:  "Ми допоможемо вам налаштувати ваш інтернет-магазин за кілька простих кроків. Цей процес займе близько 15 хвилин.",
			Tips: []string{
				"Ви можете пропустити необов'язкові кроки та повернутися до них пізніше",
				"Наша команда підтримки доступна 24/7",
				"Перегляньте наші відео-уроки для детальних інструкцій",
			},
		},
		StepStoreSetup: {
			StepType: StepStoreSetup,
			Title:    "Налаштування магазину",
			Content:  "Введіть основну інформацію про ваш магазин: назву, опис, контактний email та телефон.",
			Tips: []string{
				"Назва магазину буде відображатися в результатах пошуку",
				"Додайте детальний опис для кращого SEO",
				"Вкажіть робочі години для зручності клієнтів",
			},
		},
		StepBrandingSetup: {
			StepType:    StepBrandingSetup,
			Title:       "Брендинг вашого магазину",
			Content:     "Завантажте логотип та налаштуйте кольорову схему, щоб магазин відповідав вашому бренду.",
			HelpArticle: "/help/branding-guide",
			Tips: []string{
				"Рекомендований розмір логотипу: 512x512 px",
				"Використовуйте контрастні кольори для кращої читабельності",
				"Favicon буде згенерований автоматично з логотипу",
			},
		},
		StepFirstProduct: {
			StepType: StepFirstProduct,
			Title:    "Додайте перший товар",
			Content:  "Створіть ваш перший товар з описом, ціною та фотографіями.",
			VideoURL: "/videos/add-product",
			Tips: []string{
				"Якісні фото збільшують конверсію на 30%",
				"Детальний опис покращує SEO",
				"Не забудьте вказати наявність на складі",
			},
		},
		StepProductsImport: {
			StepType:    StepProductsImport,
			Title:       "Імпорт товарів",
			Content:     "Імпортуйте товари з CSV файлу або з іншої платформи (Shopify, WooCommerce).",
			HelpArticle: "/help/import-products",
			Tips: []string{
				"Завантажте шаблон CSV для правильного форматування",
				"Максимальний розмір файлу: 50 MB",
				"Підтримується імпорт до 10,000 товарів одночасно",
			},
		},
		StepPaymentSetup: {
			StepType: StepPaymentSetup,
			Title:    "Налаштування оплати",
			Content:  "Підключіть платіжну систему для прийому оплат онлайн: карти, Apple Pay, Google Pay.",
			VideoURL: "/videos/payment-setup",
			Tips: []string{
				"LiqPay та Fondy - найпопулярніші в Україні",
				"Stripe доступний для міжнародних продажів",
				"Можна підключити кілька платіжних систем",
			},
		},
		StepShippingSetup: {
			StepType: StepShippingSetup,
			Title:    "Налаштування доставки",
			Content:  "Налаштуйте способи доставки: Нова Пошта, Укрпошта, кур'єр, самовивіз.",
			Tips: []string{
				"Нова Пошта - найпопулярніший спосіб доставки",
				"Налаштуйте безкоштовну доставку від певної суми",
				"Вкажіть терміни доставки для різних регіонів",
			},
		},
		StepDomainSetup: {
			StepType:    StepDomainSetup,
			Title:       "Підключення домену",
			Content:     "Використовуйте наш безкоштовний піддомен або підключіть власний домен.",
			HelpArticle: "/help/domain-setup",
			Tips: []string{
				"Безкоштовний піддомен: yourstore.shop.ua",
				"SSL сертифікат надається безкоштовно",
				"DNS записи налаштовуються автоматично",
			},
		},
		StepInviteTeam: {
			StepType: StepInviteTeam,
			Title:    "Запрошення команди",
			Content:  "Додайте співробітників з різними ролями: адміністратор, менеджер, оператор.",
			Tips: []string{
				"Адміністратор має повний доступ",
				"Менеджер може управляти товарами та замовленнями",
				"Оператор бачить тільки замовлення",
			},
		},
		StepGoLive: {
			StepType: StepGoLive,
			Title:    "Запуск магазину!",
			Content:  "Перевірте все налаштування та зробіть магазин доступним для покупців.",
			Tips: []string{
				"Перевірте тестове замовлення перед запуском",
				"Переконайтеся, що всі контакти вказані правильно",
				"Підготуйте анонс у соціальних мережах",
			},
		},
	}

	return guides[stepType]
}
