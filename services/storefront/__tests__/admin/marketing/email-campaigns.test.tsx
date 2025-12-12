import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EmailCampaignsPage from '../../../app/admin/marketing/email-campaigns/page';

describe('EmailCampaignsPage', () => {
    describe('Rendering', () => {
        it('should render the page title', () => {
            render(<EmailCampaignsPage />);
            const titles = screen.getAllByText('Email-кампанії');
            expect(titles.length).toBeGreaterThan(0);
        });

        it('should render create campaign button', () => {
            render(<EmailCampaignsPage />);
            expect(screen.getByText('Нова кампанія')).toBeInTheDocument();
        });

        it('should render campaigns list', () => {
            render(<EmailCampaignsPage />);
            expect(screen.getByText('Різдвяний розпродаж')).toBeInTheDocument();
        });
    });

    describe('Campaign Status', () => {
        it('should display different status badges', () => {
            render(<EmailCampaignsPage />);
            const statuses = screen.getAllByText(/Надіслано|Заплановано|Чернетка/);
            expect(statuses.length).toBeGreaterThan(0);
        });
    });

    describe('Campaign Statistics', () => {
        it('should display statistics', () => {
            render(<EmailCampaignsPage />);
            const stats = screen.getAllByText('Відправлено');
            expect(stats.length).toBeGreaterThan(0);
        });

        it('should display open stats', () => {
            render(<EmailCampaignsPage />);
            const stats = screen.getAllByText('Відкрито');
            expect(stats.length).toBeGreaterThan(0);
        });

        it('should display click stats', () => {
            render(<EmailCampaignsPage />);
            const stats = screen.getAllByText('Кліків');
            expect(stats.length).toBeGreaterThan(0);
        });
    });

    describe('Campaign Actions', () => {
        it('should have edit buttons', () => {
            render(<EmailCampaignsPage />);
            const editButtons = screen.getAllByTitle('Редагувати');
            expect(editButtons.length).toBeGreaterThan(0);
        });

        it('should have delete buttons', () => {
            render(<EmailCampaignsPage />);
            const deleteButtons = screen.getAllByTitle('Видалити');
            expect(deleteButtons.length).toBeGreaterThan(0);
        });

        it('should have duplicate buttons', () => {
            render(<EmailCampaignsPage />);
            const duplicateButtons = screen.getAllByTitle('Дублювати');
            expect(duplicateButtons.length).toBeGreaterThan(0);
        });
    });

    describe('Create Campaign Modal', () => {
        it('should open modal when create button clicked', async () => {
            render(<EmailCampaignsPage />);

            const createButton = screen.getByText('Нова кампанія');
            fireEvent.click(createButton);

            await waitFor(() => {
                expect(screen.getByText('Нова email-кампанія')).toBeInTheDocument();
            });
        });

        it('should show form fields in modal', async () => {
            render(<EmailCampaignsPage />);

            const createButton = screen.getByText('Нова кампанія');
            fireEvent.click(createButton);

            await waitFor(() => {
                expect(screen.getByText('Назва кампанії *')).toBeInTheDocument();
                expect(screen.getByText('Тема листа *')).toBeInTheDocument();
            });
        });
    });

    describe('Campaign Filters', () => {
        it('should have status filter', () => {
            render(<EmailCampaignsPage />);
            const selects = screen.getAllByRole('combobox');
            expect(selects.length).toBeGreaterThan(0);
        });

        it('should filter by status', async () => {
            render(<EmailCampaignsPage />);

            const selects = screen.getAllByRole('combobox');
            fireEvent.change(selects[0], { target: { value: 'sent' } });

            await waitFor(() => {
                expect(screen.getByText('Різдвяний розпродаж')).toBeInTheDocument();
            });
        });
    });

    describe('Campaign Types', () => {
        it('should display campaign types', () => {
            render(<EmailCampaignsPage />);
            const types = screen.getAllByText(/Промо|Розсилка|Автоматична/);
            expect(types.length).toBeGreaterThan(0);
        });
    });
});

describe('Email Campaign Form', () => {
    describe('Validation', () => {
        it('should show form when opening modal', async () => {
            render(<EmailCampaignsPage />);

            const createButton = screen.getByText('Нова кампанія');
            fireEvent.click(createButton);

            await waitFor(() => {
                expect(screen.getByText('Створити')).toBeInTheDocument();
            });
        });
    });
});

describe('Accessibility', () => {
    it('should have proper heading structure', () => {
        render(<EmailCampaignsPage />);
        const headings = screen.getAllByRole('heading');
        expect(headings.length).toBeGreaterThan(0);
    });

    it('should have accessible buttons', () => {
        render(<EmailCampaignsPage />);
        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
            expect(button).toBeEnabled();
        });
    });

    it('should support keyboard navigation', () => {
        render(<EmailCampaignsPage />);
        const createButton = screen.getByText('Нова кампанія');
        createButton.focus();
        expect(document.activeElement).toBe(createButton);
    });
});
