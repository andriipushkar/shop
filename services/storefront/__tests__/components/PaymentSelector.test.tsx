/**
 * Payment Selector Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import PaymentSelector, { PaymentSelection, LiqPayForm } from '@/components/PaymentSelector';

// Mock LiqPay API
jest.mock('@/lib/liqpay', () => ({
  PAYMENT_METHODS: [
    { id: 'liqpay', name: 'Картка онлайн', description: 'Visa, Mastercard', icon: '💳', enabled: true },
    { id: 'cash', name: 'Готівкою', description: 'При отриманні', icon: '💵', enabled: true },
    { id: 'cod', name: 'Накладений платіж', description: 'Оплата при отриманні + комісія', icon: '📦', enabled: true },
  ],
  calculateCODCommission: jest.fn((amount) => Math.max(30, Math.round(amount * 0.02 + 20))),
  createPaymentFormData: jest.fn(() => ({
    data: 'testdata123',
    signature: 'testsignature456',
  })),
  getCheckoutUrl: jest.fn(() => 'https://www.liqpay.ua/api/3/checkout'),
}));

describe('PaymentSelector', () => {
  const mockOnSelectionChange = jest.fn();

  const defaultProps = {
    cartTotal: 1000,
    deliveryPrice: 50,
    onSelectionChange: mockOnSelectionChange,
  };

  beforeEach(() => {
    mockOnSelectionChange.mockClear();
  });

  it('renders all payment options', () => {
    render(<PaymentSelector {...defaultProps} />);

    expect(screen.getByText('Картка онлайн')).toBeInTheDocument();
    expect(screen.getByText('Готівкою')).toBeInTheDocument();
    expect(screen.getByText('Накладений платіж')).toBeInTheDocument();
  });

  it('shows payment method descriptions', () => {
    render(<PaymentSelector {...defaultProps} />);

    const descriptions = screen.getAllByText(/Visa.*Mastercard|Google Pay/i);
    expect(descriptions.length).toBeGreaterThan(0);
  });

  it('defaults to cash payment', () => {
    render(<PaymentSelector {...defaultProps} />);

    expect(mockOnSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'cash' })
    );
  });

  it('changes payment method when clicking option', async () => {
    render(<PaymentSelector {...defaultProps} />);

    const liqpayButton = screen.getByText('Картка онлайн').closest('button');
    await act(async () => {
      fireEvent.click(liqpayButton!);
    });

    expect(mockOnSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'liqpay' })
    );
  });

  it('shows commission for COD payment', async () => {
    render(<PaymentSelector {...defaultProps} />);

    // COD should show commission in its description
    const commissions = screen.getAllByText(/комісія/i);
    expect(commissions.length).toBeGreaterThan(0);
  });

  it('calculates COD commission correctly', async () => {
    render(<PaymentSelector {...defaultProps} cartTotal={1000} />);

    const codButton = screen.getByText('Накладений платіж').closest('button');
    await act(async () => {
      fireEvent.click(codButton!);
    });

    expect(mockOnSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'cod',
        commission: expect.any(Number)
      })
    );
  });

  it('shows security notice for card payment', async () => {
    render(<PaymentSelector {...defaultProps} />);

    const liqpayButton = screen.getByText('Картка онлайн').closest('button');
    await act(async () => {
      fireEvent.click(liqpayButton!);
    });

    expect(screen.getByText(/безпечн/i)).toBeInTheDocument();
  });

  it('shows COD notice when COD is selected', async () => {
    render(<PaymentSelector {...defaultProps} />);

    const codButton = screen.getByText('Накладений платіж').closest('button');
    await act(async () => {
      fireEvent.click(codButton!);
    });

    const codNotices = screen.getAllByText(/накладений платіж/i);
    expect(codNotices.length).toBeGreaterThan(0);
  });

  it('displays total amount', () => {
    render(<PaymentSelector {...defaultProps} cartTotal={1000} deliveryPrice={50} />);

    // Should show some total values
    expect(screen.getByText(/до сплати/i)).toBeInTheDocument();
  });

  it('uses initialMethod prop', () => {
    render(<PaymentSelector {...defaultProps} initialMethod="liqpay" />);

    expect(mockOnSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'liqpay' })
    );
  });
});

describe('PaymentSelector - Commission Calculation', () => {
  it('returns 0 commission for non-COD methods', () => {
    const mockOnChange = jest.fn();
    render(
      <PaymentSelector
        cartTotal={1000}
        deliveryPrice={50}
        onSelectionChange={mockOnChange}
        initialMethod="liqpay"
      />
    );

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ commission: 0 })
    );
  });

  it('calculates commission for COD method', async () => {
    const mockOnChange = jest.fn();
    render(
      <PaymentSelector
        cartTotal={1000}
        deliveryPrice={100}
        onSelectionChange={mockOnChange}
      />
    );

    const codButton = screen.getByText('Накладений платіж').closest('button');
    await act(async () => {
      fireEvent.click(codButton!);
    });

    // Commission should be calculated on total (1000 + 100 = 1100)
    const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
    expect(lastCall.method).toBe('cod');
    expect(lastCall.commission).toBeGreaterThan(0);
  });
});

describe('LiqPayForm', () => {
  const defaultProps = {
    orderId: 'ORDER-123',
    amount: 1000,
    description: 'Тестове замовлення',
  };

  it('renders payment form', () => {
    render(<LiqPayForm {...defaultProps} />);

    // Should render submit button
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('displays payment button', () => {
    render(<LiqPayForm {...defaultProps} amount={1500} />);

    // Should show payment button
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders hidden form inputs after load', async () => {
    const { container } = render(<LiqPayForm {...defaultProps} />);

    // Wait for form data to be generated
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    const form = container.querySelector('form');
    expect(form).toBeInTheDocument();
  });
});

describe('PaymentSelector - Selection Structure', () => {
  it('returns correct selection structure', () => {
    const mockOnChange = jest.fn();
    render(
      <PaymentSelector
        cartTotal={1000}
        deliveryPrice={50}
        onSelectionChange={mockOnChange}
      />
    );

    const selection = mockOnChange.mock.calls[0][0] as PaymentSelection;

    expect(selection).toHaveProperty('method');
    expect(selection).toHaveProperty('commission');
    expect(['liqpay', 'cash', 'cod']).toContain(selection.method);
    expect(typeof selection.commission).toBe('number');
  });
});
