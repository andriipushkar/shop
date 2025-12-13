// Predefined experiments configuration

import { Experiment } from './ab-testing';

export const experiments: Experiment[] = [
    // Checkout flow experiment
    {
        id: 'checkout-flow',
        name: 'Checkout Flow Optimization',
        description: 'Testing different checkout page layouts',
        status: 'running',
        variants: [
            { id: 'control', name: 'Current Checkout', weight: 50 },
            { id: 'single-page', name: 'Single Page Checkout', weight: 50 },
        ],
    },

    // Product page CTA button
    {
        id: 'product-cta',
        name: 'Product CTA Button',
        description: 'Testing different CTA button styles',
        status: 'running',
        variants: [
            { id: 'control', name: 'Green Button', weight: 33, config: { color: 'green', text: 'Купити' } },
            { id: 'orange', name: 'Orange Button', weight: 33, config: { color: 'orange', text: 'Додати до кошика' } },
            { id: 'blue', name: 'Blue Button', weight: 34, config: { color: 'blue', text: 'Замовити зараз' } },
        ],
    },

    // Homepage hero banner
    {
        id: 'homepage-hero',
        name: 'Homepage Hero Banner',
        description: 'Testing hero banner variations',
        status: 'running',
        variants: [
            { id: 'control', name: 'Static Banner', weight: 50, config: { type: 'static' } },
            { id: 'carousel', name: 'Carousel Banner', weight: 50, config: { type: 'carousel' } },
        ],
    },

    // Free shipping threshold
    {
        id: 'free-shipping-threshold',
        name: 'Free Shipping Threshold',
        description: 'Testing different free shipping thresholds',
        status: 'running',
        variants: [
            { id: 'control', name: '1000 UAH', weight: 25, config: { threshold: 1000 } },
            { id: '800', name: '800 UAH', weight: 25, config: { threshold: 800 } },
            { id: '1500', name: '1500 UAH', weight: 25, config: { threshold: 1500 } },
            { id: 'none', name: 'No Free Shipping', weight: 25, config: { threshold: null } },
        ],
    },

    // Product recommendations position
    {
        id: 'recommendations-position',
        name: 'Recommendations Position',
        description: 'Testing where to show product recommendations',
        status: 'running',
        variants: [
            { id: 'control', name: 'Below Description', weight: 33, config: { position: 'below-description' } },
            { id: 'sidebar', name: 'In Sidebar', weight: 33, config: { position: 'sidebar' } },
            { id: 'bottom', name: 'Page Bottom', weight: 34, config: { position: 'bottom' } },
        ],
    },

    // Search results layout
    {
        id: 'search-layout',
        name: 'Search Results Layout',
        description: 'Testing grid vs list view for search',
        status: 'running',
        variants: [
            { id: 'control', name: 'Grid View', weight: 50, config: { layout: 'grid', columns: 4 } },
            { id: 'list', name: 'List View', weight: 50, config: { layout: 'list' } },
        ],
    },

    // Mobile navigation
    {
        id: 'mobile-nav',
        name: 'Mobile Navigation',
        description: 'Testing mobile navigation patterns',
        status: 'running',
        targetAudience: {
            devices: ['mobile'],
        },
        variants: [
            { id: 'control', name: 'Hamburger Menu', weight: 50, config: { type: 'hamburger' } },
            { id: 'bottom-nav', name: 'Bottom Navigation', weight: 50, config: { type: 'bottom' } },
        ],
    },

    // Cart abandonment popup
    {
        id: 'cart-popup',
        name: 'Cart Abandonment Popup',
        description: 'Testing exit intent popup for cart abandonment',
        status: 'running',
        variants: [
            { id: 'control', name: 'No Popup', weight: 50 },
            { id: 'discount', name: 'Discount Popup', weight: 50, config: { discount: 10, message: 'Отримайте 10% знижку!' } },
        ],
    },

    // Review display format
    {
        id: 'reviews-display',
        name: 'Reviews Display',
        description: 'Testing how reviews are displayed',
        status: 'running',
        variants: [
            { id: 'control', name: 'All Reviews', weight: 33, config: { filter: 'all' } },
            { id: 'verified', name: 'Verified First', weight: 33, config: { filter: 'verified-first' } },
            { id: 'helpful', name: 'Most Helpful', weight: 34, config: { filter: 'helpful' } },
        ],
    },

    // Loyalty program visibility
    {
        id: 'loyalty-visibility',
        name: 'Loyalty Program Visibility',
        description: 'Testing loyalty program prominence',
        status: 'running',
        variants: [
            { id: 'control', name: 'Header Only', weight: 50, config: { showInHeader: true, showInProduct: false } },
            { id: 'everywhere', name: 'Show Everywhere', weight: 50, config: { showInHeader: true, showInProduct: true } },
        ],
    },
];

// Feature flags (simpler on/off experiments)
export const featureFlags: Experiment[] = [
    {
        id: 'dark-mode',
        name: 'Dark Mode',
        status: 'paused',
        variants: [
            { id: 'disabled', name: 'Disabled', weight: 100 },
            { id: 'enabled', name: 'Enabled', weight: 0 },
        ],
    },
    {
        id: 'new-search',
        name: 'New Search Algorithm',
        status: 'running',
        targetAudience: {
            percentage: 20,
        },
        variants: [
            { id: 'disabled', name: 'Old Search', weight: 50 },
            { id: 'enabled', name: 'New Search', weight: 50 },
        ],
    },
    {
        id: 'ai-recommendations',
        name: 'AI-Powered Recommendations',
        status: 'running',
        targetAudience: {
            percentage: 10,
        },
        variants: [
            { id: 'disabled', name: 'Standard Recommendations', weight: 50 },
            { id: 'enabled', name: 'AI Recommendations', weight: 50 },
        ],
    },
    {
        id: 'chat-support',
        name: 'Live Chat Support',
        status: 'running',
        variants: [
            { id: 'disabled', name: 'Disabled', weight: 30 },
            { id: 'enabled', name: 'Enabled', weight: 70 },
        ],
    },
    {
        id: 'quick-view',
        name: 'Product Quick View',
        status: 'running',
        variants: [
            { id: 'disabled', name: 'Disabled', weight: 20 },
            { id: 'enabled', name: 'Enabled', weight: 80 },
        ],
    },
];

// Get all experiments
export function getAllExperiments(): Experiment[] {
    return [...experiments, ...featureFlags];
}

// Get experiment by ID
export function getExperimentById(id: string): Experiment | undefined {
    return getAllExperiments().find((exp) => exp.id === id);
}

// Get active experiments only
export function getActiveExperiments(): Experiment[] {
    return getAllExperiments().filter((exp) => exp.status === 'running');
}
