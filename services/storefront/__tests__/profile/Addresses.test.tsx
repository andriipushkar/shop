/**
 * Profile Addresses Page Tests
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

import AddressesPage from '@/app/profile/addresses/page';

describe('AddressesPage', () => {
    beforeEach(() => {
        window.confirm = jest.fn(() => true);
    });

    it('renders page header', () => {
        render(<AddressesPage />);

        // Multiple instances exist (breadcrumb + title)
        expect(screen.getAllByText('Адреси доставки').length).toBeGreaterThan(0);
        expect(screen.getByText('Керуйте збереженими адресами для швидкого оформлення')).toBeInTheDocument();
    });

    it('shows add address button', () => {
        render(<AddressesPage />);

        expect(screen.getByText('Додати адресу')).toBeInTheDocument();
    });

    it('displays saved addresses', () => {
        render(<AddressesPage />);

        expect(screen.getByText('Дім')).toBeInTheDocument();
        expect(screen.getByText('Робота')).toBeInTheDocument();
        expect(screen.getByText('Батьки')).toBeInTheDocument();
    });

    it('shows default address badge', () => {
        render(<AddressesPage />);

        expect(screen.getByText('За замовчуванням')).toBeInTheDocument();
    });

    it('displays city for each address', () => {
        render(<AddressesPage />);

        expect(screen.getAllByText('Київ').length).toBeGreaterThan(0);
        expect(screen.getByText('Львів')).toBeInTheDocument();
    });

    it('shows delivery method info', () => {
        render(<AddressesPage />);

        expect(screen.getByText('Відділення Нової Пошти №25')).toBeInTheDocument();
        expect(screen.getByText('Поштомат №112')).toBeInTheDocument();
    });

    it('displays phone numbers', () => {
        render(<AddressesPage />);

        expect(screen.getAllByText('+380 67 123 45 67').length).toBeGreaterThan(0);
    });

    it('opens modal for adding new address', async () => {
        render(<AddressesPage />);

        const addButton = screen.getByText('Додати адресу');
        await act(async () => {
            fireEvent.click(addButton);
        });

        expect(screen.getByText('Нова адреса')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Дім, Робота, тощо')).toBeInTheDocument();
    });

    it('shows address type selection in modal', async () => {
        render(<AddressesPage />);

        const addButton = screen.getByText('Додати адресу');
        await act(async () => {
            fireEvent.click(addButton);
        });

        // Type buttons in modal
        const homeButtons = screen.getAllByText('Дім');
        expect(homeButtons.length).toBeGreaterThan(1); // One in list, one in modal
        expect(screen.getAllByText('Робота').length).toBeGreaterThan(1);
        expect(screen.getByText('Інше')).toBeInTheDocument();
    });

    it('shows delivery method selection in modal', async () => {
        render(<AddressesPage />);

        const addButton = screen.getByText('Додати адресу');
        await act(async () => {
            fireEvent.click(addButton);
        });

        const deliverySelect = screen.getByRole('combobox');
        expect(deliverySelect).toBeInTheDocument();
    });

    it('closes modal on cancel', async () => {
        render(<AddressesPage />);

        const addButton = screen.getByText('Додати адресу');
        await act(async () => {
            fireEvent.click(addButton);
        });

        const cancelButton = screen.getByText('Скасувати');
        await act(async () => {
            fireEvent.click(cancelButton);
        });

        expect(screen.queryByText('Нова адреса')).not.toBeInTheDocument();
    });

    it('opens modal for editing address', async () => {
        render(<AddressesPage />);

        // Find edit button (pencil icon)
        const editButtons = screen.getAllByRole('button').filter(btn =>
            btn.querySelector('svg') && btn.className.includes('hover:text-gray-600')
        );

        if (editButtons.length > 0) {
            await act(async () => {
                fireEvent.click(editButtons[0]);
            });

            expect(screen.getByText('Редагувати адресу')).toBeInTheDocument();
        }
    });

    it('shows make default button for non-default addresses', () => {
        render(<AddressesPage />);

        // Should show for addresses that are not default
        const makeDefaultButtons = screen.getAllByText('Зробити основною');
        expect(makeDefaultButtons.length).toBeGreaterThan(0);
    });

    it('handles set default address', async () => {
        render(<AddressesPage />);

        const makeDefaultButton = screen.getAllByText('Зробити основною')[0];
        await act(async () => {
            fireEvent.click(makeDefaultButton);
        });

        // The button should disappear after making it default
        // and "За замовчуванням" badge should move
    });

    it('handles delete address with confirmation', async () => {
        render(<AddressesPage />);

        // Find delete button
        const deleteButtons = screen.getAllByRole('button').filter(btn =>
            btn.querySelector('svg') && btn.className.includes('hover:text-red-600')
        );

        if (deleteButtons.length > 0) {
            await act(async () => {
                fireEvent.click(deleteButtons[0]);
            });

            expect(window.confirm).toHaveBeenCalledWith('Ви впевнені, що хочете видалити цю адресу?');
        }
    });

    it('shows courier fields when courier delivery selected', async () => {
        render(<AddressesPage />);

        const addButton = screen.getByText('Додати адресу');
        await act(async () => {
            fireEvent.click(addButton);
        });

        const deliverySelect = screen.getByRole('combobox');
        await act(async () => {
            fireEvent.change(deliverySelect, { target: { value: 'courier' } });
        });

        expect(screen.getByPlaceholderText('вул. Хрещатик')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('22')).toBeInTheDocument();
    });

    it('shows branch number field when branch delivery selected', async () => {
        render(<AddressesPage />);

        const addButton = screen.getByText('Додати адресу');
        await act(async () => {
            fireEvent.click(addButton);
        });

        expect(screen.getByPlaceholderText('25')).toBeInTheDocument();
    });

    it('disables save button when required fields empty', async () => {
        render(<AddressesPage />);

        const addButton = screen.getByText('Додати адресу');
        await act(async () => {
            fireEvent.click(addButton);
        });

        const saveButton = screen.getByText('Додати');
        expect(saveButton).toBeDisabled();
    });

    it('enables save button when required fields filled', async () => {
        render(<AddressesPage />);

        const addButton = screen.getByText('Додати адресу');
        await act(async () => {
            fireEvent.click(addButton);
        });

        // Fill required fields
        const nameInput = screen.getByPlaceholderText('Дім, Робота, тощо');
        const cityInput = screen.getByPlaceholderText('Введіть місто');
        const phoneInput = screen.getByPlaceholderText('+380 67 123 45 67');

        await act(async () => {
            fireEvent.change(nameInput, { target: { value: 'Тест' } });
            fireEvent.change(cityInput, { target: { value: 'Київ' } });
            fireEvent.change(phoneInput, { target: { value: '+380501234567' } });
        });

        const saveButton = screen.getByText('Додати');
        expect(saveButton).not.toBeDisabled();
    });

    it('shows info tip about default address', () => {
        render(<AddressesPage />);

        expect(screen.getByText(/Адреса за замовчуванням/)).toBeInTheDocument();
    });

    it('has breadcrumb navigation', () => {
        render(<AddressesPage />);

        expect(screen.getByText('Головна')).toHaveAttribute('href', '/');
        expect(screen.getByText('Профіль')).toHaveAttribute('href', '/profile');
    });
});
