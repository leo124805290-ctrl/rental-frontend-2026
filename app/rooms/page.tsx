'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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

function RoomsPageInner() {
  const searchParams = useSearchParams();
  const initialPid = searchParams.get('propertyId') || 'all';

  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [tenants, setTenants] = useState<TenantMini[]>([]);
  const [propertyFilter, setPropertyFilter] = useState(initialPid);
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
      setProperties(Array.isArray(plist) ? plist.filter((p) => p.status !== 'archived') : []);
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

  useEffect(() => {
    const p = searchParams.get('propertyId');
    if (p) setPropertyFilter(p);
  }, [searchParams]);

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

  const filteredRooms = useMemo(() => {
    if (propertyFilter === 'all') return rooms;
    return rooms.filter((r) => r.propertyId === propertyFilter);
  }, [rooms, propertyFilter]);

  const sortedRooms = useMemo(() => {
    return [...filteredRooms].sort((a, b) => {
      const na = propName.get(a.propertyId) ?? '';
      const nb = propName.get(b.propertyId) ?? '';
      if (na !== nb) return na.localeCompare(nb, 'zh-Hant');
      return a.roomNumber.localeCompare(b.roomNumber, 'zh-Hant', { numeric: true });
    });
  }, [filteredRooms, propName]);

  return (
    <PageShell>
      <PageHeader
        title="房間管理"
        description="檢視與篩選所有房間；新增／編輯房間與租客請至對應物業內操作。"
        actions={
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            重新整理
          </Button>
        }
      />

      <Card className="mb-4 border-dashed">
        <CardContent className="py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">物業管理</span>
          僅維護房東合約與物業主檔；本頁集中檢視各房狀態。若要編輯單一房間或辦入住，請點「前往物業」。
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">篩選</CardTitle>
          <CardDescription>依物業縮小列表</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <span className="text-sm font-medium">物業</span>
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger className="w-[240px]">
                <SelectValue />
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
          <CardDescription>共 {sortedRooms.length} 間</CardDescription>
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
                  <TableHead className="w-[120px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRooms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      尚無房間資料
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
                        <TableCell className="text-right tabular-nums">{r.floor}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {st}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(r.monthlyRent)}</TableCell>
                        <TableCell>{r.status === 'occupied' ? name : '—'}</TableCell>
                        <TableCell>
                          <Button variant="secondary" size="sm" asChild>
                            <Link href={`/properties/${r.propertyId}`}>前往物業</Link>
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
