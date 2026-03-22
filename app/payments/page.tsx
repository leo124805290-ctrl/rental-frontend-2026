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
import { CalendarRange, Loader2, Receipt } from 'lucide-react';
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

  const handleGenerateElectricity = async () => {
    if (selectedRoomId === 'all') {
      alert('請先選擇單一房間再生成電費帳單');
      return;
    }
    const room = rooms.find((r) => r.id === selectedRoomId);
    if (!room) return;
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
        description="帳簿式檢視：依物業／房間／月份篩選，逐筆收款。"
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
            <Button variant="secondary" onClick={handleGenerateElectricity}>
              <Receipt className="mr-2 h-4 w-4" />
              生成電費帳單（當前房間）
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

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>帳單列表</CardTitle>
          <CardDescription>共 {rows.length} 筆（金額單位：元）</CardDescription>
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
                    <TableHead>日期</TableHead>
                    <TableHead>房號</TableHead>
                    <TableHead>租客</TableHead>
                    <TableHead>類型</TableHead>
                    <TableHead className="text-right">預計金額</TableHead>
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
                      : p.paymentMonth;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap">{dateStr}</TableCell>
                        <TableCell>{p.roomNumber ?? '—'}</TableCell>
                        <TableCell>{p.tenantName ?? '—'}</TableCell>
                        <TableCell>{LINE_LABEL[lt] ?? lt}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCents(p.totalAmount)}
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
              可多次收款，累加實收；金額以新台幣「元」輸入（會換算為分送後端）。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>預計 / 已收</Label>
              <p className="text-sm text-muted-foreground">
                {active
                  ? `${formatCents(active.totalAmount)}／${formatCents(active.paidAmount)}`
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
