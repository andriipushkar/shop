/**
 * Profile Notifications Settings Page Tests
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

// Mock next/link
jest.mock('next/link', () => {
    const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
        <a href={href}>{children}</a>
    );
    MockLink.displayName = 'MockLink';
    return MockLink;
});

import NotificationsPage from '@/app/profile/notifications/page';

describe('NotificationsPage', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('renders page header', () => {
        render(<NotificationsPage />);

        expect(screen.getByText('Налаштування сповіщень')).toBeInTheDocument();
        expect(screen.getByText(/Керуйте тим, як ми зв'язуємося з вами/)).toBeInTheDocument();
    });

    it('displays email notifications section', () => {
        render(<NotificationsPage />);

        expect(screen.getByText('Email-сповіщення')).toBeInTheDocument();
        expect(screen.getByText('Сповіщення на електронну пошту')).toBeInTheDocument();
    });

    it('displays SMS notifications section', () => {
        render(<NotificationsPage />);

        expect(screen.getByText('SMS-сповіщення')).toBeInTheDocument();
        expect(screen.getByText('Сповіщення на телефон')).toBeInTheDocument();
    });

    it('displays push notifications section', () => {
        render(<NotificationsPage />);

        expect(screen.getByText('Push-сповіщення')).toBeInTheDocument();
        expect(screen.getByText('Сповіщення в браузері')).toBeInTheDocument();
    });

    it('shows email notification options', () => {
        render(<NotificationsPage />);

        // All email notification types should be present
        const orderConfirmations = screen.getAllByText('Підтвердження замовлення');
        expect(orderConfirmations.length).toBeGreaterThan(0);

        const shippingUpdates = screen.getAllByText('Оновлення доставки');
        expect(shippingUpdates.length).toBeGreaterThan(0);
    });

    it('shows SMS notification options', () => {
        render(<NotificationsPage />);

        expect(screen.getByText('SMS з номером замовлення')).toBeInTheDocument();
        expect(screen.getByText('SMS з номером ТТН')).toBeInTheDocument();
    });

    it('shows push notification options', () => {
        render(<NotificationsPage />);

        expect(screen.getByText('Оновлення замовлень')).toBeInTheDocument();
        expect(screen.getByText('Зниження цін')).toBeInTheDocument();
    });

    it('shows phone verification status', () => {
        render(<NotificationsPage />);

        expect(screen.getByText('Телефон підтверджено')).toBeInTheDocument();
    });

    it('shows SMS warning about charges', () => {
        render(<NotificationsPage />);

        expect(screen.getByText(/SMS-сповіщення можуть тарифікуватися/)).toBeInTheDocument();
    });

    it('has toggle buttons for each setting', () => {
        render(<NotificationsPage />);

        // Toggle buttons have specific classes
        const toggleButtons = screen.getAllByRole('button').filter(btn =>
            btn.className.includes('rounded-full') && btn.className.includes('inline-flex')
        );

        // Should have multiple toggles (email: 5, sms: 4, push: 3 = 12 total)
        expect(toggleButtons.length).toBeGreaterThanOrEqual(10);
    });

    it('toggles notification setting when clicked', async () => {
        render(<NotificationsPage />);

        // Find toggle buttons
        const getToggleButtons = () => screen.getAllByRole('button').filter(btn =>
            btn.className.includes('rounded-full') && btn.className.includes('inline-flex')
        );

        const toggleButtons = getToggleButtons();
        expect(toggleButtons.length).toBeGreaterThan(0);

        // Count toggles with each class before click
        const enabledCountBefore = getToggleButtons().filter(btn => btn.className.includes('bg-teal-600')).length;

        // Click a disabled toggle to enable it
        const disabledToggle = toggleButtons.find(btn => btn.className.includes('bg-gray-200'));
        if (disabledToggle) {
            await act(async () => {
                fireEvent.click(disabledToggle);
            });

            // After click, there should be one more enabled toggle
            const enabledCountAfter = getToggleButtons().filter(btn => btn.className.includes('bg-teal-600')).length;
            expect(enabledCountAfter).toBe(enabledCountBefore + 1);
        }
    });

    it('has save changes button', () => {
        render(<NotificationsPage />);

        expect(screen.getByText('Зберегти зміни')).toBeInTheDocument();
    });

    it('shows loading state when saving', async () => {
        render(<NotificationsPage />);

        const saveButton = screen.getByText('Зберегти зміни');
        await act(async () => {
            fireEvent.click(saveButton);
        });

        expect(screen.getByText('Збереження...')).toBeInTheDocument();
    });

    it('shows success message after saving', async () => {
        render(<NotificationsPage />);

        const saveButton = screen.getByText('Зберегти зміни');
        await act(async () => {
            fireEvent.click(saveButton);
        });

        // Wait for save to complete
        await act(async () => {
            jest.advanceTimersByTime(1100);
        });

        expect(screen.getByText('Налаштування збережено')).toBeInTheDocument();
    });

    it('has breadcrumb navigation', () => {
        render(<NotificationsPage />);

        expect(screen.getByText('Головна')).toHaveAttribute('href', '/');
        expect(screen.getByText('Профіль')).toHaveAttribute('href', '/profile');
    });

    it('shows promotional email option', () => {
        render(<NotificationsPage />);

        const promoOptions = screen.getAllByText('Акції та знижки');
        expect(promoOptions.length).toBeGreaterThan(0);
    });

    it('shows newsletter option', () => {
        render(<NotificationsPage />);

        expect(screen.getByText('Розсилка новин')).toBeInTheDocument();
    });
});
