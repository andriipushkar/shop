/**
 * A/B Testing API - Results Routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { Experiment, ExperimentResults, VariantResult } from '@/lib/ab-testing';

// Shared storage (in production, use database)
const experiments = new Map<string, Experiment>();
const trackingEvents = new Map<string, Array<{
  experimentId: string;
  variantId: string;
  eventName: string;
  eventValue?: number;
  userId?: string;
  sessionId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}>>();

/**
 * Calculate statistical significance using z-test
 */
function calculateSignificance(
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
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  return Math.round((1 - pValue) * 100);
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
 * GET /api/ab/results/:id - Get experiment results
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const experiment = experiments.get(params.id);

    if (!experiment) {
      return NextResponse.json(
        { error: 'Experiment not found' },
        { status: 404 }
      );
    }

    const events = trackingEvents.get(params.id) || [];

    // Calculate results for each variant
    const variantResults: VariantResult[] = experiment.variants.map(variant => {
      // Get unique sessions that saw this variant (exposures)
      const exposureSessions = new Set(
        events
          .filter(e => e.variantId === variant.id && e.eventName === 'exposure')
          .map(e => e.sessionId)
      );

      const participants = exposureSessions.size;

      // Get unique sessions that converted
      const conversionSessions = new Set(
        events
          .filter(e => e.variantId === variant.id && e.eventName === 'conversion')
          .map(e => e.sessionId)
      );

      const conversions = conversionSessions.size;
      const conversionRate = participants > 0 ? (conversions / participants) * 100 : 0;

      // Calculate revenue
      const revenue = events
        .filter(e => e.variantId === variant.id && e.eventValue)
        .reduce((sum, e) => sum + (e.eventValue || 0), 0);

      const avgOrderValue = conversions > 0 ? revenue / conversions : 0;

      // Count other metrics
      const metrics: Record<string, number> = {};
      const eventTypes = new Set(events.map(e => e.eventName));

      eventTypes.forEach(eventType => {
        if (eventType !== 'exposure' && eventType !== 'conversion') {
          const count = events.filter(
            e => e.variantId === variant.id && e.eventName === eventType
          ).length;
          metrics[eventType] = count;
        }
      });

      return {
        variantId: variant.id,
        participants,
        conversions,
        conversionRate: Math.round(conversionRate * 100) / 100,
        revenue: Math.round(revenue * 100) / 100,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        metrics,
      };
    });

    // Find control variant
    const controlResult = variantResults.find(r => {
      const variant = experiment.variants.find(v => v.id === r.variantId);
      return variant?.isControl;
    });

    // Calculate statistical significance
    let statisticalSignificance = 0;
    let confidenceLevel = 0;
    let uplift = 0;
    let recommendedVariant: string | undefined;

    if (controlResult && variantResults.length > 1) {
      // Find best performing variant
      const bestVariant = variantResults
        .filter(r => r.variantId !== controlResult.variantId)
        .reduce((best, current) =>
          current.conversionRate > best.conversionRate ? current : best
        );

      if (bestVariant) {
        statisticalSignificance = calculateSignificance(
          controlResult.conversions,
          controlResult.participants,
          bestVariant.conversions,
          bestVariant.participants
        );

        confidenceLevel = statisticalSignificance;

        if (controlResult.conversionRate > 0) {
          uplift = Math.round(
            ((bestVariant.conversionRate - controlResult.conversionRate) /
              controlResult.conversionRate) *
              10000
          ) / 100;
        }

        // Recommend variant if statistically significant and positive uplift
        if (statisticalSignificance >= 95 && uplift > 0) {
          recommendedVariant = bestVariant.variantId;
        }
      }
    }

    const totalParticipants = variantResults.reduce(
      (sum, r) => sum + r.participants,
      0
    );

    const results: ExperimentResults = {
      totalParticipants,
      variantResults,
      statisticalSignificance,
      confidenceLevel,
      uplift,
      recommendedVariant,
    };

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error calculating results:', error);
    return NextResponse.json(
      { error: 'Failed to calculate results' },
      { status: 500 }
    );
  }
}
