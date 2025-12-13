/**
 * RFM (Recency, Frequency, Monetary) Customer Analysis
 * Used for customer segmentation and targeted marketing
 */

export interface CustomerData {
  id: string;
  name: string;
  email: string;
  orders: OrderData[];
  createdAt: Date;
}

export interface OrderData {
  id: string;
  date: Date;
  total: number;
  status: 'completed' | 'pending' | 'cancelled' | 'refunded';
}

export interface RFMScores {
  recency: number; // 1-5 (5 = most recent)
  frequency: number; // 1-5 (5 = most frequent)
  monetary: number; // 1-5 (5 = highest spending)
  total: number; // Combined RFM score
}

export interface CustomerSegment {
  id: string;
  name: string;
  nameUk: string;
  description: string;
  descriptionUk: string;
  color: string;
  minScore: number;
  maxScore: number;
  recommendations: string[];
}

export interface RFMAnalysisResult {
  customerId: string;
  customerName: string;
  email: string;
  scores: RFMScores;
  segment: CustomerSegment;
  metrics: {
    daysSinceLastOrder: number;
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    customerLifetimeDays: number;
  };
}

// Customer segments based on RFM scores
export const CUSTOMER_SEGMENTS: CustomerSegment[] = [
  {
    id: 'champions',
    name: 'Champions',
    nameUk: 'Чемпіони',
    description: 'Best customers who bought recently, buy often and spend the most',
    descriptionUk: 'Найкращі клієнти: купують часто, багато та нещодавно',
    color: '#10B981', // green
    minScore: 13,
    maxScore: 15,
    recommendations: [
      'Ексклюзивні пропозиції',
      'Ранній доступ до новинок',
      'VIP програма лояльності',
      'Персональний менеджер',
    ],
  },
  {
    id: 'loyal_customers',
    name: 'Loyal Customers',
    nameUk: 'Лояльні клієнти',
    description: 'Customers who buy regularly with good spending',
    descriptionUk: 'Регулярні покупці з хорошими витратами',
    color: '#3B82F6', // blue
    minScore: 10,
    maxScore: 12,
    recommendations: [
      'Бонуси за лояльність',
      'Рекомендації товарів',
      'Програма реферального маркетингу',
    ],
  },
  {
    id: 'potential_loyalists',
    name: 'Potential Loyalists',
    nameUk: 'Потенційно лояльні',
    description: 'Recent customers with average frequency and spending',
    descriptionUk: 'Нещодавні клієнти із середньою частотою покупок',
    color: '#8B5CF6', // purple
    minScore: 8,
    maxScore: 9,
    recommendations: [
      'Програма welcome-бонусів',
      'Персоналізовані пропозиції',
      'Знижки на повторні покупки',
    ],
  },
  {
    id: 'new_customers',
    name: 'New Customers',
    nameUk: 'Нові клієнти',
    description: 'Recently acquired customers with low frequency',
    descriptionUk: 'Нещодавно залучені клієнти',
    color: '#06B6D4', // cyan
    minScore: 6,
    maxScore: 7,
    recommendations: [
      'Вітальний email-ланцюжок',
      'Знижка на друге замовлення',
      'Огляд асортименту',
    ],
  },
  {
    id: 'at_risk',
    name: 'At Risk',
    nameUk: 'Під загрозою',
    description: 'Customers who used to be active but haven\'t purchased recently',
    descriptionUk: 'Раніше активні клієнти, які давно не купували',
    color: '#F59E0B', // amber
    minScore: 4,
    maxScore: 5,
    recommendations: [
      'Win-back кампанія',
      'Спеціальна знижка',
      'Опитування задоволеності',
    ],
  },
  {
    id: 'hibernating',
    name: 'Hibernating',
    nameUk: 'Сплячі',
    description: 'Inactive customers with low engagement',
    descriptionUk: 'Неактивні клієнти з низькою залученістю',
    color: '#EF4444', // red
    minScore: 1,
    maxScore: 3,
    recommendations: [
      'Реактиваційна кампанія',
      'Агресивна знижка',
      'Нагадування про переваги',
    ],
  },
];

/**
 * Calculate RFM scores for a customer
 */
export function calculateRFMScores(
  customer: CustomerData,
  referenceDate: Date = new Date()
): RFMScores {
  const completedOrders = customer.orders.filter(o => o.status === 'completed');

  if (completedOrders.length === 0) {
    return { recency: 1, frequency: 1, monetary: 1, total: 3 };
  }

  // Calculate metrics
  const lastOrderDate = new Date(
    Math.max(...completedOrders.map(o => new Date(o.date).getTime()))
  );
  const daysSinceLastOrder = Math.floor(
    (referenceDate.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const totalOrders = completedOrders.length;
  const totalSpent = completedOrders.reduce((sum, o) => sum + o.total, 0);

  // Calculate scores (1-5 scale)
  const recencyScore = calculateRecencyScore(daysSinceLastOrder);
  const frequencyScore = calculateFrequencyScore(totalOrders);
  const monetaryScore = calculateMonetaryScore(totalSpent);

  return {
    recency: recencyScore,
    frequency: frequencyScore,
    monetary: monetaryScore,
    total: recencyScore + frequencyScore + monetaryScore,
  };
}

/**
 * Calculate recency score based on days since last order
 */
function calculateRecencyScore(days: number): number {
  if (days <= 7) return 5;
  if (days <= 30) return 4;
  if (days <= 90) return 3;
  if (days <= 180) return 2;
  return 1;
}

/**
 * Calculate frequency score based on total orders
 */
function calculateFrequencyScore(orders: number): number {
  if (orders >= 10) return 5;
  if (orders >= 5) return 4;
  if (orders >= 3) return 3;
  if (orders >= 2) return 2;
  return 1;
}

/**
 * Calculate monetary score based on total spending
 */
function calculateMonetaryScore(total: number): number {
  if (total >= 50000) return 5; // 50,000+ UAH
  if (total >= 20000) return 4; // 20,000+ UAH
  if (total >= 10000) return 3; // 10,000+ UAH
  if (total >= 5000) return 2;  // 5,000+ UAH
  return 1;
}

/**
 * Get customer segment based on RFM score
 */
export function getCustomerSegment(scores: RFMScores): CustomerSegment {
  const segment = CUSTOMER_SEGMENTS.find(
    s => scores.total >= s.minScore && scores.total <= s.maxScore
  );
  return segment || CUSTOMER_SEGMENTS[CUSTOMER_SEGMENTS.length - 1];
}

/**
 * Perform full RFM analysis for a customer
 */
export function analyzeCustomer(
  customer: CustomerData,
  referenceDate: Date = new Date()
): RFMAnalysisResult {
  const scores = calculateRFMScores(customer, referenceDate);
  const segment = getCustomerSegment(scores);

  const completedOrders = customer.orders.filter(o => o.status === 'completed');
  const totalSpent = completedOrders.reduce((sum, o) => sum + o.total, 0);

  const lastOrderDate = completedOrders.length > 0
    ? new Date(Math.max(...completedOrders.map(o => new Date(o.date).getTime())))
    : null;

  const daysSinceLastOrder = lastOrderDate
    ? Math.floor((referenceDate.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
    : -1;

  const customerLifetimeDays = Math.floor(
    (referenceDate.getTime() - new Date(customer.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    customerId: customer.id,
    customerName: customer.name,
    email: customer.email,
    scores,
    segment,
    metrics: {
      daysSinceLastOrder,
      totalOrders: completedOrders.length,
      totalSpent,
      averageOrderValue: completedOrders.length > 0 ? totalSpent / completedOrders.length : 0,
      customerLifetimeDays,
    },
  };
}

/**
 * Analyze all customers and return segmentation summary
 */
export function analyzeAllCustomers(
  customers: CustomerData[],
  referenceDate: Date = new Date()
): {
  results: RFMAnalysisResult[];
  summary: Record<string, { count: number; revenue: number; percentage: number }>;
} {
  const results = customers.map(c => analyzeCustomer(c, referenceDate));

  const summary: Record<string, { count: number; revenue: number; percentage: number }> = {};

  for (const segment of CUSTOMER_SEGMENTS) {
    const segmentCustomers = results.filter(r => r.segment.id === segment.id);
    summary[segment.id] = {
      count: segmentCustomers.length,
      revenue: segmentCustomers.reduce((sum, c) => sum + c.metrics.totalSpent, 0),
      percentage: customers.length > 0
        ? Math.round((segmentCustomers.length / customers.length) * 100)
        : 0,
    };
  }

  return { results, summary };
}

/**
 * Get actionable insights for a segment
 */
export function getSegmentInsights(segmentId: string): {
  actions: string[];
  kpis: string[];
  emailTemplates: string[];
} {
  const insights: Record<string, { actions: string[]; kpis: string[]; emailTemplates: string[] }> = {
    champions: {
      actions: [
        'Запросити до VIP клубу',
        'Надати ексклюзивний ранній доступ',
        'Запитати відгук/рекомендацію',
      ],
      kpis: ['Retention rate', 'Referral rate', 'NPS score'],
      emailTemplates: ['vip_exclusive', 'early_access', 'referral_program'],
    },
    loyal_customers: {
      actions: [
        'Збільшити середній чек',
        'Cross-sell та upsell',
        'Залучити до програми лояльності',
      ],
      kpis: ['Average order value', 'Cross-sell rate', 'Loyalty points earned'],
      emailTemplates: ['loyalty_rewards', 'product_recommendations', 'bundle_offers'],
    },
    potential_loyalists: {
      actions: [
        'Конвертувати в лояльних',
        'Навчити про переваги',
        'Запропонувати підписку',
      ],
      kpis: ['Conversion to loyal', 'Second purchase rate', 'Engagement rate'],
      emailTemplates: ['welcome_series', 'second_purchase', 'membership_invite'],
    },
    new_customers: {
      actions: [
        'Онбординг та навчання',
        'Перша знижка',
        'Збір фідбеку',
      ],
      kpis: ['Second purchase rate', 'Time to second purchase', 'Onboarding completion'],
      emailTemplates: ['welcome_email', 'first_purchase_followup', 'new_customer_discount'],
    },
    at_risk: {
      actions: [
        'Win-back кампанія',
        'Персональна пропозиція',
        'Дізнатися причину відтоку',
      ],
      kpis: ['Reactivation rate', 'Win-back revenue', 'Churn rate'],
      emailTemplates: ['win_back', 'miss_you', 'special_comeback_offer'],
    },
    hibernating: {
      actions: [
        'Остання спроба реактивації',
        'Очистка бази (якщо не реагують)',
        'Ретаргетинг реклама',
      ],
      kpis: ['Reactivation rate', 'Cost per reactivation', 'List hygiene'],
      emailTemplates: ['last_chance', 'aggressive_discount', 'feedback_survey'],
    },
  };

  return insights[segmentId] || { actions: [], kpis: [], emailTemplates: [] };
}
