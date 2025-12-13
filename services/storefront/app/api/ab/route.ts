/**
 * A/B Testing API Routes
 * Main endpoints for managing experiments
 */

import { NextRequest, NextResponse } from 'next/server';
import { Experiment, ExperimentStatus } from '@/lib/ab-testing';

// In-memory storage (replace with database in production)
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

// Initialize with sample data
if (experiments.size === 0) {
  const sampleExperiment: Experiment = {
    id: 'checkout-button-test',
    name: 'Тест кнопки оформлення замовлення',
    description: 'Порівняння різних текстів на кнопці checkout',
    status: 'running',
    type: 'ab_test',
    variants: [
      {
        id: 'control',
        name: 'Контроль',
        description: 'Стандартна кнопка',
        weight: 50,
        isControl: true,
        config: { text: 'Купити', color: 'default' },
      },
      {
        id: 'variant_a',
        name: 'Варіант A',
        description: 'Зелена кнопка з іншим текстом',
        weight: 50,
        isControl: false,
        config: { text: 'Замовити зараз', color: 'green' },
      },
    ],
    targeting: {},
    metrics: [
      { id: 'conversion', name: 'Conversion Rate', type: 'conversion', isPrimary: true },
    ],
    allocation: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'admin',
  };

  experiments.set(sampleExperiment.id, sampleExperiment);
}

/**
 * GET /api/ab - Get all experiments
 * Query params:
 *   - status: filter by status (running, completed, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as ExperimentStatus | null;

    let results = Array.from(experiments.values());

    // Filter by status
    if (status) {
      results = results.filter(exp => exp.status === status);
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching experiments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch experiments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ab - Create new experiment
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Validate required fields
    if (!data.name || !data.variants || data.variants.length < 2) {
      return NextResponse.json(
        { error: 'Name and at least 2 variants are required' },
        { status: 400 }
      );
    }

    // Validate variant weights
    const totalWeight = data.variants.reduce((sum: number, v: { weight: number }) => sum + v.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      return NextResponse.json(
        { error: 'Variant weights must sum to 100' },
        { status: 400 }
      );
    }

    // Check for exactly one control
    const controlCount = data.variants.filter((v: { isControl: boolean }) => v.isControl).length;
    if (controlCount !== 1) {
      return NextResponse.json(
        { error: 'Exactly one variant must be marked as control' },
        { status: 400 }
      );
    }

    const experiment: Experiment = {
      id: data.id || `exp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      name: data.name,
      description: data.description || '',
      status: data.status || 'draft',
      type: data.type || 'ab_test',
      variants: data.variants,
      targeting: data.targeting || {},
      metrics: data.metrics || [
        { id: 'conversion', name: 'Conversion Rate', type: 'conversion', isPrimary: true },
      ],
      allocation: data.allocation || 100,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: data.createdBy || 'admin',
    };

    experiments.set(experiment.id, experiment);

    return NextResponse.json(experiment, { status: 201 });
  } catch (error) {
    console.error('Error creating experiment:', error);
    return NextResponse.json(
      { error: 'Failed to create experiment' },
      { status: 500 }
    );
  }
}
