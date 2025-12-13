import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from '@/lib/logger';
import { cache } from '@/lib/cache';

/**
 * POST /api/reviews/[id]/vote - Vote on a review
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: reviewId } = params;
    const body = await request.json();
    const { voteType } = body;

    // Validate vote type
    if (!voteType || !['helpful', 'not_helpful'].includes(voteType)) {
      return NextResponse.json(
        { error: 'Invalid vote type', errorUk: 'Невірний тип голосу' },
        { status: 400 }
      );
    }

    // Get user session/IP for vote tracking (simplified version)
    // In production, you'd want to use actual authentication
    const userIdentifier = request.headers.get('x-forwarded-for') ||
                           request.headers.get('x-real-ip') ||
                           'anonymous';

    // Check if user already voted (using cache)
    const voteKey = `review:${reviewId}:vote:${userIdentifier}`;
    const existingVote = await cache.get(voteKey);

    if (existingVote) {
      return NextResponse.json(
        {
          error: 'You have already voted on this review',
          errorUk: 'Ви вже проголосували за цей відгук'
        },
        { status: 400 }
      );
    }

    // In a real application, you would:
    // 1. Check if review exists in database
    // 2. Store the vote in database
    // 3. Update review vote counts
    // 4. Return updated vote counts

    // For this example, we'll simulate the database operation
    // and return mock data

    // Store vote in cache (expires in 30 days)
    await cache.set(voteKey, voteType, 30 * 24 * 60 * 60);

    // Get current vote counts from cache or initialize
    const votesKey = `review:${reviewId}:votes`;
    const currentVotes = await cache.get(votesKey) || {
      helpful: 0,
      notHelpful: 0,
    };

    // Update vote count
    if (voteType === 'helpful') {
      currentVotes.helpful += 1;
    } else {
      currentVotes.notHelpful += 1;
    }

    // Save updated votes
    await cache.set(votesKey, currentVotes, 30 * 24 * 60 * 60);

    const response = {
      success: true,
      newVotes: {
        helpful: currentVotes.helpful,
        notHelpful: currentVotes.notHelpful,
        userVote: voteType,
      },
    };

    apiLogger.info('Review vote recorded', { reviewId, voteType, userIdentifier });

    return NextResponse.json(response);
  } catch (error) {
    apiLogger.error('Error voting on review', error);
    return NextResponse.json(
      { error: 'Failed to vote', errorUk: 'Помилка голосування' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reviews/[id]/vote - Get vote status for a review
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: reviewId } = params;

    // Get user identifier
    const userIdentifier = request.headers.get('x-forwarded-for') ||
                           request.headers.get('x-real-ip') ||
                           'anonymous';

    // Check user's vote
    const voteKey = `review:${reviewId}:vote:${userIdentifier}`;
    const userVote = await cache.get(voteKey);

    // Get vote counts
    const votesKey = `review:${reviewId}:votes`;
    const votes = await cache.get(votesKey) || {
      helpful: 0,
      notHelpful: 0,
    };

    return NextResponse.json({
      votes: {
        helpful: votes.helpful,
        notHelpful: votes.notHelpful,
        userVote: userVote || null,
      },
    });
  } catch (error) {
    apiLogger.error('Error getting review vote status', error);
    return NextResponse.json(
      { error: 'Failed to get vote status', errorUk: 'Помилка отримання статусу голосування' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reviews/[id]/vote - Remove vote (allow users to change their mind)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: reviewId } = params;

    // Get user identifier
    const userIdentifier = request.headers.get('x-forwarded-for') ||
                           request.headers.get('x-real-ip') ||
                           'anonymous';

    // Check existing vote
    const voteKey = `review:${reviewId}:vote:${userIdentifier}`;
    const existingVote = await cache.get(voteKey);

    if (!existingVote) {
      return NextResponse.json(
        { error: 'No vote to remove', errorUk: 'Немає голосу для видалення' },
        { status: 400 }
      );
    }

    // Get current vote counts
    const votesKey = `review:${reviewId}:votes`;
    const currentVotes = await cache.get(votesKey) || {
      helpful: 0,
      notHelpful: 0,
    };

    // Decrease vote count
    if (existingVote === 'helpful' && currentVotes.helpful > 0) {
      currentVotes.helpful -= 1;
    } else if (existingVote === 'not_helpful' && currentVotes.notHelpful > 0) {
      currentVotes.notHelpful -= 1;
    }

    // Update votes
    await cache.set(votesKey, currentVotes, 30 * 24 * 60 * 60);

    // Remove user's vote
    await cache.del(voteKey);

    apiLogger.info('Review vote removed', { reviewId, userIdentifier });

    return NextResponse.json({
      success: true,
      newVotes: {
        helpful: currentVotes.helpful,
        notHelpful: currentVotes.notHelpful,
        userVote: null,
      },
    });
  } catch (error) {
    apiLogger.error('Error removing review vote', error);
    return NextResponse.json(
      { error: 'Failed to remove vote', errorUk: 'Помилка видалення голосу' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/reviews/[id]/vote - CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
