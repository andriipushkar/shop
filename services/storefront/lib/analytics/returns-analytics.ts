/**
 * Returns & Refunds Analytics
 * Tracks and analyzes product returns and refunds
 */

export interface ReturnRequest {
  id: string;
  orderId: string;
  orderDate: Date;
  returnRequestDate: Date;
  returnCompletedDate?: Date;
  customerId: string;
  customerName: string;
  items: ReturnItem[];
  reason: ReturnReason;
  reasonDetails?: string;
  status: ReturnStatus;
  refundAmount: number;
  refundMethod: 'original_payment' | 'store_credit' | 'bank_transfer';
  shippingCost: number;
  restockingFee: number;
  handledBy?: string;
  resolution?: ReturnResolution;
  customerSatisfaction?: number; // 1-5
}

export interface ReturnItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  condition: 'new' | 'opened' | 'used' | 'damaged';
  isResellable: boolean;
}

export type ReturnReason =
  | 'defective'
  | 'not_as_described'
  | 'wrong_item'
  | 'changed_mind'
  | 'size_fit'
  | 'better_price_elsewhere'
  | 'arrived_late'
  | 'damaged_shipping'
  | 'quality_issues'
  | 'other';

export type ReturnStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'shipped_back'
  | 'received'
  | 'inspected'
  | 'refunded'
  | 'completed'
  | 'cancelled';

export type ReturnResolution =
  | 'full_refund'
  | 'partial_refund'
  | 'exchange'
  | 'store_credit'
  | 'repair'
  | 'rejected';

export interface ReturnReasonInfo {
  id: ReturnReason;
  name: string;
  nameUk: string;
  description: string;
  descriptionUk: string;
  isPreventable: boolean;
  preventionTips: string[];
  preventionTipsUk: string[];
}

export interface ReturnMetrics {
  totalReturns: number;
  totalReturnValue: number;
  returnRate: number; // Percentage of orders returned
  averageReturnValue: number;
  averageProcessingTime: number; // days
  reasonBreakdown: { reason: ReturnReason; count: number; percentage: number }[];
  statusBreakdown: { status: ReturnStatus; count: number }[];
  resolutionBreakdown: { resolution: ReturnResolution; count: number; percentage: number }[];
  customerSatisfactionAvg: number;
  costOfReturns: number;
}

export interface ProductReturnAnalysis {
  productId: string;
  productName: string;
  sku: string;
  totalSold: number;
  totalReturned: number;
  returnRate: number;
  topReasons: { reason: ReturnReason; count: number; percentage: number }[];
  averageReturnValue: number;
  costImpact: number;
  trend: 'improving' | 'stable' | 'worsening';
  recommendations: string[];
  recommendationsUk: string[];
}

export interface ReturnsTrend {
  period: string;
  returns: number;
  returnRate: number;
  refundAmount: number;
  preventableReturns: number;
}

// Return reason definitions
export const RETURN_REASONS: ReturnReasonInfo[] = [
  {
    id: 'defective',
    name: 'Defective Product',
    nameUk: 'Бракований товар',
    description: 'Product has manufacturing defects',
    descriptionUk: 'Товар має виробничі дефекти',
    isPreventable: true,
    preventionTips: ['Improve quality control', 'Work with reliable suppliers'],
    preventionTipsUk: ['Покращіть контроль якості', 'Працюйте з надійними постачальниками'],
  },
  {
    id: 'not_as_described',
    name: 'Not as Described',
    nameUk: 'Не відповідає опису',
    description: 'Product differs from description',
    descriptionUk: 'Товар відрізняється від опису',
    isPreventable: true,
    preventionTips: ['Update product descriptions', 'Add more accurate photos'],
    preventionTipsUk: ['Оновіть описи товарів', 'Додайте точніші фотографії'],
  },
  {
    id: 'wrong_item',
    name: 'Wrong Item Sent',
    nameUk: 'Надіслано не той товар',
    description: 'Customer received wrong product',
    descriptionUk: 'Клієнт отримав інший товар',
    isPreventable: true,
    preventionTips: ['Improve picking accuracy', 'Implement barcode verification'],
    preventionTipsUk: ['Покращіть точність комплектації', 'Впровадьте перевірку штрих-кодом'],
  },
  {
    id: 'changed_mind',
    name: 'Changed Mind',
    nameUk: 'Передумав',
    description: 'Customer no longer wants product',
    descriptionUk: 'Клієнт більше не хоче товар',
    isPreventable: false,
    preventionTips: [],
    preventionTipsUk: [],
  },
  {
    id: 'size_fit',
    name: 'Size/Fit Issue',
    nameUk: 'Не підійшов розмір',
    description: 'Product size or fit is wrong',
    descriptionUk: 'Не підійшов розмір або посадка',
    isPreventable: true,
    preventionTips: ['Add detailed size guide', 'Include size comparison tool'],
    preventionTipsUk: ['Додайте детальний розмірний гід', 'Включіть інструмент порівняння розмірів'],
  },
  {
    id: 'better_price_elsewhere',
    name: 'Found Better Price',
    nameUk: 'Знайшов дешевше',
    description: 'Customer found lower price elsewhere',
    descriptionUk: 'Клієнт знайшов нижчу ціну',
    isPreventable: true,
    preventionTips: ['Monitor competitor prices', 'Offer price matching'],
    preventionTipsUk: ['Моніторте ціни конкурентів', 'Запропонуйте відповідність ціни'],
  },
  {
    id: 'arrived_late',
    name: 'Arrived Too Late',
    nameUk: 'Прийшло пізно',
    description: 'Product arrived after needed',
    descriptionUk: 'Товар прийшов після потрібного терміну',
    isPreventable: true,
    preventionTips: ['Improve delivery estimates', 'Use faster shipping options'],
    preventionTipsUk: ['Покращіть оцінку термінів доставки', 'Використовуйте швидшу доставку'],
  },
  {
    id: 'damaged_shipping',
    name: 'Damaged in Shipping',
    nameUk: 'Пошкоджено при доставці',
    description: 'Product was damaged during delivery',
    descriptionUk: 'Товар пошкоджено під час доставки',
    isPreventable: true,
    preventionTips: ['Improve packaging', 'Choose reliable carriers'],
    preventionTipsUk: ['Покращіть упаковку', 'Обирайте надійних перевізників'],
  },
  {
    id: 'quality_issues',
    name: 'Quality Issues',
    nameUk: 'Проблеми з якістю',
    description: 'Product quality below expectations',
    descriptionUk: 'Якість нижче очікувань',
    isPreventable: true,
    preventionTips: ['Source higher quality products', 'Update product expectations in description'],
    preventionTipsUk: ['Закуповуйте якісніші товари', 'Оновіть очікування в описі'],
  },
  {
    id: 'other',
    name: 'Other',
    nameUk: 'Інше',
    description: 'Other reason not listed',
    descriptionUk: 'Інша причина',
    isPreventable: false,
    preventionTips: [],
    preventionTipsUk: [],
  },
];

/**
 * Calculate return metrics from return data
 */
export function calculateReturnMetrics(
  returns: ReturnRequest[],
  totalOrders: number
): ReturnMetrics {
  if (returns.length === 0) {
    return {
      totalReturns: 0,
      totalReturnValue: 0,
      returnRate: 0,
      averageReturnValue: 0,
      averageProcessingTime: 0,
      reasonBreakdown: [],
      statusBreakdown: [],
      resolutionBreakdown: [],
      customerSatisfactionAvg: 0,
      costOfReturns: 0,
    };
  }

  // Calculate totals
  const totalReturnValue = returns.reduce((sum, r) => sum + r.refundAmount, 0);
  const returnRate = totalOrders > 0 ? (returns.length / totalOrders) * 100 : 0;
  const averageReturnValue = totalReturnValue / returns.length;

  // Calculate processing time
  const completedReturns = returns.filter(r => r.returnCompletedDate);
  const processingTimes = completedReturns.map(r => {
    const start = new Date(r.returnRequestDate).getTime();
    const end = new Date(r.returnCompletedDate!).getTime();
    return (end - start) / (1000 * 60 * 60 * 24); // days
  });
  const averageProcessingTime = processingTimes.length > 0
    ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
    : 0;

  // Reason breakdown
  const reasonCounts: Record<ReturnReason, number> = {} as Record<ReturnReason, number>;
  for (const ret of returns) {
    reasonCounts[ret.reason] = (reasonCounts[ret.reason] || 0) + 1;
  }
  const reasonBreakdown = Object.entries(reasonCounts)
    .map(([reason, count]) => ({
      reason: reason as ReturnReason,
      count,
      percentage: Math.round((count / returns.length) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // Status breakdown
  const statusCounts: Record<ReturnStatus, number> = {} as Record<ReturnStatus, number>;
  for (const ret of returns) {
    statusCounts[ret.status] = (statusCounts[ret.status] || 0) + 1;
  }
  const statusBreakdown = Object.entries(statusCounts)
    .map(([status, count]) => ({
      status: status as ReturnStatus,
      count,
    }));

  // Resolution breakdown
  const resolutionCounts: Record<ReturnResolution, number> = {} as Record<ReturnResolution, number>;
  for (const ret of returns) {
    if (ret.resolution) {
      resolutionCounts[ret.resolution] = (resolutionCounts[ret.resolution] || 0) + 1;
    }
  }
  const resolvedReturns = returns.filter(r => r.resolution).length;
  const resolutionBreakdown = Object.entries(resolutionCounts)
    .map(([resolution, count]) => ({
      resolution: resolution as ReturnResolution,
      count,
      percentage: resolvedReturns > 0 ? Math.round((count / resolvedReturns) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Customer satisfaction
  const satisfactionScores = returns
    .filter(r => r.customerSatisfaction !== undefined)
    .map(r => r.customerSatisfaction!);
  const customerSatisfactionAvg = satisfactionScores.length > 0
    ? Math.round((satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length) * 10) / 10
    : 0;

  // Cost of returns (refunds + shipping + restocking)
  const costOfReturns = returns.reduce(
    (sum, r) => sum + r.refundAmount + r.shippingCost + r.restockingFee,
    0
  );

  return {
    totalReturns: returns.length,
    totalReturnValue,
    returnRate: Math.round(returnRate * 10) / 10,
    averageReturnValue: Math.round(averageReturnValue),
    averageProcessingTime: Math.round(averageProcessingTime * 10) / 10,
    reasonBreakdown,
    statusBreakdown,
    resolutionBreakdown,
    customerSatisfactionAvg,
    costOfReturns,
  };
}

/**
 * Analyze returns by product
 */
export function analyzeProductReturns(
  returns: ReturnRequest[],
  productSales: Record<string, number>
): ProductReturnAnalysis[] {
  // Group returns by product
  const productReturns = new Map<string, ReturnItem[]>();
  const productReasons = new Map<string, ReturnReason[]>();

  for (const ret of returns) {
    for (const item of ret.items) {
      if (!productReturns.has(item.productId)) {
        productReturns.set(item.productId, []);
        productReasons.set(item.productId, []);
      }
      productReturns.get(item.productId)!.push(item);
      productReasons.get(item.productId)!.push(ret.reason);
    }
  }

  // Calculate analysis for each product
  const analyses: ProductReturnAnalysis[] = [];

  for (const [productId, items] of productReturns) {
    const totalReturned = items.reduce((sum, i) => sum + i.quantity, 0);
    const totalSold = productSales[productId] || totalReturned;
    const returnRate = totalSold > 0 ? (totalReturned / totalSold) * 100 : 0;
    const totalValue = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

    // Analyze reasons
    const reasons = productReasons.get(productId) || [];
    const reasonCounts: Record<string, number> = {};
    for (const reason of reasons) {
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }
    const topReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({
        reason: reason as ReturnReason,
        count,
        percentage: Math.round((count / reasons.length) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Determine trend (simplified - would need historical data)
    let trend: 'improving' | 'stable' | 'worsening' = 'stable';
    if (returnRate > 10) trend = 'worsening';
    if (returnRate < 3) trend = 'improving';

    // Generate recommendations
    const recommendations: string[] = [];
    const recommendationsUk: string[] = [];

    if (returnRate > 10) {
      recommendations.push('Urgent: High return rate requires investigation');
      recommendationsUk.push('Терміново: Високий відсоток повернень потребує розслідування');
    }

    for (const reasonInfo of topReasons) {
      const reasonData = RETURN_REASONS.find(r => r.id === reasonInfo.reason);
      if (reasonData?.isPreventable && reasonInfo.percentage > 30) {
        recommendations.push(...reasonData.preventionTips);
        recommendationsUk.push(...reasonData.preventionTipsUk);
      }
    }

    analyses.push({
      productId,
      productName: items[0].productName,
      sku: items[0].sku,
      totalSold,
      totalReturned,
      returnRate: Math.round(returnRate * 10) / 10,
      topReasons,
      averageReturnValue: Math.round(totalValue / items.length),
      costImpact: totalValue,
      trend,
      recommendations: [...new Set(recommendations)].slice(0, 5),
      recommendationsUk: [...new Set(recommendationsUk)].slice(0, 5),
    });
  }

  // Sort by return rate (highest first)
  return analyses.sort((a, b) => b.returnRate - a.returnRate);
}

/**
 * Get preventable returns analysis
 */
export function analyzePreventableReturns(returns: ReturnRequest[]): {
  preventableCount: number;
  preventableValue: number;
  preventablePercentage: number;
  byReason: { reason: ReturnReason; count: number; value: number; tips: string[]; tipsUk: string[] }[];
  potentialSavings: number;
} {
  const preventableReasons = RETURN_REASONS
    .filter(r => r.isPreventable)
    .map(r => r.id);

  const preventableReturns = returns.filter(r => preventableReasons.includes(r.reason));
  const preventableValue = preventableReturns.reduce((sum, r) => sum + r.refundAmount, 0);

  // Group by reason
  const byReason = new Map<ReturnReason, { count: number; value: number }>();
  for (const ret of preventableReturns) {
    const current = byReason.get(ret.reason) || { count: 0, value: 0 };
    byReason.set(ret.reason, {
      count: current.count + 1,
      value: current.value + ret.refundAmount,
    });
  }

  const byReasonArray = Array.from(byReason.entries()).map(([reason, data]) => {
    const reasonInfo = RETURN_REASONS.find(r => r.id === reason);
    return {
      reason,
      count: data.count,
      value: data.value,
      tips: reasonInfo?.preventionTips || [],
      tipsUk: reasonInfo?.preventionTipsUk || [],
    };
  }).sort((a, b) => b.value - a.value);

  // Estimate potential savings (assume 50% could be prevented with improvements)
  const potentialSavings = Math.round(preventableValue * 0.5);

  return {
    preventableCount: preventableReturns.length,
    preventableValue,
    preventablePercentage: returns.length > 0
      ? Math.round((preventableReturns.length / returns.length) * 100)
      : 0,
    byReason: byReasonArray,
    potentialSavings,
  };
}

/**
 * Calculate returns trend over time
 */
export function calculateReturnsTrend(
  returns: ReturnRequest[],
  ordersByPeriod: Record<string, number>,
  periodType: 'daily' | 'weekly' | 'monthly' = 'monthly'
): ReturnsTrend[] {
  // Group returns by period
  const returnsByPeriod = new Map<string, ReturnRequest[]>();

  for (const ret of returns) {
    const date = new Date(ret.returnRequestDate);
    let period: string;

    switch (periodType) {
      case 'daily':
        period = date.toISOString().split('T')[0];
        break;
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        period = weekStart.toISOString().split('T')[0];
        break;
      case 'monthly':
      default:
        period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!returnsByPeriod.has(period)) {
      returnsByPeriod.set(period, []);
    }
    returnsByPeriod.get(period)!.push(ret);
  }

  // Calculate trend for each period
  const trends: ReturnsTrend[] = [];
  const preventableReasons = RETURN_REASONS
    .filter(r => r.isPreventable)
    .map(r => r.id);

  for (const [period, periodReturns] of returnsByPeriod) {
    const orders = ordersByPeriod[period] || periodReturns.length;
    const refundAmount = periodReturns.reduce((sum, r) => sum + r.refundAmount, 0);
    const preventable = periodReturns.filter(r => preventableReasons.includes(r.reason)).length;

    trends.push({
      period,
      returns: periodReturns.length,
      returnRate: orders > 0 ? Math.round((periodReturns.length / orders) * 1000) / 10 : 0,
      refundAmount,
      preventableReturns: preventable,
    });
  }

  return trends.sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Get returns dashboard summary
 */
export function getReturnsDashboardSummary(
  returns: ReturnRequest[],
  totalOrders: number
): {
  overview: {
    totalReturns: number;
    returnRate: number;
    totalRefunded: number;
    avgProcessingDays: number;
  };
  alerts: { type: 'warning' | 'critical'; message: string; messageUk: string }[];
  topIssues: { issue: string; issueUk: string; count: number; action: string; actionUk: string }[];
  kpis: { name: string; nameUk: string; value: number; target: number; status: 'good' | 'warning' | 'critical' }[];
} {
  const metrics = calculateReturnMetrics(returns, totalOrders);
  const preventable = analyzePreventableReturns(returns);

  const alerts: { type: 'warning' | 'critical'; message: string; messageUk: string }[] = [];

  if (metrics.returnRate > 10) {
    alerts.push({
      type: 'critical',
      message: `High return rate: ${metrics.returnRate}%`,
      messageUk: `Високий відсоток повернень: ${metrics.returnRate}%`,
    });
  } else if (metrics.returnRate > 5) {
    alerts.push({
      type: 'warning',
      message: `Return rate above target: ${metrics.returnRate}%`,
      messageUk: `Відсоток повернень вище цілі: ${metrics.returnRate}%`,
    });
  }

  if (metrics.averageProcessingTime > 7) {
    alerts.push({
      type: 'warning',
      message: `Slow processing: ${metrics.averageProcessingTime.toFixed(1)} days avg`,
      messageUk: `Повільна обробка: ${metrics.averageProcessingTime.toFixed(1)} днів в середньому`,
    });
  }

  // Top issues from reason breakdown
  const topIssues = metrics.reasonBreakdown.slice(0, 3).map(r => {
    const reasonInfo = RETURN_REASONS.find(ri => ri.id === r.reason);
    return {
      issue: reasonInfo?.name || r.reason,
      issueUk: reasonInfo?.nameUk || r.reason,
      count: r.count,
      action: reasonInfo?.preventionTips[0] || 'Investigate further',
      actionUk: reasonInfo?.preventionTipsUk[0] || 'Розслідуйте детальніше',
    };
  });

  // KPIs
  const kpis = [
    {
      name: 'Return Rate',
      nameUk: 'Відсоток повернень',
      value: metrics.returnRate,
      target: 5,
      status: metrics.returnRate <= 5 ? 'good' : metrics.returnRate <= 10 ? 'warning' : 'critical',
    },
    {
      name: 'Processing Time',
      nameUk: 'Час обробки (дні)',
      value: metrics.averageProcessingTime,
      target: 5,
      status: metrics.averageProcessingTime <= 5 ? 'good' : metrics.averageProcessingTime <= 7 ? 'warning' : 'critical',
    },
    {
      name: 'Customer Satisfaction',
      nameUk: 'Задоволеність клієнтів',
      value: metrics.customerSatisfactionAvg,
      target: 4,
      status: metrics.customerSatisfactionAvg >= 4 ? 'good' : metrics.customerSatisfactionAvg >= 3 ? 'warning' : 'critical',
    },
    {
      name: 'Preventable Rate',
      nameUk: 'Запобіжний відсоток',
      value: preventable.preventablePercentage,
      target: 30,
      status: preventable.preventablePercentage <= 30 ? 'good' : preventable.preventablePercentage <= 50 ? 'warning' : 'critical',
    },
  ] as const;

  return {
    overview: {
      totalReturns: metrics.totalReturns,
      returnRate: metrics.returnRate,
      totalRefunded: metrics.totalReturnValue,
      avgProcessingDays: metrics.averageProcessingTime,
    },
    alerts,
    topIssues,
    kpis: kpis.map(k => ({ ...k })),
  };
}

/**
 * Format return status for display
 */
export function formatReturnStatus(status: ReturnStatus): { label: string; labelUk: string; color: string } {
  const statusMap: Record<ReturnStatus, { label: string; labelUk: string; color: string }> = {
    requested: { label: 'Requested', labelUk: 'Запит подано', color: '#F59E0B' },
    approved: { label: 'Approved', labelUk: 'Затверджено', color: '#10B981' },
    rejected: { label: 'Rejected', labelUk: 'Відхилено', color: '#EF4444' },
    shipped_back: { label: 'Shipped Back', labelUk: 'Відправлено назад', color: '#3B82F6' },
    received: { label: 'Received', labelUk: 'Отримано', color: '#8B5CF6' },
    inspected: { label: 'Inspected', labelUk: 'Перевірено', color: '#6366F1' },
    refunded: { label: 'Refunded', labelUk: 'Відшкодовано', color: '#14B8A6' },
    completed: { label: 'Completed', labelUk: 'Завершено', color: '#10B981' },
    cancelled: { label: 'Cancelled', labelUk: 'Скасовано', color: '#6B7280' },
  };

  return statusMap[status] || { label: status, labelUk: status, color: '#6B7280' };
}
