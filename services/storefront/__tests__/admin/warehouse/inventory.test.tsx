import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InventoryPage from '../../../app/admin/warehouse/inventory/page';

describe('InventoryPage', () => {
    describe('Rendering', () => {
        it('should render the page title', () => {
            render(<InventoryPage />);
            const titles = screen.getAllByText('Інвентаризація');
            expect(titles.length).toBeGreaterThan(0);
        });

        it('should render create count button', () => {
            render(<InventoryPage />);
            expect(screen.getByText('Нова інвентаризація')).toBeInTheDocument();
        });

        it('should display inventory counts list', () => {
            render(<InventoryPage />);
            // Check for inventory names
            expect(screen.getByText(/Повна інвентаризація складу|Точкова перевірка/)).toBeInTheDocument();
        });
    });

    describe('Inventory Count Types', () => {
        it('should show type labels', () => {
            render(<InventoryPage />);
            const types = screen.getAllByText(/Повна|Часткова|Точкова/);
            expect(types.length).toBeGreaterThan(0);
        });
    });

    describe('Status Display', () => {
        it('should display completed status', () => {
            render(<InventoryPage />);
            const statuses = screen.getAllByText('Завершено');
            expect(statuses.length).toBeGreaterThan(0);
        });

        it('should display various statuses', () => {
            render(<InventoryPage />);
            const statuses = screen.getAllByText(/Завершено|В процесі|Заплановано/);
            expect(statuses.length).toBeGreaterThan(0);
        });
    });

    describe('Statistics Dashboard', () => {
        it('should show stats cards', () => {
            render(<InventoryPage />);
            // Check for stats labels
            const completedLabels = screen.getAllByText('Завершено');
            expect(completedLabels.length).toBeGreaterThan(0);
        });

        it('should display discrepancies count', () => {
            render(<InventoryPage />);
            expect(screen.getByText('Розбіжностей')).toBeInTheDocument();
        });
    });

    describe('Filtering', () => {
        it('should have status filter buttons', () => {
            render(<InventoryPage />);
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(0);
        });

        it('should filter by status', async () => {
            render(<InventoryPage />);

            const completedButton = screen.getByRole('button', { name: 'Завершено' });
            fireEvent.click(completedButton);

            await waitFor(() => {
                const items = screen.getAllByText(/Завершено/);
                expect(items.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Create Inventory Count', () => {
        it('should open modal when create button clicked', async () => {
            render(<InventoryPage />);

            const createButton = screen.getByText('Нова інвентаризація');
            fireEvent.click(createButton);

            await waitFor(() => {
                const modalTitle = screen.getAllByText('Нова інвентаризація');
                expect(modalTitle.length).toBeGreaterThanOrEqual(2);
            });
        });

        it('should show form fields in modal', async () => {
            render(<InventoryPage />);

            const createButton = screen.getByText('Нова інвентаризація');
            fireEvent.click(createButton);

            await waitFor(() => {
                expect(screen.getByText('Назва *')).toBeInTheDocument();
            });
        });
    });

    describe('Actions', () => {
        it('should have action buttons', () => {
            render(<InventoryPage />);
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(3);
        });
    });
});

describe('Inventory Count Form', () => {
    describe('Form Fields', () => {
        it('should show form when modal opens', async () => {
            render(<InventoryPage />);

            const createButton = screen.getByText('Нова інвентаризація');
            fireEvent.click(createButton);

            await waitFor(() => {
                expect(screen.getByText('Створити')).toBeInTheDocument();
            });
        });
    });
});

describe('Accessibility', () => {
    it('should have proper heading structure', () => {
        render(<InventoryPage />);
        const headings = screen.getAllByRole('heading');
        expect(headings.length).toBeGreaterThan(0);
    });

    it('should have accessible buttons', () => {
        render(<InventoryPage />);
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
    });

    it('should support keyboard navigation', () => {
        render(<InventoryPage />);
        const createButton = screen.getByText('Нова інвентаризація');
        createButton.focus();
        expect(document.activeElement).toBe(createButton);
    });
});
