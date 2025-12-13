/**
 * A/B Testing API - Tracking Routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { TrackingEvent } from '@/lib/ab-testing';

// Shared storage for tracking events (in production, use database)
const trackingEvents = new Map<string, TrackingEvent[]>();

/**
 * POST /api/ab/track - Track conversion/exposure event
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const event: TrackingEvent = {
      experimentId: data.experimentId,
      variantId: data.variantId,
      eventName: data.eventName,
      eventValue: data.eventValue,
      userId: data.userId,
      sessionId: data.sessionId,
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      metadata: data.metadata,
    };

    // Validate required fields
    if (!event.experimentId || !event.variantId || !event.eventName) {
      return NextResponse.json(
        { error: 'experimentId, variantId, and eventName are required' },
        { status: 400 }
      );
    }

    // Store event
    const key = event.experimentId;
    const events = trackingEvents.get(key) || [];
    events.push(event);
    trackingEvents.set(key, events);

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error('Error tracking event:', error);
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ab/track - Get tracking events for an experiment
 * Query params:
 *   - experimentId: experiment ID (required)
 *   - variantId: filter by variant (optional)
 *   - eventName: filter by event name (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const experimentId = searchParams.get('experimentId');
    const variantId = searchParams.get('variantId');
    const eventName = searchParams.get('eventName');

    if (!experimentId) {
      return NextResponse.json(
        { error: 'experimentId is required' },
        { status: 400 }
      );
    }

    let events = trackingEvents.get(experimentId) || [];

    // Filter by variant
    if (variantId) {
      events = events.filter(e => e.variantId === variantId);
    }

    // Filter by event name
    if (eventName) {
      events = events.filter(e => e.eventName === eventName);
    }

    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching tracking events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tracking events' },
      { status: 500 }
    );
  }
}

// Export tracking events map for use in results calculation
export { trackingEvents };
