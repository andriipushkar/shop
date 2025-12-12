/**
 * Admin Order Detail Page Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Mock next/navigation
jest.mock('next/navigation', () => ({
    useParams: () => ({ id: '12350' }),
}));

// Mock next/link
jest.mock('next/link', () => {
    const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
        <a href={href}>{children}</a>
    );
    MockLink.displayName = 'MockLink';
    return MockLink;
});

import OrderDetailPage from '@/app/admin/orders/[id]/page';

describe('OrderDetailPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock window.confirm
        window.confirm = jest.fn(() => true);
    });

    it('renders order details', () => {
        render(<OrderDetailPage />);

        expect(screen.getByText(/Замовлення #12350/)).toBeInTheDocument();
        // Multiple instances of "В обробці" exist (badge, timeline, select)
        expect(screen.getAllByText('В обробці').length).toBeGreaterThan(0);
    });

    it('displays order status timeline', () => {
        render(<OrderDetailPage />);

        // Multiple instances exist (timeline + dropdown options)
        expect(screen.getAllByText('Нове').length).toBeGreaterThan(0);
        expect(screen.getAllByText('В обробці').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Відправлено').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Доставлено').length).toBeGreaterThan(0);
    });

    it('shows customer information', () => {
        render(<OrderDetailPage />);

        expect(screen.getByText('Олександр Ковальчук')).toBeInTheDocument();
        expect(screen.getByText('o.kovalchuk@gmail.com')).toBeInTheDocument();
    });

    it('displays order items', () => {
        render(<OrderDetailPage />);

        expect(screen.getByText('iPhone 15 Pro Max 256GB')).toBeInTheDocument();
        expect(screen.getByText('Apple AirPods Pro 2')).toBeInTheDocument();
    });

    it('shows delivery information', () => {
        render(<OrderDetailPage />);

        expect(screen.getByText('Нова Пошта')).toBeInTheDocument();
        expect(screen.getByText('Київ')).toBeInTheDocument();
    });

    it('shows TTN warning when no tracking number', () => {
        render(<OrderDetailPage />);

        expect(screen.getByText('ТТН не вказано')).toBeInTheDocument();
        expect(screen.getByText('Додати ТТН')).toBeInTheDocument();
    });

    it('opens TTN modal when clicking add TTN button', async () => {
        render(<OrderDetailPage />);

        const addTTNButton = screen.getByText('Додати ТТН');
        await act(async () => {
            fireEvent.click(addTTNButton);
        });

        expect(screen.getByText('Введіть номер ТТН')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('20450000000000')).toBeInTheDocument();
    });

    it('validates TTN format in modal', async () => {
        render(<OrderDetailPage />);

        // Open modal
        const addTTNButton = screen.getByText('Додати ТТН');
        await act(async () => {
            fireEvent.click(addTTNButton);
        });

        // Enter invalid TTN
        const ttnInput = screen.getByPlaceholderText('20450000000000');
        await act(async () => {
            fireEvent.change(ttnInput, { target: { value: '123' } });
        });

        // Save button should be disabled
        const saveButton = screen.getByText('Зберегти');
        expect(saveButton).toBeDisabled();

        // Enter valid TTN
        await act(async () => {
            fireEvent.change(ttnInput, { target: { value: '20450000012345' } });
        });

        expect(saveButton).not.toBeDisabled();
    });

    it('filters out non-numeric characters in TTN input', async () => {
        render(<OrderDetailPage />);

        // Open modal
        const addTTNButton = screen.getByText('Додати ТТН');
        await act(async () => {
            fireEvent.click(addTTNButton);
        });

        const ttnInput = screen.getByPlaceholderText('20450000000000') as HTMLInputElement;
        await act(async () => {
            fireEvent.change(ttnInput, { target: { value: 'abc123def456' } });
        });

        expect(ttnInput.value).toBe('123456');
    });

    it('shows status change dropdown', () => {
        render(<OrderDetailPage />);

        expect(screen.getByText('Змінити статус:')).toBeInTheDocument();
        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('has update status button', () => {
        render(<OrderDetailPage />);

        expect(screen.getByText('Оновити')).toBeInTheDocument();
    });

    it('displays payment information', () => {
        render(<OrderDetailPage />);

        expect(screen.getByText('LiqPay')).toBeInTheDocument();
        expect(screen.getByText('Сплачено')).toBeInTheDocument();
    });

    it('shows order history', () => {
        render(<OrderDetailPage />);

        expect(screen.getByText('Історія замовлення')).toBeInTheDocument();
        expect(screen.getByText('Замовлення створено')).toBeInTheDocument();
        expect(screen.getByText('Оплата підтверджена')).toBeInTheDocument();
    });

    it('allows adding comments', async () => {
        render(<OrderDetailPage />);

        const commentInput = screen.getByPlaceholderText('Введіть коментар...');
        const addButton = screen.getByText('Додати');

        await act(async () => {
            fireEvent.change(commentInput, { target: { value: 'Тестовий коментар' } });
            fireEvent.click(addButton);
        });

        // Comment should be added to history
        await waitFor(() => {
            expect(screen.getByText('Тестовий коментар')).toBeInTheDocument();
        });
    });

    it('shows cancel order button', () => {
        render(<OrderDetailPage />);

        expect(screen.getByText('Скасувати замовлення')).toBeInTheDocument();
    });

    it('shows customer notes when present', () => {
        render(<OrderDetailPage />);

        expect(screen.getByText('Примітка від клієнта')).toBeInTheDocument();
        expect(screen.getByText('Будь ласка, зателефонуйте перед доставкою')).toBeInTheDocument();
    });

    it('displays order totals correctly', () => {
        render(<OrderDetailPage />);

        expect(screen.getByText('Всього')).toBeInTheDocument();
        expect(screen.getByText('Безкоштовно')).toBeInTheDocument(); // Free shipping
    });

    it('shows discount when applied', () => {
        render(<OrderDetailPage />);

        expect(screen.getByText(/WINTER2024/)).toBeInTheDocument();
    });
});

describe('OrderDetailPage - Status Updates', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        window.confirm = jest.fn(() => true);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('opens TTN modal when trying to change status to shipped without TTN', async () => {
        render(<OrderDetailPage />);

        // Select "shipped" status
        const select = screen.getByRole('combobox');
        await act(async () => {
            fireEvent.change(select, { target: { value: 'shipped' } });
        });

        // Click update
        const updateButton = screen.getByText('Оновити');
        await act(async () => {
            fireEvent.click(updateButton);
        });

        // TTN modal should open
        expect(screen.getByText('Введіть номер ТТН')).toBeInTheDocument();
    });
});

describe('OrderDetailPage - Cancel Order', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('shows confirmation dialog when cancelling order', async () => {
        window.confirm = jest.fn(() => false);
        render(<OrderDetailPage />);

        const cancelButton = screen.getByText('Скасувати замовлення');
        await act(async () => {
            fireEvent.click(cancelButton);
        });

        expect(window.confirm).toHaveBeenCalledWith('Ви впевнені, що хочете скасувати замовлення?');
    });

    it('cancels order when confirmed', async () => {
        window.confirm = jest.fn(() => true);
        render(<OrderDetailPage />);

        const cancelButton = screen.getByText('Скасувати замовлення');
        await act(async () => {
            fireEvent.click(cancelButton);
        });

        // Fast-forward timers
        await act(async () => {
            jest.advanceTimersByTime(1500);
        });

        // Status should change to cancelled (multiple elements may exist)
        await waitFor(() => {
            expect(screen.getAllByText('Замовлення скасовано').length).toBeGreaterThan(0);
        });
    });
});
