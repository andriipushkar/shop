/**
 * Background Job Queue Service
 *
 * A simple in-memory job queue with persistence support.
 * In production, consider using Bull, BullMQ, or similar library with Redis.
 */

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface Job<T = unknown> {
    id: string;
    queue: string;
    name: string;
    data: T;
    status: JobStatus;
    attempts: number;
    maxAttempts: number;
    error?: string;
    result?: unknown;
    runAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface JobOptions {
    delay?: number; // ms
    maxAttempts?: number;
    priority?: number;
    runAt?: Date;
}

export type JobHandler<T = unknown> = (job: Job<T>) => Promise<unknown>;

interface QueueConfig {
    name: string;
    concurrency: number;
    handlers: Map<string, JobHandler>;
}

class JobQueueService {
    private queues: Map<string, QueueConfig> = new Map();
    private jobs: Map<string, Job> = new Map();
    private processing: Set<string> = new Set();
    private intervals: Map<string, NodeJS.Timeout> = new Map();

    /**
     * Create a new queue
     */
    createQueue(name: string, concurrency: number = 1): void {
        if (this.queues.has(name)) {
            return;
        }

        this.queues.set(name, {
            name,
            concurrency,
            handlers: new Map(),
        });

        // Start processing loop
        this.startProcessing(name);
    }

    /**
     * Register a job handler for a queue
     */
    registerHandler<T>(queueName: string, jobName: string, handler: JobHandler<T>): void {
        const queue = this.queues.get(queueName);
        if (!queue) {
            this.createQueue(queueName);
            this.registerHandler(queueName, jobName, handler);
            return;
        }

        queue.handlers.set(jobName, handler as JobHandler);
    }

    /**
     * Add a job to the queue
     */
    async add<T>(
        queueName: string,
        jobName: string,
        data: T,
        options: JobOptions = {}
    ): Promise<Job<T>> {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue "${queueName}" not found`);
        }

        const job: Job<T> = {
            id: this.generateId(),
            queue: queueName,
            name: jobName,
            data,
            status: 'pending',
            attempts: 0,
            maxAttempts: options.maxAttempts || 3,
            runAt: options.runAt || new Date(Date.now() + (options.delay || 0)),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.jobs.set(job.id, job as Job);

        console.log(`[Queue] Job added: ${job.id} (${jobName}) to ${queueName}`);

        return job;
    }

    /**
     * Add multiple jobs in bulk
     */
    async addBulk<T>(
        queueName: string,
        jobs: Array<{ name: string; data: T; options?: JobOptions }>
    ): Promise<Job<T>[]> {
        return Promise.all(
            jobs.map((j) => this.add(queueName, j.name, j.data, j.options))
        );
    }

    /**
     * Get job by ID
     */
    getJob(jobId: string): Job | undefined {
        return this.jobs.get(jobId);
    }

    /**
     * Get all jobs in a queue
     */
    getJobs(
        queueName: string,
        status?: JobStatus,
        limit: number = 100
    ): Job[] {
        const jobs: Job[] = [];

        for (const job of this.jobs.values()) {
            if (job.queue === queueName) {
                if (!status || job.status === status) {
                    jobs.push(job);
                }
            }
            if (jobs.length >= limit) break;
        }

        return jobs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    /**
     * Cancel a job
     */
    async cancel(jobId: string): Promise<boolean> {
        const job = this.jobs.get(jobId);
        if (!job) return false;

        if (job.status === 'processing') {
            return false; // Can't cancel processing job
        }

        job.status = 'cancelled';
        job.updatedAt = new Date();

        return true;
    }

    /**
     * Retry a failed job
     */
    async retry(jobId: string): Promise<boolean> {
        const job = this.jobs.get(jobId);
        if (!job || job.status !== 'failed') return false;

        job.status = 'pending';
        job.attempts = 0;
        job.error = undefined;
        job.runAt = new Date();
        job.updatedAt = new Date();

        return true;
    }

    /**
     * Remove completed/failed jobs older than specified time
     */
    async clean(
        queueName: string,
        olderThan: number = 24 * 60 * 60 * 1000,
        statuses: JobStatus[] = ['completed', 'failed', 'cancelled']
    ): Promise<number> {
        const cutoff = Date.now() - olderThan;
        let removed = 0;

        for (const [id, job] of this.jobs.entries()) {
            if (
                job.queue === queueName &&
                statuses.includes(job.status) &&
                job.updatedAt.getTime() < cutoff
            ) {
                this.jobs.delete(id);
                removed++;
            }
        }

        return removed;
    }

    /**
     * Get queue statistics
     */
    getStats(queueName: string): {
        pending: number;
        processing: number;
        completed: number;
        failed: number;
        delayed: number;
    } {
        const stats = {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
        };

        const now = Date.now();

        for (const job of this.jobs.values()) {
            if (job.queue === queueName) {
                if (job.status === 'pending' && job.runAt.getTime() > now) {
                    stats.delayed++;
                } else if (job.status === 'pending') {
                    stats.pending++;
                } else {
                    stats[job.status as keyof typeof stats]++;
                }
            }
        }

        return stats;
    }

    /**
     * Pause a queue
     */
    pause(queueName: string): void {
        const interval = this.intervals.get(queueName);
        if (interval) {
            clearInterval(interval);
            this.intervals.delete(queueName);
        }
    }

    /**
     * Resume a paused queue
     */
    resume(queueName: string): void {
        if (!this.intervals.has(queueName)) {
            this.startProcessing(queueName);
        }
    }

    /**
     * Start processing jobs in a queue
     */
    private startProcessing(queueName: string): void {
        const interval = setInterval(async () => {
            await this.processQueue(queueName);
        }, 1000); // Check every second

        this.intervals.set(queueName, interval);
    }

    /**
     * Process pending jobs in queue
     */
    private async processQueue(queueName: string): Promise<void> {
        const queue = this.queues.get(queueName);
        if (!queue) return;

        // Check concurrency limit
        const processingCount = Array.from(this.processing).filter((id) => {
            const job = this.jobs.get(id);
            return job?.queue === queueName;
        }).length;

        if (processingCount >= queue.concurrency) {
            return;
        }

        // Find next job to process
        const now = Date.now();
        for (const job of this.jobs.values()) {
            if (
                job.queue === queueName &&
                job.status === 'pending' &&
                job.runAt.getTime() <= now &&
                !this.processing.has(job.id)
            ) {
                await this.processJob(job);
                break;
            }
        }
    }

    /**
     * Process a single job
     */
    private async processJob(job: Job): Promise<void> {
        const queue = this.queues.get(job.queue);
        if (!queue) return;

        const handler = queue.handlers.get(job.name);
        if (!handler) {
            console.error(`[Queue] No handler for job: ${job.name}`);
            job.status = 'failed';
            job.error = `No handler registered for job "${job.name}"`;
            job.updatedAt = new Date();
            return;
        }

        this.processing.add(job.id);
        job.status = 'processing';
        job.startedAt = new Date();
        job.attempts++;
        job.updatedAt = new Date();

        console.log(`[Queue] Processing job: ${job.id} (${job.name}), attempt ${job.attempts}`);

        try {
            const result = await handler(job);
            job.status = 'completed';
            job.result = result;
            job.completedAt = new Date();

            console.log(`[Queue] Job completed: ${job.id}`);
        } catch (error) {
            console.error(`[Queue] Job failed: ${job.id}`, error);

            if (job.attempts < job.maxAttempts) {
                // Retry with exponential backoff
                const delay = Math.pow(2, job.attempts) * 1000;
                job.status = 'pending';
                job.runAt = new Date(Date.now() + delay);
                job.error = error instanceof Error ? error.message : 'Unknown error';

                console.log(`[Queue] Job will retry in ${delay}ms: ${job.id}`);
            } else {
                job.status = 'failed';
                job.error = error instanceof Error ? error.message : 'Unknown error';
            }
        } finally {
            job.updatedAt = new Date();
            this.processing.delete(job.id);
        }
    }

    /**
     * Generate unique job ID
     */
    private generateId(): string {
        return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Shutdown all queues
     */
    shutdown(): void {
        for (const [name, interval] of this.intervals) {
            clearInterval(interval);
            console.log(`[Queue] Stopped queue: ${name}`);
        }
        this.intervals.clear();
    }
}

// Singleton instance
export const jobQueue = new JobQueueService();

// Convenience functions for common job types
export const scheduleJob = {
    /**
     * Schedule marketplace sync
     */
    marketplaceSync: (marketplace: string, options?: JobOptions) => {
        return jobQueue.add('marketplace', 'sync', { marketplace }, options);
    },

    /**
     * Schedule order processing
     */
    processOrder: (orderId: string, options?: JobOptions) => {
        return jobQueue.add('orders', 'process', { orderId }, options);
    },

    /**
     * Schedule inventory update
     */
    updateInventory: (productId: string, warehouseId: string, quantity: number, options?: JobOptions) => {
        return jobQueue.add('inventory', 'update', { productId, warehouseId, quantity }, options);
    },

    /**
     * Schedule email sending
     */
    sendEmail: (to: string, template: string, data: Record<string, unknown>, options?: JobOptions) => {
        return jobQueue.add('email', 'send', { to, template, data }, options);
    },

    /**
     * Schedule push notification
     */
    sendPush: (userId: string, title: string, message: string, options?: JobOptions) => {
        return jobQueue.add('notifications', 'push', { userId, title, message }, options);
    },

    /**
     * Schedule price alert check
     */
    checkPriceAlerts: (productId: string, newPrice: number, options?: JobOptions) => {
        return jobQueue.add('alerts', 'check-price', { productId, newPrice }, options);
    },

    /**
     * Schedule analytics event processing
     */
    processAnalytics: (events: unknown[], options?: JobOptions) => {
        return jobQueue.add('analytics', 'process', { events }, options);
    },

    /**
     * Schedule report generation
     */
    generateReport: (type: string, params: Record<string, unknown>, options?: JobOptions) => {
        return jobQueue.add('reports', 'generate', { type, params }, options);
    },

    /**
     * Schedule cache invalidation
     */
    invalidateCache: (pattern: string, options?: JobOptions) => {
        return jobQueue.add('cache', 'invalidate', { pattern }, options);
    },

    /**
     * Schedule image optimization
     */
    optimizeImage: (imageUrl: string, options?: JobOptions) => {
        return jobQueue.add('images', 'optimize', { imageUrl }, options);
    },
};
