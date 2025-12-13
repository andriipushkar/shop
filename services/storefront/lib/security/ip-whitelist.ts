/**
 * IP Whitelist utilities for webhook security
 * Validates that webhook requests come from trusted sources
 */

// Monobank API IP addresses (update as needed from Monobank documentation)
// https://api.monobank.ua/docs/acquiring.html
const MONOBANK_IPS = [
    '217.117.70.0/24',     // Monobank primary
    '194.28.86.0/24',      // Monobank secondary
    '91.218.128.0/20',     // Monobank range
];

// LiqPay API IP addresses
// https://www.liqpay.ua/documentation/api/callback
const LIQPAY_IPS = [
    '217.117.72.0/24',     // LiqPay
    '91.200.28.0/24',      // LiqPay secondary
];

// Nova Poshta webhook IPs
const NOVA_POSHTA_IPS = [
    '91.234.48.0/24',      // Nova Poshta
];

// Allowed webhook providers
type WebhookProvider = 'monobank' | 'liqpay' | 'nova_poshta' | 'all';

/**
 * Parse CIDR notation to IP range
 */
function parseCIDR(cidr: string): { start: number; end: number } {
    const [ip, prefix] = cidr.split('/');
    const prefixNum = parseInt(prefix, 10);
    const ipNum = ipToNumber(ip);
    const mask = -1 << (32 - prefixNum);
    const start = ipNum & mask;
    const end = start + Math.pow(2, 32 - prefixNum) - 1;
    return { start, end };
}

/**
 * Convert IP address string to number
 */
function ipToNumber(ip: string): number {
    const parts = ip.split('.').map(Number);
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * Check if IP is in CIDR range
 */
function ipInCIDR(ip: string, cidr: string): boolean {
    const ipNum = ipToNumber(ip);
    const { start, end } = parseCIDR(cidr);
    return ipNum >= start && ipNum <= end;
}

/**
 * Check if IP is in whitelist for specific provider
 */
export function isIPWhitelisted(ip: string, provider: WebhookProvider): boolean {
    // Skip whitelist check in development
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_IP_WHITELIST === 'true') {
        return true;
    }

    // Allow localhost in development
    if (process.env.NODE_ENV !== 'production') {
        if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
            return true;
        }
    }

    let allowedIPs: string[] = [];

    switch (provider) {
        case 'monobank':
            allowedIPs = MONOBANK_IPS;
            break;
        case 'liqpay':
            allowedIPs = LIQPAY_IPS;
            break;
        case 'nova_poshta':
            allowedIPs = NOVA_POSHTA_IPS;
            break;
        case 'all':
            allowedIPs = [...MONOBANK_IPS, ...LIQPAY_IPS, ...NOVA_POSHTA_IPS];
            break;
        default:
            return false;
    }

    // Check if IP matches any allowed CIDR
    return allowedIPs.some(cidr => {
        if (cidr.includes('/')) {
            return ipInCIDR(ip, cidr);
        }
        return ip === cidr;
    });
}

/**
 * Get client IP from request
 */
export function getClientIP(request: Request): string {
    // Check various headers in order of preference
    const headers = request.headers;

    // Cloudflare
    const cfConnectingIP = headers.get('cf-connecting-ip');
    if (cfConnectingIP) return cfConnectingIP;

    // Standard forwarded header
    const forwarded = headers.get('x-forwarded-for');
    if (forwarded) {
        // Get the first IP in the chain (original client)
        return forwarded.split(',')[0].trim();
    }

    // Real IP header (nginx)
    const realIP = headers.get('x-real-ip');
    if (realIP) return realIP;

    // Fallback - this won't work in serverless but is a fallback
    return '0.0.0.0';
}

/**
 * Validate webhook request IP
 */
export function validateWebhookIP(
    request: Request,
    provider: WebhookProvider
): { valid: boolean; ip: string; error?: string } {
    const ip = getClientIP(request);

    if (!ip || ip === '0.0.0.0') {
        return { valid: false, ip, error: 'Could not determine client IP' };
    }

    if (!isIPWhitelisted(ip, provider)) {
        return {
            valid: false,
            ip,
            error: `IP ${ip} is not in the ${provider} whitelist`,
        };
    }

    return { valid: true, ip };
}

/**
 * Middleware to validate webhook IP
 */
export function createIPWhitelistMiddleware(provider: WebhookProvider) {
    return (request: Request): { allowed: boolean; ip: string; error?: string } => {
        const result = validateWebhookIP(request, provider);
        return {
            allowed: result.valid,
            ip: result.ip,
            error: result.error,
        };
    };
}
