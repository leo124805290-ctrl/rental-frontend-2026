'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageShell } from '@/components/app-shell/page-shell';
import { api } from '@/lib/api-client';
import { formatCents, formatCurrency, formatDate } from '@/lib/utils';

interface TenantApi {
  id: string;
  roomId?: string;
  propertyId?: string;
  nameZh?: string;
  nameVi?: string;
  phone?: string;
  passportNumber?: string;
  checkInDate?: string;
  actualCheckoutDate?: string;
  expectedCheckoutDate?: string;
  status?: string;
  monthlyRent?: number;
}

interface RoomApi {
  id: string;
  propertyId: string;
  roomNumber: string;
  monthlyRent?: number;
  electricityRate?: number;
}

interface PropertyApi {
  id: string;
  name: string;
}

interface PaymentLineApi {
  id: string;
  lineType?: string;
  paymentMonth?: string;
  totalAmount?: number;
  paidAmount?: number;
  paymentStatus?: string;
}

interface MeterReadingApi {
  id: string;
  readingValue: number;
  readingDate: string;
}

function lineTypeLabel(lineType: string | undefined): string {
  switch (lineType) {
    case 'deposit':
      return '押金';
    case 'rent':
      return '租金';
    case 'electricity':
      return '電費';
    default:
      return lineType || '帳單';
  }
}

function normalizePaymentLine(raw: Record<string, unknown>): PaymentLineApi {
  const ps = raw['paymentStatus'] ?? raw['payment_status'];
  const base: PaymentLineApi = {
    id: String(raw['id'] ?? ''),
    lineType: String(raw['lineType'] ?? raw['line_type'] ?? ''),
    paymentMonth: String(raw['paymentMonth'] ?? raw['payment_month'] ?? ''),
    totalAmount: Number(raw['totalAmount'] ?? raw['total_amount'] ?? 0),
    paidAmount: Number(raw['paidAmount'] ?? raw['paid_amount'] ?? 0),
  };
  if (ps != null) base.paymentStatus = String(ps);
  return base;
}

function restLineCents(p: PaymentLineApi): number {
  const t = Number(p.totalAmount ?? 0);
  const paid = Number(p.paidAmount ?? 0);
  return Math.max(0, t - paid);
}

function paymentStatusLabel(p: PaymentLineApi): string {
  if (p.paymentStatus) return p.paymentStatus;
  return restLineCents(p) === 0 ? '已結清' : '待收';
}

export default function HistoryDetailPage() {
  const params = useParams();
  const id = typeof params['id'] === 'string' ? params['id'] : '';

  const [tenant, setTenant] = useState<TenantApi | null>(null);
  const [room, setRoom] = useState<RoomApi | null>(null);
  const [propertyName, setPropertyName] = useState<string>('—');
  const [payments, setPayments] = useState<PaymentLineApi[]>([]);
  const [meterRows, setMeterRows] = useState<
    Array<{
      id: string;
      date: string;
      value: number;
      usage: number | null;
      fee: number | null;
      kind: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkinHtml, setCheckinHtml] = useState<string | null>(null);
  const [checkinSig, setCheckinSig] = useState<string | null>(null);
  const [checkoutBody, setCheckoutBody] = useState<Record<string, unknown> | null>(null);
  const [hasCheckoutRecord, setHasCheckoutRecord] = useState(false);

  const loadContracts = useCallback((tid: string) => {
    if (typeof window === 'undefined') return;
    try {
      const rawCheckin =
        localStorage.getItem(`contract_checkin_${tid}`) ?? localStorage.getItem(`contract_${tid}`);
      if (rawCheckin) {
        const o = JSON.parse(rawCheckin) as Record<string, unknown>;
        const html = (o['contractHtml'] ?? o['html']) as string | undefined;
        const sig = (o['signatureBase64'] ?? o['signature']) as string | undefined;
        setCheckinHtml(html ?? null);
        setCheckinSig(typeof sig === 'string' ? sig : null);
      } else {
        setCheckinHtml(null);
        setCheckinSig(null);
      }
      const rawOut = localStorage.getItem(`contract_checkout_${tid}`);
      if (rawOut) {
        setCheckoutBody(JSON.parse(rawOut) as Record<string, unknown>);
        setHasCheckoutRecord(true);
      } else {
        setCheckoutBody(null);
        setHasCheckoutRecord(false);
      }
    } catch {
      setCheckinHtml(null);
      setCheckinSig(null);
      setCheckoutBody(null);
      setHasCheckoutRecord(false);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const t = await api.get<TenantApi>(`/api/tenants/${encodeURIComponent(id)}`);
        if (cancelled) return;
        setTenant(t);

        let r: RoomApi | null = null;
        let propName = '—';
        if (t.roomId) {
          try {
            r = await api.get<RoomApi>(`/api/rooms/${encodeURIComponent(t.roomId)}`);
          } catch {
            r = null;
          }
        }
        if (cancelled) return;
        setRoom(r);
        const pid = t.propertyId ?? r?.propertyId;
        if (pid) {
          try {
            const p = await api.get<PropertyApi>(`/api/properties/${encodeURIComponent(pid)}`);
            propName = p?.name ?? '—';
          } catch {
            propName = '—';
          }
        }
        if (cancelled) return;
        setPropertyName(propName);

        if (t.roomId) {
          const [payList, meterList] = await Promise.all([
            api
              .get<unknown[]>(
                `/api/payments?tenantId=${encodeURIComponent(id)}&roomId=${encodeURIComponent(t.roomId)}`,
              )
              .catch(() => []),
            api
              .get<MeterReadingApi[]>(
                `/api/meter-readings?roomId=${encodeURIComponent(t.roomId)}`,
              )
              .catch(() => []),
          ]);
          if (cancelled) return;
          const payRows = (Array.isArray(payList) ? payList : []).map((row) =>
            normalizePaymentLine(row as Record<string, unknown>),
          );
          setPayments(payRows);

          const sorted = [...(Array.isArray(meterList) ? meterList : [])].sort(
            (a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime(),
          );
          const rateFen = Number(r?.electricityRate ?? 600);
          const rateYuan = rateFen > 0 ? rateFen / 100 : 6;
          const out: typeof meterRows = [];
          let prev: number | null = null;
          for (let i = 0; i < sorted.length; i++) {
            const mr = sorted[i]!;
            const val = Number(mr.readingValue);
            const usage = prev === null ? null : Math.max(0, val - prev);
            const fee =
              usage === null ? null : Math.round(usage * rateYuan * 100) / 100;
            const kind = i === 0 ? '入住' : '月度';
            out.push({
              id: mr.id,
              date: mr.readingDate,
              value: val,
              usage,
              fee,
              kind,
            });
            prev = val;
          }
          if (out.length > 1) {
            out[out.length - 1]!.kind = '退租';
          }
          setMeterRows(out);
        } else {
          setPayments([]);
          setMeterRows([]);
        }

        loadContracts(id);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '載入失敗');
          setTenant(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, loadContracts]);

  const displayName = tenant?.nameZh || tenant?.nameVi || '—';
  const roomNo = room?.roomNumber ?? '—';

  const hasElectronicCheckin = Boolean(checkinHtml || checkinSig);
  const hasElectronicCheckout = hasCheckoutRecord;

  const handlePrint = () => {
    window.print();
  };

  const monthlyRentDisplay = useMemo(() => {
    const v = room?.monthlyRent ?? tenant?.monthlyRent;
    if (v == null || Number.isNaN(Number(v))) return '—';
    return formatCurrency(Number(v));
  }, [room, tenant]);

  if (!id) {
    return (
      <PageShell>
        <p className="text-sm text-red-600">無效的網址</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="space-y-6 max-w-5xl">
        <div>
          <Button asChild variant="ghost" className="mb-2 px-0">
            <Link href="/history">← 返回歷史租約列表</Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">
            歷史租約詳情 — {displayName}（{roomNo}號房）
          </h1>
        </div>

        {loading && <p className="text-sm text-muted-foreground">載入中…</p>}
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {!loading && tenant && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>租客資料</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">姓名：</span>
                  {displayName}
                </p>
                <p>
                  <span className="text-muted-foreground">電話：</span>
                  {tenant.phone ?? '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">護照：</span>
                  {tenant.passportNumber ?? '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">物業：</span>
                  {propertyName}
                </p>
                <p>
                  <span className="text-muted-foreground">入住日：</span>
                  {tenant.checkInDate ? formatDate(tenant.checkInDate, 'short') : '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">退租日：</span>
                  {tenant.actualCheckoutDate
                    ? formatDate(tenant.actualCheckoutDate, 'short')
                    : '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">合約到期：</span>
                  {tenant.expectedCheckoutDate
                    ? formatDate(tenant.expectedCheckoutDate, 'short')
                    : '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">月租金：</span>
                  {monthlyRentDisplay}
                </p>
                <p>
                  <span className="text-muted-foreground">狀態：</span>
                  已退租
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>帳單歷史</CardTitle>
                <CardDescription>唯讀</CardDescription>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">無帳單紀錄</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>月份</TableHead>
                          <TableHead>類型</TableHead>
                          <TableHead>應收</TableHead>
                          <TableHead>已收</TableHead>
                          <TableHead>狀態</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{p.paymentMonth || '—'}</TableCell>
                            <TableCell>{lineTypeLabel(p.lineType)}</TableCell>
                            <TableCell>{formatCents(Number(p.totalAmount ?? 0))}</TableCell>
                            <TableCell>{formatCents(Number(p.paidAmount ?? 0))}</TableCell>
                            <TableCell>{paymentStatusLabel(p)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>電錶歷史</CardTitle>
              </CardHeader>
              <CardContent>
                {meterRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">無抄表紀錄</p>
                ) : (
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
                        {meterRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{formatDate(row.date, 'short')}</TableCell>
                            <TableCell>
                              {row.value.toLocaleString('zh-TW')}
                            </TableCell>
                            <TableCell>
                              {row.usage === null ? '—' : `${row.usage}度`}
                            </TableCell>
                            <TableCell>
                              {row.fee === null
                                ? '—'
                                : `$${row.fee.toLocaleString('zh-TW')}`}
                            </TableCell>
                            <TableCell>{row.kind}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>合約文件</CardTitle>
                <CardDescription>本機儲存之電子紀錄（若有）</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasElectronicCheckin}
                    onClick={() => setCheckinOpen(true)}
                  >
                    查看合約
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasElectronicCheckin}
                    onClick={() => {
                      setCheckinOpen(true);
                      setTimeout(() => handlePrint(), 300);
                    }}
                  >
                    列印
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasElectronicCheckout}
                    onClick={() => setCheckoutOpen(true)}
                  >
                    查看確認書
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasElectronicCheckout}
                    onClick={() => {
                      setCheckoutOpen(true);
                      setTimeout(() => handlePrint(), 300);
                    }}
                  >
                    列印
                  </Button>
                </div>
                {!hasElectronicCheckin && !hasElectronicCheckout && (
                  <p className="text-muted-foreground">
                    此租客為紙本簽署，無電子紀錄。
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>入住合約</DialogTitle>
          </DialogHeader>
          {checkinHtml ? (
            <div className="space-y-4">
              <div
                className="prose prose-sm max-w-none border rounded-lg p-4 bg-white"
                dangerouslySetInnerHTML={{ __html: checkinHtml }}
              />
              {checkinSig && (
                <div>
                  <p className="text-sm font-medium mb-2">簽名</p>
                  <Image
                    src={checkinSig}
                    alt="簽名"
                    width={800}
                    height={240}
                    unoptimized
                    className="max-h-40 w-auto border rounded"
                  />
                </div>
              )}
              <Button type="button" variant="outline" onClick={handlePrint}>
                列印
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground">此租客為紙本簽署，系統無電子紀錄。</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>退租確認書</DialogTitle>
          </DialogHeader>
          {checkoutBody ? (
            <div className="space-y-4 text-sm">
              <pre className="whitespace-pre-wrap break-words rounded border bg-slate-50 p-3 text-xs">
                {JSON.stringify(checkoutBody, null, 2)}
              </pre>
              {typeof checkoutBody['signatureBase64'] === 'string' && (
                <div>
                  <p className="text-sm font-medium mb-2">簽名</p>
                  <Image
                    src={checkoutBody['signatureBase64'] as string}
                    alt="簽名"
                    width={800}
                    height={240}
                    unoptimized
                    className="max-h-40 w-auto border rounded"
                  />
                </div>
              )}
              <Button type="button" variant="outline" onClick={handlePrint}>
                列印
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground">此租客為紙本簽署，系統無電子紀錄。</p>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
