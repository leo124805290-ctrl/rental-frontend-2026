'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Bell, CheckCircle2, Pencil, Plus, ScrollText } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { PageHeader } from '@/components/app-shell/page-header';
import { PageShell } from '@/components/app-shell/page-shell';
import {
  getContracts,
  getPayments,
  saveContracts,
  savePayments,
  generatePaymentSchedule,
  mergeScheduleWithSaved,
  type LandlordContract,
  type LandlordPayment,
} from '@/lib/landlord-store';

function todayYmd(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const parts = ymd.split('-').map(Number);
  const y = parts[0] ?? 0;
  const mo = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const dt = new Date(y, mo - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function buildYearlyRents(
  startYmd: string,
  endYmd: string,
  prev: Array<{ year: number; monthlyRent: number }>,
): Array<{ year: number; monthlyRent: number }> {
  const y0 = Number(startYmd.slice(0, 4));
  const y1 = Number(endYmd.slice(0, 4));
  if (!Number.isFinite(y0) || !Number.isFinite(y1) || y1 < y0) return prev;
  const prevMap = new Map(prev.map((r) => [r.year, r.monthlyRent]));
  const out: Array<{ year: number; monthlyRent: number }> = [];
  for (let y = y0; y <= y1; y++) {
    const fallback = prev.length ? prev[prev.length - 1]!.monthlyRent : 50000;
    out.push({ year: y, monthlyRent: prevMap.get(y) ?? fallback });
  }
  return out;
}

const PAYMENT_CYCLE_OPTIONS: { value: LandlordContract['paymentCycle']; label: string }[] = [
  { value: 'monthly', label: '每月' },
  { value: 'quarterly', label: '每季' },
  { value: 'semi-annual', label: '每半年' },
  { value: 'annual', label: '每年' },
];

export default function LandlordPaymentsPage() {
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [contracts, setContracts] = useState<LandlordContract[]>([]);
  const [payments, setPayments] = useState<LandlordPayment[]>([]);
  const [filterPropertyId, setFilterPropertyId] = useState<string>('all');
  const [historyContractId, setHistoryContractId] = useState<string | null>(null);
  const [loadingProps, setLoadingProps] = useState(true);

  const [contractOpen, setContractOpen] = useState(false);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [contractForm, setContractForm] = useState({
    propertyId: '',
    landlordName: '',
    landlordPhone: '',
    startDate: todayYmd(),
    endDate: todayYmd(),
    depositMonths: 2,
    depositAmount: 0,
    depositPaid: false,
    paymentCycle: 'monthly' as LandlordContract['paymentCycle'],
    yearlyRents: [] as Array<{ year: number; monthlyRent: number }>,
  });

  const [markOpen, setMarkOpen] = useState(false);
  const [markPayment, setMarkPayment] = useState<LandlordPayment | null>(null);
  const [markForm, setMarkForm] = useState({
    paidDate: todayYmd(),
    paidAmount: 0,
    paymentMethod: '轉帳',
    notes: '',
  });
  const [markSaving, setMarkSaving] = useState(false);

  const reloadLocal = useCallback(() => {
    setContracts(getContracts());
    setPayments(getPayments());
  }, []);

  useEffect(() => {
    void (async () => {
      setLoadingProps(true);
      try {
        const list = await api.get<Array<{ id: string; name: string }>>('/api/properties');
        setProperties(Array.isArray(list) ? list : []);
      } catch {
        setProperties([]);
      } finally {
        setLoadingProps(false);
      }
    })();
  }, []);

  useEffect(() => {
    reloadLocal();
  }, [reloadLocal]);

  const propName = useCallback(
    (id: string) => properties.find((p) => p.id === id)?.name ?? id,
    [properties],
  );

  const filteredContracts = useMemo(() => {
    if (filterPropertyId === 'all') return contracts;
    return contracts.filter((c) => c.propertyId === filterPropertyId);
  }, [contracts, filterPropertyId]);

  const filteredPayments = useMemo(() => {
    if (filterPropertyId === 'all') return payments;
    return payments.filter((p) => p.propertyId === filterPropertyId);
  }, [payments, filterPropertyId]);

  const today = todayYmd();
  const in14 = addDaysYmd(today, 14);

  const overdueList = useMemo(
    () =>
      filteredPayments.filter(
        (p) => p.status !== 'paid' && p.dueDate < today,
      ),
    [filteredPayments, today],
  );

  const upcomingList = useMemo(
    () =>
      filteredPayments.filter(
        (p) =>
          p.status !== 'paid' &&
          p.dueDate >= today &&
          p.dueDate <= in14,
      ),
    [filteredPayments, today, in14],
  );

  const paidRecentList = useMemo(
    () =>
      filteredPayments
        .filter((p) => p.status === 'paid')
        .sort((a, b) => (b.paidDate || '').localeCompare(a.paidDate || '')),
    [filteredPayments],
  );

  const historyRows = useMemo(() => {
    let rows = [...filteredPayments].sort((a, b) => b.dueDate.localeCompare(a.dueDate));
    if (historyContractId) {
      rows = rows.filter((p) => p.contractId === historyContractId);
    }
    return rows;
  }, [filteredPayments, historyContractId]);

  const openNewContract = () => {
    setEditingContractId(null);
    const s = todayYmd();
    const e = addDaysYmd(s, 365);
    const yr = buildYearlyRents(s, e, []);
    setContractForm({
      propertyId: properties[0]?.id ?? '',
      landlordName: '',
      landlordPhone: '',
      startDate: s,
      endDate: e,
      depositMonths: 2,
      depositAmount: 0,
      depositPaid: false,
      paymentCycle: 'monthly',
      yearlyRents: yr,
    });
    setContractOpen(true);
  };

  const openEditContract = (c: LandlordContract) => {
    setEditingContractId(c.id);
    setContractForm({
      propertyId: c.propertyId,
      landlordName: c.landlordName,
      landlordPhone: c.landlordPhone,
      startDate: c.startDate,
      endDate: c.endDate,
      depositMonths: c.depositMonths,
      depositAmount: c.depositAmount,
      depositPaid: c.depositPaid,
      paymentCycle: c.paymentCycle,
      yearlyRents: [...c.yearlyRents],
    });
    setContractOpen(true);
  };

  const saveContract = () => {
    if (!contractForm.propertyId) {
      alert('請選擇物業');
      return;
    }
    if (!contractForm.landlordName.trim()) {
      alert('請填房東姓名');
      return;
    }
    const id = editingContractId ?? crypto.randomUUID();
    const c: LandlordContract = {
      id,
      propertyId: contractForm.propertyId,
      propertyName: propName(contractForm.propertyId),
      landlordName: contractForm.landlordName.trim(),
      landlordPhone: contractForm.landlordPhone.trim(),
      startDate: contractForm.startDate,
      endDate: contractForm.endDate,
      depositMonths: Number(contractForm.depositMonths) || 0,
      depositAmount: Number(contractForm.depositAmount) || 0,
      depositPaid: contractForm.depositPaid,
      paymentCycle: contractForm.paymentCycle,
      yearlyRents: contractForm.yearlyRents,
    };

    const allC = getContracts();
    const allP = getPayments();
    const others = allC.filter((x) => x.id !== id);
    const nextContracts = [...others, c];
    const gen = generatePaymentSchedule(c);
    const merged = mergeScheduleWithSaved(c, gen, allP);
    const rest = allP.filter((p) => p.contractId !== c.id);
    const nextPayments = [...rest, ...merged];

    saveContracts(nextContracts);
    savePayments(nextPayments);
    setContracts(nextContracts);
    setPayments(nextPayments);
    setContractOpen(false);
  };

  const openMarkPaid = (p: LandlordPayment) => {
    setMarkPayment(p);
    setMarkForm({
      paidDate: todayYmd(),
      paidAmount: p.amount,
      paymentMethod: '轉帳',
      notes: '',
    });
    setMarkOpen(true);
  };

  const submitMarkPaid = async () => {
    if (!markPayment) return;
    const contract = contracts.find((c) => c.id === markPayment.contractId);
    if (!contract) {
      alert('找不到合約');
      return;
    }
    setMarkSaving(true);
    let expenseSynced = markPayment.expenseSynced;
    try {
      const paidAmt = Number(markForm.paidAmount) || 0;
      await api.post('/api/expenses', {
        propertyId: markPayment.propertyId,
        type: 'fixed',
        category: 'landlord_rent',
        amount: Math.round(paidAmt * 100),
        expenseDate: markForm.paidDate,
        description: `[AUTO:landlord_payment:${contract.id}:${markPayment.id}] ${markPayment.periodLabel} 房東租金`,
      });
      expenseSynced = true;
    } catch (e) {
      console.error(e);
      alert('已更新本機紀錄，但同步收支管理失敗，請稍後至收支管理手動新增。');
    } finally {
      setMarkSaving(false);
    }

    const next = payments.map((x) =>
      x.id === markPayment.id
        ? {
            ...x,
            status: 'paid' as const,
            paidDate: markForm.paidDate,
            paidAmount: Number(markForm.paidAmount) || 0,
            paymentMethod: markForm.paymentMethod,
            notes: markForm.notes || undefined,
            expenseSynced,
          }
        : x,
    );
    savePayments(next);
    setPayments(next);
    setMarkOpen(false);
    setMarkPayment(null);
  };

  const remainingMonths = (endYmd: string) => {
    const t = new Date();
    const [ey, em, ed] = endYmd.split('-').map(Number);
    const end = new Date(ey, em - 1, ed);
    const diff = end.getTime() - t.getTime();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24 * 30));
  };

  return (
    <PageShell>
      <div className="flex flex-col space-y-6">
        <PageHeader
          title="房東付款管理"
          description="房東租約與繳費排程僅存於本機，送出後可同步標記金額至收支管理。"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={filterPropertyId}
                onValueChange={setFilterPropertyId}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="選擇物業" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部物業</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" onClick={openNewContract} disabled={loadingProps}>
                <Plus className="mr-2 h-4 w-4" />
                新增合約
              </Button>
            </div>
          }
        />

        <Card className="border-amber-200/80 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5 text-amber-700" />
              付款提醒
            </CardTitle>
            <CardDescription>依本機排程與今日日期計算</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-medium text-red-800">逾期</p>
              {overdueList.length === 0 ? (
                <p className="text-sm text-muted-foreground">無逾期項目</p>
              ) : (
                <ul className="space-y-2">
                  {overdueList.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="font-medium">{p.propertyName}</span> · {p.periodLabel} ·{' '}
                        {formatCurrency(p.amount)}
                      </span>
                      <Button type="button" size="sm" variant="outline" onClick={() => openMarkPaid(p)}>
                        標記已繳
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-amber-900">即將到期（14 天內）</p>
              {upcomingList.length === 0 ? (
                <p className="text-sm text-muted-foreground">無即將到期項目</p>
              ) : (
                <ul className="space-y-2">
                  {upcomingList.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="font-medium">{p.propertyName}</span> · {p.periodLabel} ·{' '}
                        {formatCurrency(p.amount)}（{p.dueDate}）
                      </span>
                      <Button type="button" size="sm" variant="outline" onClick={() => openMarkPaid(p)}>
                        標記已繳
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-emerald-800">已繳（最近）</p>
              {paidRecentList.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚無已繳紀錄</p>
              ) : (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                  {paidRecentList.slice(0, 8).map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      {p.propertyName} · {p.periodLabel} · {formatCurrency(p.paidAmount ?? p.amount)} ·{' '}
                      {p.paidDate}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 text-lg font-semibold">物業合約</h2>
          {filteredContracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無合約，請新增。</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredContracts.map((c) => {
                const cy = new Date().getFullYear();
                const yrRow = c.yearlyRents.find((r) => r.year === cy);
                const monthly = yrRow?.monthlyRent ?? c.yearlyRents[0]?.monthlyRent ?? 0;
                const cycleLabel =
                  PAYMENT_CYCLE_OPTIONS.find((o) => o.value === c.paymentCycle)?.label ?? c.paymentCycle;
                return (
                  <Card key={c.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{c.propertyName}</CardTitle>
                      <CardDescription>
                        {c.landlordName} · {c.landlordPhone || '—'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p>
                        合約期間：{c.startDate} ～ {c.endDate}
                      </p>
                      <p>
                        押金：{c.depositMonths} 個月 · {formatCurrency(c.depositAmount)}
                        {c.depositPaid ? '（已付）' : '（未付）'}
                      </p>
                      <p>繳租週期：{cycleLabel}</p>
                      <p>
                        今年（{cy}）月租：{formatCurrency(monthly)}
                      </p>
                      <p>剩餘約 {remainingMonths(c.endDate)} 個月（概估）</p>
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => openEditContract(c)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          編輯合約
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setHistoryContractId((x) => (x === c.id ? null : c.id))
                          }
                        >
                          <ScrollText className="mr-1 h-3.5 w-3.5" />
                          查看付款歷史
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>付款歷史</CardTitle>
            <CardDescription>
              {historyContractId
                ? `篩選：${contracts.find((c) => c.id === historyContractId)?.propertyName ?? ''}`
                : '全部（可於合約卡片篩選單一合約）'}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>繳費日</TableHead>
                  <TableHead>物業</TableHead>
                  <TableHead>期數</TableHead>
                  <TableHead className="text-right">金額</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      無資料
                    </TableCell>
                  </TableRow>
                ) : (
                  historyRows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap">{p.dueDate}</TableCell>
                      <TableCell>{p.propertyName}</TableCell>
                      <TableCell>{p.periodLabel}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.amount)}</TableCell>
                      <TableCell>
                        {p.status === 'paid'
                          ? '已繳'
                          : p.status === 'overdue'
                            ? '逾期'
                            : '待繳'}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.status !== 'paid' ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => openMarkPaid(p)}>
                            標記已繳
                          </Button>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="text-xs text-amber-900">⚠ 房東合約資料僅儲存於本機瀏覽器</p>
      </div>

      <Dialog open={contractOpen} onOpenChange={setContractOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingContractId ? '編輯合約' : '新增合約'}</DialogTitle>
            <DialogDescription>儲存後會依週期自動產生繳費排程</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>物業</Label>
              <Select
                value={contractForm.propertyId}
                onValueChange={(v) =>
                  setContractForm((f) => ({ ...f, propertyId: v }))
                }
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>合約開始日</Label>
                <Input
                  type="date"
                  value={contractForm.startDate}
                  onChange={(e) => {
                    const startDate = e.target.value;
                    setContractForm((f) => ({
                      ...f,
                      startDate,
                      yearlyRents: buildYearlyRents(startDate, f.endDate, f.yearlyRents),
                    }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>合約結束日</Label>
                <Input
                  type="date"
                  value={contractForm.endDate}
                  onChange={(e) => {
                    const endDate = e.target.value;
                    setContractForm((f) => ({
                      ...f,
                      endDate,
                      yearlyRents: buildYearlyRents(f.startDate, endDate, f.yearlyRents),
                    }));
                  }}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>房東姓名</Label>
                <Input
                  value={contractForm.landlordName}
                  onChange={(e) =>
                    setContractForm((f) => ({ ...f, landlordName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>房東電話</Label>
                <Input
                  value={contractForm.landlordPhone}
                  onChange={(e) =>
                    setContractForm((f) => ({ ...f, landlordPhone: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>押金月數</Label>
                <Input
                  type="number"
                  min={0}
                  value={contractForm.depositMonths}
                  onChange={(e) =>
                    setContractForm((f) => ({
                      ...f,
                      depositMonths: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>押金金額（元）</Label>
                <Input
                  type="number"
                  min={0}
                  value={contractForm.depositAmount}
                  onChange={(e) =>
                    setContractForm((f) => ({
                      ...f,
                      depositAmount: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={contractForm.depositPaid}
                    onChange={(e) =>
                      setContractForm((f) => ({ ...f, depositPaid: e.target.checked }))
                    }
                  />
                  押金已付
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>繳租週期</Label>
              <Select
                value={contractForm.paymentCycle}
                onValueChange={(v) =>
                  setContractForm((f) => ({
                    ...f,
                    paymentCycle: v as LandlordContract['paymentCycle'],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_CYCLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>年度租金設定（元／月）</Label>
              <div className="space-y-2 rounded-md border p-3">
                {contractForm.yearlyRents.map((row, idx) => (
                  <div key={row.year} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 text-sm text-muted-foreground">
                      第 {idx + 1} 年（{row.year}）
                    </span>
                    <Input
                      type="number"
                      min={0}
                      className="flex-1"
                      value={row.monthlyRent}
                      onChange={(e) => {
                        const v = Number(e.target.value) || 0;
                        setContractForm((f) => ({
                          ...f,
                          yearlyRents: f.yearlyRents.map((r, i) =>
                            i === idx ? { ...r, monthlyRent: v } : r,
                          ),
                        }));
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setContractOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={saveContract}>
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={markOpen} onOpenChange={setMarkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>標記已繳</DialogTitle>
            <DialogDescription>
              {markPayment
                ? `${markPayment.propertyName} · ${markPayment.periodLabel}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>繳費日期</Label>
              <Input
                type="date"
                value={markForm.paidDate}
                onChange={(e) => setMarkForm((f) => ({ ...f, paidDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>繳費金額（元）</Label>
              <Input
                type="number"
                min={0}
                step="1"
                value={markForm.paidAmount}
                onChange={(e) =>
                  setMarkForm((f) => ({ ...f, paidAmount: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>繳費方式</Label>
              <Select
                value={markForm.paymentMethod}
                onValueChange={(v) => setMarkForm((f) => ({ ...f, paymentMethod: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="現金">現金</SelectItem>
                  <SelectItem value="轉帳">轉帳</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>備註</Label>
              <Input
                value={markForm.notes}
                onChange={(e) => setMarkForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMarkOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={() => void submitMarkPaid()} disabled={markSaving}>
              {markSaving ? '處理中…' : '確認'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
