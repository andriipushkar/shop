/**
 * Unified Payments Service
 * Уніфікований сервіс платежів
 */

export * from './liqpay';
export * from './monobank';

import { liqpay, LiqPayPaymentData, LiqPayPaymentResponse, LiqPayStatus } from './liqpay';
import { monobank, MonobankInvoiceResponse, MonobankInvoiceStatus, MonobankPaymentStatus } from './monobank';

export type PaymentProvider = 'liqpay' | 'monobank';

export interface PaymentRequest {
    provider: PaymentProvider;
    orderId: string;
    amount: number;
    currency?: 'UAH' | 'USD' | 'EUR';
    description?: string;
    customerEmail?: string;
    customerPhone?: string;
    items?: Array<{
        name: string;
        quantity: number;
        price: number;
    }>;
    paymentType?: 'pay' | 'hold';
}

export interface PaymentResult {
    provider: PaymentProvider;
    success: boolean;
    paymentUrl?: string;
    paymentId?: string;
    error?: string;
}

export interface PaymentStatus {
    provider: PaymentProvider;
    orderId: string;
    status: 'pending' | 'success' | 'failed' | 'hold' | 'refunded';
    amount: number;
    paidAt?: string;
    transactionId?: string;
    rawStatus: string;
}

export interface RefundRequest {
    provider: PaymentProvider;
    orderId: string;
    paymentId?: string;
    amount?: number;
    reason?: string;
}

export interface RefundResult {
    provider: PaymentProvider;
    success: boolean;
    refundId?: string;
    error?: string;
}

class PaymentsService {
    /**
     * Створення платежу
     */
    async createPayment(request: PaymentRequest): Promise<PaymentResult> {
        try {
            switch (request.provider) {
                case 'liqpay':
                    return await this.createLiqPayPayment(request);
                case 'monobank':
                    return await this.createMonobankPayment(request);
                default:
                    return {
                        provider: request.provider,
                        success: false,
                        error: 'Unknown payment provider',
                    };
            }
        } catch (error) {
            return {
                provider: request.provider,
                success: false,
                error: error instanceof Error ? error.message : 'Payment creation failed',
            };
        }
    }

    /**
     * Створення LiqPay платежу
     */
    private async createLiqPayPayment(request: PaymentRequest): Promise<PaymentResult> {
        const paymentData: LiqPayPaymentData = {
            orderId: request.orderId,
            amount: request.amount,
            currency: request.currency || 'UAH',
            description: request.description || `Оплата замовлення #${request.orderId}`,
            customerEmail: request.customerEmail,
            customerPhone: request.customerPhone,
        };

        const paymentUrl = liqpay.getCheckoutUrl(paymentData);

        return {
            provider: 'liqpay',
            success: true,
            paymentUrl,
            paymentId: request.orderId,
        };
    }

    /**
     * Створення Monobank платежу
     */
    private async createMonobankPayment(request: PaymentRequest): Promise<PaymentResult> {
        const items = request.items || [
            {
                name: `Замовлення #${request.orderId}`,
                quantity: 1,
                price: request.amount,
            },
        ];

        const invoice: MonobankInvoiceResponse = await monobank.createOrderInvoice(
            request.orderId,
            request.amount,
            items,
            request.customerEmail
        );

        return {
            provider: 'monobank',
            success: true,
            paymentUrl: invoice.pageUrl,
            paymentId: invoice.invoiceId,
        };
    }

    /**
     * Перевірка статусу платежу
     */
    async getPaymentStatus(provider: PaymentProvider, orderId: string, paymentId?: string): Promise<PaymentStatus> {
        switch (provider) {
            case 'liqpay':
                return await this.getLiqPayStatus(orderId);
            case 'monobank':
                if (!paymentId) throw new Error('Payment ID required for Monobank');
                return await this.getMonobankStatus(orderId, paymentId);
            default:
                throw new Error('Unknown payment provider');
        }
    }

    /**
     * Отримання статусу LiqPay
     */
    private async getLiqPayStatus(orderId: string): Promise<PaymentStatus> {
        const response: LiqPayPaymentResponse = await liqpay.getPaymentStatus(orderId);

        return {
            provider: 'liqpay',
            orderId,
            status: this.mapLiqPayStatus(response.status),
            amount: response.amount,
            paidAt: response.endDate,
            transactionId: response.transactionId,
            rawStatus: response.status,
        };
    }

    /**
     * Отримання статусу Monobank
     */
    private async getMonobankStatus(orderId: string, invoiceId: string): Promise<PaymentStatus> {
        const response: MonobankInvoiceStatus = await monobank.getInvoiceStatus(invoiceId);

        return {
            provider: 'monobank',
            orderId,
            status: this.mapMonobankStatus(response.status),
            amount: monobank.fromKopecks(response.finalAmount || response.amount),
            paidAt: response.modifiedDate,
            transactionId: response.invoiceId,
            rawStatus: response.status,
        };
    }

    /**
     * Повернення коштів
     */
    async refund(request: RefundRequest): Promise<RefundResult> {
        try {
            switch (request.provider) {
                case 'liqpay':
                    return await this.refundLiqPay(request);
                case 'monobank':
                    return await this.refundMonobank(request);
                default:
                    return {
                        provider: request.provider,
                        success: false,
                        error: 'Unknown payment provider',
                    };
            }
        } catch (error) {
            return {
                provider: request.provider,
                success: false,
                error: error instanceof Error ? error.message : 'Refund failed',
            };
        }
    }

    /**
     * Повернення LiqPay
     */
    private async refundLiqPay(request: RefundRequest): Promise<RefundResult> {
        const response = await liqpay.refund({
            orderId: request.orderId,
            amount: request.amount || 0,
            description: request.reason,
        });

        return {
            provider: 'liqpay',
            success: liqpay.isPaymentSuccessful(response.status) || response.status === 'reversed',
            refundId: response.paymentId,
            error: response.errorDescription,
        };
    }

    /**
     * Повернення Monobank
     */
    private async refundMonobank(request: RefundRequest): Promise<RefundResult> {
        if (!request.paymentId) {
            return {
                provider: 'monobank',
                success: false,
                error: 'Payment ID required',
            };
        }

        const response = await monobank.cancelInvoice({
            invoiceId: request.paymentId,
            amount: request.amount ? monobank.toKopecks(request.amount) : undefined,
        });

        return {
            provider: 'monobank',
            success: response.status === 'success',
            refundId: response.rrn,
        };
    }

    /**
     * Маппінг статусів LiqPay
     */
    private mapLiqPayStatus(status: LiqPayStatus): PaymentStatus['status'] {
        if (liqpay.isPaymentSuccessful(status)) return 'success';
        if (liqpay.isPaymentPending(status)) return 'pending';
        if (status === 'hold_wait') return 'hold';
        if (status === 'reversed' || status === 'refund_wait') return 'refunded';
        return 'failed';
    }

    /**
     * Маппінг статусів Monobank
     */
    private mapMonobankStatus(status: MonobankPaymentStatus): PaymentStatus['status'] {
        if (monobank.isPaymentSuccessful(status)) return 'success';
        if (monobank.isPaymentPending(status)) return 'pending';
        if (status === 'hold') return 'hold';
        if (status === 'reversed') return 'refunded';
        return 'failed';
    }

    /**
     * Отримання доступних провайдерів
     */
    getAvailableProviders(): PaymentProvider[] {
        const providers: PaymentProvider[] = [];

        if (process.env.LIQPAY_PUBLIC_KEY && process.env.LIQPAY_PRIVATE_KEY) {
            providers.push('liqpay');
        }

        if (process.env.MONOBANK_TOKEN) {
            providers.push('monobank');
        }

        return providers;
    }

    /**
     * Інформація про провайдера
     */
    getProviderInfo(provider: PaymentProvider): {
        name: string;
        logo: string;
        description: string;
        supportedCurrencies: string[];
    } {
        switch (provider) {
            case 'liqpay':
                return {
                    name: 'LiqPay',
                    logo: '/images/payments/liqpay.svg',
                    description: 'Оплата карткою Visa/MasterCard',
                    supportedCurrencies: ['UAH', 'USD', 'EUR'],
                };
            case 'monobank':
                return {
                    name: 'Monobank',
                    logo: '/images/payments/monobank.svg',
                    description: 'Оплата через Monobank',
                    supportedCurrencies: ['UAH'],
                };
            default:
                return {
                    name: 'Unknown',
                    logo: '',
                    description: '',
                    supportedCurrencies: [],
                };
        }
    }
}

// Singleton instance
export const payments = new PaymentsService();

// React hook
export function usePayments() {
    return payments;
}
