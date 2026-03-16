import './globals.css';
import Link from 'next/link';
import { LayoutDashboard, Building, Users, CreditCard, Gauge, LogOut, TrendingDown, TrendingUp, BarChart3, Wrench, Home, UserCog } from 'lucide-react';
import { ReactNode } from 'react';

const navItems = [
  { href: '/dashboard', label: '儀表板', icon: LayoutDashboard },
  { href: '/properties', label: '物業管理', icon: Building },
  { href: '/tenants', label: '租客管理', icon: Users },
  { href: '/payments', label: '收租管理', icon: CreditCard },
  { href: '/meter-readings', label: '抄電錶', icon: Gauge },
  { href: '/checkout', label: '退租結算', icon: LogOut },
  { href: '/expenses', label: '支出管理', icon: TrendingDown },
  { href: '/incomes', label: '補充收入', icon: TrendingUp },
  { href: '/reports', label: '損益報表', icon: BarChart3 },
  { href: '/maintenance', label: '維修紀錄', icon: Wrench },
  { href: '/users', label: '使用者管理', icon: UserCog },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen bg-gray-50">
        <div className="flex h-screen">
          {/* 側邊導航列 - 靜態版本 */}
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto">
            {/* Logo 區 */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
              <Link href="/dashboard" className="flex items-center gap-2">
                <Home className="w-6 h-6 text-blue-400" />
                <div>
                  <h1 className="text-sm font-bold">租屋管理系統</h1>
                  <p className="text-xs text-gray-400">v2.0</p>
                </div>
              </Link>
              <button className="lg:hidden p-1 rounded hover:bg-gray-700">
                {/* 手機版關閉按鈕，需客戶端交互 */}
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* 導航連結 */}
            <nav className="mt-4 px-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors duration-150"
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* 主要內容區 */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* 頂部列 */}
            <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-6">
              <button className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
                {/* 手機版選單按鈕 */}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" x2="20" y1="12" y2="12" />
                  <line x1="4" x2="20" y1="6" y2="6" />
                  <line x1="4" x2="20" y1="18" y2="18" />
                </svg>
              </button>
              <h2 className="ml-2 lg:ml-0 text-lg font-semibold text-gray-800">租屋管理系統</h2>
            </header>

            {/* 頁面內容 */}
            <main className="flex-1 overflow-auto p-4 lg:p-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}