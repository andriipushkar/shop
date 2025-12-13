// Bulk Operations Service

export interface BulkOperation {
    id: string;
    type: BulkOperationType;
    entityType: 'products' | 'orders' | 'customers' | 'categories';
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    totalItems: number;
    processedItems: number;
    successItems: number;
    failedItems: number;
    errors: BulkError[];
    params: BulkParams;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    createdBy: string;
}

export type BulkOperationType =
    | 'update'
    | 'delete'
    | 'export'
    | 'import'
    | 'publish'
    | 'unpublish'
    | 'archive'
    | 'restore'
    | 'assign_category'
    | 'update_price'
    | 'update_stock'
    | 'add_tag'
    | 'remove_tag'
    | 'send_email'
    | 'generate_report';

export interface BulkParams {
    ids?: string[];
    filter?: Record<string, unknown>;
    updates?: Record<string, unknown>;
    data?: unknown;
}

export interface BulkError {
    itemId: string;
    message: string;
    code?: string;
}

export interface BulkOperationResult {
    operationId: string;
    status: BulkOperation['status'];
    summary: {
        total: number;
        success: number;
        failed: number;
        skipped: number;
    };
    errors: BulkError[];
    downloadUrl?: string;
}

export interface ImportConfig {
    entityType: BulkOperation['entityType'];
    file: File;
    mapping: FieldMapping[];
    options: ImportOptions;
}

export interface FieldMapping {
    sourceField: string;
    targetField: string;
    transform?: 'none' | 'uppercase' | 'lowercase' | 'trim' | 'number' | 'boolean' | 'date';
    defaultValue?: unknown;
    required?: boolean;
}

export interface ImportOptions {
    updateExisting: boolean;
    skipErrors: boolean;
    dryRun: boolean;
    batchSize: number;
}

export interface ExportConfig {
    entityType: BulkOperation['entityType'];
    format: 'csv' | 'xlsx' | 'json';
    fields: string[];
    filter?: Record<string, unknown>;
    includeRelations?: boolean;
}

// Price update options
export interface PriceUpdateParams {
    productIds?: string[];
    categoryIds?: string[];
    updateType: 'percentage' | 'fixed' | 'formula';
    value: number;
    direction: 'increase' | 'decrease';
    roundTo?: number;
    minPrice?: number;
    maxPrice?: number;
    affectSalePrice?: boolean;
}

// Stock update options
export interface StockUpdateParams {
    productIds?: string[];
    warehouseId?: string;
    updateType: 'set' | 'add' | 'subtract';
    value: number;
    trackReason?: string;
}

class BulkOperationsService {
    private operations: Map<string, BulkOperation> = new Map();
    private processingQueue: BulkOperation[] = [];

    // Create bulk operation
    async createOperation(
        type: BulkOperationType,
        entityType: BulkOperation['entityType'],
        params: BulkParams,
        userId: string
    ): Promise<BulkOperation> {
        const operation: BulkOperation = {
            id: Date.now().toString(),
            type,
            entityType,
            status: 'pending',
            progress: 0,
            totalItems: params.ids?.length || 0,
            processedItems: 0,
            successItems: 0,
            failedItems: 0,
            errors: [],
            params,
            createdAt: new Date().toISOString(),
            createdBy: userId,
        };

        this.operations.set(operation.id, operation);
        this.processingQueue.push(operation);

        // Start processing
        this.processQueue();

        return operation;
    }

    // Get operation status
    getOperation(operationId: string): BulkOperation | undefined {
        return this.operations.get(operationId);
    }

    // Get user's operations
    getUserOperations(userId: string): BulkOperation[] {
        return Array.from(this.operations.values())
            .filter((op) => op.createdBy === userId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // Cancel operation
    async cancelOperation(operationId: string): Promise<boolean> {
        const operation = this.operations.get(operationId);
        if (!operation || operation.status !== 'pending' && operation.status !== 'processing') {
            return false;
        }

        operation.status = 'cancelled';
        return true;
    }

    // Bulk update products
    async bulkUpdateProducts(
        productIds: string[],
        updates: Record<string, unknown>,
        userId: string
    ): Promise<BulkOperation> {
        return this.createOperation('update', 'products', { ids: productIds, updates }, userId);
    }

    // Bulk delete
    async bulkDelete(
        entityType: BulkOperation['entityType'],
        ids: string[],
        userId: string
    ): Promise<BulkOperation> {
        return this.createOperation('delete', entityType, { ids }, userId);
    }

    // Bulk update prices
    async bulkUpdatePrices(params: PriceUpdateParams, userId: string): Promise<BulkOperation> {
        return this.createOperation('update_price', 'products', { data: params, ids: params.productIds }, userId);
    }

    // Bulk update stock
    async bulkUpdateStock(params: StockUpdateParams, userId: string): Promise<BulkOperation> {
        return this.createOperation('update_stock', 'products', { data: params, ids: params.productIds }, userId);
    }

    // Bulk assign category
    async bulkAssignCategory(
        productIds: string[],
        categoryId: string,
        userId: string
    ): Promise<BulkOperation> {
        return this.createOperation('assign_category', 'products', {
            ids: productIds,
            updates: { categoryId },
        }, userId);
    }

    // Bulk add/remove tags
    async bulkUpdateTags(
        productIds: string[],
        tags: string[],
        action: 'add' | 'remove',
        userId: string
    ): Promise<BulkOperation> {
        return this.createOperation(
            action === 'add' ? 'add_tag' : 'remove_tag',
            'products',
            { ids: productIds, data: { tags } },
            userId
        );
    }

    // Export data
    async exportData(config: ExportConfig, userId: string): Promise<BulkOperation> {
        return this.createOperation('export', config.entityType, { data: config }, userId);
    }

    // Import data
    async importData(config: ImportConfig, userId: string): Promise<BulkOperation> {
        const operation = await this.createOperation('import', config.entityType, { data: config }, userId);

        // Process import file
        if (config.options.dryRun) {
            await this.validateImport(operation, config);
        }

        return operation;
    }

    // Generate report
    async generateReport(
        reportType: string,
        params: Record<string, unknown>,
        userId: string
    ): Promise<BulkOperation> {
        return this.createOperation('generate_report', 'orders', { data: { reportType, ...params } }, userId);
    }

    // Bulk send emails
    async bulkSendEmails(
        customerIds: string[],
        templateId: string,
        data: Record<string, unknown>,
        userId: string
    ): Promise<BulkOperation> {
        return this.createOperation('send_email', 'customers', {
            ids: customerIds,
            data: { templateId, ...data },
        }, userId);
    }

    // Calculate price update preview
    calculatePricePreview(
        currentPrice: number,
        params: PriceUpdateParams
    ): { newPrice: number; change: number; changePercent: number } {
        let newPrice = currentPrice;

        if (params.updateType === 'percentage') {
            const change = currentPrice * (params.value / 100);
            newPrice = params.direction === 'increase' ? currentPrice + change : currentPrice - change;
        } else if (params.updateType === 'fixed') {
            newPrice = params.direction === 'increase' ? currentPrice + params.value : currentPrice - params.value;
        } else if (params.updateType === 'formula') {
            // Formula could be more complex
            newPrice = params.value;
        }

        // Apply rounding
        if (params.roundTo) {
            newPrice = Math.round(newPrice / params.roundTo) * params.roundTo;
        }

        // Apply min/max limits
        if (params.minPrice !== undefined) {
            newPrice = Math.max(newPrice, params.minPrice);
        }
        if (params.maxPrice !== undefined) {
            newPrice = Math.min(newPrice, params.maxPrice);
        }

        newPrice = Math.round(newPrice * 100) / 100;
        const change = newPrice - currentPrice;
        const changePercent = currentPrice > 0 ? (change / currentPrice) * 100 : 0;

        return { newPrice, change, changePercent: Math.round(changePercent * 10) / 10 };
    }

    // Parse CSV/Excel file for import
    async parseImportFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[]; preview: Record<string, string>[] }> {
        const text = await file.text();
        const lines = text.split('\n').filter((line) => line.trim());

        if (lines.length === 0) {
            return { headers: [], rows: [], preview: [] };
        }

        const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
        const rows: Record<string, string>[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
            const row: Record<string, string> = {};

            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });

            rows.push(row);
        }

        return {
            headers,
            rows,
            preview: rows.slice(0, 5),
        };
    }

    // Get suggested field mappings
    getSuggestedMappings(headers: string[], entityType: BulkOperation['entityType']): FieldMapping[] {
        const targetFields = this.getEntityFields(entityType);

        return headers.map((header) => {
            const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '');
            const match = targetFields.find((field) =>
                field.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalized) ||
                normalized.includes(field.toLowerCase().replace(/[^a-z0-9]/g, ''))
            );

            return {
                sourceField: header,
                targetField: match || '',
                transform: 'none' as const,
            };
        });
    }

    // Get entity fields for mapping
    private getEntityFields(entityType: BulkOperation['entityType']): string[] {
        switch (entityType) {
            case 'products':
                return ['id', 'name', 'sku', 'price', 'salePrice', 'description', 'category', 'brand', 'stock', 'status', 'images', 'tags'];
            case 'customers':
                return ['id', 'email', 'firstName', 'lastName', 'phone', 'address', 'city', 'region'];
            case 'orders':
                return ['id', 'status', 'total', 'customerId', 'shippingAddress', 'paymentMethod'];
            case 'categories':
                return ['id', 'name', 'slug', 'parentId', 'description', 'image'];
            default:
                return [];
        }
    }

    // Process queue
    private async processQueue(): Promise<void> {
        while (this.processingQueue.length > 0) {
            const operation = this.processingQueue.find((op) => op.status === 'pending');
            if (!operation) break;

            operation.status = 'processing';
            operation.startedAt = new Date().toISOString();

            try {
                await this.processOperation(operation);
                operation.status = 'completed';
            } catch (error) {
                operation.status = 'failed';
                operation.errors.push({
                    itemId: '',
                    message: error instanceof Error ? error.message : 'Unknown error',
                });
            }

            operation.completedAt = new Date().toISOString();
            this.processingQueue = this.processingQueue.filter((op) => op.id !== operation.id);
        }
    }

    // Process single operation
    private async processOperation(operation: BulkOperation): Promise<void> {
        const { ids } = operation.params;
        if (!ids || ids.length === 0) {
            operation.totalItems = 0;
            return;
        }

        operation.totalItems = ids.length;

        for (let i = 0; i < ids.length; i++) {
            if (operation.status === 'cancelled') break;

            const itemId = ids[i];

            try {
                await this.processItem(operation, itemId);
                operation.successItems++;
            } catch (error) {
                operation.failedItems++;
                operation.errors.push({
                    itemId,
                    message: error instanceof Error ? error.message : 'Unknown error',
                });
            }

            operation.processedItems++;
            operation.progress = Math.round((operation.processedItems / operation.totalItems) * 100);

            // Simulate processing time
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
    }

    // Process single item
    private async processItem(operation: BulkOperation, itemId: string): Promise<void> {
        // In production, make actual API calls
        switch (operation.type) {
            case 'delete':
                await fetch(`/api/${operation.entityType}/${itemId}`, { method: 'DELETE' });
                break;
            case 'update':
                await fetch(`/api/${operation.entityType}/${itemId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(operation.params.updates),
                });
                break;
            // Add other operation types...
        }
    }

    // Validate import
    private async validateImport(operation: BulkOperation, config: ImportConfig): Promise<void> {
        // Validate file and mapping
        const { headers, rows } = await this.parseImportFile(config.file);

        operation.totalItems = rows.length;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const errors: string[] = [];

            config.mapping.forEach((mapping) => {
                if (mapping.required && !row[mapping.sourceField]) {
                    errors.push(`Missing required field: ${mapping.sourceField}`);
                }
            });

            if (errors.length > 0) {
                operation.errors.push({
                    itemId: `Row ${i + 1}`,
                    message: errors.join('; '),
                });
                operation.failedItems++;
            } else {
                operation.successItems++;
            }

            operation.processedItems++;
        }

        operation.progress = 100;
    }
}

// Singleton instance
export const bulkOperations = new BulkOperationsService();

// React hook
export function useBulkOperations() {
    return bulkOperations;
}
