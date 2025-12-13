'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Users,
  DollarSign,
  RefreshCw,
  Download,
  Lightbulb,
  AlertCircle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface PriceElasticity {
  productId: string;
  productName: string;
  elasticity: number;
  optimalPrice: number;
  currentPrice: number;
  revenueMaximizingPrice: number;
  marginMaximizingPrice: number;
  confidence: number;
}

interface CompetitorAnalysis {
  competitorId: string;
  competitorName: string;
  avgPriceDifference: number;
  productsMonitored: number;
  pricingStrategy: string;
  priceChangeFrequency: number;
  marketPosition: 'aggressive' | 'competitive' | 'premium';
}

interface MarketPosition {
  categoryId: string;
  categoryName: string;
  ourPosition: number;
  totalCompetitors: number;
  avgMarketPrice: number;
  ourAvgPrice: number;
  marketShare: number;
  priceIndex: number;
}

interface OptimizationSuggestion {
  productId: string;
  productName: string;
  currentPrice: number;
  suggestedPrice: number;
  priceChange: number;
  priceChangePercent: number;
  expectedRevenueChange: number;
  expectedMarginChange: number;
  confidence: number;
  reasoning: string[];
  urgency: 'high' | 'medium' | 'low';
}

export default function PricingAnalyticsDashboardPage() {
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('cat1');

  // Mock data - in real app, this would come from API
  const [elasticity, setElasticity] = useState<PriceElasticity>({
    productId: 'prod1',
    productName: 'Смартфон Samsung Galaxy S24',
    elasticity: -1.8,
    optimalPrice: 22999,
    currentPrice: 24999,
    revenueMaximizingPrice: 22999,
    marginMaximizingPrice: 25999,
    confidence: 82,
  });

  const competitors: CompetitorAnalysis[] = [
    {
      competitorId: 'comp1',
      competitorName: 'Rozetka',
      avgPriceDifference: -5.2,
      productsMonitored: 245,
      pricingStrategy: 'Агресивний репрайсинг',
      priceChangeFrequency: 12.5,
      marketPosition: 'aggressive',
    },
    {
      competitorId: 'comp2',
      competitorName: 'Foxtrot',
      avgPriceDifference: 3.1,
      productsMonitored: 198,
      pricingStrategy: 'Стандартне ціноутворення',
      priceChangeFrequency: 3.2,
      marketPosition: 'competitive',
    },
    {
      competitorId: 'comp3',
      competitorName: 'Citrus',
      avgPriceDifference: -2.8,
      productsMonitored: 156,
      pricingStrategy: 'Стратегія низьких цін',
      priceChangeFrequency: 5.1,
      marketPosition: 'aggressive',
    },
    {
      competitorId: 'comp4',
      competitorName: 'Comfy',
      avgPriceDifference: 8.5,
      productsMonitored: 132,
      pricingStrategy: 'Преміум позиціонування',
      priceChangeFrequency: 1.8,
      marketPosition: 'premium',
    },
  ];

  const marketPosition: MarketPosition = {
    categoryId: 'cat1',
    categoryName: 'Смартфони',
    ourPosition: 2,
    totalCompetitors: 4,
    avgMarketPrice: 23500,
    ourAvgPrice: 24200,
    marketShare: 18.5,
    priceIndex: 1.03,
  };

  const optimizationSuggestions: OptimizationSuggestion[] = [
    {
      productId: 'prod1',
      productName: 'Смартфон Samsung Galaxy S24',
      currentPrice: 24999,
      suggestedPrice: 22999,
      priceChange: -2000,
      priceChangePercent: -8.0,
      expectedRevenueChange: 15600,
      expectedMarginChange: -2.3,
      confidence: 82,
      reasoning: [
        'Конкурент продає на 12% дешевше',
        'Еластичність попиту -1.8 (еластичний попит)',
        'Зниження ціни збільшить обсяг продажів на ~14%',
      ],
      urgency: 'high',
    },
    {
      productId: 'prod2',
      productName: 'Ноутбук Apple MacBook Air M2',
      currentPrice: 42999,
      suggestedPrice: 44999,
      priceChange: 2000,
      priceChangePercent: 4.7,
      expectedRevenueChange: 8900,
      expectedMarginChange: 5.2,
      confidence: 75,
      reasoning: [
        'Ми найдешевші на ринку',
        'Можна підвищити ціну без втрати конкурентності',
        'Очікується незначне зниження продажів (-2%)',
      ],
      urgency: 'medium',
    },
    {
      productId: 'prod3',
      productName: 'Навушники AirPods Pro 2',
      currentPrice: 8999,
      suggestedPrice: 8499,
      priceChange: -500,
      priceChangePercent: -5.6,
      expectedRevenueChange: 4200,
      expectedMarginChange: -1.8,
      confidence: 68,
      reasoning: [
        'Конкурент знизив ціну на 8%',
        'Рекомендується адаптувати ціну',
      ],
      urgency: 'medium',
    },
  ];

  // Chart data
  const elasticityChartData = [
    { price: 20000, demand: 120, revenue: 2400000 },
    { price: 21000, demand: 110, revenue: 2310000 },
    { price: 22000, demand: 100, revenue: 2200000 },
    { price: 22999, demand: 92, revenue: 2115908 }, // Optimal
    { price: 24000, demand: 85, revenue: 2040000 },
    { price: 24999, demand: 78, revenue: 1949922 }, // Current
    { price: 26000, demand: 70, revenue: 1820000 },
    { price: 27000, demand: 63, revenue: 1701000 },
  ];

  const competitorRadarData = competitors.map(c => ({
    name: c.competitorName,
    ціна: c.avgPriceDifference + 100, // Normalize for visualization
    активність: c.priceChangeFrequency * 5,
    охоплення: (c.productsMonitored / 250) * 100,
  }));

  const marketShareData = [
    { name: 'Ми', value: marketPosition.marketShare, color: '#3b82f6' },
    { name: 'Rozetka', value: 28.5, color: '#ef4444' },
    { name: 'Foxtrot', value: 22.3, color: '#f59e0b' },
    { name: 'Citrus', value: 16.2, color: '#10b981' },
    { name: 'Інші', value: 14.5, color: '#6b7280' },
  ];

  const totalRevenueImpact = optimizationSuggestions.reduce(
    (sum, s) => sum + s.expectedRevenueChange,
    0
  );
  const avgConfidence = optimizationSuggestions.reduce(
    (sum, s) => sum + s.confidence,
    0
  ) / optimizationSuggestions.length;
  const highUrgency = optimizationSuggestions.filter(s => s.urgency === 'high').length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Цінова аналітика</h1>
          <p className="text-muted-foreground">
            Глибока аналітика цін та конкурентного середовища
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Оновити
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Експорт
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ринкова позиція</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">#{marketPosition.ourPosition}</div>
            <p className="text-xs text-muted-foreground">
              з {marketPosition.totalCompetitors + 1} гравців
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Частка ринку</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketPosition.marketShare.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">оціночна частка</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Потенційний дохід</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              +{totalRevenueImpact.toLocaleString('uk-UA')} грн
            </div>
            <p className="text-xs text-muted-foreground">при оптимізації</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Рекомендації</CardTitle>
            <Lightbulb className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{optimizationSuggestions.length}</div>
            <p className="text-xs text-muted-foreground">
              {highUrgency} високого пріоритету
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="optimization" className="space-y-4">
        <TabsList>
          <TabsTrigger value="optimization">Оптимізація</TabsTrigger>
          <TabsTrigger value="elasticity">Еластичність</TabsTrigger>
          <TabsTrigger value="competitors">Конкуренти</TabsTrigger>
          <TabsTrigger value="market">Ринок</TabsTrigger>
        </TabsList>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Рекомендації з оптимізації цін</CardTitle>
              <CardDescription>
                AI-рекомендації для покращення цінової стратегії
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 p-4 border rounded-lg bg-muted/50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Всього рекомендацій</div>
                    <div className="text-2xl font-bold">{optimizationSuggestions.length}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Потенційний дохід</div>
                    <div className="text-2xl font-bold text-green-600">
                      +{totalRevenueImpact.toLocaleString('uk-UA')} грн
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Середня точність</div>
                    <div className="text-2xl font-bold">{avgConfidence.toFixed(0)}%</div>
                  </div>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Пріоритет</TableHead>
                    <TableHead>Товар</TableHead>
                    <TableHead>Поточна ціна</TableHead>
                    <TableHead>Рекомендована ціна</TableHead>
                    <TableHead>Зміна</TableHead>
                    <TableHead>Очікувана зміна доходу</TableHead>
                    <TableHead>Точність</TableHead>
                    <TableHead>Причини</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {optimizationSuggestions.map((suggestion) => (
                    <TableRow key={suggestion.productId}>
                      <TableCell>
                        <Badge
                          variant={
                            suggestion.urgency === 'high' ? 'destructive' :
                            suggestion.urgency === 'medium' ? 'default' :
                            'secondary'
                          }
                        >
                          {suggestion.urgency === 'high' && 'Високий'}
                          {suggestion.urgency === 'medium' && 'Середній'}
                          {suggestion.urgency === 'low' && 'Низький'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{suggestion.productName}</div>
                        <div className="text-xs text-muted-foreground">{suggestion.productId}</div>
                      </TableCell>
                      <TableCell>{suggestion.currentPrice.toLocaleString('uk-UA')} грн</TableCell>
                      <TableCell className="font-medium">
                        {suggestion.suggestedPrice.toLocaleString('uk-UA')} грн
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1 ${suggestion.priceChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {suggestion.priceChange > 0 ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4" />
                          )}
                          {suggestion.priceChange > 0 ? '+' : ''}
                          {suggestion.priceChange.toLocaleString('uk-UA')} грн
                          <span className="text-xs">
                            ({suggestion.priceChangePercent.toFixed(1)}%)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={suggestion.expectedRevenueChange > 0 ? 'text-green-600 font-medium' : 'text-red-600'}>
                          {suggestion.expectedRevenueChange > 0 ? '+' : ''}
                          {suggestion.expectedRevenueChange.toLocaleString('uk-UA')} грн
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="text-sm">{suggestion.confidence}%</div>
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${suggestion.confidence}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <ul className="text-xs space-y-1">
                          {suggestion.reasoning.map((reason, i) => (
                            <li key={i} className="text-muted-foreground">• {reason}</li>
                          ))}
                        </ul>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="elasticity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Аналіз цінової еластичності</CardTitle>
              <CardDescription>
                Вплив змін ціни на попит та дохід
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Товар</div>
                  <div className="font-medium">{elasticity.productName}</div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Коефіцієнт еластичності</div>
                  <div className="text-2xl font-bold">{elasticity.elasticity.toFixed(2)}</div>
                  <Badge variant="outline" className="mt-1">
                    {Math.abs(elasticity.elasticity) > 1 ? 'Еластичний' : 'Нееластичний'}
                  </Badge>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Поточна ціна</div>
                  <div className="text-2xl font-bold">
                    {elasticity.currentPrice.toLocaleString('uk-UA')} грн
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Оптимальна ціна</div>
                  <div className="text-2xl font-bold text-green-600">
                    {elasticity.optimalPrice.toLocaleString('uk-UA')} грн
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Інтерпретація:</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    • Коефіцієнт еластичності {elasticity.elasticity.toFixed(2)} означає, що при
                    зміні ціни на 1%, попит змінюється на {Math.abs(elasticity.elasticity).toFixed(2)}%
                  </p>
                  <p>
                    • {Math.abs(elasticity.elasticity) > 1
                      ? 'Товар має еластичний попит - споживачі чутливі до змін ціни'
                      : 'Товар має нееластичний попит - споживачі менш чутливі до змін ціни'}
                  </p>
                  <p>
                    • Точність прогнозу: {elasticity.confidence}%
                  </p>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={elasticityChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="price"
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip
                    formatter={(value: any, name: string) => {
                      if (name === 'revenue') {
                        return [`${(value / 1000000).toFixed(2)}M грн`, 'Дохід'];
                      }
                      return [value, name === 'demand' ? 'Попит' : name];
                    }}
                    labelFormatter={(label) => `Ціна: ${label} грн`}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="demand"
                    stroke="#8884d8"
                    name="Попит (од.)"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#82ca9d"
                    name="Дохід (грн)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <h4 className="font-medium">Ціна для максимізації доходу</h4>
                  </div>
                  <div className="text-3xl font-bold text-green-600">
                    {elasticity.revenueMaximizingPrice.toLocaleString('uk-UA')} грн
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Оптимальна ціна для максимального доходу
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                    <h4 className="font-medium">Ціна для максимізації маржі</h4>
                  </div>
                  <div className="text-3xl font-bold text-blue-600">
                    {elasticity.marginMaximizingPrice.toLocaleString('uk-UA')} грн
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Оптимальна ціна для максимальної маржі
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competitors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Аналіз конкурентів</CardTitle>
              <CardDescription>
                Порівняльний аналіз цінових стратегій конкурентів
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={competitorRadarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="name" />
                    <PolarRadiusAxis />
                    <Radar name="Метрики" dataKey="ціна" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Конкурент</TableHead>
                    <TableHead>Позиція</TableHead>
                    <TableHead>Різниця в цінах</TableHead>
                    <TableHead>Товарів відстежується</TableHead>
                    <TableHead>Стратегія</TableHead>
                    <TableHead>Частота змін</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competitors.map((competitor) => (
                    <TableRow key={competitor.competitorId}>
                      <TableCell className="font-medium">{competitor.competitorName}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            competitor.marketPosition === 'aggressive' ? 'destructive' :
                            competitor.marketPosition === 'premium' ? 'default' :
                            'secondary'
                          }
                        >
                          {competitor.marketPosition === 'aggressive' && 'Агресивний'}
                          {competitor.marketPosition === 'competitive' && 'Конкурентний'}
                          {competitor.marketPosition === 'premium' && 'Преміум'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className={competitor.avgPriceDifference < 0 ? 'text-red-600' : 'text-green-600'}>
                          {competitor.avgPriceDifference > 0 ? '+' : ''}
                          {competitor.avgPriceDifference.toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell>{competitor.productsMonitored}</TableCell>
                      <TableCell className="text-sm">{competitor.pricingStrategy}</TableCell>
                      <TableCell>
                        {competitor.priceChangeFrequency.toFixed(1)} змін/тиждень
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="market" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ринкова позиція</CardTitle>
              <CardDescription>
                Аналіз вашої позиції на ринку
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Категорія</div>
                  <div className="text-xl font-bold">{marketPosition.categoryName}</div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Наша позиція</div>
                  <div className="text-3xl font-bold">#{marketPosition.ourPosition}</div>
                  <div className="text-sm text-muted-foreground">
                    з {marketPosition.totalCompetitors + 1} учасників
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Частка ринку</div>
                  <div className="text-3xl font-bold text-blue-600">
                    {marketPosition.marketShare.toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">оціночна</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-4">Порівняння цін</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Середня ціна на ринку:</span>
                      <span className="font-medium">
                        {marketPosition.avgMarketPrice.toLocaleString('uk-UA')} грн
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Наша середня ціна:</span>
                      <span className="font-medium">
                        {marketPosition.ourAvgPrice.toLocaleString('uk-UA')} грн
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Ціновий індекс:</span>
                      <Badge variant={marketPosition.priceIndex > 1 ? 'destructive' : 'default'}>
                        {marketPosition.priceIndex.toFixed(2)}
                        {marketPosition.priceIndex > 1 ? ' (дорожче)' : ' (дешевше)'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-4">Розподіл ринку</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={marketShareData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" unit="%" />
                      <YAxis dataKey="name" type="category" width={80} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3b82f6">
                        {marketShareData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-muted/50">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-600" />
                  Рекомендації
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {marketPosition.priceIndex > 1.05 && (
                    <li className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 text-yellow-600" />
                      <span>
                        Ваші ціни на {((marketPosition.priceIndex - 1) * 100).toFixed(1)}% вище ринкових.
                        Розгляньте можливість зниження цін для підвищення конкурентоспроможності.
                      </span>
                    </li>
                  )}
                  {marketPosition.marketShare < 20 && (
                    <li className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 text-blue-600" />
                      <span>
                        Частка ринку {marketPosition.marketShare.toFixed(1)}% може бути збільшена через
                        агресивнішу цінову стратегію або покращення асортименту.
                      </span>
                    </li>
                  )}
                  {marketPosition.ourPosition > 1 && (
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-green-600" />
                      <span>
                        Позиція #{marketPosition.ourPosition} - хороший результат. Продовжуйте моніторити
                        конкурентів та адаптувати стратегію.
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
