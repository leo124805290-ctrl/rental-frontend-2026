'use client';

import { Suspense, useMemo, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Home, Users, CheckCircle, History, Calculator } from 'lucide-react';
import { formatCents, formatCurrency, formatDate } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { PageHeader } from '@/components/app-shell/page-header';
import { PageShell } from '@/components/app-shell/page-shell';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { filterOperableProperties, type PropertyStatusLike } from '@/lib/property-status';

interface TenantApi {
  id: string;
  roomId: string;
  propertyId: string;
  nameZh?: string;
  nameVi?: string;
  phone?: string;
  checkInDate?: string;
  expectedCheckoutDate?: string;
  status?: string;
  createdAt?: string;
}

interface RoomApi {
  id: string;
  propertyId: string;
  roomNumber: string;
  floor?: number;
  status?: string;
  monthlyRent?: number;
  depositAmount?: number;
  electricityRate?: number; // 分
  previousMeter?: number;
  currentMeter?: number;
}

interface PropertyApi {
  id: string;
  name: string;
  status?: string;
}

interface DepositApiRow {
  id: string;
  amount: number;
  type: string;
  description?: string | null;
}

/** 與收款明細 /api/payments 帳單列一致（金額為分） */
interface PaymentLineApi {
  id: string;
  roomId?: string;
  tenantId?: string | null;
  lineType?: string;
  paymentMonth?: string;
  totalAmount?: number;
  paidAmount?: number;
  /** 若有則帶入；未回傳可省略 */
  paymentStatus?: string | undefined;
}

function lineTypeLabel(lineType: string | undefined): string {
  switch (lineType) {
    case 'deposit':
      return '押金';
    case 'rent':
      return '租金';
    case 'electricity':
      return '電費';
    default:
      return lineType || '帳單';
  }
}

function restLineCents(p: PaymentLineApi): number {
  const t = Number(p.totalAmount ?? 0);
  const paid = Number(p.paidAmount ?? 0);
  return Math.max(0, t - paid);
}

function normalizePaymentLine(raw: Record<string, unknown>): PaymentLineApi {
  const ps = raw['paymentStatus'] ?? raw['payment_status'];
  const base: PaymentLineApi = {
    id: String(raw['id'] ?? ''),
    lineType: String(raw['lineType'] ?? raw['line_type'] ?? ''),
    paymentMonth: String(raw['paymentMonth'] ?? raw['payment_month'] ?? ''),
    totalAmount: Number(raw['totalAmount'] ?? raw['total_amount'] ?? 0),
    paidAmount: Number(raw['paidAmount'] ?? raw['paid_amount'] ?? 0),
  };
  if (ps != null) base.paymentStatus = String(ps);
  return base;
}

function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 與 GET /api/checkout/settlements 回傳列一致（金額為分） */
interface CheckoutSettlementRow {
  id: string;
  tenantId: string;
  roomId: string;
  checkoutDate: string;
  daysStayed: number;
  dailyRent: number;
  rentDue: number;
  electricityFee: number;
  otherDeductions: number;
  totalDue: number;
  prepaidAmount: number;
  depositAmount: number;
  refundAmount: number;
  settlementStatus: string;
  notes?: string | null;
  createdAt?: string;
}

function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const [tenants, setTenants] = useState<TenantApi[]>([]);
  const [rooms, setRooms] = useState<Record<string, RoomApi>>({});
  const [properties, setProperties] = useState<Record<string, PropertyApi>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** 空字串表示選「全部租客」，不進行退租表單 */
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [checkoutDateYmd, setCheckoutDateYmd] = useState<string>(() => localTodayYmd());
  const [finalMeter, setFinalMeter] = useState<string>('');
  const [lastReading, setLastReading] = useState<number | null>(null);
  const [otherDeductionsYuan, setOtherDeductionsYuan] = useState<string>('0');
  const [settlements, setSettlements] = useState<CheckoutSettlementRow[]>([]);
  const [settlementNotes, setSettlementNotes] = useState<string>('');
  const [showSettlementDialog, setShowSettlementDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tenantDeposits, setTenantDeposits] = useState<DepositApiRow[]>([]);
  const [prepaidSumCents, setPrepaidSumCents] = useState<number | null>(null);
  const [financialLoading, setFinancialLoading] = useState(false);
  const [paymentLines, setPaymentLines] = useState<PaymentLineApi[]>([]);

  // 載入租客 / 房間 / 物業
  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    setSelectedTenantId('');

    try {
      const [tenantList, roomList, propertyList, settList] = await Promise.all([
        api.get<any[]>('/api/tenants'),
        api.get<any[]>('/api/rooms'),
        api.get<any[]>('/api/properties'),
        api.get<any[]>('/api/checkout/settlements').catch(() => []),
      ]);
      setSettlements(Array.isArray(settList) ? (settList as CheckoutSettlementRow[]) : []);

      const roomsMap: Record<string, RoomApi> = {};
      for (const r of roomList) {
        const base: RoomApi = {
          id: String(r.id),
          propertyId: String(r.propertyId ?? r.property_id ?? ''),
          roomNumber: String(r.roomNumber ?? r.room_number ?? ''),
        };

        roomsMap[String(r.id)] = {
          ...base,
          ...(r.floor != null ? { floor: Number(r.floor) } : {}),
          ...(r.status != null ? { status: String(r.status) } : {}),
          ...(r.monthlyRent != null
            ? { monthlyRent: Number(r.monthlyRent) }
            : (r.monthly_rent != null ? { monthlyRent: Number(r.monthly_rent) } : {})),
          ...(r.depositAmount != null
            ? { depositAmount: Number(r.depositAmount) }
            : (r.deposit != null ? { depositAmount: Number(r.deposit) } : {})),
          ...(r.electricityRate != null ? { electricityRate: Number(r.electricityRate) } : {}),
          ...(r.previousMeter != null
            ? { previousMeter: Number(r.previousMeter) }
            : (r.previous_meter != null ? { previousMeter: Number(r.previous_meter) } : {})),
          ...(r.currentMeter != null
            ? { currentMeter: Number(r.currentMeter) }
            : (r.current_meter != null ? { currentMeter: Number(r.current_meter) } : {})),
        };
      }

      const operablePropertyIds = new Set(
        filterOperableProperties(
          propertyList.map((p) => ({
            status: (p as PropertyStatusLike).status,
            id: String(p.id ?? ''),
          })),
        ).map((p) => p.id),
      );

      const propsMap: Record<string, PropertyApi> = {};
      for (const p of propertyList) {
        propsMap[String(p.id)] = {
          id: String(p.id),
          name: String(p.name || ''),
          ...(p.status != null ? { status: String(p.status) } : {}),
        };
      }

      const normalizedTenants: TenantApi[] = tenantList
        .map((t) => ({
          id: String(t.id),
          roomId: String(t.roomId ?? t.room_id ?? ''),
          propertyId: String(t.propertyId ?? t.property_id ?? ''),
          nameZh: t.nameZh != null ? String(t.nameZh) : (t.name != null ? String(t.name) : ''),
          nameVi: t.nameVi != null ? String(t.nameVi) : '',
          phone: t.phone != null ? String(t.phone) : '',
          checkInDate: String(t.checkInDate ?? t.contract_start ?? t.createdAt ?? new Date().toISOString()),
          ...(t.expectedCheckoutDate
            ? { expectedCheckoutDate: String(t.expectedCheckoutDate) }
            : {}),
          status: String(t.status ?? (t.is_active === false ? 'checked_out' : 'active')),
          ...(t.createdAt ? { createdAt: String(t.createdAt) } : {}),
        }))
        .filter((tenant) => operablePropertyIds.has(tenant.propertyId));

      setTenants(normalizedTenants);
      setRooms(roomsMap);
      setProperties(propsMap);
    } catch (error) {
      setError('載入資料失敗');
      console.error('載入錯誤:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const activeTenants = useMemo(
    () => tenants.filter((t) => t.status !== 'checked_out'),
    [tenants],
  );

  /** 從房間管理／物業詳情 ?roomId= 或 ?tenantId= 帶入租客 */
  useEffect(() => {
    if (isLoading) return;
    const roomId = searchParams.get('roomId')?.trim();
    const tenantIdParam = searchParams.get('tenantId')?.trim();
    if (tenantIdParam) {
      const t = activeTenants.find((x) => x.id === tenantIdParam);
      if (t) {
        setSelectedTenantId(tenantIdParam);
        return;
      }
    }
    if (roomId) {
      const t = activeTenants.find((x) => x.roomId === roomId);
      if (t) setSelectedTenantId(t.id);
    }
  }, [isLoading, searchParams, activeTenants]);

  const tenantById = useMemo(() => {
    const m = new Map<string, TenantApi>();
    for (const t of tenants) m.set(t.id, t);
    return m;
  }, [tenants]);

  const selectedTenant = useMemo(
    () => tenants.find((t) => t.id === selectedTenantId) ?? null,
    [tenants, selectedTenantId]
  );

  const selectedRoom = useMemo(() => {
    if (!selectedTenant?.roomId) return null;
    return rooms[selectedTenant.roomId] ?? null;
  }, [rooms, selectedTenant]);

  const selectedPropertyName = useMemo(() => {
    if (!selectedTenant?.propertyId) return '';
    return properties[selectedTenant.propertyId]?.name || '';
  }, [properties, selectedTenant]);

  useEffect(() => {
    if (!selectedTenant?.roomId) {
      setLastReading(null);
      return;
    }
    (async () => {
      try {
        const list = await api.get<
          Array<{ readingValue: number; readingDate: string }>
        >(`/api/meter-readings?roomId=${encodeURIComponent(selectedTenant.roomId)}`);
        const sorted = [...(Array.isArray(list) ? list : [])].sort(
          (a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime(),
        );
        setLastReading(sorted[0]?.readingValue ?? null);
      } catch {
        setLastReading(null);
      }
    })();
  }, [selectedTenant?.roomId]);

  useEffect(() => {
    if (!selectedTenantId || !selectedTenant?.roomId) {
      setTenantDeposits([]);
      setPrepaidSumCents(null);
      setPaymentLines([]);
      return;
    }
    let cancelled = false;
    setFinancialLoading(true);
    void (async () => {
      try {
        const [depList, payList] = await Promise.all([
          api.get<DepositApiRow[]>(
            `/api/deposits?tenantId=${encodeURIComponent(selectedTenantId)}`,
          ),
          api.get<PaymentLineApi[]>(
            `/api/payments?tenantId=${encodeURIComponent(selectedTenantId)}&roomId=${encodeURIComponent(selectedTenant.roomId)}`,
          ),
        ]);
        if (cancelled) return;
        setTenantDeposits(Array.isArray(depList) ? depList : []);
        const rows = (Array.isArray(payList) ? payList : []).map((r) =>
          normalizePaymentLine(r as unknown as Record<string, unknown>),
        );
        setPaymentLines(rows);
        const sum = rows.reduce((s, p) => s + Number(p.paidAmount ?? 0), 0);
        setPrepaidSumCents(sum);
      } catch {
        if (!cancelled) {
          setTenantDeposits([]);
          setPrepaidSumCents(null);
          setPaymentLines([]);
        }
      } finally {
        if (!cancelled) setFinancialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTenantId, selectedTenant?.roomId]);

  const depositSummary = useMemo(() => {
    const rows = tenantDeposits;
    const sumType = (t: string) =>
      rows.filter((d) => d.type === t).reduce((s, d) => s + Number(d.amount ?? 0), 0);
    return {
      /** 與後端 POST /checkout/complete 納入結算之押金一致：僅加總「收取」 */
      collectedCents: sumType('收取'),
      deductedCents: sumType('扣款'),
      refundedCents: sumType('退還'),
    };
  }, [tenantDeposits]);

  /** 尚未繳清之帳單列（應收 − 已收 > 0） */
  const unpaidBreakdown = useMemo(() => {
    const lines = paymentLines.filter((p) => restLineCents(p) > 0);
    const total = lines.reduce((s, p) => s + restLineCents(p), 0);
    return { lines, total };
  }, [paymentLines]);

  const meterPreview = useMemo(() => {
    const prev = lastReading ?? 0;
    const trimmed = finalMeter.trim();
    if (trimmed === '') return null;
    const finalVal = Number(trimmed);
    if (Number.isNaN(finalVal) || finalVal < 0) return null;
    const diff = finalVal - prev;
    return diff >= 0 ? { prev, finalVal, usage: diff } : null;
  }, [lastReading, finalMeter]);

  const electricityRateYuan = useMemo(() => {
    if (!selectedRoom) return 6;
    const rateFen = Number(selectedRoom.electricityRate ?? 600);
    return rateFen > 0 ? rateFen / 100 : 6;
  }, [selectedRoom]);

  const electricityFeePreview = useMemo(() => {
    if (!meterPreview) return null;
    return Math.round(meterPreview.usage * electricityRateYuan);
  }, [meterPreview, electricityRateYuan]);

  const openConfirm = () => {
    if (!selectedTenant || !selectedRoom) {
      alert('請先選擇租客');
      return;
    }
    const trimmed = finalMeter.trim();
    if (trimmed === '') {
      alert('請輸入本期（退租）電表度數');
      return;
    }
    const finalVal = Number(trimmed);
    if (Number.isNaN(finalVal) || finalVal < 0) {
      alert('請輸入有效非負電表度數');
      return;
    }
    if (unpaidBreakdown.total > 0) {
      const msg = `尚有未繳清費用共 ${formatCents(unpaidBreakdown.total)}（收款明細中仍為「待收」之帳單）。建議先至「收款明細」完成收款再退租。\n\n仍要繼續開啟退租確認？`;
      if (!confirm(msg)) return;
    }
    setShowSettlementDialog(true);
  };

  const handleConfirmCheckout = async () => {
    if (!selectedTenant || !selectedRoom) return;
    const trimmed = finalMeter.trim();
    if (trimmed === '') return;
    const finalVal = Number(trimmed);
    if (Number.isNaN(finalVal) || finalVal < 0) return;

    try {
      setSubmitting(true);
      setError(null);

      await api.post('/api/checkout/complete', {
        tenantId: selectedTenant.id,
        roomId: selectedRoom.id,
        checkoutDate: checkoutDateYmd,
        finalMeterReading: finalVal,
        otherDeductions: parseFloat(otherDeductionsYuan) || 0,
        notes: settlementNotes || undefined,
      });

      setShowSettlementDialog(false);
      setSelectedTenantId('');
      setCheckoutDateYmd(localTodayYmd());
      setFinalMeter('');
      setOtherDeductionsYuan('0');
      setSettlementNotes('');
      await loadData();
      alert('退租完成');
    } catch (err) {
      console.error('退租失敗', err);
      alert('退租失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <PageShell>
        <Card>
          <CardHeader>
            <CardTitle>退租結算管理</CardTitle>
            <CardDescription>載入中...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              正在載入資料
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex flex-col space-y-6">
        <PageHeader
          title="退租結算管理"
          description="處理租客退租：必填退租電表度數、可填其他扣款；送出後寫入結算單並清空房間。從房間管理帶入時會自動選定該房租客。"
          actions={
            <Button variant="outline" onClick={() => void loadData()}>
              <History className="mr-2 h-4 w-4" />
              重新整理
            </Button>
          }
        />

        {selectedTenant && selectedRoom && unpaidBreakdown.total > 0 && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
              <div className="min-w-0 flex-1 space-y-2 text-sm text-amber-950">
                <p className="font-semibold">
                  尚有未繳清費用共 {formatCents(unpaidBreakdown.total)}，請確認是否已收款
                </p>
                <ul className="list-inside list-disc space-y-1">
                  {unpaidBreakdown.lines.map((p) => (
                    <li key={p.id}>
                      {lineTypeLabel(p.lineType)}（{p.paymentMonth ?? '—'}）待收{' '}
                      {formatCents(restLineCents(p))}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-900/90">
                  建議先至「收款明細」完成待收款項，再辦理退租，以免漏收。
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 左側：退租結算表單 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 租客選擇 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  選擇退租租客
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tenant">租客</Label>
                    <Select
                      value={selectedTenantId === '' ? '__all__' : selectedTenantId}
                      onValueChange={(v) => setSelectedTenantId(v === '__all__' ? '' : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選擇要退租的租客" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">全部（請先選定租客再填寫退租資料）</SelectItem>
                        {activeTenants.map((t) => {
                          const room = rooms[t.roomId];
                          const label = `${t.nameZh || t.nameVi || '未命名'}（${room?.roomNumber || '—'}）`;
                          return (
                            <SelectItem key={t.id} value={t.id}>
                              {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedTenantId === '' && activeTenants.length > 0 && (
                    <div className="rounded-md border border-dashed border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                      已選「全部」：請從下拉選單指定<strong>一位租客</strong>以填寫退租日、電表與送出結算。
                    </div>
                  )}

                  {selectedTenant && selectedRoom && (
                    <>
                      <div className="rounded-md bg-muted p-4">
                        <h3 className="font-medium mb-2">租客資訊</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>姓名：{selectedTenant.nameZh || selectedTenant.nameVi || '—'}</div>
                          <div>電話：{selectedTenant.phone || '—'}</div>
                          <div>房號：{selectedRoom.roomNumber}</div>
                          <div>物業：{selectedPropertyName || '—'}</div>
                          <div>入住日期：{formatDate(selectedTenant.checkInDate || '')}</div>
                          <div>月租金：{formatCurrency(Number(selectedRoom.monthlyRent || 0))}</div>
                          <div>房間約定押金：{formatCurrency(Number(selectedRoom.depositAmount ?? 0))}</div>
                          <div>
                            已入帳押金（收取紀錄合計）：
                            {financialLoading
                              ? '載入中…'
                              : formatCents(depositSummary.collectedCents)}
                          </div>
                          <div className="col-span-2 text-xs text-muted-foreground">
                            結算時後端僅將「收取」類押金加總；若有「扣款／退還」請以紀錄為準。
                            {depositSummary.deductedCents > 0 || depositSummary.refundedCents > 0
                              ? ` 扣款 ${formatCents(depositSummary.deductedCents)}、已退還 ${formatCents(depositSummary.refundedCents)}。`
                              : ''}
                          </div>
                          <div>
                            已繳款合計（本房＋本租客）：
                            {financialLoading ? '載入中…' : prepaidSumCents != null ? formatCents(prepaidSumCents) : '—'}
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="space-y-2">
                            <Label htmlFor="checkout-date">退租日期</Label>
                            <Input
                              id="checkout-date"
                              type="date"
                              value={checkoutDateYmd}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v) setCheckoutDateYmd(v);
                              }}
                              className="block w-full"
                            />
                            <p className="text-xs text-muted-foreground">
                              以本地日曆日送出（YYYY-MM-DD），避免時區造成日期錯一天
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="final-meter">退租電表度數</Label>
                            <Input
                              id="final-meter"
                              type="number"
                              min={0}
                              step="1"
                              value={finalMeter}
                              onChange={(e) => setFinalMeter(e.target.value)}
                              placeholder="例如：1250 或 0"
                            />
                            <p className="text-xs text-muted-foreground">
                              上期（最近抄表）：{lastReading != null ? String(lastReading) : '—'}
                              {meterPreview
                                ? `，用量 ${meterPreview.usage} 度，預估電費 ${formatCurrency(electricityFeePreview || 0)}`
                                : ''}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="other-deductions">其他扣款（元）</Label>
                            <Input
                              id="other-deductions"
                              type="number"
                              min={0}
                              step="0.01"
                              value={otherDeductionsYuan}
                              onChange={(e) => setOtherDeductionsYuan(e.target.value)}
                              placeholder="0"
                            />
                            <p className="text-xs text-muted-foreground">會併入退租應付總額（後端以元換算成分）</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="notes">結算備註</Label>
                          <Textarea
                            id="notes"
                            value={settlementNotes}
                            onChange={(e) => setSettlementNotes(e.target.value)}
                            placeholder="輸入結算備註（可選）"
                            rows={3}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calculator className="mr-2 h-5 w-5" />
                  退租操作
                </CardTitle>
                <CardDescription>
                  填入必要資訊後提交（會把房間狀態改回空房）
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={openConfirm}
                  disabled={!selectedTenant || !selectedRoom || submitting}
                >
                  <CheckCircle className="mr-2 h-5 w-5" />
                  確認退租並送出
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 右側：統計與提示 */}
          <div className="space-y-6">
            {/* 統計卡片 */}
            <Card>
              <CardHeader>
                <CardTitle>結算統計</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">可辦退租（入住中）</p>
                    <p className="text-2xl font-bold">{activeTenants.length}</p>
                  </div>
                  <Home className="h-8 w-8 text-muted-foreground" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">歷史結算筆數</p>
                    <p className="text-2xl font-bold">{settlements.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            {/* 操作提示 */}
            <Card>
              <CardHeader>
                <CardTitle>操作提示</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1 mr-2"></div>
                    <span>選擇租客後系統會自動計算結算金額</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1 mr-2"></div>
                    <span>日租金 = 月租金 ÷ 30（四捨五入）</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1 mr-2"></div>
                    <span>
                      應退金額 = 已繳款合計（分）+「收取」押金合計（分）− 應付總額（分），不為負時寫入結算
                    </span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1 mr-2"></div>
                    <span>提交退租後，房間狀態會自動變更為「空房」</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              退租結算紀錄
            </CardTitle>
            <CardDescription>金額以下表為元（後端以分儲存）</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {settlements.length === 0 ? (
              <p className="text-sm text-muted-foreground">尚無結算紀錄</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>退租日</TableHead>
                    <TableHead>房號</TableHead>
                    <TableHead>租客</TableHead>
                    <TableHead className="text-right">應付總額</TableHead>
                    <TableHead className="text-right">電費</TableHead>
                    <TableHead className="text-right">其他扣款</TableHead>
                    <TableHead className="text-right">已繳</TableHead>
                    <TableHead className="text-right">押金（收取合計）</TableHead>
                    <TableHead className="text-right">應退</TableHead>
                    <TableHead>狀態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.map((s) => {
                    const tn = tenantById.get(s.tenantId);
                    const rn = rooms[s.roomId]?.roomNumber ?? '—';
                    const name = tn?.nameZh || tn?.nameVi || '—';
                    const checkout =
                      typeof s.checkoutDate === 'string'
                        ? s.checkoutDate
                        : String(s.checkoutDate);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(checkout)}</TableCell>
                        <TableCell>{rn}</TableCell>
                        <TableCell>{name}</TableCell>
                        <TableCell className="text-right">{formatCents(s.totalDue)}</TableCell>
                        <TableCell className="text-right">{formatCents(s.electricityFee)}</TableCell>
                        <TableCell className="text-right">{formatCents(s.otherDeductions)}</TableCell>
                        <TableCell className="text-right">{formatCents(s.prepaidAmount)}</TableCell>
                        <TableCell className="text-right">{formatCents(s.depositAmount)}</TableCell>
                        <TableCell className="text-right">{formatCents(s.refundAmount)}</TableCell>
                        <TableCell>{s.settlementStatus}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 確認結算對話框 */}
      <Dialog open={showSettlementDialog} onOpenChange={setShowSettlementDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>確認退租</DialogTitle>
            <DialogDescription>
              請確認資訊無誤後提交（會寫入電表讀數、結算單與押金／預付沖帳）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedTenant && selectedRoom && (
              <div className="rounded-md bg-muted p-4">
                <h3 className="font-medium mb-2">提交內容</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>租客：{selectedTenant.nameZh || selectedTenant.nameVi || '—'}</div>
                  <div>房號：{selectedRoom.roomNumber}</div>
                  <div>物業：{selectedPropertyName || '—'}</div>
                  <div>退租：{formatDate(checkoutDateYmd)}</div>
                  <div>上期電表（最近抄表）：{lastReading != null ? String(lastReading) : '—'}</div>
                  <div>本期電表：{finalMeter.trim() !== '' ? finalMeter : '—'}</div>
                  <div>預估電費：{formatCurrency(electricityFeePreview || 0)}</div>
                  <div>其他扣款：{formatCurrency(parseFloat(otherDeductionsYuan || '0') || 0)}</div>
                  <div>已入帳押金（收取）：{formatCents(depositSummary.collectedCents)}</div>
                  <div>已繳款合計：{prepaidSumCents != null ? formatCents(prepaidSumCents) : '—'}</div>
                </div>
              </div>
            )}
            {unpaidBreakdown.total > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                提醒：仍有待收 {formatCents(unpaidBreakdown.total)}，請確認可接受後再送出。
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettlementDialog(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmCheckout} disabled={submitting}>
              {submitting ? '送出中...' : '確認並完成退租'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <Card>
            <CardHeader>
              <CardTitle>退租結算管理</CardTitle>
              <CardDescription>載入中…</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                正在載入
              </div>
            </CardContent>
          </Card>
        </PageShell>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  );
}