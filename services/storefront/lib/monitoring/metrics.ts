/**
 * Application Metrics Service
 *
 * Collects and exposes metrics for monitoring (Datadog, Prometheus, etc.)
 */

interface MetricValue {
    value: number;
    timestamp: number;
    tags?: Record<string, string>;
}

interface Counter {
    name: string;
    help: string;
    values: Map<string, number>;
}

interface Gauge {
    name: string;
    help: string;
    values: Map<string, MetricValue>;
}

interface Histogram {
    name: string;
    help: string;
    buckets: number[];
    values: Map<string, { count: number; sum: number; buckets: number[] }>;
}

class MetricsService {
    private counters: Map<string, Counter> = new Map();
    private gauges: Map<string, Gauge> = new Map();
    private histograms: Map<string, Histogram> = new Map();

    private datadogApiKey = process.env.DATADOG_API_KEY;
    private datadogAppKey = process.env.DATADOG_APP_KEY;

    // ==================== COUNTERS ====================

    /**
     * Create a counter metric
     */
    createCounter(name: string, help: string): void {
        if (!this.counters.has(name)) {
            this.counters.set(name, {
                name,
                help,
                values: new Map(),
            });
        }
    }

    /**
     * Increment a counter
     */
    incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
        const counter = this.counters.get(name);
        if (!counter) {
            this.createCounter(name, '');
            this.incrementCounter(name, value, tags);
            return;
        }

        const key = this.tagsToKey(tags);
        const current = counter.values.get(key) || 0;
        counter.values.set(key, current + value);

        // Send to Datadog if configured
        this.sendToDatadog('count', name, value, tags);
    }

    // ==================== GAUGES ====================

    /**
     * Create a gauge metric
     */
    createGauge(name: string, help: string): void {
        if (!this.gauges.has(name)) {
            this.gauges.set(name, {
                name,
                help,
                values: new Map(),
            });
        }
    }

    /**
     * Set a gauge value
     */
    setGauge(name: string, value: number, tags?: Record<string, string>): void {
        const gauge = this.gauges.get(name);
        if (!gauge) {
            this.createGauge(name, '');
            this.setGauge(name, value, tags);
            return;
        }

        const key = this.tagsToKey(tags);
        gauge.values.set(key, {
            value,
            timestamp: Date.now(),
            tags,
        });

        // Send to Datadog if configured
        this.sendToDatadog('gauge', name, value, tags);
    }

    // ==================== HISTOGRAMS ====================

    /**
     * Create a histogram metric
     */
    createHistogram(
        name: string,
        help: string,
        buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    ): void {
        if (!this.histograms.has(name)) {
            this.histograms.set(name, {
                name,
                help,
                buckets: buckets.sort((a, b) => a - b),
                values: new Map(),
            });
        }
    }

    /**
     * Observe a histogram value
     */
    observeHistogram(name: string, value: number, tags?: Record<string, string>): void {
        const histogram = this.histograms.get(name);
        if (!histogram) {
            this.createHistogram(name, '');
            this.observeHistogram(name, value, tags);
            return;
        }

        const key = this.tagsToKey(tags);
        let data = histogram.values.get(key);

        if (!data) {
            data = {
                count: 0,
                sum: 0,
                buckets: histogram.buckets.map(() => 0),
            };
            histogram.values.set(key, data);
        }

        data.count++;
        data.sum += value;

        // Increment bucket counts
        for (let i = 0; i < histogram.buckets.length; i++) {
            if (value <= histogram.buckets[i]) {
                data.buckets[i]++;
            }
        }

        // Send to Datadog if configured
        this.sendToDatadog('distribution', name, value, tags);
    }

    // ==================== TIMING ====================

    /**
     * Start a timer
     */
    startTimer(name: string, tags?: Record<string, string>): () => number {
        const start = process.hrtime.bigint();

        return () => {
            const end = process.hrtime.bigint();
            const durationMs = Number(end - start) / 1e6;
            this.observeHistogram(name, durationMs, tags);
            return durationMs;
        };
    }

    /**
     * Time an async function
     */
    async timeAsync<T>(
        name: string,
        fn: () => Promise<T>,
        tags?: Record<string, string>
    ): Promise<T> {
        const stopTimer = this.startTimer(name, tags);
        try {
            const result = await fn();
            stopTimer();
            return result;
        } catch (error) {
            stopTimer();
            throw error;
        }
    }

    // ==================== PREDEFINED METRICS ====================

    /**
     * Track HTTP request
     */
    trackRequest(
        method: string,
        path: string,
        statusCode: number,
        durationMs: number
    ): void {
        const tags = { method, path: this.normalizePath(path), status: statusCode.toString() };

        this.incrementCounter('http_requests_total', 1, tags);
        this.observeHistogram('http_request_duration_ms', durationMs, tags);

        if (statusCode >= 500) {
            this.incrementCounter('http_server_errors_total', 1, tags);
        } else if (statusCode >= 400) {
            this.incrementCounter('http_client_errors_total', 1, tags);
        }
    }

    /**
     * Track database query
     */
    trackDatabaseQuery(operation: string, table: string, durationMs: number): void {
        const tags = { operation, table };
        this.observeHistogram('db_query_duration_ms', durationMs, tags);
        this.incrementCounter('db_queries_total', 1, tags);
    }

    /**
     * Track cache operation
     */
    trackCacheOperation(operation: string, hit: boolean): void {
        const tags = { operation, result: hit ? 'hit' : 'miss' };
        this.incrementCounter('cache_operations_total', 1, tags);
    }

    /**
     * Track marketplace sync
     */
    trackMarketplaceSync(marketplace: string, success: boolean, itemCount: number): void {
        const tags = { marketplace, status: success ? 'success' : 'failure' };
        this.incrementCounter('marketplace_sync_total', 1, tags);
        this.incrementCounter('marketplace_sync_items', itemCount, tags);
    }

    /**
     * Track order
     */
    trackOrder(marketplace: string, total: number): void {
        const tags = { marketplace: marketplace || 'direct' };
        this.incrementCounter('orders_total', 1, tags);
        this.incrementCounter('orders_revenue', total, tags);
    }

    /**
     * Track active users
     */
    setActiveUsers(count: number): void {
        this.setGauge('active_users', count);
    }

    /**
     * Track cart metrics
     */
    trackCartAction(action: 'add' | 'remove' | 'checkout', productId: string): void {
        this.incrementCounter('cart_actions_total', 1, { action, product_id: productId });
    }

    // ==================== EXPORT ====================

    /**
     * Get all metrics in Prometheus format
     */
    toPrometheusFormat(): string {
        const lines: string[] = [];

        // Counters
        for (const [, counter] of this.counters) {
            lines.push(`# HELP ${counter.name} ${counter.help}`);
            lines.push(`# TYPE ${counter.name} counter`);
            for (const [tags, value] of counter.values) {
                lines.push(`${counter.name}${tags} ${value}`);
            }
        }

        // Gauges
        for (const [, gauge] of this.gauges) {
            lines.push(`# HELP ${gauge.name} ${gauge.help}`);
            lines.push(`# TYPE ${gauge.name} gauge`);
            for (const [tags, metric] of gauge.values) {
                lines.push(`${gauge.name}${tags} ${metric.value}`);
            }
        }

        // Histograms
        for (const [, histogram] of this.histograms) {
            lines.push(`# HELP ${histogram.name} ${histogram.help}`);
            lines.push(`# TYPE ${histogram.name} histogram`);
            for (const [tags, data] of histogram.values) {
                for (let i = 0; i < histogram.buckets.length; i++) {
                    const le = histogram.buckets[i];
                    const bucketTags = tags ? `${tags.slice(0, -1)},le="${le}"}` : `{le="${le}"}`;
                    lines.push(`${histogram.name}_bucket${bucketTags} ${data.buckets[i]}`);
                }
                const infTags = tags ? `${tags.slice(0, -1)},le="+Inf"}` : `{le="+Inf"}`;
                lines.push(`${histogram.name}_bucket${infTags} ${data.count}`);
                lines.push(`${histogram.name}_sum${tags} ${data.sum}`);
                lines.push(`${histogram.name}_count${tags} ${data.count}`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Get all metrics as JSON
     */
    toJSON(): Record<string, unknown> {
        const result: Record<string, unknown> = {
            counters: {},
            gauges: {},
            histograms: {},
        };

        for (const [name, counter] of this.counters) {
            (result.counters as Record<string, unknown>)[name] = Object.fromEntries(counter.values);
        }

        for (const [name, gauge] of this.gauges) {
            (result.gauges as Record<string, unknown>)[name] = Object.fromEntries(gauge.values);
        }

        for (const [name, histogram] of this.histograms) {
            (result.histograms as Record<string, unknown>)[name] = Object.fromEntries(histogram.values);
        }

        return result;
    }

    // ==================== HELPERS ====================

    private tagsToKey(tags?: Record<string, string>): string {
        if (!tags || Object.keys(tags).length === 0) {
            return '';
        }

        const parts = Object.entries(tags)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}="${v}"`);

        return `{${parts.join(',')}}`;
    }

    private normalizePath(path: string): string {
        // Replace dynamic segments with placeholders
        return path
            .replace(/\/[0-9a-f]{24,}/gi, '/:id')
            .replace(/\/\d+/g, '/:id')
            .replace(/\?.*$/, '');
    }

    private async sendToDatadog(
        type: string,
        name: string,
        value: number,
        tags?: Record<string, string>
    ): Promise<void> {
        if (!this.datadogApiKey) return;

        const datadogTags = tags
            ? Object.entries(tags).map(([k, v]) => `${k}:${v}`)
            : [];

        try {
            await fetch('https://api.datadoghq.com/api/v1/series', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'DD-API-KEY': this.datadogApiKey,
                },
                body: JSON.stringify({
                    series: [
                        {
                            metric: `shop.${name}`,
                            type,
                            points: [[Math.floor(Date.now() / 1000), value]],
                            tags: datadogTags,
                        },
                    ],
                }),
            });
        } catch (error) {
            console.error('[Metrics] Failed to send to Datadog:', error);
        }
    }

    /**
     * Reset all metrics (for testing)
     */
    reset(): void {
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
    }
}

// Singleton instance
export const metrics = new MetricsService();

// Initialize default metrics
metrics.createCounter('http_requests_total', 'Total HTTP requests');
metrics.createCounter('http_server_errors_total', 'Total HTTP 5xx errors');
metrics.createCounter('http_client_errors_total', 'Total HTTP 4xx errors');
metrics.createHistogram('http_request_duration_ms', 'HTTP request duration in milliseconds');
metrics.createHistogram('db_query_duration_ms', 'Database query duration in milliseconds');
metrics.createCounter('db_queries_total', 'Total database queries');
metrics.createCounter('cache_operations_total', 'Total cache operations');
metrics.createCounter('marketplace_sync_total', 'Total marketplace sync operations');
metrics.createCounter('marketplace_sync_items', 'Total items synced to marketplaces');
metrics.createCounter('orders_total', 'Total orders');
metrics.createCounter('orders_revenue', 'Total order revenue in UAH');
metrics.createGauge('active_users', 'Number of active users');
metrics.createCounter('cart_actions_total', 'Total cart actions');
