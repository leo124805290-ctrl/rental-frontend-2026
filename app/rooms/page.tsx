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
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api-client';
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
  status: string;
}

interface TenantMini {
  id: string;
  roomId: string;
  nameZh: string;
  nameVi: string;
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

  /** URL：物業 id（須等列表載入後再套用，避免 Select 無選項） */
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

  /** URL：樓層、狀態 */
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

  return (
    <PageShell>
      <PageHeader
        title="房間管理"
        description="處理入住／退租、合約與房間編輯：請先選物業，再依樓層或狀態篩選；細部操作請至「物業詳情」。物業主檔請至「物業管理」。"
        actions={
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            重新整理
          </Button>
        }
      />

      <Card className="mb-4 border-dashed">
        <CardContent className="py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">與物業管理的分工</span>
          「物業管理」僅維護名下物業主檔；本頁為
          <span className="font-medium text-foreground"> 房間營運總覽 </span>
          （可篩選物業、樓層、狀態）。若需編輯單一房、辦入住或合約，請按「前往物業詳情」。
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
            物業、樓層、狀態會同步至網址列（可書籤／分享）；變更物業時會重置樓層篩選。
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
                  <TableHead className="w-[140px]">操作</TableHead>
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
                        <TableCell>
                          <Button variant="secondary" size="sm" asChild>
                            <Link href={`/properties/${r.propertyId}`}>前往物業詳情</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
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
