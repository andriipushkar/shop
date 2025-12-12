import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SuppliersPage from '../../../app/admin/warehouse/suppliers/page';

describe('SuppliersPage', () => {
    describe('Rendering', () => {
        it('should render the page title', () => {
            render(<SuppliersPage />);
            expect(screen.getByText('Постачальники')).toBeInTheDocument();
        });

        it('should render add supplier button', () => {
            render(<SuppliersPage />);
            expect(screen.getByText('Додати постачальника')).toBeInTheDocument();
        });

        it('should display suppliers list', () => {
            render(<SuppliersPage />);
            expect(screen.getByText('ТОВ "Електроніка Плюс"')).toBeInTheDocument();
        });
    });

    describe('Supplier Information', () => {
        it('should display supplier names', () => {
            render(<SuppliersPage />);
            expect(screen.getByText('ТОВ "Електроніка Плюс"')).toBeInTheDocument();
            expect(screen.getByText('ФОП Коваленко І.М.')).toBeInTheDocument();
        });

        it('should display contact names', () => {
            render(<SuppliersPage />);
            expect(screen.getByText('Олександр Петренко')).toBeInTheDocument();
        });
    });

    describe('Status Display', () => {
        it('should show active status', () => {
            render(<SuppliersPage />);
            const activeStatuses = screen.getAllByText('Активний');
            expect(activeStatuses.length).toBeGreaterThan(0);
        });

        it('should show various statuses', () => {
            render(<SuppliersPage />);
            const statuses = screen.getAllByText(/Активний|Неактивний|На паузі/);
            expect(statuses.length).toBeGreaterThan(0);
        });
    });

    describe('Statistics', () => {
        it('should display stats cards', () => {
            render(<SuppliersPage />);
            expect(screen.getByText('Всього постачальників')).toBeInTheDocument();
            expect(screen.getByText('Активних')).toBeInTheDocument();
        });
    });

    describe('Filtering', () => {
        it('should have search input', () => {
            render(<SuppliersPage />);
            const searchInput = screen.getByPlaceholderText(/Пошук/i);
            expect(searchInput).toBeInTheDocument();
        });

        it('should have status filters', () => {
            render(<SuppliersPage />);
            const selects = screen.getAllByRole('combobox');
            expect(selects.length).toBeGreaterThan(0);
        });
    });

    describe('Create Supplier', () => {
        it('should open modal when add button clicked', async () => {
            render(<SuppliersPage />);

            const addButton = screen.getByText('Додати постачальника');
            fireEvent.click(addButton);

            await waitFor(() => {
                expect(screen.getByText('Новий постачальник')).toBeInTheDocument();
            });
        });

        it('should show form fields in modal', async () => {
            render(<SuppliersPage />);

            const addButton = screen.getByText('Додати постачальника');
            fireEvent.click(addButton);

            await waitFor(() => {
                expect(screen.getByText('Назва компанії *')).toBeInTheDocument();
                expect(screen.getByText('Email *')).toBeInTheDocument();
            });
        });
    });

    describe('Supplier Actions', () => {
        it('should have edit buttons', () => {
            render(<SuppliersPage />);
            const editButtons = screen.getAllByTitle('Редагувати');
            expect(editButtons.length).toBeGreaterThan(0);
        });

        it('should have view buttons', () => {
            render(<SuppliersPage />);
            const viewButtons = screen.getAllByTitle('Переглянути');
            expect(viewButtons.length).toBeGreaterThan(0);
        });

        it('should have delete buttons', () => {
            render(<SuppliersPage />);
            const deleteButtons = screen.getAllByTitle('Видалити');
            expect(deleteButtons.length).toBeGreaterThan(0);
        });
    });

    describe('Table Structure', () => {
        it('should have table headers', () => {
            render(<SuppliersPage />);
            const headers = screen.getAllByText('Постачальник');
            expect(headers.length).toBeGreaterThan(0);
            expect(screen.getByText('Контакт')).toBeInTheDocument();
            expect(screen.getByText('Статус')).toBeInTheDocument();
            expect(screen.getByText('Дії')).toBeInTheDocument();
        });
    });
});

describe('Supplier Form', () => {
    describe('Basic Information', () => {
        it('should have required fields', async () => {
            render(<SuppliersPage />);

            const addButton = screen.getByText('Додати постачальника');
            fireEvent.click(addButton);

            await waitFor(() => {
                expect(screen.getByText('Назва компанії *')).toBeInTheDocument();
            });
        });

        it('should have contact fields', async () => {
            render(<SuppliersPage />);

            const addButton = screen.getByText('Додати постачальника');
            fireEvent.click(addButton);

            await waitFor(() => {
                expect(screen.getByText('Email *')).toBeInTheDocument();
                expect(screen.getByText('Телефон *')).toBeInTheDocument();
            });
        });
    });
});

describe('Supplier Performance', () => {
    it('should display rating header', () => {
        render(<SuppliersPage />);
        expect(screen.getByText('Рейтинг')).toBeInTheDocument();
    });

    it('should show delivery info', () => {
        render(<SuppliersPage />);
        const deliveryLabels = screen.getAllByText(/Доставка:/i);
        expect(deliveryLabels.length).toBeGreaterThan(0);
    });
});

describe('Accessibility', () => {
    it('should have proper heading structure', () => {
        render(<SuppliersPage />);
        const headings = screen.getAllByRole('heading');
        expect(headings.length).toBeGreaterThan(0);
    });

    it('should be keyboard navigable', () => {
        render(<SuppliersPage />);
        const addButton = screen.getByText('Додати постачальника');
        addButton.focus();
        expect(document.activeElement).toBe(addButton);
    });

    it('should have accessible buttons', () => {
        render(<SuppliersPage />);
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
    });
});

describe('Supplier Categories', () => {
    it('should display type labels', () => {
        render(<SuppliersPage />);
        const typeLabels = screen.getAllByText(/Виробник|Дистриб'ютор|Оптовик/);
        expect(typeLabels.length).toBeGreaterThan(0);
    });
});
