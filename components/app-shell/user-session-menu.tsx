'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { removeAuthToken } from '@/lib/api-client';
import {
  endAuthSession,
  getStoredAuthUser,
  getStoredLastLoginAt,
  getStoredSessionIdentity,
  touchAuthSession,
} from '@/lib/auth-user';
import { LogOut, UserRound } from 'lucide-react';

/**
 * 登出：清除 token 並回到登入頁。
 * 切換帳號：同樣清除 session，方便以其他身分重新登入（後端若支援多帳密）。
 */
export function UserSessionMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [currentUserLabel, setCurrentUserLabel] = useState('未登入');
  const [currentUserMeta, setCurrentUserMeta] = useState('');

  useEffect(() => {
    const sync = () => {
      const user = getStoredAuthUser();
      const session = getStoredSessionIdentity();
      const lastLoginAt = getStoredLastLoginAt();
      const label = user?.fullName || user?.username || user?.email || '未登入';
      const meta = [
        user?.role ? `角色：${user.role}` : '',
        lastLoginAt ? `上次登入：${new Date(lastLoginAt).toLocaleString('zh-TW')}` : '',
        session ? `Session：${session.sessionId.slice(0, 8)}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      setCurrentUserLabel(label);
      setCurrentUserMeta(meta);
    };

    sync();
    window.addEventListener('auth-user-changed', sync as EventListener);
    return () => window.removeEventListener('auth-user-changed', sync as EventListener);
  }, []);

  useEffect(() => {
    touchAuthSession(pathname);
    const timer = window.setInterval(() => touchAuthSession(pathname), 60_000);
    return () => window.clearInterval(timer);
  }, [pathname]);

  const goToLogin = (reason: 'logout' | 'switch_account') => {
    endAuthSession(reason);
    syncAuthHeaderDisplay();
    removeAuthToken();
    router.push('/login');
    router.refresh();
  };

  const syncAuthHeaderDisplay = () => {
    const user = getStoredAuthUser();
    const session = getStoredSessionIdentity();
    const lastLoginAt = getStoredLastLoginAt();
    const label = user?.fullName || user?.username || user?.email || '未登入';
    const meta = [
      user?.role ? `角色：${user.role}` : '',
      lastLoginAt ? `上次登入：${new Date(lastLoginAt).toLocaleString('zh-TW')}` : '',
      session ? `Session：${session.sessionId.slice(0, 8)}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    setCurrentUserLabel(label);
    setCurrentUserMeta(meta);
  };

  const handleLogout = () => {
    if (!confirm('確定要登出嗎？')) return;
    setBusy(true);
    try {
      goToLogin('logout');
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchAccount = () => {
    if (!confirm('將結束目前登入並前往登入頁，以便重新輸入密碼。確定？')) return;
    setBusy(true);
    try {
      goToLogin('switch_account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="hidden max-w-[320px] flex-col text-right sm:flex">
        <span className="truncate text-sm font-medium text-slate-800">{currentUserLabel}</span>
        {currentUserMeta ? (
          <span className="truncate text-xs text-slate-500">{currentUserMeta}</span>
        ) : null}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-slate-200 text-slate-700"
        onClick={handleSwitchAccount}
        disabled={busy}
        title="清除登入狀態並返回登入頁"
      >
        <UserRound className="h-4 w-4 mr-1.5" />
        <span className="hidden sm:inline">切換帳號</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-slate-200 text-slate-700"
        onClick={handleLogout}
        disabled={busy}
      >
        <LogOut className="h-4 w-4 mr-1.5" />
        <span className="hidden sm:inline">登出</span>
      </Button>
    </div>
  );
}
