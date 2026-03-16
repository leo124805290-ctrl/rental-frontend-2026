// @ts-nocheck
'use client';
// @ts-nocheck

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Home, Users, Wallet, CreditCard, CheckCircle, History, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/utils';

// 模擬租客結算資料類型
interface Tenant {
  id: string;
  name: string;
  phone: string;
  roomNumber: string;
  propertyName: string;
  checkInDate: string;
  monthlyRent: number;
  depositAmount: number;
  prepaidAmount: number; // 已預付租金
  currentElectricityBalance: number; // 電費欠款
  status: 'active' | 'checking_out' | 'checked_out';
}

interface Settlement {
  id: string;
  tenantName: string;
  roomNumber: string;
  checkoutDate: string;
  daysStayed: number;
  dailyRent: number;
  rentDue: number;
  electricityFee: number;
  otherDeductions: number;
  totalDue: number;
  prepaidAmount: number;
  depositAmount: number;
  refundAmount: number;
  settlementStatus: 'pending' | 'settled' | 'refunded';
  createdAt: string;
}

export default function CheckoutPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [checkoutDate, setCheckoutDate] = useState<Date>(new Date());
  const [otherDeductions, setOtherDeductions] = useState<string>('0');
  const [settlementNotes, setSettlementNotes] = useState<string>('');
  const [showSettlementDialog, setShowSettlementDialog] = useState(false);
  const [settlementDetails, setSettlementDetails] = useState<any>(null);

  // 載入租客與結算資料
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 模擬 API 請求延遲
      await new Promise(resolve => setTimeout(resolve, 600));

      // 模擬租客資料
      const mockTenants: Tenant[] = [
        {
          id: '1',
          name: '阮文雄',
          phone: '0912-345-678',
          roomNumber: '301',
          propertyName: '台北市信義區公寓',
          checkInDate: '2025-12-15',
          monthlyRent: 18000,
          depositAmount: 18000,
          prepaidAmount: 36000, // 付了2個月
          currentElectricityBalance: 850,
          status: 'active'
        },
        {
          id: '2',
          name: '陳美玲',
          phone: '0988-765-432',
          roomNumber: '302',
          propertyName: '台北市信義區公寓',
          checkInDate: '2026-01-10',
          monthlyRent: 17000,
          depositAmount: 17000,
          prepaidAmount: 17000, // 付了1個月
          currentElectricityBalance: 920,
          status: 'active'
        },
        {
          id: '3',
          name: '黎文德',
          phone: '0933-111-222',
          roomNumber: '303',
          propertyName: '台北市信義區公寓',
          checkInDate: '2026-02-01',
          monthlyRent: 19000,
          depositAmount: 19000,
          prepaidAmount: 19000,
          currentElectricityBalance: 0,
          status: 'checking_out'
        }
      ];

      // 模擬結算歷史
      const mockSettlements: Settlement[] = [
        {
          id: '1',
          tenantName: '張大山',
          roomNumber: '201',
          checkoutDate: '2026-02-28',
          daysStayed: 90,
          dailyRent: 500,
          rentDue: 45000,
          electricityFee: 1250,
          otherDeductions: 0,
          totalDue: 46250,
          prepaidAmount: 60000,
          depositAmount: 15000,
          refundAmount: 28750,
          settlementStatus: 'refunded',
          createdAt: '2026-02-28'
        },
        {
          id: '2',
          tenantName: '李小美',
          roomNumber: '202',
          checkoutDate: '2026-03-10',
          daysStayed: 75,
          dailyRent: 533,
          rentDue: 40000,
          electricityFee: 890,
          otherDeductions: 1000,
          totalDue: 41890,
          prepaidAmount: 40000,
          depositAmount: 16000,
          refundAmount: 14110,
          settlementStatus: 'settled',
          createdAt: '2026-03-10'
        }
      ];

      setTenants(mockTenants);
      setSettlements(mockSettlements);
    } catch (error) {
      setError('載入資料失敗');
      console.error('載入錯誤:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 選中的租客
  const selectedTenantData = tenants.find(t => t.id === selectedTenant);

  // 計算結算明細
  const calculateSettlement = () => {
    if (!selectedTenantData) return null;

    const checkIn = new Date(selectedTenantData.checkInDate);
    const checkOut = checkoutDate;
    const daysStayed = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    const dailyRent = Math.round(selectedTenantData.monthlyRent / 30);
    const rentDue = dailyRent * daysStayed;
    const electricityFee = selectedTenantData.currentElectricityBalance;
    const otherDeductionsValue = parseFloat(otherDeductions) || 0;
    const totalDue = rentDue + electricityFee + otherDeductionsValue;
    const refundAmount = (selectedTenantData.prepaidAmount - totalDue) + selectedTenantData.depositAmount;

    return {
      daysStayed,
      dailyRent,
      rentDue,
      electricityFee,
      otherDeductions: otherDeductionsValue,
      totalDue,
      prepaidAmount: selectedTenantData.prepaidAmount,
      depositAmount: selectedTenantData.depositAmount,
      refundAmount: Math.max(0, refundAmount)
    };
  };

  const settlement = calculateSettlement();

  // 執行退租結算
  const handleCheckout = () => {
    if (!selectedTenantData || !settlement) {
      alert('請先選擇租客');
      return;
    }

    setSettlementDetails({
      tenant: selectedTenantData,
      settlement: settlement,
      checkoutDate: checkoutDate.toISOString().split('T')[0],
      notes: settlementNotes
    });
    setShowSettlementDialog(true);
  };

  const handleConfirmCheckout = () => {
    if (!selectedTenantData || !settlementDetails) return;

    // 模擬結算邏輯
    const newSettlement: Settlement = {
      id: (settlements.length + 1).toString(),
      tenantName: selectedTenantData!.name,
      roomNumber: selectedTenantData!.roomNumber,
      checkoutDate: checkoutDate.toISOString().split('T')[0],
      daysStayed: settlementDetails.settlement.daysStayed,
      dailyRent: settlementDetails.settlement.dailyRent,
      rentDue: settlementDetails.settlement.rentDue,
      electricityFee: settlementDetails.settlement.electricityFee,
      otherDeductions: settlementDetails.settlement.otherDeductions,
      totalDue: settlementDetails.settlement.totalDue,
      prepaidAmount: settlementDetails.settlement.prepaidAmount,
      depositAmount: settlementDetails.settlement.depositAmount,
      refundAmount: settlementDetails.settlement.refundAmount,
      settlementStatus: 'settled',
      createdAt: new Date().toISOString().split('T')[0]
    };

    // 更新租客狀態
    setTenants(prev => prev.map(t => 
      t.id === selectedTenantData.id ? { ...t, status: 'checked_out' } : t
    ));

    // 新增結算紀錄
    setSettlements(prev => [newSettlement, ...prev]);

    // 重置表單
    setSelectedTenant('');
    setCheckoutDate(new Date());
    setOtherDeductions('0');
    setSettlementNotes('');
    setShowSettlementDialog(false);
    setSettlementDetails(null);
  };

  // 狀態標籤
  const getStatusBadge = (status: Tenant['status'] | Settlement['settlementStatus']) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">入住中</Badge>;
      case 'checking_out': return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">退租中</Badge>;
      case 'checked_out': return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">已退租</Badge>;
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">待結算</Badge>;
      case 'settled': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">已結算</Badge>;
      case 'refunded': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">已退款</Badge>;
      default: return <Badge>未知</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col space-y-6">
        {/* 標題區 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">退租結算管理</h1>
            <p className="text-muted-foreground">
              處理租客退租、計算結算金額、管理押金退還
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={loadData}>
              <History className="mr-2 h-4 w-4" />
              重新整理
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 左側：退租結算表單 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 租客選擇 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  選擇退租租客
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tenant">租客</Label>
                    <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇要退租的租客" />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants
                          .filter(t => t.status === 'active' || t.status === 'checking_out')
                          .map(tenant => (
                            <SelectItem key={tenant.id} value={tenant.id}>
                              {tenant.name}（{tenant.roomNumber}）
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedTenantData && (
                    <>
                      <div className="rounded-md bg-muted p-4">
                        <h3 className="font-medium mb-2">租客資訊</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>姓名：{selectedTenantData.name}</div>
                          <div>電話：{selectedTenantData.phone}</div>
                          <div>房號：{selectedTenantData.roomNumber}</div>
                          <div>物業：{selectedTenantData.propertyName}</div>
                          <div>入住日期：{formatDate(selectedTenantData.checkInDate)}</div>
                          <div>月租金：{formatCurrency(selectedTenantData.monthlyRent)}</div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="checkout-date">退租日期</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !checkoutDate && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {checkoutDate ? formatDate(checkoutDate.toISOString()) : "選擇日期"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={checkoutDate}
                                  onSelect={(date) => date && setCheckoutDate(date)}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="other-deductions">其他扣款</Label>
                            <Input
                              id="other-deductions"
                              type="number"
                              value={otherDeductions}
                              onChange={(e) => setOtherDeductions(e.target.value)}
                              placeholder="0"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="notes">結算備註</Label>
                          <Textarea
                            id="notes"
                            value={settlementNotes}
                            onChange={(e) => setSettlementNotes(e.target.value)}
                            placeholder="輸入結算備註（可選）"
                            rows={3}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 結算明細 */}
            {selectedTenantData && settlement && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calculator className="mr-2 h-5 w-5" />
                    結算明細
                  </CardTitle>
                  <CardDescription>
                    退租日期：{formatDate(checkoutDate.toISOString())}，入住 {settlement.daysStayed} 天
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <h4 className="font-medium">收入項目</h4>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span>日租金</span>
                            <span>{formatCurrency(settlement.dailyRent)} × {settlement.daysStayed} 天</span>
                          </div>
                          <div className="flex justify-between">
                            <span>電費欠款</span>
                            <span>{formatCurrency(settlement.electricityFee)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>其他扣款</span>
                            <span>{formatCurrency(settlement.otherDeductions)}</span>
                          </div>
                          <Separator className="my-2" />
                          <div className="flex justify-between font-bold">
                            <span>應收總額</span>
                            <span className="text-red-600">{formatCurrency(settlement.totalDue)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium">退還項目</h4>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span>預付租金</span>
                            <span>{formatCurrency(settlement.prepaidAmount)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>押金金額</span>
                            <span>{formatCurrency(settlement.depositAmount)}</span>
                          </div>
                          <Separator className="my-2" />
                          <div className="flex justify-between">
                            <span>預付 + 押金</span>
                            <span>{formatCurrency(settlement.prepaidAmount + settlement.depositAmount)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>減去應收總額</span>
                            <span>-{formatCurrency(settlement.totalDue)}</span>
                          </div>
                          <Separator className="my-2" />
                          <div className="flex justify-between font-bold">
                            <span>應退金額</span>
                            <span className="text-green-600">{formatCurrency(settlement.refundAmount)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">結算摘要</p>
                        <p className="text-xl font-bold mt-1">
                          租客 {selectedTenantData.name} 應退 {formatCurrency(settlement.refundAmount)}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          入住 {settlement.daysStayed} 天，日租 {formatCurrency(settlement.dailyRent)}/天
                        </p>
                      </div>
                    </div>

                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={handleCheckout}
                    >
                      <CheckCircle className="mr-2 h-5 w-5" />
                      確認退租結算
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 結算歷史 */}
            <Card>
              <CardHeader>
                <CardTitle>結算歷史紀錄</CardTitle>
                <CardDescription>
                  共 {settlements.length} 筆結算紀錄
                </CardDescription>
              </CardHeader>
              <CardContent>
                {settlements.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">暫無結算紀錄</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>租客</TableHead>
                          <TableHead>房號</TableHead>
                          <TableHead>退租日期</TableHead>
                          <TableHead>入住天數</TableHead>
                          <TableHead>應收總額</TableHead>
                          <TableHead>應退金額</TableHead>
                          <TableHead>狀態</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {settlements.map((settlement) => (
                          <TableRow key={settlement.id}>
                            <TableCell className="font-medium">{settlement.tenantName}</TableCell>
                            <TableCell>{settlement.roomNumber}</TableCell>
                            <TableCell>{formatDate(settlement.checkoutDate)}</TableCell>
                            <TableCell>{settlement.daysStayed} 天</TableCell>
                            <TableCell>{formatCurrency(settlement.totalDue)}</TableCell>
                            <TableCell className="font-bold text-green-600">
                              {formatCurrency(settlement.refundAmount)}
                            </TableCell>
                            <TableCell>{getStatusBadge(settlement.settlementStatus)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右側：統計與提示 */}
          <div className="space-y-6">
            {/* 統計卡片 */}
            <Card>
              <CardHeader>
                <CardTitle>結算統計</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">入住中租客</p>
                    <p className="text-2xl font-bold">
                      {tenants.filter(t => t.status === 'active').length}
                    </p>
                  </div>
                  <Home className="h-8 w-8 text-muted-foreground" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">退租中租客</p>
                    <p className="text-2xl font-bold">
                      {tenants.filter(t => t.status === 'checking_out').length}
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">總結算金額</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(settlements.reduce((sum, s) => sum + s.totalDue, 0))}
                    </p>
                  </div>
                  <Wallet className="h-8 w-8 text-muted-foreground" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">總退還金額</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(settlements.reduce((sum, s) => sum + s.refundAmount, 0))}
                    </p>
                  </div>
                  <CreditCard className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            {/* 操作提示 */}
            <Card>
              <CardHeader>
                <CardTitle>操作提示</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1 mr-2"></div>
                    <span>選擇租客後系統會自動計算結算金額</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1 mr-2"></div>
                    <span>日租金 = 月租金 ÷ 30（四捨五入）</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1 mr-2"></div>
                    <span>應退金額 = 預付餘額 + 押金 - 應付總額</span>
                  </li>
                  <li className="flex items-start">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1 mr-2"></div>
                    <span>確認結算後，房間狀態會自動變更為「空房」</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* 確認結算對話框 */}
      <Dialog open={showSettlementDialog} onOpenChange={setShowSettlementDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>確認退租結算</DialogTitle>
            <DialogDescription>
              請確認結算資訊無誤後提交
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {settlementDetails && (
              <>
                <div className="rounded-md bg-muted p-4">
                  <h3 className="font-medium mb-2">結算摘要</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>租客：{settlementDetails.tenant.name}</div>
                    <div>房號：{settlementDetails.tenant.roomNumber}</div>
                    <div>入住：{formatDate(settlementDetails.tenant.checkInDate)}</div>
                    <div>退租：{formatDate(settlementDetails.checkoutDate)}</div>
                    <div>入住天數：{settlementDetails.settlement.daysStayed} 天</div>
                    <div>日租金：{formatCurrency(settlementDetails.settlement.dailyRent)}</div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="font-medium">收入</h4>
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(settlementDetails.settlement.totalDue)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      租金 {formatCurrency(settlementDetails.settlement.rentDue)} + 
                      電費 {formatCurrency(settlementDetails.settlement.electricityFee)} + 
                      其他 {formatCurrency(settlementDetails.settlement.otherDeductions)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">退還</h4>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(settlementDetails.settlement.refundAmount)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      預付 {formatCurrency(settlementDetails.settlement.prepaidAmount)} + 
                      押金 {formatCurrency(settlementDetails.settlement.depositAmount)} - 
                      應付 {formatCurrency(settlementDetails.settlement.totalDue)}
                    </p>
                  </div>
                </div>

                {settlementDetails.notes && (
                  <div className="space-y-2">
                    <Label>備註</Label>
                    <p className="text-sm">{settlementDetails.notes}</p>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettlementDialog(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmCheckout}>
              確認結算並完成退租
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}