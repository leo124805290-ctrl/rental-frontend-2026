'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, Home, User } from 'lucide-react';
import {
  CONTRACT_TERM_OPTIONS,
  type ContractTermMonths,
  formatExpectedCheckoutIso,
  prorationRentYuan,
  daysRemainingInMonthForRent,
  parseLocalYmd,
} from '@/lib/checkin-dates';

interface Room {
  id: string;
  propertyId: string;
  roomNumber: string;
  floor: number;
  monthlyRent: number;
  depositAmount: number;
  status: string;
}

export type CheckinSubmitPayload = {
  roomId: string;
  propertyId: string;
  nameZh: string;
  nameVi: string;
  phone: string;
  passportNumber: string;
  checkInDate: string;
  contractTermMonths: ContractTermMonths;
  /** 空字串表示不登錄；可填 0 */
  initialMeterReading: string;
};

interface CheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CheckinSubmitPayload) => void | Promise<void>;
  rooms: Room[];
}

export default function CheckinModal({ isOpen, onClose, onSubmit, rooms }: CheckinModalProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [tenantName, setTenantName] = useState('');
  const [phone, setPhone] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [contractTermMonths, setContractTermMonths] = useState<ContractTermMonths>(12);
  const [initialMeterReading, setInitialMeterReading] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableRooms = rooms.filter((room) => room.status === 'vacant');

  useEffect(() => {
    if (!isOpen) return;
    const t = new Date().toISOString().split('T')[0] ?? '';
    setCheckInDate(t);
    setContractTermMonths(12);
    setInitialMeterReading('');
  }, [isOpen]);

  const resetForm = () => {
    setSelectedRoomId('');
    setTenantName('');
    setPhone('');
    setPassportNumber('');
    setInitialMeterReading('');
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!selectedRoomId) newErrors['room'] = '請選擇房間';
    if (!tenantName.trim()) newErrors['tenantName'] = '請輸入租客姓名';
    if (!phone.trim()) newErrors['phone'] = '請輸入電話號碼';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
      if (!selectedRoom) {
        setErrors({ room: '請選擇有效房間' });
        return;
      }
      const name = tenantName.trim();
      const checkinData: CheckinSubmitPayload = {
        roomId: selectedRoomId,
        propertyId: selectedRoom.propertyId,
        nameZh: name,
        nameVi: name,
        phone,
        passportNumber: passportNumber.trim(),
        checkInDate,
        contractTermMonths,
        initialMeterReading: initialMeterReading.trim(),
      };
      await onSubmit(checkinData);
      onClose();
      resetForm();
    } catch (error) {
      console.error('提交入住資料錯誤:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const expectedCheckoutIso =
    checkInDate && /^\d{4}-\d{2}-\d{2}$/.test(checkInDate)
      ? formatExpectedCheckoutIso(checkInDate, contractTermMonths)
      : '';

  const preview = (() => {
    if (!selectedRoom || !checkInDate) return null;
    const d = parseLocalYmd(checkInDate);
    if (Number.isNaN(d.getTime())) return null;
    const monthly = selectedRoom.monthlyRent;
    const deposit = selectedRoom.depositAmount;
    const pr = prorationRentYuan(monthly, d);
    const days = daysRemainingInMonthForRent(d);
    const after20 = d.getDate() > 20;
    if (after20) {
      return {
        lines: [
          `當月比例租金（${days} 天）約 ${pr.toLocaleString()} 元`,
          `次月整月租金 ${monthly.toLocaleString()} 元`,
          `押金 ${deposit.toLocaleString()} 元`,
        ],
        total: pr + monthly + deposit,
      };
    }
    return {
      lines: [`當月比例租金（${days} 天）約 ${pr.toLocaleString()} 元`, `押金 ${deposit.toLocaleString()} 元`],
      total: pr + deposit,
    };
  })();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <User className="h-5 w-5 mr-2 text-gray-500" />
            辦理租客入住
          </DialogTitle>
          <DialogDescription>
            送出後依入住日與 20 號規則自動建立帳單；收款請至「收租管理」。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 py-4">
            <div className="space-y-4">
              <div className="flex items-center">
                <Home className="h-5 w-5 text-gray-500 mr-2" />
                <h3 className="text-lg font-medium">選擇房間</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="room">
                  房間 *
                  {errors['room'] && (
                    <span className="text-destructive text-xs ml-2 inline-flex items-center">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {errors['room']}
                    </span>
                  )}
                </Label>
                <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                  <SelectTrigger className={errors['room'] ? 'border-destructive' : ''}>
                    <SelectValue placeholder="請選擇空房" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRooms.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        暫無空房
                      </SelectItem>
                    ) : (
                      availableRooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.roomNumber} 號房（{room.floor} 樓）
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">租客資料</h3>
              <div className="space-y-2">
                <Label htmlFor="tenantName">
                  租客姓名 *
                  {errors['tenantName'] && (
                    <span className="text-destructive text-xs ml-2">{errors['tenantName']}</span>
                  )}
                </Label>
                <Input
                  id="tenantName"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className={errors['tenantName'] ? 'border-destructive' : ''}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    電話 *
                    {errors['phone'] && (
                      <span className="text-destructive text-xs ml-2">{errors['phone']}</span>
                    )}
                  </Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={errors['phone'] ? 'border-destructive' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passportNumber">護照／居留證號碼</Label>
                  <Input
                    id="passportNumber"
                    value={passportNumber}
                    onChange={(e) => setPassportNumber(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="checkInDate">入住日期 *</Label>
                  <Input
                    id="checkInDate"
                    type="date"
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contractTerm">合約期限 *</Label>
                  <Select
                    value={String(contractTermMonths)}
                    onValueChange={(v) => setContractTermMonths(Number(v) as ContractTermMonths)}
                  >
                    <SelectTrigger id="contractTerm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACT_TERM_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n === 12 ? '1 年（12 個月）' : `${n} 個月`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expectedCheckoutDate">合約到期日（自動計算）</Label>
                <Input
                  id="expectedCheckoutDate"
                  type="text"
                  readOnly
                  className="bg-muted/60"
                  value={expectedCheckoutIso || '—'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="initialMeter">入住電錶度數（起始度數，可填 0）</Label>
                <Input
                  id="initialMeter"
                  inputMode="numeric"
                  placeholder="留空則不登錄"
                  value={initialMeterReading}
                  onChange={(e) => setInitialMeterReading(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">新錶或從 0 起算可填 0。</p>
              </div>
              {selectedRoom && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                  <p className="text-muted-foreground">
                    此房月租 {selectedRoom.monthlyRent.toLocaleString()} 元、押金（房間設定）{' '}
                    {selectedRoom.depositAmount.toLocaleString()} 元
                  </p>
                  {preview && (
                    <>
                      <p className="font-medium text-foreground pt-1">入住應收預覽（約）</p>
                      <ul className="list-disc pl-5 space-y-0.5">
                        {preview.lines.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                      <p className="font-semibold pt-1">合計約 {preview.total.toLocaleString()} 元</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onClose();
                resetForm();
              }}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '處理中...' : '確認入住'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
