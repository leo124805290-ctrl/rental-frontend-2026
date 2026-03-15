'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Home, User, DollarSign, CreditCard } from 'lucide-react';

// 房間資料類型
interface Room {
  id: string;
  propertyId: string;
  roomNumber: string;
  floor: number;
  monthlyRent: number;
  depositAmount: number;
  status: string;
}

// 付款類型
type PaymentType = 'full' | 'partial' | 'deposit_only';

interface CheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  rooms: Room[];
}

export default function CheckinModal({
  isOpen,
  onClose,
  onSubmit,
  rooms,
}: CheckinModalProps) {
  // 表單狀態
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [nameZh, setNameZh] = useState('');
  const [nameVi, setNameVi] = useState('');
  const [phone, setPhone] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>('full');
  const [rentAmount, setRentAmount] = useState(0);
  const [depositAmount, setDepositAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 篩選可入住的房間（僅空房）
  const availableRooms = rooms.filter(room => room.status === 'vacant');

  // 當選擇房間時，自動帶入租金和押金
  useEffect(() => {
    if (selectedRoomId) {
      const selectedRoom = rooms.find(room => room.id === selectedRoomId);
      if (selectedRoom) {
        setRentAmount(selectedRoom.monthlyRent);
        setDepositAmount(selectedRoom.depositAmount);
        
        // 根據付款類型設定預設付款金額
        switch (paymentType) {
          case 'full':
            setPaidAmount(selectedRoom.monthlyRent + selectedRoom.depositAmount);
            break;
          case 'partial':
            setPaidAmount(selectedRoom.depositAmount); // 預設只付押金
            break;
          case 'deposit_only':
            setPaidAmount(selectedRoom.depositAmount);
            break;
        }
      }
    }
  }, [selectedRoomId, rooms, paymentType]);

  // 當付款類型變更時，更新付款金額
  useEffect(() => {
    if (selectedRoomId && rentAmount > 0 && depositAmount > 0) {
      switch (paymentType) {
        case 'full':
          setPaidAmount(rentAmount + depositAmount);
          break;
        case 'partial':
          setPaidAmount(depositAmount); // 預設只付押金，可自行調整
          break;
        case 'deposit_only':
          setPaidAmount(depositAmount);
          break;
      }
    }
  }, [paymentType, selectedRoomId, rentAmount, depositAmount]);

  // 重置表單
  const resetForm = () => {
    setSelectedRoomId('');
    setNameZh('');
    setNameVi('');
    setPhone('');
    setPassportNumber('');
    setPaymentType('full');
    setRentAmount(0);
    setDepositAmount(0);
    setPaidAmount(0);
    setPaymentMethod('cash');
    setNotes('');
    setErrors({});
  };

  // 驗證表單
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedRoomId) {
      newErrors['room'] = '請選擇房間';
    }

    if (!nameZh.trim()) {
      newErrors['nameZh'] = '請輸入中文姓名';
    }

    if (!nameVi.trim()) {
      newErrors['nameVi'] = '請輸入越南文姓名';
    }

    if (!phone.trim()) {
      newErrors['phone'] = '請輸入電話號碼';
    }

    if (paidAmount <= 0) {
      newErrors['paidAmount'] = '付款金額必須大於 0';
    }

    if (paymentType === 'full' && paidAmount < (rentAmount + depositAmount)) {
      newErrors['paidAmount'] = '全額付款必須包含租金+押金';
    }

    if (paymentType === 'deposit_only' && paidAmount < depositAmount) {
      newErrors['paidAmount'] = '押金金額不足';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 處理表單提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedRoom = rooms.find(room => room.id === selectedRoomId);
      
      const checkinData = {
        roomId: selectedRoomId,
        nameZh,
        nameVi,
        phone,
        passportNumber,
        paymentType,
        rentAmount,
        depositAmount,
        paidAmount,
        paymentMethod,
        notes,
        propertyId: selectedRoom?.propertyId,
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

  // 格式化金額顯示
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0,
    });
  };

  // 計算應付總額
  const calculateTotalDue = () => {
    switch (paymentType) {
      case 'full':
        return rentAmount + depositAmount;
      case 'partial':
        return depositAmount; // 部分付款至少付押金
      case 'deposit_only':
        return depositAmount;
      default:
        return 0;
    }
  };

  // 計算剩餘金額
  const calculateBalance = () => {
    const totalDue = calculateTotalDue();
    return totalDue - paidAmount;
  };

  // 取得選中的房間
  const selectedRoom = rooms.find(room => room.id === selectedRoomId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <User className="h-5 w-5 mr-2 text-gray-500" />
            辦理租客入住
          </DialogTitle>
          <DialogDescription>
            請填寫租客資訊與付款方式，帶 * 號的欄位為必填
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* 步驟 1：選擇房間 */}
            <div className="space-y-4">
              <div className="flex items-center">
                <Home className="h-5 w-5 text-gray-500 mr-2" />
                <h3 className="text-lg font-medium">步驟 1：選擇房間</h3>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="room">
                  選擇房間 *
                  {errors['room'] && (
                    <span className="text-destructive text-xs ml-2 flex items-center">
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
                      <SelectItem value="" disabled>暫無空房</SelectItem>
                    ) : (
                      availableRooms.map(room => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.roomNumber} 號房 ({room.floor}樓) - {formatCurrency(room.monthlyRent)}/月
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  僅顯示狀態為「空房」的房間，共 {availableRooms.length} 間可選
                </p>
              </div>

              {selectedRoom && (
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-gray-600">房間編號</p>
                      <p className="font-medium">{selectedRoom.roomNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">樓層</p>
                      <p className="font-medium">{selectedRoom.floor} 樓</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">月租金</p>
                      <p className="font-medium text-green-700">{formatCurrency(selectedRoom.monthlyRent)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">押金</p>
                      <p className="font-medium text-blue-700">{formatCurrency(selectedRoom.depositAmount)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 步驟 2：租客資訊 */}
            <div className="space-y-4">
              <div className="flex items-center">
                <User className="h-5 w-5 text-gray-500 mr-2" />
                <h3 className="text-lg font-medium">步驟 2：租客資訊</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nameZh">
                    中文姓名 *
                    {errors['nameZh'] && (
                      <span className="text-destructive text-xs ml-2 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {errors['nameZh']}
                      </span>
                    )}
                  </Label>
                  <Input
                    id="nameZh"
                    value={nameZh}
                    onChange={(e) => setNameZh(e.target.value)}
                    placeholder="例如：陳小明"
                    className={errors['nameZh'] ? 'border-destructive' : ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nameVi">
                    越南文姓名 *
                    {errors['nameVi'] && (
                      <span className="text-destructive text-xs ml-2 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {errors['nameVi']}
                      </span>
                    )}
                  </Label>
                  <Input
                    id="nameVi"
                    value={nameVi}
                    onChange={(e) => setNameVi(e.target.value)}
                    placeholder="例如：Trần Tiểu Minh"
                    className={errors['nameVi'] ? 'border-destructive' : ''}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    電話號碼 *
                    {errors['phone'] && (
                      <span className="text-destructive text-xs ml-2 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {errors['phone']}
                      </span>
                    )}
                  </Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="例如：0912-345-678"
                    className={errors['phone'] ? 'border-destructive' : ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="passportNumber">
                    護照號碼
                  </Label>
                  <Input
                    id="passportNumber"
                    value={passportNumber}
                    onChange={(e) => setPassportNumber(e.target.value)}
                    placeholder="例如：A12345678"
                  />
                </div>
              </div>
            </div>

            {/* 步驟 3：付款方式 */}
            <div className="space-y-4">
              <div className="flex items-center">
                <CreditCard className="h-5 w-5 text-gray-500 mr-2" />
                <h3 className="text-lg font-medium">步驟 3：付款方式</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block">選擇付款類型 *</Label>
                  <Tabs value={paymentType} onValueChange={(value: string) => setPaymentType(value as PaymentType)}>
                    <TabsList className="grid grid-cols-3">
                      <TabsTrigger value="full">全額付款</TabsTrigger>
                      <TabsTrigger value="partial">部分付款</TabsTrigger>
                      <TabsTrigger value="deposit_only">僅付押金</TabsTrigger>
                    </TabsList>
                    <TabsContent value="full" className="space-y-2 pt-2">
                      <p className="text-sm text-gray-600">支付第一個月租金 + 押金，房間狀態設為「已入住」</p>
                    </TabsContent>
                    <TabsContent value="partial" className="space-y-2 pt-2">
                      <p className="text-sm text-gray-600">支付部分金額（至少押金），房間狀態設為「已預訂」</p>
                    </TabsContent>
                    <TabsContent value="deposit_only" className="space-y-2 pt-2">
                      <p className="text-sm text-gray-600">僅支付押金，房間狀態設為「已預訂」</p>
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">月租金</span>
                      <span className="font-medium">{formatCurrency(rentAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">押金</span>
                      <span className="font-medium">{formatCurrency(depositAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-600 font-medium">應付總額</span>
                      <span className="font-bold text-green-700">{formatCurrency(calculateTotalDue())}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paidAmount">
                    付款金額 *
                    {errors['paidAmount'] && (
                      <span className="text-destructive text-xs ml-2 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {errors['paidAmount']}
                      </span>
                    )}
                  </Label>
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 text-gray-500 mr-2" />
                    <Input
                      id="paidAmount"
                      type="number"
                      min="0"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(parseInt(e.target.value) || 0)}
                      className={errors['paidAmount'] ? 'border-destructive' : ''}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    實際付款金額，可修改
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">付款方式</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇付款方式" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">現金</SelectItem>
                      <SelectItem value="transfer">銀行轉帳</SelectItem>
                      <SelectItem value="credit_card">信用卡</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {calculateBalance() > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <p className="text-sm text-yellow-800">
                      <span className="font-medium">待付金額：{formatCurrency(calculateBalance())}</span>
                      {paymentType === 'full' && '（全額付款尚未付清）'}
                      {paymentType === 'partial' && '（部分付款待補齊）'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 備註 */}
            <div className="space-y-2">
              <Label htmlFor="notes">備註</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="可填寫特殊需求或其他說明"
              />
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