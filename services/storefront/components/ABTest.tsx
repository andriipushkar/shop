'use client';

/**
 * A/B Test Component Wrapper
 * Declarative component for running A/B tests with different UI variants
 */

import React, { ReactNode, useEffect } from 'react';
import { useExperiment } from '@/lib/ab-testing/ab-context';

// ==================== TYPES ====================

export interface ABTestProps {
  /** Unique experiment identifier */
  experiment: string;

  /** Map of variant IDs to React elements */
  variants: Record<string, ReactNode>;

  /** Default content to show when not in experiment (optional) */
  default?: ReactNode;

  /** Loading state (optional) */
  loading?: ReactNode;

  /** Callback when variant is assigned */
  onVariantAssigned?: (variantId: string) => void;

  /** Auto-track conversions on specific events */
  trackConversions?: {
    onClick?: string; // Event name to track on click
    onView?: string; // Event name to track on view
  };
}

// ==================== COMPONENT ====================

/**
 * ABTest Component
 *
 * Usage:
 * ```tsx
 * <ABTest
 *   experiment="checkout-button"
 *   variants={{
 *     control: <Button>Купити</Button>,
 *     variant_a: <Button color="green">Замовити зараз</Button>,
 *     variant_b: <Button color="blue" size="large">Оформити замовлення</Button>
 *   }}
 * />
 * ```
 */
export function ABTest({
  experiment: experimentId,
  variants,
  default: defaultContent,
  loading,
  onVariantAssigned,
  trackConversions,
}: ABTestProps) {
  const { variant, isInExperiment, trackConversion } = useExperiment(experimentId);

  // Track view event
  useEffect(() => {
    if (isInExperiment && variant && trackConversions?.onView) {
      trackConversion(trackConversions.onView);
    }
  }, [isInExperiment, variant, trackConversions?.onView, trackConversion]);

  // Call onVariantAssigned callback
  useEffect(() => {
    if (variant && onVariantAssigned) {
      onVariantAssigned(variant.id);
    }
  }, [variant, onVariantAssigned]);

  // Show loading state if provided
  if (!variant && loading) {
    return <>{loading}</>;
  }

  // Show default if not in experiment
  if (!isInExperiment || !variant) {
    return defaultContent ? <>{defaultContent}</> : null;
  }

  // Get variant content
  const content = variants[variant.id];

  // If tracking clicks, wrap in click handler
  if (trackConversions?.onClick && content) {
    return (
      <div
        onClick={() => trackConversion(trackConversions.onClick!)}
        style={{ display: 'contents' }}
      >
        {content}
      </div>
    );
  }

  return <>{content}</>;
}

// ==================== VARIANT COMPONENT ====================

export interface VariantProps {
  /** Variant identifier */
  id: string;

  /** Child content */
  children: ReactNode;

  /** Whether this is the control variant */
  isControl?: boolean;
}

/**
 * Variant Component (for use with ABTestGroup)
 */
export function Variant({ children }: VariantProps) {
  return <>{children}</>;
}

// ==================== GROUP COMPONENT ====================

export interface ABTestGroupProps {
  /** Unique experiment identifier */
  experiment: string;

  /** Variant components */
  children: ReactNode;

  /** Default content to show when not in experiment */
  default?: ReactNode;
}

/**
 * ABTestGroup Component
 * Alternative API using children components
 *
 * Usage:
 * ```tsx
 * <ABTestGroup experiment="checkout-button">
 *   <Variant id="control" isControl>
 *     <Button>Купити</Button>
 *   </Variant>
 *   <Variant id="variant_a">
 *     <Button color="green">Замовити зараз</Button>
 *   </Variant>
 * </ABTestGroup>
 * ```
 */
export function ABTestGroup({ experiment: experimentId, children, default: defaultContent }: ABTestGroupProps) {
  const { variant, isInExperiment } = useExperiment(experimentId);

  // Show default if not in experiment
  if (!isInExperiment || !variant) {
    return defaultContent ? <>{defaultContent}</> : null;
  }

  // Find matching variant child
  const childrenArray = React.Children.toArray(children);
  const matchingChild = childrenArray.find(
    (child) =>
      React.isValidElement<VariantProps>(child) &&
      child.type === Variant &&
      child.props.id === variant.id
  );

  return matchingChild ? <>{matchingChild}</> : null;
}

// ==================== CONDITIONAL COMPONENT ====================

export interface ABConditionalProps {
  /** Unique experiment identifier */
  experiment: string;

  /** Variant ID to match */
  variant: string;

  /** Content to show if variant matches */
  children: ReactNode;

  /** Content to show if variant doesn't match (optional) */
  fallback?: ReactNode;
}

/**
 * ABConditional Component
 * Shows content only if user is assigned to specific variant
 *
 * Usage:
 * ```tsx
 * <ABConditional experiment="new-feature" variant="variant_a">
 *   <NewFeature />
 * </ABConditional>
 * ```
 */
export function ABConditional({
  experiment: experimentId,
  variant: targetVariantId,
  children,
  fallback,
}: ABConditionalProps) {
  const { variantId } = useExperiment(experimentId);

  if (variantId === targetVariantId) {
    return <>{children}</>;
  }

  return fallback ? <>{fallback}</> : null;
}

// ==================== FEATURE FLAG COMPONENT ====================

export interface FeatureFlagProps {
  /** Unique experiment/flag identifier */
  flag: string;

  /** Feature name in config (default: 'enabled') */
  feature?: string;

  /** Content to show when feature is enabled */
  children: ReactNode;

  /** Content to show when feature is disabled (optional) */
  fallback?: ReactNode;
}

/**
 * FeatureFlag Component
 * Simple feature flag based on experiment
 *
 * Usage:
 * ```tsx
 * <FeatureFlag flag="dark-mode">
 *   <DarkModeToggle />
 * </FeatureFlag>
 * ```
 */
export function FeatureFlag({
  flag: experimentId,
  feature = 'enabled',
  children,
  fallback,
}: FeatureFlagProps) {
  const { variant } = useExperiment(experimentId);

  const isEnabled = variant?.config[feature] === true;

  if (isEnabled) {
    return <>{children}</>;
  }

  return fallback ? <>{fallback}</> : null;
}

// ==================== CONVERSION TRIGGER COMPONENT ====================

export interface ConversionTriggerProps {
  /** Unique experiment identifier */
  experiment: string;

  /** Conversion event name */
  event: string;

  /** Event value (optional) */
  value?: number;

  /** Additional metadata (optional) */
  metadata?: Record<string, unknown>;

  /** Child content */
  children: ReactNode;

  /** Trigger on (default: 'click') */
  on?: 'click' | 'view' | 'hover';
}

/**
 * ConversionTrigger Component
 * Tracks conversion when user interacts with element
 *
 * Usage:
 * ```tsx
 * <ConversionTrigger experiment="checkout-button" event="button_clicked">
 *   <Button>Купити</Button>
 * </ConversionTrigger>
 * ```
 */
export function ConversionTrigger({
  experiment: experimentId,
  event,
  value,
  metadata,
  children,
  on = 'click',
}: ConversionTriggerProps) {
  const { trackConversion } = useExperiment(experimentId);

  const handleTrigger = () => {
    trackConversion(event, value, metadata);
  };

  useEffect(() => {
    if (on === 'view') {
      handleTrigger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const props = {
    onClick: on === 'click' ? handleTrigger : undefined,
    onMouseEnter: on === 'hover' ? handleTrigger : undefined,
    style: { display: 'contents' },
  };

  return <div {...props}>{children}</div>;
}
