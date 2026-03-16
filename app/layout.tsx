'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
 LayoutDashboard, Building, Users, CreditCard,
 Gauge, LogOut, TrendingDown, TrendingUp,
 BarChart3, Wrench, Menu, X, Home, UserCog
} from 'lucide-react';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
 const pathname = usePathname();
 const [sidebarOpen, setSidebarOpen] = useState(false);

 // 登入頁面不顯示導航
 if (pathname === '/login') {
 return (
 <html lang="zh-TW">
 <body className="min-h-screen bg-gray-50">{children}</body>
 </html>
 );
 }

 return (
 <html lang="zh-TW">
 <body className="min-h-screen bg-gray-50">
 <div className="flex h-screen">
 {/* 手機版遮罩 */}
 {sidebarOpen && (
 <div
 className="fixed inset-0 bg-black/50 z-40 lg:hidden"
 onClick={() => setSidebarOpen(false)}
 />
 )}

 {/* 側邊導航列 */}
 <aside className={`
 fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white
 transform transition-transform duration-200 ease-in-out
 lg:translate-x-0 lg:static lg:z-auto
 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
 `}>
 {/* Logo 區 */}
 <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
 <Link href="/dashboard" className="flex items-center gap-2">
 <Home className="w-6 h-6 text-blue-400" />
 <div>
 <h1 className="text-sm font-bold">租屋管理系統</h1>
 <p className="text-xs text-gray-400">v2.0</p>
 </div>
 </Link>
 <button
 onClick={() => setSidebarOpen(false)}
 className="lg:hidden p-1 rounded hover:bg-gray-700"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* 導航連結 */}
 <nav className="mt-4 px-2 space-y-1">
 {navItems.map((item) => {
 const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
 const Icon = item.icon;
 return (
 <Link
 key={item.href}
 href={item.href}
 onClick={() => setSidebarOpen(false)}
 className={`
 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
 transition-colors duration-150
 ${isActive
 ? 'bg-blue-600 text-white'
 : 'text-gray-300 hover:bg-gray-800 hover:text-white'
 }
 `}
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
 <button
 onClick={() => setSidebarOpen(true)}
 className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
 >
 <Menu className="w-6 h-6" />
 </button>
 <h2 className="ml-2 lg:ml-0 text-lg font-semibold text-gray-800">
 {navItems.find(item => pathname === item.href || pathname?.startsWith(item.href + '/'))?.label || '租屋管理系統'}
 </h2>
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