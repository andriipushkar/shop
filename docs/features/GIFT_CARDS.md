# Gift Cards

Система подарункових карт з підтримкою фізичних та цифрових карт, балансу та часткового використання.

## Функціонал

- Цифрові та фізичні подарункові карти
- Налаштовані номінали або довільні суми
- Часткове використання з залишком балансу
- Термін дії
- Персоналізовані повідомлення
- Email-доставка для цифрових карт
- Відстеження історії транзакцій

## Моделі даних

```go
// internal/giftcard/models.go
package giftcard

import (
    "time"
    "github.com/shopspring/decimal"
)

type GiftCardStatus string

const (
    GiftCardStatusPending   GiftCardStatus = "pending"   // Awaiting payment
    GiftCardStatusActive    GiftCardStatus = "active"    // Ready to use
    GiftCardStatusRedeemed  GiftCardStatus = "redeemed"  // Fully used
    GiftCardStatusExpired   GiftCardStatus = "expired"   // Past expiry date
    GiftCardStatusDisabled  GiftCardStatus = "disabled"  // Manually disabled
)

type GiftCardType string

const (
    GiftCardTypeDigital  GiftCardType = "digital"
    GiftCardTypePhysical GiftCardType = "physical"
)

type GiftCard struct {
    ID              string          `json:"id" gorm:"primaryKey"`
    TenantID        string          `json:"tenant_id" gorm:"index"`
    Code            string          `json:"code" gorm:"uniqueIndex"`
    Type            GiftCardType    `json:"type"`
    Status          GiftCardStatus  `json:"status"`

    // Value
    InitialBalance  decimal.Decimal `json:"initial_balance"`
    CurrentBalance  decimal.Decimal `json:"current_balance"`
    Currency        string          `json:"currency"`

    // Sender
    PurchaserID     *string         `json:"purchaser_id"`
    PurchaserEmail  string          `json:"purchaser_email"`
    PurchaserName   string          `json:"purchaser_name"`

    // Recipient
    RecipientEmail  string          `json:"recipient_email"`
    RecipientName   string          `json:"recipient_name"`
    Message         string          `json:"message"`

    // Delivery
    DeliveryDate    *time.Time      `json:"delivery_date"` // Scheduled delivery
    DeliveredAt     *time.Time      `json:"delivered_at"`

    // Design
    DesignID        string          `json:"design_id"`
    CustomImage     string          `json:"custom_image"`

    // Validity
    ExpiresAt       *time.Time      `json:"expires_at"`

    // Source
    OrderID         *string         `json:"order_id"`
    OrderItemID     *string         `json:"order_item_id"`

    // Tracking
    LastUsedAt      *time.Time      `json:"last_used_at"`

    CreatedAt       time.Time       `json:"created_at"`
    UpdatedAt       time.Time       `json:"updated_at"`
}

type GiftCardTransaction struct {
    ID          string          `json:"id" gorm:"primaryKey"`
    GiftCardID  string          `json:"gift_card_id" gorm:"index"`
    Type        TransactionType `json:"type"`
    Amount      decimal.Decimal `json:"amount"`
    BalanceAfter decimal.Decimal `json:"balance_after"`

    // Reference
    OrderID     *string         `json:"order_id"`
    Note        string          `json:"note"`

    // User
    UserID      *string         `json:"user_id"`

    CreatedAt   time.Time       `json:"created_at"`
}

type TransactionType string

const (
    TransactionTypeCredit TransactionType = "credit"  // Adding balance
    TransactionTypeDebit  TransactionType = "debit"   // Using balance
    TransactionTypeRefund TransactionType = "refund"  // Returning balance
)

type GiftCardDesign struct {
    ID          string    `json:"id" gorm:"primaryKey"`
    TenantID    string    `json:"tenant_id" gorm:"index"`
    Name        string    `json:"name"`
    ImageURL    string    `json:"image_url"`
    ThumbnailURL string   `json:"thumbnail_url"`
    Category    string    `json:"category"` // birthday, holiday, thank_you, etc.
    IsActive    bool      `json:"is_active"`
    SortOrder   int       `json:"sort_order"`
    CreatedAt   time.Time `json:"created_at"`
}

type GiftCardProduct struct {
    ID          string          `json:"id" gorm:"primaryKey"`
    TenantID    string          `json:"tenant_id" gorm:"index"`
    ProductID   string          `json:"product_id" gorm:"uniqueIndex"`
    Type        GiftCardType    `json:"type"`

    // Denominations (fixed amounts)
    Denominations []decimal.Decimal `json:"denominations" gorm:"serializer:json"`

    // Or custom amount range
    AllowCustomAmount bool          `json:"allow_custom_amount"`
    MinAmount       decimal.Decimal `json:"min_amount"`
    MaxAmount       decimal.Decimal `json:"max_amount"`

    // Validity
    ValidityDays    int             `json:"validity_days"` // Days from purchase

    CreatedAt       time.Time       `json:"created_at"`
    UpdatedAt       time.Time       `json:"updated_at"`
}
```

## Service

```go
// internal/giftcard/service.go
package giftcard

import (
    "context"
    "crypto/rand"
    "encoding/hex"
    "fmt"
    "time"
)

type GiftCardService struct {
    repo      GiftCardRepository
    email     EmailService
    events    EventPublisher
}

func NewGiftCardService(repo GiftCardRepository, email EmailService, events EventPublisher) *GiftCardService {
    return &GiftCardService{
        repo:   repo,
        email:  email,
        events: events,
    }
}

type CreateGiftCardRequest struct {
    Type           GiftCardType
    Amount         decimal.Decimal
    Currency       string
    PurchaserEmail string
    PurchaserName  string
    RecipientEmail string
    RecipientName  string
    Message        string
    DesignID       string
    DeliveryDate   *time.Time
    ValidityDays   int
    OrderID        *string
    OrderItemID    *string
}

// Create creates a new gift card
func (s *GiftCardService) Create(ctx context.Context, req *CreateGiftCardRequest) (*GiftCard, error) {
    code, err := s.generateUniqueCode(ctx)
    if err != nil {
        return nil, err
    }

    var expiresAt *time.Time
    if req.ValidityDays > 0 {
        exp := time.Now().AddDate(0, 0, req.ValidityDays)
        expiresAt = &exp
    }

    giftCard := &GiftCard{
        ID:             generateID("gc"),
        TenantID:       tenant.GetTenantID(ctx),
        Code:           code,
        Type:           req.Type,
        Status:         GiftCardStatusPending,
        InitialBalance: req.Amount,
        CurrentBalance: req.Amount,
        Currency:       req.Currency,
        PurchaserEmail: req.PurchaserEmail,
        PurchaserName:  req.PurchaserName,
        RecipientEmail: req.RecipientEmail,
        RecipientName:  req.RecipientName,
        Message:        req.Message,
        DesignID:       req.DesignID,
        DeliveryDate:   req.DeliveryDate,
        ExpiresAt:      expiresAt,
        OrderID:        req.OrderID,
        OrderItemID:    req.OrderItemID,
        CreatedAt:      time.Now(),
        UpdatedAt:      time.Now(),
    }

    if err := s.repo.Create(ctx, giftCard); err != nil {
        return nil, err
    }

    return giftCard, nil
}

// Activate activates a gift card after payment
func (s *GiftCardService) Activate(ctx context.Context, giftCardID string) error {
    gc, err := s.repo.GetByID(ctx, giftCardID)
    if err != nil {
        return err
    }

    if gc.Status != GiftCardStatusPending {
        return fmt.Errorf("gift card cannot be activated in status: %s", gc.Status)
    }

    gc.Status = GiftCardStatusActive
    gc.UpdatedAt = time.Now()

    if err := s.repo.Update(ctx, gc); err != nil {
        return err
    }

    // Schedule or send delivery
    if gc.Type == GiftCardTypeDigital {
        if gc.DeliveryDate != nil && gc.DeliveryDate.After(time.Now()) {
            // Schedule for later
            s.scheduleDelivery(ctx, gc)
        } else {
            // Send immediately
            s.deliverDigitalCard(ctx, gc)
        }
    }

    // Create initial transaction
    s.repo.CreateTransaction(ctx, &GiftCardTransaction{
        ID:           generateID("gct"),
        GiftCardID:   gc.ID,
        Type:         TransactionTypeCredit,
        Amount:       gc.InitialBalance,
        BalanceAfter: gc.CurrentBalance,
        Note:         "Gift card activated",
        CreatedAt:    time.Now(),
    })

    s.events.Publish(ctx, "giftcard.activated", map[string]any{
        "gift_card_id": gc.ID,
        "amount":       gc.InitialBalance.String(),
    })

    return nil
}

// CheckBalance returns the current balance
func (s *GiftCardService) CheckBalance(ctx context.Context, code string) (*GiftCard, error) {
    gc, err := s.repo.GetByCode(ctx, code)
    if err != nil {
        return nil, fmt.Errorf("gift card not found")
    }

    // Check if expired
    if gc.ExpiresAt != nil && time.Now().After(*gc.ExpiresAt) {
        gc.Status = GiftCardStatusExpired
        s.repo.Update(ctx, gc)
    }

    return gc, nil
}

// Redeem uses gift card balance
func (s *GiftCardService) Redeem(ctx context.Context, code string, amount decimal.Decimal, orderID string) (*RedemptionResult, error) {
    gc, err := s.repo.GetByCode(ctx, code)
    if err != nil {
        return nil, fmt.Errorf("gift card not found")
    }

    // Validate
    if gc.Status != GiftCardStatusActive {
        return nil, fmt.Errorf("gift card is not active")
    }

    if gc.ExpiresAt != nil && time.Now().After(*gc.ExpiresAt) {
        gc.Status = GiftCardStatusExpired
        s.repo.Update(ctx, gc)
        return nil, fmt.Errorf("gift card has expired")
    }

    if amount.GreaterThan(gc.CurrentBalance) {
        return nil, fmt.Errorf("insufficient balance")
    }

    // Deduct balance
    gc.CurrentBalance = gc.CurrentBalance.Sub(amount)
    now := time.Now()
    gc.LastUsedAt = &now
    gc.UpdatedAt = now

    // Check if fully redeemed
    if gc.CurrentBalance.IsZero() {
        gc.Status = GiftCardStatusRedeemed
    }

    if err := s.repo.Update(ctx, gc); err != nil {
        return nil, err
    }

    // Create transaction
    s.repo.CreateTransaction(ctx, &GiftCardTransaction{
        ID:           generateID("gct"),
        GiftCardID:   gc.ID,
        Type:         TransactionTypeDebit,
        Amount:       amount,
        BalanceAfter: gc.CurrentBalance,
        OrderID:      &orderID,
        Note:         fmt.Sprintf("Used for order %s", orderID),
        UserID:       stringPtr(auth.GetUserID(ctx)),
        CreatedAt:    time.Now(),
    })

    s.events.Publish(ctx, "giftcard.redeemed", map[string]any{
        "gift_card_id": gc.ID,
        "amount":       amount.String(),
        "order_id":     orderID,
    })

    return &RedemptionResult{
        AmountApplied:    amount,
        RemainingBalance: gc.CurrentBalance,
        FullyRedeemed:    gc.CurrentBalance.IsZero(),
    }, nil
}

// RefundToCard returns balance to a gift card
func (s *GiftCardService) RefundToCard(ctx context.Context, code string, amount decimal.Decimal, orderID string) error {
    gc, err := s.repo.GetByCode(ctx, code)
    if err != nil {
        return err
    }

    gc.CurrentBalance = gc.CurrentBalance.Add(amount)
    gc.UpdatedAt = time.Now()

    // Reactivate if was fully redeemed
    if gc.Status == GiftCardStatusRedeemed {
        gc.Status = GiftCardStatusActive
    }

    if err := s.repo.Update(ctx, gc); err != nil {
        return err
    }

    s.repo.CreateTransaction(ctx, &GiftCardTransaction{
        ID:           generateID("gct"),
        GiftCardID:   gc.ID,
        Type:         TransactionTypeRefund,
        Amount:       amount,
        BalanceAfter: gc.CurrentBalance,
        OrderID:      &orderID,
        Note:         fmt.Sprintf("Refund from order %s", orderID),
        CreatedAt:    time.Now(),
    })

    return nil
}

// GetTransactionHistory returns transaction history
func (s *GiftCardService) GetTransactionHistory(ctx context.Context, code string) ([]GiftCardTransaction, error) {
    gc, err := s.repo.GetByCode(ctx, code)
    if err != nil {
        return nil, err
    }

    return s.repo.GetTransactions(ctx, gc.ID)
}

func (s *GiftCardService) generateUniqueCode(ctx context.Context) (string, error) {
    for attempts := 0; attempts < 10; attempts++ {
        code := s.generateCode()
        exists, _ := s.repo.GetByCode(ctx, code)
        if exists == nil {
            return code, nil
        }
    }
    return "", fmt.Errorf("failed to generate unique code")
}

func (s *GiftCardService) generateCode() string {
    // Format: XXXX-XXXX-XXXX-XXXX
    bytes := make([]byte, 8)
    rand.Read(bytes)
    hex := hex.EncodeToString(bytes)
    return fmt.Sprintf("%s-%s-%s-%s",
        strings.ToUpper(hex[0:4]),
        strings.ToUpper(hex[4:8]),
        strings.ToUpper(hex[8:12]),
        strings.ToUpper(hex[12:16]),
    )
}

func (s *GiftCardService) deliverDigitalCard(ctx context.Context, gc *GiftCard) {
    err := s.email.SendGiftCard(ctx, &GiftCardEmail{
        To:            gc.RecipientEmail,
        RecipientName: gc.RecipientName,
        SenderName:    gc.PurchaserName,
        Amount:        gc.InitialBalance,
        Currency:      gc.Currency,
        Code:          gc.Code,
        Message:       gc.Message,
        ExpiresAt:     gc.ExpiresAt,
        DesignID:      gc.DesignID,
    })

    if err == nil {
        now := time.Now()
        gc.DeliveredAt = &now
        s.repo.Update(ctx, gc)
    }
}

func (s *GiftCardService) scheduleDelivery(ctx context.Context, gc *GiftCard) {
    // Schedule job for delivery date
    scheduler.Schedule(*gc.DeliveryDate, func() {
        s.deliverDigitalCard(context.Background(), gc)
    })
}

type RedemptionResult struct {
    AmountApplied    decimal.Decimal `json:"amount_applied"`
    RemainingBalance decimal.Decimal `json:"remaining_balance"`
    FullyRedeemed    bool            `json:"fully_redeemed"`
}
```

## Frontend Components

### Gift Card Purchase

```tsx
// components/giftcard/GiftCardPurchase.tsx
'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Gift, Mail, Calendar } from 'lucide-react';

interface GiftCardDesign {
  id: string;
  name: string;
  image_url: string;
  category: string;
}

const AMOUNTS = [500, 1000, 2000, 5000];

export function GiftCardPurchase({ productId }: { productId: string }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    amount: 1000,
    customAmount: '',
    designId: '',
    recipientName: '',
    recipientEmail: '',
    senderName: '',
    message: '',
    deliveryDate: '',
    sendNow: true,
  });

  const { data: designs } = useQuery<GiftCardDesign[]>({
    queryKey: ['gift-card-designs'],
    queryFn: () => fetch('/api/gift-cards/designs').then(r => r.json()),
  });

  const { data: product } = useQuery({
    queryKey: ['gift-card-product', productId],
    queryFn: () => fetch(`/api/gift-cards/products/${productId}`).then(r => r.json()),
  });

  const addToCart = useMutation({
    mutationFn: (data: any) =>
      fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          quantity: 1,
          gift_card_data: data,
        }),
      }).then(r => r.json()),
  });

  const handleSubmit = () => {
    addToCart.mutate({
      amount: formData.customAmount || formData.amount,
      design_id: formData.designId,
      recipient_name: formData.recipientName,
      recipient_email: formData.recipientEmail,
      sender_name: formData.senderName,
      message: formData.message,
      delivery_date: formData.sendNow ? null : formData.deliveryDate,
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}>
              {s}
            </div>
            {s < 3 && <div className={`w-16 h-1 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Amount & Design */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Choose Amount & Design</h2>

          {/* Amount Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Amount</label>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setFormData({ ...formData, amount: amt, customAmount: '' })}
                  className={`py-3 border rounded-lg font-medium ${
                    formData.amount === amt && !formData.customAmount
                      ? 'border-blue-600 bg-blue-50 text-blue-600'
                      : 'hover:border-gray-400'
                  }`}
                >
                  ₴{amt}
                </button>
              ))}
            </div>
            {product?.allow_custom_amount && (
              <div>
                <input
                  type="number"
                  placeholder={`Custom amount (₴${product.min_amount} - ₴${product.max_amount})`}
                  value={formData.customAmount}
                  onChange={(e) => setFormData({ ...formData, customAmount: e.target.value })}
                  className="w-full px-4 py-3 border rounded-lg"
                  min={product.min_amount}
                  max={product.max_amount}
                />
              </div>
            )}
          </div>

          {/* Design Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Design</label>
            <div className="grid grid-cols-3 gap-3">
              {designs?.map((design) => (
                <button
                  key={design.id}
                  onClick={() => setFormData({ ...formData, designId: design.id })}
                  className={`relative rounded-lg overflow-hidden border-2 ${
                    formData.designId === design.id ? 'border-blue-600' : 'border-transparent'
                  }`}
                >
                  <img src={design.image_url} alt={design.name} className="w-full aspect-[3/2] object-cover" />
                  {formData.designId === design.id && (
                    <div className="absolute inset-0 bg-blue-600/10 flex items-center justify-center">
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!formData.designId}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2: Recipient Details */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Recipient Details</h2>

          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Recipient's Name</label>
              <input
                type="text"
                value={formData.recipientName}
                onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                className="w-full px-4 py-3 border rounded-lg"
                placeholder="Who is this gift for?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Recipient's Email</label>
              <input
                type="email"
                value={formData.recipientEmail}
                onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
                className="w-full px-4 py-3 border rounded-lg"
                placeholder="recipient@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Your Name</label>
              <input
                type="text"
                value={formData.senderName}
                onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                className="w-full px-4 py-3 border rounded-lg"
                placeholder="From..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Personal Message (optional)</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-4 py-3 border rounded-lg"
                rows={3}
                placeholder="Add a personal message..."
                maxLength={200}
              />
              <p className="text-sm text-gray-500 mt-1">{formData.message.length}/200</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-3 border rounded-lg">
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!formData.recipientName || !formData.recipientEmail}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Delivery & Confirm */}
      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Delivery & Confirmation</h2>

          {/* Delivery Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer">
              <input
                type="radio"
                checked={formData.sendNow}
                onChange={() => setFormData({ ...formData, sendNow: true })}
                className="w-4 h-4 text-blue-600"
              />
              <Mail className="w-5 h-5 text-gray-600" />
              <span>Send immediately after purchase</span>
            </label>

            <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer">
              <input
                type="radio"
                checked={!formData.sendNow}
                onChange={() => setFormData({ ...formData, sendNow: false })}
                className="w-4 h-4 text-blue-600"
              />
              <Calendar className="w-5 h-5 text-gray-600" />
              <span>Schedule for a specific date</span>
            </label>

            {!formData.sendNow && (
              <input
                type="date"
                value={formData.deliveryDate}
                onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border rounded-lg"
              />
            )}
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium mb-3">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Gift Card Value:</span>
                <span className="font-medium">₴{formData.customAmount || formData.amount}</span>
              </div>
              <div className="flex justify-between">
                <span>To:</span>
                <span>{formData.recipientName} ({formData.recipientEmail})</span>
              </div>
              <div className="flex justify-between">
                <span>From:</span>
                <span>{formData.senderName}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery:</span>
                <span>{formData.sendNow ? 'Immediately' : formData.deliveryDate}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 py-3 border rounded-lg">
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={addToCart.isPending}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {addToCart.isPending ? 'Adding...' : 'Add to Cart'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Gift Card Balance Check

```tsx
// components/giftcard/GiftCardBalance.tsx
'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Gift, Clock, DollarSign } from 'lucide-react';

export function GiftCardBalance() {
  const [code, setCode] = useState('');

  const checkBalance = useMutation({
    mutationFn: (code: string) =>
      fetch(`/api/gift-cards/balance?code=${code}`).then(r => r.json()),
  });

  const formatCode = (value: string) => {
    // Auto-format as XXXX-XXXX-XXXX-XXXX
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const groups = cleaned.match(/.{1,4}/g) || [];
    return groups.join('-').slice(0, 19);
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Gift className="w-6 h-6" />
          Check Gift Card Balance
        </h2>

        <div className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(formatCode(e.target.value))}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            className="w-full px-4 py-3 border rounded-lg text-center text-lg font-mono tracking-wider"
            maxLength={19}
          />

          <button
            onClick={() => checkBalance.mutate(code)}
            disabled={code.length < 19 || checkBalance.isPending}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {checkBalance.isPending ? 'Checking...' : 'Check Balance'}
          </button>

          {checkBalance.isError && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg">
              Gift card not found or invalid code
            </div>
          )}

          {checkBalance.data && (
            <div className="p-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl text-white">
              <div className="text-center mb-4">
                <p className="text-sm opacity-80">Current Balance</p>
                <p className="text-4xl font-bold">
                  ₴{checkBalance.data.current_balance.toFixed(2)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="opacity-80">Original Value</p>
                  <p className="font-semibold">₴{checkBalance.data.initial_balance.toFixed(2)}</p>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="opacity-80">Status</p>
                  <p className="font-semibold capitalize">{checkBalance.data.status}</p>
                </div>
              </div>

              {checkBalance.data.expires_at && (
                <div className="mt-4 flex items-center gap-2 text-sm opacity-80">
                  <Clock className="w-4 h-4" />
                  Expires: {new Date(checkBalance.data.expires_at).toLocaleDateString()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

## API Endpoints

```go
// internal/giftcard/handlers.go

func (h *GiftCardHandler) RegisterRoutes(r *gin.RouterGroup) {
    gc := r.Group("/gift-cards")
    {
        gc.GET("/designs", h.ListDesigns)
        gc.GET("/products/:id", h.GetProduct)
        gc.GET("/balance", h.CheckBalance)
        gc.POST("/redeem", h.Redeem)
    }

    // Admin
    admin := r.Group("/admin/gift-cards")
    admin.Use(AdminMiddleware())
    {
        admin.GET("", h.AdminList)
        admin.GET("/:id", h.AdminGet)
        admin.POST("", h.AdminCreate)
        admin.POST("/:id/activate", h.AdminActivate)
        admin.POST("/:id/disable", h.AdminDisable)
        admin.GET("/:id/transactions", h.AdminGetTransactions)

        admin.GET("/designs", h.AdminListDesigns)
        admin.POST("/designs", h.AdminCreateDesign)
        admin.PUT("/designs/:id", h.AdminUpdateDesign)
        admin.DELETE("/designs/:id", h.AdminDeleteDesign)
    }
}
```

## Див. також

- [Orders](../modules/ORDERS.md)
- [Payments](../integrations/LIQPAY.md)
- [Email Templates](../guides/EMAIL_TEMPLATES.md)
