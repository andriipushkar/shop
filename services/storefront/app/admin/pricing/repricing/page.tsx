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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Plus,
  AlertTriangle,
  CheckCircle,
  Play,
  Settings,
  Eye,
} from 'lucide-react';
import { RepricingRule, PriceChange, PriceAlert } from '@/lib/ai/repricing-engine';

export default function RepricingDashboardPage() {
  const [rules, setRules] = useState<RepricingRule[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceChange[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load rules
      const rulesRes = await fetch('/api/ai/repricing/rules');
      const rulesData = await rulesRes.json();
      if (rulesData.success) {
        setRules(rulesData.data);
      }

      // Load alerts
      const alertsRes = await fetch('/api/ai/repricing/alerts');
      const alertsData = await alertsRes.json();
      if (alertsData.success) {
        setAlerts(alertsData.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPriceHistory = async (productId: string) => {
    try {
      const res = await fetch(`/api/ai/repricing/history?productId=${productId}`);
      const data = await res.json();
      if (data.success) {
        setPriceHistory(data.data.history);
      }
    } catch (error) {
      console.error('Failed to load price history:', error);
    }
  };

  const runRepricing = async (type: 'product' | 'category' | 'all', id?: string) => {
    try {
      const body: any = {};
      if (type === 'product' && id) {
        body.productId = id;
      } else if (type === 'category' && id) {
        body.categoryId = id;
      } else {
        body.scheduled = true;
      }

      const res = await fetch('/api/ai/repricing/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        alert('Repricing completed successfully!');
        loadData();
      }
    } catch (error) {
      console.error('Failed to run repricing:', error);
      alert('Failed to run repricing');
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const rule = rules.find(r => r.id === ruleId);
      if (!rule) return;

      const res = await fetch('/api/ai/repricing/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rule, enabled }),
      });

      const data = await res.json();
      if (data.success) {
        loadData();
      }
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Видалити це правило репрайсингу?')) return;

    try {
      const res = await fetch(`/api/ai/repricing/rules?id=${ruleId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        loadData();
      }
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  // Calculate statistics
  const activeRules = rules.filter(r => r.enabled).length;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
  const recentChanges = priceHistory.filter(
    c => new Date(c.appliedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
  ).length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Автоматичний репрайсинг</h1>
          <p className="text-muted-foreground">
            Управління автоматичним ціноутворенням на основі конкурентних цін
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadData()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Оновити
          </Button>
          <Dialog open={isCreatingRule} onOpenChange={setIsCreatingRule}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Нове правило
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Створити правило репрайсингу</DialogTitle>
                <DialogDescription>
                  Налаштуйте автоматичне ціноутворення для товару або категорії
                </DialogDescription>
              </DialogHeader>
              <CreateRuleForm onClose={() => setIsCreatingRule(false)} onSuccess={loadData} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активні правила</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeRules}</div>
            <p className="text-xs text-muted-foreground">з {rules.length} всього</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Критичні алерти</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{criticalAlerts}</div>
            <p className="text-xs text-muted-foreground">потребують уваги</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Зміни за 24г</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentChanges}</div>
            <p className="text-xs text-muted-foreground">автоматичних змін</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всі алерти</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts.length}</div>
            <p className="text-xs text-muted-foreground">активних сповіщень</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">Правила</TabsTrigger>
          <TabsTrigger value="history">Історія змін</TabsTrigger>
          <TabsTrigger value="alerts">Алерти</TabsTrigger>
          <TabsTrigger value="competitors">Конкуренти</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Правила репрайсингу</CardTitle>
              <CardDescription>
                Управління правилами автоматичного ціноутворення
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Завантаження...</div>
              ) : rules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Немає налаштованих правил репрайсингу
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Статус</TableHead>
                      <TableHead>Назва</TableHead>
                      <TableHead>Стратегія</TableHead>
                      <TableHead>Конкуренти</TableHead>
                      <TableHead>Обмеження</TableHead>
                      <TableHead>Дії</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {rule.productId ? `Товар ${rule.productId}` :
                               rule.categoryId ? `Категорія ${rule.categoryId}` :
                               'Глобальне правило'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {rule.id}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {rule.strategy.type === 'beat_lowest' && `Нижче на ${rule.strategy.margin} грн`}
                            {rule.strategy.type === 'match_lowest' && 'Відповідність'}
                            {rule.strategy.type === 'percentage_below' && `${rule.strategy.percent}% нижче`}
                            {rule.strategy.type === 'smart' && `Smart (позиція ${rule.strategy.targetPosition})`}
                            {rule.strategy.type === 'maximize_margin' && `Максимізація маржі`}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{rule.competitors.length} конкурентів</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-1">
                            {rule.constraints.minPrice && (
                              <div>Мін: {rule.constraints.minPrice} грн</div>
                            )}
                            {rule.constraints.maxPrice && (
                              <div>Макс: {rule.constraints.maxPrice} грн</div>
                            )}
                            {rule.constraints.minMargin && (
                              <div>Маржа: {rule.constraints.minMargin}%</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rule.productId && runRepricing('product', rule.productId)}
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteRule(rule.id)}
                            >
                              Видалити
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Історія змін цін</CardTitle>
              <CardDescription>
                Перегляд автоматичних змін цін
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label>Виберіть товар</Label>
                <Input
                  placeholder="ID товару"
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  onBlur={() => selectedProduct && loadPriceHistory(selectedProduct)}
                />
              </div>

              {priceHistory.length > 0 && (
                <>
                  <div className="mb-6">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={priceHistory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="appliedAt"
                          tickFormatter={(value) => new Date(value).toLocaleDateString('uk-UA')}
                        />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="oldPrice" stroke="#8884d8" name="Стара ціна" />
                        <Line type="monotone" dataKey="newPrice" stroke="#82ca9d" name="Нова ціна" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Стара ціна</TableHead>
                        <TableHead>Нова ціна</TableHead>
                        <TableHead>Зміна</TableHead>
                        <TableHead>Причина</TableHead>
                        <TableHead>Маржа</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {priceHistory.map((change) => {
                        const diff = change.newPrice - change.oldPrice;
                        const diffPercent = ((diff / change.oldPrice) * 100).toFixed(2);

                        return (
                          <TableRow key={change.id}>
                            <TableCell>
                              {new Date(change.appliedAt).toLocaleString('uk-UA')}
                            </TableCell>
                            <TableCell>{change.oldPrice.toFixed(2)} грн</TableCell>
                            <TableCell>{change.newPrice.toFixed(2)} грн</TableCell>
                            <TableCell>
                              <div className={`flex items-center gap-1 ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {diff > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                {diff > 0 ? '+' : ''}{diff.toFixed(2)} грн ({diffPercent}%)
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">{change.reason}</TableCell>
                            <TableCell>{change.margin.toFixed(1)}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Цінові алерти</CardTitle>
              <CardDescription>
                Сповіщення про конкурентні ціни
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Немає активних алертів
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Важливість</TableHead>
                      <TableHead>Товар</TableHead>
                      <TableHead>Конкурент</TableHead>
                      <TableHead>Наша ціна</TableHead>
                      <TableHead>Їх ціна</TableHead>
                      <TableHead>Різниця</TableHead>
                      <TableHead>Дата</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell>
                          <Badge
                            variant={
                              alert.severity === 'critical' ? 'destructive' :
                              alert.severity === 'high' ? 'default' :
                              'secondary'
                            }
                          >
                            {alert.severity === 'critical' && 'Критично'}
                            {alert.severity === 'high' && 'Високо'}
                            {alert.severity === 'medium' && 'Середньо'}
                            {alert.severity === 'low' && 'Низько'}
                          </Badge>
                        </TableCell>
                        <TableCell>{alert.productName}</TableCell>
                        <TableCell>{alert.competitorName}</TableCell>
                        <TableCell>{alert.ourPrice.toFixed(2)} грн</TableCell>
                        <TableCell>{alert.competitorPrice.toFixed(2)} грн</TableCell>
                        <TableCell>
                          <div className="text-destructive">
                            +{alert.difference.toFixed(2)} грн ({alert.differencePercent.toFixed(1)}%)
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(alert.createdAt).toLocaleString('uk-UA')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competitors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Порівняння з конкурентами</CardTitle>
              <CardDescription>
                Моніторинг цін конкурентів
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Дані конкурентів завантажуються...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CreateRuleForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    productId: '',
    strategy: 'beat_lowest' as const,
    margin: 10,
    percent: 5,
    targetPosition: 1,
    minMargin: 20,
    competitors: ['comp1', 'comp2'],
    minPrice: '',
    maxPrice: '',
    minMarginConstraint: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const rule = {
      id: `rule_${Date.now()}`,
      productId: formData.productId || undefined,
      enabled: true,
      strategy:
        formData.strategy === 'beat_lowest'
          ? { type: 'beat_lowest', margin: formData.margin }
          : formData.strategy === 'percentage_below'
          ? { type: 'percentage_below', percent: formData.percent }
          : formData.strategy === 'smart'
          ? { type: 'smart', targetPosition: formData.targetPosition }
          : formData.strategy === 'maximize_margin'
          ? { type: 'maximize_margin', minMargin: formData.minMargin }
          : { type: 'match_lowest' },
      competitors: formData.competitors,
      constraints: {
        minPrice: formData.minPrice ? parseFloat(formData.minPrice) : undefined,
        maxPrice: formData.maxPrice ? parseFloat(formData.maxPrice) : undefined,
        minMargin: formData.minMarginConstraint
          ? parseFloat(formData.minMarginConstraint)
          : undefined,
      },
    };

    try {
      const res = await fetch('/api/ai/repricing/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });

      const data = await res.json();
      if (data.success) {
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Failed to create rule:', error);
      alert('Помилка створення правила');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>ID товару (опціонально)</Label>
        <Input
          placeholder="Залиште порожнім для глобального правила"
          value={formData.productId}
          onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
        />
      </div>

      <div>
        <Label>Стратегія</Label>
        <Select
          value={formData.strategy}
          onValueChange={(value: any) => setFormData({ ...formData, strategy: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="beat_lowest">Нижче найнижчої</SelectItem>
            <SelectItem value="match_lowest">Відповідність найнижчій</SelectItem>
            <SelectItem value="percentage_below">% нижче</SelectItem>
            <SelectItem value="smart">Smart pricing</SelectItem>
            <SelectItem value="maximize_margin">Максимізація маржі</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.strategy === 'beat_lowest' && (
        <div>
          <Label>Маржа (грн)</Label>
          <Input
            type="number"
            value={formData.margin}
            onChange={(e) => setFormData({ ...formData, margin: parseFloat(e.target.value) })}
          />
        </div>
      )}

      {formData.strategy === 'percentage_below' && (
        <div>
          <Label>Відсоток нижче (%)</Label>
          <Input
            type="number"
            value={formData.percent}
            onChange={(e) => setFormData({ ...formData, percent: parseFloat(e.target.value) })}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Мін. ціна (опціонально)</Label>
          <Input
            type="number"
            placeholder="0"
            value={formData.minPrice}
            onChange={(e) => setFormData({ ...formData, minPrice: e.target.value })}
          />
        </div>
        <div>
          <Label>Макс. ціна (опціонально)</Label>
          <Input
            type="number"
            placeholder="0"
            value={formData.maxPrice}
            onChange={(e) => setFormData({ ...formData, maxPrice: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label>Мін. маржа % (опціонально)</Label>
        <Input
          type="number"
          placeholder="20"
          value={formData.minMarginConstraint}
          onChange={(e) => setFormData({ ...formData, minMarginConstraint: e.target.value })}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Скасувати
        </Button>
        <Button type="submit">Створити правило</Button>
      </div>
    </form>
  );
}
