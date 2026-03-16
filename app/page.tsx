import { CheckCircle, Clock, Cpu, Database, Shield, Users } from 'lucide-react';
import StatusBadge from '@/components/ui/status-badge';

export default function HomePage() {
  const features = [
    {
      icon: <Database className="w-5 h-5" />,
      title: 'TypeScript + Drizzle ORM',
      description: '全類型安全後端，PostgreSQL 資料庫，軟刪除設計',
      status: 'done',
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: 'JWT 雙重認證',
      description: 'Access + Refresh Token，角色權限管理',
      status: 'done',
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: '多帳號權限系統',
      description: 'super_admin / admin 分層權限，物業管理員關聯',
      status: 'done',
    },
    {
      icon: <Cpu className="w-5 h-5" />,
      title: '12 大功能模組',
      description: '物業、租客、收租、押金、支出、報表等完整功能',
      status: 'building',
    },
    {
      icon: <Clock className="w-5 h-5" />,
      title: '入住三情境 + 退租結算',
      description: '全額/押金/預約三種入住，日租金精算退租',
      status: 'building',
    },
    {
      icon: <CheckCircle className="w-5 h-5" />,
      title: '中越雙語介面',
      description: 'next-intl 國際化，完整中文/越南文支援',
      status: 'pending',
    },
  ];

  const backendStatus = [
    { name: 'Express 伺服器', status: '完成' },
    { name: 'Drizzle Schema', status: '完成' },
    { name: 'JWT 認證系統', status: '完成' },
    { name: '種子資料', status: '完成' },
    { name: 'API 路由', status: '建置中' },
    { name: '資料驗證', status: '建置中' },
  ];

  const frontendStatus = [
    { name: 'Next.js 15 骨架', status: '完成' },
    { name: 'Tailwind CSS', status: '建置中' },
    { name: 'shadcn/ui 元件', status: '建置中' },
    { name: '多語言設定', status: '待開始' },
    { name: '儀表板頁面', status: '待開始' },
    { name: 'API 整合', status: '待開始' },
  ];

  return (
    <div className="space-y-12">
      {/* CSS 測試區塊 */}
      <div style={{ backgroundColor: 'red', color: 'white', padding: '20px', fontSize: '24px', marginBottom: '20px' }}>
        如果你看到這個紅色區塊，HTML 正常但 CSS 有問題
      </div>
      <div className="bg-blue-500 text-white p-4 text-2xl mb-4">
        如果你看到這個藍色區塊，Tailwind CSS 正常運作
      </div>
      {/* 首頁標題 */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium mb-4">
          <div className="w-2 h-2 bg-blue-600 rounded-full mr-2 animate-pulse"></div>
          系統建置中 v2.0
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
          台灣房東越南租客管理系統
          <span className="text-blue-600 ml-2">v2.0</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          全新架構 • 全類型安全 • 中越雙語 • 完整功能模組
        </p>
      </div>

      {/* 系統狀態 */}
      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Cpu className="w-5 h-5 mr-2 text-blue-600" />
            後端狀態
          </h2>
          <ul className="space-y-3">
            {backendStatus.map((item, index) => (
              <li key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-gray-700">{item.name}</span>
                <StatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Cpu className="w-5 h-5 mr-2 text-green-600" />
            前端狀態
          </h2>
          <ul className="space-y-3">
            {frontendStatus.map((item, index) => (
              <li key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-gray-700">{item.name}</span>
                <StatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 功能特色 */}
      <div className="bg-white rounded-xl shadow-sm border p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
          技術特色與功能模組
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`p-6 rounded-lg border ${feature.status === 'done' ? 'border-green-200 bg-green-50' : feature.status === 'building' ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}
            >
              <div className="flex items-start space-x-4">
                <div className={`p-2 rounded-lg ${feature.status === 'done' ? 'bg-green-100 text-green-600' : feature.status === 'building' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                  {feature.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {feature.description}
                  </p>
                  <div className="mt-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${feature.status === 'done' ? 'bg-green-100 text-green-700' : feature.status === 'building' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                      {feature.status === 'done' ? '已完成' : feature.status === 'building' ? '建置中' : '待開始'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 架構原則 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-100 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          三大架構原則（不可妥協）
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="text-blue-600 font-bold text-lg mb-2">1. 軟刪除</div>
            <p className="text-gray-700">
              所有資料表都有 deleted_at 欄位，永遠不使用 DELETE，查詢自動過濾已刪除資料。
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="text-green-600 font-bold text-lg mb-2">2. 斷線保護</div>
            <p className="text-gray-700">
              前端即時顯示連線狀態，API 失敗有明確錯誤提示，不依賴 localStorage 關鍵資料。
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="text-purple-600 font-bold text-lg mb-2">3. 防重複提交</div>
            <p className="text-gray-700">
              按鈕點擊後自動禁用，後端檢查 idempotency key，關鍵操作使用 transaction。
            </p>
          </div>
        </div>
      </div>

      {/* 下一步行動 */}
      <div className="text-center space-y-6">
        <div className="inline-flex items-center px-6 py-3 bg-gray-900 text-white rounded-lg">
          <Clock className="w-5 h-5 mr-2" />
          <span className="font-medium">預計上線時間：2026年3月下旬</span>
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          目前正在進行後端 API 開發與前端元件建置。
          全部功能完成後會進行整合測試，然後部署到 Vercel + Zeabur。
        </p>
      </div>
    </div>
  );
}