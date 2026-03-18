'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Home, Users, DollarSign, Clock, AlertCircle, CheckCircle, Wrench, Calendar } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PageShell } from '@/components/app-shell/page-shell';
import { PageHeader } from '@/components/app-shell/page-header';

// 物業卡片資料類型
interface PropertyCard {
  id: string;
  name: string;
  totalRooms: number;
  occupiedRooms: number;
  monthlyIncome: number; // 本月收入（分）
  monthlyExpense: number; // 本月支出（分）
  vacancyRate: number; // 空房率百分比
}

// 今日待辦項目
interface TodoItem {
  id: string;
  type: 'overdue_payment' | 'pending_maintenance' | 'upcoming_checkout' | 'unpaid_bill';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  roomNumber?: string;
  amount?: number;
}

// 本月摘要
interface MonthlySummary {
  totalIncome: number; // 總收入（分）
  totalExpense: number; // 總支出（分）
  netProfit: number; // 淨利（分）
  profitMargin: number; // 利潤率百分比
  incomeTrend: number; // 收入趨勢（與上月比較百分比）
  expenseTrend: number; // 支出趨勢（與上月比較百分比）
}

// 收入支出圖表資料
interface ChartData {
  month: string;
  收入: number;
  支出: number;
}

export default function DashboardPage() {
  const [propertyCards] = useState<PropertyCard[]>([
    {
      id: '1',
      name: '台北市信義區公寓',
      totalRooms: 10,
      occupiedRooms: 8,
      monthlyIncome: 1813500, // 18,135 元
      monthlyExpense: 620000, // 6,200 元
      vacancyRate: 20,
    },
    {
      id: '2',
      name: '新北市板橋區大樓',
      totalRooms: 8,
      occupiedRooms: 6,
      monthlyIncome: 1450800, // 14,508 元
      monthlyExpense: 496000, // 4,960 元
      vacancyRate: 25,
    },
  ]);

  const [todos] = useState<TodoItem[]>([
    {
      id: '1',
      type: 'overdue_payment',
      title: '逾期繳款',
      description: '房號 401 租金逾期 3 天',
      priority: 'urgent',
      dueDate: '2026-03-13',
      roomNumber: '401',
      amount: 16780,
    },
    {
      id: '2',
      type: 'pending_maintenance',
      title: '待處理維修',
      description: '房號 301 浴室水管漏水',
      priority: 'high',
      roomNumber: '301',
    },
    {
      id: '3',
      type: 'upcoming_checkout',
      title: '即將退租',
      description: '房號 302 租客預計 3/20 退租',
      priority: 'medium',
      dueDate: '2026-03-20',
      roomNumber: '302',
    },
    {
      id: '4',
      type: 'unpaid_bill',
      title: '待繳帳單',
      description: '房號 303 三月租金未繳',
      priority: 'medium',
      roomNumber: '303',
      amount: 19000,
    },
  ]);

  const [monthlySummary] = useState<MonthlySummary>({
    totalIncome: 3264300, // 32,643 元
    totalExpense: 1116000, // 11,160 元
    netProfit: 2148300, // 21,483 元
    profitMargin: 65.8,
    incomeTrend: 12.5, // 比上月增長 12.5%
    expenseTrend: -5.2, // 比上月減少 5.2%
  });

  const [chartData] = useState<ChartData[]>([
    { month: '2026-01', 收入: 2850000, 支出: 980000 },
    { month: '2026-02', 收入: 2900000, 支出: 1050000 },
    { month: '2026-03', 收入: 3264300, 支出: 1116000 },
  ]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 載入儀表板資料
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 實際環境中會從 API 載入資料
      // 這裡使用模擬資料，避免因 API 未完成而影響顯示
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // 可以在此處加入 API 呼叫
      // const summary = await api.get('/api/dashboard/summary');
      // const properties = await api.get('/api/dashboard/properties');
      // const todos = await api.get('/api/dashboard/todos');
      
      // 目前使用模擬資料
    } catch (error) {
      console.warn('儀表板資料載入失敗，使用模擬資料', error);
      // 即使 API 失敗，仍然顯示模擬資料
    } finally {
      setIsLoading(false);
    }
  };

  // 待辦項目圖示
  const getTodoIcon = (type: TodoItem['type']) => {
    switch (type) {
      case 'overdue_payment': return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'pending_maintenance': return <Wrench className="h-5 w-5 text-orange-600" />;
      case 'upcoming_checkout': return <Clock className="h-5 w-5 text-blue-600" />;
      case 'unpaid_bill': return <DollarSign className="h-5 w-5 text-yellow-600" />;
      default: return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  // 待辦項目標籤
  const getTodoBadge = (type: TodoItem['type']) => {
    const typeMap: Record<TodoItem['type'], string> = {
      overdue_payment: '逾期繳款',
      pending_maintenance: '待處理維修',
      upcoming_checkout: '即將退租',
      unpaid_bill: '待繳帳單',
    };
    return typeMap[type];
  };

  // 優先級標籤
  const getPriorityBadge = (priority: TodoItem['priority']) => {
    switch (priority) {
      case 'urgent': return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">緊急</Badge>;
      case 'high': return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">高</Badge>;
      case 'medium': return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">中</Badge>;
      case 'low': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">低</Badge>;
      default: return <Badge>未知</Badge>;
    }
  };

  // 趨勢圖示
  const getTrendIcon = (trend: number) => {
    if (trend > 0) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    } else {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="儀表板"
        description="總覽物業營運狀況、待辦事項與財務表現"
        actions={
          <>
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              本月：2026-03
            </Button>
            <Button onClick={loadDashboardData}>重新整理</Button>
          </>
        }
      />

      {/* 本月摘要 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">總收入</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(monthlySummary.totalIncome)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              {getTrendIcon(monthlySummary.incomeTrend)}
              <span className="ml-1">
                {monthlySummary.incomeTrend > 0 ? '+' : ''}{monthlySummary.incomeTrend}% 較上月
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">總支出</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(monthlySummary.totalExpense)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              {getTrendIcon(monthlySummary.expenseTrend)}
              <span className="ml-1">
                {monthlySummary.expenseTrend > 0 ? '+' : ''}{monthlySummary.expenseTrend}% 較上月
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">淨利</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(monthlySummary.netProfit)}
            </div>
            <p className="text-xs text-muted-foreground">
              利潤率 {monthlySummary.profitMargin}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">總房間數</CardTitle>
            <Home className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {propertyCards.reduce((sum, p) => sum + p.totalRooms, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              入住率 {propertyCards.length > 0 
                ? Math.round((propertyCards.reduce((sum, p) => sum + p.occupiedRooms, 0) / 
                  propertyCards.reduce((sum, p) => sum + p.totalRooms, 0)) * 100) 
                : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 主要內容區 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左側：物業卡片 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 收入支出趨勢圖 */}
          <Card>
            <CardHeader>
              <CardTitle>收入支出趨勢</CardTitle>
              <CardDescription>過去三個月收入與支出變化</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => formatCurrency(value).replace('$', '')} />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Bar dataKey="收入" fill="#10b981" />
                  <Bar dataKey="支出" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 物業卡片列表 */}
          <Card>
            <CardHeader>
              <CardTitle>物業總覽</CardTitle>
              <CardDescription>各物業營運狀況與收入分析</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {propertyCards.map((property) => (
                  <Card key={property.id} className="border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{property.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">房間數</span>
                        <span className="font-medium">
                          {property.occupiedRooms} / {property.totalRooms} 間
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">空房率</span>
                        <Badge variant={property.vacancyRate > 20 ? "destructive" : "outline"}>
                          {property.vacancyRate}%
                        </Badge>
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">收入</span>
                          <span className="font-medium text-green-600">
                            {formatCurrency(property.monthlyIncome)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">支出</span>
                          <span className="font-medium text-red-600">
                            {formatCurrency(property.monthlyExpense)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-sm font-medium">淨利</span>
                          <span className="font-bold text-blue-600">
                            {formatCurrency(property.monthlyIncome - property.monthlyExpense)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右側：待辦事項 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>今日待辦</CardTitle>
              <CardDescription>需要立即處理的事項</CardDescription>
            </CardHeader>
            <CardContent>
              {todos.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-2" />
                  <p className="text-muted-foreground">今日沒有待辦事項</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {todos.map((todo) => (
                    <div key={todo.id} className="p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-start space-x-3">
                        <div className="mt-0.5">
                          {getTodoIcon(todo.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-sm">
                                {getTodoBadge(todo.type)}
                              </span>
                              {getPriorityBadge(todo.priority)}
                            </div>
                            {todo.roomNumber && (
                              <Badge variant="outline">{todo.roomNumber}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {todo.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                              {todo.dueDate && (
                                <>
                                  <Calendar className="h-3 w-3" />
                                  <span>{formatDate(todo.dueDate, 'short')}</span>
                                </>
                              )}
                            </div>
                            {todo.amount && (
                              <span className="font-medium text-sm">
                                {formatCurrency(todo.amount)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 快速行動 */}
          <Card>
            <CardHeader>
              <CardTitle>快速行動</CardTitle>
              <CardDescription>常用功能快速連結</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="justify-start">
                  <DollarSign className="mr-2 h-4 w-4" />
                  收租
                </Button>
                <Button variant="outline" className="justify-start">
                  <Users className="mr-2 h-4 w-4" />
                  入住登記
                </Button>
                <Button variant="outline" className="justify-start">
                  <Wrench className="mr-2 h-4 w-4" />
                  報修
                </Button>
                <Button variant="outline" className="justify-start">
                  <Home className="mr-2 h-4 w-4" />
                  新增物業
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 近期活動 */}
          <Card>
            <CardHeader>
              <CardTitle>近期活動</CardTitle>
              <CardDescription>最近的系統活動記錄</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <div className="flex-1">
                    <p className="text-sm">房號 301 完成租金繳納</p>
                    <p className="text-xs text-muted-foreground">今天 10:30</p>
                  </div>
                  <Badge variant="outline">+18,000</Badge>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <div className="flex-1">
                    <p className="text-sm">房號 401 租客入住</p>
                    <p className="text-xs text-muted-foreground">昨天 14:20</p>
                  </div>
                  <Badge variant="outline">新租客</Badge>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                  <div className="flex-1">
                    <p className="text-sm">房號 302 提交維修申請</p>
                    <p className="text-xs text-muted-foreground">昨天 09:15</p>
                  </div>
                  <Badge variant="outline">待處理</Badge>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                  <div className="flex-1">
                    <p className="text-sm">三月損益報表已生成</p>
                    <p className="text-xs text-muted-foreground">3天前</p>
                  </div>
                  <Badge variant="outline">報表</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 載入狀態 */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">載入儀表板資料中...</p>
          </div>
        </div>
      )}

      {/* 錯誤狀態 */}
      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-2" />
            <p className="text-red-600 mb-2">{error}</p>
            <Button variant="outline" onClick={loadDashboardData}>
              重試載入
            </Button>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}