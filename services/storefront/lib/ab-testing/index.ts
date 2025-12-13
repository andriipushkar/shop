/**
 * A/B Testing Framework - Main Export
 *
 * This module provides a complete A/B testing framework with:
 * - Variant assignment with consistent hashing
 * - Conversion tracking
 * - Statistical significance calculation
 * - React hooks and components
 * - Admin dashboard for managing experiments
 */

// Core service
export { ABTestingService, getABTestingService, resetABTestingService } from './ab-service';
export type { ABTestConfig, ConversionData } from './ab-service';

// React context and hooks
export {
  ABTestProvider,
  useABTest,
  useExperiment,
  useVariant,
  useVariantConfig,
  useConversionTracking,
  useFeatureFlag,
  useMultivariateValue,
} from './ab-context';
export type { ABTestContextValue, ABTestProviderProps } from './ab-context';

// Re-export from ab-testing.ts for convenience
export type {
  Experiment,
  Variant,
  ExperimentStatus,
  ExperimentType,
  Targeting,
  TargetingRule,
  Metric,
  MetricType,
  ExperimentResults,
  VariantResult,
  ExperimentAssignment,
  TrackingEvent,
} from '../ab-testing';

export {
  assignVariant,
  matchesTargeting,
  calculateSignificance,
  calculateConversionRate,
  calculateUplift,
  isSignificant,
  getRequiredSampleSize,
  getStatusLabel,
  generateSessionId,
  getSessionId,
  getStoredAssignments,
  storeAssignment,
  getAssignment,
  clearAssignments,
  trackExposure,
  trackConversion,
  trackBatch,
  getActiveExperiments,
  getExperiment,
  getExperimentResults,
  createExperiment,
  updateExperiment,
  startExperiment,
  stopExperiment,
  deleteExperiment,
  DEFAULT_METRICS,
  EXPERIMENT_COOKIE_NAME,
  EXPERIMENT_COOKIE_DURATION,
} from '../ab-testing';
