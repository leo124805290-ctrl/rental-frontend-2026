import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { LayoutDashboard, Building, Users, CreditCard, Gauge, LogOut, TrendingDown, TrendingUp, BarChart3, Wrench, Menu } from 'lucide-react';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '台灣房東越南租客管理系統 v2.0',
  description: '專為台灣房東管理越南租客設計的管理平台 - 2026全新版本',
  keywords: ['台灣房東', '越南租客', '物業管理', '租金管理', '系統'],
  authors: [{ name: 'OpenClaw Assistant' }],
  creator: 'OpenClaw Assistant',
  publisher: 'OpenClaw Assistant',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 導航連結組件
  function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
    return (
      <Link
        href={href}
        className="flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
      >
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </Link>
    );
  }

  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#3b82f6" />
      </head>
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <div className="min-h-screen flex flex-col">
          {/* 主導航欄 */}
          <header className="bg-gray-900 text-white shadow-lg">
            <div className="container mx-auto px-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between py-3">
                {/* Logo 與系統名稱 */}
                <div className="flex items-center justify-between mb-4 md:mb-0">
                  <Link href="/" className="flex items-center space-x-3 hover:opacity-90 transition-opacity">
                    <div className="bg-blue-500 text-white w-10 h-10 rounded-lg flex items-center justify-center">
                      <span className="font-bold text-lg">房</span>
                    </div>
                    <div>
                      <h1 className="text-xl font-bold tracking-tight">
                        台灣房東越南租客管理系統
                      </h1>
                      <p className="text-sm text-gray-300">v2.0 - 全新架構</p>
                    </div>
                  </Link>
                  
                  {/* 手機版漢堡選單按鈕（暫時隱藏，使用滾動導航） */}
                  <button className="md:hidden text-gray-300 hover:text-white">
                    <Menu className="h-6 w-6" />
                  </button>
                </div>
                
                {/* 系統狀態 */}
                <div className="hidden md:flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-300">系統運行中</span>
                  </div>
                </div>
              </div>
              
              {/* 主導航連結 */}
              <nav className="pb-3 md:pb-0">
                <div className="flex overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible md:flex-wrap gap-1">
                  <NavLink href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} label="儀表板" />
                  <NavLink href="/properties" icon={<Building className="h-4 w-4" />} label="物業管理" />
                  <NavLink href="/tenants" icon={<Users className="h-4 w-4" />} label="租客管理" />
                  <NavLink href="/payments" icon={<CreditCard className="h-4 w-4" />} label="收租管理" />
                  <NavLink href="/meter-readings" icon={<Gauge className="h-4 w-4" />} label="抄電錶" />
                  <NavLink href="/checkout" icon={<LogOut className="h-4 w-4" />} label="退租結算" />
                  <NavLink href="/expenses" icon={<TrendingDown className="h-4 w-4" />} label="支出管理" />
                  <NavLink href="/incomes" icon={<TrendingUp className="h-4 w-4" />} label="補充收入" />
                  <NavLink href="/reports" icon={<BarChart3 className="h-4 w-4" />} label="損益報表" />
                  <NavLink href="/maintenance" icon={<Wrench className="h-4 w-4" />} label="維修紀錄" />
                  <NavLink href="/users" icon={<Users className="h-4 w-4" />} label="使用者管理" />
                </div>
              </nav>
            </div>
          </header>

          {/* 主內容 */}
          <main className="flex-1 container mx-auto px-4 py-8">
            {children}
          </main>

          {/* 頁尾 */}
          <footer className="bg-white border-t py-6">
            <div className="container mx-auto px-4">
              <div className="flex flex-col md:flex-row justify-between items-center">
                <div className="mb-4 md:mb-0">
                  <p className="text-sm text-gray-600">
                    © 2026 台灣房東越南租客管理系統 v2.0
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    專為台灣房東設計 • 支援中文/越南文 • 全端 TypeScript
                  </p>
                </div>
                <div className="flex space-x-6">
                  <a href="#" className="text-sm text-gray-600 hover:text-blue-600">
                    隱私權政策
                  </a>
                  <a href="#" className="text-sm text-gray-600 hover:text-blue-600">
                    使用條款
                  </a>
                  <a href="#" className="text-sm text-gray-600 hover:text-blue-600">
                    聯絡我們
                  </a>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t text-center">
                <p className="text-xs text-gray-500">
                  ⚠️ 此為開發版本，部分功能仍在建置中
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}