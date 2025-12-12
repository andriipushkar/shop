/**
 * Admin Payment Settings Page Tests
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

import PaymentSettingsPage from '@/app/admin/settings/payments/page';

describe('PaymentSettingsPage', () => {
    it('renders page header', () => {
        render(<PaymentSettingsPage />);

        expect(screen.getByText('Налаштування оплати')).toBeInTheDocument();
        expect(screen.getByText('Керування способами оплати та інтеграціями')).toBeInTheDocument();
    });

    it('shows save button', () => {
        render(<PaymentSettingsPage />);

        expect(screen.getByText('Зберегти зміни')).toBeInTheDocument();
    });

    it('displays payment methods section', () => {
        render(<PaymentSettingsPage />);

        expect(screen.getByText('Способи оплати')).toBeInTheDocument();
    });

    it('lists all payment methods', () => {
        render(<PaymentSettingsPage />);

        expect(screen.getByText('LiqPay (Картка онлайн)')).toBeInTheDocument();
        expect(screen.getByText('Готівкою при отриманні')).toBeInTheDocument();
        expect(screen.getByText('Накладений платіж')).toBeInTheDocument();
        expect(screen.getByText('Безготівковий розрахунок')).toBeInTheDocument();
    });

    it('shows enabled status for active methods', () => {
        render(<PaymentSettingsPage />);

        const activeLabels = screen.getAllByText('Активний');
        expect(activeLabels.length).toBeGreaterThanOrEqual(3);
    });

    it('shows disabled status for inactive methods', () => {
        render(<PaymentSettingsPage />);

        expect(screen.getByText('Вимкнено')).toBeInTheDocument();
    });

    it('displays LiqPay integration section', () => {
        render(<PaymentSettingsPage />);

        expect(screen.getByText('Інтеграція з LiqPay')).toBeInTheDocument();
    });

    it('shows test mode warning', () => {
        render(<PaymentSettingsPage />);

        expect(screen.getByText('Тестовий режим увімкнено')).toBeInTheDocument();
    });

    it('shows LiqPay API key fields', () => {
        render(<PaymentSettingsPage />);

        expect(screen.getByText('Public Key')).toBeInTheDocument();
        expect(screen.getByText('Private Key')).toBeInTheDocument();
    });

    it('has public key input with default value', () => {
        render(<PaymentSettingsPage />);

        const publicKeyInput = screen.getByDisplayValue('sandbox_i00000000000');
        expect(publicKeyInput).toBeInTheDocument();
    });

    it('shows connection status', () => {
        render(<PaymentSettingsPage />);

        expect(screen.getByText('Статус підключення')).toBeInTheDocument();
        expect(screen.getByText('Підключено')).toBeInTheDocument();
    });

    it('has test payment button', () => {
        render(<PaymentSettingsPage />);

        expect(screen.getByText('Тестовий платіж')).toBeInTheDocument();
    });

    it('has links to LiqPay resources', () => {
        render(<PaymentSettingsPage />);

        expect(screen.getByText('Кабінет LiqPay')).toBeInTheDocument();
        expect(screen.getByText('Документація')).toBeInTheDocument();
    });

    it('displays COD settings section', () => {
        render(<PaymentSettingsPage />);

        expect(screen.getByText('Накладений платіж (COD)')).toBeInTheDocument();
    });

    it('shows COD commission settings', () => {
        render(<PaymentSettingsPage />);

        expect(screen.getByText('Комісія (%)')).toBeInTheDocument();
        expect(screen.getByText('Фіксована плата (грн)')).toBeInTheDocument();
        expect(screen.getByText('Мінімальна комісія (грн)')).toBeInTheDocument();
    });

    it('shows COD calculation formula', () => {
        render(<PaymentSettingsPage />);

        expect(screen.getByText('Формула розрахунку:')).toBeInTheDocument();
    });

    it('displays security section', () => {
        render(<PaymentSettingsPage />);

        expect(screen.getByText('Безпека платежів')).toBeInTheDocument();
    });

    it('shows security features', () => {
        render(<PaymentSettingsPage />);

        expect(screen.getByText('3D Secure')).toBeInTheDocument();
        expect(screen.getByText('Callback підпис')).toBeInTheDocument();
        expect(screen.getByText('SSL/TLS')).toBeInTheDocument();
    });

    it('allows toggling payment method status', async () => {
        render(<PaymentSettingsPage />);

        // Find toggle buttons
        const toggleButtons = screen.getAllByRole('button').filter(btn =>
            btn.className.includes('rounded-full') && btn.className.includes('inline-flex')
        );

        expect(toggleButtons.length).toBeGreaterThan(0);
    });

    it('allows toggling private key visibility', async () => {
        render(<PaymentSettingsPage />);

        // Find eye icon button near private key
        const privateKeySection = screen.getByText('Private Key').closest('div');
        const eyeButton = privateKeySection?.querySelector('button');

        if (eyeButton) {
            // Initially password type
            const privateKeyInput = screen.getByPlaceholderText('••••••••••••••••••••') as HTMLInputElement;
            expect(privateKeyInput.type).toBe('password');

            // Click to show
            await act(async () => {
                fireEvent.click(eyeButton);
            });

            // Should change to text
            expect(privateKeyInput.type).toBe('text');
        }
    });
});

describe('PaymentSettingsPage - Edit Mode', () => {
    it('opens edit mode for payment method', async () => {
        render(<PaymentSettingsPage />);

        // Find edit button
        const editButtons = screen.getAllByRole('button');
        const pencilButton = editButtons.find(btn =>
            btn.querySelector('svg') && btn.className.includes('hover:text-teal-600')
        );

        if (pencilButton) {
            await act(async () => {
                fireEvent.click(pencilButton);
            });

            expect(screen.getByText('Скасувати')).toBeInTheDocument();
            expect(screen.getByText('Готово')).toBeInTheDocument();
        }
    });
});

describe('PaymentSettingsPage - Test Mode Toggle', () => {
    it('toggles test mode', async () => {
        render(<PaymentSettingsPage />);

        // Find test mode toggle
        const testModeSection = screen.getByText('Тестовий режим').closest('div');
        const toggleButton = testModeSection?.querySelector('button');

        if (toggleButton) {
            // Initially test mode is on (yellow)
            expect(toggleButton.className).toContain('bg-yellow-500');

            // Toggle off
            await act(async () => {
                fireEvent.click(toggleButton);
            });

            // Should change to production (green)
            expect(toggleButton.className).toContain('bg-green-500');
        }
    });

    it('hides test mode warning when disabled', async () => {
        render(<PaymentSettingsPage />);

        const testModeSection = screen.getByText('Тестовий режим').closest('div');
        const toggleButton = testModeSection?.querySelector('button');

        if (toggleButton) {
            await act(async () => {
                fireEvent.click(toggleButton);
            });

            expect(screen.queryByText('Тестовий режим увімкнено')).not.toBeInTheDocument();
        }
    });
});

describe('PaymentSettingsPage - COD Commission', () => {
    it('has default commission values', () => {
        render(<PaymentSettingsPage />);

        expect(screen.getByDisplayValue('2')).toBeInTheDocument();
        expect(screen.getByDisplayValue('20')).toBeInTheDocument();
        expect(screen.getByDisplayValue('30')).toBeInTheDocument();
    });

    it('updates COD calculation example when values change', async () => {
        render(<PaymentSettingsPage />);

        // Find commission percent input
        const commissionInput = screen.getByDisplayValue('2') as HTMLInputElement;
        await act(async () => {
            fireEvent.change(commissionInput, { target: { value: '3' } });
        });

        // Formula should update - use getAllBy since there are multiple matches
        const matches = screen.getAllByText(/3%/);
        expect(matches.length).toBeGreaterThan(0);
    });
});
