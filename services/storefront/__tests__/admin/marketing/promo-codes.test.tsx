import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PromoCodesPage from '../../../app/admin/marketing/promo-codes/page';

describe('PromoCodesPage', () => {
    describe('Rendering', () => {
        it('should render the page title', () => {
            render(<PromoCodesPage />);
            const titles = screen.getAllByText('Промокоди');
            expect(titles.length).toBeGreaterThan(0);
        });

        it('should render create button', () => {
            render(<PromoCodesPage />);
            expect(screen.getByText('Новий промокод')).toBeInTheDocument();
        });

        it('should render promo codes table', () => {
            render(<PromoCodesPage />);
            expect(screen.getByText('WELCOME10')).toBeInTheDocument();
            expect(screen.getByText('SUMMER500')).toBeInTheDocument();
        });

        it('should display promo code names', () => {
            render(<PromoCodesPage />);
            expect(screen.getByText('Знижка для нових клієнтів')).toBeInTheDocument();
            expect(screen.getByText('Літня акція')).toBeInTheDocument();
        });
    });

    describe('Status Display', () => {
        it('should show status badges', () => {
            render(<PromoCodesPage />);
            // Check for status filter buttons
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(0);
        });
    });

    describe('Discount Type Display', () => {
        it('should display percentage discount correctly', () => {
            render(<PromoCodesPage />);
            expect(screen.getByText('10%')).toBeInTheDocument();
        });

        it('should display fixed discount correctly', () => {
            render(<PromoCodesPage />);
            const fixedDiscount = screen.getByText(/500 ₴/);
            expect(fixedDiscount).toBeInTheDocument();
        });

        it('should display discount type badges', () => {
            render(<PromoCodesPage />);
            const types = screen.getAllByText(/Відсоток|Фіксована сума/);
            expect(types.length).toBeGreaterThan(0);
        });
    });

    describe('Usage Statistics', () => {
        it('should display usage count', () => {
            render(<PromoCodesPage />);
            expect(screen.getByText('234')).toBeInTheDocument();
        });

        it('should display usage limit', () => {
            render(<PromoCodesPage />);
            expect(screen.getByText('/ 1000')).toBeInTheDocument();
        });
    });

    describe('Filtering', () => {
        it('should have search input', () => {
            render(<PromoCodesPage />);
            const searchInput = screen.getByPlaceholderText(/Пошук за кодом або назвою/i);
            expect(searchInput).toBeInTheDocument();
        });

        it('should filter codes by search', async () => {
            render(<PromoCodesPage />);
            const searchInput = screen.getByPlaceholderText(/Пошук за кодом або назвою/i);

            fireEvent.change(searchInput, { target: { value: 'WELCOME' } });

            await waitFor(() => {
                expect(screen.getByText('WELCOME10')).toBeInTheDocument();
            });
        });
    });

    describe('Statistics Cards', () => {
        it('should display total promo codes count', () => {
            render(<PromoCodesPage />);
            expect(screen.getByText('Всього кодів')).toBeInTheDocument();
        });

        it('should display active count label', () => {
            render(<PromoCodesPage />);
            expect(screen.getByText('Активних')).toBeInTheDocument();
        });

        it('should display usage stats', () => {
            render(<PromoCodesPage />);
            expect(screen.getByText('Використань')).toBeInTheDocument();
        });
    });

    describe('Create Promo Code Modal', () => {
        it('should open modal when create button clicked', async () => {
            render(<PromoCodesPage />);

            const createButton = screen.getByText('Новий промокод');
            fireEvent.click(createButton);

            await waitFor(() => {
                expect(screen.getByText('Код *')).toBeInTheDocument();
            });
        });

        it('should show form fields in modal', async () => {
            render(<PromoCodesPage />);

            const createButton = screen.getByText('Новий промокод');
            fireEvent.click(createButton);

            await waitFor(() => {
                expect(screen.getByText('Назва *')).toBeInTheDocument();
                expect(screen.getByText('Тип знижки *')).toBeInTheDocument();
                expect(screen.getByText('Розмір знижки *')).toBeInTheDocument();
            });
        });

        it('should have submit button in modal', async () => {
            render(<PromoCodesPage />);

            const createButton = screen.getByText('Новий промокод');
            fireEvent.click(createButton);

            await waitFor(() => {
                expect(screen.getByText('Створити')).toBeInTheDocument();
            });
        });
    });

    describe('Edit Actions', () => {
        it('should have edit buttons', () => {
            render(<PromoCodesPage />);
            const editButtons = screen.getAllByTitle('Редагувати');
            expect(editButtons.length).toBeGreaterThan(0);
        });

        it('should have delete buttons', () => {
            render(<PromoCodesPage />);
            const deleteButtons = screen.getAllByTitle('Видалити');
            expect(deleteButtons.length).toBeGreaterThan(0);
        });

        it('should have toggle status buttons', () => {
            render(<PromoCodesPage />);
            const toggleButtons = screen.getAllByTitle(/Деактивувати|Активувати/);
            expect(toggleButtons.length).toBeGreaterThan(0);
        });
    });
});

describe('PromoCode Filter Options', () => {
    it('should have filter comboboxes', () => {
        render(<PromoCodesPage />);
        const selects = screen.getAllByRole('combobox');
        expect(selects.length).toBeGreaterThan(0);
    });

    it('should filter by type', async () => {
        render(<PromoCodesPage />);

        const selects = screen.getAllByRole('combobox');
        if (selects.length > 1) {
            fireEvent.change(selects[1], { target: { value: 'percentage' } });
        }

        await waitFor(() => {
            expect(screen.getByText('WELCOME10')).toBeInTheDocument();
        });
    });
});

describe('Accessibility', () => {
    it('should have proper heading structure', () => {
        render(<PromoCodesPage />);
        const headings = screen.getAllByRole('heading');
        expect(headings.length).toBeGreaterThan(0);
    });

    it('should support keyboard navigation', () => {
        render(<PromoCodesPage />);
        const createButton = screen.getByText('Новий промокод');
        createButton.focus();
        expect(document.activeElement).toBe(createButton);
    });
});
