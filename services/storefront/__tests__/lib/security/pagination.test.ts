/**
 * Tests for Pagination Security Utilities
 */

import {
    parsePagination,
    parseNumericParam,
    parseEnumParam,
} from '@/lib/security/pagination';

describe('Pagination Security', () => {
    describe('parsePagination', () => {
        it('returns defaults for null params', () => {
            const result = parsePagination(null, null);
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(20);
        });

        it('parses valid page and pageSize', () => {
            const result = parsePagination('5', '50');
            expect(result.page).toBe(5);
            expect(result.pageSize).toBe(50);
        });

        it('caps pageSize at maxPageSize (DoS prevention)', () => {
            const result = parsePagination('1', '1000000');
            expect(result.pageSize).toBe(100); // Default max is 100
        });

        it('uses custom maxPageSize', () => {
            const result = parsePagination('1', '500', { maxPageSize: 50 });
            expect(result.pageSize).toBe(50);
        });

        it('handles NaN page', () => {
            const result = parsePagination('invalid', '20');
            expect(result.page).toBe(1);
        });

        it('handles NaN pageSize', () => {
            const result = parsePagination('1', 'invalid');
            expect(result.pageSize).toBe(20);
        });

        it('handles negative page', () => {
            const result = parsePagination('-5', '20');
            expect(result.page).toBe(1);
        });

        it('handles zero pageSize', () => {
            const result = parsePagination('1', '0');
            expect(result.pageSize).toBe(20);
        });

        it('handles negative pageSize', () => {
            const result = parsePagination('1', '-10');
            expect(result.pageSize).toBe(20);
        });

        it('uses custom defaultPageSize', () => {
            const result = parsePagination(null, null, { defaultPageSize: 50 });
            expect(result.pageSize).toBe(50);
        });

        it('uses custom minPage', () => {
            const result = parsePagination('0', '20', { minPage: 0 });
            expect(result.page).toBe(0);
        });

        it('prevents DoS with extreme values', () => {
            const result = parsePagination('999999999', '999999999');
            expect(result.page).toBe(999999999); // Page is allowed to be high
            expect(result.pageSize).toBe(100); // But pageSize is capped
        });
    });

    describe('parseNumericParam', () => {
        it('returns default for null', () => {
            expect(parseNumericParam(null, 10)).toBe(10);
        });

        it('parses valid number', () => {
            expect(parseNumericParam('42', 10)).toBe(42);
        });

        it('returns default for invalid string', () => {
            expect(parseNumericParam('abc', 10)).toBe(10);
        });

        it('enforces minimum', () => {
            expect(parseNumericParam('-5', 10, 0)).toBe(0);
        });

        it('enforces maximum', () => {
            expect(parseNumericParam('1000', 10, 0, 100)).toBe(100);
        });

        it('handles float strings', () => {
            expect(parseNumericParam('3.14', 10)).toBe(3);
        });
    });

    describe('parseEnumParam', () => {
        const validValues = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;

        it('returns undefined for null without default', () => {
            expect(parseEnumParam(null, validValues)).toBeUndefined();
        });

        it('returns default for null with default', () => {
            expect(parseEnumParam(null, validValues, 'DRAFT')).toBe('DRAFT');
        });

        it('parses valid enum value', () => {
            expect(parseEnumParam('ACTIVE', validValues)).toBe('ACTIVE');
        });

        it('returns default for invalid value', () => {
            expect(parseEnumParam('INVALID', validValues, 'DRAFT')).toBe('DRAFT');
        });

        it('returns undefined for invalid value without default', () => {
            expect(parseEnumParam('INVALID', validValues)).toBeUndefined();
        });

        it('is case-sensitive', () => {
            expect(parseEnumParam('active', validValues)).toBeUndefined();
        });
    });
});
