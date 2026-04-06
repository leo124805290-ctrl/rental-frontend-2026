'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
import { PageHeader } from '@/components/app-shell/page-header';
import { PageShell } from '@/components/app-shell/page-shell';
import { formatCurrency, formatDate } from '@/lib/utils';
import { api } from '@/lib/api-client';

interface TenantRow {
  id: string;
  roomId?: string;
  propertyId?: string;
  nameZh?: string;
  nameVi?: string;
  checkInDate?: string;
  actualCheckoutDate?: string;
  expectedCheckoutDate?: string;
  status?: string;
}

interface PropertyRow {
  id: string;
  name: string;
}

interface RoomRow {
  id: string;
  propertyId: string;
  roomNumber: string;
  monthlyRent?: number;
}

const PROP_ALL = '__all__';

function termLabel(checkIn?: string, expectedEnd?: string): string {
  if (!checkIn || !expectedEnd) return '—';
  const a = new Date(checkIn);
  const b = new Date(expectedEnd);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '—';
  const months = Math.max(
    0,
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()),
  );
  if (months >= 12 && months % 12 === 0) return `${months / 12}年`;
  if (months === 0) return '—';
  return `${months}個月`;
}

export default function HistoryPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [propertyFilter, setPropertyFilter] = useState<string>(PROP_ALL);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tRaw, pRaw, rRaw] = await Promise.all([
        api.get<TenantRow[] | unknown>('/api/tenants?status=checked_out'),
        api.get<PropertyRow[]>('/api/properties').catch(() => []),
        api.get<RoomRow[] | unknown>('/api/rooms').catch(() => []),
      ]);

      const tList = Array.isArray(tRaw) ? tRaw : [];
      const pList = Array.isArray(pRaw) ? pRaw : [];
      const rList = Array.isArray(rRaw) ? rRaw : [];

      setTenants(tList);
      setProperties(pList);
      setRooms(rList);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : '載入失敗');
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const propertyMap = useMemo(() => new Map(properties.map((p) => [p.id, p.name])), [properties]);
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants.filter((t) => {
      if (propertyFilter !== PROP_ALL && t.propertyId !== propertyFilter) return false;
      if (!q) return true;
      const name = (t.nameZh || t.nameVi || '').toLowerCase();
      return name.includes(q);
    });
  }, [tenants, search, propertyFilter]);

  return (
    <PageShell>
      <div className="flex flex-col space-y-6">
        <PageHeader title="歷史租約" description="已退租的租客紀錄查詢" />

        <Card>
          <CardHeader>
            <CardTitle>篩選</CardTitle>
            <CardDescription>搜尋租客姓名 / 物業</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-2 flex-1 min-w-[200px]">
              <Label>搜尋租客姓名</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="姓名" />
            </div>
            <div className="space-y-2 w-full sm:w-64">
              <Label>物業篩選</Label>
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PROP_ALL}>全部</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" onClick={() => void load()}>
              重新整理
            </Button>
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>歷史租約列表</CardTitle>
            <CardDescription>共 {rows.length} 筆歷史租約</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">載入中…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">目前沒有歷史租約紀錄</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>租客</TableHead>
                      <TableHead>房號</TableHead>
                      <TableHead>物業</TableHead>
                      <TableHead>入住日</TableHead>
                      <TableHead>退租日</TableHead>
                      <TableHead>合約</TableHead>
                      <TableHead>月租</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((t) => {
                      const room = t.roomId ? roomMap.get(t.roomId) : undefined;
                      const propName =
                        t.propertyId != null
                          ? propertyMap.get(t.propertyId) ?? '—'
                          : room?.propertyId != null
                            ? propertyMap.get(room.propertyId) ?? '—'
                            : '—';
                      const roomNo = room?.roomNumber ?? '—';
                      const rent = room?.monthlyRent != null ? formatCurrency(room.monthlyRent) : '—';
                      const displayName = t.nameZh || t.nameVi || '—';
                      const checkout = t.actualCheckoutDate || '—';

                      return (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{displayName}</TableCell>
                          <TableCell>{roomNo}</TableCell>
                          <TableCell>{propName}</TableCell>
                          <TableCell>
                            {t.checkInDate ? formatDate(t.checkInDate, 'short') : '—'}
                          </TableCell>
                          <TableCell>{checkout !== '—' ? formatDate(checkout, 'short') : '—'}</TableCell>
                          <TableCell>
                            {termLabel(t.checkInDate, t.expectedCheckoutDate)}
                          </TableCell>
                          <TableCell>{rent}</TableCell>
                          <TableCell>
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/history/${t.id}`}>查看</Link>
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
      </div>
    </PageShell>
  );
}
