/**
 * LiqPay Payment Integration
 * Інтеграція з платіжною системою LiqPay
 * @see https://www.liqpay.ua/documentation
 */

import crypto from 'crypto';
import { paymentLogger } from '../logger';

export interface LiqPayConfig {
    publicKey: string;
    privateKey: string;
    sandboxMode: boolean;
}

export interface LiqPayPaymentData {
    orderId: string;
    amount: number;
    currency: 'UAH' | 'USD' | 'EUR';
    description: string;
    customerEmail?: string;
    customerPhone?: string;
    resultUrl?: string;
    serverUrl?: string;
    language?: 'uk' | 'en' | 'ru';
}

export interface LiqPayPaymentResponse {
    paymentId: string;
    status: LiqPayStatus;
    amount: number;
    currency: string;
    orderId: string;
    description: string;
    senderPhone?: string;
    transactionId?: string;
    errorCode?: string;
    errorDescription?: string;
    createDate?: string;
    endDate?: string;
}

export type LiqPayStatus =
    | 'success'
    | 'failure'
    | 'error'
    | 'wait_accept'
    | 'wait_secure'
    | 'sandbox'
    | 'processing'
    | 'subscribed'
    | 'unsubscribed'
    | 'reversed'
    | 'refund_wait'
    | 'cash_wait'
    | 'hold_wait';

export interface LiqPayCheckoutParams {
    data: string;
    signature: string;
}

export interface LiqPayRefundRequest {
    orderId: string;
    amount: number;
    description?: string;
}

class LiqPayService {
    private config: LiqPayConfig;
    private apiUrl = 'https://www.liqpay.ua/api/request';
    private checkoutUrl = 'https://www.liqpay.ua/api/3/checkout';

    constructor(config?: Partial<LiqPayConfig>) {
        this.config = {
            publicKey: process.env.LIQPAY_PUBLIC_KEY || '',
            privateKey: process.env.LIQPAY_PRIVATE_KEY || '',
            sandboxMode: process.env.NODE_ENV !== 'production',
            ...config,
        };
    }

    /**
     * Генерація підпису для LiqPay
     */
    private generateSignature(data: string): string {
        const signString = this.config.privateKey + data + this.config.privateKey;
        return crypto.createHash('sha1').update(signString).digest('base64');
    }

    /**
     * Кодування даних в base64
     */
    private encodeData(data: object): string {
        return Buffer.from(JSON.stringify(data)).toString('base64');
    }

    /**
     * Декодування даних з base64
     */
    private decodeData(data: string): object {
        return JSON.parse(Buffer.from(data, 'base64').toString('utf-8'));
    }

    /**
     * Створення платежу (генерація форми)
     */
    createPayment(paymentData: LiqPayPaymentData): LiqPayCheckoutParams {
        const data = {
            public_key: this.config.publicKey,
            version: '3',
            action: 'pay',
            amount: paymentData.amount,
            currency: paymentData.currency,
            description: paymentData.description,
            order_id: paymentData.orderId,
            sandbox: this.config.sandboxMode ? '1' : '0',
            result_url: paymentData.resultUrl || process.env.NEXT_PUBLIC_SITE_URL + '/checkout/result',
            server_url: paymentData.serverUrl || process.env.NEXT_PUBLIC_SITE_URL + '/api/payments/liqpay/callback',
            language: paymentData.language || 'uk',
            ...(paymentData.customerEmail && { sender_email: paymentData.customerEmail }),
            ...(paymentData.customerPhone && { sender_phone: paymentData.customerPhone }),
        };

        const encodedData = this.encodeData(data);
        const signature = this.generateSignature(encodedData);

        return {
            data: encodedData,
            signature,
        };
    }

    /**
     * Створення платежу з утриманням (hold)
     */
    createHoldPayment(paymentData: LiqPayPaymentData): LiqPayCheckoutParams {
        const data = {
            public_key: this.config.publicKey,
            version: '3',
            action: 'hold',
            amount: paymentData.amount,
            currency: paymentData.currency,
            description: paymentData.description,
            order_id: paymentData.orderId,
            sandbox: this.config.sandboxMode ? '1' : '0',
            result_url: paymentData.resultUrl || process.env.NEXT_PUBLIC_SITE_URL + '/checkout/result',
            server_url: paymentData.serverUrl || process.env.NEXT_PUBLIC_SITE_URL + '/api/payments/liqpay/callback',
            language: paymentData.language || 'uk',
        };

        const encodedData = this.encodeData(data);
        const signature = this.generateSignature(encodedData);

        return {
            data: encodedData,
            signature,
        };
    }

    /**
     * Підтвердження утримання (hold -> complete)
     */
    async confirmHold(orderId: string, amount: number): Promise<LiqPayPaymentResponse> {
        const data = {
            public_key: this.config.publicKey,
            version: '3',
            action: 'hold_completion',
            order_id: orderId,
            amount,
        };

        return this.sendRequest(data);
    }

    /**
     * Скасування утримання
     */
    async cancelHold(orderId: string): Promise<LiqPayPaymentResponse> {
        const data = {
            public_key: this.config.publicKey,
            version: '3',
            action: 'refund',
            order_id: orderId,
        };

        return this.sendRequest(data);
    }

    /**
     * Повернення коштів
     */
    async refund(request: LiqPayRefundRequest): Promise<LiqPayPaymentResponse> {
        const data = {
            public_key: this.config.publicKey,
            version: '3',
            action: 'refund',
            order_id: request.orderId,
            amount: request.amount,
            ...(request.description && { description: request.description }),
        };

        return this.sendRequest(data);
    }

    /**
     * Перевірка статусу платежу
     */
    async getPaymentStatus(orderId: string): Promise<LiqPayPaymentResponse> {
        const data = {
            public_key: this.config.publicKey,
            version: '3',
            action: 'status',
            order_id: orderId,
        };

        return this.sendRequest(data);
    }

    /**
     * Відправка запиту до LiqPay API
     */
    private async sendRequest(data: object): Promise<LiqPayPaymentResponse> {
        const encodedData = this.encodeData(data);
        const signature = this.generateSignature(encodedData);

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    data: encodedData,
                    signature,
                }),
            });

            const result = await response.json();

            return this.mapResponse(result);
        } catch (error) {
            paymentLogger.error('LiqPay API error', error);
            throw new Error('Failed to communicate with LiqPay');
        }
    }

    /**
     * Верифікація callback від LiqPay
     */
    verifyCallback(data: string, signature: string): boolean {
        const expectedSignature = this.generateSignature(data);
        return signature === expectedSignature;
    }

    /**
     * Парсинг callback даних
     */
    parseCallback(data: string): LiqPayPaymentResponse {
        const decoded = this.decodeData(data) as Record<string, unknown>;
        return this.mapResponse(decoded);
    }

    /**
     * Маппінг відповіді від LiqPay
     */
    private mapResponse(data: Record<string, unknown>): LiqPayPaymentResponse {
        return {
            paymentId: data.payment_id as string,
            status: data.status as LiqPayStatus,
            amount: data.amount as number,
            currency: data.currency as string,
            orderId: data.order_id as string,
            description: data.description as string,
            senderPhone: data.sender_phone as string | undefined,
            transactionId: data.transaction_id as string | undefined,
            errorCode: data.err_code as string | undefined,
            errorDescription: data.err_description as string | undefined,
            createDate: data.create_date as string | undefined,
            endDate: data.end_date as string | undefined,
        };
    }

    /**
     * Генерація HTML форми для оплати
     */
    generatePaymentForm(paymentData: LiqPayPaymentData): string {
        const { data, signature } = this.createPayment(paymentData);

        return `
            <form method="POST" action="${this.checkoutUrl}" accept-charset="utf-8">
                <input type="hidden" name="data" value="${data}" />
                <input type="hidden" name="signature" value="${signature}" />
                <button type="submit" class="liqpay-button">
                    <img src="//static.liqpay.ua/buttons/logo-small.png" alt="LiqPay" />
                    Оплатити
                </button>
            </form>
        `;
    }

    /**
     * Отримання URL для редіректу на оплату
     */
    getCheckoutUrl(paymentData: LiqPayPaymentData): string {
        const { data, signature } = this.createPayment(paymentData);
        return `${this.checkoutUrl}?data=${encodeURIComponent(data)}&signature=${encodeURIComponent(signature)}`;
    }

    /**
     * Перевірка чи платіж успішний
     */
    isPaymentSuccessful(status: LiqPayStatus): boolean {
        return ['success', 'sandbox'].includes(status);
    }

    /**
     * Перевірка чи платіж в обробці
     */
    isPaymentPending(status: LiqPayStatus): boolean {
        return ['processing', 'wait_accept', 'wait_secure', 'hold_wait', 'cash_wait'].includes(status);
    }

    /**
     * Перевірка чи платіж невдалий
     */
    isPaymentFailed(status: LiqPayStatus): boolean {
        return ['failure', 'error'].includes(status);
    }
}

// Singleton instance
export const liqpay = new LiqPayService();

// React hook
export function useLiqPay() {
    return liqpay;
}
