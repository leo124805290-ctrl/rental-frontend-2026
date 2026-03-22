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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CalendarRange, Loader2, Receipt, Zap } from 'lucide-react';
import { formatCents, formatDate } from '@/lib/utils';
import { api, ApiError } from '@/lib/api-client';
import { PageHeader } from '@/components/app-shell/page-header';
import { PageShell } from '@/components/app-shell/page-shell';

interface Property {
  id: string;
  name: string;
  status?: string;
}

interface Room {
  id: string;
  propertyId: string;
  roomNumber: string;
  floor: number;
  status: string;
  /** 每度電價（分），例如 350 = 3.5 元 */
  electricityRate?: number;
}

interface MeterReadingRow {
  id: string;
  readingValue: number;
  readingDate: string;
}

type LineType = 'deposit' | 'rent' | 'electricity';

interface PaymentRow {
  id: string;
  roomId: string;
  tenantId: string | null;
  lineType: LineType;
  paymentMonth: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  paymentStatus: string;
  createdAt?: string;
  roomNumber?: string;
  propertyName?: string;
  tenantName?: string;
}

const LINE_LABEL: Record<LineType, string> = {
  deposit: '押金',
  rent: '月租金',
  electricity: '電費',
};

/** 帳單所屬月份（YYYY-MM → 2026年3月）— 月租/押金/電費歸屬哪一期 */
function formatBillMonth(ym: string | undefined): string {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym?.trim() || '—';
  const [y, m] = ym.split('-');
  if (!y || !m) return ym.trim();
  return `${y}年${parseInt(m, 10)}月`;
}

function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 與後端 payments 電費公式一致：用量(度) × (rate/100) 元 → 分 */
function estimateElectricityFeeCents(usageDeg: number, electricityRateCentsPerDeg: number): number {
  return Math.round(usageDeg * (electricityRateCentsPerDeg / 100) * 100);
}

function displayStatus(p: PaymentRow): { label: string; className: string } {
  const paid = Number(p.paidAmount || 0);
  const exp = Number(p.totalAmount || 0);
  if (paid <= 0) return { label: '待收', className: 'bg-red-100 text-red-800 border-red-200' };
  if (paid < exp) return { label: '部分收款', className: 'bg-amber-100 text-amber-900 border-amber-200' };
  return { label: '已結清', className: 'bg-emerald-100 text-emerald-900 border-emerald-200' };
}

export default function PaymentsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7),
  );

  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [monthlyBusy, setMonthlyBusy] = useState(false);

  const [collectOpen, setCollectOpen] = useState(false);
  const [active, setActive] = useState<PaymentRow | null>(null);
  const [collectYuan, setCollectYuan] = useState('');
  const [collectMethod, setCollectMethod] = useState('cash');
  const [collectNotes, setCollectNotes] = useState('');
  const [collectSubmitting, setCollectSubmitting] = useState(false);

  const [meterReadings, setMeterReadings] = useState<MeterReadingRow[]>([]);
  const [meterLoading, setMeterLoading] = useState(false);
  const [meterValue, setMeterValue] = useState('');
  const [meterDate, setMeterDate] = useState(() => localTodayYmd());
  const [meterSubmitting, setMeterSubmitting] = useState(false);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const props = await api.get<Property[]>('/api/properties');
        const allowed = props.filter((p) => p.status !== 'archived');
        setProperties(allowed);
        setSelectedPropertyId(allowed[0]?.id ?? '');
      } catch (e) {
        console.error(e);
        setError('載入物業失敗');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedPropertyId) {
      setRooms([]);
      return;
    }
    (async () => {
      try {
        const rms = await api.get<Room[]>(
          `/api/rooms?propertyId=${encodeURIComponent(selectedPropertyId)}`,
        );
        setRooms(Array.isArray(rms) ? rms : []);
        setSelectedRoomId('all');
      } catch (e) {
        console.error(e);
        setRooms([]);
      }
    })();
  }, [selectedPropertyId]);

  const loadRows = useCallback(async () => {
    if (!selectedPropertyId) return;
    setLoadingList(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('propertyId', selectedPropertyId);
      qs.set('month', selectedMonth);
      if (selectedRoomId && selectedRoomId !== 'all') {
        qs.set('roomId', selectedRoomId);
      }
      const list = await api.get<PaymentRow[]>(`/api/payments?${qs.toString()}`);
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      setError('載入帳單失敗');
      setRows([]);
    } finally {
      setLoadingList(false);
    }
  }, [selectedPropertyId, selectedRoomId, selectedMonth]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (selectedRoomId === 'all' || !selectedRoomId) {
      setMeterReadings([]);
      setMeterValue('');
      setMeterDate(localTodayYmd());
      return;
    }
    (async () => {
      setMeterLoading(true);
      try {
        const list = await api.get<MeterReadingRow[]>(
          `/api/meter-readings?roomId=${encodeURIComponent(selectedRoomId)}`,
        );
        setMeterReadings(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error(e);
        setMeterReadings([]);
      } finally {
        setMeterLoading(false);
      }
    })();
  }, [selectedRoomId]);

  const handleGenerateMonthly = async () => {
    if (!confirm(`確定為所有「已入住」房間建立 ${selectedMonth} 租金帳單？已存在者會略過。`)) return;
    setMonthlyBusy(true);
    try {
      const res = await api.post<{ created: unknown[]; skipped: unknown[] }>(
        '/api/payments/generate-monthly',
        { paymentMonth: selectedMonth },
      );
      alert(
        `已建立 ${res.created?.length ?? 0} 筆租金帳單，略過 ${res.skipped?.length ?? 0} 筆`,
      );
      await loadRows();
    } catch (e) {
      console.error(e);
      alert(e instanceof ApiError ? e.message : '建立失敗');
    } finally {
      setMonthlyBusy(false);
    }
  };

  /** 已抄表、僅依最後兩筆讀數產生帳單（舊流程，免再輸入度數） */
  const handleGenerateElectricityFromExistingReadings = async () => {
    if (selectedRoomId === 'all') {
      alert('請先選擇單一房間');
      return;
    }
    if (!selectedRoom) return;
    try {
      const existing = await api.get<PaymentRow[]>(
        `/api/payments?roomId=${encodeURIComponent(selectedRoomId)}&month=${encodeURIComponent(selectedMonth)}&lineType=electricity`,
      );
      if (Array.isArray(existing) && existing.length > 0) {
        alert('該月電費帳單已存在');
        await loadRows();
        return;
      }
      const tenantRes = await api.get<unknown[]>(
        `/api/tenants?roomId=${encodeURIComponent(selectedRoomId)}&status=active`,
      );
      const tid =
        Array.isArray(tenantRes) && tenantRes[0] && typeof tenantRes[0] === 'object'
          ? String((tenantRes[0] as { id?: string }).id ?? '')
          : '';
      await api.post('/api/payments/generate', {
        roomId: selectedRoomId,
        tenantId: tid || undefined,
        paymentMonth: selectedMonth,
        lineType: 'electricity',
      });
      alert('電費帳單已建立');
      await loadRows();
    } catch (e) {
      console.error(e);
      alert(e instanceof ApiError ? e.message : '建立電費帳單失敗');
    }
  };

  const handleMeterAndElectricityBill = async () => {
    if (selectedRoomId === 'all' || !selectedRoom) {
      alert('請先選擇單一房間');
      return;
    }
    const v = parseFloat(meterValue.replace(/,/g, ''));
    if (Number.isNaN(v) || v < 0) {
      alert('請輸入有效的本次抄表度數');
      return;
    }
    if (!meterDate) {
      alert('請選擇抄表日期');
      return;
    }
    setMeterSubmitting(true);
    try {
      const tenantRes = await api.get<unknown[]>(
        `/api/tenants?roomId=${encodeURIComponent(selectedRoomId)}&status=active`,
      );
      const tid =
        Array.isArray(tenantRes) && tenantRes[0] && typeof tenantRes[0] === 'object'
          ? String((tenantRes[0] as { id?: string }).id ?? '')
          : '';
      const res = await api.post<{ mode?: string; message?: string }>(
        '/api/payments/electricity-with-reading',
        {
          roomId: selectedRoomId,
          paymentMonth: selectedMonth,
          readingValue: v,
          readingDate: new Date(meterDate + 'T12:00:00').toISOString(),
          tenantId: tid || undefined,
        },
      );
      if (res && typeof res === 'object' && 'mode' in res && (res as { mode: string }).mode === 'baseline') {
        alert(
          '已建立基準抄表。尚無上一筆可比較，無法計算電費；下次抄表後再按此鈕即可產生電費帳單。',
        );
      } else {
        alert('已記錄抄表並產生電費帳單');
      }
      setMeterValue('');
      const list = await api.get<MeterReadingRow[]>(
        `/api/meter-readings?roomId=${encodeURIComponent(selectedRoomId)}`,
      );
      setMeterReadings(Array.isArray(list) ? list : []);
      await loadRows();
    } catch (e) {
      console.error(e);
      alert(e instanceof ApiError ? e.message : '抄表或產生電費失敗');
    } finally {
      setMeterSubmitting(false);
    }
  };

  const meterPreview = useMemo(() => {
    const rate = selectedRoom?.electricityRate ?? 350;
    const latest = meterReadings[0];
    const prevVal = latest?.readingValue;
    const prevDate = latest?.readingDate;
    const inputNum = parseFloat(meterValue.replace(/,/g, ''));
    const hasInput = meterValue.trim() !== '' && !Number.isNaN(inputNum);
    if (!hasInput) {
      return {
        rate,
        prevVal: prevVal ?? null,
        prevDate: prevDate ?? null,
        usage: null as number | null,
        feeCents: null as number | null,
        isFirstBaseline: false,
      };
    }
    if (prevVal === undefined) {
      return {
        rate,
        prevVal: null,
        prevDate: null,
        usage: null,
        feeCents: null,
        isFirstBaseline: true,
      };
    }
    const usage = inputNum - prevVal;
    const feeCents =
      usage >= 0 ? estimateElectricityFeeCents(usage, rate) : null;
    return {
      rate,
      prevVal,
      prevDate: prevDate ?? null,
      usage,
      feeCents,
      isFirstBaseline: false,
    };
  }, [meterReadings, meterValue, selectedRoom]);

  const openCollect = (p: PaymentRow) => {
    setActive(p);
    const rest = Math.max(0, (p.totalAmount || 0) - (p.paidAmount || 0));
    setCollectYuan(String(Math.ceil(rest / 100)));
    setCollectMethod('cash');
    setCollectNotes('');
    setCollectOpen(true);
  };

  const confirmCollect = async () => {
    if (!active) return;
    const yuan = parseFloat(collectYuan.replace(/,/g, ''));
    if (Number.isNaN(yuan) || yuan <= 0) {
      alert('請輸入有效金額（元）');
      return;
    }
    const cents = Math.round(yuan * 100);
    setCollectSubmitting(true);
    try {
      await api.patch(`/api/payments/${active.id}/pay`, {
        amount: cents,
        paymentMethod: collectMethod,
        notes: collectNotes || undefined,
      });
      setCollectOpen(false);
      setActive(null);
      await loadRows();
    } catch (e) {
      console.error(e);
      alert(e instanceof ApiError ? e.message : '收款失敗');
    } finally {
      setCollectSubmitting(false);
    }
  };

  const propertyName = useMemo(
    () => properties.find((p) => p.id === selectedPropertyId)?.name ?? '',
    [properties, selectedPropertyId],
  );

  if (isLoading) {
    return (
      <PageShell>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="收租管理"
        description="預計金額由入住或產生帳單時依房間月租／押金／抄表自動寫入。下方可同頁抄表並產生電費，與租金一併在列表中收款。"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleGenerateMonthly} disabled={monthlyBusy}>
              {monthlyBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarRange className="mr-2 h-4 w-4" />
              )}
              生成本月帳單（全房）
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>篩選</CardTitle>
          <CardDescription>{propertyName || '請選擇物業'}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>物業</Label>
            <Select value={selectedPropertyId || '__'} onValueChange={setSelectedPropertyId}>
              <SelectTrigger>
                <SelectValue placeholder="物業" />
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
          <div className="space-y-2">
            <Label>房間</Label>
            <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部房間</SelectItem>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.roomNumber} 號（{r.floor} 樓）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>月份</Label>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button className="w-full" variant="outline" onClick={() => void loadRows()}>
              重新整理
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedRoomId !== 'all' && selectedRoom && (
        <Card className="mb-6 border-amber-200/80 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-amber-600" />
              抄表與電費（本頁完成）
            </CardTitle>
            <CardDescription>
              帳單月份請與上方一致。公式：用量(度) ＝ 本次抄表度數 − 上一筆度數；應收電費 ＝ 用量 × 每度單價。產生後會出現在下方列表，與月租一併收款。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {meterLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                載入抄表紀錄…
              </div>
            ) : (
              <>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">上一筆度數</span>
                    <p className="font-medium">
                      {meterPreview.prevVal !== null && meterPreview.prevVal !== undefined
                        ? `${meterPreview.prevVal} 度`
                        : '—（尚無紀錄，送出後為基準抄表）'}
                    </p>
                    {meterPreview.prevDate && (
                      <p className="text-xs text-muted-foreground">
                        {formatDate(meterPreview.prevDate, 'short')}
                      </p>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">每度電費（此房）</span>
                    <p className="font-medium">
                      {(meterPreview.rate / 100).toLocaleString('zh-TW', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 2,
                      })}{' '}
                      元／度
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="meter-val">本次抄表度數</Label>
                    <Input
                      id="meter-val"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="例如 12580"
                      value={meterValue}
                      onChange={(e) => setMeterValue(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meter-d">抄表日期</Label>
                    <Input
                      id="meter-d"
                      type="date"
                      value={meterDate}
                      onChange={(e) => setMeterDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="rounded-md border bg-background px-3 py-2 text-sm">
                  {meterPreview.isFirstBaseline && (
                    <p className="text-muted-foreground">
                      尚無上一筆可比較。送出後僅建立基準讀數，不會產生電費帳單；下次再抄表即可計算應收電費。
                    </p>
                  )}
                  {!meterPreview.isFirstBaseline &&
                    meterPreview.usage !== null &&
                    meterPreview.feeCents !== null && (
                      <>
                        <p>
                          <span className="text-muted-foreground">預估用量</span>{' '}
                          <span className="font-medium">{meterPreview.usage} 度</span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">預估應收電費</span>{' '}
                          <span className="font-medium">{formatCents(meterPreview.feeCents)}</span>
                        </p>
                      </>
                    )}
                  {!meterPreview.isFirstBaseline &&
                    meterPreview.usage !== null &&
                    meterPreview.usage < 0 && (
                      <p className="text-destructive">本次度數不可小於上一筆。</p>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => void handleMeterAndElectricityBill()}
                    disabled={
                      meterSubmitting ||
                      (meterPreview.usage !== null && meterPreview.usage < 0)
                    }
                  >
                    {meterSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        處理中…
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        記錄抄表並產生「{formatBillMonth(selectedMonth)}」電費帳單
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleGenerateElectricityFromExistingReadings()}
                  >
                    <Receipt className="mr-2 h-4 w-4" />
                    已抄表，僅依讀數產生帳單
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>帳單列表</CardTitle>
          <CardDescription>
            共 {rows.length} 筆。預計金額＝應收（系統帶入）；帳單月份＝歸屬哪一期的租金／押金／電費。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingList ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">此條件下尚無帳單</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>帳單月份</TableHead>
                    <TableHead>建立日期</TableHead>
                    <TableHead>房號</TableHead>
                    <TableHead>租客</TableHead>
                    <TableHead>類型</TableHead>
                    <TableHead className="text-right">預計金額（應收）</TableHead>
                    <TableHead className="text-right">實收金額</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => {
                    const st = displayStatus(p);
                    const lt = (p.lineType || 'rent') as LineType;
                    const dateStr = p.createdAt
                      ? formatDate(p.createdAt, 'short')
                      : '—';
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {formatBillMonth(p.paymentMonth)}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            ({p.paymentMonth ?? '—'})
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {dateStr}
                        </TableCell>
                        <TableCell>{p.roomNumber ?? '—'}</TableCell>
                        <TableCell>{p.tenantName ?? '—'}</TableCell>
                        <TableCell>{LINE_LABEL[lt] ?? lt}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCents(p.totalAmount ?? 0)}
                        </TableCell>
                        <TableCell className="text-right">{formatCents(p.paidAmount)}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded border px-2 py-0.5 text-xs ${st.className}`}
                          >
                            {st.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={displayStatus(p).label === '已結清'}
                            onClick={() => openCollect(p)}
                          >
                            收租
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={collectOpen} onOpenChange={setCollectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>收款</DialogTitle>
            <DialogDescription>
              僅輸入「本次實收」；預計金額為系統帶入。可多次收款累加實收。金額以「元」輸入。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {active && (
              <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                <div>
                  <span className="text-muted-foreground">帳單月份（歸屬期間）</span>{' '}
                  <span className="font-medium">{formatBillMonth(active.paymentMonth)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">類型</span>{' '}
                  {LINE_LABEL[(active.lineType || 'rent') as LineType]}
                </div>
                <div>
                  <span className="text-muted-foreground">房號</span> {active.roomNumber ?? '—'}
                </div>
              </div>
            )}
            <div>
              <Label>預計（應收）／已收</Label>
              <p className="text-sm text-muted-foreground">
                {active
                  ? `${formatCents(active.totalAmount ?? 0)}／${formatCents(active.paidAmount ?? 0)}`
                  : '—'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amt">本次實收（元）</Label>
              <Input
                id="amt"
                type="number"
                min={0}
                step={1}
                value={collectYuan}
                onChange={(e) => setCollectYuan(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>收款方式</Label>
              <Select value={collectMethod} onValueChange={setCollectMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">現金</SelectItem>
                  <SelectItem value="transfer">轉帳</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cn">備註</Label>
              <Input
                id="cn"
                value={collectNotes}
                onChange={(e) => setCollectNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCollectOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void confirmCollect()} disabled={collectSubmitting}>
              {collectSubmitting ? '處理中…' : '確認收款'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
