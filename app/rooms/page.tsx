'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ContractSignModal } from '@/components/contract-sign-modal';
import { Edit, FileText, Loader2, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { calcContractEnd, isoDateOnly } from '@/lib/contract-dates';
import { PageHeader } from '@/components/app-shell/page-header';
import { PageShell } from '@/components/app-shell/page-shell';

interface Property {
  id: string;
  name: string;
  address?: string;
  status?: string;
}

interface RoomRow {
  id: string;
  propertyId: string;
  roomNumber: string;
  floor: number;
  monthlyRent: number;
  depositAmount: number;
  electricityRate: number;
  status: string;
}

interface TenantMini {
  id: string;
  roomId: string;
  nameZh: string;
  nameVi: string;
}

interface RoomFormData {
  roomNumber: string;
  floor: number;
  monthlyRent: number;
  depositAmount: number;
  electricityPrice: number;
}

interface CheckinFormData {
  name: string;
  phone: string;
  passportNumber: string;
  checkInDate: string;
  contractMonths: number;
  initialMeterReading: number;
}

const statusLabel: Record<string, string> = {
  vacant: '空房',
  occupied: '已入住',
  reserved: '已預訂',
  maintenance: '維修中',
};

const ROOM_STATUS_FILTERS = ['vacant', 'occupied', 'reserved', 'maintenance'] as const;

function formatFloorDisplay(floor: number): string {
  if (!Number.isFinite(floor)) return '—';
  if (floor < 0) return `B${Math.abs(floor)}`;
  return `${floor}F`;
}

function buildRoomsPath(parts: { property: string; floor: string; status: string }): string {
  const q = new URLSearchParams();
  if (parts.property !== 'all') q.set('propertyId', parts.property);
  if (parts.floor !== 'all') q.set('floor', parts.floor);
  if (parts.status !== 'all') q.set('status', parts.status);
  const s = q.toString();
  return s ? `/rooms?${s}` : '/rooms';
}

function isRoomStatusFilter(s: string): s is (typeof ROOM_STATUS_FILTERS)[number] {
  return (ROOM_STATUS_FILTERS as readonly string[]).includes(s);
}

function normalizeProperties(raw: Property[]): Property[] {
  const seen = new Set<string>();
  return (Array.isArray(raw) ? raw : [])
    .filter((p) => p && (p as { status?: string }).status !== 'archived')
    .map((p) => ({
      ...p,
      id: String((p as { id?: unknown }).id ?? '').trim(),
      name: String((p as { name?: unknown }).name ?? '未命名物業').trim() || '未命名物業',
    }))
    .filter((p) => {
      if (!p.id) return false;
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
}

function RoomsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [tenants, setTenants] = useState<TenantMini[]>([]);
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roomFormOpen, setRoomFormOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomRow | null>(null);
  const [roomFormData, setRoomFormData] = useState<RoomFormData>({
    roomNumber: '',
    floor: 1,
    monthlyRent: 0,
    depositAmount: 0,
    electricityPrice: 6,
  });
  const [savingRoom, setSavingRoom] = useState(false);

  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinRoom, setCheckinRoom] = useState<RoomRow | null>(null);
  const [checkinForm, setCheckinForm] = useState<CheckinFormData>(() => {
    const today = new Date().toISOString().split('T')[0] ?? '';
    return {
      name: '',
      phone: '',
      passportNumber: '',
      checkInDate: today,
      contractMonths: 12,
      initialMeterReading: 0,
    };
  });
  const [savingCheckin, setSavingCheckin] = useState(false);

  const [contractOpen, setContractOpen] = useState(false);
  const [contractCtx, setContractCtx] = useState<{
    tenantId: string;
    room: RoomRow;
    tenantName: string;
    startYmd: string;
    endYmd: string;
    propertyAddress: string;
  } | null>(null);

  const [viewContractOpen, setViewContractOpen] = useState(false);
  const [viewContractHtml, setViewContractHtml] = useState('');
  const [viewContractSig, setViewContractSig] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plist, rlist, tlist] = await Promise.all([
        api.get<Property[]>('/api/properties'),
        api.get<RoomRow[]>('/api/rooms'),
        api.get<TenantMini[]>('/api/tenants'),
      ]);
      setProperties(normalizeProperties(Array.isArray(plist) ? plist : []));
      setRooms(
        (Array.isArray(rlist) ? rlist : []).map((r) => ({
          ...r,
          roomNumber: String((r as { roomNumber?: string }).roomNumber ?? ''),
          propertyId: String((r as { propertyId?: string }).propertyId ?? ''),
          floor: Number((r as { floor?: number }).floor ?? 0),
          monthlyRent: Number((r as { monthlyRent?: number }).monthlyRent ?? 0),
          depositAmount: Number((r as { depositAmount?: number }).depositAmount ?? 0),
          electricityRate: Number((r as { electricityRate?: number }).electricityRate ?? 0),
          status: String((r as { status?: string }).status ?? ''),
        })),
      );
      setTenants(
        (Array.isArray(tlist) ? tlist : []).map((t) => ({
          id: String(t.id),
          roomId: String((t as { roomId?: string }).roomId ?? ''),
          nameZh: (t as { nameZh?: string }).nameZh ?? '',
          nameVi: (t as { nameVi?: string }).nameVi ?? '',
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const raw = searchParams.get('propertyId');
    const p = raw?.trim() ?? '';
    if (!p) {
      setPropertyFilter('all');
      return;
    }
    if (properties.length === 0) return;
    if (properties.some((x) => x.id === p)) {
      setPropertyFilter(p);
    } else {
      setPropertyFilter('all');
    }
  }, [searchParams, properties]);

  useEffect(() => {
    const fl = searchParams.get('floor');
    const st = searchParams.get('status');
    setFloorFilter(fl && fl !== '' && fl !== 'all' ? fl : 'all');
    setStatusFilter(st && isRoomStatusFilter(st) ? st : 'all');
  }, [searchParams]);

  const onPropertyFilterChange = useCallback(
    (value: string) => {
      setPropertyFilter(value);
      setFloorFilter('all');
      router.replace(buildRoomsPath({ property: value, floor: 'all', status: statusFilter }), {
        scroll: false,
      });
    },
    [router, statusFilter],
  );

  const onFloorFilterChange = useCallback(
    (value: string) => {
      setFloorFilter(value);
      router.replace(
        buildRoomsPath({ property: propertyFilter, floor: value, status: statusFilter }),
        { scroll: false },
      );
    },
    [router, propertyFilter, statusFilter],
  );

  const onStatusFilterChange = useCallback(
    (value: string) => {
      setStatusFilter(value);
      router.replace(
        buildRoomsPath({ property: propertyFilter, floor: floorFilter, status: value }),
        { scroll: false },
      );
    },
    [router, propertyFilter, floorFilter],
  );

  const propName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of properties) m.set(p.id, p.name);
    return m;
  }, [properties]);

  const propAddress = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of properties) m.set(p.id, p.address ?? '');
    return m;
  }, [properties]);

  const tenantByRoom = useMemo(() => {
    const m = new Map<string, TenantMini>();
    for (const t of tenants) {
      if (t.roomId) m.set(t.roomId, t);
    }
    return m;
  }, [tenants]);

  const roomsScopedByProperty = useMemo(() => {
    if (propertyFilter === 'all') return rooms;
    return rooms.filter((r) => r.propertyId === propertyFilter);
  }, [rooms, propertyFilter]);

  const floorOptions = useMemo(() => {
    const set = new Set<number>();
    for (const r of roomsScopedByProperty) {
      if (Number.isFinite(r.floor)) set.add(r.floor);
    }
    return [...set].sort((a, b) => a - b);
  }, [roomsScopedByProperty]);

  const filteredRooms = useMemo(() => {
    let list = roomsScopedByProperty;
    if (floorFilter !== 'all') {
      const fn = Number(floorFilter);
      list = list.filter((r) => Number.isFinite(r.floor) && r.floor === fn);
    }
    if (statusFilter !== 'all') {
      list = list.filter((r) => r.status === statusFilter);
    }
    return list;
  }, [roomsScopedByProperty, floorFilter, statusFilter]);

  const sortedRooms = useMemo(() => {
    return [...filteredRooms].sort((a, b) => {
      const na = propName.get(a.propertyId) ?? '';
      const nb = propName.get(b.propertyId) ?? '';
      if (na !== nb) return na.localeCompare(nb, 'zh-Hant');
      const fa = Number.isFinite(a.floor) ? a.floor : 0;
      const fb = Number.isFinite(b.floor) ? b.floor : 0;
      if (fa !== fb) return fa - fb;
      return a.roomNumber.localeCompare(b.roomNumber, 'zh-Hant', { numeric: true });
    });
  }, [filteredRooms, propName]);

  const showManyRoomsHint = propertyFilter === 'all' && properties.length > 1 && rooms.length > 0;

  const handleRoomFormChange = (field: keyof RoomFormData, value: string | number) => {
    setRoomFormData((prev) => ({ ...prev, [field]: value }));
  };

  const openAddRoom = () => {
    if (propertyFilter === 'all') {
      alert('請先於上方篩選選擇要新增房間的物業');
      return;
    }
    setEditingRoom(null);
    setRoomFormData({
      roomNumber: '',
      floor: 1,
      monthlyRent: 0,
      depositAmount: 0,
      electricityPrice: 6,
    });
    setRoomFormOpen(true);
  };

  const openEditRoom = (room: RoomRow) => {
    setEditingRoom(room);
    setRoomFormData({
      roomNumber: room.roomNumber,
      floor: room.floor,
      monthlyRent: room.monthlyRent,
      depositAmount: room.depositAmount,
      electricityPrice: room.electricityRate ? room.electricityRate / 100 : 6,
    });
    setRoomFormOpen(true);
  };

  const handleSubmitRoomForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const propertyId = editingRoom?.propertyId ?? (propertyFilter !== 'all' ? propertyFilter : '');
    if (!propertyId) {
      alert('無法判斷物業，請先選擇物業');
      return;
    }

    const payload = {
      propertyId,
      roomNumber: roomFormData.roomNumber.trim(),
      floor: Number(roomFormData.floor || 1),
      monthlyRent: Number(roomFormData.monthlyRent || 0),
      depositAmount: Number(roomFormData.depositAmount || 0),
      electricityRate: Math.round(Number(roomFormData.electricityPrice || 0) * 100),
      status: editingRoom?.status ?? 'vacant',
    };

    if (!payload.roomNumber) {
      alert('請輸入房號');
      return;
    }

    setSavingRoom(true);
    try {
      if (editingRoom) {
        await api.put<RoomRow>(`/api/rooms/${editingRoom.id}`, payload);
      } else {
        await api.post<RoomRow>('/api/rooms', payload);
      }
      setRoomFormOpen(false);
      await load();
    } catch (err) {
      console.error('儲存房間失敗', err);
      alert(err instanceof Error ? err.message : '儲存房間失敗，請稍後再試');
    } finally {
      setSavingRoom(false);
    }
  };

  const handleDeleteRoom = async (room: RoomRow) => {
    if (!confirm(`確定要刪除房間 ${room.roomNumber} 嗎？`)) return;
    try {
      await api.delete(`/api/rooms/${room.id}`);
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
      await load();
    } catch (err) {
      console.error('刪除房間失敗', err);
      alert(err instanceof Error ? err.message : '刪除失敗，請稍後再試');
    }
  };

  const openCheckinModal = (room: RoomRow) => {
    setCheckinRoom(room);
    const today = new Date().toISOString().split('T')[0] ?? '';
    setCheckinForm({
      name: '',
      phone: '',
      passportNumber: '',
      checkInDate: today,
      contractMonths: 12,
      initialMeterReading: 0,
    });
    setCheckinOpen(true);
  };

  const handleSubmitCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkinRoom) return;

    const name = checkinForm.name.trim();
    if (!name) {
      alert('請輸入租客姓名');
      return;
    }
    if (!checkinForm.phone.trim()) {
      alert('請輸入電話');
      return;
    }

    const end = calcContractEnd(checkinForm.checkInDate, checkinForm.contractMonths);
    const expectedCheckoutDate = isoDateOnly(end);
    const rentAmount = checkinRoom.monthlyRent;
    const depositAmount = checkinRoom.depositAmount;
    const propertyId = checkinRoom.propertyId;

    setSavingCheckin(true);
    try {
      const result = await api.post<{ tenant: { id: string } }>('/api/checkin/complete', {
        roomId: checkinRoom.id,
        propertyId,
        nameZh: name,
        nameVi: name,
        phone: checkinForm.phone.trim(),
        passportNumber: checkinForm.passportNumber.trim() || undefined,
        checkInDate: checkinForm.checkInDate,
        expectedCheckoutDate,
        paymentType: 'full',
        rentAmount,
        depositAmount,
        paidAmount: 0,
        paymentAmount: 0,
      });

      await api.post('/api/meter-readings', {
        roomId: checkinRoom.id,
        readingValue: Number(checkinForm.initialMeterReading) || 0,
        readingDate: checkinForm.checkInDate,
      });

      setCheckinOpen(false);
      const tid = result.tenant?.id;
      const addr = propAddress.get(propertyId) ?? '';
      if (tid) {
        setContractCtx({
          tenantId: tid,
          room: checkinRoom,
          tenantName: name,
          startYmd: checkinForm.checkInDate,
          endYmd: expectedCheckoutDate,
          propertyAddress: addr,
        });
        setContractOpen(true);
      }
      setCheckinRoom(null);
      await load();
    } catch (err) {
      console.error('入住失敗', err);
      alert(err instanceof Error ? err.message : '入住失敗，請稍後再試');
    } finally {
      setSavingCheckin(false);
    }
  };

  const openViewContract = (room: RoomRow) => {
    const t = tenants.find((x) => x.roomId === room.id);
    if (!t) {
      alert('找不到租客資料');
      return;
    }
    try {
      const raw = localStorage.getItem(`contract_${t.id}`);
      if (!raw) {
        alert('尚無已簽署合約資料');
        return;
      }
      const parsed = JSON.parse(raw) as {
        contractHtml: string;
        signatureBase64?: string;
      };
      setViewContractHtml(parsed.contractHtml);
      setViewContractSig(parsed.signatureBase64 ?? null);
      setViewContractOpen(true);
    } catch {
      alert('讀取合約失敗');
    }
  };

  const renderRoomActions = (r: RoomRow) => {
    const wrap = 'flex flex-wrap gap-1.5 justify-end max-w-[320px] ml-auto';
    if (r.status === 'vacant') {
      return (
        <div className={wrap}>
          <Button type="button" size="sm" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => openCheckinModal(r)}>
            入住
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => openEditRoom(r)}>
            <Edit className="h-3.5 w-3.5 mr-1" />
            編輯
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200"
            onClick={() => void handleDeleteRoom(r)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    }
    if (r.status === 'occupied') {
      return (
        <div className={wrap}>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={`/checkout?roomId=${encodeURIComponent(r.id)}`}>退租</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => openViewContract(r)}>
            <FileText className="h-3.5 w-3.5 mr-1" />
            合約
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => openEditRoom(r)}>
            <Edit className="h-3.5 w-3.5 mr-1" />
            編輯
          </Button>
        </div>
      );
    }
    return (
      <div className={wrap}>
        <Button type="button" variant="outline" size="sm" onClick={() => openEditRoom(r)}>
          <Edit className="h-3.5 w-3.5 mr-1" />
          編輯
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-red-600 border-red-200"
          onClick={() => void handleDeleteRoom(r)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };

  return (
    <PageShell>
      <PageHeader
        title="房間管理"
        description="主要工作台：入住、退租、合約、編輯／新增房間皆可於此處操作。請先以篩選縮小列表；物業主檔請至「物業管理」。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {propertyFilter !== 'all' && (
              <Button type="button" onClick={openAddRoom} disabled={loading}>
                <Plus className="mr-2 h-4 w-4" />
                新增房間
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              重新整理
            </Button>
          </div>
        }
      />

      <Card className="mb-4 border-dashed">
        <CardContent className="py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">與物業管理的分工</span>
          「物業管理」用於建立／編輯物業主檔；日常營運以本頁為主。若需查看物業地址與房東合約摘要，仍可從列表前往
          <Link className="ml-1 font-medium text-foreground underline-offset-2 hover:underline" href="/properties">
            物業列表
          </Link>
          開啟物業詳情。
        </CardContent>
      </Card>

      {showManyRoomsHint && (
        <Card className="mb-4 border-amber-200 bg-amber-50/80">
          <CardContent className="py-3 text-sm text-amber-950">
            列表跨多個物業時筆數可能較多，建議先選擇<strong>物業</strong>，再以<strong>樓層</strong>縮小範圍。
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">篩選</CardTitle>
          <CardDescription>
            物業、樓層、狀態會同步至網址列（可書籤／分享）；變更物業時會重置樓層篩選。新增房間前請先選定物業。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <span className="text-sm font-medium">物業</span>
            <Select value={propertyFilter} onValueChange={onPropertyFilterChange}>
              <SelectTrigger className="w-[240px]">
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
          </div>
          <div className="space-y-1">
            <span className="text-sm font-medium">樓層</span>
            <Select
              value={floorFilter}
              onValueChange={onFloorFilterChange}
              disabled={!loading && floorOptions.length === 0}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="全部樓層" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部樓層</SelectItem>
                {floorOptions.map((f) => (
                  <SelectItem key={f} value={String(f)}>
                    {formatFloorDisplay(f)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-sm font-medium">房間狀態</span>
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="全部狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                {ROOM_STATUS_FILTERS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {statusLabel[k] ?? k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-4 border-red-200">
          <CardContent className="pt-6 text-red-600">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">房間列表</CardTitle>
          <CardDescription>共 {sortedRooms.length} 間（已依物業、樓層、房號排序）</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              載入中…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>物業</TableHead>
                  <TableHead>房號</TableHead>
                  <TableHead className="text-right">樓層</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead className="text-right">月租</TableHead>
                  <TableHead>租客</TableHead>
                  <TableHead className="min-w-[300px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRooms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      尚無符合條件的房間，請調整篩選或確認物業內是否已建立房間。
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRooms.map((r) => {
                    const tn = tenantByRoom.get(r.id);
                    const name = tn?.nameZh || tn?.nameVi || '—';
                    const st = statusLabel[r.status] ?? r.status;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{propName.get(r.propertyId) ?? '—'}</TableCell>
                        <TableCell>{r.roomNumber}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatFloorDisplay(r.floor)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {st}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number.isFinite(r.monthlyRent) ? r.monthlyRent : 0)}
                        </TableCell>
                        <TableCell>{r.status === 'occupied' ? name : '—'}</TableCell>
                        <TableCell className="text-right align-top">{renderRoomActions(r)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={roomFormOpen} onOpenChange={setRoomFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRoom ? '編輯房間' : '新增房間'}</DialogTitle>
            <DialogDescription>請輸入房號、樓層與租金；電費單價以「元/度」輸入。</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitRoomForm}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="roomNumber">房號</Label>
                <Input
                  id="roomNumber"
                  value={roomFormData.roomNumber}
                  onChange={(e) => handleRoomFormChange('roomNumber', e.target.value)}
                  placeholder="例如：101"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="floor">樓層</Label>
                <Input
                  id="floor"
                  type="number"
                  min={1}
                  value={roomFormData.floor}
                  onChange={(e) => handleRoomFormChange('floor', parseInt(e.target.value, 10) || 1)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthlyRent">月租金（元）</Label>
                <Input
                  id="monthlyRent"
                  type="number"
                  min={0}
                  value={roomFormData.monthlyRent}
                  onChange={(e) => handleRoomFormChange('monthlyRent', parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="depositAmount">押金（元）</Label>
                <Input
                  id="depositAmount"
                  type="number"
                  min={0}
                  value={roomFormData.depositAmount}
                  onChange={(e) => handleRoomFormChange('depositAmount', parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="electricityPrice">電費單價（元/度）</Label>
                <Input
                  id="electricityPrice"
                  type="number"
                  min={0}
                  step={0.1}
                  value={roomFormData.electricityPrice}
                  onChange={(e) => handleRoomFormChange('electricityPrice', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRoomFormOpen(false)} disabled={savingRoom}>
                取消
              </Button>
              <Button type="submit" disabled={savingRoom}>
                {savingRoom ? '儲存中…' : '儲存'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>安排入住{checkinRoom ? ` — ${checkinRoom.roomNumber} 號房` : ''}</DialogTitle>
            <DialogDescription>
              送出後房間將標示為已入住；請至「收款明細」處理待收款項。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitCheckin}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="tenantName">租客姓名</Label>
                <Input
                  id="tenantName"
                  value={checkinForm.name}
                  onChange={(e) => setCheckinForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">電話</Label>
                <Input
                  id="phone"
                  value={checkinForm.phone}
                  onChange={(e) => setCheckinForm((prev) => ({ ...prev, phone: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passportNumber">護照／居留證號碼</Label>
                <Input
                  id="passportNumber"
                  value={checkinForm.passportNumber}
                  onChange={(e) => setCheckinForm((prev) => ({ ...prev, passportNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkInDate">入住日期</Label>
                <Input
                  id="checkInDate"
                  type="date"
                  value={checkinForm.checkInDate}
                  onChange={(e) => setCheckinForm((prev) => ({ ...prev, checkInDate: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contractMonths">合約期限</Label>
                <select
                  id="contractMonths"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={checkinForm.contractMonths}
                  onChange={(e) =>
                    setCheckinForm((prev) => ({
                      ...prev,
                      contractMonths: Number(e.target.value) || 1,
                    }))
                  }
                >
                  <option value={1}>1 個月</option>
                  <option value={3}>3 個月</option>
                  <option value={6}>6 個月</option>
                  <option value={12}>1 年</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>合約到期日（自動計算）</Label>
                <Input
                  readOnly
                  value={isoDateOnly(calcContractEnd(checkinForm.checkInDate, checkinForm.contractMonths))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="initialMeterReading">入住電錶度數</Label>
                <Input
                  id="initialMeterReading"
                  type="number"
                  min={0}
                  value={checkinForm.initialMeterReading || ''}
                  onChange={(e) =>
                    setCheckinForm((prev) => ({
                      ...prev,
                      initialMeterReading: Number(e.target.value) || 0,
                    }))
                  }
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCheckinOpen(false)} disabled={savingCheckin}>
                取消
              </Button>
              <Button type="submit" disabled={savingCheckin || !checkinRoom}>
                {savingCheckin ? '處理中…' : '確認入住'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {contractCtx && (
        <ContractSignModal
          open={contractOpen}
          onClose={() => {
            setContractOpen(false);
            setContractCtx(null);
          }}
          tenantId={contractCtx.tenantId}
          roomId={contractCtx.room.id}
          tenantName={contractCtx.tenantName}
          roomNumber={contractCtx.room.roomNumber}
          propertyAddress={contractCtx.propertyAddress}
          startDateYmd={contractCtx.startYmd}
          endDateYmd={contractCtx.endYmd}
          monthlyRentYuan={contractCtx.room.monthlyRent}
          depositYuan={contractCtx.room.depositAmount}
          electricityYuanPerDeg={contractCtx.room.electricityRate ? contractCtx.room.electricityRate / 100 : 0}
        />
      )}

      <Dialog open={viewContractOpen} onOpenChange={setViewContractOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>合約</DialogTitle>
            <DialogDescription>已簽署之合約內容與簽名</DialogDescription>
          </DialogHeader>
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: viewContractHtml }} />
          {viewContractSig ? (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">乙方簽名</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={viewContractSig} alt="簽名" className="max-w-full rounded border" />
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setViewContractOpen(false)}>
              關閉
            </Button>
            <Button type="button" onClick={() => window.print()}>
              列印
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

export default function RoomsPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <div className="flex justify-center py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </PageShell>
      }
    >
      <RoomsPageInner />
    </Suspense>
  );
}
