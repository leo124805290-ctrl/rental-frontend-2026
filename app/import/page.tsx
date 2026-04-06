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
import { PageHeader } from '@/components/app-shell/page-header';
import { PageShell } from '@/components/app-shell/page-shell';
import { api } from '@/lib/api-client';
import { calcContractEnd, isoDateOnly } from '@/lib/contract-dates';
import { formatCurrency } from '@/lib/utils';

interface PropertyRow {
  id: string;
  name: string;
}

interface RoomRow {
  id: string;
  propertyId: string;
  roomNumber: string;
  monthlyRent: number;
  depositAmount: number;
  status: string;
}

interface PerRoomForm {
  needImport: boolean;
  name: string;
  phone: string;
  passport: string;
  checkInDate: string;
  contractMonths: number;
  meterReading: string;
  depositCollected: boolean;
  depositAmount: string;
  remark: string;
}

const PROPERTY_NONE = '__none__';

const CONTRACT_OPTIONS = [
  { months: 1, label: '1個月' },
  { months: 3, label: '3個月' },
  { months: 6, label: '6個月' },
  { months: 12, label: '1年' },
] as const;

function emptyForm(): PerRoomForm {
  return {
    needImport: false,
    name: '',
    phone: '',
    passport: '',
    checkInDate: '',
    contractMonths: 12,
    meterReading: '',
    depositCollected: true,
    depositAmount: '',
    remark: '',
  };
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return '匯入失敗';
}

export default function LegacyImportPage() {
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [propertyId, setPropertyId] = useState<string>('');
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [forms, setForms] = useState<Record<string, PerRoomForm>>({});
  const [loadingProps, setLoadingProps] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProperties = useCallback(async () => {
    setLoadingProps(true);
    setLoadError(null);
    try {
      const raw = await api.get<PropertyRow[]>('/api/properties');
      const list = Array.isArray(raw) ? raw : [];
      setProperties(list.filter((p) => p && p.id));
    } catch (e) {
      console.error(e);
      setLoadError(getErrorMessage(e));
      setProperties([]);
    } finally {
      setLoadingProps(false);
    }
  }, []);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  const loadRooms = useCallback(async (pid: string) => {
    if (!pid) {
      setRooms([]);
      setForms({});
      return;
    }
    setLoadingRooms(true);
    setLoadError(null);
    try {
      const raw = await api.get<RoomRow[]>(`/api/rooms?propertyId=${encodeURIComponent(pid)}`);
      const list = Array.isArray(raw) ? raw : [];
      const vacant = list.filter((r) => r.status === 'vacant');
      setRooms(vacant);
      setForms((prev) => {
        const next: Record<string, PerRoomForm> = {};
        for (const r of vacant) {
          const existing = prev[r.id];
          if (existing) {
            next[r.id] = {
              ...existing,
              depositAmount:
                existing.depositAmount ||
                (r.depositAmount != null ? String(r.depositAmount) : ''),
            };
          } else {
            next[r.id] = {
              ...emptyForm(),
              depositAmount: r.depositAmount != null ? String(r.depositAmount) : '',
            };
          }
        }
        return next;
      });
    } catch (e) {
      console.error(e);
      setLoadError(getErrorMessage(e));
      setRooms([]);
      setForms({});
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    if (propertyId) void loadRooms(propertyId);
  }, [propertyId, loadRooms]);

  const selectedPropertyName = useMemo(() => {
    return properties.find((p) => p.id === propertyId)?.name ?? '';
  }, [properties, propertyId]);

  const updateForm = (roomId: string, patch: Partial<PerRoomForm>) => {
    setForms((prev) => ({
      ...prev,
      [roomId]: { ...(prev[roomId] ?? emptyForm()), ...patch },
    }));
  };

  const handleBatchImport = async () => {
    if (!propertyId) {
      alert('請先選擇物業');
      return;
    }
    const selected = rooms.filter((r) => forms[r.id]?.needImport);
    if (selected.length === 0) {
      alert('請至少勾選一間需要補登的房間');
      return;
    }

    for (const room of selected) {
      const f = forms[room.id];
      if (!f) continue;
      const name = f.name.trim();
      if (!name) {
        alert(`${room.roomNumber} 號房：請填寫租客姓名`);
        return;
      }
      if (!f.phone.trim()) {
        alert(`${room.roomNumber} 號房：請填寫電話`);
        return;
      }
      if (!f.checkInDate) {
        alert(`${room.roomNumber} 號房：請填寫入住日期`);
        return;
      }
      if (f.meterReading === '' || f.meterReading === undefined || f.meterReading === null) {
        alert(`${room.roomNumber} 號房：請輸入電錶度數`);
        return;
      }
      if (f.depositCollected) {
        const amt = Number(f.depositAmount);
        if (!Number.isFinite(amt) || amt <= 0) {
          alert(`${room.roomNumber} 號房：請填寫有效的已收押金金額`);
          return;
        }
      }
    }

    setImporting(true);
    let successCount = 0;
    try {
      for (const room of selected) {
        const f = forms[room.id]!;
        const end = calcContractEnd(f.checkInDate, f.contractMonths);
        const expectedCheckoutDate = isoDateOnly(end);

        try {
          const checkinResult = await api.post<{
            tenant?: { id: string };
            data?: { tenant?: { id: string }; id?: string };
          }>('/api/checkin/complete', {
            roomId: room.id,
            propertyId,
            nameZh: f.name.trim(),
            nameVi: f.name.trim(),
            phone: f.phone.trim(),
            passportNumber: f.passport.trim() || '',
            checkInDate: f.checkInDate,
            expectedCheckoutDate,
            contractTermMonths: f.contractMonths,
            initialMeterReading: Number(f.meterReading),
            rentAmount: room.monthlyRent,
            depositAmount: room.depositAmount,
            paymentType: 'full',
            paymentAmount: 0,
            paidAmount: 0,
            legacyImport: true,
          });

          await api.post('/api/meter-readings', {
            roomId: room.id,
            readingValue: Number(f.meterReading),
            readingDate: f.checkInDate,
          });

          if (f.depositCollected) {
            const dep = Number(f.depositAmount);
            if (dep > 0) {
              const tenantId =
                checkinResult?.tenant?.id ??
                (checkinResult as { data?: { tenant?: { id: string } } })?.data?.tenant?.id ??
                (checkinResult as { data?: { id: string } })?.data?.id;

              if (tenantId) {
                await api.post('/api/deposits', {
                  tenantId,
                  roomId: room.id,
                  amount: dep,
                  type: '收取',
                  description: '舊資料補登',
                });
              }
            }
          }

          successCount += 1;
        } catch (err) {
          const msg = getErrorMessage(err);
          alert(
            `匯入至 ${room.roomNumber} 號房時失敗：${msg}\n\n已成功 ${successCount} 間，已停止後續匯入。`,
          );
          return;
        }
      }

      alert(`已成功匯入 ${successCount} 間房間的租客資料`);
      await loadRooms(propertyId);
    } finally {
      setImporting(false);
    }
  };

  return (
    <PageShell>
      <div className="flex flex-col space-y-6">
        <PageHeader
          title="舊資料補登"
          description="將現有租客資料匯入系統（僅限系統上線初期使用）"
        />

        <Card className="border-amber-200 bg-amber-50/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-950">⚠️ 舊資料補登說明</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-950/90 space-y-1">
            <p>• 僅用於系統上線初期，將已入住的租客匯入系統</p>
            <p>• 補登不會產生入住帳單（因為已經收過租金了）</p>
            <p>• 補登不會觸發合約簽名（已有紙本合約）</p>
            <p>• 入住日期請填實際入住日（可以是過去的日期）</p>
            <p>• 電錶度數請填目前的度數（作為下次抄錶基準）</p>
            <p>• 匯入完成後，下個月即可在收租管理正常收租</p>
          </CardContent>
        </Card>

        {loadError && (
          <p className="text-sm text-red-600" role="alert">
            {loadError}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>選擇物業</CardTitle>
            <CardDescription>載入該物業下所有空房（vacant）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label>物業</Label>
              <Select
                value={propertyId === '' ? PROPERTY_NONE : propertyId}
                onValueChange={(v) => setPropertyId(v === PROPERTY_NONE ? '' : v)}
                disabled={loadingProps}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingProps ? '載入中…' : '選擇物業'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PROPERTY_NONE} className="text-muted-foreground">
                    選擇物業
                  </SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedPropertyName && (
              <p className="text-sm text-muted-foreground">目前：{selectedPropertyName}</p>
            )}
          </CardContent>
        </Card>

        {propertyId && (
          <Card>
            <CardHeader>
              <CardTitle>空房列表</CardTitle>
              <CardDescription>
                {loadingRooms ? '載入房間中…' : `共 ${rooms.length} 間空房`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingRooms ? (
                <p className="text-sm text-muted-foreground">載入中…</p>
              ) : rooms.length === 0 ? (
                <p className="text-sm text-muted-foreground">此物業目前沒有空房可補登</p>
              ) : (
                rooms.map((room) => {
                  const f = forms[room.id] ?? emptyForm();
                  const end = f.checkInDate
                    ? calcContractEnd(f.checkInDate, f.contractMonths)
                    : null;
                  const endStr = end
                    ? end.toLocaleDateString('zh-TW', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      })
                    : '—';

                  return (
                    <div
                      key={room.id}
                      className="rounded-lg border border-slate-200 bg-white p-4 space-y-3"
                    >
                      <div className="font-medium">
                        {room.roomNumber} 號房 — 空房 — 月租 {formatCurrency(room.monthlyRent)}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          id={`need-${room.id}`}
                          type="checkbox"
                          className="h-4 w-4 accent-slate-900"
                          checked={f.needImport}
                          onChange={(e) =>
                            updateForm(room.id, { needImport: e.target.checked })
                          }
                        />
                        <Label htmlFor={`need-${room.id}`} className="font-normal cursor-pointer">
                          此房間有現有租客，需要補登
                        </Label>
                      </div>

                      {f.needImport && (
                        <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t">
                          <div className="space-y-2 sm:col-span-2">
                            <Label>租客姓名 *</Label>
                            <Input
                              value={f.name}
                              onChange={(e) => updateForm(room.id, { name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>電話 *</Label>
                            <Input
                              value={f.phone}
                              onChange={(e) => updateForm(room.id, { phone: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>護照/居留證</Label>
                            <Input
                              value={f.passport}
                              onChange={(e) => updateForm(room.id, { passport: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>入住日期 *（實際入住日）</Label>
                            <Input
                              type="date"
                              value={f.checkInDate}
                              onChange={(e) => updateForm(room.id, { checkInDate: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>合約期限</Label>
                            <Select
                              value={String(f.contractMonths)}
                              onValueChange={(v) =>
                                updateForm(room.id, { contractMonths: Number(v) })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CONTRACT_OPTIONS.map((o) => (
                                  <SelectItem key={o.months} value={String(o.months)}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label>合約到期日（自動計算，唯讀）</Label>
                            <Input readOnly value={endStr} className="bg-slate-50" />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label>目前電錶度數 *（允許 0）</Label>
                            <Input
                              inputMode="decimal"
                              value={f.meterReading}
                              onChange={(e) => updateForm(room.id, { meterReading: e.target.value })}
                            />
                          </div>
                          <div className="flex flex-wrap items-end gap-4 sm:col-span-2">
                            <div className="flex items-center gap-2">
                              <input
                                id={`dep-${room.id}`}
                                type="checkbox"
                                className="h-4 w-4 accent-slate-900"
                                checked={f.depositCollected}
                                onChange={(e) =>
                                  updateForm(room.id, { depositCollected: e.target.checked })
                                }
                              />
                              <Label htmlFor={`dep-${room.id}`} className="font-normal">
                                已收押金
                              </Label>
                            </div>
                            {f.depositCollected && (
                              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                <Label className="shrink-0">金額</Label>
                                <Input
                                  className="max-w-xs"
                                  inputMode="numeric"
                                  value={f.depositAmount}
                                  onChange={(e) =>
                                    updateForm(room.id, { depositAmount: e.target.value })
                                  }
                                />
                              </div>
                            )}
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label>備註</Label>
                            <Input
                              placeholder="系統上線前已入住"
                              value={f.remark}
                              onChange={(e) => updateForm(room.id, { remark: e.target.value })}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}

        {propertyId && rooms.length > 0 && (
          <div className="flex justify-center pb-8">
            <Button size="lg" onClick={() => void handleBatchImport()} disabled={importing}>
              {importing ? '匯入中…' : '批次匯入所有勾選的房間'}
            </Button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
