/**
 * Tests for Structured Logger
 */

import {
    logger,
    paymentLogger,
    apiLogger,
    authLogger,
    deliveryLogger,
    warehouseLogger,
    addTransport,
    removeTransport,
    setLogContext,
    clearLogContext,
    LogEntry,
} from '@/lib/logger';

describe('Structured Logger', () => {
    let consoleSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
        consoleSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        clearLogContext();
    });

    describe('logger methods', () => {
        it('logs debug messages', () => {
            logger.debug('Debug message');
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('logs info messages', () => {
            logger.info('Info message');
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('logs warn messages', () => {
            logger.warn('Warning message');
            expect(consoleWarnSpy).toHaveBeenCalled();
        });

        it('logs error messages', () => {
            logger.error('Error message');
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('logs fatal messages', () => {
            logger.fatal('Fatal message');
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('context logging', () => {
        it('includes context in log', () => {
            logger.info('Test message', { key: 'value' });
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('includes error details', () => {
            const error = new Error('Test error');
            logger.error('Error occurred', error);
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('includes source in log', () => {
            logger.info('Test message', undefined, 'TestSource');
            expect(consoleSpy).toHaveBeenCalled();
        });
    });

    describe('child loggers', () => {
        it('creates child logger with source', () => {
            const child = logger.child('MyService');
            child.info('Child message');
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('child logger includes default context', () => {
            const child = logger.child('MyService', { version: '1.0' });
            child.info('Child message');
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('child logger merges context', () => {
            const child = logger.child('MyService', { version: '1.0' });
            child.info('Child message', { extra: 'data' });
            expect(consoleSpy).toHaveBeenCalled();
        });
    });

    describe('specialized loggers', () => {
        it('paymentLogger is defined', () => {
            expect(paymentLogger).toBeDefined();
            expect(paymentLogger.info).toBeDefined();
        });

        it('apiLogger is defined', () => {
            expect(apiLogger).toBeDefined();
            expect(apiLogger.info).toBeDefined();
        });

        it('authLogger is defined', () => {
            expect(authLogger).toBeDefined();
            expect(authLogger.info).toBeDefined();
        });

        it('deliveryLogger is defined', () => {
            expect(deliveryLogger).toBeDefined();
            expect(deliveryLogger.info).toBeDefined();
        });

        it('warehouseLogger is defined', () => {
            expect(warehouseLogger).toBeDefined();
            expect(warehouseLogger.info).toBeDefined();
        });
    });

    describe('custom transports', () => {
        it('adds custom transport', () => {
            const customTransport = jest.fn();
            addTransport(customTransport);

            logger.info('Test message');

            expect(customTransport).toHaveBeenCalled();

            removeTransport(customTransport);
        });

        it('removes custom transport', () => {
            const customTransport = jest.fn();
            addTransport(customTransport);
            removeTransport(customTransport);

            logger.info('Test message');

            expect(customTransport).not.toHaveBeenCalled();
        });

        it('transport receives LogEntry', () => {
            const customTransport = jest.fn();
            addTransport(customTransport);

            logger.info('Test message', { key: 'value' });

            expect(customTransport).toHaveBeenCalledWith(
                expect.objectContaining({
                    level: 'info',
                    message: 'Test message',
                    context: { key: 'value' },
                })
            );

            removeTransport(customTransport);
        });
    });

    describe('request context', () => {
        it('sets and includes request context', () => {
            const customTransport = jest.fn();
            addTransport(customTransport);

            setLogContext('req-123', 'user-456');
            logger.info('Test message');

            expect(customTransport).toHaveBeenCalledWith(
                expect.objectContaining({
                    requestId: 'req-123',
                    userId: 'user-456',
                })
            );

            clearLogContext();
            removeTransport(customTransport);
        });

        it('clears request context', () => {
            const customTransport = jest.fn();
            addTransport(customTransport);

            setLogContext('req-123', 'user-456');
            clearLogContext();
            logger.info('Test message');

            expect(customTransport).toHaveBeenCalledWith(
                expect.objectContaining({
                    requestId: undefined,
                    userId: undefined,
                })
            );

            removeTransport(customTransport);
        });
    });

    describe('error handling', () => {
        it('handles Error objects', () => {
            const error = new Error('Test error');
            error.stack = 'Error stack trace';

            const customTransport = jest.fn();
            addTransport(customTransport);

            logger.error('Error occurred', error);

            expect(customTransport).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: {
                        name: 'Error',
                        message: 'Test error',
                        stack: 'Error stack trace',
                    },
                })
            );

            removeTransport(customTransport);
        });

        it('handles non-Error objects gracefully', () => {
            const customTransport = jest.fn();
            addTransport(customTransport);

            logger.error('Error occurred', 'string error');

            // Should not crash and should still log
            expect(customTransport).toHaveBeenCalled();

            removeTransport(customTransport);
        });
    });

    describe('LogEntry format', () => {
        it('includes timestamp', () => {
            const customTransport = jest.fn();
            addTransport(customTransport);

            logger.info('Test');

            const entry: LogEntry = customTransport.mock.calls[0][0];
            expect(entry.timestamp).toBeDefined();
            expect(new Date(entry.timestamp).getTime()).not.toBeNaN();

            removeTransport(customTransport);
        });

        it('includes level', () => {
            const customTransport = jest.fn();
            addTransport(customTransport);

            logger.info('Test');

            const entry: LogEntry = customTransport.mock.calls[0][0];
            expect(entry.level).toBe('info');

            removeTransport(customTransport);
        });

        it('includes message', () => {
            const customTransport = jest.fn();
            addTransport(customTransport);

            logger.info('Test message');

            const entry: LogEntry = customTransport.mock.calls[0][0];
            expect(entry.message).toBe('Test message');

            removeTransport(customTransport);
        });
    });
});
