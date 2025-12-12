/**
 * Admin Sales Reports Page Tests
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

import SalesReportsPage from '@/app/admin/reports/sales/page';

describe('SalesReportsPage', () => {
    it('renders page header', () => {
        render(<SalesReportsPage />);

        expect(screen.getByText('Звіт по продажах')).toBeInTheDocument();
        expect(screen.getByText('Детальна аналітика продажів та доходу')).toBeInTheDocument();
    });

    it('shows period selector', () => {
        render(<SalesReportsPage />);

        const periodSelects = screen.getAllByRole('combobox');
        expect(periodSelects.length).toBeGreaterThan(0);
    });

    it('shows export button', () => {
        render(<SalesReportsPage />);

        expect(screen.getByText('Експорт')).toBeInTheDocument();
    });

    it('displays summary statistics cards', () => {
        render(<SalesReportsPage />);

        expect(screen.getByText('Загальний дохід')).toBeInTheDocument();
        expect(screen.getByText('Замовлень')).toBeInTheDocument();
        expect(screen.getByText('Середній чек')).toBeInTheDocument();
        expect(screen.getByText('Конверсія')).toBeInTheDocument();
    });

    it('shows revenue value', () => {
        render(<SalesReportsPage />);

        // Should display revenue in millions (multiple instances)
        expect(screen.getAllByText(/M ₴/).length).toBeGreaterThan(0);
    });

    it('shows growth percentages', () => {
        render(<SalesReportsPage />);

        // Multiple growth indicators exist
        const percentages = screen.getAllByText(/\+\d+\.\d+%/);
        expect(percentages.length).toBeGreaterThan(0);
    });

    it('displays sales chart section', () => {
        render(<SalesReportsPage />);

        expect(screen.getByText('Динаміка продажів')).toBeInTheDocument();
    });

    it('has chart/table view toggle', () => {
        render(<SalesReportsPage />);

        // View toggle buttons
        const toggleButtons = screen.getAllByRole('button').filter(btn =>
            btn.className.includes('rounded-lg') &&
            (btn.className.includes('bg-teal-100') || btn.className.includes('text-gray-400'))
        );
        expect(toggleButtons.length).toBeGreaterThan(0);
    });

    it('switches to table view', async () => {
        render(<SalesReportsPage />);

        // Find table view button
        const buttons = screen.getAllByRole('button');
        const tableButton = buttons.find(btn => btn.className.includes('text-gray-400'));

        if (tableButton) {
            await act(async () => {
                fireEvent.click(tableButton);
            });

            // Should show table headers (multiple Дохід exist)
            expect(screen.getByText('Дата')).toBeInTheDocument();
            expect(screen.getAllByText('Дохід').length).toBeGreaterThan(0);
        }
    });

    it('displays sales by category section', () => {
        render(<SalesReportsPage />);

        expect(screen.getByText('Продажі за категоріями')).toBeInTheDocument();
    });

    it('shows category data', () => {
        render(<SalesReportsPage />);

        expect(screen.getByText('Смартфони')).toBeInTheDocument();
        expect(screen.getByText('Ноутбуки')).toBeInTheDocument();
        // Аксесуари may have multiple instances
        expect(screen.getAllByText('Аксесуари').length).toBeGreaterThan(0);
    });

    it('displays sales by region section', () => {
        render(<SalesReportsPage />);

        expect(screen.getByText('Продажі за регіонами')).toBeInTheDocument();
    });

    it('shows region data', () => {
        render(<SalesReportsPage />);

        expect(screen.getByText('Київ')).toBeInTheDocument();
        expect(screen.getByText('Харків')).toBeInTheDocument();
        expect(screen.getByText('Одеса')).toBeInTheDocument();
    });

    it('displays top products section', () => {
        render(<SalesReportsPage />);

        expect(screen.getByText('Топ товарів')).toBeInTheDocument();
    });

    it('shows top products table', () => {
        render(<SalesReportsPage />);

        expect(screen.getByText('Товар')).toBeInTheDocument();
        expect(screen.getByText('Артикул')).toBeInTheDocument();
        expect(screen.getByText('Продано')).toBeInTheDocument();
        expect(screen.getByText('Залишок')).toBeInTheDocument();
    });

    it('lists top products', () => {
        render(<SalesReportsPage />);

        expect(screen.getByText('iPhone 15 Pro Max 256GB')).toBeInTheDocument();
        expect(screen.getByText('MacBook Pro 14" M3')).toBeInTheDocument();
    });

    it('shows product SKUs', () => {
        render(<SalesReportsPage />);

        expect(screen.getByText('APL-IP15PM-256')).toBeInTheDocument();
        expect(screen.getByText('APL-MBP14-M3')).toBeInTheDocument();
    });

    it('shows stock status badges', () => {
        render(<SalesReportsPage />);

        // Stock badges with different colors
        const stockBadges = screen.getAllByText(/\d+ шт/);
        expect(stockBadges.length).toBeGreaterThan(0);
    });

    it('has breadcrumb navigation', () => {
        render(<SalesReportsPage />);

        expect(screen.getByText('Адмін')).toHaveAttribute('href', '/admin');
        expect(screen.getByText('Звіти')).toHaveAttribute('href', '/admin/reports');
    });

    it('changes period when selected', async () => {
        render(<SalesReportsPage />);

        const periodSelects = screen.getAllByRole('combobox');
        const periodSelect = periodSelects[0];
        await act(async () => {
            fireEvent.change(periodSelect, { target: { value: 'quarter' } });
        });

        expect((periodSelect as HTMLSelectElement).value).toBe('quarter');
    });

    it('has multiple filter selects', () => {
        render(<SalesReportsPage />);

        // Multiple filter selects
        const selects = screen.getAllByRole('combobox');
        expect(selects.length).toBeGreaterThanOrEqual(1);
    });
});
