'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Building2, CalendarClock, Home, Percent, Wallet } from 'lucide-react';
import { formatCents, formatCurrency } from '@/lib/utils';
import { PageShell } from '@/components/app-shell/page-shell';
import { PageHeader } from '@/components/app-shell/page-header';
import { api } from '@/lib/api-client';

interface SummaryApi {
  month: string;
  totalProperties: number;
  totalRooms: number;
  occupiedRooms: number;
  vacantRooms: number;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
}

interface PaymentRow {
  id: string;
  roomId: string;
  tenantId: string | null;
  lineType: string;
  paymentMonth: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  roomNumber?: string;
  tenantName?: string;
}

interface ExtraIncome {
  id: string;
  propertyId: string;
  amount: number;
  incomeDate: string;
}

interface ExpenseRow {
  id: string;
  propertyId: string;
  category: string;
  amount: number;
  expenseDate: string;
}

function currentMonthYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthStartEnd(ym: string): { start: Date; end: Date } {
  const parts = ym.split('-').map(Number);
  const y = parts[0] ?? new Date().getFullYear();
  const m = parts[1] ?? 1;
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return { start, end };
}

function isInMonth(iso: string, ym: string): boolean {
  const d = new Date(iso);
  const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return s === ym;
}

/** 帳單月份當月 5 號後仍未結清 → 逾期天數（自第 6 天起算） */
function overdueDaysFromBillMonth(paymentMonth: string): number {
  const parts = paymentMonth.split('-').map(Number);
  const y = parts[0] ?? new Date().getFullYear();
  const m = parts[1] ?? 1;
  const fifth = new Date(y, m - 1, 5, 23, 59, 59, 999);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueEnd = new Date(fifth);
  if (today <= dueEnd) return 0;
  const start = new Date(y, m - 1, 6, 0, 0, 0, 0);
  return Math.max(0, Math.ceil((today.getTime() - start.getTime()) / 86400000));
}

const LINE_LABEL: Record<string, string> = {
  rent: '租金',
  electricity: '電費',
  deposit: '押金',
};

function todayYmdLocal(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysYmdLocal(ymd: string, days: number): string {
  const parts = ymd.split('-').map(Number);
  const y = parts[0] ?? 0;
  const mo = parts[1] ?? 1;
  const da = parts[2] ?? 1;
  const dt = new Date(y, mo - 1, da);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

interface ContractExpiryRow {
  roomNumber: string;
  tenantName: string;
  endDate: string;
  daysLeft: number;
}

interface LandlordPayRow {
  propertyName: string;
  periodLabel: string;
  /** landlord_payments 金額為「元」 */
  amountYuan: number;
  days: number;
}

export default function DashboardPage() {
  const [summaryMonth, setSummaryMonth] = useState(currentMonthYm);
  const [summary, setSummary] = useState<SummaryApi | null>(null);
  const [incomeRent, setIncomeRent] = useState(0);
  const [incomeElec, setIncomeElec] = useState(0);
  const [incomeOther, setIncomeOther] = useState(0);
  const [expLandlord, setExpLandlord] = useState(0);
  const [expTaipower, setExpTaipower] = useState(0);
  const [expOther, setExpOther] = useState(0);
  const [pending, setPending] = useState<PaymentRow[]>([]);
  const [contractExpiry, setContractExpiry] = useState<ContractExpiryRow[]>([]);
  const [landlordOverdueRows, setLandlordOverdueRows] = useState<LandlordPayRow[]>([]);
  const [landlordSoonRows, setLandlordSoonRows] = useState<LandlordPayRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const s = await api.get<SummaryApi>(`/api/reports/summary?month=${encodeURIComponent(summaryMonth)}`);
      setSummary(s);

      const paymentsMonth = await api.get<PaymentRow[]>(
        `/api/payments?month=${encodeURIComponent(summaryMonth)}`,
      );
      let rent = 0;
      let elec = 0;
      for (const p of paymentsMonth) {
        const amt = Number(p.totalAmount ?? 0);
        if (p.lineType === 'rent') rent += amt;
        else if (p.lineType === 'electricity') elec += amt;
      }

      const incomesAll = await api.get<ExtraIncome[]>('/api/incomes');
      const extra = incomesAll
        .filter((i) => isInMonth(typeof i.incomeDate === 'string' ? i.incomeDate : String(i.incomeDate), summaryMonth))
        .reduce((sum, i) => sum + Number(i.amount ?? 0), 0);

      setIncomeRent(rent);
      setIncomeElec(elec);
      setIncomeOther(extra);

      const expensesAll = await api.get<ExpenseRow[]>('/api/expenses');
      const { start, end } = monthStartEnd(summaryMonth);
      const monthExp = expensesAll.filter((e) => {
        const d = new Date(e.expenseDate);
        return d >= start && d <= end;
      });

      let eland = 0;
      let etai = 0;
      let eoth = 0;
      for (const e of monthExp) {
        const cat = String(e.category);
        const amt = Number(e.amount ?? 0);
        if (
          cat === 'rent' ||
          cat === '房東租金' ||
          cat === 'landlord_rent'
        ) {
          eland += amt;
        } else if (
          cat === 'utilities' ||
          cat === '台電電費' ||
          cat === 'utility_electric'
        ) {
          etai += amt;
        } else {
          eoth += amt;
        }
      }
      setExpLandlord(eland);
      setExpTaipower(etai);
      setExpOther(eoth);

      const pend = await api.get<PaymentRow[]>('/api/payments?status=pending');
      const open = pend.filter((p) => Number(p.paidAmount ?? 0) < Number(p.totalAmount ?? 0));
      setPending(open);

      const [tenantList, roomsList] = await Promise.all([
        api
          .get<
            Array<{
              id: string;
              roomId: string;
              nameZh?: string;
              nameVi?: string;
              expectedCheckoutDate?: string;
            }>
          >('/api/tenants?status=active')
          .catch(() => []),
        api.get<Array<{ id: string; roomNumber: string }>>('/api/rooms').catch(() => []),
      ]);

      const roomMap = new Map((Array.isArray(roomsList) ? roomsList : []).map((r) => [r.id, r.roomNumber]));
      const today0 = new Date();
      today0.setHours(0, 0, 0, 0);
      const end90 = new Date(today0);
      end90.setDate(end90.getDate() + 90);

      const expRows: ContractExpiryRow[] = [];
      for (const t of Array.isArray(tenantList) ? tenantList : []) {
        const ex = t.expectedCheckoutDate;
        if (!ex) continue;
        const d = new Date(ex);
        if (Number.isNaN(d.getTime())) continue;
        d.setHours(0, 0, 0, 0);
        if (d < today0 || d > end90) continue;
        const daysLeft = Math.ceil((d.getTime() - today0.getTime()) / 86400000);
        expRows.push({
          roomNumber: roomMap.get(t.roomId) ?? '—',
          tenantName: t.nameZh || t.nameVi || '—',
          endDate: typeof ex === 'string' ? ex : String(ex),
          daysLeft,
        });
      }
      expRows.sort((a, b) => a.daysLeft - b.daysLeft);
      setContractExpiry(expRows);

      const todayYmd = todayYmdLocal();
      const in14Ymd = addDaysYmdLocal(todayYmd, 14);
      const overdueLp: LandlordPayRow[] = [];
      const soonLp: LandlordPayRow[] = [];
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('landlord_payments');
          const arr = raw ? JSON.parse(raw) : [];
          if (Array.isArray(arr)) {
            for (const p of arr) {
              if (p.status === 'paid') continue;
              const due = String(p.dueDate ?? '');
              const amt = Number(p.amount ?? 0);
              const prop = String(p.propertyName ?? '—');
              const pl = String(p.periodLabel ?? '—');
              if (due && due < todayYmd) {
                const dueD = new Date(due + 'T12:00:00');
                const daysOver = Math.max(
                  0,
                  Math.ceil((today0.getTime() - dueD.getTime()) / 86400000),
                );
                overdueLp.push({
                  propertyName: prop,
                  periodLabel: pl,
                  amountYuan: amt,
                  days: daysOver,
                });
              } else if (due && due >= todayYmd && due <= in14Ymd) {
                const dueD = new Date(due + 'T12:00:00');
                const daysUntil = Math.max(
                  0,
                  Math.ceil((dueD.getTime() - today0.getTime()) / 86400000),
                );
                soonLp.push({
                  propertyName: prop,
                  periodLabel: pl,
                  amountYuan: amt,
                  days: daysUntil,
                });
              }
            }
          }
        } catch {
          /* ignore */
        }
      }
      setLandlordOverdueRows(overdueLp);
      setLandlordSoonRows(soonLp);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : '載入儀表板失敗');
      setSummary(null);
      setPending([]);
      setContractExpiry([]);
      setLandlordOverdueRows([]);
      setLandlordSoonRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [summaryMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalRooms = summary?.totalRooms ?? 0;
  const occ = summary?.occupiedRooms ?? 0;
  const occupancyPct = totalRooms > 0 ? Math.round((occ / totalRooms) * 1000) / 10 : 0;
  const net = summary ? summary.totalIncome - summary.totalExpense : 0;
  const overdueBillCount = pending.filter((p) => overdueDaysFromBillMonth(p.paymentMonth) > 0).length;

  return (
    <PageShell>
      <PageHeader
        title="儀表板"
        description="本月總覽、收支明細與待收帳單（資料來自後端 API）"
        actions={
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">月份</span>
              <Input
                type="month"
                className="w-[9rem]"
                value={summaryMonth}
                onChange={(e) => setSummaryMonth(e.target.value)}
              />
            </div>
            <Button type="button" variant="outline" onClick={() => void load()}>
              重新整理
            </Button>
          </>
        }
      />

      {error && (
        <Card className="border-red-200 mb-4">
          <CardContent className="pt-6 text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <Button type="button" variant="outline" className="mt-3" onClick={() => void load()}>
              重試
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">總物業數</CardTitle>
            <Building2 className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{summary?.totalProperties ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">總房間數</CardTitle>
            <Home className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{summary?.totalRooms ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">空房數量</CardTitle>
            <Home className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{summary?.vacantRooms ?? '—'}</div>
            <p className="text-xs text-muted-foreground mt-1">空房／待租</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">入住率</CardTitle>
            <Percent className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {summary ? `${occupancyPct}%` : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary ? `${occ} / ${totalRooms} 間已入住` : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">本月淨利</CardTitle>
            <Wallet className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {summary ? formatCents(net) : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">總收入 − 總支出</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>本月收入明細</CardTitle>
            <CardDescription>依帳單類型與補充收入彙總（分）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>租金</span>
              <span className="font-medium">{formatCents(incomeRent)}</span>
            </div>
            <div className="flex justify-between">
              <span>電費</span>
              <span className="font-medium">{formatCents(incomeElec)}</span>
            </div>
            <div className="flex justify-between">
              <span>其他（補充收入）</span>
              <span className="font-medium">{formatCents(incomeOther)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>本月支出明細</CardTitle>
            <CardDescription>依支出類別彙總（分）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>房東租金</span>
              <span className="font-medium">{formatCents(expLandlord)}</span>
            </div>
            <div className="flex justify-between">
              <span>台電電費</span>
              <span className="font-medium">{formatCents(expTaipower)}</span>
            </div>
            <div className="flex justify-between">
              <span>其他</span>
              <span className="font-medium">{formatCents(expOther)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>待收帳單提醒</CardTitle>
            {overdueBillCount > 0 ? (
              <Badge variant="destructive" className="text-xs">
                逾期 {overdueBillCount} 筆
              </Badge>
            ) : null}
          </div>
          <CardDescription>狀態為待收且尚有餘額的帳單；逾過當月 5 號以紅色標示</CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-muted-foreground text-sm">目前無待收帳單</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-2">房號</th>
                    <th className="py-2 pr-2">租客</th>
                    <th className="py-2 pr-2">類型</th>
                    <th className="py-2 pr-2">金額</th>
                    <th className="py-2 pr-2">帳單月份</th>
                    <th className="py-2">逾期天數</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((p) => {
                    const od = overdueDaysFromBillMonth(p.paymentMonth);
                    const overdue = od > 0;
                    return (
                      <tr key={p.id} className={`border-b border-slate-100 ${overdue ? 'text-red-600' : ''}`}>
                        <td className="py-2 pr-2 font-medium">{p.roomNumber ?? '—'}</td>
                        <td className="py-2 pr-2">{p.tenantName ?? '—'}</td>
                        <td className="py-2 pr-2">{LINE_LABEL[p.lineType] ?? p.lineType}</td>
                        <td className="py-2 pr-2">{formatCents(Number(p.totalAmount ?? 0))}</td>
                        <td className="py-2 pr-2">{p.paymentMonth}</td>
                        <td className="py-2">
                          {overdue ? (
                            <Badge variant="destructive">{od} 天</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-slate-600" />
            合約到期提醒（90 天內）
          </CardTitle>
          <CardDescription>預計退租日介於今天至未來 90 天之入住中租客</CardDescription>
        </CardHeader>
        <CardContent>
          {contractExpiry.length === 0 ? (
            <p className="text-sm text-muted-foreground">目前無即將到期合約</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-2">房號</th>
                    <th className="py-2 pr-2">租客</th>
                    <th className="py-2 pr-2">到期日</th>
                    <th className="py-2">剩餘天數</th>
                  </tr>
                </thead>
                <tbody>
                  {contractExpiry.map((r, idx) => {
                    const urgent = r.daysLeft <= 30;
                    const soon = r.daysLeft > 30 && r.daysLeft <= 90;
                    return (
                      <tr
                        key={`${r.roomNumber}-${idx}`}
                        className={`border-b border-slate-100 ${urgent ? 'text-red-600' : soon ? 'text-amber-800' : ''}`}
                      >
                        <td className="py-2 pr-2 font-medium">{r.roomNumber}</td>
                        <td className="py-2 pr-2">{r.tenantName}</td>
                        <td className="py-2 pr-2">{r.endDate}</td>
                        <td className="py-2">{r.daysLeft} 天</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            房東付款提醒（本機）
          </CardTitle>
          <CardDescription>來自 localStorage landlord_payments：逾期與 14 天內到期</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {landlordOverdueRows.length === 0 && landlordSoonRows.length === 0 ? (
            <p className="text-muted-foreground">尚無房東付款待辦</p>
          ) : (
            <>
              {landlordOverdueRows.length > 0 && (
                <div>
                  <p className="font-medium text-red-700 mb-2">逾期</p>
                  <ul className="space-y-1">
                    {landlordOverdueRows.map((r, i) => (
                      <li key={`o-${i}`} className="text-red-700">
                        物業 {r.propertyName} · {r.periodLabel} · {formatCurrency(r.amountYuan)} · 逾期{' '}
                        {r.days} 天
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {landlordSoonRows.length > 0 && (
                <div>
                  <p className="font-medium text-amber-800 mb-2">即將到期（14 天內）</p>
                  <ul className="space-y-1">
                    {landlordSoonRows.map((r, i) => (
                      <li key={`s-${i}`} className="text-amber-900">
                        物業 {r.propertyName} · {r.periodLabel} · {formatCurrency(r.amountYuan)} · {r.days}{' '}
                        天後到期
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="fixed inset-0 bg-white/60 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto" />
            <p className="mt-3 text-sm text-muted-foreground">載入中…</p>
          </div>
        </div>
      )}
    </PageShell>
  );
}
