import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
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
          {/* 導航欄 */}
          <header className="bg-white shadow-sm border-b">
            <div className="container mx-auto px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-600 text-white w-8 h-8 rounded-lg flex items-center justify-center">
                    <span className="font-bold">房</span>
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-gray-900">
                      台灣房東越南租客管理系統
                    </h1>
                    <p className="text-xs text-gray-500">v2.0 - 全新架構</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-500 hidden md:inline">
                    系統建置中
                  </span>
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
          </header>

          {/* 導航選單 */}
          <nav className="bg-white border-b shadow-sm">
            <div className="container mx-auto px-4">
              <div className="flex overflow-x-auto py-2 space-x-1">
                <a href="/" className="px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 whitespace-nowrap">
                  🏠 儀表板
                </a>
                <a href="/properties" className="px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 whitespace-nowrap">
                  🏢 物業管理
                </a>
                <a href="/tenants" className="px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 whitespace-nowrap">
                  👤 租客管理
                </a>
                <a href="/payments" className="px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 whitespace-nowrap">
                  💰 收租管理
                </a>
                <a href="/meter-readings" className="px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 whitespace-nowrap">
                  🔌 抄電錶
                </a>
                <a href="/checkout" className="px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 whitespace-nowrap">
                  🚪 退租結算
                </a>
                <a href="/expenses" className="px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 whitespace-nowrap">
                  📉 支出管理
                </a>
                <a href="/incomes" className="px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 whitespace-nowrap">
                  📈 補充收入
                </a>
                <a href="/reports" className="px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 whitespace-nowrap">
                  📊 損益報表
                </a>
                <a href="/maintenance" className="px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 whitespace-nowrap">
                  🔧 維修紀錄
                </a>
              </div>
            </div>
          </nav>

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