// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, Filter, PlusCircle, Wallet, Zap, Home, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/utils';

// 模擬帳單資料類型
interface Payment {
  id: string;
  roomNumber: string;
  tenantName: string;
  propertyName: string;
  paymentMonth: string; // YYYY-MM
  rentAmount: number;
  electricityFee: number;
  managementFee: number;
  otherFees: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  paymentStatus: 'pending' | 'partial' | 'paid' | 'overdue';
  paymentDate: string | null;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showCollectDialog, setShowCollectDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [collectAmount, setCollectAmount] = useState<string>('');
  const [collectMethod, setCollectMethod] = useState<string>('cash');

  // 載入帳單資料
  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 模擬 API 請求延遲
      await new Promise(resolve => setTimeout(resolve, 600));

      // 模擬資料
      const mockPayments: Payment[] = [
        {
          id: '1',
          roomNumber: '301',
          tenantName: '阮文雄',
          propertyName: '台北市信義區公寓',
          paymentMonth: '2026-03',
          rentAmount: 18000,
          electricityFee: 850,
          managementFee: 0,
          otherFees: 0,
          totalAmount: 18850,
          paidAmount: 18850,
          balance: 0,
          paymentStatus: 'paid',
          paymentDate: '2026-03-10',
          paymentMethod: 'cash',
          notes: null,
          createdAt: '2026-03-01'
        },
        {
          id: '2',
          roomNumber: '302',
          tenantName: '陳美玲',
          propertyName: '台北市信義區公寓',
          paymentMonth: '2026-03',
          rentAmount: 17000,
          electricityFee: 920,
          managementFee: 0,
          otherFees: 0,
          totalAmount: 17920,
          paidAmount: 10000,
          balance: 7920,
          paymentStatus: 'partial',
          paymentDate: '2026-03-05',
          paymentMethod: 'bank_transfer',
          notes: '先付押金',
          createdAt: '2026-03-01'
        },
        {
          id: '3',
          roomNumber: '303',
          tenantName: '黎文德',
          propertyName: '台北市信義區公寓',
          paymentMonth: '2026-03',
          rentAmount: 19000,
          electricityFee: 0,
          managementFee: 0,
          otherFees: 0,
          totalAmount: 19000,
          paidAmount: 0,
          balance: 19000,
          paymentStatus: 'pending',
          paymentDate: null,
          paymentMethod: null,
          notes: null,
          createdAt: '2026-03-01'
        },
        {
          id: '4',
          roomNumber: '401',
          tenantName: '黃文山',
          propertyName: '新北市板橋區大樓',
          paymentMonth: '2026-03',
          rentAmount: 16000,
          electricityFee: 780,
          managementFee: 0,
          otherFees: 0,
          totalAmount: 16780,
          paidAmount: 0,
          balance: 16780,
          paymentStatus: 'overdue',
          paymentDate: null,
          paymentMethod: null,
          notes: '逾期未繳',
          createdAt: '2026-03-01'
        }
      ];

      setPayments(mockPayments);
    } catch (error) {
      setError('載入帳單資料失敗');
      console.error('載入帳單錯誤:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 篩選後的帳單
  const filteredPayments = payments.filter(payment => {
    if (selectedProperty !== 'all' && payment.propertyName !== selectedProperty) return false;
    if (selectedStatus !== 'all' && payment.paymentStatus !== selectedStatus) return false;
    if (selectedMonth !== 'all' && payment.paymentMonth !== selectedMonth) return false;
    return true;
  });

  // 計算統計
  const totalPending = payments.filter(p => p.paymentStatus === 'pending').reduce((sum, p) => sum + p.balance, 0);
  const totalPartial = payments.filter(p => p.paymentStatus === 'partial').reduce((sum, p) => sum + p.balance, 0);
  const totalOverdue = payments.filter(p => p.paymentStatus === 'overdue').reduce((sum, p) => sum + p.balance, 0);
  const totalCollected = payments.filter(p => p.paymentStatus === 'paid').reduce((sum, p) => sum + p.paidAmount, 0);

  // 收租功能
  const handleCollectPayment = (payment: Payment) => {
    setSelectedPayment(payment);
    setCollectAmount(payment.balance.toString());
    setCollectMethod('cash');
    setShowCollectDialog(true);
  };

  const handleConfirmCollect = () => {
    if (!selectedPayment) return;

    // 模擬收租邏輯
    const updatedPayments = payments.map(p => {
      if (p.id === selectedPayment.id) {
        const amount = parseFloat(collectAmount) || 0;
        const newPaidAmount = p.paidAmount + amount;
        const newBalance = Math.max(0, p.totalAmount - newPaidAmount);
        const newStatus = newBalance <= 0 ? 'paid' : newPaidAmount > 0 ? 'partial' : 'pending';

        return {
          ...p,
          paidAmount: newPaidAmount,
          balance: newBalance,
          paymentStatus: newStatus,
          paymentDate: new Date().toISOString().split('T')[0],
          paymentMethod: collectMethod,
        };
      }
      return p;
    });

    setPayments(updatedPayments);
    setShowCollectDialog(false);
    setSelectedPayment(null);
    setCollectAmount('');
  };

  // 生成帳單功能
  const handleGenerateBills = () => {
    setShowGenerateDialog(true);
  };

  const handleConfirmGenerate = () => {
    // 模擬生成帳單邏輯
    console.log('生成帳單，月份:', selectedMonth);
    setShowGenerateDialog(false);
  };

  // 狀態標籤顏色
  const getStatusBadge = (status: Payment['paymentStatus']) => {
    switch (status) {
      case 'paid': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">已繳清</Badge>;
      case 'partial': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">部分繳款</Badge>;
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">待繳款</Badge>;
      case 'overdue': return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">逾期</Badge>;
      default: return <Badge>未知</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col space-y-6">
        {/* 標題區 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">收租管理</h1>
            <p className="text-muted-foreground">
              管理租客帳單、記錄繳費、查看收租狀況
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={handleGenerateBills}>
              <PlusCircle className="mr-2 h-4 w-4" />
              生成帳單
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              匯出報表
            </Button>
          </div>
        </div>

        {/* 統計卡片 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">待收租金</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalPending)}</div>
              <p className="text-xs text-muted-foreground">
                {payments.filter(p => p.paymentStatus === 'pending').length} 筆待繳款
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">部分繳款</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalPartial)}</div>
              <p className="text-xs text-muted-foreground">
                {payments.filter(p => p.paymentStatus === 'partial').length} 筆部分繳款
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">逾期未繳</CardTitle>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalOverdue)}</div>
              <p className="text-xs text-muted-foreground">
                {payments.filter(p => p.paymentStatus === 'overdue').length} 筆逾期
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已收金額</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalCollected)}</div>
              <p className="text-xs text-muted-foreground">
                {payments.filter(p => p.paymentStatus === 'paid').length} 筆已繳清
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 篩選器 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="mr-2 h-5 w-5" />
              篩選條件
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="month">月份</Label>
                <Input
                  id="month"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="property">物業</Label>
                <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇物業" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有物業</SelectItem>
                    <SelectItem value="台北市信義區公寓">台北市信義區公寓</SelectItem>
                    <SelectItem value="新北市板橋區大樓">新北市板橋區大樓</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">繳費狀態</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有狀態</SelectItem>
                    <SelectItem value="pending">待繳款</SelectItem>
                    <SelectItem value="partial">部分繳款</SelectItem>
                    <SelectItem value="paid">已繳清</SelectItem>
                    <SelectItem value="overdue">逾期</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex items-end">
                <Button className="w-full" onClick={loadPayments}>
                  重新整理
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 帳單列表 */}
        <Card>
          <CardHeader>
            <CardTitle>帳單列表</CardTitle>
            <CardDescription>
              共 {filteredPayments.length} 筆帳單，總金額 {formatCurrency(filteredPayments.reduce((sum, p) => sum + p.totalAmount, 0))}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">載入中...</p>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                <p>{error}</p>
                <Button variant="outline" onClick={loadPayments} className="mt-2">
                  重試
                </Button>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">沒有符合條件的帳單</p>
                <Button variant="outline" onClick={() => {
                  setSelectedMonth('all');
                  setSelectedProperty('all');
                  setSelectedStatus('all');
                }} className="mt-2">
                  清除篩選
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>房號</TableHead>
                      <TableHead>租客</TableHead>
                      <TableHead>物業</TableHead>
                      <TableHead>月份</TableHead>
                      <TableHead>租金</TableHead>
                      <TableHead>電費</TableHead>
                      <TableHead>合計</TableHead>
                      <TableHead>已繳/餘額</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.roomNumber}</TableCell>
                        <TableCell>{payment.tenantName}</TableCell>
                        <TableCell>{payment.propertyName}</TableCell>
                        <TableCell>{payment.paymentMonth}</TableCell>
                        <TableCell>{formatCurrency(payment.rentAmount)}</TableCell>
                        <TableCell>{formatCurrency(payment.electricityFee)}</TableCell>
                        <TableCell className="font-bold">{formatCurrency(payment.totalAmount)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-green-600">{formatCurrency(payment.paidAmount)}</span>
                            <span className="text-sm text-muted-foreground">餘額 {formatCurrency(payment.balance)}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(payment.paymentStatus)}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCollectPayment(payment)}
                            disabled={payment.paymentStatus === 'paid'}
                          >
                            收租
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 收租對話框 */}
      <Dialog open={showCollectDialog} onOpenChange={setShowCollectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>記錄繳費</DialogTitle>
            <DialogDescription>
              記錄租客 {selectedPayment?.tenantName} 的繳費（房號 {selectedPayment?.roomNumber}）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="balance">應付餘額</Label>
              <Input
                id="balance"
                value={formatCurrency(selectedPayment?.balance || 0)}
                disabled
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">繳費金額</Label>
              <Input
                id="amount"
                type="number"
                value={collectAmount}
                onChange={(e) => setCollectAmount(e.target.value)}
                placeholder="輸入繳費金額"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="method">繳費方式</Label>
              <Select value={collectMethod} onValueChange={setCollectMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇繳費方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">現金</SelectItem>
                  <SelectItem value="bank_transfer">銀行轉帳</SelectItem>
                  <SelectItem value="line_pay">LINE Pay</SelectItem>
                  <SelectItem value="credit_card">信用卡</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCollectDialog(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmCollect}>
              確認繳費
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 生成帳單對話框 */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>生成帳單</DialogTitle>
            <DialogDescription>
              為所有租客生成指定月份的帳單
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="generate-month">帳單月份</Label>
              <Input
                id="generate-month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm text-muted-foreground">
                將會為所有狀態為「已入住」的房間生成帳單，包含租金和電費計算。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmGenerate}>
              生成帳單
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}