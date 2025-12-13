'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiState<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
}

interface UseApiOptions {
    immediate?: boolean;
    onSuccess?: (data: unknown) => void;
    onError?: (error: Error) => void;
}

/**
 * Generic hook for API calls
 */
export function useApi<T>(
    apiCall: () => Promise<T>,
    options: UseApiOptions = {}
) {
    const { immediate = true, onSuccess, onError } = options;
    const [state, setState] = useState<UseApiState<T>>({
        data: null,
        loading: immediate,
        error: null,
    });

    const mountedRef = useRef(true);

    const execute = useCallback(async () => {
        setState(prev => ({ ...prev, loading: true, error: null }));

        try {
            const data = await apiCall();
            if (mountedRef.current) {
                setState({ data, loading: false, error: null });
                onSuccess?.(data);
            }
            return data;
        } catch (error) {
            if (mountedRef.current) {
                const err = error instanceof Error ? error : new Error('Unknown error');
                setState({ data: null, loading: false, error: err });
                onError?.(err);
            }
            throw error;
        }
    }, [apiCall, onSuccess, onError]);

    useEffect(() => {
        mountedRef.current = true;
        if (immediate) {
            execute();
        }
        return () => {
            mountedRef.current = false;
        };
    }, [immediate, execute]);

    const refetch = useCallback(() => execute(), [execute]);

    return { ...state, refetch, execute };
}

/**
 * Hook for mutations (POST, PUT, DELETE)
 */
export function useMutation<T, P = unknown>(
    mutationFn: (params: P) => Promise<T>,
    options: {
        onSuccess?: (data: T) => void;
        onError?: (error: Error) => void;
    } = {}
) {
    const [state, setState] = useState<UseApiState<T>>({
        data: null,
        loading: false,
        error: null,
    });

    const mutate = useCallback(async (params: P) => {
        setState(prev => ({ ...prev, loading: true, error: null }));

        try {
            const data = await mutationFn(params);
            setState({ data, loading: false, error: null });
            options.onSuccess?.(data);
            return data;
        } catch (error) {
            const err = error instanceof Error ? error : new Error('Unknown error');
            setState({ data: null, loading: false, error: err });
            options.onError?.(err);
            throw error;
        }
    }, [mutationFn, options]);

    const reset = useCallback(() => {
        setState({ data: null, loading: false, error: null });
    }, []);

    return { ...state, mutate, reset };
}

/**
 * Hook for paginated data
 */
export function usePaginatedApi<T>(
    apiCall: (page: number, limit: number) => Promise<{ items: T[]; total: number }>,
    options: { limit?: number } = {}
) {
    const { limit = 20 } = options;
    const [page, setPage] = useState(1);
    const [items, setItems] = useState<T[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchPage = useCallback(async (pageNum: number) => {
        setLoading(true);
        setError(null);

        try {
            const result = await apiCall(pageNum, limit);
            setItems(result.items);
            setTotal(result.total);
            setPage(pageNum);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setLoading(false);
        }
    }, [apiCall, limit]);

    useEffect(() => {
        fetchPage(1);
    }, [fetchPage]);

    const nextPage = useCallback(() => {
        const maxPage = Math.ceil(total / limit);
        if (page < maxPage) {
            fetchPage(page + 1);
        }
    }, [page, total, limit, fetchPage]);

    const prevPage = useCallback(() => {
        if (page > 1) {
            fetchPage(page - 1);
        }
    }, [page, fetchPage]);

    const goToPage = useCallback((pageNum: number) => {
        const maxPage = Math.ceil(total / limit);
        if (pageNum >= 1 && pageNum <= maxPage) {
            fetchPage(pageNum);
        }
    }, [total, limit, fetchPage]);

    const refetch = useCallback(() => fetchPage(page), [fetchPage, page]);

    return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        loading,
        error,
        nextPage,
        prevPage,
        goToPage,
        refetch,
    };
}

/**
 * Hook for infinite scroll data
 */
export function useInfiniteApi<T>(
    apiCall: (page: number, limit: number) => Promise<{ items: T[]; total: number }>,
    options: { limit?: number } = {}
) {
    const { limit = 20 } = options;
    const [items, setItems] = useState<T[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [hasMore, setHasMore] = useState(true);

    const fetchInitial = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await apiCall(1, limit);
            setItems(result.items);
            setTotal(result.total);
            setPage(1);
            setHasMore(result.items.length < result.total);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setLoading(false);
        }
    }, [apiCall, limit]);

    useEffect(() => {
        fetchInitial();
    }, [fetchInitial]);

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;

        setLoadingMore(true);
        try {
            const nextPage = page + 1;
            const result = await apiCall(nextPage, limit);
            setItems(prev => [...prev, ...result.items]);
            setPage(nextPage);
            setHasMore(items.length + result.items.length < result.total);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setLoadingMore(false);
        }
    }, [apiCall, limit, page, loadingMore, hasMore, items.length]);

    const refetch = useCallback(() => fetchInitial(), [fetchInitial]);

    return {
        items,
        total,
        loading,
        loadingMore,
        error,
        hasMore,
        loadMore,
        refetch,
    };
}

export default useApi;
