/**
 * AI Repricing API Routes
 * API endpoints for repricing management
 */

import { NextRequest, NextResponse } from 'next/server';
import { repricingEngine, RepricingRule } from '@/lib/ai/repricing-engine';

/**
 * GET /api/ai/repricing/rules
 * Get all repricing rules or rules for a specific product
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const enabled = searchParams.get('enabled');

    let rules = repricingEngine.getRules(productId || undefined);

    // Filter by enabled status if specified
    if (enabled !== null) {
      const isEnabled = enabled === 'true';
      rules = rules.filter(rule => rule.enabled === isEnabled);
    }

    return NextResponse.json({
      success: true,
      data: rules,
      count: rules.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get repricing rules',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/repricing/rules
 * Create a new repricing rule
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    if (!body.strategy) {
      return NextResponse.json(
        { success: false, error: 'Strategy is required' },
        { status: 400 }
      );
    }

    if (!body.competitors || body.competitors.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one competitor is required' },
        { status: 400 }
      );
    }

    const rule: RepricingRule = {
      id: body.id,
      productId: body.productId,
      categoryId: body.categoryId,
      brandId: body.brandId,
      enabled: body.enabled !== false, // Default to true
      strategy: body.strategy,
      competitors: body.competitors,
      constraints: body.constraints || {},
      schedule: body.schedule,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await repricingEngine.setRule(rule);

    return NextResponse.json({
      success: true,
      message: 'Repricing rule created successfully',
      data: rule,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create repricing rule',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ai/repricing/rules
 * Update an existing repricing rule
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    // Get existing rule
    const existingRules = repricingEngine.getRules();
    const existingRule = existingRules.find(r => r.id === body.id);

    if (!existingRule) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }

    // Update rule
    const updatedRule: RepricingRule = {
      ...existingRule,
      ...body,
      updatedAt: new Date(),
    };

    await repricingEngine.setRule(updatedRule);

    return NextResponse.json({
      success: true,
      message: 'Repricing rule updated successfully',
      data: updatedRule,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update repricing rule',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai/repricing/rules
 * Delete a repricing rule
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('id');

    if (!ruleId) {
      return NextResponse.json(
        { success: false, error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    await repricingEngine.deleteRule(ruleId);

    return NextResponse.json({
      success: true,
      message: 'Repricing rule deleted successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete repricing rule',
      },
      { status: 500 }
    );
  }
}
