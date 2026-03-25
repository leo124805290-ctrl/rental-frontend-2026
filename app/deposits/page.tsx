'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { formatCents, formatDate } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { PageHeader } from '@/components/app-shell/page-header';
import { PageShell } from '@/components/app-shell/page-shell';

interface DepositRow {
  id: string;
  tenantId?: string | null;
  roomId: string;
  amount: number;
  type: string;
  description?: string | null;
  depositDate?: string;
  createdAt?: string;
}

interface RoomOpt {
  id: string;
  roomNumber: string;
  propertyId: string;
}

interface PropertyOpt {
  id: string;
  name: string;
}

export default function DepositsPage() {
  const [properties, setProperties] = useState<PropertyOpt[]>([]);
  const [rooms, setRooms] = useState<RoomOpt[]>([]);
  const [propertyId, setPropertyId] = useState<string>('all');
  const [roomId, setRoomId] = useState<string>('all');
  const [rows, setRows] = useState<DepositRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    const [plist, rlist] = await Promise.all([
      api.get<PropertyOpt[]>('/api/properties'),
      api.get<RoomOpt[]>('/api/rooms'),
    ]);
    setProperties(Array.isArray(plist) ? plist : []);
    setRooms(Array.isArray(rlist) ? rlist : []);
  }, []);

  const loadDeposits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = roomId !== 'all' ? `?roomId=${encodeURIComponent(roomId)}` : '';
      const data = await api.get<DepositRow[]>(`/api/deposits${q}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadDeposits();
  }, [loadDeposits]);

  const roomsInProperty = useMemo(() => {
    if (propertyId === 'all') return rooms;
    return rooms.filter((r) => r.propertyId === propertyId);
  }, [rooms, propertyId]);

  const roomNumberById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rooms) m.set(r.id, r.roomNumber);
    return m;
  }, [rooms]);

  const propertyNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of properties) m.set(p.id, p.name);
    return m;
  }, [properties]);

  const filteredRows = useMemo(() => {
    if (propertyId === 'all') return rows;
    const allowed = new Set(roomsInProperty.map((r) => r.id));
    return rows.filter((d) => allowed.has(d.roomId));
  }, [rows, propertyId, roomsInProperty]);

  return (
    <PageShell>
      <PageHeader
        title="押金紀錄"
        description="僅供查詢：押金相關流水（收取、退還、調整等）。實際收款與沖帳請至「月結收款」。"
      />

      <Card className="mb-4 border-slate-300 bg-slate-50">
        <CardContent className="py-3 text-sm text-slate-800">
          <span className="font-medium">只讀</span>
          ：本頁不提供收款按鈕。請至側邊欄「月結收款」處理當月帳單與押金沖帶。
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">查詢條件</CardTitle>
          <CardDescription>先選物業再選房間，或選「全部」。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <span className="text-sm font-medium">物業</span>
            <Select
              value={propertyId}
              onValueChange={(v) => {
                setPropertyId(v);
                setRoomId('all');
              }}
            >
              <SelectTrigger className="w-[220px]">
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
          <div className="space-y-1">
            <span className="text-sm font-medium">房間</span>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部房間</SelectItem>
                {roomsInProperty.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.roomNumber} 號
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 mb-4">
          <CardContent className="pt-6 text-red-600">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">歷史流水</CardTitle>
          <CardDescription>共 {filteredRows.length} 筆（僅顯示，不可編輯）</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              載入中…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>類型</TableHead>
                  <TableHead>房號</TableHead>
                  <TableHead>物業</TableHead>
                  <TableHead>說明</TableHead>
                  <TableHead className="text-right">金額</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      尚無紀錄
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((d) => {
                    const rn = roomNumberById.get(d.roomId) ?? '—';
                    const rid = rooms.find((x) => x.id === d.roomId)?.propertyId;
                    const pname = rid ? propertyNameById.get(rid) ?? '—' : '—';
                    const dt = d.depositDate ?? d.createdAt;
                    return (
                      <TableRow key={d.id}>
                        <TableCell>{dt ? formatDate(dt) : '—'}</TableCell>
                        <TableCell>{d.type}</TableCell>
                        <TableCell>{rn}</TableCell>
                        <TableCell>{pname}</TableCell>
                        <TableCell className="max-w-[240px] truncate">{d.description ?? '—'}</TableCell>
                        <TableCell className="text-right font-mono">{formatCents(d.amount)}</TableCell>
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
