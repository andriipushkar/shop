// A/B Testing Framework

export interface Experiment {
    id: string;
    name: string;
    description?: string;
    variants: Variant[];
    targetAudience?: TargetAudience;
    startDate?: Date;
    endDate?: Date;
    status: 'draft' | 'running' | 'paused' | 'completed';
}

export interface Variant {
    id: string;
    name: string;
    weight: number; // 0-100, total must equal 100
    config?: Record<string, unknown>;
}

export interface TargetAudience {
    percentage?: number; // % of users to include
    userIds?: string[];
    countries?: string[];
    devices?: ('desktop' | 'mobile' | 'tablet')[];
    isNewUser?: boolean;
    customCondition?: (context: ExperimentContext) => boolean;
}

export interface ExperimentContext {
    userId?: string;
    sessionId: string;
    country?: string;
    device: 'desktop' | 'mobile' | 'tablet';
    isNewUser: boolean;
    userAttributes?: Record<string, unknown>;
}

export interface ExperimentResult {
    experimentId: string;
    variantId: string;
    variant: Variant;
}

// Generate consistent hash for user assignment
function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

// Get bucket (0-99) for user
function getBucket(userId: string, experimentId: string): number {
    return hashCode(`${userId}:${experimentId}`) % 100;
}

// Check if user matches target audience
function matchesAudience(context: ExperimentContext, audience?: TargetAudience): boolean {
    if (!audience) return true;

    // Check percentage
    if (audience.percentage !== undefined) {
        const bucket = getBucket(context.sessionId, 'audience');
        if (bucket >= audience.percentage) return false;
    }

    // Check user IDs
    if (audience.userIds && context.userId) {
        if (!audience.userIds.includes(context.userId)) return false;
    }

    // Check country
    if (audience.countries && context.country) {
        if (!audience.countries.includes(context.country)) return false;
    }

    // Check device
    if (audience.devices) {
        if (!audience.devices.includes(context.device)) return false;
    }

    // Check new user
    if (audience.isNewUser !== undefined) {
        if (audience.isNewUser !== context.isNewUser) return false;
    }

    // Custom condition
    if (audience.customCondition) {
        if (!audience.customCondition(context)) return false;
    }

    return true;
}

// Select variant based on weights
function selectVariant(variants: Variant[], bucket: number): Variant {
    let cumulative = 0;
    for (const variant of variants) {
        cumulative += variant.weight;
        if (bucket < cumulative) {
            return variant;
        }
    }
    return variants[variants.length - 1];
}

// Main experiment manager class
export class ExperimentManager {
    private experiments: Map<string, Experiment> = new Map();
    private assignments: Map<string, Map<string, string>> = new Map();
    private context: ExperimentContext | null = null;

    constructor() {
        this.loadAssignments();
    }

    // Set user context
    setContext(context: ExperimentContext) {
        this.context = context;
        this.loadAssignments();
    }

    // Register experiment
    registerExperiment(experiment: Experiment) {
        this.experiments.set(experiment.id, experiment);
    }

    // Register multiple experiments
    registerExperiments(experiments: Experiment[]) {
        experiments.forEach((exp) => this.registerExperiment(exp));
    }

    // Get variant for experiment
    getVariant(experimentId: string): ExperimentResult | null {
        if (!this.context) {
            console.warn('ExperimentManager: Context not set');
            return null;
        }

        const experiment = this.experiments.get(experimentId);
        if (!experiment) {
            console.warn(`ExperimentManager: Experiment ${experimentId} not found`);
            return null;
        }

        // Check if experiment is active
        if (experiment.status !== 'running') {
            return null;
        }

        // Check date constraints
        const now = new Date();
        if (experiment.startDate && now < experiment.startDate) return null;
        if (experiment.endDate && now > experiment.endDate) return null;

        // Check target audience
        if (!matchesAudience(this.context, experiment.targetAudience)) {
            return null;
        }

        // Check for existing assignment
        const userAssignments = this.assignments.get(this.context.sessionId);
        const existingVariantId = userAssignments?.get(experimentId);

        if (existingVariantId) {
            const variant = experiment.variants.find((v) => v.id === existingVariantId);
            if (variant) {
                return {
                    experimentId,
                    variantId: variant.id,
                    variant,
                };
            }
        }

        // Assign new variant
        const bucket = getBucket(this.context.sessionId, experimentId);
        const variant = selectVariant(experiment.variants, bucket);

        // Save assignment
        this.saveAssignment(experimentId, variant.id);

        return {
            experimentId,
            variantId: variant.id,
            variant,
        };
    }

    // Get all active variants for user
    getActiveVariants(): ExperimentResult[] {
        const results: ExperimentResult[] = [];

        this.experiments.forEach((_, experimentId) => {
            const result = this.getVariant(experimentId);
            if (result) {
                results.push(result);
            }
        });

        return results;
    }

    // Check if user is in specific variant
    isInVariant(experimentId: string, variantId: string): boolean {
        const result = this.getVariant(experimentId);
        return result?.variantId === variantId;
    }

    // Track conversion
    trackConversion(experimentId: string, conversionName: string, value?: number) {
        const result = this.getVariant(experimentId);
        if (!result) return;

        // Track via analytics
        if (typeof window !== 'undefined' && window.gtag) {
            window.gtag('event', 'experiment_conversion', {
                experiment_id: experimentId,
                variant_id: result.variantId,
                conversion_name: conversionName,
                conversion_value: value,
            });
        }
    }

    // Save assignment to storage
    private saveAssignment(experimentId: string, variantId: string) {
        if (!this.context) return;

        let userAssignments = this.assignments.get(this.context.sessionId);
        if (!userAssignments) {
            userAssignments = new Map();
            this.assignments.set(this.context.sessionId, userAssignments);
        }
        userAssignments.set(experimentId, variantId);

        // Persist to localStorage
        if (typeof localStorage !== 'undefined') {
            try {
                const data = Object.fromEntries(userAssignments);
                localStorage.setItem(`exp_assignments_${this.context.sessionId}`, JSON.stringify(data));
            } catch {
                // Ignore storage errors
            }
        }

        // Track assignment via analytics
        if (typeof window !== 'undefined' && window.gtag) {
            window.gtag('event', 'experiment_impression', {
                experiment_id: experimentId,
                variant_id: variantId,
            });
        }
    }

    // Load assignments from storage
    private loadAssignments() {
        if (!this.context || typeof localStorage === 'undefined') return;

        try {
            const data = localStorage.getItem(`exp_assignments_${this.context.sessionId}`);
            if (data) {
                const parsed = JSON.parse(data);
                this.assignments.set(this.context.sessionId, new Map(Object.entries(parsed)));
            }
        } catch {
            // Ignore parse errors
        }
    }

    // Clear all assignments (for testing)
    clearAssignments() {
        this.assignments.clear();
        if (typeof localStorage !== 'undefined' && this.context) {
            localStorage.removeItem(`exp_assignments_${this.context.sessionId}`);
        }
    }
}

// Singleton instance
export const experimentManager = new ExperimentManager();

// Helper function for simple variant check
export function useExperimentVariant(experimentId: string): ExperimentResult | null {
    return experimentManager.getVariant(experimentId);
}

// Helper for boolean feature flag
export function isFeatureEnabled(experimentId: string, enabledVariantId: string = 'enabled'): boolean {
    return experimentManager.isInVariant(experimentId, enabledVariantId);
}
