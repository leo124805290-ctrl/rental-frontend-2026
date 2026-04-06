'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { filterVisibleNav, hasPageAccess } from '@/lib/permissions';
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
  History,
  DoorOpen,
  Landmark,
  Upload,
} from 'lucide-react';
import { UserSessionMenu } from '@/components/app-shell/user-session-menu';

const navItems = [
  { href: '/dashboard', label: '儀表板', icon: LayoutDashboard },
  { href: '/properties', label: '物業管理', icon: Building },
  { href: '/rooms', label: '房間管理', icon: DoorOpen },
  { href: '/payment-details', label: '收款明細', icon: CreditCard },
  { href: '/deposits', label: '押金管理', icon: History },
  { href: '/checkout', label: '退租結算', icon: LogOut },
  { href: '/finance', label: '收支管理', icon: Wallet },
  { href: '/reports', label: '損益報表', icon: BarChart3 },
  { href: '/meter-history', label: '電錶歷史', icon: Gauge },
  { href: '/users', label: '使用者管理', icon: UserCog },
  { href: '/landlord-payments', label: '房東付款', icon: Landmark },
  { href: '/import', label: '舊資料補登', icon: Upload },
];

function pageTitleFromPath(pathname: string): string {
  if (pathname === '/' || pathname === '/dashboard') return '儀表板';
  if (pathname === '/properties') return '物業管理';
  if (pathname.startsWith('/properties/')) return '物業詳情';
  if (pathname === '/rooms') return '房間管理';
  if (pathname === '/payment-details' || pathname === '/payments') return '收款明細';
  if (pathname === '/deposits') return '押金管理';
  if (pathname === '/checkout') return '退租結算';
  if (pathname === '/finance') return '收支管理';
  if (pathname === '/reports') return '損益報表';
  if (pathname === '/meter-history') return '電錶歷史';
  if (pathname === '/users') return '使用者管理';
  if (pathname === '/landlord-payments') return '房東付款管理';
  if (pathname === '/login') return '登入';
  return '租屋管理系統';
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleNavItems = navItems.filter((item) => filterVisibleNav(item.href));

  useEffect(() => {
    if (pathname === '/login') return;
    if (!hasPageAccess(pathname)) {
      router.replace('/dashboard');
    }
  }, [pathname, router]);

  const isActive = (href: string) => {
    if (href === '/dashboard' && pathname === '/') return true;
    if (href === '/properties') return pathname === '/properties';
    if (href === '/rooms') return pathname === '/rooms';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  if (pathname === '/login') {
    return (
      <html lang="zh-TW">
        <body className="min-h-screen bg-slate-50 font-noto-sans-tc antialiased">{children}</body>
      </html>
    );
  }

  const pageTitle = pageTitleFromPath(pathname);
  const todayStr = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const appVersion =
    typeof process.env['APP_VERSION'] === 'string' && process.env['APP_VERSION']
      ? process.env['APP_VERSION']
      : '2.0.0';

  return (
    <html lang="zh-TW">
      <body className="min-h-screen bg-slate-50 font-noto-sans-tc antialiased">
        <div className="flex h-screen">
          <aside
            className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col bg-slate-900 text-white transform transition-transform duration-200 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto`}
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-700/80 px-4">
              <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
                <LayoutDashboard className="w-6 h-6 text-landlord-400" />
                <div>
                  <h1 className="text-sm font-bold tracking-tight">租屋管理系統</h1>
                  <p className="text-xs text-slate-400">Taiwan Landlord</p>
                </div>
              </Link>
              <button
                type="button"
                className="rounded p-1 hover:bg-slate-800 lg:hidden"
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

            <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      'flex items-center gap-3 rounded-r-lg border-l-[3px] py-2.5 pl-[calc(0.75rem-3px)] pr-3 text-sm font-medium transition-colors duration-150',
                      active
                        ? 'border-landlord-400 bg-slate-800/90 text-white'
                        : 'border-transparent text-slate-300 hover:border-slate-600 hover:bg-slate-800/60 hover:text-white',
                    ].join(' ')}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0 opacity-90" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="shrink-0 border-t border-slate-800/80 px-4 py-3 text-[11px] text-slate-500">
              管理後台 v{appVersion}
            </div>
          </aside>

          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/40 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          )}

          <div className="flex min-w-0 flex-1 flex-col bg-slate-50">
            <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 shadow-soft backdrop-blur-sm lg:px-6">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
                  onClick={() => setSidebarOpen((open) => !open)}
                  aria-label="開啟側邊選單"
                >
                  <Menu className="h-5 w-5 text-slate-700" />
                </button>
                <h2 className="truncate text-lg font-semibold tracking-tight text-slate-900">{pageTitle}</h2>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <span className="hidden text-sm text-slate-500 sm:inline">今日 {todayStr}</span>
                <UserSessionMenu />
              </div>
            </header>

            <main className="flex-1 overflow-auto bg-slate-50">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
