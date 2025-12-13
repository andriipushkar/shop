'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * Error Boundary Props
 */
export interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    showDialog?: boolean;
    beforeCapture?: (scope: Sentry.Scope, error: Error, errorInfo: ErrorInfo) => void;
    level?: Sentry.SeverityLevel;
    tags?: Record<string, string>;
    context?: Record<string, unknown>;
}

/**
 * Error Boundary State
 */
interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Default fallback UI when an error occurs
 */
const DefaultErrorFallback: React.FC<{
    error: Error;
    reset: () => void;
}> = ({ error, reset }) => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
                <svg
                    className="w-6 h-6 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                </svg>
            </div>

            <h2 className="mt-4 text-center text-2xl font-bold text-gray-900">
                Something went wrong
            </h2>

            <p className="mt-2 text-center text-sm text-gray-600">
                We apologize for the inconvenience. An error has occurred and our team has been notified.
            </p>

            {process.env.NODE_ENV === 'development' && (
                <div className="mt-4 p-4 bg-red-50 rounded border border-red-200">
                    <p className="text-xs font-mono text-red-800 break-words">
                        {error.message}
                    </p>
                    {error.stack && (
                        <pre className="mt-2 text-xs font-mono text-red-700 overflow-auto max-h-48">
                            {error.stack}
                        </pre>
                    )}
                </div>
            )}

            <div className="mt-6 flex flex-col space-y-3">
                <button
                    onClick={reset}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                    Try again
                </button>

                <button
                    onClick={() => window.location.href = '/'}
                    className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                >
                    Go to homepage
                </button>
            </div>
        </div>
    </div>
);

/**
 * Error Boundary Component with Sentry Integration
 *
 * Catches errors in the React component tree and reports them to Sentry.
 * Provides a fallback UI when errors occur.
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   fallback={<div>Something went wrong</div>}
 *   onError={(error) => console.error(error)}
 * >
 *   <YourApp />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
        };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        // Update state so the next render will show the fallback UI
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        const { onError, showDialog, beforeCapture, level, tags, context } = this.props;

        // Call custom error handler if provided
        if (onError) {
            try {
                onError(error, errorInfo);
            } catch (handlerError) {
                console.error('Error in custom error handler:', handlerError);
            }
        }

        // Report to Sentry
        Sentry.withScope((scope) => {
            // Set error level
            scope.setLevel(level || 'error');

            // Add component stack trace
            if (errorInfo.componentStack) {
                scope.setContext('react', {
                    componentStack: errorInfo.componentStack,
                });
            }

            // Add custom tags
            scope.setTag('errorBoundary', 'true');
            if (tags) {
                Object.entries(tags).forEach(([key, value]) => {
                    scope.setTag(key, value);
                });
            }

            // Add custom context
            if (context) {
                scope.setContext('errorBoundary', context);
            }

            // Add browser context
            scope.setContext('browser', {
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
                language: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
                url: typeof window !== 'undefined' ? window.location.href : 'unknown',
            });

            // Call custom beforeCapture hook
            if (beforeCapture) {
                try {
                    beforeCapture(scope, error, errorInfo);
                } catch (captureError) {
                    console.error('Error in beforeCapture hook:', captureError);
                }
            }

            // Capture the exception
            const eventId = Sentry.captureException(error);

            // Show Sentry user feedback dialog
            if (showDialog && typeof window !== 'undefined') {
                Sentry.showReportDialog({
                    eventId,
                    title: 'It looks like we\'re having issues.',
                    subtitle: 'Our team has been notified.',
                    subtitle2: 'If you\'d like to help, tell us what happened below.',
                    labelSubmit: 'Submit Report',
                    labelClose: 'Close',
                });
            }
        });

        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error('ErrorBoundary caught an error:', error, errorInfo);
        }
    }

    resetErrorBoundary = (): void => {
        this.setState({
            hasError: false,
            error: null,
        });
    };

    render(): ReactNode {
        const { hasError, error } = this.state;
        const { children, fallback } = this.props;

        if (hasError && error) {
            // Render custom fallback if provided
            if (fallback) {
                if (typeof fallback === 'function') {
                    return fallback(error, this.resetErrorBoundary);
                }
                return fallback;
            }

            // Render default fallback
            return <DefaultErrorFallback error={error} reset={this.resetErrorBoundary} />;
        }

        return children;
    }
}

/**
 * HOC to wrap a component with ErrorBoundary
 *
 * @example
 * ```tsx
 * const SafeComponent = withErrorBoundary(MyComponent, {
 *   fallback: <div>Error occurred</div>,
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
    Component: React.ComponentType<P>,
    errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
    const WrappedComponent: React.FC<P> = (props) => (
        <ErrorBoundary {...errorBoundaryProps}>
            <Component {...props} />
        </ErrorBoundary>
    );

    WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

    return WrappedComponent;
}

/**
 * Hook to programmatically trigger error boundary
 * Useful for error handling in async operations
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const throwError = useErrorHandler();
 *
 *   const handleClick = async () => {
 *     try {
 *       await riskyOperation();
 *     } catch (error) {
 *       throwError(error);
 *     }
 *   };
 * }
 * ```
 */
export function useErrorHandler(): (error: Error) => void {
    const [, setError] = React.useState<Error | null>(null);

    return React.useCallback((error: Error) => {
        setError(() => {
            throw error;
        });
    }, []);
}

export default ErrorBoundary;
