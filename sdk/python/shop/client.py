"""
Shop Platform SDK for Python
Enables partners to integrate with Shop marketplace in minutes
"""

import hmac
import hashlib
from typing import Any, Dict, List, Optional, TypedDict
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


# =============================================================================
# TYPES
# =============================================================================

class OrderStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class WebhookEvent(str, Enum):
    ORDER_CREATED = "order.created"
    ORDER_PAID = "order.paid"
    ORDER_SHIPPED = "order.shipped"
    ORDER_DELIVERED = "order.delivered"
    ORDER_CANCELLED = "order.cancelled"
    PRODUCT_CREATED = "product.created"
    PRODUCT_UPDATED = "product.updated"
    PRODUCT_DELETED = "product.deleted"
    INVENTORY_LOW = "inventory.low"


@dataclass
class Address:
    first_name: str
    last_name: str
    address1: str
    city: str
    region: str
    postal_code: str
    country: str
    company: Optional[str] = None
    address2: Optional[str] = None
    phone: Optional[str] = None


@dataclass
class ProductVariant:
    id: str
    sku: str
    name: str
    price: float
    inventory: int
    options: Dict[str, str] = field(default_factory=dict)


@dataclass
class Product:
    id: str
    sku: str
    name: str
    description: str
    price: float
    currency: str
    category_id: str
    images: List[str]
    inventory: int
    status: str
    created_at: str
    updated_at: str
    compare_at_price: Optional[float] = None
    variants: List[ProductVariant] = field(default_factory=list)
    attributes: Dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict) -> "Product":
        variants = [
            ProductVariant(**v) for v in data.pop("variants", [])
        ]
        return cls(**data, variants=variants)


@dataclass
class OrderItem:
    product_id: str
    sku: str
    name: str
    quantity: int
    price: float
    total_price: float
    variant_id: Optional[str] = None


@dataclass
class Order:
    id: str
    order_number: str
    status: OrderStatus
    customer_email: str
    customer_name: str
    shipping_address: Address
    billing_address: Address
    items: List[OrderItem]
    subtotal: float
    shipping_cost: float
    tax: float
    discount: float
    total: float
    currency: str
    created_at: str
    updated_at: str
    notes: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "Order":
        data["status"] = OrderStatus(data["status"])
        data["shipping_address"] = Address(**data["shipping_address"])
        data["billing_address"] = Address(**data["billing_address"])
        data["items"] = [OrderItem(**item) for item in data["items"]]
        return cls(**data)


@dataclass
class Webhook:
    id: str
    url: str
    events: List[str]
    active: bool
    created_at: str
    secret: Optional[str] = None


@dataclass
class PaginatedList:
    items: List[Any]
    total: int
    page: int
    limit: int
    total_pages: int


class ShopAPIError(Exception):
    """Shop API error"""

    def __init__(self, code: str, message: str, details: Optional[Any] = None):
        self.code = code
        self.message = message
        self.details = details
        super().__init__(f"{code}: {message}")


# =============================================================================
# CLIENT
# =============================================================================

class ShopClient:
    """Shop Platform API Client"""

    DEFAULT_BASE_URL = "https://api.shop.com/v1"
    DEFAULT_TIMEOUT = 30

    def __init__(
        self,
        api_key: str,
        base_url: Optional[str] = None,
        timeout: int = DEFAULT_TIMEOUT,
        max_retries: int = 3,
    ):
        """
        Initialize Shop API client.

        Args:
            api_key: Your Shop API key
            base_url: Custom API base URL (optional)
            timeout: Request timeout in seconds
            max_retries: Maximum number of retries for failed requests
        """
        self.api_key = api_key
        self.base_url = base_url or self.DEFAULT_BASE_URL
        self.timeout = timeout

        # Setup session with retries
        self.session = requests.Session()
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

        # Set default headers
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "shop-python-sdk/1.0.0",
        })

        # Initialize API modules
        self.products = ProductsAPI(self)
        self.orders = OrdersAPI(self)
        self.webhooks = WebhooksAPI(self)
        self.categories = CategoriesAPI(self)

    def _request(
        self,
        method: str,
        path: str,
        params: Optional[dict] = None,
        json: Optional[dict] = None,
    ) -> dict:
        """Make an API request."""
        url = f"{self.base_url}{path}"

        response = self.session.request(
            method=method,
            url=url,
            params=params,
            json=json,
            timeout=self.timeout,
        )

        if response.status_code >= 400:
            try:
                error_data = response.json()
                raise ShopAPIError(
                    code=error_data.get("code", "unknown"),
                    message=error_data.get("message", response.text),
                    details=error_data.get("details"),
                )
            except ValueError:
                raise ShopAPIError(
                    code="http_error",
                    message=f"HTTP {response.status_code}: {response.text}",
                )

        if response.status_code == 204:
            return {}

        return response.json()


# =============================================================================
# PRODUCTS API
# =============================================================================

class ProductsAPI:
    """Products API"""

    def __init__(self, client: ShopClient):
        self._client = client

    def create(
        self,
        sku: str,
        name: str,
        description: str,
        price: float,
        category_id: str,
        images: Optional[List[str]] = None,
        inventory: int = 0,
        compare_at_price: Optional[float] = None,
        attributes: Optional[Dict[str, str]] = None,
    ) -> Product:
        """Create a new product."""
        data = {
            "sku": sku,
            "name": name,
            "description": description,
            "price": price,
            "category_id": category_id,
            "images": images or [],
            "inventory": inventory,
        }
        if compare_at_price:
            data["compare_at_price"] = compare_at_price
        if attributes:
            data["attributes"] = attributes

        result = self._client._request("POST", "/products", json=data)
        return Product.from_dict(result)

    def get(self, product_id: str) -> Product:
        """Get a product by ID."""
        result = self._client._request("GET", f"/products/{product_id}")
        return Product.from_dict(result)

    def update(self, product_id: str, **updates) -> Product:
        """Update a product."""
        result = self._client._request("PUT", f"/products/{product_id}", json=updates)
        return Product.from_dict(result)

    def delete(self, product_id: str) -> None:
        """Delete a product."""
        self._client._request("DELETE", f"/products/{product_id}")

    def list(
        self,
        page: int = 1,
        limit: int = 20,
        category_id: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> PaginatedList:
        """List products with optional filters."""
        params = {"page": page, "limit": limit}
        if category_id:
            params["category_id"] = category_id
        if status:
            params["status"] = status
        if search:
            params["search"] = search

        result = self._client._request("GET", "/products", params=params)
        return PaginatedList(
            items=[Product.from_dict(p) for p in result["items"]],
            total=result["total"],
            page=result["page"],
            limit=result["limit"],
            total_pages=result["total_pages"],
        )

    def update_inventory(self, product_id: str, quantity: int) -> None:
        """Update product inventory."""
        self._client._request(
            "PATCH",
            f"/products/{product_id}/inventory",
            json={"inventory": quantity},
        )

    def bulk_create(self, products: List[dict]) -> List[Product]:
        """Bulk create products."""
        result = self._client._request(
            "POST", "/products/bulk", json={"products": products}
        )
        return [Product.from_dict(p) for p in result]

    def bulk_update_inventory(self, updates: List[dict]) -> None:
        """
        Bulk update inventory.

        Args:
            updates: List of {"id": "product_id", "quantity": 10}
        """
        self._client._request(
            "PATCH", "/products/inventory/bulk", json={"updates": updates}
        )


# =============================================================================
# ORDERS API
# =============================================================================

class OrdersAPI:
    """Orders API"""

    def __init__(self, client: ShopClient):
        self._client = client

    def get(self, order_id: str) -> Order:
        """Get an order by ID."""
        result = self._client._request("GET", f"/orders/{order_id}")
        return Order.from_dict(result)

    def list(
        self,
        page: int = 1,
        limit: int = 20,
        status: Optional[OrderStatus] = None,
        since: Optional[datetime] = None,
    ) -> PaginatedList:
        """List orders with optional filters."""
        params = {"page": page, "limit": limit}
        if status:
            params["status"] = status.value
        if since:
            params["since"] = since.isoformat()

        result = self._client._request("GET", "/orders", params=params)
        return PaginatedList(
            items=[Order.from_dict(o) for o in result["items"]],
            total=result["total"],
            page=result["page"],
            limit=result["limit"],
            total_pages=result["total_pages"],
        )

    def update_status(self, order_id: str, status: OrderStatus) -> Order:
        """Update order status."""
        result = self._client._request(
            "PATCH",
            f"/orders/{order_id}/status",
            json={"status": status.value},
        )
        return Order.from_dict(result)

    def add_tracking(
        self, order_id: str, carrier: str, tracking_number: str
    ) -> None:
        """Add tracking information to an order."""
        self._client._request(
            "POST",
            f"/orders/{order_id}/tracking",
            json={"carrier": carrier, "tracking_number": tracking_number},
        )

    def fulfill(self, order_id: str, items: List[dict]) -> None:
        """
        Add fulfillment to an order.

        Args:
            order_id: Order ID
            items: List of {"item_id": "xxx", "quantity": 1}
        """
        self._client._request(
            "POST", f"/orders/{order_id}/fulfill", json={"items": items}
        )

    def cancel(self, order_id: str, reason: Optional[str] = None) -> Order:
        """Cancel an order."""
        result = self._client._request(
            "POST", f"/orders/{order_id}/cancel", json={"reason": reason}
        )
        return Order.from_dict(result)

    def refund(
        self,
        order_id: str,
        amount: Optional[float] = None,
        reason: Optional[str] = None,
    ) -> Order:
        """Refund an order."""
        result = self._client._request(
            "POST",
            f"/orders/{order_id}/refund",
            json={"amount": amount, "reason": reason},
        )
        return Order.from_dict(result)


# =============================================================================
# WEBHOOKS API
# =============================================================================

class WebhooksAPI:
    """Webhooks API"""

    def __init__(self, client: ShopClient):
        self._client = client

    def create(self, url: str, events: List[WebhookEvent]) -> Webhook:
        """Create a new webhook."""
        result = self._client._request(
            "POST",
            "/webhooks",
            json={"url": url, "events": [e.value for e in events]},
        )
        return Webhook(**result)

    def delete(self, webhook_id: str) -> None:
        """Delete a webhook."""
        self._client._request("DELETE", f"/webhooks/{webhook_id}")

    def list(self) -> List[Webhook]:
        """List webhooks."""
        result = self._client._request("GET", "/webhooks")
        return [Webhook(**w) for w in result]

    def update(
        self,
        webhook_id: str,
        url: Optional[str] = None,
        events: Optional[List[WebhookEvent]] = None,
        active: Optional[bool] = None,
    ) -> Webhook:
        """Update a webhook."""
        data = {}
        if url:
            data["url"] = url
        if events:
            data["events"] = [e.value for e in events]
        if active is not None:
            data["active"] = active

        result = self._client._request(
            "PATCH", f"/webhooks/{webhook_id}", json=data
        )
        return Webhook(**result)

    @staticmethod
    def verify_signature(payload: str, signature: str, secret: str) -> bool:
        """Verify webhook signature."""
        expected = hmac.new(
            secret.encode(), payload.encode(), hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(signature, expected)


# =============================================================================
# CATEGORIES API
# =============================================================================

class CategoriesAPI:
    """Categories API"""

    def __init__(self, client: ShopClient):
        self._client = client

    def list(self) -> List[dict]:
        """List all categories."""
        return self._client._request("GET", "/categories")

    def get(self, category_id: str) -> dict:
        """Get a category by ID."""
        return self._client._request("GET", f"/categories/{category_id}")
