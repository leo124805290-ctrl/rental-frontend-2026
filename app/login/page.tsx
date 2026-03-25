'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { api, setAuthToken, ApiError } from '@/lib/api-client';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@rental.com');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setError('請輸入電子郵件');
      return;
    }
    if (!password) {
      setError('請輸入密碼');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.post<{
        user: { id: string; email: string; role: string };
        tokens: { accessToken: string; refreshToken?: string; expiresIn?: number };
      }>('/api/auth/login', {
        email: email.trim(),
        password,
      });

      const access = result.tokens?.accessToken;
      if (!access) {
        throw new Error('登入回應缺少 accessToken');
      }
      setAuthToken(access);
      router.push('/');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || '登入失敗');
      } else {
        setError(err instanceof Error ? err.message : '登入失敗，請稍後再試');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-sky-50/40 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-medium border-border/80 bg-card/95 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-landlord-400 to-landlord-600 flex items-center justify-center shadow-soft">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center text-foreground tracking-tight">
              租屋管理系統
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              請使用後端資料庫帳號登入
              <br />
              <span className="text-xs">
                本機預設：<code className="rounded bg-muted px-1 py-0.5">admin@rental.com</code>（密碼見{' '}
                <code className="rounded bg-muted px-1 py-0.5">npm run db:seed</code> 輸出）
              </span>
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">電子郵件</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@rental.com"
                  className="h-11"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密碼</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="請輸入密碼"
                  className="h-11"
                  required
                  disabled={isLoading}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-base font-medium"
                isLoading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? '登入中...' : '登入'}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-xs text-muted-foreground leading-relaxed">
                登入成功後，瀏覽器會儲存 JWT；後續 API 請求會自動帶上 Authorization。若無法登入，請確認後端已執行{' '}
                <code className="rounded bg-muted px-1">db:seed</code> 且帳密正確。
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">v2.0 • 台灣房東越南租客管理系統</p>
        </div>
      </div>
    </div>
  );
}
