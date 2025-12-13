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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Package,
  ShoppingCart,
  DollarSign,
  RefreshCw,
  Download,
  Calendar,
} from 'lucide-react';
import { DemandForecast, PurchaseRecommendation, SeasonalityPattern } from '@/lib/ai/demand-forecasting';

export default function DemandForecastDashboardPage() {
  const [forecast, setForecast] = useState<DemandForecast | null>(null);
  const [recommendations, setRecommendations] = useState<PurchaseRecommendation[]>([]);
  const [seasonality, setSeasonality] = useState<SeasonalityPattern | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('prod1');
  const [forecastDays, setForecastDays] = useState(30);
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');

  useEffect(() => {
    loadRecommendations();
  }, [urgencyFilter]);

  const loadForecast = async () => {
    if (!selectedProduct) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/ai/forecast?productId=${selectedProduct}&days=${forecastDays}`);
      const data = await res.json();
      if (data.success) {
        setForecast(data.data);
      }

      // Load seasonality
      const seasonRes = await fetch(`/api/ai/forecast/seasonality?productId=${selectedProduct}`);
      const seasonData = await seasonRes.json();
      if (seasonData.success) {
        setSeasonality(seasonData.data);
      }
    } catch (error) {
      console.error('Failed to load forecast:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendations = async () => {
    try {
      const params = new URLSearchParams();
      if (urgencyFilter !== 'all') {
        params.append('urgency', urgencyFilter);
      }

      const res = await fetch(`/api/ai/forecast/recommendations?${params}`);
      const data = await res.json();
      if (data.success) {
        setRecommendations(data.data.recommendations);
      }
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    }
  };

  // Calculate summary statistics
  const criticalItems = recommendations.filter(r => r.urgency === 'critical').length;
  const totalCost = recommendations.reduce((sum, r) => sum + r.estimatedCost, 0);
  const totalRevenue = recommendations.reduce((sum, r) => sum + r.estimatedRevenue, 0);
  const avgROI = recommendations.length > 0
    ? recommendations.reduce((sum, r) => sum + r.roi, 0) / recommendations.length
    : 0;

  // Prepare chart data
  const forecastChartData = forecast?.forecast.map(point => ({
    date: new Date(point.date).toLocaleDateString('uk-UA', { month: 'short', day: 'numeric' }),
    прогноз: point.quantity,
    мінімум: point.low,
    максимум: point.high,
  })) || [];

  const urgencyChartData = [
    { name: 'Критично', value: recommendations.filter(r => r.urgency === 'critical').length, color: '#ef4444' },
    { name: 'Високо', value: recommendations.filter(r => r.urgency === 'high').length, color: '#f59e0b' },
    { name: 'Середньо', value: recommendations.filter(r => r.urgency === 'medium').length, color: '#3b82f6' },
    { name: 'Низько', value: recommendations.filter(r => r.urgency === 'low').length, color: '#10b981' },
  ].filter(item => item.value > 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Прогнозування попиту</h1>
          <p className="text-muted-foreground">
            AI-прогнозування попиту та рекомендації закупівель
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadRecommendations()}>
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
            <CardTitle className="text-sm font-medium">Критичні товари</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{criticalItems}</div>
            <p className="text-xs text-muted-foreground">потребують термінової закупівлі</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всього товарів</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recommendations.length}</div>
            <p className="text-xs text-muted-foreground">рекомендацій закупівлі</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Витрати на закупівлю</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCost.toLocaleString('uk-UA')} грн</div>
            <p className="text-xs text-muted-foreground">
              очікуваний дохід: {totalRevenue.toLocaleString('uk-UA')} грн
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Середній ROI</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{avgROI.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">рентабельність інвестицій</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="recommendations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recommendations">Рекомендації</TabsTrigger>
          <TabsTrigger value="forecast">Прогноз</TabsTrigger>
          <TabsTrigger value="seasonality">Сезонність</TabsTrigger>
          <TabsTrigger value="trends">Тренди</TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Рекомендації закупівель</CardTitle>
                  <CardDescription>
                    Автоматичні рекомендації на основі прогнозу попиту
                  </CardDescription>
                </div>
                <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всі</SelectItem>
                    <SelectItem value="critical">Критично</SelectItem>
                    <SelectItem value="high">Високо</SelectItem>
                    <SelectItem value="medium">Середньо</SelectItem>
                    <SelectItem value="low">Низько</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={urgencyChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {urgencyChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-muted-foreground">Загальна вартість</div>
                      <div className="text-2xl font-bold">{totalCost.toLocaleString('uk-UA')} грн</div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-muted-foreground">Очікуваний дохід</div>
                      <div className="text-2xl font-bold text-green-600">
                        {totalRevenue.toLocaleString('uk-UA')} грн
                      </div>
                    </div>
                    <div className="border rounded-lg p-4 col-span-2">
                      <div className="text-sm text-muted-foreground">Очікуваний прибуток</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {(totalRevenue - totalCost).toLocaleString('uk-UA')} грн
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Пріоритет</TableHead>
                    <TableHead>Товар</TableHead>
                    <TableHead>Поточний запас</TableHead>
                    <TableHead>Середній продаж/день</TableHead>
                    <TableHead>До закінчення</TableHead>
                    <TableHead>Рекомендована к-сть</TableHead>
                    <TableHead>Вартість</TableHead>
                    <TableHead>ROI</TableHead>
                    <TableHead>Дата замовлення</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recommendations.map((rec) => (
                    <TableRow key={rec.productId}>
                      <TableCell>
                        <Badge
                          variant={
                            rec.urgency === 'critical' ? 'destructive' :
                            rec.urgency === 'high' ? 'default' :
                            rec.urgency === 'medium' ? 'secondary' :
                            'outline'
                          }
                        >
                          {rec.urgency === 'critical' && 'Критично'}
                          {rec.urgency === 'high' && 'Високо'}
                          {rec.urgency === 'medium' && 'Середньо'}
                          {rec.urgency === 'low' && 'Низько'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{rec.productName}</div>
                          {rec.sku && (
                            <div className="text-xs text-muted-foreground">{rec.sku}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{rec.currentStock} од.</TableCell>
                      <TableCell>{rec.avgDailySales.toFixed(1)} од.</TableCell>
                      <TableCell>
                        <div className={rec.daysUntilStockout <= 7 ? 'text-destructive font-medium' : ''}>
                          {rec.daysUntilStockout.toFixed(0)} днів
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{rec.recommendedQuantity} од.</TableCell>
                      <TableCell>{rec.estimatedCost.toLocaleString('uk-UA')} грн</TableCell>
                      <TableCell>
                        <div className="text-green-600 font-medium">{rec.roi.toFixed(1)}%</div>
                      </TableCell>
                      <TableCell>
                        {new Date(rec.optimalOrderDate).toLocaleDateString('uk-UA')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Прогноз попиту</CardTitle>
              <CardDescription>
                Прогнозування майбутнього попиту на товар
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <Label>ID товару</Label>
                  <Input
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    placeholder="prod1"
                  />
                </div>
                <div>
                  <Label>Період прогнозу</Label>
                  <Select
                    value={forecastDays.toString()}
                    onValueChange={(value) => setForecastDays(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 днів</SelectItem>
                      <SelectItem value="14">14 днів</SelectItem>
                      <SelectItem value="30">30 днів</SelectItem>
                      <SelectItem value="60">60 днів</SelectItem>
                      <SelectItem value="90">90 днів</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={loadForecast} disabled={loading} className="w-full">
                    {loading ? 'Завантаження...' : 'Створити прогноз'}
                  </Button>
                </div>
              </div>

              {forecast && (
                <>
                  <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Товар</div>
                        <div className="font-medium">{forecast.productName}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Точність</div>
                        <div className="font-medium">{forecast.confidence}%</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Період</div>
                        <div className="font-medium">
                          {forecast.period === 'day' && 'День'}
                          {forecast.period === 'week' && 'Тиждень'}
                          {forecast.period === 'month' && 'Місяць'}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Створено</div>
                        <div className="font-medium">
                          {new Date(forecast.generatedAt).toLocaleDateString('uk-UA')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="text-sm font-medium mb-2">Фактори впливу:</h4>
                    <div className="flex flex-wrap gap-2">
                      {forecast.factors.map((factor, index) => (
                        <Badge
                          key={index}
                          variant={factor.impact > 0 ? 'default' : 'secondary'}
                        >
                          {factor.name} ({factor.impact > 0 ? '+' : ''}{(factor.impact * 100).toFixed(0)}%)
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={forecastChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="максимум"
                        stackId="1"
                        stroke="#82ca9d"
                        fill="#82ca9d"
                        fillOpacity={0.3}
                        name="Максимум (95% CI)"
                      />
                      <Area
                        type="monotone"
                        dataKey="прогноз"
                        stackId="2"
                        stroke="#8884d8"
                        fill="#8884d8"
                        fillOpacity={0.6}
                        name="Прогноз"
                      />
                      <Area
                        type="monotone"
                        dataKey="мінімум"
                        stackId="3"
                        stroke="#ffc658"
                        fill="#ffc658"
                        fillOpacity={0.3}
                        name="Мінімум (95% CI)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seasonality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Аналіз сезонності</CardTitle>
              <CardDescription>
                Виявлення сезонних патернів у продажах
              </CardDescription>
            </CardHeader>
            <CardContent>
              {seasonality && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">Тип патерну</div>
                      <Badge variant="outline" className="text-lg">
                        {seasonality.pattern === 'none' && 'Не виявлено'}
                        {seasonality.pattern === 'weekly' && 'Тижневий'}
                        {seasonality.pattern === 'monthly' && 'Місячний'}
                        {seasonality.pattern === 'yearly' && 'Річний'}
                      </Badge>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">Сила патерну</div>
                      <div className="text-2xl font-bold">
                        {(seasonality.strength * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">Піки продажів</div>
                      <div className="text-2xl font-bold">{seasonality.peaks.length}</div>
                    </div>
                  </div>

                  {seasonality.peaks.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Піки продажів:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {seasonality.peaks.map((peak, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-medium">{peak.period}</div>
                                <div className="text-sm text-muted-foreground">Період</div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-green-600">
                                  +{((peak.multiplier - 1) * 100).toFixed(0)}%
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  вище середнього
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {seasonality.troughs.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Спади продажів:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {seasonality.troughs.map((trough, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-medium">{trough.period}</div>
                                <div className="text-sm text-muted-foreground">Період</div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-red-600">
                                  {((trough.multiplier - 1) * 100).toFixed(0)}%
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  нижче середнього
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!seasonality && (
                <div className="text-center py-8 text-muted-foreground">
                  Виберіть товар та створіть прогноз для аналізу сезонності
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Аналіз трендів</CardTitle>
              <CardDescription>
                Виявлення довгострокових трендів у продажах
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Функція аналізу трендів буде доступна найближчим часом
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
