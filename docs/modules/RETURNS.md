# Returns Management

Управління поверненнями товарів.

## Огляд

| Параметр | Значення |
|----------|----------|
| Return Window | 14 днів |
| Refund Methods | Original payment, Store credit |
| Exchange | Supported |

### Типи повернень

- Повернення коштів (Refund)
- Обмін товару (Exchange)
- Store credit
- Гарантійне повернення

---

## Data Models

```go
// internal/returns/models.go
package returns

import "time"

type Return struct {
    ID              string         `json:"id" gorm:"primaryKey"`
    OrderID         string         `json:"order_id"`
    CustomerID      string         `json:"customer_id"`
    Status          ReturnStatus   `json:"status"`
    Type            ReturnType     `json:"type"`
    Reason          ReturnReason   `json:"reason"`
    ReasonDetails   string         `json:"reason_details"`
    Items           []ReturnItem   `json:"items" gorm:"foreignKey:ReturnID"`

    // Amounts
    SubtotalAmount  int64          `json:"subtotal_amount"`
    ShippingAmount  int64          `json:"shipping_amount"`
    TotalAmount     int64          `json:"total_amount"`
    RefundedAmount  int64          `json:"refunded_amount"`

    // Refund details
    RefundMethod    RefundMethod   `json:"refund_method"`
    RefundStatus    RefundStatus   `json:"refund_status"`

    // Shipping
    ReturnShipment  *ReturnShipment `json:"return_shipment" gorm:"foreignKey:ReturnID"`

    // Exchange (if applicable)
    ExchangeOrderID *string        `json:"exchange_order_id"`

    // Store credit
    StoreCreditID   *string        `json:"store_credit_id"`

    // Notes
    CustomerNotes   string         `json:"customer_notes"`
    AdminNotes      string         `json:"admin_notes"`

    // Timestamps
    RequestedAt     time.Time      `json:"requested_at"`
    ApprovedAt      *time.Time     `json:"approved_at"`
    ReceivedAt      *time.Time     `json:"received_at"`
    RefundedAt      *time.Time     `json:"refunded_at"`
    CompletedAt     *time.Time     `json:"completed_at"`
    CreatedAt       time.Time      `json:"created_at"`
    UpdatedAt       time.Time      `json:"updated_at"`
}

type ReturnStatus string

const (
    StatusRequested      ReturnStatus = "requested"
    StatusApproved       ReturnStatus = "approved"
    StatusRejected       ReturnStatus = "rejected"
    StatusShipped        ReturnStatus = "shipped"
    StatusReceived       ReturnStatus = "received"
    StatusInspecting     ReturnStatus = "inspecting"
    StatusRefunding      ReturnStatus = "refunding"
    StatusCompleted      ReturnStatus = "completed"
    StatusCancelled      ReturnStatus = "cancelled"
)

type ReturnType string

const (
    TypeRefund   ReturnType = "refund"
    TypeExchange ReturnType = "exchange"
    TypeCredit   ReturnType = "credit"
    TypeWarranty ReturnType = "warranty"
)

type ReturnReason string

const (
    ReasonDefective       ReturnReason = "defective"
    ReasonWrongItem       ReturnReason = "wrong_item"
    ReasonNotAsDescribed  ReturnReason = "not_as_described"
    ReasonDoesNotFit      ReturnReason = "does_not_fit"
    ReasonChangedMind     ReturnReason = "changed_mind"
    ReasonBetterPrice     ReturnReason = "better_price"
    ReasonOther           ReturnReason = "other"
)

type RefundMethod string

const (
    RefundOriginalPayment RefundMethod = "original_payment"
    RefundStoreCredit     RefundMethod = "store_credit"
    RefundBankTransfer    RefundMethod = "bank_transfer"
)

type RefundStatus string

const (
    RefundPending    RefundStatus = "pending"
    RefundProcessing RefundStatus = "processing"
    RefundCompleted  RefundStatus = "completed"
    RefundFailed     RefundStatus = "failed"
)

type ReturnItem struct {
    ID              string         `json:"id" gorm:"primaryKey"`
    ReturnID        string         `json:"return_id"`
    OrderItemID     string         `json:"order_item_id"`
    ProductID       string         `json:"product_id"`
    VariantID       *string        `json:"variant_id"`
    SKU             string         `json:"sku"`
    Name            string         `json:"name"`
    Quantity        int            `json:"quantity"`
    Price           int64          `json:"price"`
    Total           int64          `json:"total"`
    Reason          ReturnReason   `json:"reason"`
    Condition       ItemCondition  `json:"condition"`
    InspectionNotes string         `json:"inspection_notes"`
    RestockStatus   RestockStatus  `json:"restock_status"`
}

type ItemCondition string

const (
    ConditionNew       ItemCondition = "new"
    ConditionLikeNew   ItemCondition = "like_new"
    ConditionUsed      ItemCondition = "used"
    ConditionDamaged   ItemCondition = "damaged"
    ConditionDefective ItemCondition = "defective"
)

type RestockStatus string

const (
    RestockPending  RestockStatus = "pending"
    RestockYes      RestockStatus = "yes"
    RestockNo       RestockStatus = "no"
    RestockDamaged  RestockStatus = "damaged"
)

type ReturnShipment struct {
    ID              string    `json:"id" gorm:"primaryKey"`
    ReturnID        string    `json:"return_id"`
    Carrier         string    `json:"carrier"`
    TrackingNumber  string    `json:"tracking_number"`
    LabelURL        string    `json:"label_url"`
    Status          string    `json:"status"`
    ShippedAt       *time.Time `json:"shipped_at"`
    DeliveredAt     *time.Time `json:"delivered_at"`
}

type ReturnPolicy struct {
    ID               string   `json:"id" gorm:"primaryKey"`
    Name             string   `json:"name"`
    ReturnWindowDays int      `json:"return_window_days"`
    AllowedReasons   []string `json:"allowed_reasons" gorm:"serializer:json"`
    RequireReceipt   bool     `json:"require_receipt"`
    FreeReturn       bool     `json:"free_return"`
    RestockingFee    float64  `json:"restocking_fee"` // percentage
    ExchangeOnly     bool     `json:"exchange_only"`
    CategoryIDs      []string `json:"category_ids" gorm:"serializer:json"`
}
```

---

## Return Service

```go
// internal/returns/service.go
package returns

import (
    "context"
    "time"
)

type Service struct {
    repo            Repository
    orderService    OrderService
    paymentService  PaymentService
    inventoryService InventoryService
    notificationService NotificationService
    shippingService ShippingService
}

// CreateReturn створює запит на повернення
func (s *Service) CreateReturn(ctx context.Context, input *CreateReturnInput) (*Return, error) {
    // Get order
    order, err := s.orderService.GetOrder(ctx, input.OrderID)
    if err != nil {
        return nil, err
    }

    // Validate return eligibility
    if err := s.validateReturnEligibility(ctx, order, input); err != nil {
        return nil, err
    }

    // Create return
    ret := &Return{
        ID:            generateID("ret"),
        OrderID:       input.OrderID,
        CustomerID:    order.CustomerID,
        Status:        StatusRequested,
        Type:          input.Type,
        Reason:        input.Reason,
        ReasonDetails: input.ReasonDetails,
        RefundMethod:  input.RefundMethod,
        RefundStatus:  RefundPending,
        CustomerNotes: input.Notes,
        RequestedAt:   time.Now(),
        CreatedAt:     time.Now(),
        UpdatedAt:     time.Now(),
    }

    // Add items
    var total int64
    for _, itemInput := range input.Items {
        orderItem := findOrderItem(order.Items, itemInput.OrderItemID)
        if orderItem == nil {
            continue
        }

        item := ReturnItem{
            ID:          generateID("rti"),
            ReturnID:    ret.ID,
            OrderItemID: itemInput.OrderItemID,
            ProductID:   orderItem.ProductID,
            VariantID:   orderItem.VariantID,
            SKU:         orderItem.SKU,
            Name:        orderItem.Name,
            Quantity:    itemInput.Quantity,
            Price:       orderItem.Price,
            Total:       orderItem.Price * int64(itemInput.Quantity),
            Reason:      itemInput.Reason,
        }
        ret.Items = append(ret.Items, item)
        total += item.Total
    }

    ret.SubtotalAmount = total
    ret.TotalAmount = total

    if err := s.repo.Create(ctx, ret); err != nil {
        return nil, err
    }

    // Send notification
    s.notificationService.SendReturnRequestedEmail(ctx, ret)

    return ret, nil
}

// ApproveReturn схвалює повернення
func (s *Service) ApproveReturn(ctx context.Context, returnID string, adminNotes string) error {
    ret, err := s.repo.FindByID(ctx, returnID)
    if err != nil {
        return err
    }

    if ret.Status != StatusRequested {
        return ErrInvalidStatusTransition
    }

    now := time.Now()
    ret.Status = StatusApproved
    ret.ApprovedAt = &now
    ret.AdminNotes = adminNotes
    ret.UpdatedAt = now

    // Generate return label
    shipment, err := s.shippingService.CreateReturnLabel(ctx, ret)
    if err != nil {
        return err
    }
    ret.ReturnShipment = shipment

    if err := s.repo.Update(ctx, ret); err != nil {
        return err
    }

    // Send approval email with return label
    s.notificationService.SendReturnApprovedEmail(ctx, ret)

    return nil
}

// RejectReturn відхиляє повернення
func (s *Service) RejectReturn(ctx context.Context, returnID string, reason string) error {
    ret, err := s.repo.FindByID(ctx, returnID)
    if err != nil {
        return err
    }

    ret.Status = StatusRejected
    ret.AdminNotes = reason
    ret.UpdatedAt = time.Now()

    if err := s.repo.Update(ctx, ret); err != nil {
        return err
    }

    // Send rejection email
    s.notificationService.SendReturnRejectedEmail(ctx, ret, reason)

    return nil
}

// ReceiveReturn позначає отримання повернення
func (s *Service) ReceiveReturn(ctx context.Context, returnID string) error {
    ret, err := s.repo.FindByID(ctx, returnID)
    if err != nil {
        return err
    }

    now := time.Now()
    ret.Status = StatusReceived
    ret.ReceivedAt = &now
    ret.UpdatedAt = now

    return s.repo.Update(ctx, ret)
}

// InspectItems перевіряє стан товарів
func (s *Service) InspectItems(ctx context.Context, returnID string, inspections []ItemInspection) error {
    ret, err := s.repo.FindByID(ctx, returnID)
    if err != nil {
        return err
    }

    for _, insp := range inspections {
        for i, item := range ret.Items {
            if item.ID == insp.ItemID {
                ret.Items[i].Condition = insp.Condition
                ret.Items[i].InspectionNotes = insp.Notes
                ret.Items[i].RestockStatus = insp.RestockStatus
            }
        }
    }

    ret.Status = StatusInspecting
    ret.UpdatedAt = time.Now()

    return s.repo.Update(ctx, ret)
}

// ProcessRefund обробляє повернення коштів
func (s *Service) ProcessRefund(ctx context.Context, returnID string) error {
    ret, err := s.repo.FindByID(ctx, returnID)
    if err != nil {
        return err
    }

    ret.Status = StatusRefunding
    ret.RefundStatus = RefundProcessing

    // Calculate refund amount (may differ if restocking fee)
    refundAmount := s.calculateRefundAmount(ret)

    // Process refund based on method
    switch ret.RefundMethod {
    case RefundOriginalPayment:
        if err := s.paymentService.Refund(ctx, ret.OrderID, refundAmount); err != nil {
            ret.RefundStatus = RefundFailed
            s.repo.Update(ctx, ret)
            return err
        }
    case RefundStoreCredit:
        credit, err := s.createStoreCredit(ctx, ret.CustomerID, refundAmount)
        if err != nil {
            ret.RefundStatus = RefundFailed
            s.repo.Update(ctx, ret)
            return err
        }
        ret.StoreCreditID = &credit.ID
    }

    now := time.Now()
    ret.RefundedAmount = refundAmount
    ret.RefundStatus = RefundCompleted
    ret.RefundedAt = &now
    ret.Status = StatusCompleted
    ret.CompletedAt = &now
    ret.UpdatedAt = now

    // Restock items
    for _, item := range ret.Items {
        if item.RestockStatus == RestockYes {
            s.inventoryService.AddStock(ctx, item.ProductID, item.VariantID, item.Quantity)
        }
    }

    if err := s.repo.Update(ctx, ret); err != nil {
        return err
    }

    // Send completion email
    s.notificationService.SendReturnCompletedEmail(ctx, ret)

    return nil
}

func (s *Service) calculateRefundAmount(ret *Return) int64 {
    refund := ret.TotalAmount

    // Apply restocking fee if applicable
    policy, _ := s.getPolicyForReturn(ret)
    if policy != nil && policy.RestockingFee > 0 {
        fee := int64(float64(refund) * policy.RestockingFee / 100)
        refund -= fee
    }

    // Reduce for damaged items
    for _, item := range ret.Items {
        if item.Condition == ConditionDamaged {
            refund -= item.Total / 2 // 50% deduction for damaged items
        }
    }

    return refund
}

func (s *Service) validateReturnEligibility(ctx context.Context, order *Order, input *CreateReturnInput) error {
    // Check return window
    policy, err := s.getPolicyForOrder(ctx, order)
    if err != nil {
        return err
    }

    daysSinceOrder := int(time.Since(order.DeliveredAt).Hours() / 24)
    if daysSinceOrder > policy.ReturnWindowDays {
        return ErrReturnWindowExpired
    }

    // Check if items are returnable
    for _, item := range input.Items {
        orderItem := findOrderItem(order.Items, item.OrderItemID)
        if orderItem == nil {
            return ErrItemNotFound
        }

        // Check quantity
        alreadyReturned := s.repo.GetReturnedQuantity(ctx, item.OrderItemID)
        if item.Quantity > orderItem.Quantity-alreadyReturned {
            return ErrExceedsReturnableQuantity
        }
    }

    return nil
}
```

---

## API Endpoints

### Create Return Request

```http
POST /api/v1/returns
Authorization: Bearer <token>
Content-Type: application/json

{
    "order_id": "ord_123",
    "type": "refund",
    "reason": "defective",
    "reason_details": "Екран має дефекти",
    "refund_method": "original_payment",
    "items": [
        {
            "order_item_id": "oi_456",
            "quantity": 1,
            "reason": "defective"
        }
    ],
    "notes": "Товар прийшов з подряпинами на екрані"
}
```

### Get Return Status

```http
GET /api/v1/returns/{id}
```

**Response:**

```json
{
    "id": "ret_789",
    "order_id": "ord_123",
    "status": "approved",
    "type": "refund",
    "items": [...],
    "total_amount": 4999900,
    "refund_method": "original_payment",
    "return_shipment": {
        "carrier": "nova_poshta",
        "tracking_number": "20450000000000",
        "label_url": "https://..."
    }
}
```

### Admin: Approve/Reject

```http
POST /api/admin/returns/{id}/approve
POST /api/admin/returns/{id}/reject
```

---

## Customer Portal

```tsx
// components/returns/ReturnRequestForm.tsx
export function ReturnRequestForm({ orderId }: { orderId: string }) {
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [reason, setReason] = useState<ReturnReason>('');
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('original_payment');

  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrder(orderId),
  });

  const createReturnMutation = useMutation({
    mutationFn: (data: CreateReturnInput) =>
      fetch('/api/v1/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      router.push('/account/returns');
    },
  });

  const handleSubmit = () => {
    createReturnMutation.mutate({
      order_id: orderId,
      type: 'refund',
      reason,
      refund_method: refundMethod,
      items: selectedItems,
    });
  };

  return (
    <form className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Виберіть товари для повернення</CardTitle>
        </CardHeader>
        <CardContent>
          {order?.items.map((item) => (
            <ReturnItemSelector
              key={item.id}
              item={item}
              selected={selectedItems.find(s => s.order_item_id === item.id)}
              onSelect={(quantity, itemReason) => {
                setSelectedItems(prev => [
                  ...prev.filter(s => s.order_item_id !== item.id),
                  { order_item_id: item.id, quantity, reason: itemReason },
                ]);
              }}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Причина повернення</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={reason} onValueChange={setReason}>
            <SelectItem value="defective">Товар несправний</SelectItem>
            <SelectItem value="wrong_item">Надіслано не той товар</SelectItem>
            <SelectItem value="not_as_described">Не відповідає опису</SelectItem>
            <SelectItem value="does_not_fit">Не підходить розмір</SelectItem>
            <SelectItem value="changed_mind">Передумав(ла)</SelectItem>
          </Select>

          <Textarea
            label="Додаткові коментарі"
            placeholder="Опишіть проблему детальніше..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Спосіб повернення коштів</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={refundMethod} onValueChange={setRefundMethod}>
            <RadioGroupItem value="original_payment">
              На картку, з якої була оплата
            </RadioGroupItem>
            <RadioGroupItem value="store_credit">
              На баланс магазину (бонуси)
            </RadioGroupItem>
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={selectedItems.length === 0}>
          Створити запит на повернення
        </Button>
      </div>
    </form>
  );
}
```

---

## Return Tracking

```tsx
// components/returns/ReturnTracking.tsx
export function ReturnTracking({ returnId }: { returnId: string }) {
  const { data: returnData } = useQuery({
    queryKey: ['return', returnId],
    queryFn: () => fetchReturn(returnId),
  });

  const steps = [
    { status: 'requested', label: 'Запит створено', date: returnData?.requested_at },
    { status: 'approved', label: 'Схвалено', date: returnData?.approved_at },
    { status: 'shipped', label: 'Відправлено', date: returnData?.return_shipment?.shipped_at },
    { status: 'received', label: 'Отримано', date: returnData?.received_at },
    { status: 'completed', label: 'Завершено', date: returnData?.completed_at },
  ];

  const currentStepIndex = steps.findIndex(s => s.status === returnData?.status);

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex justify-between">
        {steps.map((step, index) => (
          <div key={step.status} className="flex flex-col items-center">
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center
              ${index <= currentStepIndex ? 'bg-primary text-white' : 'bg-gray-200'}
            `}>
              {index <= currentStepIndex ? <CheckIcon /> : index + 1}
            </div>
            <span className="text-sm mt-2">{step.label}</span>
            {step.date && (
              <span className="text-xs text-gray-500">{formatDate(step.date)}</span>
            )}
          </div>
        ))}
      </div>

      {/* Return Label */}
      {returnData?.return_shipment && returnData.status === 'approved' && (
        <Card>
          <CardHeader>
            <CardTitle>Етикетка для повернення</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Роздрукуйте етикетку та прикріпіть до посилки:</p>
            <a
              href={returnData.return_shipment.label_url}
              target="_blank"
              className="btn btn-primary mt-2"
            >
              Завантажити етикетку
            </a>

            {returnData.return_shipment.tracking_number && (
              <div className="mt-4">
                <span className="text-gray-600">Номер відстеження:</span>
                <span className="font-mono ml-2">
                  {returnData.return_shipment.tracking_number}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Refund Info */}
      {returnData?.status === 'completed' && (
        <Card>
          <CardHeader>
            <CardTitle>Повернення коштів</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between">
              <span>Сума повернення:</span>
              <span className="font-bold">{formatPrice(returnData.refunded_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Спосіб:</span>
              <span>{getRefundMethodLabel(returnData.refund_method)}</span>
            </div>
            <div className="flex justify-between">
              <span>Дата:</span>
              <span>{formatDate(returnData.refunded_at)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```
