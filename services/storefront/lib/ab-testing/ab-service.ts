/**
 * Core A/B Testing Service
 * Manages experiments, variant assignment, tracking, and statistical analysis
 */

import {
  Experiment,
  Variant,
  ExperimentResults,
  VariantResult,
  ExperimentStatus,
  TrackingEvent,
} from '../ab-testing';

// ==================== TYPES ====================

export interface ABTestConfig {
  storageKey?: string;
  apiEndpoint?: string;
  autoTrackExposure?: boolean;
  significanceThreshold?: number;
  minSampleSize?: number;
}

export interface ConversionData {
  experimentId: string;
  variantId: string;
  conversions: number;
  participants: number;
  revenue?: number;
  events: Map<string, number>;
}

// ==================== CONFIGURATION ====================

const DEFAULT_CONFIG: Required<ABTestConfig> = {
  storageKey: 'techshop_ab_experiments',
  apiEndpoint: '/api/ab',
  autoTrackExposure: true,
  significanceThreshold: 95,
  minSampleSize: 100,
};

// ==================== AB TESTING SERVICE ====================

export class ABTestingService {
  private config: Required<ABTestConfig>;
  private experiments: Map<string, Experiment> = new Map();
  private assignments: Map<string, string> = new Map();
  private conversions: Map<string, ConversionData> = new Map();
  private userId: string | null = null;
  private sessionId: string = '';
  private initialized: boolean = false;

  constructor(config: ABTestConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the service
   */
  async initialize(userId: string | null = null): Promise<void> {
    if (this.initialized) return;

    this.userId = userId;
    this.sessionId = this.getOrCreateSessionId();

    // Load stored assignments
    this.loadStoredAssignments();

    // Load active experiments
    await this.loadActiveExperiments();

    this.initialized = true;
  }

  /**
   * Create a new experiment
   */
  async createExperiment(experiment: Omit<Experiment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Experiment> {
    // Validate experiment
    this.validateExperiment(experiment);

    const response = await fetch(`${this.config.apiEndpoint}/experiments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(experiment),
    });

    if (!response.ok) {
      throw new Error('Failed to create experiment');
    }

    const created = await response.json();
    this.experiments.set(created.id, created);

    return created;
  }

  /**
   * Get variant for an experiment
   */
  getVariant(experimentId: string): Variant | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      return null;
    }

    // Check if already assigned
    const assignedVariantId = this.assignments.get(experimentId);
    if (assignedVariantId) {
      return experiment.variants.find(v => v.id === assignedVariantId) || null;
    }

    // Assign new variant
    const variant = this.assignVariant(experiment);
    if (variant) {
      this.assignments.set(experimentId, variant.id);
      this.storeAssignment(experimentId, variant.id);

      // Track exposure
      if (this.config.autoTrackExposure) {
        this.trackExposure(experimentId, variant.id);
      }
    }

    return variant;
  }

  /**
   * Get variant configuration
   */
  getVariantConfig<T = Record<string, unknown>>(experimentId: string): T | null {
    const variant = this.getVariant(experimentId);
    return variant ? (variant.config as T) : null;
  }

  /**
   * Check if user is in experiment
   */
  isInExperiment(experimentId: string): boolean {
    return this.getVariant(experimentId) !== null;
  }

  /**
   * Get variant ID
   */
  getVariantId(experimentId: string): string | null {
    const variant = this.getVariant(experimentId);
    return variant?.id || null;
  }

  /**
   * Track conversion event
   */
  async trackConversion(
    experimentId: string,
    eventName: string,
    eventValue?: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const variantId = this.assignments.get(experimentId);
    if (!variantId) {
      return;
    }

    const event: TrackingEvent = {
      experimentId,
      variantId,
      eventName,
      eventValue,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date(),
      metadata,
    };

    // Update local counters
    this.updateConversionData(experimentId, variantId, eventName, eventValue);

    // Send to server
    await this.sendTrackingEvent(event);

    // Check if experiment should be auto-disabled
    await this.checkAutoDisable(experimentId);
  }

  /**
   * Track exposure (variant shown to user)
   */
  async trackExposure(experimentId: string, variantId: string): Promise<void> {
    await this.sendTrackingEvent({
      experimentId,
      variantId,
      eventName: 'exposure',
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date(),
    });
  }

  /**
   * Get experiment results
   */
  async getResults(experimentId: string): Promise<ExperimentResults | null> {
    const response = await fetch(`${this.config.apiEndpoint}/results/${experimentId}`);

    if (!response.ok) {
      return null;
    }

    return response.json();
  }

  /**
   * Calculate statistical significance
   */
  calculateSignificance(
    controlConversions: number,
    controlParticipants: number,
    variantConversions: number,
    variantParticipants: number
  ): number {
    if (controlParticipants < 2 || variantParticipants < 2) {
      return 0;
    }

    const p1 = controlConversions / controlParticipants;
    const p2 = variantConversions / variantParticipants;
    const n1 = controlParticipants;
    const n2 = variantParticipants;

    const pooledP = (controlConversions + variantConversions) / (n1 + n2);
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));

    if (se === 0) return 0;

    const z = (p2 - p1) / se;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));

    return Math.round((1 - pValue) * 100);
  }

  /**
   * Declare winner and disable losing variants
   */
  async declareWinner(experimentId: string, winnerVariantId: string): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error('Experiment not found');
    }

    const response = await fetch(`${this.config.apiEndpoint}/experiments/${experimentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'completed' as ExperimentStatus,
        winner: winnerVariantId,
        endDate: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to declare winner');
    }

    const updated = await response.json();
    this.experiments.set(experimentId, updated);
  }

  /**
   * Stop experiment
   */
  async stopExperiment(experimentId: string): Promise<void> {
    const response = await fetch(`${this.config.apiEndpoint}/experiments/${experimentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'paused' as ExperimentStatus,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to stop experiment');
    }

    const updated = await response.json();
    this.experiments.set(experimentId, updated);
  }

  /**
   * Get all experiments
   */
  getExperiments(): Experiment[] {
    return Array.from(this.experiments.values());
  }

  /**
   * Get experiment by ID
   */
  getExperiment(experimentId: string): Experiment | null {
    return this.experiments.get(experimentId) || null;
  }

  /**
   * Clear user assignments (force re-assignment)
   */
  clearAssignments(): void {
    this.assignments.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.config.storageKey);
    }
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Validate experiment configuration
   */
  private validateExperiment(experiment: Partial<Experiment>): void {
    if (!experiment.name) {
      throw new Error('Experiment name is required');
    }

    if (!experiment.variants || experiment.variants.length < 2) {
      throw new Error('At least 2 variants are required');
    }

    // Check that weights sum to 100
    const totalWeight = experiment.variants.reduce((sum, v) => sum + v.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error('Variant weights must sum to 100');
    }

    // Check that there's exactly one control
    const controlCount = experiment.variants.filter(v => v.isControl).length;
    if (controlCount !== 1) {
      throw new Error('Exactly one variant must be marked as control');
    }
  }

  /**
   * Assign variant to user
   */
  private assignVariant(experiment: Experiment): Variant | null {
    if (experiment.status !== 'running') {
      return null;
    }

    // Check allocation
    const identifier = this.userId || this.sessionId;
    const allocationHash = this.hashString(`${experiment.id}_allocation_${identifier}`) % 100;

    if (allocationHash >= experiment.allocation) {
      return null;
    }

    // Assign variant based on weights
    const variantHash = this.hashString(`${experiment.id}_variant_${identifier}`) % 100;

    let cumulativeWeight = 0;
    for (const variant of experiment.variants) {
      cumulativeWeight += variant.weight;
      if (variantHash < cumulativeWeight) {
        return variant;
      }
    }

    // Fallback to control
    return experiment.variants.find(v => v.isControl) || experiment.variants[0];
  }

  /**
   * Hash string for consistent assignment
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Load active experiments from server
   */
  private async loadActiveExperiments(): Promise<void> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/experiments`);
      if (response.ok) {
        const experiments = await response.json();
        experiments.forEach((exp: Experiment) => {
          this.experiments.set(exp.id, exp);
        });
      }
    } catch (error) {
      console.error('Failed to load experiments:', error);
    }
  }

  /**
   * Load stored assignments from localStorage
   */
  private loadStoredAssignments(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (stored) {
        const assignments = JSON.parse(stored);
        Object.entries(assignments).forEach(([expId, variantId]) => {
          this.assignments.set(expId, variantId as string);
        });
      }
    } catch (error) {
      console.error('Failed to load stored assignments:', error);
    }
  }

  /**
   * Store assignment in localStorage
   */
  private storeAssignment(experimentId: string, variantId: string): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.config.storageKey);
      const assignments = stored ? JSON.parse(stored) : {};
      assignments[experimentId] = variantId;
      localStorage.setItem(this.config.storageKey, JSON.stringify(assignments));
    } catch (error) {
      console.error('Failed to store assignment:', error);
    }
  }

  /**
   * Get or create session ID
   */
  private getOrCreateSessionId(): string {
    if (typeof window === 'undefined') {
      return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }

    const key = 'techshop_session_id';
    let sessionId = sessionStorage.getItem(key);

    if (!sessionId) {
      sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      sessionStorage.setItem(key, sessionId);
    }

    return sessionId;
  }

  /**
   * Send tracking event to server
   */
  private async sendTrackingEvent(event: TrackingEvent): Promise<void> {
    try {
      await fetch(`${this.config.apiEndpoint}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
    } catch (error) {
      console.error('Failed to send tracking event:', error);
    }
  }

  /**
   * Update local conversion data
   */
  private updateConversionData(
    experimentId: string,
    variantId: string,
    eventName: string,
    eventValue?: number
  ): void {
    const key = `${experimentId}_${variantId}`;
    let data = this.conversions.get(key);

    if (!data) {
      data = {
        experimentId,
        variantId,
        conversions: 0,
        participants: 0,
        revenue: 0,
        events: new Map(),
      };
      this.conversions.set(key, data);
    }

    if (eventName === 'conversion') {
      data.conversions++;
    }

    if (eventValue) {
      data.revenue = (data.revenue || 0) + eventValue;
    }

    const eventCount = data.events.get(eventName) || 0;
    data.events.set(eventName, eventCount + 1);
  }

  /**
   * Check if losing variants should be auto-disabled
   */
  private async checkAutoDisable(experimentId: string): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return;

    const results = await this.getResults(experimentId);
    if (!results) return;

    // Check if we have enough data
    if (results.totalParticipants < this.config.minSampleSize) {
      return;
    }

    // Check if there's a clear winner
    if (results.statisticalSignificance < this.config.significanceThreshold) {
      return;
    }

    // Find control and best variant
    const control = results.variantResults.find(r => {
      const variant = experiment.variants.find(v => v.id === r.variantId);
      return variant?.isControl;
    });

    if (!control) return;

    const bestVariant = results.variantResults
      .filter(r => r.variantId !== control.variantId)
      .reduce((best, current) =>
        current.conversionRate > best.conversionRate ? current : best
      );

    // If best variant is significantly better, declare it winner
    if (bestVariant.conversionRate > control.conversionRate * 1.1) {
      await this.declareWinner(experimentId, bestVariant.variantId);
    }
  }

  /**
   * Normal CDF approximation
   */
  private normalCDF(z: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

    return 0.5 * (1.0 + sign * y);
  }
}

// ==================== SINGLETON INSTANCE ====================

let serviceInstance: ABTestingService | null = null;

/**
 * Get singleton instance of ABTestingService
 */
export function getABTestingService(config?: ABTestConfig): ABTestingService {
  if (!serviceInstance) {
    serviceInstance = new ABTestingService(config);
  }
  return serviceInstance;
}

/**
 * Reset service instance (useful for testing)
 */
export function resetABTestingService(): void {
  serviceInstance = null;
}
