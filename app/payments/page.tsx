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
import { CalendarRange, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { formatCents } from '@/lib/utils';
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
  monthlyRent: number;
  depositAmount: number;
  electricityRate: number;
}

interface TenantRow {
  id: string;
  roomId: string;
  nameZh: string;
  nameVi?: string;
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

function restCents(p: PaymentRow | null): number {
  if (!p) return 0;
  return Math.max(0, Number(p.totalAmount || 0) - Number(p.paidAmount || 0));
}

function estimateElectricityFeeCents(usageDeg: number, electricityRateCentsPerDeg: number): number {
  return Math.round(usageDeg * (electricityRateCentsPerDeg / 100) * 100);
}

export default function PaymentsPage() {
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

  /** roomId -> 上期度數、本期輸入、日期、busy */
  const [meterDraft, setMeterDraft] = useState<
    Record<string, { current: string; date: string; prev: number | null; loading: boolean }>
  >({});
  const [payBusy, setPayBusy] = useState<Record<string, boolean>>({});
  const [payAmountYuan, setPayAmountYuan] = useState<Record<string, string>>({});
  const [payMethod, setPayMethod] = useState<Record<string, string>>({});
  const [payNotes, setPayNotes] = useState<Record<string, string>>({});

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
      setTenants(Array.isArray(tns) ? tns : []);
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
      const rent = forRoom.find((p) => p.lineType === 'rent') ?? null;
      const elec = forRoom.find((p) => p.lineType === 'electricity') ?? null;
      const tenant = tenantByRoom.get(room.id);
      const rentRest = restCents(rent);
      const elecRest = restCents(elec);
      const settled = Boolean(
        rent && rentRest === 0 && (!elec || elecRest === 0),
      );
      return { room, tenant, rent, elec, rentRest, elecRest, settled };
    });
  }, [occupiedRooms, payments, selectedMonth, tenantByRoom]);

  const stats = useMemo(() => {
    const totalRooms = occupiedRooms.length;
    let done = 0;
    let pend = 0;
    let due = 0;
    let collected = 0;
    for (const r of roomRows) {
      const tr = r.rent ? Number(r.rent.totalAmount) : 0;
      const tp = r.rent ? Number(r.rent.paidAmount) : 0;
      const er = r.elec ? Number(r.elec.totalAmount) : 0;
      const ep = r.elec ? Number(r.elec.paidAmount) : 0;
      due += tr + er;
      collected += tp + ep;
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
    try {
      const res = await api.post<{ created?: unknown[]; skipped?: unknown[] }>(
        '/api/payments/generate-monthly',
        { paymentMonth: selectedMonth },
      );
      alert(`已建立 ${res.created?.length ?? 0} 筆，略過 ${res.skipped?.length ?? 0} 筆`);
      await loadContext();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : '建立失敗');
    } finally {
      setMonthlyBusy(false);
    }
  };

  const saveMeter = async (room: Room) => {
    const d = meterDraft[room.id];
    if (!d) return;
    const v = parseFloat(d.current.replace(/,/g, ''));
    if (Number.isNaN(v) || v < 0) {
      alert('請輸入有效度數');
      return;
    }
    setMeterDraft((prev) => ({
      ...prev,
      [room.id]: { ...d, loading: true },
    }));
    try {
      await api.post('/api/meter-readings', {
        roomId: room.id,
        readingValue: Math.round(v),
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
      alert(e instanceof ApiError ? e.message : '儲存電錶失敗');
      setMeterDraft((prev) => ({
        ...prev,
        [room.id]: { ...prev[room.id]!, loading: false },
      }));
    }
  };

  const confirmPayRoom = async (room: Room, rent: PaymentRow | null, elec: PaymentRow | null) => {
    const key = room.id;
    const yuan = parseFloat((payAmountYuan[key] || '0').replace(/,/g, ''));
    if (Number.isNaN(yuan) || yuan <= 0) {
      alert('請輸入實收金額（元）');
      return;
    }
    setPayBusy((b) => ({ ...b, [key]: true }));
    try {
      const cents = Math.round(yuan * 100);
      const method = payMethod[key] || 'cash';
      const notes = payNotes[key] || '';
      let left = cents;
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
      alert(e instanceof ApiError ? e.message : '收款失敗');
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
        title="收租管理"
        description="先抄電錶，再生成帳單，最後收款"
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
        </CardContent>
      </Card>

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

        {roomRows.map(({ room, tenant, rent, elec, rentRest, elecRest, settled }) => {
          const tname = tenant?.nameZh || tenant?.nameVi || '—';
          const rate = room.electricityRate ?? 600;
          const draft = meterDraft[room.id];
          const prev = draft?.prev ?? null;
          const curVal = draft?.current ?? '';
          const curDate = draft?.date ?? localTodayYmd();
          const inputNum = parseFloat(String(curVal).replace(/,/g, ''));
          const usage =
            prev !== null && !Number.isNaN(inputNum) ? Math.max(0, inputNum - prev) : null;
          const feePreview =
            usage !== null ? estimateElectricityFeeCents(usage, rate) : null;
          const totalMonth =
            (rent ? Number(rent.totalAmount) : 0) + (elec ? Number(elec.totalAmount) : 0);
          const paidMonth =
            (rent ? Number(rent.paidAmount) : 0) + (elec ? Number(elec.paidAmount) : 0);
          const open = rentRest + elecRest;

          if (settled && rent) {
            return (
              <Card key={room.id} className="border-emerald-200 bg-emerald-50/40">
                <CardHeader className="py-3">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <ChevronRight className="h-4 w-4" />
                    <span className="font-semibold">
                      ✅ {room.roomNumber} — {tname}｜租金{' '}
                      {rent ? formatCents(rent.totalAmount) : '$0'}
                      {elec ? ` + 電費 ${formatCents(elec.totalAmount)}` : ''} = {formatCents(totalMonth)} 已收完
                    </span>
                  </div>
                </CardHeader>
              </Card>
            );
          }

          return (
            <Card key={room.id} className="border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  {room.roomNumber} 號房 — {tname} — 月租 ${Number(room.monthlyRent || 0).toLocaleString('zh-TW')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-white p-4 space-y-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">【租金】</span>
                    <span>
                      {selectedMonth.replace('-', '年')}月租金：{rent ? formatCents(rent.totalAmount) : '—'}{' '}
                      <span className="text-red-600">
                        狀態：{rent ? (rentRest > 0 ? '待收' : '已收') : '無帳單'}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border bg-white p-4 space-y-3">
                  <div className="font-medium">【電費】</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">上期度數</Label>
                      <p className="font-mono">{prev !== null ? prev.toLocaleString('zh-TW') : '—'}</p>
                    </div>
                    <div>
                      <Label>本期度數</Label>
                      <Input
                        value={curVal}
                        onChange={(e) =>
                          setMeterDraft((m) => ({
                            ...m,
                            [room.id]: {
                              current: e.target.value,
                              date: m[room.id]?.date ?? localTodayYmd(),
                              prev: m[room.id]?.prev ?? null,
                              loading: m[room.id]?.loading ?? false,
                            },
                          }))
                        }
                        placeholder="例如 960"
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
                    {draft?.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    儲存電錶
                  </Button>
                </div>

                <div className="rounded-lg border bg-slate-50 p-4 space-y-2">
                  <div className="font-medium">【合計】</div>
                  <p>
                    租金 {rent ? formatCents(rent.totalAmount) : '$0'} + 電費{' '}
                    {elec ? formatCents(elec.totalAmount) : '$0'} = 本月合計{' '}
                    {formatCents((rent?.totalAmount || 0) + (elec?.totalAmount || 0))}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    已收 {formatCents(paidMonth)}，尚欠 {formatCents(open)}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>實收金額（元）</Label>
                    <Input
                      value={payAmountYuan[room.id] ?? ''}
                      onChange={(e) =>
                        setPayAmountYuan((p) => ({ ...p, [room.id]: e.target.value }))
                      }
                      placeholder={String(Math.ceil(open / 100))}
                    />
                  </div>
                  <div>
                    <Label>方式</Label>
                    <Select
                      value={payMethod[room.id] ?? 'cash'}
                      onValueChange={(v) => setPayMethod((p) => ({ ...p, [room.id]: v }))}
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
                  <div className="sm:col-span-2">
                    <Label>備註</Label>
                    <Input
                      value={payNotes[room.id] ?? ''}
                      onChange={(e) =>
                        setPayNotes((p) => ({ ...p, [room.id]: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={payBusy[room.id] || open <= 0}
                    onClick={() => void confirmPayRoom(room, rent, elec)}
                  >
                    {payBusy[room.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    確認收款
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
