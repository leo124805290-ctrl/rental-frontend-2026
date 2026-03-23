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

function restCents(p: PaymentRow): number {
  return Math.max(0, Number(p.totalAmount || 0) - Number(p.paidAmount || 0));
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
  /** 全部 | 待收（含部分收款）| 已結清 */
  const [collectionFilter, setCollectionFilter] = useState<'all' | 'open' | 'settled'>('all');

  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [monthlyBusy, setMonthlyBusy] = useState(false);

  const [collectOpen, setCollectOpen] = useState(false);
  const [active, setActive] = useState<PaymentRow | null>(null);
  const [collectYuan, setCollectYuan] = useState('');
  const [collectMethod, setCollectMethod] = useState('cash');
  const [collectNotes, setCollectNotes] = useState('');
  const [collectSubmitting, setCollectSubmitting] = useState(false);

  const [collectDialogLoading, setCollectDialogLoading] = useState(false);
  const [collectDialogReadings, setCollectDialogReadings] = useState<MeterReadingRow[]>([]);
  const [collectPairRent, setCollectPairRent] = useState<PaymentRow | null>(null);
  const [collectPairElec, setCollectPairElec] = useState<PaymentRow | null>(null);
  const [combineRentElectricity, setCombineRentElectricity] = useState(false);

  const [meterReadings, setMeterReadings] = useState<MeterReadingRow[]>([]);
  const [meterLoading, setMeterLoading] = useState(false);
  /** 與收款視窗共用：本期抄表度數／日期（與上方抄表區雙向同步） */
  const [meterDraftValue, setMeterDraftValue] = useState('');
  const [meterDraftDate, setMeterDraftDate] = useState(() => localTodayYmd());
  const [meterSubmitting, setMeterSubmitting] = useState(false);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );

  const collectRoom = useMemo(
    () => (active ? rooms.find((r) => r.id === active.roomId) ?? null : null),
    [active, rooms],
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
      if (collectionFilter !== 'all') {
        qs.set('collection', collectionFilter);
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
  }, [selectedPropertyId, selectedRoomId, selectedMonth, collectionFilter]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (!collectOpen || !active) return;
    let cancelled = false;
    (async () => {
      setCollectDialogLoading(true);
      setCollectPairRent(null);
      setCollectPairElec(null);
      setCollectDialogReadings([]);
      try {
        const readList = await api.get<MeterReadingRow[]>(
          `/api/meter-readings?roomId=${encodeURIComponent(active.roomId)}`,
        );
        const monthRows = await api.get<PaymentRow[]>(
          `/api/payments?roomId=${encodeURIComponent(active.roomId)}&month=${encodeURIComponent(active.paymentMonth)}`,
        );
        if (cancelled) return;
        const arr = Array.isArray(readList) ? readList : [];
        setCollectDialogReadings(arr);
        const rows = Array.isArray(monthRows) ? monthRows : [];
        const rent = rows.find((r) => r.lineType === 'rent') ?? null;
        const elec = rows.find((r) => r.lineType === 'electricity') ?? null;
        setCollectPairRent(rent);
        setCollectPairElec(elec);
        const rentRest = rent ? restCents(rent) : 0;
        const elecRest = elec ? restCents(elec) : 0;
        const canCombine =
          active.lineType !== 'deposit' &&
          Boolean(rent) &&
          rentRest > 0 &&
          (!elec || elecRest > 0);
        setCombineRentElectricity(Boolean(canCombine));
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setCollectDialogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collectOpen, active]);

  /** 收款視窗：租金待收 + 電費（帳單或依本期度數預估） */
  const collectDialogMeterPreview = useMemo(() => {
    if (!active || active.lineType === 'deposit') return null;
    const rate = collectRoom?.electricityRate ?? 350;
    const lastReading = collectDialogReadings[0]?.readingValue;
    const inputNum = parseFloat(meterDraftValue.replace(/,/g, ''));
    const hasInput = meterDraftValue.trim() !== '' && !Number.isNaN(inputNum);
    const rent = collectPairRent;
    const elecBill = collectPairElec;
    const rentRest = rent ? restCents(rent) : 0;

    if (elecBill && Number(elecBill.totalAmount) > 0) {
      const er = restCents(elecBill);
      return {
        kind: 'bill' as const,
        rentRestCents: rentRest,
        elecRestCents: er,
        totalSuggestCents: rentRest + er,
        usage: null as number | null,
        feePreviewCents: null as number | null,
        error: null as string | null,
      };
    }

    if (!hasInput) {
      return {
        kind: 'preview' as const,
        rentRestCents: rentRest,
        elecRestCents: 0,
        totalSuggestCents: rentRest,
        usage: null as number | null,
        feePreviewCents: null as number | null,
        error: null as string | null,
        baselineHint: lastReading === undefined,
      };
    }
    if (lastReading === undefined) {
      return {
        kind: 'preview' as const,
        rentRestCents: rentRest,
        elecRestCents: 0,
        totalSuggestCents: rentRest,
        usage: null,
        feePreviewCents: null,
        error: null,
        baselineHint: true,
      };
    }
    const usage = inputNum - lastReading;
    if (usage < 0) {
      return {
        kind: 'preview' as const,
        rentRestCents: rentRest,
        elecRestCents: 0,
        totalSuggestCents: rentRest,
        usage,
        feePreviewCents: null,
        error: '本次抄表度數不可小於上期（最新一筆）',
        baselineHint: false,
      };
    }
    const feePreviewCents = estimateElectricityFeeCents(usage, rate);
    return {
      kind: 'preview' as const,
      rentRestCents: rentRest,
      elecRestCents: feePreviewCents,
      totalSuggestCents: rentRest + feePreviewCents,
      usage,
      feePreviewCents,
      error: null,
      baselineHint: false,
    };
  }, [
    active,
    collectRoom,
    collectDialogReadings,
    meterDraftValue,
    collectPairRent,
    collectPairElec,
  ]);

  useEffect(() => {
    if (!collectOpen || !active || collectDialogLoading) return;
    if (active.lineType === 'deposit') {
      setCollectYuan(String(Math.ceil(restCents(active) / 100)));
      return;
    }
    if (!combineRentElectricity) {
      setCollectYuan(String(Math.ceil(restCents(active) / 100)));
      return;
    }
    const p = collectDialogMeterPreview;
    if (p && !p.error && p.totalSuggestCents !== undefined) {
      setCollectYuan(String(Math.ceil(p.totalSuggestCents / 100)));
    }
  }, [
    collectOpen,
    active,
    collectDialogLoading,
    combineRentElectricity,
    collectDialogMeterPreview,
  ]);

  useEffect(() => {
    if (selectedRoomId === 'all' || !selectedRoomId) {
      setMeterReadings([]);
      setMeterDraftValue('');
      setMeterDraftDate(localTodayYmd());
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
    const v = parseFloat(meterDraftValue.replace(/,/g, ''));
    if (Number.isNaN(v) || v < 0) {
      alert('請輸入有效的本次抄表度數');
      return;
    }
    if (!meterDraftDate) {
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
          readingDate: new Date(meterDraftDate + 'T12:00:00').toISOString(),
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
      setMeterDraftValue('');
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
    const inputNum = parseFloat(meterDraftValue.replace(/,/g, ''));
    const hasInput = meterDraftValue.trim() !== '' && !Number.isNaN(inputNum);
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
  }, [meterReadings, meterDraftValue, selectedRoom]);

  const openCollect = (p: PaymentRow) => {
    setActive(p);
    setCollectMethod('cash');
    setCollectNotes('');
    if (selectedRoomId !== p.roomId) {
      setMeterDraftValue('');
      setMeterDraftDate(localTodayYmd());
    }
    setCollectOpen(true);
  };

  const refreshMeterForRoom = async (roomId: string) => {
    try {
      const list = await api.get<MeterReadingRow[]>(
        `/api/meter-readings?roomId=${encodeURIComponent(roomId)}`,
      );
      if (selectedRoomId === roomId) {
        setMeterReadings(Array.isArray(list) ? list : []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchActiveTenantId = async (roomId: string) => {
    const tenantRes = await api.get<unknown[]>(
      `/api/tenants?roomId=${encodeURIComponent(roomId)}&status=active`,
    );
    return Array.isArray(tenantRes) && tenantRes[0] && typeof tenantRes[0] === 'object'
      ? String((tenantRes[0] as { id?: string }).id ?? '')
      : '';
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
      const common = {
        paymentMethod: collectMethod,
        notes: collectNotes || undefined,
      };

      if (active.lineType === 'deposit') {
        await api.patch(`/api/payments/${active.id}/pay`, {
          amount: cents,
          ...common,
        });
        setCollectOpen(false);
        setActive(null);
        await loadRows();
        return;
      }

      let rent = collectPairRent;
      let elec = collectPairElec;

      if (combineRentElectricity && rent && restCents(rent) > 0 && !elec) {
        const v = parseFloat(meterDraftValue.replace(/,/g, ''));
        if (Number.isNaN(v) || v < 0) {
          alert('請輸入「本次抄表度數」以產生電費帳單；若只收租金請取消勾選「一併收取租金＋電費」。');
          return;
        }
        if (!meterDraftDate) {
          alert('請選擇抄表日期');
          return;
        }
        const tid = await fetchActiveTenantId(active.roomId);
        const res = await api.post<{ mode?: string }>('/api/payments/electricity-with-reading', {
          roomId: active.roomId,
          paymentMonth: active.paymentMonth,
          readingValue: v,
          readingDate: new Date(meterDraftDate + 'T12:00:00').toISOString(),
          tenantId: tid || undefined,
        });
        if (res && typeof res === 'object' && 'mode' in res && res.mode === 'baseline') {
          alert(
            '此次為基準抄表，尚未產生電費帳單。將依您輸入的金額僅沖收租金；電費請待下次抄表後再收。',
          );
          await api.patch(`/api/payments/${rent.id}/pay`, {
            amount: Math.min(cents, restCents(rent)),
            ...common,
          });
          await refreshMeterForRoom(active.roomId);
          setMeterDraftValue('');
          setCollectOpen(false);
          setActive(null);
          await loadRows();
          return;
        }
        const rows = await api.get<PaymentRow[]>(
          `/api/payments?roomId=${encodeURIComponent(active.roomId)}&month=${encodeURIComponent(active.paymentMonth)}`,
        );
        const arr = Array.isArray(rows) ? rows : [];
        rent = arr.find((r) => r.lineType === 'rent') ?? rent;
        elec = arr.find((r) => r.lineType === 'electricity') ?? null;
        await refreshMeterForRoom(active.roomId);
      }

      const rentRest = rent ? restCents(rent) : 0;
      const elecRest = elec ? restCents(elec) : 0;
      const canCombinePay =
        combineRentElectricity &&
        rent &&
        elec &&
        rentRest > 0 &&
        elecRest > 0;

      if (canCombinePay && rent && elec) {
        let left = cents;
        const payRent = Math.min(left, rentRest);
        if (payRent > 0) {
          await api.patch(`/api/payments/${rent.id}/pay`, {
            amount: payRent,
            ...common,
          });
          left -= payRent;
        }
        const payElec = Math.min(left, elecRest);
        if (payElec > 0) {
          await api.patch(`/api/payments/${elec.id}/pay`, {
            amount: payElec,
            ...common,
          });
          left -= payElec;
        }
        if (left > 0) {
          alert(
            `本次實收扣除租金與電費後，尚有約 ${(left / 100).toLocaleString('zh-TW')} 元無法沖帳（兩項應收已滿足或已沖完）。`,
          );
        }
      } else {
        await api.patch(`/api/payments/${active.id}/pay`, {
          amount: cents,
          ...common,
        });
      }

      setMeterDraftValue('');
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
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
          <div className="space-y-2">
            <Label>狀態</Label>
            <Select
              value={collectionFilter}
              onValueChange={(v) => setCollectionFilter(v as 'all' | 'open' | 'settled')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="open">待收（含部分收款）</SelectItem>
                <SelectItem value="settled">已結清</SelectItem>
              </SelectContent>
            </Select>
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
              與下方「收款」視窗共用同一組度數／日期，可擇一處填寫。公式：用量＝本次−上期；應收電費＝用量×每度單價。
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
                      value={meterDraftValue}
                      onChange={(e) => setMeterDraftValue(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meter-d">抄表日期</Label>
                    <Input
                      id="meter-d"
                      type="date"
                      value={meterDraftDate}
                      onChange={(e) => setMeterDraftDate(e.target.value)}
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

      <Dialog
        open={collectOpen}
        onOpenChange={(o) => {
          setCollectOpen(o);
          if (!o) {
            setActive(null);
            setCollectDialogReadings([]);
            setCollectPairRent(null);
            setCollectPairElec(null);
            setCombineRentElectricity(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>收款</DialogTitle>
            <DialogDescription>
              帶入上期度數後輸入本期度數，系統會顯示應收電費與「租金＋電費」合計。與頁面上方抄表區同步，無須重填。沖帳順序：先租金、再電費。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {collectDialogLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                載入抄表與同月帳單…
              </div>
            )}
            {active && (
              <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                <div>
                  <span className="text-muted-foreground">帳單月份（歸屬期間）</span>{' '}
                  <span className="font-medium">{formatBillMonth(active.paymentMonth)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">目前操作列</span>{' '}
                  {LINE_LABEL[(active.lineType || 'rent') as LineType]}
                </div>
                <div>
                  <span className="text-muted-foreground">房號</span> {active.roomNumber ?? '—'}
                </div>
              </div>
            )}

            {!collectDialogLoading && active && active.lineType !== 'deposit' && (
              <div className="rounded-md border border-amber-200/80 bg-amber-50/50 px-3 py-3 text-sm">
                <div className="mb-2 font-medium text-amber-900">電費抄表（與上方「抄表與電費」同步）</div>
                <div className="mb-2 grid gap-2 text-muted-foreground">
                  <div>
                    上期度數（本房最新一筆讀數）
                    <p className="font-medium text-foreground">
                      {collectDialogReadings[0] != null
                        ? `${collectDialogReadings[0].readingValue} 度（${formatDate(collectDialogReadings[0].readingDate, 'short')}）`
                        : '—（尚無紀錄；首次可只建基準，下次再算電費）'}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="dlg-meter">本次抄表度數</Label>
                      <Input
                        id="dlg-meter"
                        type="number"
                        min={0}
                        step={1}
                        placeholder="輸入本次度數"
                        value={meterDraftValue}
                        onChange={(e) => setMeterDraftValue(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="dlg-meter-d">抄表日期</Label>
                      <Input
                        id="dlg-meter-d"
                        type="date"
                        value={meterDraftDate}
                        onChange={(e) => setMeterDraftDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                {collectDialogMeterPreview?.error && (
                  <p className="text-sm text-destructive">{collectDialogMeterPreview.error}</p>
                )}
                <div className="space-y-1 rounded-md border bg-background px-2 py-2">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">待收租金</span>
                    <span className="font-medium">
                      {formatCents(collectDialogMeterPreview?.rentRestCents ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">
                      {collectDialogMeterPreview?.kind === 'bill' ? '應收電費（帳單）' : '應收電費（預估）'}
                    </span>
                    <span className="font-medium">
                      {collectDialogMeterPreview?.kind === 'bill'
                        ? formatCents(collectDialogMeterPreview.elecRestCents)
                        : collectDialogMeterPreview?.feePreviewCents != null
                          ? formatCents(collectDialogMeterPreview.feePreviewCents)
                          : '—'}
                    </span>
                  </div>
                  {collectDialogMeterPreview?.usage != null && (
                    <p className="text-xs text-muted-foreground">
                      期間用量（參考）約 {collectDialogMeterPreview.usage} 度；每度{' '}
                      {((collectRoom?.electricityRate ?? 350) / 100).toLocaleString('zh-TW', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 2,
                      })}{' '}
                      元
                    </p>
                  )}
                  {collectDialogMeterPreview?.baselineHint && (
                    <p className="text-xs text-muted-foreground">
                      尚無上期可比較時，本次送出將只建基準抄表，不產電費帳單。
                    </p>
                  )}
                  <div className="flex justify-between gap-2 border-t pt-2 font-medium">
                    <span>租金＋電費合計（建議）</span>
                    <span>
                      {collectDialogMeterPreview && !collectDialogMeterPreview.error
                        ? formatCents(collectDialogMeterPreview.totalSuggestCents)
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {!collectDialogLoading &&
              active &&
              active.lineType !== 'deposit' &&
              collectPairRent &&
              restCents(collectPairRent) > 0 && (
                <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-input"
                    checked={combineRentElectricity}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setCombineRentElectricity(v);
                    }}
                  />
                  <span>
                    <span className="font-medium">一併收取同月租金＋電費</span>
                    <span className="mt-1 block text-muted-foreground">
                      若尚無電費帳單，確認收款時會先依上方度數寫入抄表並產生電費帳單，再依金額沖租金與電費。
                    </span>
                  </span>
                </label>
              )}

            {!collectDialogLoading && active && (
              <div>
                <Label>本列預計（應收）／已收</Label>
                <p className="text-sm text-muted-foreground">
                  {`${formatCents(active.totalAmount ?? 0)}／${formatCents(active.paidAmount ?? 0)}`}
                </p>
              </div>
            )}
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
