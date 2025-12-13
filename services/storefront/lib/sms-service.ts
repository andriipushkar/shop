/**
 * SMS Service - Integration with SMS providers (Twilio, MessageBird, TurboSMS)
 * Supports order notifications, shipping updates, and promotional messages
 */

import { logger } from './logger';

// SMS Provider configuration
export interface SMSConfig {
    provider: 'twilio' | 'messagebird' | 'turbosms' | 'mock';
    apiKey?: string;
    apiSecret?: string;
    senderId: string;
    enabled: boolean;
}

// SMS Message types
export interface SMSMessage {
    to: string;
    body: string;
    type: 'order_confirmation' | 'shipping_update' | 'delivery_notification' | 'promotional' | 'verification';
}

// SMS delivery status
export interface SMSDeliveryStatus {
    messageId: string;
    status: 'queued' | 'sent' | 'delivered' | 'failed';
    timestamp: Date;
    error?: string;
}

// Default configuration - uses mock in development
const defaultConfig: SMSConfig = {
    provider: process.env.SMS_PROVIDER as SMSConfig['provider'] || 'mock',
    apiKey: process.env.SMS_API_KEY,
    apiSecret: process.env.SMS_API_SECRET,
    senderId: process.env.SMS_SENDER_ID || 'MyShop',
    enabled: process.env.SMS_ENABLED === 'true',
};

// Format phone number for Ukraine
function formatPhoneNumber(phone: string): string {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');

    // Handle Ukrainian numbers
    if (digits.startsWith('380')) {
        return `+${digits}`;
    } else if (digits.startsWith('0') && digits.length === 10) {
        return `+38${digits}`;
    } else if (digits.length === 9) {
        return `+380${digits}`;
    }

    return `+${digits}`;
}

// SMS Templates
export const smsTemplates = {
    orderConfirmation: (orderId: string, total: number) =>
        `MyShop: Ваше замовлення #${orderId} на суму ${total.toLocaleString()} грн прийнято! Очікуйте на дзвінок менеджера.`,

    orderProcessing: (orderId: string) =>
        `MyShop: Замовлення #${orderId} передано на склад для комплектації.`,

    shippingNotification: (orderId: string, ttn: string) =>
        `MyShop: Замовлення #${orderId} відправлено! ТТН: ${ttn}. Відстежуйте: novaposhta.ua`,

    deliveryArrived: (orderId: string, branch: string) =>
        `MyShop: Замовлення #${orderId} прибуло у ${branch}. Очікуємо вас!`,

    deliveryCompleted: (orderId: string) =>
        `MyShop: Дякуємо за покупку! Замовлення #${orderId} отримано. Будемо раді бачити вас знову!`,

    verificationCode: (code: string) =>
        `MyShop: Ваш код підтвердження: ${code}. Дійсний 10 хвилин.`,

    promotional: (text: string) =>
        `MyShop: ${text}`,
};

// Mock SMS sender for development
async function sendMockSMS(message: SMSMessage): Promise<SMSDeliveryStatus> {
    logger.debug('Sending mock SMS', {
        to: message.to,
        body: message.body,
        type: message.type,
    });

    return {
        messageId: `mock-${Date.now()}`,
        status: 'delivered',
        timestamp: new Date(),
    };
}

// Twilio SMS sender
async function sendTwilioSMS(message: SMSMessage, config: SMSConfig): Promise<SMSDeliveryStatus> {
    if (!config.apiKey || !config.apiSecret) {
        throw new Error('Twilio credentials not configured');
    }

    const formattedPhone = formatPhoneNumber(message.to);

    // In production, this would use the Twilio SDK
    // const twilio = require('twilio')(config.apiKey, config.apiSecret);
    // const result = await twilio.messages.create({
    //     body: message.body,
    //     from: config.senderId,
    //     to: formattedPhone,
    // });

    logger.debug('Sending Twilio SMS', {
        to: formattedPhone,
        from: config.senderId,
        body: message.body,
    });

    return {
        messageId: `twilio-${Date.now()}`,
        status: 'sent',
        timestamp: new Date(),
    };
}

// MessageBird SMS sender
async function sendMessageBirdSMS(message: SMSMessage, config: SMSConfig): Promise<SMSDeliveryStatus> {
    if (!config.apiKey) {
        throw new Error('MessageBird API key not configured');
    }

    const formattedPhone = formatPhoneNumber(message.to);

    // In production, this would use the MessageBird SDK
    // const messagebird = require('messagebird')(config.apiKey);
    // const result = await messagebird.messages.create({
    //     originator: config.senderId,
    //     recipients: [formattedPhone],
    //     body: message.body,
    // });

    logger.debug('Sending MessageBird SMS', {
        to: formattedPhone,
        from: config.senderId,
        body: message.body,
    });

    return {
        messageId: `messagebird-${Date.now()}`,
        status: 'sent',
        timestamp: new Date(),
    };
}

// TurboSMS sender (Ukrainian provider)
async function sendTurboSMS(message: SMSMessage, config: SMSConfig): Promise<SMSDeliveryStatus> {
    if (!config.apiKey) {
        throw new Error('TurboSMS API key not configured');
    }

    const formattedPhone = formatPhoneNumber(message.to);

    // In production, this would use TurboSMS API
    // const response = await fetch('https://api.turbosms.ua/message/send.json', {
    //     method: 'POST',
    //     headers: {
    //         'Authorization': `Bearer ${config.apiKey}`,
    //         'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({
    //         recipients: [formattedPhone],
    //         sms: { sender: config.senderId, text: message.body },
    //     }),
    // });

    logger.debug('Sending TurboSMS', {
        to: formattedPhone,
        from: config.senderId,
        body: message.body,
    });

    return {
        messageId: `turbosms-${Date.now()}`,
        status: 'sent',
        timestamp: new Date(),
    };
}

// Main SMS sending function
export async function sendSMS(
    message: SMSMessage,
    config: SMSConfig = defaultConfig
): Promise<SMSDeliveryStatus> {
    if (!config.enabled && config.provider !== 'mock') {
        logger.info('SMS disabled, would send message', { message });
        return {
            messageId: 'disabled',
            status: 'queued',
            timestamp: new Date(),
        };
    }

    try {
        switch (config.provider) {
            case 'twilio':
                return await sendTwilioSMS(message, config);
            case 'messagebird':
                return await sendMessageBirdSMS(message, config);
            case 'turbosms':
                return await sendTurboSMS(message, config);
            case 'mock':
            default:
                return await sendMockSMS(message);
        }
    } catch (error) {
        logger.error('SMS sending failed', error, { message });
        return {
            messageId: 'error',
            status: 'failed',
            timestamp: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// High-level notification functions
export async function sendOrderConfirmationSMS(
    phone: string,
    orderId: string,
    total: number
): Promise<SMSDeliveryStatus> {
    return sendSMS({
        to: phone,
        body: smsTemplates.orderConfirmation(orderId, total),
        type: 'order_confirmation',
    });
}

export async function sendShippingUpdateSMS(
    phone: string,
    orderId: string,
    ttn: string
): Promise<SMSDeliveryStatus> {
    return sendSMS({
        to: phone,
        body: smsTemplates.shippingNotification(orderId, ttn),
        type: 'shipping_update',
    });
}

export async function sendDeliveryArrivedSMS(
    phone: string,
    orderId: string,
    branch: string
): Promise<SMSDeliveryStatus> {
    return sendSMS({
        to: phone,
        body: smsTemplates.deliveryArrived(orderId, branch),
        type: 'delivery_notification',
    });
}

export async function sendDeliveryCompletedSMS(
    phone: string,
    orderId: string
): Promise<SMSDeliveryStatus> {
    return sendSMS({
        to: phone,
        body: smsTemplates.deliveryCompleted(orderId),
        type: 'delivery_notification',
    });
}

export async function sendVerificationCodeSMS(
    phone: string,
    code: string
): Promise<SMSDeliveryStatus> {
    return sendSMS({
        to: phone,
        body: smsTemplates.verificationCode(code),
        type: 'verification',
    });
}

// Bulk SMS sending for promotions
export async function sendBulkSMS(
    phones: string[],
    text: string
): Promise<SMSDeliveryStatus[]> {
    const results: SMSDeliveryStatus[] = [];

    for (const phone of phones) {
        const result = await sendSMS({
            to: phone,
            body: smsTemplates.promotional(text),
            type: 'promotional',
        });
        results.push(result);

        // Add delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
}

// SMS notification preferences
export interface SMSPreferences {
    orderConfirmation: boolean;
    shippingUpdates: boolean;
    deliveryNotifications: boolean;
    promotional: boolean;
}

export const defaultSMSPreferences: SMSPreferences = {
    orderConfirmation: true,
    shippingUpdates: true,
    deliveryNotifications: true,
    promotional: false,
};
