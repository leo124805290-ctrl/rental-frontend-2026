'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Filter, TrendingUp, TrendingDown, DollarSign, Home, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { PageHeader } from '@/components/app-shell/page-header';
import { PageShell } from '@/components/app-shell/page-shell';

// 損益報表資料類型
interface MonthlyReport {
  propertyId: string;
  month: string;
  income: {
    rent: number; // 租金收入（分）
    electricity: number; // 電費收入（分）
    extra: number; // 補充收入（分）
    total: number; // 總收入（分）
    collected: number; // 已收金額（分）
  };
  expense: {
    fixed: number; // 固定支出（分）
    capital: number; // 資本支出（分）
    total: number; // 總支出（分）
    breakdown: Array<{
      category: string;
      amount: number;
      description: string | null;
    }>;
  };
  netProfit: number; // 淨利（分）
  rooms: {
    total: number;
    occupied: number;
    vacant: number;
    occupancyRate: number; // 入住率百分比
  };
}

// 物業總覽資料類型
interface SummaryReport {
  month: string;
  totalProperties: number;
  totalRooms: number;
  occupiedRooms: number;
  vacantRooms: number;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  properties: Array<{
    id: string;
    name: string;
    rooms: number;
    occupied: number;
    income: number;
    expense: number;
    netProfit: number;
  }>;
}

// 物業選項
interface Property {
  id: string;
  name: string;
}

/** 電費差異分析（本月） */
interface ElectricityAnalysisState {
  lines: Array<{ roomLabel: string; usage: number; rateYuan: number; amountCents: number }>;
  totalCollectedCents: number;
  taipowerCents: number;
  profitCents: number;
  avgCostPerDeg: number | null;
  collectRatePerDeg: number | null;
  profitPerDeg: number | null;
  hasElectricityLines: boolean;
  hasTaipowerExpense: boolean;
}

interface DepositStatusState {
  landlordDepositYuan: number;
  tenantEscrowCents: number;
}

/** 投報率分析（前端計算） */
interface RoiAnalysisState {
  hasLandlordContractForProperty: boolean;
  landlordDepositYuan: number;
  renovationCents: number;
  equipmentCents: number;
  currentMonthNetCents: number;
  avg3MonthNetCents: number;
}

function addMonthsYm(ym: string, delta: number): string {
  const parts = ym.split('-').map(Number);
  const y = parts[0] ?? new Date().getFullYear();
  const mo = parts[1] ?? 1;
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function expenseMonthMatches(iso: string, ym: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === ym;
}

function isTaipowerExpenseCategory(cat: string): boolean {
  const c = String(cat);
  return c === 'utility_electric' || c === 'utilities' || c.includes('台電');
}

function RoiAnalysisCard({ roi }: { roi: RoiAnalysisState }) {
  const renovationYuan = roi.renovationCents / 100;
  const equipmentYuan = roi.equipmentCents / 100;
  const totalInvestmentYuan = roi.landlordDepositYuan + renovationYuan + equipmentYuan;
  const monthlyNetYuan = roi.currentMonthNetCents / 100;
  const avg3Yuan = roi.avg3MonthNetCents / 100;
  const annualProfitYuan = avg3Yuan * 12;
  const roiPct =
    totalInvestmentYuan > 0 ? (annualProfitYuan / totalInvestmentYuan) * 100 : 0;
  const roiStr = totalInvestmentYuan > 0 ? roiPct.toFixed(1) : '0.0';
  const paybackYears =
    annualProfitYuan > 0 ? (totalInvestmentYuan / annualProfitYuan).toFixed(1) : '∞';

  let roiEmoji = '🔴';
  let roiColor = 'text-red-600';
  if (roiPct > 30) {
    roiEmoji = '✅';
    roiColor = 'text-green-600';
  } else if (roiPct >= 10) {
    roiEmoji = '⚠️';
    roiColor = 'text-amber-600';
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>═══ 投報率分析 ═══</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!roi.hasLandlordContractForProperty && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            總投入成本：請先到房東付款頁面設定合約
          </p>
        )}

        <div>
          <p className="font-semibold mb-2">【總投入成本】</p>
          <p>房東押金：{formatCurrency(roi.landlordDepositYuan)}</p>
          <p>裝潢費用：{formatCurrency(renovationYuan)}（從收支管理「裝潢」類別累計）</p>
          <p>設備費用：{formatCurrency(equipmentYuan)}（從收支管理「設備」類別累計）</p>
          <p className="border-t my-2 pt-2 font-medium">投入合計：{formatCurrency(totalInvestmentYuan)}</p>
        </div>

        <div>
          <p className="font-semibold mb-2">【年度收益】</p>
          <p>本月淨利：{formatCurrency(monthlyNetYuan)}</p>
          <p>月均淨利（近3月）：{formatCurrency(avg3Yuan)}</p>
          <p>年化淨利：{formatCurrency(annualProfitYuan)}（月均 × 12）</p>
        </div>

        <div>
          <p className="font-semibold mb-2">【投報率指標】</p>
          <p className={roiColor}>
            年投報率：{roiStr}% {roiEmoji}
          </p>
          <p>預估回本期：{paybackYears} 年</p>
          <p className="text-xs text-muted-foreground mt-2">
            投報率 &gt; 30% 顯示 ✅ 綠色；10–30% 顯示 ⚠️ 黃色；&lt; 10% 顯示 🔴 紅色
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [summaryReport, setSummaryReport] = useState<SummaryReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('monthly');
  
  // 篩選狀態
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [properties, setProperties] = useState<Property[]>([]);
  const [electricityAnalysis, setElectricityAnalysis] = useState<ElectricityAnalysisState | null>(null);
  const [depositStatus, setDepositStatus] = useState<DepositStatusState | null>(null);
  const [roiAnalysis, setRoiAnalysis] = useState<RoiAnalysisState | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.get<Array<{ id: string; name: string }>>('/api/properties');
        setProperties(list);
        setSelectedProperty((prev) => prev || list[0]?.id || '');
      } catch {
        setProperties([]);
      }
    })();
  }, []);

  const loadMonthlyReport = useCallback(async () => {
    if (!selectedProperty) {
      setMonthlyReport(null);
      setElectricityAnalysis(null);
      setDepositStatus(null);
      setRoiAnalysis(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [data, payList, roomList, expList, depAll] = await Promise.all([
        api.get<MonthlyReport>(`/api/reports/monthly?propertyId=${selectedProperty}&month=${selectedMonth}`),
        api
          .get<unknown[]>(
            `/api/payments?propertyId=${encodeURIComponent(selectedProperty)}&month=${encodeURIComponent(selectedMonth)}`,
          )
          .catch(() => [] as unknown[]),
        api
          .get<Array<{ id: string; roomNumber: string; electricityRate?: number }>>(
            `/api/rooms?propertyId=${encodeURIComponent(selectedProperty)}`,
          )
          .catch(() => []),
        api
          .get<Array<{ amount: number; expenseDate: string; category: string }>>(
            `/api/expenses?propertyId=${encodeURIComponent(selectedProperty)}`,
          )
          .catch(() => []),
        api.get<Array<{ roomId: string; amount: number; type: string }>>('/api/deposits').catch(() => []),
      ]);
      setMonthlyReport(data);

      let renovationCents = 0;
      let equipmentCents = 0;
      for (const e of Array.isArray(expList) ? expList : []) {
        const cat = String(e.category ?? '');
        const amt = Number(e.amount ?? 0);
        if (cat === 'renovation') renovationCents += amt;
        if (cat === 'equipment') equipmentCents += amt;
      }

      const [rPrev1, rPrev2] = await Promise.all([
        api
          .get<MonthlyReport>(
            `/api/reports/monthly?propertyId=${encodeURIComponent(selectedProperty)}&month=${encodeURIComponent(addMonthsYm(selectedMonth, -1))}`,
          )
          .catch(() => null),
        api
          .get<MonthlyReport>(
            `/api/reports/monthly?propertyId=${encodeURIComponent(selectedProperty)}&month=${encodeURIComponent(addMonthsYm(selectedMonth, -2))}`,
          )
          .catch(() => null),
      ]);
      const netsForAvg: number[] = [data.netProfit];
      if (rPrev1) netsForAvg.push(rPrev1.netProfit);
      if (rPrev2) netsForAvg.push(rPrev2.netProfit);
      const avg3MonthNetCents =
        netsForAvg.reduce((a, b) => a + b, 0) / (netsForAvg.length > 0 ? netsForAvg.length : 1);

      const roomsMap = new Map((Array.isArray(roomList) ? roomList : []).map((r) => [r.id, r]));
      const roomIdSet = new Set((Array.isArray(roomList) ? roomList : []).map((r) => r.id));

      const lines: ElectricityAnalysisState['lines'] = [];
      let totalCollectedCents = 0;

      for (const raw of Array.isArray(payList) ? payList : []) {
        const p = raw as Record<string, unknown>;
        const lt = String(p['lineType'] ?? p['line_type'] ?? '');
        if (lt !== 'electricity') continue;
        const roomId = String(p['roomId'] ?? p['room_id'] ?? '');
        const paid = Number(p['paidAmount'] ?? p['paid_amount'] ?? 0);
        totalCollectedCents += paid;
        const room = roomsMap.get(roomId);
        const rn = room?.roomNumber ?? '—';
        const roomLabel = `${rn}房`;
        const rateFen = Number(room?.electricityRate ?? 0);
        const rateYuan = rateFen / 100;
        const usage = rateFen > 0 ? Math.round(paid / rateFen) : 0;
        lines.push({ roomLabel, usage, rateYuan, amountCents: paid });
      }

      let taipowerCents = 0;
      for (const e of Array.isArray(expList) ? expList : []) {
        if (!expenseMonthMatches(String(e.expenseDate), selectedMonth)) continue;
        if (!isTaipowerExpenseCategory(String(e.category))) continue;
        taipowerCents += Number(e.amount ?? 0);
      }

      const profitCents = totalCollectedCents - taipowerCents;
      const totalUsage = lines.reduce((s, l) => s + l.usage, 0);
      const collectedYuan = totalCollectedCents / 100;
      const taipowerYuan = taipowerCents / 100;
      const profitYuan = profitCents / 100;

      setElectricityAnalysis({
        lines,
        totalCollectedCents,
        taipowerCents,
        profitCents,
        avgCostPerDeg: totalUsage > 0 ? taipowerYuan / totalUsage : null,
        collectRatePerDeg: totalUsage > 0 ? collectedYuan / totalUsage : null,
        profitPerDeg: totalUsage > 0 ? profitYuan / totalUsage : null,
        hasElectricityLines: lines.length > 0,
        hasTaipowerExpense: taipowerCents > 0,
      });

      let landlordDepositYuan = 0;
      let hasLandlordContractForProperty = false;
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('landlord_contracts');
          const arr = raw ? JSON.parse(raw) : [];
          if (Array.isArray(arr)) {
            const forProp = arr.filter((c: { propertyId?: string }) => c.propertyId === selectedProperty);
            hasLandlordContractForProperty = forProp.length > 0;
            landlordDepositYuan = forProp.reduce(
              (s: number, c: { depositAmount?: number }) => s + Number(c.depositAmount ?? 0),
              0,
            );
          }
        } catch {
          /* ignore */
        }
      }

      setRoiAnalysis({
        hasLandlordContractForProperty,
        landlordDepositYuan,
        renovationCents,
        equipmentCents,
        currentMonthNetCents: data.netProfit,
        avg3MonthNetCents,
      });

      let tenantEscrowCents = 0;
      for (const d of Array.isArray(depAll) ? depAll : []) {
        if (d.type !== '收取') continue;
        if (!roomIdSet.has(String(d.roomId))) continue;
        tenantEscrowCents += Number(d.amount ?? 0);
      }

      setDepositStatus({
        landlordDepositYuan,
        tenantEscrowCents,
      });
    } catch (error) {
      console.error(error);
      setMonthlyReport(null);
      setElectricityAnalysis(null);
      setDepositStatus(null);
      setRoiAnalysis(null);
      setError(error instanceof Error ? error.message : '載入月報表失敗');
    } finally {
      setIsLoading(false);
    }
  }, [selectedProperty, selectedMonth]);

  const loadSummaryReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.get<SummaryReport>(`/api/reports/summary?month=${selectedMonth}`);
      setSummaryReport(data);
    } catch (error) {
      console.error(error);
      setSummaryReport(null);
      setError(error instanceof Error ? error.message : '載入總覽報表失敗');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (activeTab === 'monthly') {
      void loadMonthlyReport();
    } else {
      void loadSummaryReport();
    }
  }, [activeTab, selectedProperty, selectedMonth, loadMonthlyReport, loadSummaryReport]);

  // 圖表資料準備
  const getIncomeChartData = () => {
    if (!monthlyReport) return [];
    
    return [
      { name: '租金', value: monthlyReport.income.rent, color: '#3b82f6' },
      { name: '電費', value: monthlyReport.income.electricity, color: '#10b981' },
      { name: '補充', value: monthlyReport.income.extra, color: '#8b5cf6' },
    ];
  };

  const getExpenseChartData = () => {
    if (!monthlyReport) return [];
    
    return [
      { name: '固定支出', value: monthlyReport.expense.fixed, color: '#ef4444' },
      { name: '資本支出', value: monthlyReport.expense.capital, color: '#f59e0b' },
    ];
  };

  const getProfitLossData = () => {
    if (!monthlyReport) return [];
    
    return [
      { name: '收入', value: monthlyReport.income.total, type: 'income' },
      { name: '支出', value: monthlyReport.expense.total, type: 'expense' },
      { name: '淨利', value: monthlyReport.netProfit, type: 'profit' },
    ];
  };

  const getPropertyComparisonData = () => {
    if (!summaryReport) return [];
    
    return summaryReport.properties.map(p => ({
      name: p.name,
      收入: p.income / 100,
      支出: p.expense / 100,
      淨利: p.netProfit / 100,
    }));
  };

  // 匯出報表
  const handleExport = () => {
    alert('匯出功能開發中...');
    // 實際實現時會生成 CSV 或 PDF
  };

  // 計算百分比
  const calculatePercentage = (part: number, total: number) => {
    if (total === 0) return 0;
    return ((part / total) * 100).toFixed(1);
  };

  return (
    <PageShell>
      <div className="flex flex-col space-y-6">
        <PageHeader
          title="損益報表"
          description="分析物業收入、支出與淨利，掌握營運狀況"
          actions={
            <Button onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              匯出報表
            </Button>
          }
        />

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
              {activeTab === 'monthly' && (
                <div className="space-y-2">
                  <Label htmlFor="property">物業</Label>
                  <Select
                    value={selectedProperty || '__none__'}
                    onValueChange={(value) => setSelectedProperty(value === '__none__' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇物業" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">請選擇物業</SelectItem>
                      {properties.map(property => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2 lg:col-span-2">
                <Label>報表類型</Label>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="monthly">單一物業月報</TabsTrigger>
                    <TabsTrigger value="summary">所有物業總覽</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 載入狀態 */}
        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <div className="flex justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">載入報表中...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center text-red-500">
              <p>{error}</p>
              <Button variant="outline" onClick={activeTab === 'monthly' ? loadMonthlyReport : loadSummaryReport} className="mt-2">
                重試
              </Button>
            </CardContent>
          </Card>
        ) : activeTab === 'monthly' ? (
          // 單一物業月報
          selectedProperty ? (
            monthlyReport ? (
              <>
                {/* 關鍵指標 */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">總收入</CardTitle>
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(monthlyReport.income.total)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        已收 {formatCurrency(monthlyReport.income.collected)} (
                        {calculatePercentage(monthlyReport.income.collected, monthlyReport.income.total)}%)
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">總支出</CardTitle>
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        {formatCurrency(monthlyReport.expense.total)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        固定 {formatCurrency(monthlyReport.expense.fixed)} • 
                        資本 {formatCurrency(monthlyReport.expense.capital)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">淨利</CardTitle>
                      <DollarSign className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(monthlyReport.netProfit)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        利潤率 {calculatePercentage(monthlyReport.netProfit, monthlyReport.income.total)}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">入住率</CardTitle>
                      <Home className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-purple-600">
                        {monthlyReport.rooms.occupancyRate}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {monthlyReport.rooms.occupied} / {monthlyReport.rooms.total} 間
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* 圖表區 */}
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* 收入組成圖 */}
                  <Card>
                    <CardHeader>
                      <CardTitle>收入組成</CardTitle>
                      <CardDescription>各項收入來源占比</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={getIncomeChartData()}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {getIncomeChartData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(value as number)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* 支出組成圖 */}
                  <Card>
                    <CardHeader>
                      <CardTitle>支出組成</CardTitle>
                      <CardDescription>固定與資本支出占比</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={getExpenseChartData()}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {getExpenseChartData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(value as number)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* 損益柱狀圖 */}
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>損益分析</CardTitle>
                      <CardDescription>收入、支出與淨利對比</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getProfitLossData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis tickFormatter={(value) => formatCurrency(value).replace('$', '')} />
                          <Tooltip formatter={(value) => formatCurrency(value as number)} />
                          <Legend />
                          <Bar dataKey="value" name="金額" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* 詳細數據表格 */}
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* 收入明細 */}
                  <Card>
                    <CardHeader>
                      <CardTitle>收入明細</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>項目</TableHead>
                            <TableHead className="text-right">金額</TableHead>
                            <TableHead className="text-right">占比</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">租金收入</TableCell>
                            <TableCell className="text-right text-green-600">
                              {formatCurrency(monthlyReport.income.rent)}
                            </TableCell>
                            <TableCell className="text-right">
                              {calculatePercentage(monthlyReport.income.rent, monthlyReport.income.total)}%
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">電費收入</TableCell>
                            <TableCell className="text-right text-green-600">
                              {formatCurrency(monthlyReport.income.electricity)}
                            </TableCell>
                            <TableCell className="text-right">
                              {calculatePercentage(monthlyReport.income.electricity, monthlyReport.income.total)}%
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">補充收入</TableCell>
                            <TableCell className="text-right text-green-600">
                              {formatCurrency(monthlyReport.income.extra)}
                            </TableCell>
                            <TableCell className="text-right">
                              {calculatePercentage(monthlyReport.income.extra, monthlyReport.income.total)}%
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/50">
                            <TableCell className="font-bold">總收入</TableCell>
                            <TableCell className="text-right font-bold text-green-600">
                              {formatCurrency(monthlyReport.income.total)}
                            </TableCell>
                            <TableCell className="text-right font-bold">100%</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* 支出明細 */}
                  <Card>
                    <CardHeader>
                      <CardTitle>支出明細</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>類別</TableHead>
                            <TableHead className="text-right">金額</TableHead>
                            <TableHead>描述</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthlyReport.expense.breakdown.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{item.category}</TableCell>
                              <TableCell className="text-right text-red-600">
                                {formatCurrency(item.amount)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.description || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50">
                            <TableCell className="font-bold">固定支出</TableCell>
                            <TableCell className="text-right font-bold text-red-600">
                              {formatCurrency(monthlyReport.expense.fixed)}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/50">
                            <TableCell className="font-bold">資本支出</TableCell>
                            <TableCell className="text-right font-bold text-red-600">
                              {formatCurrency(monthlyReport.expense.capital)}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                          <TableRow className="bg-muted">
                            <TableCell className="font-bold">總支出</TableCell>
                            <TableCell className="text-right font-bold text-red-600">
                              {formatCurrency(monthlyReport.expense.total)}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>

                {electricityAnalysis && (
                  <Card>
                    <CardHeader>
                      <CardTitle>═══ 電費差異分析（本月）═══</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {!electricityAnalysis.hasElectricityLines && (
                        <p className="text-muted-foreground">尚無電費資料</p>
                      )}
                      {electricityAnalysis.lines.map((l, idx) => (
                        <p key={`${l.roomLabel}-${idx}`}>
                          {l.roomLabel}：{l.usage}度 × ${l.rateYuan.toFixed(1)} ={' '}
                          {formatCurrency(l.amountCents / 100)}
                        </p>
                      ))}
                      {electricityAnalysis.hasElectricityLines && (
                        <>
                          <p className="font-medium">
                            合計：{formatCurrency(electricityAnalysis.totalCollectedCents / 100)}
                          </p>
                          <p>
                            實繳台電：{' '}
                            {electricityAnalysis.hasTaipowerExpense ? (
                              formatCurrency(electricityAnalysis.taipowerCents / 100)
                            ) : (
                              <span className="text-amber-800">尚未登記台電電費支出</span>
                            )}
                          </p>
                          <p>
                            電費利潤：{formatCurrency(electricityAnalysis.profitCents / 100)}{' '}
                            {electricityAnalysis.profitCents >= 0 ? '✅' : '⚠'}
                          </p>
                          <p>
                            平均每度成本：
                            {electricityAnalysis.avgCostPerDeg != null
                              ? `$${electricityAnalysis.avgCostPerDeg.toFixed(2)}/度`
                              : '—'}
                          </p>
                          <p>
                            收取單價：
                            {electricityAnalysis.collectRatePerDeg != null
                              ? `$${electricityAnalysis.collectRatePerDeg.toFixed(2)}/度`
                              : '—'}
                          </p>
                          <p>
                            每度利潤：
                            {electricityAnalysis.profitPerDeg != null
                              ? `$${electricityAnalysis.profitPerDeg.toFixed(2)}/度`
                              : '—'}
                          </p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                {depositStatus && (
                  <Card>
                    <CardHeader>
                      <CardTitle>═══ 押金狀態 ═══</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p>
                        付給房東的押金：
                        {depositStatus.landlordDepositYuan > 0 ? (
                          formatCurrency(depositStatus.landlordDepositYuan)
                        ) : (
                          <span className="text-muted-foreground">尚未設定</span>
                        )}
                      </p>
                      <p>
                        租客押金代管中：
                        {depositStatus.tenantEscrowCents > 0 ? (
                          formatCurrency(depositStatus.tenantEscrowCents / 100)
                        ) : (
                          <span className="text-muted-foreground">尚未設定</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ※ 押金為代收代付，不計入收支
                      </p>
                    </CardContent>
                  </Card>
                )}

                {roiAnalysis && monthlyReport && (
                  <RoiAnalysisCard roi={roiAnalysis} />
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">沒有該月份的報表資料</p>
                </CardContent>
              </Card>
            )
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">請選擇物業以查看月報表</p>
              </CardContent>
            </Card>
          )
        ) : (
          // 所有物業總覽
          summaryReport && (
            <>
              {/* 總覽指標 */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">物業數</CardTitle>
                    <Home className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{summaryReport.totalProperties}</div>
                    <p className="text-xs text-muted-foreground">
                      總房間數 {summaryReport.totalRooms} 間
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">入住率</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {summaryReport.totalRooms > 0 
                        ? Math.round((summaryReport.occupiedRooms / summaryReport.totalRooms) * 100) 
                        : 0}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {summaryReport.occupiedRooms} / {summaryReport.totalRooms} 間
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">總收入</CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(summaryReport.totalIncome)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      所有物業合計
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">總淨利</CardTitle>
                    <DollarSign className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(summaryReport.netProfit)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      利潤率 {summaryReport.totalIncome > 0 
                        ? ((summaryReport.netProfit / summaryReport.totalIncome) * 100).toFixed(1) 
                        : 0}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* 物業比較圖表 */}
              <Card>
                <CardHeader>
                  <CardTitle>物業損益比較</CardTitle>
                  <CardDescription>各物業收入、支出與淨利對比</CardDescription>
                </CardHeader>
                <CardContent className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getPropertyComparisonData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => formatCurrency(value * 100).replace('$', '')} />
                      <Tooltip formatter={(value) => formatCurrency((value as number) * 100)} />
                      <Legend />
                      <Bar dataKey="收入" fill="#10b981" />
                      <Bar dataKey="支出" fill="#ef4444" />
                      <Bar dataKey="淨利" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 物業詳細表格 */}
              <Card>
                <CardHeader>
                  <CardTitle>物業詳細數據</CardTitle>
                  <CardDescription>{summaryReport.month} 月份各物業表現</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>物業名稱</TableHead>
                          <TableHead className="text-right">房間數</TableHead>
                          <TableHead className="text-right">入住率</TableHead>
                          <TableHead className="text-right">收入</TableHead>
                          <TableHead className="text-right">支出</TableHead>
                          <TableHead className="text-right">淨利</TableHead>
                          <TableHead className="text-right">利潤率</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summaryReport.properties.map((property) => (
                          <TableRow key={property.id}>
                            <TableCell className="font-medium">{property.name}</TableCell>
                            <TableCell className="text-right">
                              {property.rooms} 間
                            </TableCell>
                            <TableCell className="text-right">
                              {property.rooms > 0 
                                ? Math.round((property.occupied / property.rooms) * 100) 
                                : 0}%
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              {formatCurrency(property.income)}
                            </TableCell>
                            <TableCell className="text-right text-red-600">
                              {formatCurrency(property.expense)}
                            </TableCell>
                            <TableCell className="text-right font-bold text-blue-600">
                              {formatCurrency(property.netProfit)}
                            </TableCell>
                            <TableCell className="text-right">
                              {property.income > 0 
                                ? ((property.netProfit / property.income) * 100).toFixed(1) 
                                : 0}%
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted">
                          <TableCell className="font-bold">總計</TableCell>
                          <TableCell className="text-right font-bold">
                            {summaryReport.totalRooms} 間
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {summaryReport.totalRooms > 0 
                              ? Math.round((summaryReport.occupiedRooms / summaryReport.totalRooms) * 100) 
                              : 0}%
                          </TableCell>
                          <TableCell className="text-right font-bold text-green-600">
                            {formatCurrency(summaryReport.totalIncome)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-red-600">
                            {formatCurrency(summaryReport.totalExpense)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-blue-600">
                            {formatCurrency(summaryReport.netProfit)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {summaryReport.totalIncome > 0 
                              ? ((summaryReport.netProfit / summaryReport.totalIncome) * 100).toFixed(1) 
                              : 0}%
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )
        )}
      </div>
    </PageShell>
  );
}