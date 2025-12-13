import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/admin/analytics/events
 * Збереження події аналітики
 */
export async function POST(request: NextRequest) {
  try {
    const event = await request.json();

    // Валідація події
    if (!event.eventType || !event.sessionId) {
      return NextResponse.json(
        { error: 'eventType та sessionId є обов\'язковими' },
        { status: 400 }
      );
    }

    // TODO: Зберегти подію в базі даних
    // Наприклад, використовуючи Prisma або іншу ORM
    // await prisma.analyticsEvent.create({
    //   data: {
    //     eventType: event.eventType,
    //     sessionId: event.sessionId,
    //     userId: event.userId,
    //     timestamp: new Date(event.timestamp),
    //     url: event.url,
    //     referrer: event.referrer,
    //     userAgent: event.userAgent,
    //     data: event.data,
    //   },
    // });

    console.log('Analytics event received:', {
      type: event.eventType,
      session: event.sessionId,
      timestamp: event.timestamp,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Failed to save analytics event:', error);
    return NextResponse.json(
      { error: 'Помилка при збереженні події' },
      { status: 500 }
    );
  }
}
