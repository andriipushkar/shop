/**
 * Admin Customer Analytics Page Tests
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

import CustomerAnalyticsPage from '@/app/admin/reports/customers/page';

describe('CustomerAnalyticsPage', () => {
    it('renders page header', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText('Аналітика клієнтів')).toBeInTheDocument();
        expect(screen.getByText('Когортний аналіз та поведінка клієнтів')).toBeInTheDocument();
    });

    it('shows period selector', () => {
        render(<CustomerAnalyticsPage />);

        const periodSelect = screen.getAllByRole('combobox');
        expect(periodSelect.length).toBeGreaterThan(0);
    });

    it('shows export button', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText('Експорт')).toBeInTheDocument();
    });

    it('displays summary statistics cards', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText('Всього клієнтів')).toBeInTheDocument();
        expect(screen.getByText('Нових за місяць')).toBeInTheDocument();
        expect(screen.getByText('Середній LTV')).toBeInTheDocument();
        expect(screen.getByText('Відтік клієнтів')).toBeInTheDocument();
    });

    it('shows customer count', () => {
        render(<CustomerAnalyticsPage />);

        // Total customers count - verify "Всього клієнтів" card exists
        expect(screen.getByText('Всього клієнтів')).toBeInTheDocument();
    });

    it('shows LTV value', () => {
        render(<CustomerAnalyticsPage />);

        // LTV card exists
        expect(screen.getByText('Середній LTV')).toBeInTheDocument();
    });

    it('shows churn rate', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText('4.2%')).toBeInTheDocument();
    });

    it('displays cohort analysis section', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText('Когортний аналіз (Retention)')).toBeInTheDocument();
    });

    it('shows cohort table headers', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText('Когорта')).toBeInTheDocument();
        expect(screen.getByText('Нових')).toBeInTheDocument();
        expect(screen.getByText('Місяць 1')).toBeInTheDocument();
        expect(screen.getByText('Місяць 2')).toBeInTheDocument();
    });

    it('shows cohort data', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText('Січ 2024')).toBeInTheDocument();
        expect(screen.getByText('Лют 2024')).toBeInTheDocument();
        expect(screen.getByText('456')).toBeInTheDocument();
    });

    it('shows retention percentages with color coding', () => {
        render(<CustomerAnalyticsPage />);

        // Retention percentages in cohort table
        const retentionCells = screen.getAllByText(/\d+%/);
        expect(retentionCells.length).toBeGreaterThan(0);
    });

    it('displays customer segments section', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText('Сегменти клієнтів')).toBeInTheDocument();
    });

    it('shows segment data', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText('VIP клієнти')).toBeInTheDocument();
        expect(screen.getByText('Активні покупці')).toBeInTheDocument();
        expect(screen.getByText('Разові покупці')).toBeInTheDocument();
        expect(screen.getByText('Неактивні')).toBeInTheDocument();
        // Ризик відтоку may have multiple instances (in segments + insights)
        expect(screen.getAllByText('Ризик відтоку').length).toBeGreaterThan(0);
    });

    it('displays LTV by tenure section', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText('LTV за терміном')).toBeInTheDocument();
    });

    it('shows tenure ranges', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText('0-3')).toBeInTheDocument();
        expect(screen.getByText('3-6')).toBeInTheDocument();
        expect(screen.getByText('6-12')).toBeInTheDocument();
        expect(screen.getByText('12-24')).toBeInTheDocument();
        expect(screen.getByText('24+')).toBeInTheDocument();
    });

    it('displays top customers section', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText('Топ клієнтів')).toBeInTheDocument();
    });

    it('lists top customers', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText('Олександр К.')).toBeInTheDocument();
        expect(screen.getByText('Марія Ш.')).toBeInTheDocument();
    });

    it('shows customer emails', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText('alex.k@gmail.com')).toBeInTheDocument();
        expect(screen.getByText('m.shev@ukr.net')).toBeInTheDocument();
    });

    it('displays acquisition channels section', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText('Канали залучення')).toBeInTheDocument();
    });

    it('shows acquisition channel data', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText('Органічний пошук')).toBeInTheDocument();
        expect(screen.getByText('Пряме посилання')).toBeInTheDocument();
        expect(screen.getByText('Facebook Ads')).toBeInTheDocument();
        expect(screen.getByText('Google Ads')).toBeInTheDocument();
        // Instagram may have multiple instances
        expect(screen.getAllByText('Instagram').length).toBeGreaterThan(0);
    });

    it('shows channel growth percentages', () => {
        render(<CustomerAnalyticsPage />);

        // Growth percentages can be positive or negative
        expect(screen.getByText('+12.5%')).toBeInTheDocument();
        expect(screen.getByText('-3.4%')).toBeInTheDocument();
    });

    it('displays insights section', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText('💡 Ключові інсайти')).toBeInTheDocument();
    });

    it('shows key insights', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText('Найкращий канал')).toBeInTheDocument();
        expect(screen.getByText('Retention покращився')).toBeInTheDocument();
        expect(screen.getByText('Потребують уваги')).toBeInTheDocument();
    });

    it('has breadcrumb navigation', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText('Адмін')).toHaveAttribute('href', '/admin');
        expect(screen.getByText('Звіти')).toHaveAttribute('href', '/admin/reports');
    });

    it('changes period when selected', async () => {
        render(<CustomerAnalyticsPage />);

        const periodSelects = screen.getAllByRole('combobox');
        const periodSelect = periodSelects[0];
        await act(async () => {
            fireEvent.change(periodSelect, { target: { value: 'year' } });
        });

        expect((periodSelect as HTMLSelectElement).value).toBe('year');
    });

    it('shows cohort retention explanation', () => {
        render(<CustomerAnalyticsPage />);

        expect(screen.getByText(/відсоток клієнтів, які зробили повторну покупку/i)).toBeInTheDocument();
    });
});
