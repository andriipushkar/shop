/**
 * A/B Testing API - Single Experiment Routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { Experiment } from '@/lib/ab-testing';

// Shared storage (in production, use database)
const experiments = new Map<string, Experiment>();

/**
 * GET /api/ab/experiments/:id - Get single experiment
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

    return NextResponse.json(experiment);
  } catch (error) {
    console.error('Error fetching experiment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch experiment' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ab/experiments/:id - Update experiment
 */
export async function PUT(
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

    const updates = await request.json();

    // Update experiment
    const updated: Experiment = {
      ...experiment,
      ...updates,
      id: experiment.id, // Prevent ID change
      createdAt: experiment.createdAt, // Preserve creation date
      updatedAt: new Date(),
    };

    experiments.set(params.id, updated);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating experiment:', error);
    return NextResponse.json(
      { error: 'Failed to update experiment' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ab/experiments/:id - Delete experiment
 */
export async function DELETE(
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

    experiments.delete(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting experiment:', error);
    return NextResponse.json(
      { error: 'Failed to delete experiment' },
      { status: 500 }
    );
  }
}
