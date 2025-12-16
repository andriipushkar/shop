# Wishlist

Функціонал списків бажань для збереження товарів та створення колекцій.

## Можливості

- Множинні списки бажань (My Wishlist, Birthday, Wedding Registry)
- Публічні та приватні списки
- Поділитися списком з друзями
- Сповіщення про зниження ціни
- Сповіщення про наявність
- Швидке додавання до кошика

## Моделі даних

```go
// internal/wishlist/models.go
package wishlist

import (
    "time"
)

type WishlistVisibility string

const (
    VisibilityPrivate WishlistVisibility = "private"
    VisibilityPublic  WishlistVisibility = "public"
    VisibilityShared  WishlistVisibility = "shared" // Only with link
)

type Wishlist struct {
    ID          string             `json:"id" gorm:"primaryKey"`
    TenantID    string             `json:"tenant_id" gorm:"index"`
    UserID      string             `json:"user_id" gorm:"index"`

    Name        string             `json:"name"`
    Description string             `json:"description"`
    Visibility  WishlistVisibility `json:"visibility"`
    ShareToken  string             `json:"share_token" gorm:"uniqueIndex"`

    // Type
    Type        string             `json:"type"` // default, birthday, wedding, baby_shower, etc.
    EventDate   *time.Time         `json:"event_date"`

    // Settings
    IsDefault   bool               `json:"is_default"`
    NotifyOnPriceDrop bool         `json:"notify_on_price_drop"`
    NotifyOnBackInStock bool       `json:"notify_on_back_in_stock"`

    // Stats
    ItemCount   int                `json:"item_count"`

    CreatedAt   time.Time          `json:"created_at"`
    UpdatedAt   time.Time          `json:"updated_at"`
}

type WishlistItem struct {
    ID          string          `json:"id" gorm:"primaryKey"`
    WishlistID  string          `json:"wishlist_id" gorm:"index"`
    ProductID   string          `json:"product_id" gorm:"index"`
    VariantID   *string         `json:"variant_id"`

    // User preferences
    Quantity    int             `json:"quantity"`
    Priority    int             `json:"priority"` // 1-5
    Note        string          `json:"note"`

    // Price tracking
    AddedPrice  decimal.Decimal `json:"added_price"` // Price when added
    LowestPrice decimal.Decimal `json:"lowest_price"` // Lowest seen price

    // Status
    IsPurchased bool            `json:"is_purchased"`
    PurchasedBy *string         `json:"purchased_by"` // For shared lists
    PurchasedAt *time.Time      `json:"purchased_at"`

    AddedAt     time.Time       `json:"added_at"`
    UpdatedAt   time.Time       `json:"updated_at"`
}

type WishlistShare struct {
    ID          string    `json:"id" gorm:"primaryKey"`
    WishlistID  string    `json:"wishlist_id" gorm:"index"`
    SharedWith  string    `json:"shared_with"` // email or user_id
    Permission  string    `json:"permission"`  // view, purchase

    SharedAt    time.Time `json:"shared_at"`
    AccessedAt  *time.Time `json:"accessed_at"`
}

type PriceAlert struct {
    ID          string          `json:"id" gorm:"primaryKey"`
    TenantID    string          `json:"tenant_id" gorm:"index"`
    UserID      string          `json:"user_id" gorm:"index"`
    ProductID   string          `json:"product_id" gorm:"index"`
    VariantID   *string         `json:"variant_id"`

    Type        AlertType       `json:"type"` // price_drop, back_in_stock, price_target
    TargetPrice *decimal.Decimal `json:"target_price"` // For price_target type

    // Status
    IsTriggered bool            `json:"is_triggered"`
    TriggeredAt *time.Time      `json:"triggered_at"`

    CreatedAt   time.Time       `json:"created_at"`
}

type AlertType string

const (
    AlertTypePriceDrop   AlertType = "price_drop"
    AlertTypeBackInStock AlertType = "back_in_stock"
    AlertTypePriceTarget AlertType = "price_target"
)
```

## Service

```go
// internal/wishlist/service.go
package wishlist

import (
    "context"
    "crypto/rand"
    "encoding/hex"
    "fmt"
    "time"
)

type WishlistService struct {
    repo     WishlistRepository
    products ProductService
    alerts   *AlertService
    events   EventPublisher
}

// CreateWishlist creates a new wishlist
func (s *WishlistService) CreateWishlist(ctx context.Context, req *CreateWishlistRequest) (*Wishlist, error) {
    userID := auth.GetUserID(ctx)

    wishlist := &Wishlist{
        ID:                 generateID("wl"),
        TenantID:           tenant.GetTenantID(ctx),
        UserID:             userID,
        Name:               req.Name,
        Description:        req.Description,
        Visibility:         req.Visibility,
        ShareToken:         s.generateShareToken(),
        Type:               req.Type,
        EventDate:          req.EventDate,
        NotifyOnPriceDrop:  req.NotifyOnPriceDrop,
        NotifyOnBackInStock: req.NotifyOnBackInStock,
        CreatedAt:          time.Now(),
        UpdatedAt:          time.Now(),
    }

    // Check if this should be default (first wishlist)
    count, _ := s.repo.CountByUser(ctx, userID)
    if count == 0 {
        wishlist.IsDefault = true
    }

    if err := s.repo.Create(ctx, wishlist); err != nil {
        return nil, err
    }

    return wishlist, nil
}

// AddItem adds a product to a wishlist
func (s *WishlistService) AddItem(ctx context.Context, wishlistID string, req *AddItemRequest) (*WishlistItem, error) {
    wishlist, err := s.repo.GetByID(ctx, wishlistID)
    if err != nil {
        return nil, err
    }

    // Verify ownership
    if wishlist.UserID != auth.GetUserID(ctx) {
        return nil, fmt.Errorf("access denied")
    }

    // Check if already in wishlist
    existing, _ := s.repo.GetItem(ctx, wishlistID, req.ProductID, req.VariantID)
    if existing != nil {
        return existing, nil // Already added
    }

    // Get current price
    product, err := s.products.GetByID(ctx, req.ProductID)
    if err != nil {
        return nil, err
    }

    price := product.Price
    if req.VariantID != nil {
        variant, _ := s.products.GetVariant(ctx, req.ProductID, *req.VariantID)
        if variant != nil {
            price = variant.Price
        }
    }

    item := &WishlistItem{
        ID:          generateID("wli"),
        WishlistID:  wishlistID,
        ProductID:   req.ProductID,
        VariantID:   req.VariantID,
        Quantity:    req.Quantity,
        Priority:    req.Priority,
        Note:        req.Note,
        AddedPrice:  price,
        LowestPrice: price,
        AddedAt:     time.Now(),
        UpdatedAt:   time.Now(),
    }

    if err := s.repo.CreateItem(ctx, item); err != nil {
        return nil, err
    }

    // Update wishlist item count
    s.repo.IncrementItemCount(ctx, wishlistID, 1)

    // Create price alert if enabled
    if wishlist.NotifyOnPriceDrop {
        s.alerts.Create(ctx, &PriceAlert{
            ID:        generateID("alert"),
            TenantID:  wishlist.TenantID,
            UserID:    wishlist.UserID,
            ProductID: req.ProductID,
            VariantID: req.VariantID,
            Type:      AlertTypePriceDrop,
            CreatedAt: time.Now(),
        })
    }

    s.events.Publish(ctx, "wishlist.item_added", map[string]any{
        "wishlist_id": wishlistID,
        "product_id":  req.ProductID,
        "user_id":     wishlist.UserID,
    })

    return item, nil
}

// RemoveItem removes a product from a wishlist
func (s *WishlistService) RemoveItem(ctx context.Context, wishlistID, itemID string) error {
    wishlist, err := s.repo.GetByID(ctx, wishlistID)
    if err != nil {
        return err
    }

    if wishlist.UserID != auth.GetUserID(ctx) {
        return fmt.Errorf("access denied")
    }

    if err := s.repo.DeleteItem(ctx, itemID); err != nil {
        return err
    }

    s.repo.IncrementItemCount(ctx, wishlistID, -1)

    return nil
}

// GetItems returns items in a wishlist with product details
func (s *WishlistService) GetItems(ctx context.Context, wishlistID string) ([]WishlistItemWithProduct, error) {
    items, err := s.repo.GetItems(ctx, wishlistID)
    if err != nil {
        return nil, err
    }

    result := make([]WishlistItemWithProduct, 0, len(items))
    for _, item := range items {
        product, _ := s.products.GetByID(ctx, item.ProductID)
        if product == nil {
            continue
        }

        var variant *ProductVariant
        if item.VariantID != nil {
            variant, _ = s.products.GetVariant(ctx, item.ProductID, *item.VariantID)
        }

        currentPrice := product.Price
        if variant != nil {
            currentPrice = variant.Price
        }

        result = append(result, WishlistItemWithProduct{
            Item:         item,
            Product:      product,
            Variant:      variant,
            CurrentPrice: currentPrice,
            PriceChanged: !currentPrice.Equal(item.AddedPrice),
            PriceDrop:    currentPrice.LessThan(item.AddedPrice),
            InStock:      product.Inventory.Available > 0,
        })
    }

    return result, nil
}

// ToggleItem adds or removes item from default wishlist
func (s *WishlistService) ToggleItem(ctx context.Context, productID string, variantID *string) (bool, error) {
    userID := auth.GetUserID(ctx)

    // Get or create default wishlist
    wishlist, err := s.repo.GetDefaultByUser(ctx, userID)
    if err != nil {
        // Create default wishlist
        wishlist, err = s.CreateWishlist(ctx, &CreateWishlistRequest{
            Name:       "My Wishlist",
            Visibility: VisibilityPrivate,
            Type:       "default",
        })
        if err != nil {
            return false, err
        }
    }

    // Check if item exists
    existing, _ := s.repo.GetItem(ctx, wishlist.ID, productID, variantID)
    if existing != nil {
        // Remove
        s.RemoveItem(ctx, wishlist.ID, existing.ID)
        return false, nil
    }

    // Add
    _, err = s.AddItem(ctx, wishlist.ID, &AddItemRequest{
        ProductID: productID,
        VariantID: variantID,
        Quantity:  1,
        Priority:  3,
    })

    return err == nil, err
}

// IsInWishlist checks if product is in user's wishlist
func (s *WishlistService) IsInWishlist(ctx context.Context, productID string, variantID *string) (bool, error) {
    userID := auth.GetUserID(ctx)
    return s.repo.IsInUserWishlists(ctx, userID, productID, variantID)
}

// GetByShareToken returns a wishlist by share token
func (s *WishlistService) GetByShareToken(ctx context.Context, token string) (*Wishlist, error) {
    wishlist, err := s.repo.GetByShareToken(ctx, token)
    if err != nil {
        return nil, err
    }

    if wishlist.Visibility == VisibilityPrivate {
        return nil, fmt.Errorf("wishlist is private")
    }

    return wishlist, nil
}

// MarkAsPurchased marks an item as purchased (for shared lists)
func (s *WishlistService) MarkAsPurchased(ctx context.Context, wishlistID, itemID string, purchaserName string) error {
    item, err := s.repo.GetItemByID(ctx, itemID)
    if err != nil {
        return err
    }

    if item.WishlistID != wishlistID {
        return fmt.Errorf("item not in wishlist")
    }

    now := time.Now()
    item.IsPurchased = true
    item.PurchasedBy = &purchaserName
    item.PurchasedAt = &now
    item.UpdatedAt = now

    return s.repo.UpdateItem(ctx, item)
}

// ShareWishlist shares a wishlist with someone
func (s *WishlistService) ShareWishlist(ctx context.Context, wishlistID string, email string, permission string) error {
    wishlist, err := s.repo.GetByID(ctx, wishlistID)
    if err != nil {
        return err
    }

    if wishlist.UserID != auth.GetUserID(ctx) {
        return fmt.Errorf("access denied")
    }

    share := &WishlistShare{
        ID:         generateID("wls"),
        WishlistID: wishlistID,
        SharedWith: email,
        Permission: permission,
        SharedAt:   time.Now(),
    }

    if err := s.repo.CreateShare(ctx, share); err != nil {
        return err
    }

    // Send notification email
    s.sendShareNotification(ctx, wishlist, email)

    return nil
}

// MoveToCart moves wishlist items to cart
func (s *WishlistService) MoveToCart(ctx context.Context, wishlistID string, itemIDs []string) error {
    wishlist, err := s.repo.GetByID(ctx, wishlistID)
    if err != nil {
        return err
    }

    if wishlist.UserID != auth.GetUserID(ctx) {
        return fmt.Errorf("access denied")
    }

    for _, itemID := range itemIDs {
        item, err := s.repo.GetItemByID(ctx, itemID)
        if err != nil || item.WishlistID != wishlistID {
            continue
        }

        // Add to cart
        s.cart.AddItem(ctx, &cart.AddItemRequest{
            ProductID: item.ProductID,
            VariantID: item.VariantID,
            Quantity:  item.Quantity,
        })
    }

    return nil
}

func (s *WishlistService) generateShareToken() string {
    bytes := make([]byte, 16)
    rand.Read(bytes)
    return hex.EncodeToString(bytes)
}

type WishlistItemWithProduct struct {
    Item         *WishlistItem    `json:"item"`
    Product      *Product         `json:"product"`
    Variant      *ProductVariant  `json:"variant,omitempty"`
    CurrentPrice decimal.Decimal  `json:"current_price"`
    PriceChanged bool             `json:"price_changed"`
    PriceDrop    bool             `json:"price_drop"`
    InStock      bool             `json:"in_stock"`
}

type CreateWishlistRequest struct {
    Name               string             `json:"name"`
    Description        string             `json:"description"`
    Visibility         WishlistVisibility `json:"visibility"`
    Type               string             `json:"type"`
    EventDate          *time.Time         `json:"event_date"`
    NotifyOnPriceDrop  bool               `json:"notify_on_price_drop"`
    NotifyOnBackInStock bool              `json:"notify_on_back_in_stock"`
}

type AddItemRequest struct {
    ProductID string  `json:"product_id"`
    VariantID *string `json:"variant_id"`
    Quantity  int     `json:"quantity"`
    Priority  int     `json:"priority"`
    Note      string  `json:"note"`
}
```

## Alert Service

```go
// internal/wishlist/alert_service.go
package wishlist

import (
    "context"
    "time"
)

type AlertService struct {
    repo          AlertRepository
    notifications NotificationService
}

// CheckPriceDrops checks for price drops and sends alerts
func (s *AlertService) CheckPriceDrops(ctx context.Context) error {
    alerts, err := s.repo.GetPendingPriceDropAlerts(ctx)
    if err != nil {
        return err
    }

    for _, alert := range alerts {
        // Get current price
        currentPrice, err := s.getCurrentPrice(ctx, alert.ProductID, alert.VariantID)
        if err != nil {
            continue
        }

        // Get wishlist item to check added price
        item, err := s.repo.GetWishlistItem(ctx, alert.UserID, alert.ProductID, alert.VariantID)
        if err != nil || item == nil {
            continue
        }

        // Check if price dropped
        if currentPrice.LessThan(item.AddedPrice) {
            s.triggerAlert(ctx, alert, currentPrice, item.AddedPrice)

            // Update lowest price
            if currentPrice.LessThan(item.LowestPrice) {
                item.LowestPrice = currentPrice
                s.repo.UpdateWishlistItem(ctx, item)
            }
        }
    }

    return nil
}

// CheckBackInStock checks for back-in-stock items
func (s *AlertService) CheckBackInStock(ctx context.Context) error {
    alerts, err := s.repo.GetPendingBackInStockAlerts(ctx)
    if err != nil {
        return err
    }

    for _, alert := range alerts {
        // Check if product is in stock
        inStock, err := s.checkStock(ctx, alert.ProductID, alert.VariantID)
        if err != nil {
            continue
        }

        if inStock {
            s.triggerBackInStockAlert(ctx, alert)
        }
    }

    return nil
}

func (s *AlertService) triggerAlert(ctx context.Context, alert *PriceAlert, currentPrice, originalPrice decimal.Decimal) {
    now := time.Now()
    alert.IsTriggered = true
    alert.TriggeredAt = &now
    s.repo.Update(ctx, alert)

    // Get product details
    product, _ := s.getProduct(ctx, alert.ProductID)

    // Send notification
    s.notifications.Send(ctx, &Notification{
        UserID:   alert.UserID,
        Type:     "price_drop",
        Title:    fmt.Sprintf("Price Drop Alert: %s", product.Name),
        Body:     fmt.Sprintf("The price dropped from %s to %s!", originalPrice.String(), currentPrice.String()),
        Data: map[string]any{
            "product_id":     alert.ProductID,
            "original_price": originalPrice.String(),
            "current_price":  currentPrice.String(),
        },
        ActionURL: fmt.Sprintf("/products/%s", product.Slug),
    })
}

func (s *AlertService) triggerBackInStockAlert(ctx context.Context, alert *PriceAlert) {
    now := time.Now()
    alert.IsTriggered = true
    alert.TriggeredAt = &now
    s.repo.Update(ctx, alert)

    product, _ := s.getProduct(ctx, alert.ProductID)

    s.notifications.Send(ctx, &Notification{
        UserID:    alert.UserID,
        Type:      "back_in_stock",
        Title:     fmt.Sprintf("Back in Stock: %s", product.Name),
        Body:      "An item from your wishlist is back in stock!",
        ActionURL: fmt.Sprintf("/products/%s", product.Slug),
    })
}
```

## Frontend Components

### Wishlist Button

```tsx
// components/wishlist/WishlistButton.tsx
'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface WishlistButtonProps {
  productId: string;
  variantId?: string;
  className?: string;
}

export function WishlistButton({ productId, variantId, className }: WishlistButtonProps) {
  const queryClient = useQueryClient();

  const { data: isInWishlist } = useQuery({
    queryKey: ['wishlist-status', productId, variantId],
    queryFn: () =>
      fetch(`/api/wishlist/check?product_id=${productId}${variantId ? `&variant_id=${variantId}` : ''}`)
        .then(r => r.json())
        .then(d => d.in_wishlist),
  });

  const toggle = useMutation({
    mutationFn: () =>
      fetch('/api/wishlist/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, variant_id: variantId }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.setQueryData(['wishlist-status', productId, variantId], data.added);
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });

  return (
    <button
      onClick={() => toggle.mutate()}
      disabled={toggle.isPending}
      className={`p-2 rounded-full transition-colors ${
        isInWishlist
          ? 'bg-red-50 text-red-500 hover:bg-red-100'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      } ${className}`}
      title={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      <Heart
        className={`w-5 h-5 ${isInWishlist ? 'fill-current' : ''}`}
      />
    </button>
  );
}
```

### Wishlist Page

```tsx
// components/wishlist/WishlistPage.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, Share2, ShoppingCart, Trash2, ArrowDown, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export function WishlistPage() {
  const queryClient = useQueryClient();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const { data: wishlists } = useQuery({
    queryKey: ['wishlists'],
    queryFn: () => fetch('/api/wishlist').then(r => r.json()),
  });

  const [activeWishlist, setActiveWishlist] = useState<string | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ['wishlist-items', activeWishlist],
    queryFn: () =>
      fetch(`/api/wishlist/${activeWishlist}/items`).then(r => r.json()),
    enabled: !!activeWishlist,
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) =>
      fetch(`/api/wishlist/${activeWishlist}/items/${itemId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-items', activeWishlist] });
    },
  });

  const moveToCart = useMutation({
    mutationFn: (itemIds: string[]) =>
      fetch(`/api/wishlist/${activeWishlist}/move-to-cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: itemIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      setSelectedItems([]);
    },
  });

  // Set default wishlist
  if (!activeWishlist && wishlists?.length > 0) {
    setActiveWishlist(wishlists.find((w: any) => w.is_default)?.id || wishlists[0].id);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <Heart className="w-8 h-8 text-red-500 fill-current" />
        My Wishlists
      </h1>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Wishlist Selector */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border p-4">
            <h2 className="font-medium mb-3">My Lists</h2>
            <div className="space-y-2">
              {wishlists?.map((wishlist: any) => (
                <button
                  key={wishlist.id}
                  onClick={() => setActiveWishlist(wishlist.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg ${
                    activeWishlist === wishlist.id
                      ? 'bg-blue-50 text-blue-600'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">{wishlist.name}</div>
                  <div className="text-sm text-gray-500">{wishlist.item_count} items</div>
                </button>
              ))}
            </div>
            <button className="w-full mt-4 py-2 border border-dashed rounded-lg text-gray-600 hover:bg-gray-50">
              + Create New List
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="lg:col-span-3">
          {/* Actions Bar */}
          {selectedItems.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
              <span className="text-blue-700">{selectedItems.length} items selected</span>
              <button
                onClick={() => moveToCart.mutate(selectedItems)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                <ShoppingCart className="w-4 h-4" />
                Add to Cart
              </button>
            </div>
          )}

          {/* Items Grid */}
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : items?.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border">
              <Heart className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-medium mb-2">Your wishlist is empty</h3>
              <p className="text-gray-600 mb-4">Start adding items you love!</p>
              <Link href="/products" className="text-blue-600 hover:underline">
                Browse Products
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {items?.map((item: any) => (
                <div
                  key={item.item.id}
                  className="bg-white rounded-lg border p-4 flex gap-4"
                >
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.item.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedItems([...selectedItems, item.item.id]);
                      } else {
                        setSelectedItems(selectedItems.filter(id => id !== item.item.id));
                      }
                    }}
                    className="mt-1"
                  />

                  <Link href={`/products/${item.product.slug}`} className="w-24 h-24 flex-shrink-0">
                    <img
                      src={item.product.main_image?.url || '/placeholder.png'}
                      alt={item.product.name}
                      className="w-full h-full object-cover rounded"
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link href={`/products/${item.product.slug}`}>
                      <h3 className="font-medium hover:text-blue-600 truncate">
                        {item.product.name}
                      </h3>
                    </Link>

                    {item.variant && (
                      <p className="text-sm text-gray-500">{item.variant.name}</p>
                    )}

                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-lg font-bold">
                        ₴{item.current_price.toFixed(2)}
                      </span>
                      {item.price_drop && (
                        <span className="flex items-center text-green-600 text-sm">
                          <ArrowDown className="w-3 h-3" />
                          from ₴{item.item.added_price.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {!item.in_stock && (
                      <div className="flex items-center gap-1 text-red-600 text-sm mt-1">
                        <AlertCircle className="w-4 h-4" />
                        Out of stock
                      </div>
                    )}

                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => moveToCart.mutate([item.item.id])}
                        disabled={!item.in_stock}
                        className="flex-1 py-2 bg-blue-600 text-white text-sm rounded disabled:opacity-50"
                      >
                        Add to Cart
                      </button>
                      <button
                        onClick={() => removeItem.mutate(item.item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Share Wishlist

```tsx
// components/wishlist/ShareWishlist.tsx
'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Share2, Link2, Mail, Copy, Check } from 'lucide-react';

interface ShareWishlistProps {
  wishlistId: string;
  shareToken: string;
}

export function ShareWishlist({ wishlistId, shareToken }: ShareWishlistProps) {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const shareLink = `${window.location.origin}/wishlist/shared/${shareToken}`;

  const shareByEmail = useMutation({
    mutationFn: (email: string) =>
      fetch(`/api/wishlist/${wishlistId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, permission: 'view' }),
      }),
    onSuccess: () => {
      setEmail('');
      alert('Wishlist shared successfully!');
    },
  });

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Share Wishlist</h2>

            {/* Copy Link */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Share Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-lg bg-gray-50 text-sm"
                />
                <button
                  onClick={copyLink}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Share by Email */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Share via Email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="friend@email.com"
                  className="flex-1 px-3 py-2 border rounded-lg"
                />
                <button
                  onClick={() => shareByEmail.mutate(email)}
                  disabled={!email || shareByEmail.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="w-full py-2 border rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

## API Endpoints

```go
func (h *WishlistHandler) RegisterRoutes(r *gin.RouterGroup) {
    wishlist := r.Group("/wishlist")
    wishlist.Use(AuthMiddleware())
    {
        wishlist.GET("", h.ListWishlists)
        wishlist.POST("", h.CreateWishlist)
        wishlist.GET("/check", h.CheckIfInWishlist)
        wishlist.POST("/toggle", h.ToggleItem)

        wishlist.GET("/:id", h.GetWishlist)
        wishlist.PUT("/:id", h.UpdateWishlist)
        wishlist.DELETE("/:id", h.DeleteWishlist)

        wishlist.GET("/:id/items", h.GetItems)
        wishlist.POST("/:id/items", h.AddItem)
        wishlist.DELETE("/:id/items/:itemId", h.RemoveItem)
        wishlist.POST("/:id/move-to-cart", h.MoveToCart)

        wishlist.POST("/:id/share", h.Share)
    }

    // Public shared wishlist
    r.GET("/wishlist/shared/:token", h.GetSharedWishlist)
    r.POST("/wishlist/shared/:token/purchase/:itemId", h.MarkAsPurchased)
}
```

## Див. також

- [Products](../modules/PRODUCTS.md)
- [Notifications](../modules/INBOX.md)
- [Cart](../modules/CART.md)
