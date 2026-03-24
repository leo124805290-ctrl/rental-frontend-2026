'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { formatCents } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { PageHeader } from '@/components/app-shell/page-header';
import { PageShell } from '@/components/app-shell/page-shell';

interface Property {
  id: string;
  name: string;
}

interface Room {
  id: string;
  propertyId: string;
  roomNumber: string;
  electricityRate: number;
}

interface Reading {
  id: string;
  readingValue: number;
  readingDate: string;
}

function formatYmdSlash(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

export default function MeterHistoryPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [propertyId, setPropertyId] = useState<string>('');
  const [roomId, setRoomId] = useState<string>('');
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [readingsLoading, setReadingsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await api.get<Property[]>('/api/properties');
      setProperties(p);
      setPropertyId((prev) => prev || p[0]?.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入物業失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProps();
  }, [loadProps]);

  useEffect(() => {
    if (!propertyId) {
      setRooms([]);
      setRoomId('');
      return;
    }
    (async () => {
      try {
        const r = await api.get<Room[]>(`/api/rooms?propertyId=${encodeURIComponent(propertyId)}`);
        setRooms(r);
        setRoomId(r[0]?.id ?? '');
      } catch {
        setRooms([]);
        setRoomId('');
      }
    })();
  }, [propertyId]);

  useEffect(() => {
    if (!roomId) {
      setReadings([]);
      return;
    }
    (async () => {
      setReadingsLoading(true);
      setError(null);
      try {
        const list = await api.get<Reading[]>(`/api/meter-readings?roomId=${encodeURIComponent(roomId)}`);
        const sorted = [...list].sort(
          (a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime(),
        );
        setReadings(sorted);
      } catch (e) {
        setError(e instanceof Error ? e.message : '載入抄表失敗');
        setReadings([]);
      } finally {
        setReadingsLoading(false);
      }
    })();
  }, [roomId]);

  const room = useMemo(() => rooms.find((r) => r.id === roomId), [rooms, roomId]);
  const rateYuan = room ? room.electricityRate / 100 : 0;

  const rows = useMemo(() => {
    const out: Array<{
      id: string;
      date: string;
      value: number;
      usage: number | null;
      fee: number | null;
      kind: string;
    }> = [];
    let prev: number | null = null;
    for (const r of readings) {
      const val = Number(r.readingValue);
      const usage = prev === null ? null : Math.max(0, val - prev);
      const fee =
        usage === null || !room ? null : Math.round(usage * rateYuan * 100);
      const kind = prev === null ? '入住登記' : '月度抄表';
      prev = val;
      out.push({
        id: r.id,
        date: r.readingDate,
        value: val,
        usage,
        fee,
        kind,
      });
    }
    return out;
  }, [readings, room, rateYuan]);

  return (
    <PageShell>
      <PageHeader
        title="電錶歷史"
        description="依房間查詢抄表紀錄（唯讀）"
        actions={
          <Button type="button" variant="outline" onClick={() => void loadProps()}>
            重新整理
          </Button>
        }
      />

      {error && (
        <Card className="border-red-200 mb-4">
          <CardContent className="pt-6 text-red-600">{error}</CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>篩選</CardTitle>
          <CardDescription>選擇物業與房間</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="w-full sm:w-56">
            <Select value={propertyId} onValueChange={setPropertyId}>
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
          <div className="w-full sm:w-56">
            <Select value={roomId} onValueChange={setRoomId} disabled={!rooms.length}>
              <SelectTrigger>
                <SelectValue placeholder="房間" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.roomNumber} 號
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>抄表紀錄</CardTitle>
          {room && (
            <CardDescription>
              電價 {rateYuan.toFixed(1)} 元/度（後端存分 ÷100）
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>度數</TableHead>
                  <TableHead>用電</TableHead>
                  <TableHead>電費</TableHead>
                  <TableHead>類型</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatYmdSlash(row.date)}</TableCell>
                    <TableCell>{row.value.toLocaleString('zh-TW')}</TableCell>
                    <TableCell>
                      {row.usage === null ? '—' : `${row.usage} 度`}
                    </TableCell>
                    <TableCell>
                      {row.fee === null ? '—' : formatCents(row.fee)}
                    </TableCell>
                    <TableCell>{row.kind}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {(loading || readingsLoading) && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent" />
        </div>
      )}
    </PageShell>
  );
}
