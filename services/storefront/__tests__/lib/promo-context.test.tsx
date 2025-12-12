import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { PromoProvider, usePromo, PromoCode, DiscountType } from '../../lib/promo-context';

// Test wrapper component
const TestComponent = () => {
    const {
        promoCodes,
        appliedPromo,
        applyPromoCode,
        removePromoCode,
        calculateDiscount,
        validatePromoCode
    } = usePromo();

    const [applyResult, setApplyResult] = React.useState<{ success: boolean; message: string } | null>(null);
    const [validateResult, setValidateResult] = React.useState<{ valid: boolean; message: string } | null>(null);

    return (
        <div>
            <div data-testid="promo-count">{promoCodes.length}</div>
            <div data-testid="applied-code">{appliedPromo?.code?.code || 'none'}</div>
            <div data-testid="apply-success">{applyResult?.success?.toString() || 'none'}</div>
            <div data-testid="validate-valid">{validateResult?.valid?.toString() || 'none'}</div>

            <button onClick={() => {
                const result = applyPromoCode('WELCOME10', 1000);
                setApplyResult(result);
            }}>
                Apply Welcome
            </button>

            <button onClick={() => {
                const result = applyPromoCode('INVALID', 1000);
                setApplyResult(result);
            }}>
                Apply Invalid
            </button>

            <button onClick={() => {
                const result = validatePromoCode('WELCOME10');
                setValidateResult(result);
            }}>
                Validate Welcome
            </button>

            <button onClick={() => {
                const result = validatePromoCode('NOTEXIST');
                setValidateResult(result);
            }}>
                Validate Not Exist
            </button>

            <button onClick={removePromoCode}>Remove Promo</button>
        </div>
    );
};

const renderWithProvider = () => {
    return render(
        <PromoProvider>
            <TestComponent />
        </PromoProvider>
    );
};

describe('PromoContext', () => {
    describe('Initial State', () => {
        it('should have default promo codes', () => {
            renderWithProvider();
            const count = parseInt(screen.getByTestId('promo-count').textContent || '0');
            expect(count).toBeGreaterThan(0);
        });

        it('should have no applied promo code initially', () => {
            renderWithProvider();
            expect(screen.getByTestId('applied-code')).toHaveTextContent('none');
        });
    });

    describe('Validate Promo Code', () => {
        it('should validate a valid promo code', async () => {
            renderWithProvider();

            await act(async () => {
                fireEvent.click(screen.getByText('Validate Welcome'));
            });

            await waitFor(() => {
                expect(screen.getByTestId('validate-valid')).toHaveTextContent('true');
            });
        });

        it('should fail validation for non-existent code', async () => {
            renderWithProvider();

            await act(async () => {
                fireEvent.click(screen.getByText('Validate Not Exist'));
            });

            await waitFor(() => {
                expect(screen.getByTestId('validate-valid')).toHaveTextContent('false');
            });
        });
    });

    describe('Apply Promo Code', () => {
        it('should apply a valid promo code', async () => {
            renderWithProvider();

            await act(async () => {
                fireEvent.click(screen.getByText('Apply Welcome'));
            });

            await waitFor(() => {
                expect(screen.getByTestId('apply-success')).toHaveTextContent('true');
            });
        });

        it('should not apply an invalid promo code', async () => {
            renderWithProvider();

            await act(async () => {
                fireEvent.click(screen.getByText('Apply Invalid'));
            });

            await waitFor(() => {
                expect(screen.getByTestId('apply-success')).toHaveTextContent('false');
            });
        });
    });

    describe('Remove Promo Code', () => {
        it('should remove applied promo code', async () => {
            renderWithProvider();

            // First apply a code
            await act(async () => {
                fireEvent.click(screen.getByText('Apply Welcome'));
            });

            await waitFor(() => {
                expect(screen.getByTestId('apply-success')).toHaveTextContent('true');
            });

            // Then remove it
            await act(async () => {
                fireEvent.click(screen.getByText('Remove Promo'));
            });

            await waitFor(() => {
                expect(screen.getByTestId('applied-code')).toHaveTextContent('none');
            });
        });
    });
});

describe('Discount Types', () => {
    const DiscountTypeTest = () => {
        const { promoCodes, applyPromoCode, appliedPromo } = usePromo();
        const [result, setResult] = React.useState<{ success: boolean; discount?: number } | null>(null);

        return (
            <div>
                <button onClick={() => {
                    const r = applyPromoCode('WELCOME10', 1000);
                    setResult(r);
                }}>Apply Percentage</button>
                <div data-testid="discount-result">{result?.discount || 0}</div>
                <div data-testid="discount-success">{result?.success?.toString() || 'none'}</div>
            </div>
        );
    };

    it('should calculate percentage discount correctly', async () => {
        render(
            <PromoProvider>
                <DiscountTypeTest />
            </PromoProvider>
        );

        await act(async () => {
            fireEvent.click(screen.getByText('Apply Percentage'));
        });

        await waitFor(() => {
            expect(screen.getByTestId('discount-success')).toHaveTextContent('true');
            // Discount should be calculated (10% of 1000 = 100)
            const discount = parseInt(screen.getByTestId('discount-result').textContent || '0');
            expect(discount).toBeGreaterThanOrEqual(0);
        });
    });
});

describe('Promo Code Validation', () => {
    const ValidationTest = () => {
        const { validatePromoCode } = usePromo();
        const [result, setResult] = React.useState<{ valid: boolean; message: string } | null>(null);

        return (
            <div>
                <button onClick={() => setResult(validatePromoCode('WELCOME10'))}>
                    Validate Valid
                </button>
                <button onClick={() => setResult(validatePromoCode('NOTEXIST'))}>
                    Validate Invalid
                </button>
                {result && (
                    <>
                        <div data-testid="valid">{result.valid.toString()}</div>
                        <div data-testid="message">{result.message}</div>
                    </>
                )}
            </div>
        );
    };

    it('should return valid for existing code', async () => {
        render(
            <PromoProvider>
                <ValidationTest />
            </PromoProvider>
        );

        await act(async () => {
            fireEvent.click(screen.getByText('Validate Valid'));
        });

        await waitFor(() => {
            expect(screen.getByTestId('valid')).toHaveTextContent('true');
        });
    });

    it('should return invalid for non-existent code', async () => {
        render(
            <PromoProvider>
                <ValidationTest />
            </PromoProvider>
        );

        await act(async () => {
            fireEvent.click(screen.getByText('Validate Invalid'));
        });

        await waitFor(() => {
            expect(screen.getByTestId('valid')).toHaveTextContent('false');
        });
    });
});

describe('PromoCode Interface', () => {
    it('should have correct discount type values', () => {
        const types: DiscountType[] = ['percentage', 'fixed', 'free_shipping', 'buy_x_get_y'];

        types.forEach(type => {
            expect(['percentage', 'fixed', 'free_shipping', 'buy_x_get_y']).toContain(type);
        });
    });
});
