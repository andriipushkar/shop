# Tenant Onboarding

Процес онбордингу нових тенантів на платформі.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TENANT ONBOARDING FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐ │
│  │ Register │──▶│ Verify   │──▶│ Setup    │──▶│ Configure│──▶│ Launch   │ │
│  │          │   │ Email    │   │ Store    │   │ Settings │   │          │ │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘ │
│       │              │              │              │              │        │
│       ▼              ▼              ▼              ▼              ▼        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                     Onboarding Progress                              │  │
│  │  [████████░░░░░░░░░░░] 40%                                          │  │
│  │                                                                      │  │
│  │  ✓ Account created                                                   │  │
│  │  ✓ Email verified                                                    │  │
│  │  ○ Store settings                                                    │  │
│  │  ○ Payment methods                                                   │  │
│  │  ○ First product                                                     │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Onboarding Steps

### Step 1: Registration

```go
// services/core/internal/onboarding/registration.go
type RegistrationRequest struct {
    Email       string `json:"email" validate:"required,email"`
    Password    string `json:"password" validate:"required,min=8"`
    StoreName   string `json:"store_name" validate:"required,min=2,max=100"`
    Phone       string `json:"phone" validate:"required"`
    Plan        string `json:"plan" validate:"required,oneof=starter business enterprise"`
}

func (s *OnboardingService) Register(ctx context.Context, req *RegistrationRequest) (*Tenant, error) {
    // Validate request
    if err := s.validator.Struct(req); err != nil {
        return nil, fmt.Errorf("validation: %w", err)
    }

    // Check if email already exists
    if exists, _ := s.userRepo.ExistsByEmail(ctx, req.Email); exists {
        return nil, ErrEmailAlreadyExists
    }

    // Create tenant
    tenant := &Tenant{
        ID:     uuid.New().String(),
        Name:   req.StoreName,
        Domain: s.generateDomain(req.StoreName),
        Plan:   req.Plan,
        Status: TenantStatusPending,
        OnboardingStep: "email_verification",
        CreatedAt: time.Now(),
    }

    if err := s.tenantRepo.Create(ctx, tenant); err != nil {
        return nil, fmt.Errorf("create tenant: %w", err)
    }

    // Create admin user
    user := &User{
        ID:       uuid.New().String(),
        TenantID: tenant.ID,
        Email:    req.Email,
        Password: s.hashPassword(req.Password),
        Phone:    req.Phone,
        Role:     RoleAdmin,
        Status:   UserStatusPending,
    }

    if err := s.userRepo.Create(ctx, user); err != nil {
        return nil, fmt.Errorf("create user: %w", err)
    }

    // Send verification email
    s.sendVerificationEmail(ctx, user)

    // Track onboarding start
    s.analytics.Track(ctx, "onboarding_started", map[string]interface{}{
        "tenant_id": tenant.ID,
        "plan":      tenant.Plan,
    })

    return tenant, nil
}
```

### Step 2: Email Verification

```go
// services/core/internal/onboarding/verification.go
func (s *OnboardingService) VerifyEmail(ctx context.Context, token string) error {
    // Decode and validate token
    claims, err := s.parseVerificationToken(token)
    if err != nil {
        return ErrInvalidToken
    }

    // Get user
    user, err := s.userRepo.FindByID(ctx, claims.UserID)
    if err != nil {
        return ErrUserNotFound
    }

    // Update user status
    user.Status = UserStatusActive
    user.EmailVerifiedAt = timePtr(time.Now())
    if err := s.userRepo.Update(ctx, user); err != nil {
        return err
    }

    // Update tenant onboarding step
    tenant, _ := s.tenantRepo.FindByID(ctx, user.TenantID)
    tenant.OnboardingStep = "store_setup"
    s.tenantRepo.Update(ctx, tenant)

    // Track progress
    s.analytics.Track(ctx, "onboarding_email_verified", map[string]interface{}{
        "tenant_id": tenant.ID,
    })

    return nil
}

func (s *OnboardingService) sendVerificationEmail(ctx context.Context, user *User) {
    token := s.generateVerificationToken(user.ID)
    verifyURL := fmt.Sprintf("%s/verify-email?token=%s", s.config.AppURL, token)

    s.emailService.Send(ctx, &EmailMessage{
        To:       user.Email,
        Template: "email_verification",
        Data: map[string]interface{}{
            "name":       user.Name,
            "verify_url": verifyURL,
        },
    })
}
```

### Step 3: Store Setup

```go
// services/core/internal/onboarding/store_setup.go
type StoreSetupRequest struct {
    StoreName    string            `json:"store_name"`
    Description  string            `json:"description"`
    Logo         string            `json:"logo"`
    Currency     string            `json:"currency"`
    Country      string            `json:"country"`
    Timezone     string            `json:"timezone"`
    Categories   []string          `json:"categories"`
    SocialLinks  map[string]string `json:"social_links"`
}

func (s *OnboardingService) SetupStore(ctx context.Context, tenantID string, req *StoreSetupRequest) error {
    tenant, err := s.tenantRepo.FindByID(ctx, tenantID)
    if err != nil {
        return err
    }

    // Update tenant settings
    tenant.Name = req.StoreName
    tenant.Settings = TenantSettings{
        Currency:    req.Currency,
        Country:     req.Country,
        Timezone:    req.Timezone,
        Description: req.Description,
        Logo:        req.Logo,
        SocialLinks: req.SocialLinks,
    }
    tenant.OnboardingStep = "payment_setup"

    if err := s.tenantRepo.Update(ctx, tenant); err != nil {
        return err
    }

    // Create default categories
    for _, cat := range req.Categories {
        s.categoryRepo.Create(ctx, &Category{
            TenantID: tenantID,
            Name:     cat,
            Slug:     slugify(cat),
        })
    }

    // Track progress
    s.analytics.Track(ctx, "onboarding_store_setup", map[string]interface{}{
        "tenant_id": tenant.ID,
        "currency":  req.Currency,
        "country":   req.Country,
    })

    return nil
}
```

### Step 4: Payment Configuration

```go
// services/core/internal/onboarding/payment_setup.go
type PaymentSetupRequest struct {
    PaymentMethods []PaymentMethodConfig `json:"payment_methods"`
}

type PaymentMethodConfig struct {
    Provider   string            `json:"provider"` // liqpay, monobank, privatbank
    Enabled    bool              `json:"enabled"`
    Credentials map[string]string `json:"credentials"`
}

func (s *OnboardingService) SetupPayments(ctx context.Context, tenantID string, req *PaymentSetupRequest) error {
    tenant, err := s.tenantRepo.FindByID(ctx, tenantID)
    if err != nil {
        return err
    }

    // Validate and store payment credentials
    for _, pm := range req.PaymentMethods {
        if !pm.Enabled {
            continue
        }

        // Validate credentials
        if err := s.validatePaymentCredentials(ctx, pm); err != nil {
            return fmt.Errorf("invalid %s credentials: %w", pm.Provider, err)
        }

        // Store encrypted credentials
        encryptedCreds := s.encryptCredentials(pm.Credentials)
        s.paymentConfigRepo.Save(ctx, &PaymentConfig{
            TenantID:    tenantID,
            Provider:    pm.Provider,
            Credentials: encryptedCreds,
            Enabled:     true,
        })
    }

    tenant.OnboardingStep = "first_product"
    s.tenantRepo.Update(ctx, tenant)

    s.analytics.Track(ctx, "onboarding_payment_setup", map[string]interface{}{
        "tenant_id": tenant.ID,
        "methods":   len(req.PaymentMethods),
    })

    return nil
}
```

### Step 5: First Product

```go
// services/core/internal/onboarding/first_product.go
type FirstProductRequest struct {
    Name        string   `json:"name"`
    Description string   `json:"description"`
    Price       float64  `json:"price"`
    Quantity    int      `json:"quantity"`
    Images      []string `json:"images"`
    CategoryID  string   `json:"category_id"`
}

func (s *OnboardingService) CreateFirstProduct(ctx context.Context, tenantID string, req *FirstProductRequest) error {
    tenant, err := s.tenantRepo.FindByID(ctx, tenantID)
    if err != nil {
        return err
    }

    // Create product
    product := &Product{
        ID:          uuid.New().String(),
        TenantID:    tenantID,
        Name:        req.Name,
        Slug:        slugify(req.Name),
        Description: req.Description,
        Price:       req.Price,
        Quantity:    req.Quantity,
        CategoryID:  req.CategoryID,
        Status:      ProductStatusActive,
        Images:      req.Images,
    }

    if err := s.productRepo.Create(ctx, product); err != nil {
        return err
    }

    // Complete onboarding
    tenant.OnboardingStep = "completed"
    tenant.OnboardingCompletedAt = timePtr(time.Now())
    tenant.Status = TenantStatusActive
    s.tenantRepo.Update(ctx, tenant)

    s.analytics.Track(ctx, "onboarding_completed", map[string]interface{}{
        "tenant_id": tenant.ID,
        "duration":  time.Since(tenant.CreatedAt).Hours(),
    })

    // Send welcome email
    s.sendWelcomeEmail(ctx, tenant)

    return nil
}
```

## Onboarding Checklist

```go
// services/core/internal/onboarding/checklist.go
type OnboardingChecklist struct {
    Items      []ChecklistItem `json:"items"`
    Completed  int             `json:"completed"`
    Total      int             `json:"total"`
    Percentage int             `json:"percentage"`
}

type ChecklistItem struct {
    ID          string `json:"id"`
    Title       string `json:"title"`
    Description string `json:"description"`
    Completed   bool   `json:"completed"`
    Required    bool   `json:"required"`
    ActionURL   string `json:"action_url"`
}

func (s *OnboardingService) GetChecklist(ctx context.Context, tenantID string) (*OnboardingChecklist, error) {
    tenant, err := s.tenantRepo.FindByID(ctx, tenantID)
    if err != nil {
        return nil, err
    }

    items := []ChecklistItem{
        {
            ID:          "email_verified",
            Title:       "Підтвердіть email",
            Description: "Підтвердіть вашу email адресу",
            Completed:   tenant.OnboardingStep != "email_verification",
            Required:    true,
            ActionURL:   "/onboarding/verify-email",
        },
        {
            ID:          "store_setup",
            Title:       "Налаштуйте магазин",
            Description: "Додайте назву, логотип та опис",
            Completed:   s.isStepCompleted(tenant, "store_setup"),
            Required:    true,
            ActionURL:   "/onboarding/store-setup",
        },
        {
            ID:          "payment_setup",
            Title:       "Налаштуйте оплату",
            Description: "Підключіть платіжні системи",
            Completed:   s.isStepCompleted(tenant, "payment_setup"),
            Required:    true,
            ActionURL:   "/onboarding/payment-setup",
        },
        {
            ID:          "first_product",
            Title:       "Додайте перший товар",
            Description: "Створіть свій перший товар",
            Completed:   s.isStepCompleted(tenant, "first_product"),
            Required:    true,
            ActionURL:   "/onboarding/first-product",
        },
        {
            ID:          "custom_domain",
            Title:       "Підключіть домен",
            Description: "Налаштуйте власний домен",
            Completed:   tenant.CustomDomain != "",
            Required:    false,
            ActionURL:   "/settings/domain",
        },
        {
            ID:          "shipping_setup",
            Title:       "Налаштуйте доставку",
            Description: "Підключіть Нову Пошту",
            Completed:   s.hasShippingSetup(ctx, tenantID),
            Required:    false,
            ActionURL:   "/settings/shipping",
        },
    }

    completed := 0
    for _, item := range items {
        if item.Completed {
            completed++
        }
    }

    return &OnboardingChecklist{
        Items:      items,
        Completed:  completed,
        Total:      len(items),
        Percentage: (completed * 100) / len(items),
    }, nil
}
```

## Demo Data Generation

```go
// services/core/internal/onboarding/demo.go
func (s *OnboardingService) GenerateDemoData(ctx context.Context, tenantID string) error {
    // Create demo categories
    categories := []string{"Електроніка", "Одяг", "Аксесуари"}
    categoryIDs := make(map[string]string)

    for _, name := range categories {
        cat := &Category{
            ID:       uuid.New().String(),
            TenantID: tenantID,
            Name:     name,
            Slug:     slugify(name),
        }
        s.categoryRepo.Create(ctx, cat)
        categoryIDs[name] = cat.ID
    }

    // Create demo products
    products := []struct {
        Name     string
        Category string
        Price    float64
    }{
        {"iPhone 15 Pro", "Електроніка", 49999},
        {"MacBook Air M3", "Електроніка", 54999},
        {"Футболка базова", "Одяг", 599},
        {"Джинси класичні", "Одяг", 1299},
        {"Чохол для iPhone", "Аксесуари", 299},
    }

    for _, p := range products {
        product := &Product{
            ID:          uuid.New().String(),
            TenantID:    tenantID,
            Name:        p.Name,
            Slug:        slugify(p.Name),
            CategoryID:  categoryIDs[p.Category],
            Price:       p.Price,
            Quantity:    100,
            Status:      ProductStatusActive,
            Description: fmt.Sprintf("Демо товар: %s", p.Name),
        }
        s.productRepo.Create(ctx, product)
    }

    // Create demo customer
    customer := &Customer{
        ID:        uuid.New().String(),
        TenantID:  tenantID,
        Email:     "demo@example.com",
        FirstName: "Демо",
        LastName:  "Клієнт",
        Phone:     "+380501234567",
    }
    s.customerRepo.Create(ctx, customer)

    // Create demo order
    order := &Order{
        ID:         uuid.New().String(),
        TenantID:   tenantID,
        CustomerID: customer.ID,
        Number:     "DEMO-001",
        Status:     "completed",
        Total:      50598,
        Items: []OrderItem{
            {ProductID: products[0].ID, Quantity: 1, Price: 49999},
            {ProductID: products[4].ID, Quantity: 2, Price: 299},
        },
    }
    s.orderRepo.Create(ctx, order)

    return nil
}
```

## Onboarding Emails

```go
// Email templates
var onboardingEmails = map[string]string{
    "welcome": `
        Вітаємо у Shop.ua!

        Ваш магазин {{.StoreName}} успішно створено.

        Наступні кроки:
        1. Додайте товари
        2. Налаштуйте оплату
        3. Поділіться посиланням з клієнтами

        Ваш магазин: {{.StoreURL}}
    `,
    "onboarding_reminder": `
        Привіт, {{.Name}}!

        Ви ще не завершили налаштування магазину.
        Залишилось виконати:
        {{range .RemainingSteps}}
        - {{.}}
        {{end}}

        Продовжити: {{.OnboardingURL}}
    `,
}
```

## Analytics & Tracking

```go
// Onboarding funnel tracking
func (s *OnboardingService) trackFunnel(ctx context.Context, tenantID, step string) {
    s.analytics.Track(ctx, "onboarding_funnel", map[string]interface{}{
        "tenant_id": tenantID,
        "step":      step,
        "timestamp": time.Now(),
    })
}

// Funnel analysis query
// SELECT
//     step,
//     COUNT(DISTINCT tenant_id) as users,
//     COUNT(DISTINCT tenant_id) * 100.0 / LAG(COUNT(DISTINCT tenant_id)) OVER (ORDER BY step) as conversion
// FROM onboarding_events
// GROUP BY step
// ORDER BY step
```

## See Also

- [Multi-Tenancy](../architecture/MULTI_TENANCY.md)
- [Tenant Module](./TENANT.md)
- [Authentication](./AUTH.md)
