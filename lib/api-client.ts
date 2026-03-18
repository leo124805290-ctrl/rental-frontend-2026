/**
 * API 客戶端
 * 統一處理所有 API 請求、錯誤處理、認證標頭
 */

// 基礎 API URL（直接呼叫後端，不經過 Next.js rewrites）
// @ts-ignore - process.env 由 Next.js 提供
const API_BASE_URL =
  process.env['NEXT_PUBLIC_API_URL'] ||
  'https://taiwan-landlord-2026.zeabur.app';

// 請求逾時時間（毫秒）
const REQUEST_TIMEOUT = 10000;

// 連線狀態類型
export type ConnectionStatus = 'success' | 'error' | 'timeout' | 'offline';

// API 回應格式（與後端保持一致）
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  timestamp: string;
}

// API 錯誤類別
export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// 連線狀態檢查
async function checkConnectionStatus(): Promise<ConnectionStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${API_BASE_URL}/health`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return 'success';
    } else {
      return 'error';
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return 'timeout';
    }
    return 'offline';
  }
}

// 從 cookie 取得 token
function getAuthToken(): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const parts = cookie.trim().split('=');
    if (parts.length >= 2 && parts[0] === 'auth_token') {
      return decodeURIComponent(parts.slice(1).join('='));
    }
  }
  return null;
}

// 設定 token 到 cookie
export function setAuthToken(token: string, expiresInHours: number = 24): void {
  if (typeof document === 'undefined') return;

  const expires = new Date();
  expires.setTime(expires.getTime() + expiresInHours * 60 * 60 * 1000);
  
  document.cookie = `auth_token=${encodeURIComponent(token)}; path=/; expires=${expires.toUTCString()}; SameSite=Strict`;
}

// 移除 token
export function removeAuthToken(): void {
  if (typeof document === 'undefined') return;
  
  document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict';
}

// 取得授權標頭
function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (!token) return {};

  return {
    'Authorization': `Bearer ${token}`,
  };
}

// 基礎請求函數
async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; status: number; headers: Headers }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    // 合併標頭
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    };

    // 發出請求
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
      // 跨網域呼叫 Zeabur 後端時避免因 credentials 造成 CORS 失敗
      credentials: 'omit',
    });

    clearTimeout(timeoutId);

    // 解析回應
    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      throw new ApiError(`非 JSON 回應: ${text}`, response.status);
    }

    // 檢查回應格式
    const apiResponse = data as ApiResponse<T>;
    
    if (!apiResponse.success) {
      throw new ApiError(
        apiResponse.message || 'API 請求失敗',
        response.status,
        apiResponse.data
      );
    }

    return {
      data: apiResponse.data as T,
      status: response.status,
      headers: response.headers,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('請求逾時，請稍後再試', 408);
    }

    throw new ApiError(
      error instanceof Error ? error.message : '未知錯誤',
      500
    );
  }
}

// HTTP 方法封裝
export const api = {
  // GET 請求
  async get<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    const { data } = await request<T>(endpoint, {
      ...options,
      method: 'GET',
    });
    return data;
  },

  // POST 請求
  async post<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    const { data } = await request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : null,
    });
    return data;
  },

  // PUT 請求
  async put<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    const { data } = await request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : null,
    });
    return data;
  },

  // DELETE 請求
  async delete<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    const { data } = await request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
    return data;
  },

  // PATCH 請求
  async patch<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    const { data } = await request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : null,
    });
    return data;
  },

  // 檢查連線狀態
  checkConnectionStatus,

  // 取得 token
  getAuthToken,

  // 設定 token
  setAuthToken,

  // 移除 token
  removeAuthToken,
};

// 簡易登入函數（簡易版）
export async function simpleLogin(password: string): Promise<{ user: any; tokens: any }> {
  // 簡易版：直接在前端檢查密碼
  if (password !== 'enter') {
    throw new Error('密碼錯誤，請輸入 "enter" 登入');
  }

  // 模擬 API 回應延遲
  await new Promise(resolve => setTimeout(resolve, 500));

  // 模擬使用者資料
  const mockUser = {
    id: 'test-user-id',
    email: 'test@rental.com',
    fullName: '測試使用者',
    role: 'admin',
  };

  const mockTokens = {
    accessToken: 'mock-jwt-token-for-simple-auth',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
  };

  // 設定 token
  setAuthToken(mockTokens.accessToken);

  return {
    user: mockUser,
    tokens: mockTokens,
  };
}

export default api;