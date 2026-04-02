'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, Trash2 } from 'lucide-react';
import { formatCents, formatDate } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { PageHeader } from '@/components/app-shell/page-header';
import { PageShell } from '@/components/app-shell/page-shell';
import { filterOperableProperties } from '@/lib/property-status';

interface Expense {
  id: string;
  propertyId: string;
  type: 'fixed' | 'capital';
  category: string;
  amount: number;
  expenseDate: string;
  description: string | null;
}

interface ExtraIncome {
  id: string;
  propertyId: string;
  type: string;
  amount: number;
  incomeDate: string;
  description: string | null;
}

const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: '房東租金', label: '房東租金' },
  { value: '台電電費', label: '台電電費' },
  { value: '水費', label: '水費' },
  { value: '網路', label: '網路' },
  { value: '清潔', label: '清潔' },
  { value: '裝潢', label: '裝潢' },
  { value: '設備', label: '設備' },
  { value: '維修', label: '維修' },
  { value: '其他', label: '其他' },
];

const INCOME_SOURCES: { value: string; label: string }[] = [
  { value: 'laundry', label: '洗衣機' },
  { value: 'vending', label: '販賣機' },
  { value: 'other', label: '其他' },
];

export default function FinancePage() {
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [propertyId, setPropertyId] = useState<string>('all');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<ExtraIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expOpen, setExpOpen] = useState(false);
  const [expForm, setExpForm] = useState({
    propertyId: '',
    type: 'fixed' as 'fixed' | 'capital',
    category: '房東租金',
    amountYuan: 0,
    expenseDate: new Date().toISOString().split('T')[0] ?? '',
    description: '',
  });
  const [expSaving, setExpSaving] = useState(false);

  const [incOpen, setIncOpen] = useState(false);
  const [incForm, setIncForm] = useState({
    propertyId: '',
    type: 'laundry',
    amountYuan: 0,
    incomeDate: new Date().toISOString().split('T')[0] ?? '',
    description: '',
  });
  const [incSaving, setIncSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, e, i] = await Promise.all([
        api.get<Array<{ id: string; name: string; status?: string }>>('/api/properties'),
        api.get<Expense[]>('/api/expenses'),
        api.get<ExtraIncome[]>('/api/incomes'),
      ]);
      setProperties(filterOperableProperties(p));
      setExpenses(e);
      setIncomes(i);
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filteredExpenses = expenses.filter(
    (x) => propertyId === 'all' || x.propertyId === propertyId,
  );
  const filteredIncomes = incomes.filter(
    (x) => propertyId === 'all' || x.propertyId === propertyId,
  );

  const propName = (id: string) => properties.find((p) => p.id === id)?.name ?? id;

  const handleAddExpense = async () => {
    if (!expForm.propertyId) {
      alert('請選擇物業');
      return;
    }
    setExpSaving(true);
    try {
      await api.post('/api/expenses', {
        propertyId: expForm.propertyId,
        type: expForm.type,
        category: expForm.category,
        amount: Math.round(expForm.amountYuan * 100),
        expenseDate: expForm.expenseDate,
        description: expForm.description || null,
      });
      setExpOpen(false);
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : '新增失敗');
    } finally {
      setExpSaving(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('確定刪除？')) return;
    try {
      await api.delete(`/api/expenses/${id}`);
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : '刪除失敗');
    }
  };

  const handleAddIncome = async () => {
    if (!incForm.propertyId) {
      alert('請選擇物業');
      return;
    }
    setIncSaving(true);
    try {
      await api.post('/api/incomes', {
        propertyId: incForm.propertyId,
        type: incForm.type,
        amount: Math.round(incForm.amountYuan * 100),
        incomeDate: new Date(incForm.incomeDate).toISOString(),
        description: incForm.description || null,
      });
      setIncOpen(false);
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : '新增失敗');
    } finally {
      setIncSaving(false);
    }
  };

  const handleDeleteIncome = async (id: string) => {
    if (!confirm('確定刪除？')) return;
    try {
      await api.delete(`/api/incomes/${id}`);
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : '刪除失敗');
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="收支管理"
        description="支出與補充收入（僅 active / demo 物業可新增或刪除）"
        actions={
          <Button type="button" variant="outline" onClick={() => void loadAll()} disabled={loading}>
            重新整理
          </Button>
        }
      />

      {error && (
        <Card className="border-red-200 mb-4">
          <CardContent className="pt-6 text-red-600">{error}</CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div className="space-y-1">
          <Label>物業篩選</Label>
          <Select value={propertyId} onValueChange={setPropertyId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="物業" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="expense" className="space-y-4">
        <TabsList>
          <TabsTrigger value="expense">支出</TabsTrigger>
          <TabsTrigger value="income">補充收入</TabsTrigger>
        </TabsList>

        <TabsContent value="expense">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>支出紀錄</CardTitle>
                <CardDescription>固定支出 / 資本支出</CardDescription>
              </div>
              <Button
                type="button"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  setExpForm((f) => ({
                    ...f,
                    propertyId: propertyId !== 'all' ? propertyId : properties[0]?.id ?? '',
                  }));
                  setExpOpen(true);
                }}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                新增支出
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead>物業</TableHead>
                      <TableHead>類型</TableHead>
                      <TableHead>類別</TableHead>
                      <TableHead className="text-right">金額</TableHead>
                      <TableHead>說明</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{formatDate(row.expenseDate, 'short')}</TableCell>
                        <TableCell>{propName(row.propertyId)}</TableCell>
                        <TableCell>{row.type === 'fixed' ? '固定支出' : '資本支出'}</TableCell>
                        <TableCell>{row.category}</TableCell>
                        <TableCell className="text-right">{formatCents(row.amount)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{row.description ?? '—'}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => void handleDeleteExpense(row.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>補充收入</CardTitle>
                <CardDescription>洗衣機、販賣機等</CardDescription>
              </div>
              <Button
                type="button"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  setIncForm((f) => ({
                    ...f,
                    propertyId: propertyId !== 'all' ? propertyId : properties[0]?.id ?? '',
                  }));
                  setIncOpen(true);
                }}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                新增收入
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead>物業</TableHead>
                      <TableHead>來源</TableHead>
                      <TableHead className="text-right">金額</TableHead>
                      <TableHead>說明</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIncomes.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{formatDate(row.incomeDate, 'short')}</TableCell>
                        <TableCell>{propName(row.propertyId)}</TableCell>
                        <TableCell>
                          {INCOME_SOURCES.find((s) => s.value === row.type)?.label ?? row.type}
                        </TableCell>
                        <TableCell className="text-right">{formatCents(row.amount)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{row.description ?? '—'}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => void handleDeleteIncome(row.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增支出</DialogTitle>
            <DialogDescription>金額以「元」輸入，送出時轉為分</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>物業</Label>
              <Select
                value={expForm.propertyId}
                onValueChange={(v) => setExpForm((f) => ({ ...f, propertyId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇物業" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>類型</Label>
              <Select
                value={expForm.type}
                onValueChange={(v) => setExpForm((f) => ({ ...f, type: v as 'fixed' | 'capital' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">固定支出</SelectItem>
                  <SelectItem value="capital">資本支出</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>類別</Label>
              <Select
                value={expForm.category}
                onValueChange={(v) => setExpForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>金額（元）</Label>
              <Input
                type="number"
                value={expForm.amountYuan || ''}
                onChange={(e) =>
                  setExpForm((f) => ({ ...f, amountYuan: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div>
              <Label>日期</Label>
              <Input
                type="date"
                value={expForm.expenseDate}
                onChange={(e) => setExpForm((f) => ({ ...f, expenseDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>說明</Label>
              <Input
                value={expForm.description}
                onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExpOpen(false)}>
              取消
            </Button>
            <Button type="button" disabled={expSaving} onClick={() => void handleAddExpense()}>
              送出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={incOpen} onOpenChange={setIncOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增補充收入</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>物業</Label>
              <Select
                value={incForm.propertyId}
                onValueChange={(v) => setIncForm((f) => ({ ...f, propertyId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇物業" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>來源</Label>
              <Select
                value={incForm.type}
                onValueChange={(v) => setIncForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCOME_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>金額（元）</Label>
              <Input
                type="number"
                value={incForm.amountYuan || ''}
                onChange={(e) =>
                  setIncForm((f) => ({ ...f, amountYuan: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div>
              <Label>日期</Label>
              <Input
                type="date"
                value={incForm.incomeDate}
                onChange={(e) => setIncForm((f) => ({ ...f, incomeDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>說明</Label>
              <Input
                value={incForm.description}
                onChange={(e) => setIncForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIncOpen(false)}>
              取消
            </Button>
            <Button type="button" disabled={incSaving} onClick={() => void handleAddIncome()}>
              送出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent" />
        </div>
      )}
    </PageShell>
  );
}
