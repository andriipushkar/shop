'use client';

/**
 * Admin POS Fiscal Page
 * Управління фіскальними операціями (ПРРО)
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  FileText,
  Search,
  Calendar,
} from 'lucide-react';

interface ShiftStatus {
  isOpen: boolean;
  shift?: {
    id: string;
    serial: number;
    openedAt: string;
    balance: number;
    receiptsCount: number;
    totalSales: number;
    totalReturns: number;
  };
}

interface FiscalResult {
  success: boolean;
  fiscalCode?: string;
  receiptId?: string;
  receiptUrl?: string;
  qrCodeUrl?: string;
  error?: string;
}

export default function FiscalPage() {
  const [shiftStatus, setShiftStatus] = useState<ShiftStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Service operations state
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Receipt lookup state
  const [searchFiscalCode, setSearchFiscalCode] = useState('');
  const [searchedReceipt, setSearchedReceipt] = useState<any>(null);

  // Reports state
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [periodFrom, setPeriodFrom] = useState(
    new Date(new Date().setDate(new Date().getDate() - 7))
      .toISOString()
      .split('T')[0]
  );
  const [periodTo, setPeriodTo] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadShiftStatus();
  }, []);

  const loadShiftStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/fiscal/shift/status');
      const data = await response.json();

      if (data.success) {
        setShiftStatus(data.status);
      } else {
        setError(data.error || 'Помилка завантаження статусу зміни');
      }
    } catch (err) {
      setError('Помилка завантаження статусу зміни');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShift = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/admin/fiscal/shift/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Зміну відкрито успішно');
        await loadShiftStatus();
      } else {
        setError(data.error || 'Помилка відкриття зміни');
      }
    } catch (err) {
      setError('Помилка відкриття зміни');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async () => {
    if (!confirm('Ви впевнені, що хочете закрити зміну та сформувати Z-звіт?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/admin/fiscal/shift/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(
          `Зміну закрито. Z-звіт №${data.zReport.serial}. Фіскальний код: ${data.zReport.fiscalCode || 'N/A'}`
        );
        await loadShiftStatus();
      } else {
        setError(data.error || 'Помилка закриття зміни');
      }
    } catch (err) {
      setError('Помилка закриття зміни');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Невірна сума внесення');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/admin/fiscal/service/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Службове внесення ${amount.toFixed(2)} грн виконано успішно`);
        setDepositAmount('');
        await loadShiftStatus();
      } else {
        setError(data.error || 'Помилка службового внесення');
      }
    } catch (err) {
      setError('Помилка службового внесення');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Невірна сума винесення');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/admin/fiscal/service/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Службове винесення ${amount.toFixed(2)} грн виконано успішно`);
        setWithdrawAmount('');
        await loadShiftStatus();
      } else {
        setError(data.error || 'Помилка службового винесення');
      }
    } catch (err) {
      setError('Помилка службового винесення');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchReceipt = async () => {
    if (!searchFiscalCode.trim()) {
      setError('Введіть фіскальний код');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSearchedReceipt(null);

      const response = await fetch(
        `/api/admin/fiscal/receipt/${encodeURIComponent(searchFiscalCode)}`
      );
      const data = await response.json();

      if (data.success) {
        setSearchedReceipt(data.receipt);
      } else {
        setError(data.error || 'Чек не знайдено');
      }
    } catch (err) {
      setError('Помилка пошуку чека');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">ПРРО - Фіскальні операції</h1>
        <Badge variant={shiftStatus?.isOpen ? 'default' : 'secondary'}>
          {shiftStatus?.isOpen ? 'Зміна відкрита' : 'Зміна закрита'}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Shift Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Статус зміни
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shiftStatus?.isOpen && shiftStatus.shift ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Номер зміни</p>
                  <p className="text-2xl font-bold">{shiftStatus.shift.serial}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Відкрито</p>
                  <p className="text-lg font-semibold">
                    {new Date(shiftStatus.shift.openedAt).toLocaleString('uk-UA')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Баланс</p>
                  <p className="text-2xl font-bold text-green-600">
                    {shiftStatus.shift.balance?.toFixed(2) || '0.00'} грн
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Чеків</p>
                  <p className="text-2xl font-bold">
                    {shiftStatus.shift.receiptsCount || 0}
                  </p>
                </div>
              </div>

              <Button onClick={handleCloseShift} variant="destructive" disabled={loading}>
                Закрити зміну (Z-звіт)
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Немає відкритої зміни. Відкрийте зміну для початку роботи.
              </p>
              <Button onClick={handleOpenShift} disabled={loading}>
                Відкрити зміну
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="service" className="space-y-4">
        <TabsList>
          <TabsTrigger value="service">Службові операції</TabsTrigger>
          <TabsTrigger value="lookup">Пошук чеків</TabsTrigger>
          <TabsTrigger value="reports">Звіти</TabsTrigger>
        </TabsList>

        {/* Service Operations Tab */}
        <TabsContent value="service" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Deposit Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Службове внесення
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="depositAmount">Сума (грн)</Label>
                  <Input
                    id="depositAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    disabled={!shiftStatus?.isOpen}
                  />
                </div>
                <Button
                  onClick={handleDeposit}
                  disabled={!shiftStatus?.isOpen || loading}
                  className="w-full"
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Внести готівку
                </Button>
              </CardContent>
            </Card>

            {/* Withdrawal Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  Службове винесення
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="withdrawAmount">Сума (грн)</Label>
                  <Input
                    id="withdrawAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    disabled={!shiftStatus?.isOpen}
                  />
                </div>
                <Button
                  onClick={handleWithdraw}
                  disabled={!shiftStatus?.isOpen || loading}
                  variant="destructive"
                  className="w-full"
                >
                  <TrendingDown className="mr-2 h-4 w-4" />
                  Винести готівку
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Receipt Lookup Tab */}
        <TabsContent value="lookup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Пошук чека
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="fiscalCode">Фіскальний код або ID</Label>
                  <Input
                    id="fiscalCode"
                    placeholder="Введіть фіскальний код або ID чека"
                    value={searchFiscalCode}
                    onChange={(e) => setSearchFiscalCode(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSearchReceipt();
                      }
                    }}
                  />
                </div>
                <div className="pt-6">
                  <Button onClick={handleSearchReceipt} disabled={loading}>
                    <Search className="mr-2 h-4 w-4" />
                    Знайти
                  </Button>
                </div>
              </div>

              {searchedReceipt && (
                <div className="mt-4 p-4 border rounded-lg space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">
                        Чек №{searchedReceipt.fiscalCode}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(searchedReceipt.date).toLocaleString('uk-UA')}
                      </p>
                    </div>
                    <Badge>{searchedReceipt.type === 'SELL' ? 'Продаж' : 'Повернення'}</Badge>
                  </div>

                  <div className="border-t pt-3">
                    <h4 className="font-semibold mb-2">Товари:</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Назва</TableHead>
                          <TableHead className="text-right">Кількість</TableHead>
                          <TableHead className="text-right">Ціна</TableHead>
                          <TableHead className="text-right">Сума</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchedReceipt.items.map((item: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">
                              {item.price.toFixed(2)} грн
                            </TableCell>
                            <TableCell className="text-right">
                              {item.total.toFixed(2)} грн
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="border-t pt-3 flex justify-between items-center">
                    <span className="font-semibold">Всього:</span>
                    <span className="text-2xl font-bold">
                      {searchedReceipt.total.toFixed(2)} грн
                    </span>
                  </div>

                  {searchedReceipt.pdfUrl && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open(searchedReceipt.pdfUrl, '_blank')}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Завантажити PDF
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Daily Report Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Денний звіт
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="reportDate">Дата</Label>
                  <Input
                    id="reportDate"
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                  />
                </div>
                <Button className="w-full" disabled>
                  <FileText className="mr-2 h-4 w-4" />
                  Сформувати звіт
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Функція в розробці
                </p>
              </CardContent>
            </Card>

            {/* Period Report Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Звіт за період
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="periodFrom">Від</Label>
                  <Input
                    id="periodFrom"
                    type="date"
                    value={periodFrom}
                    onChange={(e) => setPeriodFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="periodTo">До</Label>
                  <Input
                    id="periodTo"
                    type="date"
                    value={periodTo}
                    onChange={(e) => setPeriodTo(e.target.value)}
                  />
                </div>
                <Button className="w-full" disabled>
                  <FileText className="mr-2 h-4 w-4" />
                  Сформувати звіт
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Функція в розробці
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
