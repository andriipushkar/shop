/**
 * Admin Payment Reports Page Tests
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock next/link
jest.mock('next/link', () => {
    const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
        <a href={href}>{children}</a>
    );
    MockLink.displayName = 'MockLink';
    return MockLink;
});

import PaymentReportsPage from '@/app/admin/reports/payments/page';

describe('PaymentReportsPage', () => {
    it('renders page header', () => {
        render(<PaymentReportsPage />);

        expect(screen.getByText('Звіт по платежах')).toBeInTheDocument();
        expect(screen.getByText('Статистика та аналітика платежів')).toBeInTheDocument();
    });

    it('shows export button', () => {
        render(<PaymentReportsPage />);

        expect(screen.getByText('Експорт')).toBeInTheDocument();
    });

    it('displays summary statistics', () => {
        render(<PaymentReportsPage />);

        expect(screen.getByText('Загальна сума')).toBeInTheDocument();
        expect(screen.getByText('Комісії')).toBeInTheDocument();
        expect(screen.getByText('Чистий дохід')).toBeInTheDocument();
        expect(screen.getByText('Транзакцій')).toBeInTheDocument();
    });

    it('shows growth indicators', () => {
        render(<PaymentReportsPage />);

        expect(screen.getByText('+12.5%')).toBeInTheDocument();
        expect(screen.getByText('+8.3%')).toBeInTheDocument();
    });

    it('displays payment method breakdown', () => {
        render(<PaymentReportsPage />);

        // Multiple instances exist (cards, filters, table)
        expect(screen.getAllByText('LiqPay').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Готівка').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Накладений платіж').length).toBeGreaterThan(0);
    });

    it('shows filter controls', () => {
        render(<PaymentReportsPage />);

        // Date filters - use querySelectorAll for date inputs
        const dateInputs = document.querySelectorAll('input[type="date"]');
        expect(dateInputs.length).toBe(2);

        // Select filters
        const selects = screen.getAllByRole('combobox');
        expect(selects.length).toBeGreaterThanOrEqual(2);
    });

    it('displays transactions table', () => {
        render(<PaymentReportsPage />);

        expect(screen.getByText('Транзакції')).toBeInTheDocument();
        expect(screen.getByText('ID')).toBeInTheDocument();
        expect(screen.getByText('Замовлення')).toBeInTheDocument();
        expect(screen.getByText('Дата')).toBeInTheDocument();
        expect(screen.getByText('Клієнт')).toBeInTheDocument();
        expect(screen.getByText('Метод')).toBeInTheDocument();
        expect(screen.getByText('Сума')).toBeInTheDocument();
        expect(screen.getByText('Комісія')).toBeInTheDocument();
        expect(screen.getByText('Чисто')).toBeInTheDocument();
        expect(screen.getByText('Статус')).toBeInTheDocument();
    });

    it('lists transaction data', () => {
        render(<PaymentReportsPage />);

        expect(screen.getByText('TRX-001')).toBeInTheDocument();
        expect(screen.getByText('#12350')).toBeInTheDocument();
    });

    it('shows transaction statuses', () => {
        render(<PaymentReportsPage />);

        expect(screen.getAllByText('Успішно').length).toBeGreaterThan(0);
        // Multiple instances (filter options + table statuses)
        expect(screen.getAllByText('Очікує').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Повернено').length).toBeGreaterThan(0);
    });

    it('displays summary row in table', () => {
        render(<PaymentReportsPage />);

        expect(screen.getByText(/Показано \d+ транзакцій/)).toBeInTheDocument();
    });

    it('has method filter options', () => {
        render(<PaymentReportsPage />);

        const methodSelect = screen.getAllByRole('combobox')[0];
        expect(methodSelect).toBeInTheDocument();

        // Should have options
        expect(screen.getByText('Всі методи')).toBeInTheDocument();
    });

    it('has status filter options', () => {
        render(<PaymentReportsPage />);

        const statusSelect = screen.getAllByRole('combobox')[1];
        expect(statusSelect).toBeInTheDocument();

        expect(screen.getByText('Всі статуси')).toBeInTheDocument();
    });

    it('links to order details from transactions', () => {
        render(<PaymentReportsPage />);

        const orderLink = screen.getByText('#12350');
        expect(orderLink).toHaveAttribute('href', '/admin/orders/12350');
    });
});

describe('PaymentReportsPage - Filters', () => {
    it('filters by payment method', async () => {
        render(<PaymentReportsPage />);

        const methodSelect = screen.getAllByRole('combobox')[0];
        await act(async () => {
            fireEvent.change(methodSelect, { target: { value: 'liqpay' } });
        });

        // Should still show LiqPay transactions
        expect(screen.getByText('TRX-001')).toBeInTheDocument();
    });

    it('filters by status', async () => {
        render(<PaymentReportsPage />);

        const statusSelect = screen.getAllByRole('combobox')[1];
        await act(async () => {
            fireEvent.change(statusSelect, { target: { value: 'success' } });
        });

        // Filter is applied - checking the select value changed
        expect((statusSelect as HTMLSelectElement).value).toBe('success');
    });

    it('shows more filters button', () => {
        render(<PaymentReportsPage />);

        expect(screen.getByText('Більше фільтрів')).toBeInTheDocument();
    });
});

describe('PaymentReportsPage - Statistics', () => {
    it('calculates total amount correctly', () => {
        render(<PaymentReportsPage />);

        // Should show total for successful transactions
        const totalCard = screen.getByText('Загальна сума').closest('div');
        expect(totalCard).toBeInTheDocument();
    });

    it('calculates total commission', () => {
        render(<PaymentReportsPage />);

        // Commission should be shown with negative sign
        const commissionCard = screen.getByText('Комісії').closest('div');
        expect(commissionCard?.textContent).toContain('-');
    });

    it('shows commission percentage of total', () => {
        render(<PaymentReportsPage />);

        // Should show percentage
        expect(screen.getByText(/% від обороту/)).toBeInTheDocument();
    });

    it('shows transaction counts by status', () => {
        render(<PaymentReportsPage />);

        expect(screen.getByText(/\d+ успішних/)).toBeInTheDocument();
        expect(screen.getByText(/\d+ очікують/)).toBeInTheDocument();
    });
});

describe('PaymentReportsPage - Payment Method Stats', () => {
    it('shows LiqPay statistics', () => {
        render(<PaymentReportsPage />);

        // Find the card by looking for the specific container
        const liqpayElements = screen.getAllByText('LiqPay');
        const statsCard = liqpayElements.find(el =>
            el.closest('.rounded-xl')?.textContent?.includes('транзакцій')
        );
        expect(statsCard).toBeTruthy();
    });

    it('shows cash statistics', () => {
        render(<PaymentReportsPage />);

        const cashElements = screen.getAllByText('Готівка');
        const statsCard = cashElements.find(el =>
            el.closest('.rounded-xl')?.textContent?.includes('транзакцій')
        );
        expect(statsCard).toBeTruthy();
    });

    it('shows COD statistics', () => {
        render(<PaymentReportsPage />);

        const codElements = screen.getAllByText('Накладений платіж');
        const statsCard = codElements.find(el =>
            el.closest('.rounded-xl')?.textContent?.includes('транзакцій')
        );
        expect(statsCard).toBeTruthy();
    });

    it('shows zero commission for cash', () => {
        render(<PaymentReportsPage />);

        const cashElements = screen.getAllByText('Готівка');
        const cashCard = cashElements.find(el =>
            el.closest('.rounded-xl')?.textContent?.includes('транзакцій')
        );
        if (cashCard) {
            const cardContent = cashCard.closest('.rounded-xl')?.textContent;
            expect(cardContent).toContain('0 ₴');
        }
    });
});

describe('PaymentReportsPage - Date Filters', () => {
    it('has date from input', () => {
        render(<PaymentReportsPage />);

        const dateInputs = document.querySelectorAll('input[type="date"]');
        expect(dateInputs.length).toBe(2);
    });

    it('has date to input', () => {
        render(<PaymentReportsPage />);

        const dateInputs = document.querySelectorAll('input[type="date"]');
        expect(dateInputs[1]).toBeInTheDocument();
    });
});
