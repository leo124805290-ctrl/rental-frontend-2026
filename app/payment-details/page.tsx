'use client';

import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CalendarRange, Loader2, RefreshCw, Banknote, X } from 'lucide-react';
import { cn, formatCents, formatCurrency } from '@/lib/utils';
import { api, ApiError } from '@/lib/api-client';
import { PageHeader } from '@/components/app-shell/page-header';
import { PageShell } from '@/components/app-shell/page-shell';
import { parseLocalYmd, prorationRentYuan, daysRemainingInMonthForRent } from '@/lib/checkin-dates';

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
  monthlyRent: number;
  depositAmount: number;
  electricityRate: number;
}

interface TenantRow {
  id: string;
  roomId: string;
  nameZh: string;
  nameVi?: string;
  checkInDate?: string;
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
  paymentStatus: string;
}

function localTodayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 入住日所屬 YYYY-MM（本地日期） */
function ymFromCheckIn(iso: string): string {
  const d = parseLocalYmd(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMdTaiwan(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function nextMonthLabelFromYm(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return '次';
  const d = new Date(y, m - 1 + 1, 1);
  return `${d.getMonth() + 1}月`;
}

function restCents(p: PaymentRow | null): number {
  if (!p) return 0;
  return Math.max(0, Number(p.totalAmount || 0) - Number(p.paidAmount || 0));
}

function estimateElectricityFeeCents(usageDeg: number, electricityRateCentsPerDeg: number): number {
  return Math.round(usageDeg * (electricityRateCentsPerDeg / 100) * 100);
}

/** 本期度數：允許 0；空字串為未填 */
function parseMeterReadingInput(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const v = Number(t.replace(/,/g, ''));
  if (Number.isNaN(v) || v < 0) return null;
  return v;
}

export default function PaymentsPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </PageShell>
      }
    >
      <PaymentsPageContent />
    </Suspense>
  );
}

function PaymentsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const highlightProcessedRef = useRef<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [monthlyBusy, setMonthlyBusy] = useState(false);

  const [meterDraft, setMeterDraft] = useState<
    Record<string, { current: string; date: string; prev: number | null; loading: boolean }>
  >({});
  const [payBusy, setPayBusy] = useState<Record<string, boolean>>({});
  const [payAmountYuan, setPayAmountYuan] = useState<Record<string, string>>({});
  const [payMethod, setPayMethod] = useState<Record<string, string>>({});
  const [payNotes, setPayNotes] = useState<Record<string, string>>({});
  const [flashRoomId, setFlashRoomId] = useState<string | null>(null);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [newTenantTipDismissed, setNewTenantTipDismissed] = useState(false);
  const [checkinTipRoomId, setCheckinTipRoomId] = useState<string | null>(null);
  const [payFieldErrorByRoom, setPayFieldErrorByRoom] = useState<Record<string, string>>({});
  const [payApiErrorByRoom, setPayApiErrorByRoom] = useState<Record<string, string>>({});
  const [meterErrorByRoom, setMeterErrorByRoom] = useState<Record<string, string>>({});
  const [monthlyFeedback, setMonthlyFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const m = searchParams.get('month');
    if (m && /^\d{4}-\d{2}$/.test(m)) {
      setSelectedMonth(m);
    }
  }, [searchParams]);

  useEffect(() => {
    const p = searchParams.get('propertyId');
    if (!p || properties.length === 0) return;
    if (properties.some((x) => x.id === p)) {
      setSelectedPropertyId(p);
    }
  }, [searchParams, properties]);

  useEffect(() => {
    try {
      setNewTenantTipDismissed(localStorage.getItem(`payments_dismiss_newtenant_${selectedMonth}`) === '1');
    } catch {
      setNewTenantTipDismissed(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const props = await api.get<Property[]>('/api/properties');
        const allowed = props.filter((p) => p.status !== 'archived');
        setProperties(allowed);
        setSelectedPropertyId((prev) => prev || allowed[0]?.id || '');
      } catch (e) {
        setError(e instanceof Error ? e.message : '載入物業失敗');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const loadContext = useCallback(async () => {
    if (!selectedPropertyId) return;
    setListLoading(true);
    setError(null);
    try {
      const [rms, tns, pays] = await Promise.all([
        api.get<Room[]>(`/api/rooms?propertyId=${encodeURIComponent(selectedPropertyId)}`),
        api.get<TenantRow[]>(
          `/api/tenants?propertyId=${encodeURIComponent(selectedPropertyId)}&status=active`,
        ),
        api.get<PaymentRow[]>(
          `/api/payments?propertyId=${encodeURIComponent(selectedPropertyId)}&month=${encodeURIComponent(selectedMonth)}`,
        ),
      ]);
      setRooms(Array.isArray(rms) ? rms : []);
      const rawTenants = Array.isArray(tns) ? tns : [];
      setTenants(
        rawTenants.map((t): TenantRow => {
          const checkInRaw =
            (t as { checkInDate?: string }).checkInDate ??
            (t as { check_in_date?: string }).check_in_date;
          const base: TenantRow = {
            id: String((t as { id: string }).id),
            roomId: String((t as { roomId?: string; room_id?: string }).roomId ?? (t as { room_id?: string }).room_id ?? ''),
            nameZh: String((t as { nameZh?: string }).nameZh ?? ''),
            ...((t as { nameVi?: string }).nameVi != null
              ? { nameVi: String((t as { nameVi?: string }).nameVi) }
              : {}),
          };
          return checkInRaw != null && checkInRaw !== ''
            ? { ...base, checkInDate: String(checkInRaw) }
            : base;
        }),
      );
      setPayments(Array.isArray(pays) ? pays : []);

      const occupied = (Array.isArray(rms) ? rms : []).filter((r) => r.status === 'occupied');
      const nextDraft: Record<string, { current: string; date: string; prev: number | null; loading: boolean }> = {};
      await Promise.all(
        occupied.map(async (r) => {
          try {
            const list = await api.get<MeterReadingRow[]>(
              `/api/meter-readings?roomId=${encodeURIComponent(r.id)}`,
            );
            const sorted = [...(Array.isArray(list) ? list : [])].sort(
              (a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime(),
            );
            nextDraft[r.id] = {
              current: '',
              date: localTodayYmd(),
              prev: sorted[0]?.readingValue ?? null,
              loading: false,
            };
          } catch {
            nextDraft[r.id] = { current: '', date: localTodayYmd(), prev: null, loading: false };
          }
        }),
      );
      setMeterDraft(nextDraft);
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗');
      setPayments([]);
    } finally {
      setListLoading(false);
    }
  }, [selectedPropertyId, selectedMonth]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const tenantByRoom = useMemo(() => {
    const m = new Map<string, TenantRow>();
    for (const t of tenants) m.set(t.roomId, t);
    return m;
  }, [tenants]);

  const occupiedRooms = useMemo(
    () => rooms.filter((r) => r.status === 'occupied'),
    [rooms],
  );

  const roomRows = useMemo(() => {
    return occupiedRooms.map((room) => {
      const forRoom = payments.filter((p) => p.roomId === room.id && p.paymentMonth === selectedMonth);
      const deposit = forRoom.find((p) => p.lineType === 'deposit') ?? null;
      const rent = forRoom.find((p) => p.lineType === 'rent') ?? null;
      const elec = forRoom.find((p) => p.lineType === 'electricity') ?? null;
      const tenant = tenantByRoom.get(room.id);
      const checkYm = tenant?.checkInDate ? ymFromCheckIn(tenant.checkInDate) : '';
      const isCheckInMonth = Boolean(checkYm && checkYm === selectedMonth);
      const depositRest = restCents(deposit);
      const rentRest = restCents(rent);
      const elecRest = elec ? restCents(elec) : 0;
      const settled = Boolean(
        (!deposit || depositRest === 0) &&
          (!rent || rentRest === 0) &&
          (!elec || restCents(elec) === 0),
      );
      return {
        room,
        tenant,
        deposit,
        rent,
        elec,
        depositRest,
        rentRest,
        elecRest,
        rawElecRest: elec ? restCents(elec) : 0,
        isCheckInMonth,
        settled,
      };
    });
  }, [occupiedRooms, payments, selectedMonth, tenantByRoom]);

  /** 載入後自動帶入尚欠（元，整數）；若已手動輸入則不覆寫；已結清則清空 */
  useEffect(() => {
    setPayAmountYuan((prev) => {
      const next = { ...prev };
      for (const row of roomRows) {
        const key = row.room.id;
        const open = row.depositRest + row.rentRest + row.elecRest;
        if (row.settled || open <= 0) {
          next[key] = '';
          continue;
        }
        const def = String(Math.ceil(open / 100));
        const cur = next[key];
        if (cur === undefined || cur === '') {
          next[key] = def;
        }
      }
      return next;
    });
  }, [roomRows]);

  useEffect(() => {
    setExpandedRoomId(null);
    setCheckinTipRoomId(null);
  }, [selectedPropertyId, selectedMonth]);

  useEffect(() => {
    if (!expandedRoomId) return;
    const t = window.setTimeout(() => {
      document.getElementById(`pay-amt-${expandedRoomId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 120);
    return () => window.clearTimeout(t);
  }, [expandedRoomId]);

  useEffect(() => {
    if (!expandedRoomId) return;
    const row = roomRows.find((r) => r.room.id === expandedRoomId);
    if (!row) {
      setExpandedRoomId(null);
      return;
    }
    const openSum = row.depositRest + row.rentRest + row.elecRest;
    if (row.settled || openSum <= 0) {
      setExpandedRoomId(null);
    }
  }, [roomRows, expandedRoomId]);

  /** URL：?roomId=&fromCheckin=1 → 展開該列、捲至列表、強調、入住後帶入尚欠、再清掉追蹤參數 */
  useEffect(() => {
    if (!searchParams.get('roomId')) {
      highlightProcessedRef.current = null;
      return;
    }
    if (listLoading) return;
    const roomId = searchParams.get('roomId');
    if (!roomId) return;

    const row = roomRows.find((r) => r.room.id === roomId);
    if (!row) return;

    const sig = searchParams.toString();
    if (highlightProcessedRef.current === sig) return;
    highlightProcessedRef.current = sig;

    const fromCheckin = searchParams.get('fromCheckin') === '1';
    const open = row.depositRest + row.rentRest + row.elecRest;
    if (fromCheckin && open > 0) {
      setPayAmountYuan((prev) => ({
        ...prev,
        [roomId]: String(Math.ceil(open / 100)),
      }));
    }

    setExpandedRoomId(roomId);
    if (fromCheckin && open > 0) {
      setCheckinTipRoomId(roomId);
    }

    requestAnimationFrame(() => {
      document.getElementById(`table-row-${roomId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    setFlashRoomId(roomId);
    const t = window.setTimeout(() => setFlashRoomId(null), 4500);

    const qs = new URLSearchParams();
    const pid = searchParams.get('propertyId');
    const mo = searchParams.get('month');
    if (pid) qs.set('propertyId', pid);
    if (mo) qs.set('month', mo);
    const q = qs.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });

    return () => window.clearTimeout(t);
  }, [listLoading, roomRows, searchParams, pathname, router]);

  const newTenantsInMonth = useMemo(() => {
    return roomRows.filter((r) => r.tenant?.checkInDate && ymFromCheckIn(r.tenant.checkInDate) === selectedMonth);
  }, [roomRows, selectedMonth]);

  const stats = useMemo(() => {
    const totalRooms = occupiedRooms.length;
    let done = 0;
    let pend = 0;
    let due = 0;
    let collected = 0;
    for (const r of roomRows) {
      const d = r.deposit ? Number(r.deposit.totalAmount) : 0;
      const tr = r.rent ? Number(r.rent.totalAmount) : 0;
      const tp = r.rent ? Number(r.rent.paidAmount) : 0;
      const er = r.elec ? Number(r.elec.totalAmount) : 0;
      const ep = r.elec ? Number(r.elec.paidAmount) : 0;
      const dp = r.deposit ? Number(r.deposit.paidAmount) : 0;
      due += d + tr + er;
      collected += dp + tp + ep;
      if (r.settled) done++;
      else pend++;
    }
    return {
      totalRooms,
      done,
      pend,
      due,
      collected,
      open: due - collected,
    };
  }, [occupiedRooms.length, roomRows]);

  const handleGenerateMonthly = async () => {
    if (!confirm(`確定為所有已入住房間建立 ${selectedMonth} 租金帳單？已存在者略過。`)) return;
    setMonthlyBusy(true);
    setMonthlyFeedback(null);
    try {
      const res = await api.post<{ created?: unknown[]; skipped?: unknown[] }>(
        '/api/payments/generate-monthly',
        { paymentMonth: selectedMonth },
      );
      setMonthlyFeedback({
        ok: true,
        text: `已建立 ${res.created?.length ?? 0} 筆，略過 ${res.skipped?.length ?? 0} 筆`,
      });
      await loadContext();
    } catch (e) {
      setMonthlyFeedback({
        ok: false,
        text: e instanceof ApiError ? e.message : '建立失敗',
      });
    } finally {
      setMonthlyBusy(false);
    }
  };

  const saveMeter = async (room: Room) => {
    const d = meterDraft[room.id];
    if (!d) return;
    const parsed = parseMeterReadingInput(d.current);
    if (parsed === null) {
      setMeterErrorByRoom((prev) => ({ ...prev, [room.id]: '請輸入本期度數' }));
      return;
    }
    setMeterErrorByRoom((prev) => ({ ...prev, [room.id]: '' }));
    setMeterDraft((prev) => ({
      ...prev,
      [room.id]: { ...d, loading: true },
    }));
    try {
      await api.post('/api/meter-readings', {
        roomId: room.id,
        readingValue: Math.round(parsed),
        readingDate: d.date,
      });
      const list = await api.get<MeterReadingRow[]>(
        `/api/meter-readings?roomId=${encodeURIComponent(room.id)}`,
      );
      const sorted = [...(Array.isArray(list) ? list : [])].sort(
        (a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime(),
      );
      setMeterDraft((prev) => ({
        ...prev,
        [room.id]: {
          ...prev[room.id]!,
          current: '',
          prev: sorted[0]?.readingValue ?? null,
          loading: false,
        },
      }));
      const tid = tenantByRoom.get(room.id)?.id;
      try {
        await api.post('/api/payments/generate', {
          roomId: room.id,
          tenantId: tid,
          paymentMonth: selectedMonth,
          lineType: 'electricity',
        });
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          /* 已存在 */
        } else throw e;
      }
      await loadContext();
    } catch (e) {
      setMeterErrorByRoom((prev) => ({
        ...prev,
        [room.id]: e instanceof ApiError ? e.message : '儲存電錶失敗',
      }));
      setMeterDraft((prev) => ({
        ...prev,
        [room.id]: { ...prev[room.id]!, loading: false },
      }));
    }
  };

  const confirmPayRoom = async (
    room: Room,
    deposit: PaymentRow | null,
    rent: PaymentRow | null,
    elec: PaymentRow | null,
  ) => {
    const key = room.id;
    const yuan = parseFloat((payAmountYuan[key] || '0').replace(/,/g, ''));
    if (Number.isNaN(yuan) || yuan <= 0) {
      setPayFieldErrorByRoom((prev) => ({ ...prev, [key]: '請輸入實收金額（元）' }));
      return;
    }
    setPayFieldErrorByRoom((prev) => ({ ...prev, [key]: '' }));
    setPayApiErrorByRoom((prev) => ({ ...prev, [key]: '' }));
    setPayBusy((b) => ({ ...b, [key]: true }));
    try {
      const cents = Math.round(yuan * 100);
      const method = payMethod[key] || 'cash';
      const notes = payNotes[key] || '';
      let left = cents;
      if (deposit && restCents(deposit) > 0) {
        const pay = Math.min(left, restCents(deposit));
        if (pay > 0) {
          await api.patch(`/api/payments/${deposit.id}/pay`, {
            amount: pay,
            paymentMethod: method,
            notes: notes || undefined,
          });
          left -= pay;
        }
      }
      if (rent && restCents(rent) > 0) {
        const pay = Math.min(left, restCents(rent));
        if (pay > 0) {
          await api.patch(`/api/payments/${rent.id}/pay`, {
            amount: pay,
            paymentMethod: method,
            notes: notes || undefined,
          });
          left -= pay;
        }
      }
      if (elec && restCents(elec) > 0 && left > 0) {
        const pay = Math.min(left, restCents(elec));
        if (pay > 0) {
          await api.patch(`/api/payments/${elec.id}/pay`, {
            amount: pay,
            paymentMethod: method,
            notes: notes || undefined,
          });
        }
      }
      setPayAmountYuan((p) => ({ ...p, [key]: '' }));
      await loadContext();
    } catch (e) {
      setPayApiErrorByRoom((prev) => ({
        ...prev,
        [key]: e instanceof ApiError ? e.message : '收款失敗',
      }));
    } finally {
      setPayBusy((b) => ({ ...b, [key]: false }));
    }
  };

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
        title="繳款明細"
        description="月租、電費與入住當月押金皆在此沖帶（押金僅入住首月出現於此）。入住完成可自動開啟該房列；點「收款」展開抄表與確認金額。「押金紀錄」僅供查詢歷史流水。"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={monthlyBusy || !selectedPropertyId}
              onClick={() => void handleGenerateMonthly()}
            >
              {monthlyBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarRange className="mr-2 h-4 w-4" />}
              生成本月帳單
            </Button>
            <Button type="button" variant="outline" onClick={() => void loadContext()} disabled={listLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${listLoading ? 'animate-spin' : ''}`} />
              重新整理
            </Button>
          </div>
        }
      />

      {monthlyFeedback && (
        <Card
          className={cn(
            'mb-4 border',
            monthlyFeedback.ok ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50/60',
          )}
        >
          <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <span className={monthlyFeedback.ok ? 'text-emerald-900' : 'text-red-800'}>
              {monthlyFeedback.text}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setMonthlyFeedback(null)}>
              關閉
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 mb-4">
          <CardContent className="pt-6 text-red-600">{error}</CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardContent className="pt-6 flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <Label>物業</Label>
            <Select value={selectedPropertyId || '__'} onValueChange={setSelectedPropertyId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
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
          <div className="space-y-1">
            <Label>月份</Label>
            <Input
              type="month"
              className="w-[10rem]"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
          {selectedPropertyId ? (
            <p className="text-sm text-muted-foreground sm:ml-1">
              本月{' '}
              <span className="font-semibold tabular-nums text-foreground">{stats.pend}</span> 間待收
            </p>
          ) : null}
        </CardContent>
      </Card>

      {!newTenantTipDismissed && newTenantsInMonth.length > 0 && (
        <div className="relative mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 sm:p-4 text-amber-950 shadow-sm">
          <div className="flex items-start gap-2 font-medium pr-8">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <span className="flex-1">本月有新入住租客，請注意額外收款項目：</span>
            <button
              type="button"
              className="absolute top-3 right-3 rounded-md p-1 text-amber-900/70 hover:bg-amber-100 hover:text-amber-950"
              aria-label="關閉提示"
              onClick={() => {
                try {
                  localStorage.setItem(`payments_dismiss_newtenant_${selectedMonth}`, '1');
                } catch {
                  /* ignore */
                }
                setNewTenantTipDismissed(true);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-3 space-y-4 text-sm">
            {newTenantsInMonth.map(({ room, tenant }) => {
              if (!tenant?.checkInDate) return null;
              const ci = parseLocalYmd(tenant.checkInDate);
              if (Number.isNaN(ci.getTime())) return null;
              const day = ci.getDate();
              const deposit = room.depositAmount;
              const monthly = room.monthlyRent;
              const firstRent = prorationRentYuan(monthly, ci);
              const days = daysRemainingInMonthForRent(ci);
              const name = tenant.nameZh || tenant.nameVi || '—';
              const md = formatMdTaiwan(tenant.checkInDate);
              if (day > 20) {
                const total = deposit + firstRent + monthly;
                const nm = nextMonthLabelFromYm(selectedMonth);
                return (
                  <li key={room.id} className="list-none">
                    <div>
                      • {room.roomNumber} {name}（{md} 入住，20 號後入住多收下月）
                    </div>
                    <div className="mt-1 pl-3 text-muted-foreground">
                      押金 {formatCurrency(deposit)} + {selectedMonth.replace('-', '年')}月比例租金 {formatCurrency(firstRent)}（{days}
                      天）
                      <br />+ {nm}租金 {formatCurrency(monthly)} = {formatCurrency(total)}
                    </div>
                    <div className="mt-1 pl-3 text-amber-900/90">※ 入住當月可抄表並產生電費帳單</div>
                  </li>
                );
              }
              const total = deposit + firstRent;
              return (
                <li key={room.id} className="list-none">
                  <div>
                    • {room.roomNumber} {name}（{md} 入住）
                  </div>
                  <div className="mt-1 pl-3 text-muted-foreground">
                    押金 {formatCurrency(deposit)} + 首月比例租金 {formatCurrency(firstRent)}（{days} 天）= {formatCurrency(total)}
                  </div>
                  <div className="mt-1 pl-3 text-amber-900/90">※ 入住當月可抄表並產生電費帳單</div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">統計</CardTitle>
          <CardDescription>
            應收 {stats.totalRooms} 間｜已收完 {stats.done}｜待收 {stats.pend}｜應收{' '}
            {formatCents(stats.due)}｜已收 {formatCents(stats.collected)}｜待收 {formatCents(stats.open)}
          </CardDescription>
        </CardHeader>
      </Card>

      {listLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          載入帳單與抄表…
        </div>
      )}

      <div className="space-y-4">
        {occupiedRooms.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              此物業尚無已入住房間
            </CardContent>
          </Card>
        )}

        {occupiedRooms.length > 0 && (
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">繳款明細（{selectedMonth}）</CardTitle>
              <CardDescription>總表快速對帳；點「收款」於列下方展開收款與抄表，再點「收合」關閉。</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-h-[min(72vh,52rem)] overflow-auto rounded-md border">
                <Table>
                <TableHeader className="sticky top-0 z-20 border-b bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>房號</TableHead>
                    <TableHead>租客</TableHead>
                    <TableHead className="text-right">押金</TableHead>
                    <TableHead className="text-right">租金</TableHead>
                    <TableHead className="text-right">電費</TableHead>
                    <TableHead className="text-right">合計</TableHead>
                    <TableHead className="text-right">已收</TableHead>
                    <TableHead className="text-right">尚欠</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead className="w-[72px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roomRows.map(
                    ({
                      room,
                      tenant,
                      deposit,
                      rent,
                      elec,
                      isCheckInMonth,
                      settled,
                      depositRest,
                      rentRest,
                      elecRest,
                      rawElecRest,
                    }) => {
                      const tname = tenant?.nameZh || tenant?.nameVi || '—';
                      const depShow = isCheckInMonth ? formatCurrency(room.depositAmount) : '—';
                      const rentShow = rent ? formatCents(rent.totalAmount) : '—';
                      const elecShow = elec ? formatCents(elec.totalAmount) : '—';
                      const dC = deposit ? Number(deposit.totalAmount) : 0;
                      const rC = rent ? Number(rent.totalAmount) : 0;
                      const eC = elec ? Number(elec.totalAmount) : 0;
                      const totalC = dC + rC + eC;
                      const paidC =
                        (deposit ? Number(deposit.paidAmount) : 0) +
                        (rent ? Number(rent.paidAmount) : 0) +
                        (elec ? Number(elec.paidAmount) : 0);
                      const openSum = depositRest + rentRest + elecRest;
                      const canPay = !settled && openSum > 0;
                      const isExpanded = expandedRoomId === room.id && canPay;
                      const rate = room.electricityRate ?? 600;
                      const draft = meterDraft[room.id];
                      const prev = draft?.prev ?? null;
                      const curVal = draft?.current ?? '';
                      const curDate = draft?.date ?? localTodayYmd();
                      const parsedCur = parseMeterReadingInput(curVal);
                      const usage =
                        prev !== null && parsedCur !== null ? Math.max(0, parsedCur - prev) : null;
                      const feePreview =
                        usage !== null ? estimateElectricityFeeCents(usage, rate) : null;
                      const totalMonth = dC + rC + eC;
                      const paidMonth =
                        (deposit ? Number(deposit.paidAmount) : 0) +
                        (rent ? Number(rent.paidAmount) : 0) +
                        (elec ? Number(elec.paidAmount) : 0);
                      const open = depositRest + rentRest + elecRest;

                      return (
                        <Fragment key={room.id}>
                          <TableRow
                            id={`table-row-${room.id}`}
                            className={cn(
                              'scroll-mt-28',
                              isExpanded && 'border-l-4 border-l-blue-600 bg-blue-50/25',
                              flashRoomId === room.id &&
                                'bg-amber-50/90 border-l-4 border-l-amber-500 shadow-sm ring-1 ring-amber-200/70',
                            )}
                          >
                            <TableCell className="font-medium">{room.roomNumber}</TableCell>
                            <TableCell>{tname}</TableCell>
                            <TableCell className="text-right">{depShow}</TableCell>
                            <TableCell className="text-right">{rentShow}</TableCell>
                            <TableCell className="text-right">{elecShow}</TableCell>
                            <TableCell className="text-right">{formatCents(totalC)}</TableCell>
                            <TableCell className="text-right">{formatCents(paidC)}</TableCell>
                            <TableCell className="text-right font-medium text-amber-800">
                              {settled ? '—' : formatCents(openSum)}
                            </TableCell>
                            <TableCell>
                              {settled ? (
                                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                                  已結清
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950">
                                  待收
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {canPay ? (
                                <button
                                  type="button"
                                  className="text-sm font-medium text-primary underline underline-offset-2"
                                  onClick={() =>
                                    setExpandedRoomId((id) => {
                                      if (id !== room.id) {
                                        setPayFieldErrorByRoom((p) => ({ ...p, [room.id]: '' }));
                                        setPayApiErrorByRoom((p) => ({ ...p, [room.id]: '' }));
                                        setMeterErrorByRoom((p) => ({ ...p, [room.id]: '' }));
                                      }
                                      return id === room.id ? null : room.id;
                                    })
                                  }
                                >
                                  {isExpanded ? '收合' : '收款'}
                                </button>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                          </TableRow>
                          {isExpanded ? (
                            <TableRow
                              className={cn(
                                flashRoomId === room.id && 'bg-amber-50/40',
                                'hover:bg-transparent',
                              )}
                            >
                              <TableCell colSpan={10} className="p-0 align-top">
                                <div
                                  className={cn(
                                    'border-t border-l-4 border-l-blue-600 border-slate-200 bg-slate-50/90 p-4 space-y-4',
                                    flashRoomId === room.id && 'ring-inset ring-2 ring-amber-300/60',
                                  )}
                                >
                                  {checkinTipRoomId === room.id ? (
                                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
                                      <span>已自入住流程帶入尚欠金額，請確認後再按「確認收款」。</span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="shrink-0 text-sky-900"
                                        onClick={() => setCheckinTipRoomId(null)}
                                      >
                                        了解
                                      </Button>
                                    </div>
                                  ) : null}

                                  <div className="text-base font-semibold text-slate-900">
                                    {room.roomNumber} 號房 — {tname} — 月租 $
                                    {Number(room.monthlyRent || 0).toLocaleString('zh-TW')}
                                  </div>

                                  <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-b from-blue-50/90 to-blue-50/40 p-4 shadow-sm space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 font-semibold text-blue-950">
                                        <Banknote className="h-5 w-5" />
                                        收款作業
                                      </div>
                                      <span className="text-xs text-blue-800/90">
                                        沖帳順序：押金 → 租金 → 電費
                                      </span>
                                    </div>
                                    <p className="text-xs leading-relaxed text-blue-900/85 border-t border-blue-100 pt-2">
                                      若尚無電費帳單，請先於下方填寫度數並按「儲存電錶」，再收電費。
                                    </p>
                                    <div className="grid gap-1 rounded-md bg-white/80 px-3 py-2 text-sm border border-blue-100">
                                      {isCheckInMonth && deposit ? (
                                        <div className="flex justify-between gap-4">
                                          <span className="text-muted-foreground">押金待收</span>
                                          <span
                                            className={
                                              depositRest > 0
                                                ? 'font-medium text-amber-800'
                                                : 'text-emerald-700'
                                            }
                                          >
                                            {formatCents(depositRest)}
                                          </span>
                                        </div>
                                      ) : null}
                                      <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">租金待收</span>
                                        <span
                                          className={
                                            rentRest > 0
                                              ? 'font-medium text-amber-800'
                                              : 'text-emerald-700'
                                          }
                                        >
                                          {rent ? formatCents(rentRest) : '—'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">電費待收</span>
                                        <span
                                          className={
                                            elec && elecRest > 0
                                              ? 'font-medium text-amber-800'
                                              : 'text-emerald-700'
                                          }
                                        >
                                          {elec ? formatCents(elecRest) : '—'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-4 border-t border-blue-100 pt-2 mt-1 text-base font-bold text-blue-950">
                                        <span>尚欠合計</span>
                                        <span>{formatCents(open)}</span>
                                      </div>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <div className="sm:col-span-2">
                                        <Label htmlFor={`pay-amt-${room.id}`}>實收金額（元）</Label>
                                        <Input
                                          id={`pay-amt-${room.id}`}
                                          className="text-lg font-semibold h-11"
                                          inputMode="decimal"
                                          value={payAmountYuan[room.id] ?? ''}
                                          onChange={(e) => {
                                            setPayFieldErrorByRoom((p) => ({ ...p, [room.id]: '' }));
                                            setPayApiErrorByRoom((p) => ({ ...p, [room.id]: '' }));
                                            setPayAmountYuan((p) => ({
                                              ...p,
                                              [room.id]: e.target.value,
                                            }));
                                          }}
                                          placeholder={String(Math.ceil(open / 100))}
                                        />
                                      </div>
                                      <div>
                                        <Label>方式</Label>
                                        <Select
                                          value={payMethod[room.id] ?? 'cash'}
                                          onValueChange={(v) =>
                                            setPayMethod((p) => ({ ...p, [room.id]: v }))
                                          }
                                        >
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
                                      <div className="flex flex-col justify-end gap-1.5">
                                        <span
                                          className="text-xs text-muted-foreground sm:min-h-[1.25rem]"
                                          aria-hidden
                                        >
                                          &nbsp;
                                        </span>
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          className="w-full"
                                          onClick={() =>
                                            setPayAmountYuan((p) => ({
                                              ...p,
                                              [room.id]: String(Math.ceil(open / 100)),
                                            }))
                                          }
                                        >
                                          帶入尚欠
                                        </Button>
                                      </div>
                                      <div className="sm:col-span-2">
                                        <Label htmlFor={`pay-note-${room.id}`}>備註</Label>
                                        <Input
                                          id={`pay-note-${room.id}`}
                                          value={payNotes[room.id] ?? ''}
                                          onChange={(e) =>
                                            setPayNotes((p) => ({ ...p, [room.id]: e.target.value }))
                                          }
                                          placeholder="可選"
                                        />
                                      </div>
                                    </div>
                                    {(payFieldErrorByRoom[room.id] || payApiErrorByRoom[room.id]) && (
                                      <p className="text-sm text-red-600" role="alert">
                                        {payFieldErrorByRoom[room.id] || payApiErrorByRoom[room.id]}
                                      </p>
                                    )}
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        type="button"
                                        className="bg-blue-600 hover:bg-blue-700 min-w-[140px]"
                                        size="lg"
                                        disabled={payBusy[room.id] || open <= 0}
                                        onClick={() => void confirmPayRoom(room, deposit, rent, elec)}
                                      >
                                        {payBusy[room.id] ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : null}
                                        確認收款
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="rounded-lg border bg-white p-4 space-y-3">
                                    <div className="font-medium">【電費】</div>
                                    {meterErrorByRoom[room.id] ? (
                                      <p className="text-sm text-red-600" role="alert">
                                        {meterErrorByRoom[room.id]}
                                      </p>
                                    ) : null}
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <div>
                                        <Label className="text-muted-foreground">上期度數</Label>
                                        <p className="font-mono">
                                          {prev !== null ? prev.toLocaleString('zh-TW') : '—'}
                                        </p>
                                      </div>
                                      <div>
                                        <Label>本期度數</Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          step="1"
                                          value={curVal}
                                          onChange={(e) => {
                                            setMeterErrorByRoom((p) => ({ ...p, [room.id]: '' }));
                                            setMeterDraft((m) => ({
                                              ...m,
                                              [room.id]: {
                                                current: e.target.value,
                                                date: m[room.id]?.date ?? localTodayYmd(),
                                                prev: m[room.id]?.prev ?? null,
                                                loading: m[room.id]?.loading ?? false,
                                              },
                                            }));
                                          }}
                                          placeholder="例如 960 或 0"
                                        />
                                      </div>
                                      <div>
                                        <Label>抄表日期</Label>
                                        <Input
                                          type="date"
                                          value={curDate}
                                          onChange={(e) =>
                                            setMeterDraft((m) => ({
                                              ...m,
                                              [room.id]: {
                                                current: m[room.id]?.current ?? '',
                                                date: e.target.value,
                                                prev: m[room.id]?.prev ?? null,
                                                loading: m[room.id]?.loading ?? false,
                                              },
                                            }))
                                          }
                                        />
                                      </div>
                                      <div className="text-sm">
                                        {usage !== null && (
                                          <>
                                            用電 {usage} 度 × ${(rate / 100).toFixed(1)}/度 = 電費{' '}
                                            {feePreview !== null ? formatCents(feePreview) : '—'}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      disabled={draft?.loading}
                                      onClick={() => void saveMeter(room)}
                                    >
                                      {draft?.loading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : null}
                                      儲存電錶
                                    </Button>
                                    {rawElecRest > 0 && !elec ? (
                                      <p className="text-xs text-muted-foreground">
                                        請先儲存電錶以產生電費帳單。
                                      </p>
                                    ) : null}
                                  </div>

                                  <details className="rounded-lg border border-slate-200 bg-white open:shadow-sm">
                                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                                      <span className="underline decoration-dotted underline-offset-2">
                                        展開費用明細
                                      </span>
                                      <span className="ml-2 text-xs font-normal">（押金／租金／合計）</span>
                                    </summary>
                                    <div className="space-y-4 border-t border-slate-100 p-4">
                                      <div className="rounded-lg border bg-slate-50/80 p-4 space-y-2">
                                        <div className="flex flex-wrap justify-between gap-2">
                                          <span className="font-medium">【押金】</span>
                                          <span>
                                            {isCheckInMonth ? formatCurrency(room.depositAmount) : '—'}{' '}
                                            <span className="text-muted-foreground text-sm">
                                              （{isCheckInMonth ? '入住當月顯示' : '非入住月不列押金'}）
                                            </span>
                                            {isCheckInMonth && deposit ? (
                                              <span className="text-red-600 ml-2">
                                                帳單：{formatCents(deposit.totalAmount)} —{' '}
                                                {depositRest > 0 ? '待收' : '已收'}
                                              </span>
                                            ) : null}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="rounded-lg border bg-slate-50/80 p-4 space-y-2">
                                        <div className="flex flex-wrap justify-between gap-2">
                                          <span className="font-medium">【租金】</span>
                                          <span>
                                            {selectedMonth.replace('-', '年')}月租金：
                                            {rent ? formatCents(rent.totalAmount) : '—'}{' '}
                                            <span className="text-red-600">
                                              狀態：
                                              {rent ? (rentRest > 0 ? '待收' : '已收') : '無帳單'}
                                            </span>
                                          </span>
                                        </div>
                                      </div>
                                      <div className="rounded-lg border bg-slate-100 p-4 space-y-2">
                                        <div className="font-medium">【合計】</div>
                                        <p>
                                          {isCheckInMonth && deposit
                                            ? `押金 ${formatCents(deposit.totalAmount)} + `
                                            : ''}
                                          租金 {rent ? formatCents(rent.totalAmount) : '$0'}
                                          {elec
                                            ? ` + 電費 ${formatCents(elec.totalAmount)}`
                                            : ' + 電費 $0'}{' '}
                                          = 本月合計 {formatCents(totalMonth)}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                          已收 {formatCents(paidMonth)}，尚欠 {formatCents(open)}
                                        </p>
                                      </div>
                                    </div>
                                  </details>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </Fragment>
                      );
                    },
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
