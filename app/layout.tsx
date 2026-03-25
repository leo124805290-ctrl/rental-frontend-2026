'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Building,
  CreditCard,
  LogOut,
  Wallet,
  BarChart3,
  Gauge,
  UserCog,
  Menu,
  Shield,
} from 'lucide-react';
import { UserSessionMenu } from '@/components/app-shell/user-session-menu';

const navItems = [
  { href: '/dashboard', label: '儀表板', icon: LayoutDashboard },
  { href: '/properties', label: '物業管理', icon: Building },
  { href: '/payments', label: '收租管理', icon: CreditCard },
  { href: '/deposits', label: '押金管理', icon: Shield },
  { href: '/checkout', label: '退租結算', icon: LogOut },
  { href: '/finance', label: '收支管理', icon: Wallet },
  { href: '/reports', label: '損益報表', icon: BarChart3 },
  { href: '/meter-history', label: '電錶歷史', icon: Gauge },
  { href: '/users', label: '使用者管理', icon: UserCog },
];

function pageTitleFromPath(pathname: string): string {
  if (pathname === '/' || pathname === '/dashboard') return '儀表板';
  if (pathname === '/properties') return '物業管理';
  if (pathname.startsWith('/properties/')) return '房間管理';
  if (pathname === '/payments') return '收租管理';
  if (pathname === '/deposits') return '押金管理';
  if (pathname === '/checkout') return '退租結算';
  if (pathname === '/finance') return '收支管理';
  if (pathname === '/reports') return '損益報表';
  if (pathname === '/meter-history') return '電錶歷史';
  if (pathname === '/users') return '使用者管理';
  if (pathname === '/login') return '登入';
  return '租屋管理系統';
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/dashboard' && pathname === '/') return true;
    if (href === '/properties') return pathname === '/properties';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  if (pathname === '/login') {
    return (
      <html lang="zh-TW">
        <body className="min-h-screen bg-slate-100">{children}</body>
      </html>
    );
  }

  const pageTitle = pageTitleFromPath(pathname);
  const todayStr = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return (
    <html lang="zh-TW">
      <body className="min-h-screen bg-slate-100">
        <div className="flex h-screen">
          <aside
            className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto`}
          >
            <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700">
              <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
                <LayoutDashboard className="w-6 h-6 text-blue-400" />
                <div>
                  <h1 className="text-sm font-bold tracking-tight">租屋管理系統</h1>
                  <p className="text-xs text-slate-400">Taiwan Landlord</p>
                </div>
              </Link>
              <button
                type="button"
                className="lg:hidden p-1 rounded hover:bg-slate-800"
                onClick={() => setSidebarOpen(false)}
                aria-label="關閉側邊選單"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <nav className="mt-4 px-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150',
                      active
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                    ].join(' ')}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>

          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/40 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          )}

          <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
            <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
                  onClick={() => setSidebarOpen((open) => !open)}
                  aria-label="開啟側邊選單"
                >
                  <Menu className="h-5 w-5 text-slate-700" />
                </button>
                <h2 className="text-lg font-semibold text-slate-900 truncate">{pageTitle}</h2>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <span className="text-sm text-slate-600 hidden sm:inline">今日 {todayStr}</span>
                <UserSessionMenu />
              </div>
            </header>

            <main className="flex-1 overflow-auto bg-gray-50">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
