/**
 * Secure pagination utilities
 * Prevents DoS attacks by validating and bounding pagination parameters
 */

export interface PaginationParams {
    page: number;
    pageSize: number;
}

export interface PaginationConfig {
    maxPageSize?: number;
    defaultPageSize?: number;
    minPage?: number;
}

const DEFAULT_CONFIG: Required<PaginationConfig> = {
    maxPageSize: 100,
    defaultPageSize: 20,
    minPage: 1,
};

/**
 * Safely parses and validates pagination parameters
 * Prevents DoS by bounding page size and validating page numbers
 */
export function parsePagination(
    pageParam: string | null,
    pageSizeParam: string | null,
    config: PaginationConfig = {}
): PaginationParams {
    const { maxPageSize, defaultPageSize, minPage } = { ...DEFAULT_CONFIG, ...config };

    // Parse page with fallback
    let page = parseInt(pageParam || String(minPage), 10);
    if (isNaN(page) || page < minPage) {
        page = minPage;
    }

    // Parse pageSize with bounds
    let pageSize = parseInt(pageSizeParam || String(defaultPageSize), 10);
    if (isNaN(pageSize) || pageSize < 1) {
        pageSize = defaultPageSize;
    }
    // Enforce maximum page size to prevent DoS
    pageSize = Math.min(pageSize, maxPageSize);

    return { page, pageSize };
}

/**
 * Validates a numeric parameter with bounds
 */
export function parseNumericParam(
    param: string | null,
    defaultValue: number,
    min: number = 0,
    max: number = Number.MAX_SAFE_INTEGER
): number {
    if (param === null) return defaultValue;

    const value = parseInt(param, 10);
    if (isNaN(value)) return defaultValue;

    return Math.max(min, Math.min(value, max));
}

/**
 * Validates an enum parameter
 */
export function parseEnumParam<T extends string>(
    param: string | null,
    validValues: readonly T[],
    defaultValue?: T
): T | undefined {
    if (param === null) return defaultValue;
    if (validValues.includes(param as T)) return param as T;
    return defaultValue;
}
