'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api, setAuthToken, ApiError } from '@/lib/api-client';
import { startAuthSession } from '@/lib/auth-user';

type LoginData = {
  user: {
    id: string;
    username: string;
    email?: string;
    fullName?: string;
    role: string;
  };
  token?: string;
  tokens?: { accessToken: string; refreshToken?: string; expiresIn?: number };
};

export default function LoginPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      setError('請輸入帳號');
      return;
    }
    if (!password.trim()) {
      setError('請輸入密碼');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.post<LoginData>('/api/auth/login', {
        username: username.trim(),
        password: password.trim(),
      });

      const jwt = result.token ?? result.tokens?.accessToken;
      if (!jwt) {
        throw new Error('登入回應缺少 token');
      }
      setAuthToken(jwt);
      startAuthSession({
        id: result.user.id,
        username: result.user.username,
        role: result.user.role,
        ...(result.user.email ? { email: result.user.email } : {}),
        ...(result.user.fullName ? { fullName: result.user.fullName } : {}),
      });
      router.push('/dashboard');
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg border-gray-200">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-2 text-4xl" aria-hidden>
              🔒
            </div>
            <CardTitle className="text-2xl font-bold text-center text-gray-800">
              租屋管理系統
            </CardTitle>
            <CardDescription className="text-center text-gray-600">
              請輸入帳號與密碼登入（與 Zeabur 後端一致）
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium text-gray-700">
                  帳號
                </label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="請輸入帳號"
                  className="h-12 text-base"
                  autoComplete="username"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-gray-700">
                  密碼
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="請輸入密碼"
                    className="h-12 text-base pr-12"
                    autoComplete="current-password"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 rounded-md"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-medium"
                isLoading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? '登入中...' : '登入'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">v2.0 • 台灣房東租屋管理</p>
        </div>
      </div>
    </div>
  );
}
