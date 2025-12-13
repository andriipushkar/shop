/**
 * Conversion Funnel Analytics
 * Tracks user journey through the purchase funnel
 */

export interface FunnelStage {
  id: string;
  name: string;
  nameUk: string;
  order: number;
  description: string;
  descriptionUk: string;
}

export interface FunnelEvent {
  id: string;
  sessionId: string;
  userId?: string;
  stage: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
  source?: string;
  medium?: string;
  campaign?: string;
  device: 'desktop' | 'mobile' | 'tablet';
  previousStage?: string;
  timeFromPrevious?: number; // seconds
}

export interface FunnelMetrics {
  stage: string;
  stageName: string;
  stageNameUk: string;
  visitors: number;
  conversions: number; // Number that moved to next stage
  conversionRate: number; // Percentage
  dropoffRate: number; // Percentage that dropped off
  avgTimeInStage: number; // seconds
  value?: number; // Revenue or cart value at this stage
}

export interface FunnelReport {
  dateRange: { from: Date; to: Date };
  totalSessions: number;
  totalConversions: number;
  overallConversionRate: number;
  totalRevenue: number;
  averageOrderValue: number;
  stages: FunnelMetrics[];
  dropoffAnalysis: DropoffAnalysis[];
  segmentation: FunnelSegmentation;
  trends: FunnelTrends;
}

export interface DropoffAnalysis {
  fromStage: string;
  toStage: string;
  dropoffCount: number;
  dropoffRate: number;
  topReasons: DropoffReason[];
  recommendations: string[];
  recommendationsUk: string[];
}

export interface DropoffReason {
  reason: string;
  reasonUk: string;
  percentage: number;
  count: number;
}

export interface FunnelSegmentation {
  byDevice: Record<string, FunnelMetrics[]>;
  bySource: Record<string, FunnelMetrics[]>;
  byNewVsReturning: {
    new: FunnelMetrics[];
    returning: FunnelMetrics[];
  };
}

export interface FunnelTrends {
  dailyConversions: { date: string; conversions: number; rate: number }[];
  weekOverWeek: { metric: string; change: number; trend: 'up' | 'down' | 'stable' }[];
  monthOverMonth: { metric: string; change: number; trend: 'up' | 'down' | 'stable' }[];
}

// E-commerce funnel stages
export const ECOMMERCE_FUNNEL_STAGES: FunnelStage[] = [
  {
    id: 'visit',
    name: 'Site Visit',
    nameUk: 'Відвідування сайту',
    order: 1,
    description: 'User lands on any page',
    descriptionUk: 'Користувач заходить на будь-яку сторінку',
  },
  {
    id: 'product_view',
    name: 'Product View',
    nameUk: 'Перегляд товару',
    order: 2,
    description: 'User views a product page',
    descriptionUk: 'Користувач переглядає картку товару',
  },
  {
    id: 'add_to_cart',
    name: 'Add to Cart',
    nameUk: 'Додано до кошика',
    order: 3,
    description: 'User adds item to cart',
    descriptionUk: 'Користувач додає товар до кошика',
  },
  {
    id: 'cart_view',
    name: 'Cart View',
    nameUk: 'Перегляд кошика',
    order: 4,
    description: 'User views cart page',
    descriptionUk: 'Користувач переглядає кошик',
  },
  {
    id: 'checkout_start',
    name: 'Checkout Start',
    nameUk: 'Початок оформлення',
    order: 5,
    description: 'User begins checkout process',
    descriptionUk: 'Користувач починає оформлення замовлення',
  },
  {
    id: 'checkout_shipping',
    name: 'Shipping Info',
    nameUk: 'Дані доставки',
    order: 6,
    description: 'User enters shipping information',
    descriptionUk: 'Користувач вводить дані доставки',
  },
  {
    id: 'checkout_payment',
    name: 'Payment Info',
    nameUk: 'Дані оплати',
    order: 7,
    description: 'User enters payment information',
    descriptionUk: 'Користувач вводить дані оплати',
  },
  {
    id: 'purchase',
    name: 'Purchase Complete',
    nameUk: 'Замовлення завершено',
    order: 8,
    description: 'User completes purchase',
    descriptionUk: 'Користувач завершує замовлення',
  },
];

// Common dropoff reasons by stage
export const DROPOFF_REASONS: Record<string, DropoffReason[]> = {
  product_view: [
    { reason: 'High price', reasonUk: 'Висока ціна', percentage: 0, count: 0 },
    { reason: 'Out of stock', reasonUk: 'Немає в наявності', percentage: 0, count: 0 },
    { reason: 'Insufficient info', reasonUk: 'Недостатньо інформації', percentage: 0, count: 0 },
    { reason: 'Poor reviews', reasonUk: 'Погані відгуки', percentage: 0, count: 0 },
  ],
  add_to_cart: [
    { reason: 'Browsing only', reasonUk: 'Тільки переглядає', percentage: 0, count: 0 },
    { reason: 'Price comparison', reasonUk: 'Порівняння цін', percentage: 0, count: 0 },
    { reason: 'Technical issues', reasonUk: 'Технічні проблеми', percentage: 0, count: 0 },
  ],
  checkout_start: [
    { reason: 'Shipping costs', reasonUk: 'Вартість доставки', percentage: 0, count: 0 },
    { reason: 'Account required', reasonUk: 'Потрібен акаунт', percentage: 0, count: 0 },
    { reason: 'Complex checkout', reasonUk: 'Складне оформлення', percentage: 0, count: 0 },
  ],
  checkout_shipping: [
    { reason: 'Delivery time', reasonUk: 'Час доставки', percentage: 0, count: 0 },
    { reason: 'No suitable option', reasonUk: 'Немає підходящого варіанту', percentage: 0, count: 0 },
    { reason: 'Form errors', reasonUk: 'Помилки форми', percentage: 0, count: 0 },
  ],
  checkout_payment: [
    { reason: 'Payment method unavailable', reasonUk: 'Немає потрібного способу оплати', percentage: 0, count: 0 },
    { reason: 'Security concerns', reasonUk: 'Питання безпеки', percentage: 0, count: 0 },
    { reason: 'Payment failed', reasonUk: 'Помилка оплати', percentage: 0, count: 0 },
    { reason: 'Changed mind', reasonUk: 'Передумав', percentage: 0, count: 0 },
  ],
};

/**
 * Calculate funnel metrics from events
 */
export function calculateFunnelMetrics(
  events: FunnelEvent[],
  stages: FunnelStage[] = ECOMMERCE_FUNNEL_STAGES
): FunnelMetrics[] {
  const stageMap = new Map<string, FunnelStage>();
  stages.forEach(s => stageMap.set(s.id, s));

  // Group events by session and stage
  const sessionStages = new Map<string, Set<string>>();
  const stageTimings = new Map<string, number[]>();

  for (const event of events) {
    if (!sessionStages.has(event.sessionId)) {
      sessionStages.set(event.sessionId, new Set());
    }
    sessionStages.get(event.sessionId)!.add(event.stage);

    // Track time in stage
    if (event.timeFromPrevious !== undefined) {
      if (!stageTimings.has(event.stage)) {
        stageTimings.set(event.stage, []);
      }
      stageTimings.get(event.stage)!.push(event.timeFromPrevious);
    }
  }

  // Calculate metrics for each stage
  const metrics: FunnelMetrics[] = [];
  const sortedStages = [...stages].sort((a, b) => a.order - b.order);

  for (let i = 0; i < sortedStages.length; i++) {
    const stage = sortedStages[i];
    const nextStage = sortedStages[i + 1];

    // Count sessions that reached this stage
    const visitors = Array.from(sessionStages.values()).filter(
      stages => stages.has(stage.id)
    ).length;

    // Count sessions that moved to next stage
    const conversions = nextStage
      ? Array.from(sessionStages.values()).filter(
          stages => stages.has(stage.id) && stages.has(nextStage.id)
        ).length
      : visitors; // Last stage - consider all as conversions

    const conversionRate = visitors > 0 ? (conversions / visitors) * 100 : 0;
    const dropoffRate = 100 - conversionRate;

    // Calculate average time in stage
    const timings = stageTimings.get(stage.id) || [];
    const avgTimeInStage = timings.length > 0
      ? timings.reduce((a, b) => a + b, 0) / timings.length
      : 0;

    metrics.push({
      stage: stage.id,
      stageName: stage.name,
      stageNameUk: stage.nameUk,
      visitors,
      conversions,
      conversionRate: Math.round(conversionRate * 10) / 10,
      dropoffRate: Math.round(dropoffRate * 10) / 10,
      avgTimeInStage: Math.round(avgTimeInStage),
    });
  }

  return metrics;
}

/**
 * Analyze dropoff between stages
 */
export function analyzeDropoff(
  events: FunnelEvent[],
  metrics: FunnelMetrics[]
): DropoffAnalysis[] {
  const analyses: DropoffAnalysis[] = [];

  for (let i = 0; i < metrics.length - 1; i++) {
    const fromStage = metrics[i];
    const toStage = metrics[i + 1];
    const dropoffCount = fromStage.visitors - fromStage.conversions;
    const dropoffRate = fromStage.dropoffRate;

    // Get predefined reasons for this stage
    const reasons = DROPOFF_REASONS[fromStage.stage] || [];

    // Generate recommendations based on dropoff rate
    const recommendations: string[] = [];
    const recommendationsUk: string[] = [];

    if (dropoffRate > 50) {
      recommendations.push(`Critical: ${dropoffRate.toFixed(0)}% dropoff at ${fromStage.stageName} requires immediate attention`);
      recommendationsUk.push(`Критично: ${dropoffRate.toFixed(0)}% відмов на етапі "${fromStage.stageNameUk}" потребує негайної уваги`);
    }

    // Stage-specific recommendations
    switch (fromStage.stage) {
      case 'product_view':
        if (dropoffRate > 70) {
          recommendations.push('Add more product images and videos');
          recommendations.push('Display clear pricing and availability');
          recommendationsUk.push('Додайте більше фото та відео товару');
          recommendationsUk.push('Покажіть чітко ціну та наявність');
        }
        break;
      case 'add_to_cart':
        if (dropoffRate > 60) {
          recommendations.push('Simplify add-to-cart process');
          recommendations.push('Show cart summary without leaving page');
          recommendationsUk.push('Спростіть процес додавання до кошика');
          recommendationsUk.push('Показуйте кошик без переходу на іншу сторінку');
        }
        break;
      case 'checkout_start':
        if (dropoffRate > 40) {
          recommendations.push('Offer guest checkout option');
          recommendations.push('Display shipping costs upfront');
          recommendations.push('Add progress indicator');
          recommendationsUk.push('Запропонуйте оформлення без реєстрації');
          recommendationsUk.push('Показуйте вартість доставки одразу');
          recommendationsUk.push('Додайте індикатор прогресу');
        }
        break;
      case 'checkout_shipping':
        if (dropoffRate > 30) {
          recommendations.push('Add more delivery options');
          recommendations.push('Pre-fill address when possible');
          recommendationsUk.push('Додайте більше варіантів доставки');
          recommendationsUk.push('Автозаповнюйте адресу де можливо');
        }
        break;
      case 'checkout_payment':
        if (dropoffRate > 20) {
          recommendations.push('Add popular payment methods (PrivatBank, Apple Pay)');
          recommendations.push('Display security badges');
          recommendations.push('Offer installment options');
          recommendationsUk.push('Додайте популярні способи оплати (ПриватБанк, Apple Pay)');
          recommendationsUk.push('Покажіть значки безпеки');
          recommendationsUk.push('Запропонуйте оплату частинами');
        }
        break;
    }

    analyses.push({
      fromStage: fromStage.stage,
      toStage: toStage.stage,
      dropoffCount,
      dropoffRate,
      topReasons: reasons,
      recommendations,
      recommendationsUk,
    });
  }

  return analyses;
}

/**
 * Calculate overall conversion rate
 */
export function calculateOverallConversion(metrics: FunnelMetrics[]): {
  rate: number;
  totalVisitors: number;
  totalConversions: number;
} {
  if (metrics.length === 0) {
    return { rate: 0, totalVisitors: 0, totalConversions: 0 };
  }

  const firstStage = metrics[0];
  const lastStage = metrics[metrics.length - 1];

  return {
    rate: firstStage.visitors > 0
      ? Math.round((lastStage.visitors / firstStage.visitors) * 1000) / 10
      : 0,
    totalVisitors: firstStage.visitors,
    totalConversions: lastStage.visitors,
  };
}

/**
 * Segment funnel by device type
 */
export function segmentByDevice(
  events: FunnelEvent[],
  stages: FunnelStage[] = ECOMMERCE_FUNNEL_STAGES
): Record<string, FunnelMetrics[]> {
  const devices = ['desktop', 'mobile', 'tablet'];
  const result: Record<string, FunnelMetrics[]> = {};

  for (const device of devices) {
    const deviceEvents = events.filter(e => e.device === device);
    result[device] = calculateFunnelMetrics(deviceEvents, stages);
  }

  return result;
}

/**
 * Segment funnel by traffic source
 */
export function segmentBySource(
  events: FunnelEvent[],
  stages: FunnelStage[] = ECOMMERCE_FUNNEL_STAGES
): Record<string, FunnelMetrics[]> {
  // Group events by source
  const sources = new Set(events.map(e => e.source || 'direct'));
  const result: Record<string, FunnelMetrics[]> = {};

  for (const source of sources) {
    const sourceEvents = events.filter(e => (e.source || 'direct') === source);
    result[source] = calculateFunnelMetrics(sourceEvents, stages);
  }

  return result;
}

/**
 * Generate funnel visualization data
 */
export function generateFunnelVisualization(metrics: FunnelMetrics[]): {
  labels: string[];
  labelsUk: string[];
  values: number[];
  percentages: number[];
  colors: string[];
} {
  const firstVisitors = metrics[0]?.visitors || 1;

  return {
    labels: metrics.map(m => m.stageName),
    labelsUk: metrics.map(m => m.stageNameUk),
    values: metrics.map(m => m.visitors),
    percentages: metrics.map(m => Math.round((m.visitors / firstVisitors) * 100)),
    colors: [
      '#10B981', // green - visit
      '#3B82F6', // blue - product view
      '#8B5CF6', // purple - add to cart
      '#F59E0B', // amber - cart view
      '#EF4444', // red - checkout start
      '#EC4899', // pink - shipping
      '#6366F1', // indigo - payment
      '#14B8A6', // teal - purchase
    ],
  };
}

/**
 * Calculate time-based funnel metrics
 */
export function calculateTimeMetrics(events: FunnelEvent[]): {
  avgTimeToConversion: number;
  medianTimeToConversion: number;
  avgTimePerStage: Record<string, number>;
  peakConversionHours: number[];
  peakConversionDays: string[];
} {
  // Group events by session
  const sessionEvents = new Map<string, FunnelEvent[]>();
  for (const event of events) {
    if (!sessionEvents.has(event.sessionId)) {
      sessionEvents.set(event.sessionId, []);
    }
    sessionEvents.get(event.sessionId)!.push(event);
  }

  // Calculate conversion times
  const conversionTimes: number[] = [];
  const stageTimeTotals: Record<string, number[]> = {};

  for (const [, sessionEvts] of sessionEvents) {
    const sorted = sessionEvts.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    if (sorted.length >= 2) {
      const firstTime = new Date(sorted[0].timestamp).getTime();
      const lastTime = new Date(sorted[sorted.length - 1].timestamp).getTime();
      conversionTimes.push((lastTime - firstTime) / 1000); // in seconds

      // Track time per stage
      for (const event of sorted) {
        if (event.timeFromPrevious !== undefined) {
          if (!stageTimeTotals[event.stage]) {
            stageTimeTotals[event.stage] = [];
          }
          stageTimeTotals[event.stage].push(event.timeFromPrevious);
        }
      }
    }
  }

  // Calculate averages
  const avgTimeToConversion = conversionTimes.length > 0
    ? Math.round(conversionTimes.reduce((a, b) => a + b, 0) / conversionTimes.length)
    : 0;

  const sortedTimes = [...conversionTimes].sort((a, b) => a - b);
  const medianTimeToConversion = sortedTimes.length > 0
    ? Math.round(sortedTimes[Math.floor(sortedTimes.length / 2)])
    : 0;

  const avgTimePerStage: Record<string, number> = {};
  for (const [stage, times] of Object.entries(stageTimeTotals)) {
    avgTimePerStage[stage] = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  }

  // Find peak hours and days
  const hourCounts: number[] = new Array(24).fill(0);
  const dayCounts: Record<string, number> = {};

  for (const event of events) {
    if (event.stage === 'purchase') {
      const date = new Date(event.timestamp);
      hourCounts[date.getHours()]++;
      const dayName = date.toLocaleDateString('uk-UA', { weekday: 'long' });
      dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
    }
  }

  // Get top 3 peak hours
  const peakConversionHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(h => h.hour);

  // Get top 3 peak days
  const peakConversionDays = Object.entries(dayCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([day]) => day);

  return {
    avgTimeToConversion,
    medianTimeToConversion,
    avgTimePerStage,
    peakConversionHours,
    peakConversionDays,
  };
}

/**
 * Get funnel health score
 */
export function getFunnelHealthScore(metrics: FunnelMetrics[]): {
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: string[];
  issuesUk: string[];
  improvements: string[];
  improvementsUk: string[];
} {
  let score = 100;
  const issues: string[] = [];
  const issuesUk: string[] = [];
  const improvements: string[] = [];
  const improvementsUk: string[] = [];

  // Check each stage's conversion rate against benchmarks
  const benchmarks: Record<string, number> = {
    visit: 100, // baseline
    product_view: 40,
    add_to_cart: 15,
    cart_view: 12,
    checkout_start: 8,
    checkout_shipping: 6,
    checkout_payment: 5,
    purchase: 3,
  };

  const firstVisitors = metrics[0]?.visitors || 1;

  for (const metric of metrics) {
    const actualRate = (metric.visitors / firstVisitors) * 100;
    const benchmark = benchmarks[metric.stage] || 0;

    if (actualRate < benchmark * 0.5) {
      score -= 15;
      issues.push(`${metric.stageName}: ${actualRate.toFixed(1)}% (benchmark: ${benchmark}%)`);
      issuesUk.push(`${metric.stageNameUk}: ${actualRate.toFixed(1)}% (бенчмарк: ${benchmark}%)`);
    } else if (actualRate < benchmark * 0.75) {
      score -= 8;
    } else if (actualRate < benchmark) {
      score -= 3;
    }

    // Check for high dropoff
    if (metric.dropoffRate > 60) {
      improvements.push(`Reduce ${metric.stageName} dropoff (currently ${metric.dropoffRate.toFixed(0)}%)`);
      improvementsUk.push(`Зменшіть відмови на "${metric.stageNameUk}" (зараз ${metric.dropoffRate.toFixed(0)}%)`);
    }
  }

  score = Math.max(0, Math.min(100, score));

  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  return {
    score: Math.round(score),
    grade,
    issues,
    issuesUk,
    improvements,
    improvementsUk,
  };
}
