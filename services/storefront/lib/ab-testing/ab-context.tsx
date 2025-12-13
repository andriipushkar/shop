'use client';

/**
 * A/B Testing React Context
 * Provides hooks and context for using A/B tests in React components
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Experiment, Variant } from '../ab-testing';
import { ABTestingService, getABTestingService, ABTestConfig } from './ab-service';

// ==================== TYPES ====================

export interface ABTestContextValue {
  service: ABTestingService;
  initialized: boolean;
  experiments: Experiment[];
  getVariant: (experimentId: string) => Variant | null;
  getVariantId: (experimentId: string) => string | null;
  getVariantConfig: <T = Record<string, unknown>>(experimentId: string) => T | null;
  isInExperiment: (experimentId: string) => boolean;
  trackConversion: (
    experimentId: string,
    eventName: string,
    eventValue?: number,
    metadata?: Record<string, unknown>
  ) => Promise<void>;
  clearAssignments: () => void;
}

export interface ABTestProviderProps {
  children: ReactNode;
  config?: ABTestConfig;
  userId?: string | null;
}

// ==================== CONTEXT ====================

const ABTestContext = createContext<ABTestContextValue | null>(null);

/**
 * A/B Test Provider Component
 */
export function ABTestProvider({ children, config, userId = null }: ABTestProviderProps) {
  const [service] = useState(() => getABTestingService(config));
  const [initialized, setInitialized] = useState(false);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [, forceUpdate] = useState({});

  // Initialize service
  useEffect(() => {
    const init = async () => {
      await service.initialize(userId);
      setInitialized(true);
      setExperiments(service.getExperiments());
    };

    init();
  }, [service, userId]);

  // Get variant for experiment
  const getVariant = useCallback(
    (experimentId: string) => {
      return service.getVariant(experimentId);
    },
    [service]
  );

  // Get variant ID
  const getVariantId = useCallback(
    (experimentId: string) => {
      return service.getVariantId(experimentId);
    },
    [service]
  );

  // Get variant config
  const getVariantConfig = useCallback(
    <T = Record<string, unknown>>(experimentId: string): T | null => {
      return service.getVariantConfig<T>(experimentId);
    },
    [service]
  );

  // Check if user is in experiment
  const isInExperiment = useCallback(
    (experimentId: string) => {
      return service.isInExperiment(experimentId);
    },
    [service]
  );

  // Track conversion
  const trackConversion = useCallback(
    async (
      experimentId: string,
      eventName: string,
      eventValue?: number,
      metadata?: Record<string, unknown>
    ) => {
      await service.trackConversion(experimentId, eventName, eventValue, metadata);
    },
    [service]
  );

  // Clear assignments
  const clearAssignments = useCallback(() => {
    service.clearAssignments();
    forceUpdate({});
  }, [service]);

  const value: ABTestContextValue = {
    service,
    initialized,
    experiments,
    getVariant,
    getVariantId,
    getVariantConfig,
    isInExperiment,
    trackConversion,
    clearAssignments,
  };

  return <ABTestContext.Provider value={value}>{children}</ABTestContext.Provider>;
}

// ==================== HOOKS ====================

/**
 * Use A/B test context
 */
export function useABTest(): ABTestContextValue {
  const context = useContext(ABTestContext);
  if (!context) {
    throw new Error('useABTest must be used within ABTestProvider');
  }
  return context;
}

/**
 * Use experiment - returns experiment data and variant assignment
 */
export function useExperiment(experimentId: string): {
  experiment: Experiment | null;
  variant: Variant | null;
  variantId: string | null;
  isInExperiment: boolean;
  isControl: boolean;
  trackConversion: (eventName: string, eventValue?: number, metadata?: Record<string, unknown>) => Promise<void>;
} {
  const { service, initialized } = useABTest();
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [variant, setVariant] = useState<Variant | null>(null);

  useEffect(() => {
    if (!initialized) return;

    const exp = service.getExperiment(experimentId);
    setExperiment(exp);

    const var_ = service.getVariant(experimentId);
    setVariant(var_);
  }, [service, experimentId, initialized]);

  const trackConversion = useCallback(
    async (eventName: string, eventValue?: number, metadata?: Record<string, unknown>) => {
      await service.trackConversion(experimentId, eventName, eventValue, metadata);
    },
    [service, experimentId]
  );

  return {
    experiment,
    variant,
    variantId: variant?.id || null,
    isInExperiment: variant !== null,
    isControl: variant?.isControl || false,
    trackConversion,
  };
}

/**
 * Use variant - returns just the variant for an experiment
 */
export function useVariant(experimentId: string): {
  variant: Variant | null;
  variantId: string | null;
  config: Record<string, unknown> | null;
  isControl: boolean;
} {
  const { service, initialized } = useABTest();
  const [variant, setVariant] = useState<Variant | null>(null);

  useEffect(() => {
    if (!initialized) return;

    const var_ = service.getVariant(experimentId);
    setVariant(var_);
  }, [service, experimentId, initialized]);

  return {
    variant,
    variantId: variant?.id || null,
    config: variant?.config || null,
    isControl: variant?.isControl || false,
  };
}

/**
 * Use variant config - returns typed variant configuration
 */
export function useVariantConfig<T = Record<string, unknown>>(experimentId: string): T | null {
  const { service, initialized } = useABTest();
  const [config, setConfig] = useState<T | null>(null);

  useEffect(() => {
    if (!initialized) return;

    const cfg = service.getVariantConfig<T>(experimentId);
    setConfig(cfg);
  }, [service, experimentId, initialized]);

  return config;
}

/**
 * Use conversion tracking - returns tracking function for an experiment
 */
export function useConversionTracking(experimentId: string) {
  const { service } = useABTest();

  const track = useCallback(
    async (eventName: string, eventValue?: number, metadata?: Record<string, unknown>) => {
      await service.trackConversion(experimentId, eventName, eventValue, metadata);
    },
    [service, experimentId]
  );

  return track;
}

/**
 * Use A/B test feature flag - simple boolean flag based on experiment
 */
export function useFeatureFlag(experimentId: string, featureName: string = 'enabled'): boolean {
  const { variant } = useVariant(experimentId);

  if (!variant) {
    return false;
  }

  return Boolean(variant.config[featureName]);
}

/**
 * Use multivariate test value
 */
export function useMultivariateValue<T>(
  experimentId: string,
  defaultValue: T
): T {
  const config = useVariantConfig<{ value: T }>(experimentId);
  return config?.value ?? defaultValue;
}
