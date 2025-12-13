/**
 * Monobank Acquiring Integration
 * Інтеграція з еквайрингом Monobank
 * @see https://api.monobank.ua/docs/acquiring.html
 */

import { paymentLogger } from '../logger';

export interface MonobankConfig {
    token: string;
    testMode: boolean;
}

export interface MonobankInvoiceRequest {
    amount: number; // Сума в копійках
    ccy?: number; // Код валюти ISO 4217 (980 = UAH)
    merchantPaymInfo?: {
        reference?: string; // Номер замовлення
        destination?: string; // Призначення платежу
        comment?: string;
        customerEmails?: string[];
        basketOrder?: MonobankBasketItem[];
    };
    redirectUrl?: string;
    webHookUrl?: string;
    validity?: number; // Термін дії рахунку в секундах
    paymentType?: 'debit' | 'hold';
    qrId?: string;
    code?: string; // QR-каса
    saveCardData?: {
        saveCard: boolean;
        walletId?: string;
    };
}

export interface MonobankBasketItem {
    name: string;
    qty: number;
    sum: number; // Сума в копійках
    icon?: string;
    unit?: string;
    code?: string;
    barcode?: string;
    header?: string;
    footer?: string;
    tax?: number[];
    uktzed?: string;
}

export interface MonobankInvoiceResponse {
    invoiceId: string;
    pageUrl: string;
}

export interface MonobankInvoiceStatus {
    invoiceId: string;
    status: MonobankPaymentStatus;
    failureReason?: string;
    errCode?: string;
    amount: number;
    ccy: number;
    finalAmount?: number;
    createdDate: string;
    modifiedDate: string;
    reference?: string;
    destination?: string;
    cancelList?: MonobankCancelItem[];
    walletData?: {
        cardToken: string;
        walletId: string;
        status: string;
    };
}

export type MonobankPaymentStatus =
    | 'created'
    | 'processing'
    | 'hold'
    | 'success'
    | 'failure'
    | 'reversed'
    | 'expired';

export interface MonobankCancelItem {
    status: 'processing' | 'success' | 'failure';
    amount: number;
    ccy: number;
    createdDate: string;
    modifiedDate: string;
    approvalCode?: string;
    rrn?: string;
    extRef?: string;
}

export interface MonobankWebhookPayload {
    invoiceId: string;
    status: MonobankPaymentStatus;
    failureReason?: string;
    errCode?: string;
    amount: number;
    ccy: number;
    finalAmount?: number;
    createdDate: string;
    modifiedDate: string;
    reference?: string;
}

export interface MonobankRefundRequest {
    invoiceId: string;
    amount?: number; // Якщо не вказано - повне повернення
    extRef?: string;
}

export interface MonobankMerchantInfo {
    merchantId: string;
    merchantName: string;
    edrpou?: string;
    pubKey?: {
        keyId: string;
        key: string;
    };
}

class MonobankService {
    private config: MonobankConfig;
    private apiUrl = 'https://api.monobank.ua/api/merchant';

    constructor(config?: Partial<MonobankConfig>) {
        this.config = {
            token: process.env.MONOBANK_TOKEN || '',
            testMode: process.env.NODE_ENV !== 'production',
            ...config,
        };
    }

    /**
     * Створення рахунку на оплату
     */
    async createInvoice(request: MonobankInvoiceRequest): Promise<MonobankInvoiceResponse> {
        const payload = {
            amount: request.amount,
            ccy: request.ccy || 980, // UAH
            merchantPaymInfo: request.merchantPaymInfo,
            redirectUrl: request.redirectUrl || process.env.NEXT_PUBLIC_SITE_URL + '/checkout/result',
            webHookUrl: request.webHookUrl || process.env.NEXT_PUBLIC_SITE_URL + '/api/payments/monobank/webhook',
            validity: request.validity || 3600, // 1 година
            paymentType: request.paymentType || 'debit',
            ...(request.saveCardData && { saveCardData: request.saveCardData }),
        };

        const response = await this.sendRequest('/invoice/create', 'POST', payload);
        return response as MonobankInvoiceResponse;
    }

    /**
     * Створення рахунку для замовлення
     */
    async createOrderInvoice(
        orderId: string,
        amount: number,
        items: Array<{ name: string; quantity: number; price: number }>,
        customerEmail?: string
    ): Promise<MonobankInvoiceResponse> {
        const basketOrder: MonobankBasketItem[] = items.map(item => ({
            name: item.name,
            qty: item.quantity,
            sum: Math.round(item.price * 100), // Конвертація в копійки
            unit: 'шт.',
        }));

        return this.createInvoice({
            amount: Math.round(amount * 100), // Конвертація в копійки
            merchantPaymInfo: {
                reference: orderId,
                destination: `Оплата замовлення #${orderId}`,
                basketOrder,
                customerEmails: customerEmail ? [customerEmail] : undefined,
            },
        });
    }

    /**
     * Перевірка статусу рахунку
     */
    async getInvoiceStatus(invoiceId: string): Promise<MonobankInvoiceStatus> {
        const response = await this.sendRequest('/invoice/status', 'GET', { invoiceId });
        return response as MonobankInvoiceStatus;
    }

    /**
     * Скасування/Повернення оплати
     */
    async cancelInvoice(request: MonobankRefundRequest): Promise<MonobankCancelItem> {
        const payload: Record<string, unknown> = {
            invoiceId: request.invoiceId,
        };

        if (request.amount) {
            payload.amount = request.amount;
        }

        if (request.extRef) {
            payload.extRef = request.extRef;
        }

        const response = await this.sendRequest('/invoice/cancel', 'POST', payload);
        return response as MonobankCancelItem;
    }

    /**
     * Фіналізація суми холду
     */
    async finalizeHold(invoiceId: string, amount?: number): Promise<MonobankInvoiceStatus> {
        const payload: Record<string, unknown> = {
            invoiceId,
        };

        if (amount) {
            payload.amount = amount;
        }

        const response = await this.sendRequest('/invoice/finalize', 'POST', payload);
        return response as MonobankInvoiceStatus;
    }

    /**
     * Інформація про мерчанта
     */
    async getMerchantInfo(): Promise<MonobankMerchantInfo> {
        const response = await this.sendRequest('/details', 'GET');
        return response as MonobankMerchantInfo;
    }

    /**
     * Виписка по мерчанту
     */
    async getStatement(from: number, to?: number): Promise<MonobankInvoiceStatus[]> {
        const params: Record<string, unknown> = { from };
        if (to) params.to = to;

        const response = await this.sendRequest('/statement', 'GET', params);
        return response as MonobankInvoiceStatus[];
    }

    /**
     * Публічний ключ мерчанта
     */
    async getPublicKey(): Promise<{ keyId: string; key: string }> {
        const response = await this.sendRequest('/pubkey', 'GET');
        return response as { keyId: string; key: string };
    }

    /**
     * Верифікація webhook підпису
     */
    verifyWebhook(body: string, xSign: string, pubKeyBase64: string): boolean {
        try {
            const crypto = require('crypto');
            const pubKey = `-----BEGIN PUBLIC KEY-----\n${pubKeyBase64}\n-----END PUBLIC KEY-----`;
            const verify = crypto.createVerify('SHA256');
            verify.update(body);
            return verify.verify(pubKey, xSign, 'base64');
        } catch (error) {
            paymentLogger.error('Monobank webhook verification error', error);
            return false;
        }
    }

    /**
     * Парсинг webhook payload
     */
    parseWebhook(body: string): MonobankWebhookPayload {
        return JSON.parse(body) as MonobankWebhookPayload;
    }

    /**
     * Відправка запиту до API
     */
    private async sendRequest(
        endpoint: string,
        method: 'GET' | 'POST',
        data?: Record<string, unknown>
    ): Promise<unknown> {
        let url = `${this.apiUrl}${endpoint}`;

        const options: RequestInit = {
            method,
            headers: {
                'X-Token': this.config.token,
                'Content-Type': 'application/json',
            },
        };

        if (method === 'GET' && data) {
            const params = new URLSearchParams();
            Object.entries(data).forEach(([key, value]) => {
                params.append(key, String(value));
            });
            url += `?${params.toString()}`;
        } else if (method === 'POST' && data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.errText || `Monobank API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            paymentLogger.error('Monobank API error', error);
            throw error;
        }
    }

    /**
     * Перевірка чи платіж успішний
     */
    isPaymentSuccessful(status: MonobankPaymentStatus): boolean {
        return status === 'success';
    }

    /**
     * Перевірка чи платіж в обробці
     */
    isPaymentPending(status: MonobankPaymentStatus): boolean {
        return ['created', 'processing', 'hold'].includes(status);
    }

    /**
     * Перевірка чи платіж невдалий
     */
    isPaymentFailed(status: MonobankPaymentStatus): boolean {
        return ['failure', 'expired'].includes(status);
    }

    /**
     * Конвертація копійок в гривні
     */
    fromKopecks(amount: number): number {
        return amount / 100;
    }

    /**
     * Конвертація гривень в копійки
     */
    toKopecks(amount: number): number {
        return Math.round(amount * 100);
    }
}

// Singleton instance
export const monobank = new MonobankService();

// React hook
export function useMonobank() {
    return monobank;
}
