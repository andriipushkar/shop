'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
    ExperimentManager,
    experimentManager,
    ExperimentContext,
    ExperimentResult,
} from './ab-testing';
import { getAllExperiments } from './experiments-config';

interface ExperimentContextValue {
    manager: ExperimentManager;
    isReady: boolean;
    getVariant: (experimentId: string) => ExperimentResult | null;
    isInVariant: (experimentId: string, variantId: string) => boolean;
    trackConversion: (experimentId: string, conversionName: string, value?: number) => void;
    getVariantConfig: <T = unknown>(experimentId: string, defaultValue?: T) => T | undefined;
}

const ExperimentCtx = createContext<ExperimentContextValue | null>(null);

interface ExperimentProviderProps {
    children: ReactNode;
    userId?: string;
    userAttributes?: Record<string, unknown>;
}

export function ExperimentProvider({ children, userId, userAttributes }: ExperimentProviderProps) {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Get or create session ID
        let sessionId = sessionStorage.getItem('experiment_session_id');
        if (!sessionId) {
            sessionId = uuidv4();
            sessionStorage.setItem('experiment_session_id', sessionId);
        }

        // Detect device type
        const getDeviceType = (): 'desktop' | 'mobile' | 'tablet' => {
            const ua = navigator.userAgent;
            if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
                return 'tablet';
            }
            if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
                return 'mobile';
            }
            return 'desktop';
        };

        // Check if new user
        const isNewUser = !localStorage.getItem('returning_user');
        if (!isNewUser) {
            localStorage.setItem('returning_user', 'true');
        }

        // Set context
        const context: ExperimentContext = {
            userId,
            sessionId,
            device: getDeviceType(),
            isNewUser,
            userAttributes,
            // Country could be detected via API or header
        };

        experimentManager.setContext(context);

        // Register all experiments
        experimentManager.registerExperiments(getAllExperiments());

        setIsReady(true);

        // Track active experiments for debugging
        if (process.env.NODE_ENV === 'development') {
            const activeVariants = experimentManager.getActiveVariants();
            console.log('[Experiments] Active variants:', activeVariants);
        }
    }, [userId, userAttributes]);

    const value: ExperimentContextValue = {
        manager: experimentManager,
        isReady,
        getVariant: (experimentId) => experimentManager.getVariant(experimentId),
        isInVariant: (experimentId, variantId) => experimentManager.isInVariant(experimentId, variantId),
        trackConversion: (experimentId, conversionName, value) =>
            experimentManager.trackConversion(experimentId, conversionName, value),
        getVariantConfig: <T = unknown>(experimentId: string, defaultValue?: T): T | undefined => {
            const result = experimentManager.getVariant(experimentId);
            return (result?.variant.config as T) ?? defaultValue;
        },
    };

    return <ExperimentCtx.Provider value={value}>{children}</ExperimentCtx.Provider>;
}

// Hook to use experiment context
export function useExperiments(): ExperimentContextValue {
    const context = useContext(ExperimentCtx);
    if (!context) {
        throw new Error('useExperiments must be used within ExperimentProvider');
    }
    return context;
}

// Hook for specific experiment
export function useExperiment(experimentId: string): {
    variant: ExperimentResult | null;
    isInVariant: (variantId: string) => boolean;
    config: Record<string, unknown> | undefined;
    trackConversion: (conversionName: string, value?: number) => void;
} {
    const { getVariant, isInVariant, trackConversion, isReady } = useExperiments();
    const [variant, setVariant] = useState<ExperimentResult | null>(null);

    useEffect(() => {
        if (isReady) {
            setVariant(getVariant(experimentId));
        }
    }, [experimentId, isReady, getVariant]);

    return {
        variant,
        isInVariant: (variantId) => isInVariant(experimentId, variantId),
        config: variant?.variant.config as Record<string, unknown> | undefined,
        trackConversion: (conversionName, value) => trackConversion(experimentId, conversionName, value),
    };
}

// Hook for feature flag (boolean)
export function useFeatureFlag(flagId: string): boolean {
    const { isInVariant, isReady } = useExperiments();
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        if (isReady) {
            setEnabled(isInVariant(flagId, 'enabled'));
        }
    }, [flagId, isReady, isInVariant]);

    return enabled;
}

// Component for conditional rendering based on experiment
interface ExperimentProps {
    id: string;
    children: ReactNode | ((variant: ExperimentResult) => ReactNode);
    fallback?: ReactNode;
}

export function Experiment({ id, children, fallback = null }: ExperimentProps) {
    const { variant, isInVariant } = useExperiment(id);

    if (!variant) {
        return <>{fallback}</>;
    }

    if (typeof children === 'function') {
        return <>{children(variant)}</>;
    }

    return <>{children}</>;
}

// Component for specific variant
interface VariantProps {
    experimentId: string;
    variantId: string;
    children: ReactNode;
}

export function Variant({ experimentId, variantId, children }: VariantProps) {
    const { isInVariant } = useExperiment(experimentId);

    if (!isInVariant(variantId)) {
        return null;
    }

    return <>{children}</>;
}

// Feature flag component
interface FeatureFlagProps {
    flag: string;
    children: ReactNode;
    fallback?: ReactNode;
}

export function FeatureFlag({ flag, children, fallback = null }: FeatureFlagProps) {
    const enabled = useFeatureFlag(flag);

    return <>{enabled ? children : fallback}</>;
}
