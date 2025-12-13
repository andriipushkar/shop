/**
 * ErrorBoundary Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as Sentry from '@sentry/nextjs';
import { ErrorBoundary, withErrorBoundary, useErrorHandler } from '@/components/ErrorBoundary';

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
    withScope: jest.fn((callback) => callback({ setLevel: jest.fn(), setContext: jest.fn(), setTag: jest.fn() })),
    showReportDialog: jest.fn(),
}));

// Test component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean; error?: Error }> = ({
    shouldThrow = true,
    error = new Error('Test error')
}) => {
    if (shouldThrow) {
        throw error;
    }
    return <div>No error</div>;
};

describe('ErrorBoundary', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        // Suppress console.error for these tests
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('Error Catching', () => {
        it('should render children when no error occurs', () => {
            render(
                <ErrorBoundary>
                    <div>Test content</div>
                </ErrorBoundary>
            );

            expect(screen.getByText('Test content')).toBeInTheDocument();
        });

        it('should render default fallback when error occurs', () => {
            render(
                <ErrorBoundary>
                    <ThrowError />
                </ErrorBoundary>
            );

            expect(screen.getByText('Something went wrong')).toBeInTheDocument();
            expect(screen.getByText(/We apologize for the inconvenience/)).toBeInTheDocument();
        });

        it('should render custom fallback component', () => {
            const CustomFallback = <div>Custom error message</div>;

            render(
                <ErrorBoundary fallback={CustomFallback}>
                    <ThrowError />
                </ErrorBoundary>
            );

            expect(screen.getByText('Custom error message')).toBeInTheDocument();
        });

        it('should render custom fallback function', () => {
            const fallbackFn = (error: Error, reset: () => void) => (
                <div>
                    <p>Error: {error.message}</p>
                    <button onClick={reset}>Reset</button>
                </div>
            );

            render(
                <ErrorBoundary fallback={fallbackFn}>
                    <ThrowError error={new Error('Custom error')} />
                </ErrorBoundary>
            );

            expect(screen.getByText('Error: Custom error')).toBeInTheDocument();
            expect(screen.getByText('Reset')).toBeInTheDocument();
        });
    });

    describe('Sentry Integration', () => {
        it('should capture exception to Sentry', () => {
            const error = new Error('Test error');

            render(
                <ErrorBoundary>
                    <ThrowError error={error} />
                </ErrorBoundary>
            );

            expect(Sentry.captureException).toHaveBeenCalledWith(error);
        });

        it('should call custom onError handler', () => {
            const onError = jest.fn();
            const error = new Error('Test error');

            render(
                <ErrorBoundary onError={onError}>
                    <ThrowError error={error} />
                </ErrorBoundary>
            );

            expect(onError).toHaveBeenCalledWith(
                error,
                expect.objectContaining({
                    componentStack: expect.any(String),
                })
            );
        });

        it('should set custom tags in Sentry', () => {
            const mockSetTag = jest.fn();
            (Sentry.withScope as jest.Mock).mockImplementation((callback) => {
                callback({ setLevel: jest.fn(), setContext: jest.fn(), setTag: mockSetTag });
            });

            const tags = { feature: 'checkout', version: '1.0.0' };

            render(
                <ErrorBoundary tags={tags}>
                    <ThrowError />
                </ErrorBoundary>
            );

            expect(mockSetTag).toHaveBeenCalledWith('errorBoundary', 'true');
            expect(mockSetTag).toHaveBeenCalledWith('feature', 'checkout');
            expect(mockSetTag).toHaveBeenCalledWith('version', '1.0.0');
        });

        it('should set custom context in Sentry', () => {
            const mockSetContext = jest.fn();
            (Sentry.withScope as jest.Mock).mockImplementation((callback) => {
                callback({ setLevel: jest.fn(), setContext: mockSetContext, setTag: jest.fn() });
            });

            const context = { userId: '123', page: '/checkout' };

            render(
                <ErrorBoundary context={context}>
                    <ThrowError />
                </ErrorBoundary>
            );

            expect(mockSetContext).toHaveBeenCalledWith('errorBoundary', context);
        });

        it('should call beforeCapture hook', () => {
            const beforeCapture = jest.fn();
            const mockScope = { setLevel: jest.fn(), setContext: jest.fn(), setTag: jest.fn() };

            (Sentry.withScope as jest.Mock).mockImplementation((callback) => {
                callback(mockScope);
            });

            const error = new Error('Test error');

            render(
                <ErrorBoundary beforeCapture={beforeCapture}>
                    <ThrowError error={error} />
                </ErrorBoundary>
            );

            expect(beforeCapture).toHaveBeenCalledWith(
                mockScope,
                error,
                expect.objectContaining({
                    componentStack: expect.any(String),
                })
            );
        });

        it('should show Sentry report dialog when showDialog is true', () => {
            // Mock Sentry.captureException to return an event ID
            (Sentry.captureException as jest.Mock).mockReturnValue('event-123');

            render(
                <ErrorBoundary showDialog={true}>
                    <ThrowError />
                </ErrorBoundary>
            );

            expect(Sentry.showReportDialog).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventId: 'event-123',
                })
            );
        });
    });

    describe('Error Recovery', () => {
        it('should reset error boundary when reset is called', () => {
            // Use a mutable ref to control error throwing after reset
            let shouldThrowError = true;

            const ConditionalError = () => {
                if (shouldThrowError) {
                    throw new Error('Test error');
                }
                return <div>No error</div>;
            };

            const fallbackFn = (error: Error, reset: () => void) => (
                <div>
                    <p>Error occurred</p>
                    <button onClick={() => {
                        // Stop throwing before reset
                        shouldThrowError = false;
                        reset();
                    }}>Try again</button>
                </div>
            );

            render(
                <ErrorBoundary fallback={fallbackFn}>
                    <ConditionalError />
                </ErrorBoundary>
            );

            expect(screen.getByText('Error occurred')).toBeInTheDocument();

            // Click reset button - this will set shouldThrowError to false, then reset
            fireEvent.click(screen.getByText('Try again'));

            expect(screen.getByText('No error')).toBeInTheDocument();
        });
    });

    describe('Error Handling Edge Cases', () => {
        it('should handle errors in onError handler gracefully', () => {
            const onError = jest.fn(() => {
                throw new Error('Handler error');
            });

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            render(
                <ErrorBoundary onError={onError}>
                    <ThrowError />
                </ErrorBoundary>
            );

            expect(onError).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });

        it('should handle errors in beforeCapture hook gracefully', () => {
            const beforeCapture = jest.fn(() => {
                throw new Error('BeforeCapture error');
            });

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            render(
                <ErrorBoundary beforeCapture={beforeCapture}>
                    <ThrowError />
                </ErrorBoundary>
            );

            expect(beforeCapture).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });
    });

    describe('Default Fallback UI', () => {
        it('should show error message in default fallback', () => {
            const error = new Error('Specific error message');

            // Set NODE_ENV to development to show error details
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            render(
                <ErrorBoundary>
                    <ThrowError error={error} />
                </ErrorBoundary>
            );

            expect(screen.getByText('Specific error message')).toBeInTheDocument();

            process.env.NODE_ENV = originalEnv;
        });

        it('should have Try again button in default fallback', () => {
            render(
                <ErrorBoundary>
                    <ThrowError />
                </ErrorBoundary>
            );

            expect(screen.getByText('Try again')).toBeInTheDocument();
        });

        it('should have Go to homepage button in default fallback', () => {
            render(
                <ErrorBoundary>
                    <ThrowError />
                </ErrorBoundary>
            );

            expect(screen.getByText('Go to homepage')).toBeInTheDocument();
        });
    });
});

describe('withErrorBoundary HOC', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        (console.error as jest.Mock).mockRestore();
    });

    it('should wrap component with ErrorBoundary', () => {
        const TestComponent = () => <div>Test component</div>;
        const WrappedComponent = withErrorBoundary(TestComponent);

        render(<WrappedComponent />);

        expect(screen.getByText('Test component')).toBeInTheDocument();
    });

    it('should catch errors in wrapped component', () => {
        const WrappedComponent = withErrorBoundary(ThrowError, {
            fallback: <div>Error in wrapped component</div>,
        });

        render(<WrappedComponent />);

        expect(screen.getByText('Error in wrapped component')).toBeInTheDocument();
    });

    it('should set display name for wrapped component', () => {
        const TestComponent = () => <div>Test</div>;
        TestComponent.displayName = 'TestComponent';

        const WrappedComponent = withErrorBoundary(TestComponent);

        expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)');
    });

    it('should use component name if no display name', () => {
        const TestComponent = () => <div>Test</div>;

        const WrappedComponent = withErrorBoundary(TestComponent);

        expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)');
    });
});

describe('useErrorHandler hook', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        (console.error as jest.Mock).mockRestore();
    });

    it('should throw error when called', () => {
        const TestComponent = () => {
            const throwError = useErrorHandler();

            return (
                <button onClick={() => throwError(new Error('Hook error'))}>
                    Throw error
                </button>
            );
        };

        const { container } = render(
            <ErrorBoundary fallback={<div>Error caught</div>}>
                <TestComponent />
            </ErrorBoundary>
        );

        const button = screen.getByText('Throw error');
        fireEvent.click(button);

        expect(screen.getByText('Error caught')).toBeInTheDocument();
    });
});
