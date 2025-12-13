/**
 * Profile Notifications Settings Page Tests
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Mock next/link
jest.mock('next/link', () => {
    const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
        <a href={href}>{children}</a>
    );
    MockLink.displayName = 'MockLink';
    return MockLink;
});

// Mock the notification service
jest.mock('@/lib/notifications/push-service', () => ({
    notificationService: {
        getPreferences: jest.fn(() => ({
            orderStatus: { email: true, push: true, sms: false },
            priceDrop: { email: false, push: true, sms: false },
            backInStock: { email: false, push: true, sms: false },
            promotion: { email: true, push: true, sms: false },
            quietHours: { enabled: false, start: '22:00', end: '08:00' },
        })),
        isPushEnabled: jest.fn(() => Promise.resolve(false)),
        updateChannelPreferences: jest.fn(() => Promise.resolve()),
        updateQuietHours: jest.fn(() => Promise.resolve()),
        requestPushPermission: jest.fn(() => Promise.resolve('granted')),
        subscribeToPush: jest.fn(() => Promise.resolve(true)),
        unsubscribeFromPush: jest.fn(() => Promise.resolve(true)),
    },
}));

// Mock push-notifications
jest.mock('@/lib/notifications/push-notifications', () => ({
    pushNotifications: {
        isSupported: jest.fn(() => true),
    },
}));

import NotificationsPage from '@/app/profile/notifications/page';

describe('NotificationsPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders page header', async () => {
        render(<NotificationsPage />);

        expect(screen.getByRole('heading', { level: 1, name: 'Налаштування сповіщень' })).toBeInTheDocument();
    });

    it('renders breadcrumb navigation', async () => {
        render(<NotificationsPage />);

        expect(screen.getByText('Головна')).toBeInTheDocument();
        expect(screen.getByText('Профіль')).toBeInTheDocument();
    });

    it('displays notification categories after loading', async () => {
        render(<NotificationsPage />);

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.getByText('Налаштування за категоріями')).toBeInTheDocument();
        });

        // Check all categories are displayed
        expect(screen.getByText('Статус замовлення')).toBeInTheDocument();
        expect(screen.getByText('Зниження ціни')).toBeInTheDocument();
        expect(screen.getByText('Товар в наявності')).toBeInTheDocument();
        expect(screen.getByText('Акції та знижки')).toBeInTheDocument();
    });

    it('displays push notifications toggle', async () => {
        render(<NotificationsPage />);

        await waitFor(() => {
            expect(screen.getByText(/Отримуйте миттєві сповіщення/)).toBeInTheDocument();
        });
    });

    it('displays quiet hours section', async () => {
        render(<NotificationsPage />);

        await waitFor(() => {
            expect(screen.getByText('Режим "Не турбувати"')).toBeInTheDocument();
        });

        expect(screen.getByText(/Вимкніть сповіщення в певний час/)).toBeInTheDocument();
    });

    it('shows channel options for each category', async () => {
        render(<NotificationsPage />);

        await waitFor(() => {
            expect(screen.getByText('Налаштування за категоріями')).toBeInTheDocument();
        });

        // Email and Push toggles should be present for each category
        const emailLabels = screen.getAllByText('Email');
        const pushLabels = screen.getAllByText('Push-сповіщення');
        const smsLabels = screen.getAllByText('SMS');

        expect(emailLabels.length).toBeGreaterThanOrEqual(4);
        expect(pushLabels.length).toBeGreaterThanOrEqual(4);
        expect(smsLabels.length).toBeGreaterThanOrEqual(4);
    });

    it('displays category descriptions', async () => {
        render(<NotificationsPage />);

        await waitFor(() => {
            expect(screen.getByText('Налаштування за категоріями')).toBeInTheDocument();
        });

        expect(screen.getByText(/Сповіщення про зміни статусу ваших замовлень/)).toBeInTheDocument();
        expect(screen.getByText(/Сповіщення про зниження цін/)).toBeInTheDocument();
        expect(screen.getByText(/Сповіщення, коли очікуваний товар/)).toBeInTheDocument();
        expect(screen.getByText(/Сповіщення про нові акції/)).toBeInTheDocument();
    });
});
