/**
 * A/B Testing System
 * UI experimentation and optimization
 */

// ==================== TYPES ====================

export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  type: ExperimentType;
  variants: Variant[];
  targeting: Targeting;
  metrics: Metric[];
  allocation: number; // Percentage of traffic (0-100)
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  winner?: string; // Variant ID
  results?: ExperimentResults;
}

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived';

export type ExperimentType =
  | 'ab_test' // A/B Test
  | 'multivariate' // Multiple variants
  | 'feature_flag' // Simple on/off
  | 'personalization'; // User-targeted

export interface Variant {
  id: string;
  name: string;
  description?: string;
  weight: number; // Percentage of experiment traffic (0-100)
  isControl: boolean;
  config: Record<string, unknown>;
}

export interface Targeting {
  userSegments?: string[];
  deviceTypes?: ('desktop' | 'mobile' | 'tablet')[];
  browsers?: string[];
  countries?: string[];
  languages?: string[];
  isNewUser?: boolean;
  isLoggedIn?: boolean;
  urlPatterns?: string[];
  customRules?: TargetingRule[];
}

export interface TargetingRule {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: string | number | boolean;
}

export interface Metric {
  id: string;
  name: string;
  type: MetricType;
  eventName?: string;
  goalValue?: number;
  isPrimary: boolean;
}

export type MetricType =
  | 'conversion'
  | 'clicks'
  | 'page_views'
  | 'time_on_page'
  | 'bounce_rate'
  | 'revenue'
  | 'add_to_cart'
  | 'checkout'
  | 'custom';

export interface ExperimentResults {
  totalParticipants: number;
  variantResults: VariantResult[];
  statisticalSignificance: number;
  confidenceLevel: number;
  uplift?: number;
  recommendedVariant?: string;
}

export interface VariantResult {
  variantId: string;
  participants: number;
  conversions: number;
  conversionRate: number;
  revenue?: number;
  avgOrderValue?: number;
  metrics: Record<string, number>;
  confidence?: number;
}

export interface ExperimentAssignment {
  experimentId: string;
  variantId: string;
  assignedAt: Date;
  userId?: string;
  sessionId: string;
}

export interface TrackingEvent {
  experimentId: string;
  variantId: string;
  eventName: string;
  eventValue?: number;
  userId?: string;
  sessionId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ==================== CONFIGURATION ====================

export const EXPERIMENT_COOKIE_NAME = 'techshop_experiments';
export const EXPERIMENT_COOKIE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

export const DEFAULT_METRICS: Metric[] = [
  { id: 'conversion', name: 'Conversion Rate', type: 'conversion', isPrimary: true },
  { id: 'clicks', name: 'Click Rate', type: 'clicks', isPrimary: false },
  { id: 'add_to_cart', name: 'Add to Cart', type: 'add_to_cart', isPrimary: false },
  { id: 'revenue', name: 'Revenue', type: 'revenue', isPrimary: false },
];

// ==================== VARIANT ASSIGNMENT ====================

/**
 * Hash function for consistent assignment
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get consistent variant assignment based on user/session ID
 */
export function assignVariant(
  experiment: Experiment,
  userId: string | null,
  sessionId: string
): Variant | null {
  // Check if experiment is running
  if (experiment.status !== 'running') {
    return null;
  }

  // Check allocation (whether user is in experiment)
  const identifier = userId || sessionId;
  const allocationHash = hashString(`${experiment.id}_allocation_${identifier}`) % 100;

  if (allocationHash >= experiment.allocation) {
    return null; // User not in experiment
  }

  // Assign variant based on weights
  const variantHash = hashString(`${experiment.id}_variant_${identifier}`) % 100;

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
 * Check if user matches targeting rules
 */
export function matchesTargeting(
  targeting: Targeting,
  context: {
    userSegment?: string;
    deviceType?: 'desktop' | 'mobile' | 'tablet';
    browser?: string;
    country?: string;
    language?: string;
    isNewUser?: boolean;
    isLoggedIn?: boolean;
    url?: string;
    customData?: Record<string, unknown>;
  }
): boolean {
  // User segments
  if (targeting.userSegments && targeting.userSegments.length > 0) {
    if (!context.userSegment || !targeting.userSegments.includes(context.userSegment)) {
      return false;
    }
  }

  // Device types
  if (targeting.deviceTypes && targeting.deviceTypes.length > 0) {
    if (!context.deviceType || !targeting.deviceTypes.includes(context.deviceType)) {
      return false;
    }
  }

  // Browsers
  if (targeting.browsers && targeting.browsers.length > 0) {
    if (!context.browser || !targeting.browsers.some(b =>
      context.browser!.toLowerCase().includes(b.toLowerCase())
    )) {
      return false;
    }
  }

  // Countries
  if (targeting.countries && targeting.countries.length > 0) {
    if (!context.country || !targeting.countries.includes(context.country)) {
      return false;
    }
  }

  // Languages
  if (targeting.languages && targeting.languages.length > 0) {
    if (!context.language || !targeting.languages.includes(context.language)) {
      return false;
    }
  }

  // New user check
  if (targeting.isNewUser !== undefined) {
    if (context.isNewUser !== targeting.isNewUser) {
      return false;
    }
  }

  // Logged in check
  if (targeting.isLoggedIn !== undefined) {
    if (context.isLoggedIn !== targeting.isLoggedIn) {
      return false;
    }
  }

  // URL patterns
  if (targeting.urlPatterns && targeting.urlPatterns.length > 0 && context.url) {
    const matchesUrl = targeting.urlPatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(context.url!);
    });
    if (!matchesUrl) {
      return false;
    }
  }

  // Custom rules
  if (targeting.customRules && targeting.customRules.length > 0 && context.customData) {
    for (const rule of targeting.customRules) {
      const value = context.customData[rule.field];
      if (!matchesRule(value, rule)) {
        return false;
      }
    }
  }

  return true;
}

function matchesRule(value: unknown, rule: TargetingRule): boolean {
  if (value === undefined) return false;

  switch (rule.operator) {
    case 'equals':
      return value === rule.value;
    case 'not_equals':
      return value !== rule.value;
    case 'contains':
      return String(value).includes(String(rule.value));
    case 'greater_than':
      return Number(value) > Number(rule.value);
    case 'less_than':
      return Number(value) < Number(rule.value);
    default:
      return false;
  }
}

// ==================== CLIENT-SIDE STORAGE ====================

/**
 * Get stored experiment assignments
 */
export function getStoredAssignments(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(EXPERIMENT_COOKIE_NAME);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Store experiment assignment
 */
export function storeAssignment(experimentId: string, variantId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const assignments = getStoredAssignments();
    assignments[experimentId] = variantId;
    localStorage.setItem(EXPERIMENT_COOKIE_NAME, JSON.stringify(assignments));
  } catch (error) {
    console.error('Failed to store experiment assignment:', error);
  }
}

/**
 * Get assignment for specific experiment
 */
export function getAssignment(experimentId: string): string | null {
  const assignments = getStoredAssignments();
  return assignments[experimentId] || null;
}

/**
 * Clear all assignments
 */
export function clearAssignments(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(EXPERIMENT_COOKIE_NAME);
}

// ==================== TRACKING ====================

/**
 * Track experiment exposure
 */
export async function trackExposure(
  experimentId: string,
  variantId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await fetch('/api/experiments/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experimentId,
        variantId,
        eventName: 'exposure',
        metadata,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('Failed to track exposure:', error);
  }
}

/**
 * Track conversion event
 */
export async function trackConversion(
  experimentId: string,
  variantId: string,
  eventName: string,
  eventValue?: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await fetch('/api/experiments/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experimentId,
        variantId,
        eventName,
        eventValue,
        metadata,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('Failed to track conversion:', error);
  }
}

/**
 * Track multiple events
 */
export async function trackBatch(events: TrackingEvent[]): Promise<void> {
  try {
    await fetch('/api/experiments/track-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    });
  } catch (error) {
    console.error('Failed to track events:', error);
  }
}

// ==================== API FUNCTIONS ====================

/**
 * Get active experiments
 */
export async function getActiveExperiments(): Promise<Experiment[]> {
  const response = await fetch('/api/experiments/active');

  if (!response.ok) {
    return [];
  }

  return response.json();
}

/**
 * Get experiment by ID
 */
export async function getExperiment(experimentId: string): Promise<Experiment | null> {
  const response = await fetch(`/api/experiments/${experimentId}`);

  if (!response.ok) {
    return null;
  }

  return response.json();
}

/**
 * Get experiment results
 */
export async function getExperimentResults(experimentId: string): Promise<ExperimentResults | null> {
  const response = await fetch(`/api/experiments/${experimentId}/results`);

  if (!response.ok) {
    return null;
  }

  return response.json();
}

/**
 * Create experiment (admin)
 */
export async function createExperiment(
  experiment: Omit<Experiment, 'id' | 'createdAt' | 'updatedAt' | 'results'>
): Promise<Experiment> {
  const response = await fetch('/api/admin/experiments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(experiment),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create experiment');
  }

  return response.json();
}

/**
 * Update experiment (admin)
 */
export async function updateExperiment(
  experimentId: string,
  updates: Partial<Experiment>
): Promise<Experiment> {
  const response = await fetch(`/api/admin/experiments/${experimentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error('Failed to update experiment');
  }

  return response.json();
}

/**
 * Start experiment (admin)
 */
export async function startExperiment(experimentId: string): Promise<Experiment> {
  return updateExperiment(experimentId, {
    status: 'running',
    startDate: new Date(),
  });
}

/**
 * Stop experiment (admin)
 */
export async function stopExperiment(experimentId: string, winnerId?: string): Promise<Experiment> {
  return updateExperiment(experimentId, {
    status: 'completed',
    endDate: new Date(),
    winner: winnerId,
  });
}

/**
 * Delete experiment (admin)
 */
export async function deleteExperiment(experimentId: string): Promise<void> {
  const response = await fetch(`/api/admin/experiments/${experimentId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete experiment');
  }
}

// ==================== STATISTICAL ANALYSIS ====================

/**
 * Calculate conversion rate
 */
export function calculateConversionRate(conversions: number, participants: number): number {
  if (participants === 0) return 0;
  return Math.round((conversions / participants) * 10000) / 100; // 2 decimal places
}

/**
 * Calculate uplift percentage
 */
export function calculateUplift(control: number, variant: number): number {
  if (control === 0) return 0;
  return Math.round(((variant - control) / control) * 10000) / 100;
}

/**
 * Calculate statistical significance (simplified z-test)
 */
export function calculateSignificance(
  controlConversions: number,
  controlParticipants: number,
  variantConversions: number,
  variantParticipants: number
): number {
  const p1 = controlConversions / controlParticipants;
  const p2 = variantConversions / variantParticipants;
  const n1 = controlParticipants;
  const n2 = variantParticipants;

  const pooledP = (controlConversions + variantConversions) / (n1 + n2);
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));

  if (se === 0) return 0;

  const z = (p2 - p1) / se;
  const significance = 1 - normalCDF(Math.abs(z));

  return Math.round((1 - significance * 2) * 100); // Confidence level
}

/**
 * Normal CDF approximation
 */
function normalCDF(z: number): number {
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

/**
 * Check if result is statistically significant
 */
export function isSignificant(confidenceLevel: number, threshold: number = 95): boolean {
  return confidenceLevel >= threshold;
}

/**
 * Get sample size recommendation
 */
export function getRequiredSampleSize(
  baselineConversionRate: number,
  minimumDetectableEffect: number,
  confidenceLevel: number = 95,
  power: number = 80
): number {
  // Simplified formula
  const zAlpha = confidenceLevel === 95 ? 1.96 : 2.58; // 95% or 99%
  const zBeta = power === 80 ? 0.84 : 1.28; // 80% or 90%

  const p1 = baselineConversionRate;
  const p2 = p1 * (1 + minimumDetectableEffect);
  const pBar = (p1 + p2) / 2;

  const n = Math.pow(zAlpha + zBeta, 2) * 2 * pBar * (1 - pBar) / Math.pow(p2 - p1, 2);

  return Math.ceil(n);
}

// ==================== UTILITIES ====================

/**
 * Get experiment status label
 */
export function getStatusLabel(status: ExperimentStatus): { en: string; uk: string } {
  const labels: Record<ExperimentStatus, { en: string; uk: string }> = {
    draft: { en: 'Draft', uk: 'Чернетка' },
    running: { en: 'Running', uk: 'Активний' },
    paused: { en: 'Paused', uk: 'Призупинено' },
    completed: { en: 'Completed', uk: 'Завершено' },
    archived: { en: 'Archived', uk: 'В архіві' },
  };

  return labels[status] || { en: status, uk: status };
}

/**
 * Generate session ID
 */
export function generateSessionId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Get or create session ID
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return generateSessionId();

  const key = 'techshop_session_id';
  let sessionId = sessionStorage.getItem(key);

  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(key, sessionId);
  }

  return sessionId;
}
