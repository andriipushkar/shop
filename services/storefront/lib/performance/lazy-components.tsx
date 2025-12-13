'use client';

import dynamic from 'next/dynamic';
import React, { ComponentType, ReactNode } from 'react';

// Loading placeholder
export const LoadingPlaceholder = ({ height = '200px' }: { height?: string }) => (
    <div
        className="animate-pulse bg-gray-200 rounded"
        style={{ height, width: '100%' }}
    />
);

// Error fallback
export const ErrorFallback = ({ error }: { error: Error }) => (
    <div className="text-red-500 p-4 border border-red-200 rounded">
        <p>Помилка завантаження компонента</p>
        <p className="text-sm text-gray-500">{error.message}</p>
    </div>
);

// Generic lazy loader with error boundary
export function createLazyComponent<T extends object>(
    importFn: () => Promise<{ default: ComponentType<T> }>,
    options: {
        loading?: ReactNode;
        loadingHeight?: string;
        ssr?: boolean;
    } = {}
) {
    return dynamic(importFn, {
        loading: () => (
            options.loading || <LoadingPlaceholder height={options.loadingHeight} />
        ) as React.JSX.Element,
        ssr: options.ssr ?? false,
    });
}

// Lazy components should be created in the consuming code like this:
// export const LazyMyComponent = createLazyComponent(
//     () => import('@/components/MyComponent'),
//     { loadingHeight: '300px', ssr: false }
// );

// Example usage for common components:
// const LazyMap = createLazyComponent(
//     () => import('@/components/common/Map'),
//     { loadingHeight: '400px', ssr: false }
// );
