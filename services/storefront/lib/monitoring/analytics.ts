// Google Analytics 4 Integration
declare global {
    interface Window {
        gtag: (...args: unknown[]) => void;
        dataLayer: unknown[];
    }
}

// Initialize GA4
export function initAnalytics() {
    const gaId = process.env.NEXT_PUBLIC_GA_ID;
    const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

    if (typeof window === 'undefined') return;

    // Initialize dataLayer
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
        window.dataLayer.push(arguments);
    };

    // Load GA4
    if (gaId) {
        const script = document.createElement('script');
        script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
        script.async = true;
        document.head.appendChild(script);

        window.gtag('js', new Date());
        window.gtag('config', gaId, {
            page_path: window.location.pathname,
            anonymize_ip: true,
            cookie_flags: 'SameSite=None;Secure',
        });
    }

    // Load GTM
    if (gtmId) {
        const script = document.createElement('script');
        script.innerHTML = `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtmId}');
        `;
        document.head.appendChild(script);
    }
}

// Page view tracking
export function trackPageView(url: string, title?: string) {
    if (typeof window === 'undefined' || !window.gtag) return;

    window.gtag('event', 'page_view', {
        page_path: url,
        page_title: title || document.title,
    });
}

// Event tracking
export function trackEvent(
    eventName: string,
    params?: Record<string, unknown>
) {
    if (typeof window === 'undefined' || !window.gtag) return;

    window.gtag('event', eventName, params);
}

// E-commerce tracking
export const ecommerce = {
    // View item list
    viewItemList(items: ProductItem[], listName: string) {
        trackEvent('view_item_list', {
            item_list_name: listName,
            items: items.map(formatProductItem),
        });
    },

    // View item
    viewItem(item: ProductItem) {
        trackEvent('view_item', {
            currency: 'UAH',
            value: item.price,
            items: [formatProductItem(item)],
        });
    },

    // Add to cart
    addToCart(item: ProductItem, quantity: number = 1) {
        trackEvent('add_to_cart', {
            currency: 'UAH',
            value: item.price * quantity,
            items: [{ ...formatProductItem(item), quantity }],
        });
    },

    // Remove from cart
    removeFromCart(item: ProductItem, quantity: number = 1) {
        trackEvent('remove_from_cart', {
            currency: 'UAH',
            value: item.price * quantity,
            items: [{ ...formatProductItem(item), quantity }],
        });
    },

    // View cart
    viewCart(items: CartItem[], total: number) {
        trackEvent('view_cart', {
            currency: 'UAH',
            value: total,
            items: items.map(formatCartItem),
        });
    },

    // Begin checkout
    beginCheckout(items: CartItem[], total: number) {
        trackEvent('begin_checkout', {
            currency: 'UAH',
            value: total,
            items: items.map(formatCartItem),
        });
    },

    // Add shipping info
    addShippingInfo(items: CartItem[], total: number, shippingTier: string) {
        trackEvent('add_shipping_info', {
            currency: 'UAH',
            value: total,
            shipping_tier: shippingTier,
            items: items.map(formatCartItem),
        });
    },

    // Add payment info
    addPaymentInfo(items: CartItem[], total: number, paymentType: string) {
        trackEvent('add_payment_info', {
            currency: 'UAH',
            value: total,
            payment_type: paymentType,
            items: items.map(formatCartItem),
        });
    },

    // Purchase
    purchase(
        transactionId: string,
        items: CartItem[],
        total: number,
        shipping: number = 0,
        tax: number = 0
    ) {
        trackEvent('purchase', {
            transaction_id: transactionId,
            currency: 'UAH',
            value: total,
            shipping,
            tax,
            items: items.map(formatCartItem),
        });
    },

    // Refund
    refund(transactionId: string, items?: CartItem[], total?: number) {
        trackEvent('refund', {
            transaction_id: transactionId,
            currency: 'UAH',
            value: total,
            items: items?.map(formatCartItem),
        });
    },

    // Promotion view
    viewPromotion(promotionId: string, promotionName: string, creativeName?: string) {
        trackEvent('view_promotion', {
            promotion_id: promotionId,
            promotion_name: promotionName,
            creative_name: creativeName,
        });
    },

    // Promotion click
    selectPromotion(promotionId: string, promotionName: string, creativeName?: string) {
        trackEvent('select_promotion', {
            promotion_id: promotionId,
            promotion_name: promotionName,
            creative_name: creativeName,
        });
    },
};

// User tracking
export const userTracking = {
    // Login
    login(method: string) {
        trackEvent('login', { method });
    },

    // Sign up
    signUp(method: string) {
        trackEvent('sign_up', { method });
    },

    // Set user ID
    setUserId(userId: string) {
        if (typeof window === 'undefined' || !window.gtag) return;
        window.gtag('config', process.env.NEXT_PUBLIC_GA_ID!, {
            user_id: userId,
        });
    },

    // Set user properties
    setUserProperties(properties: Record<string, unknown>) {
        if (typeof window === 'undefined' || !window.gtag) return;
        window.gtag('set', 'user_properties', properties);
    },
};

// Search tracking
export function trackSearch(searchTerm: string, resultsCount?: number) {
    trackEvent('search', {
        search_term: searchTerm,
        results_count: resultsCount,
    });
}

// Share tracking
export function trackShare(method: string, contentType: string, itemId: string) {
    trackEvent('share', {
        method,
        content_type: contentType,
        item_id: itemId,
    });
}

// Custom dimensions
export function setCustomDimension(name: string, value: string) {
    if (typeof window === 'undefined' || !window.gtag) return;
    window.gtag('set', { [name]: value });
}

// Helper types and functions
interface ProductItem {
    id: string;
    name: string;
    price: number;
    category?: string;
    brand?: string;
    variant?: string;
}

interface CartItem extends ProductItem {
    quantity: number;
}

function formatProductItem(item: ProductItem, index?: number) {
    return {
        item_id: item.id,
        item_name: item.name,
        price: item.price,
        item_category: item.category,
        item_brand: item.brand,
        item_variant: item.variant,
        index,
    };
}

function formatCartItem(item: CartItem, index?: number) {
    return {
        ...formatProductItem(item, index),
        quantity: item.quantity,
    };
}

// Export for custom events
export { trackEvent as track };
