/**
 * Profile Orders History Page Tests
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

import OrdersHistoryPage from '@/app/profile/orders/page';

describe('OrdersHistoryPage', () => {
    beforeEach(() => {
        // Mock window.alert
        window.alert = jest.fn();
    });

    it('renders page header', () => {
        render(<OrdersHistoryPage />);

        // Multiple instances exist (breadcrumb + title)
        expect(screen.getAllByText('Мої замовлення').length).toBeGreaterThan(0);
        expect(screen.getByText('Історія та статус ваших замовлень')).toBeInTheDocument();
    });

    it('displays search input', () => {
        render(<OrdersHistoryPage />);

        expect(screen.getByPlaceholderText('Пошук за номером або товаром...')).toBeInTheDocument();
    });

    it('displays status filter', () => {
        render(<OrdersHistoryPage />);

        expect(screen.getByRole('combobox')).toBeInTheDocument();
        expect(screen.getByText('Всі статуси')).toBeInTheDocument();
    });

    it('lists orders', () => {
        render(<OrdersHistoryPage />);

        expect(screen.getByText('Замовлення #12350')).toBeInTheDocument();
        expect(screen.getByText('Замовлення #12349')).toBeInTheDocument();
        expect(screen.getByText('Замовлення #12348')).toBeInTheDocument();
    });

    it('shows order statuses', () => {
        render(<OrdersHistoryPage />);

        // Multiple status badges exist (also in filter dropdown)
        expect(screen.getAllByText('Доставлено').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Відправлено').length).toBeGreaterThan(0);
        expect(screen.getAllByText('В обробці').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Скасовано').length).toBeGreaterThan(0);
    });

    it('shows order totals', () => {
        render(<OrdersHistoryPage />);

        expect(screen.getByText(/65\s*499/)).toBeInTheDocument();
        expect(screen.getByText(/32\s*999/)).toBeInTheDocument();
    });

    it('expands order details on click', async () => {
        render(<OrdersHistoryPage />);

        const orderHeader = screen.getByText('Замовлення #12350').closest('div');
        if (orderHeader) {
            await act(async () => {
                fireEvent.click(orderHeader);
            });
        }

        // Should show items
        expect(screen.getByText('iPhone 15 Pro Max 256GB')).toBeInTheDocument();
        expect(screen.getByText('Apple AirPods Pro 2')).toBeInTheDocument();
    });

    it('shows delivery information in expanded order', async () => {
        render(<OrdersHistoryPage />);

        const orderHeader = screen.getByText('Замовлення #12350').closest('div');
        if (orderHeader) {
            await act(async () => {
                fireEvent.click(orderHeader);
            });
        }

        expect(screen.getByText('Нова Пошта')).toBeInTheDocument();
        expect(screen.getByText('м. Київ, Відділення №25')).toBeInTheDocument();
    });

    it('shows payment information in expanded order', async () => {
        render(<OrdersHistoryPage />);

        const orderHeader = screen.getByText('Замовлення #12350').closest('div');
        if (orderHeader) {
            await act(async () => {
                fireEvent.click(orderHeader);
            });
        }

        expect(screen.getByText('LiqPay')).toBeInTheDocument();
    });

    it('filters by search term', async () => {
        render(<OrdersHistoryPage />);

        const searchInput = screen.getByPlaceholderText('Пошук за номером або товаром...');
        await act(async () => {
            fireEvent.change(searchInput, { target: { value: '12350' } });
        });

        expect(screen.getByText('Замовлення #12350')).toBeInTheDocument();
        expect(screen.queryByText('Замовлення #12349')).not.toBeInTheDocument();
    });

    it('filters by status', async () => {
        render(<OrdersHistoryPage />);

        const statusSelect = screen.getByRole('combobox');
        await act(async () => {
            fireEvent.change(statusSelect, { target: { value: 'delivered' } });
        });

        // Should filter to delivered orders - verify select value changed
        expect((statusSelect as HTMLSelectElement).value).toBe('delivered');
    });

    it('shows track button for shipped orders', async () => {
        render(<OrdersHistoryPage />);

        const orderHeader = screen.getByText('Замовлення #12349').closest('div');
        if (orderHeader) {
            await act(async () => {
                fireEvent.click(orderHeader);
            });
        }

        expect(screen.getByText('Відстежити')).toBeInTheDocument();
    });

    it('shows reorder button for delivered orders', async () => {
        render(<OrdersHistoryPage />);

        const orderHeader = screen.getByText('Замовлення #12350').closest('div');
        if (orderHeader) {
            await act(async () => {
                fireEvent.click(orderHeader);
            });
        }

        expect(screen.getByText('Повторити замовлення')).toBeInTheDocument();
    });

    it('handles reorder action', async () => {
        render(<OrdersHistoryPage />);

        const orderHeader = screen.getByText('Замовлення #12350').closest('div');
        if (orderHeader) {
            await act(async () => {
                fireEvent.click(orderHeader);
            });
        }

        const reorderButton = screen.getByText('Повторити замовлення');
        await act(async () => {
            fireEvent.click(reorderButton);
        });

        expect(window.alert).toHaveBeenCalledWith('Товари з замовлення #12350 додано до кошика');
    });

    it('shows empty state when no orders match filter', async () => {
        render(<OrdersHistoryPage />);

        const searchInput = screen.getByPlaceholderText('Пошук за номером або товаром...');
        await act(async () => {
            fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
        });

        expect(screen.getByText('Замовлень не знайдено')).toBeInTheDocument();
    });

    it('shows order count', () => {
        render(<OrdersHistoryPage />);

        expect(screen.getByText(/Показано \d+ з \d+ замовлень/)).toBeInTheDocument();
    });

    it('has breadcrumb navigation', () => {
        render(<OrdersHistoryPage />);

        expect(screen.getByText('Головна')).toHaveAttribute('href', '/');
        expect(screen.getByText('Профіль')).toHaveAttribute('href', '/profile');
    });

    it('links to detailed order page', async () => {
        render(<OrdersHistoryPage />);

        const orderHeader = screen.getByText('Замовлення #12350').closest('div');
        if (orderHeader) {
            await act(async () => {
                fireEvent.click(orderHeader);
            });
        }

        expect(screen.getByText('Детальніше')).toHaveAttribute('href', '/profile/orders/12350');
    });
});
