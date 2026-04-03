'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
// Switch component not available, using Button instead
import { Download, Filter, PlusCircle, User, Users, Shield, Phone, XCircle, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { PageHeader } from '@/components/app-shell/page-header';
import { PageShell } from '@/components/app-shell/page-shell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SETTINGS_KEYS, getSetting, setSetting } from '@/lib/settings';
import {
  getActiveUserSessions,
  getAuthAuditRecords,
  type ActiveUserSession,
  type AuthAuditRecord,
} from '@/lib/auth-user';
import {
  ALL_PAGE_ACCESS_OPTIONS,
  PAGE_LABELS,
  type AppPageKey,
  type AccessLevel,
} from '@/lib/page-access';

// 使用者資料類型（與後端 User 類型對應）
interface UserData {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: 'super_admin' | 'admin';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// 新增/編輯使用者表單資料
interface UserFormData {
  email: string;
  fullName: string;
  phone: string;
  role: 'super_admin' | 'admin';
  password: string;
  confirmPassword: string;
  isActive: boolean;
}

type LocalPermissionMatrix = Record<AppPageKey, AccessLevel>;

type LocalUserPermissionRecord = {
  userId: string;
  permissions: LocalPermissionMatrix;
};

const USER_PERMISSION_KEY = 'user_page_permissions';

const DEFAULT_PERMISSION_BY_ROLE: Record<UserData['role'], LocalPermissionMatrix> = {
  super_admin: {
    dashboard: 'manage',
    properties: 'manage',
    rooms: 'manage',
    'payment-details': 'manage',
    deposits: 'manage',
    checkout: 'manage',
    finance: 'manage',
    reports: 'manage',
    'meter-history': 'manage',
    users: 'manage',
  },
  admin: {
    dashboard: 'manage',
    properties: 'manage',
    rooms: 'manage',
    'payment-details': 'manage',
    deposits: 'read_only',
    checkout: 'manage',
    finance: 'manage',
    reports: 'read_only',
    'meter-history': 'read_only',
    users: 'hidden',
  },
};

function readStoredPermissions(): LocalUserPermissionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(USER_PERMISSION_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalUserPermissionRecord[];
  } catch {
    return [];
  }
}

function writeStoredPermissions(records: LocalUserPermissionRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USER_PERMISSION_KEY, JSON.stringify(records));
  } catch {
    /* ignore */
  }
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    fullName: '',
    phone: '',
    role: 'admin',
    password: '',
    confirmPassword: '',
    isActive: true,
  });
  
  // 篩選狀態
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [sysLandlord, setSysLandlord] = useState('甲方');
  const [sysElec, setSysElec] = useState('6');
  const [sysDailyDiv, setSysDailyDiv] = useState('30');
  const [sysOverdue, setSysOverdue] = useState('5');
  const [sysLaundry, setSysLaundry] = useState('50');
  const [permissionRecords, setPermissionRecords] = useState<LocalUserPermissionRecord[]>([]);
  const [auditRecords, setAuditRecords] = useState<AuthAuditRecord[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveUserSession[]>([]);

  useEffect(() => {
    setSysLandlord(getSetting(SETTINGS_KEYS.landlordName, '甲方'));
    setSysElec(getSetting(SETTINGS_KEYS.defaultElectricityYuan, '6'));
    setSysDailyDiv(getSetting(SETTINGS_KEYS.dailyRentDivisor, '30'));
    setSysOverdue(getSetting(SETTINGS_KEYS.overdueGraceDays, '5'));
    setSysLaundry(getSetting(SETTINGS_KEYS.laundryFeeYuan, '50'));
    setPermissionRecords(readStoredPermissions());
    setAuditRecords(getAuthAuditRecords());
    setActiveSessions(getActiveUserSessions());
  }, []);

  // 載入使用者資料
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 嘗試從 API 載入資料
      // 注意：後端可能還沒有 /api/users 端點
      const data = await api.get<UserData[]>('/api/users');
      setUsers(data);
    } catch (error) {
      console.error(error);
      setUsers([]);
      setError(error instanceof Error ? error.message : '載入使用者失敗');
    } finally {
      setIsLoading(false);
    }
  };

  // 篩選後的使用者
  const filteredUsers = users.filter(user => {
    if (selectedRole !== 'all' && user.role !== selectedRole) return false;
    if (selectedStatus !== 'all') {
      const isActive = selectedStatus === 'active';
      if (user.isActive !== isActive) return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        user.email.toLowerCase().includes(query) ||
        (user.fullName && user.fullName.toLowerCase().includes(query)) ||
        (user.phone && user.phone.includes(query))
      );
    }
    return true;
  });

  // 計算統計
  const totalSuperAdmins = users.filter(u => u.role === 'super_admin').length;
  const totalAdmins = users.filter(u => u.role === 'admin').length;
  const totalActive = users.filter(u => u.isActive).length;
  const totalInactive = users.filter(u => !u.isActive).length;

  const getPermissionMatrix = (user: UserData): LocalPermissionMatrix => {
    const stored = permissionRecords.find((record) => record.userId === user.id);
    return stored?.permissions ?? DEFAULT_PERMISSION_BY_ROLE[user.role];
  };

  const updatePermission = (userId: string, page: AppPageKey, access: AccessLevel) => {
    setPermissionRecords((prev) => {
      const user = users.find((item) => item.id === userId);
      if (!user) return prev;
      const existing = prev.find((record) => record.userId === userId);
      const nextRecord: LocalUserPermissionRecord = {
        userId,
        permissions: {
          ...(existing?.permissions ?? DEFAULT_PERMISSION_BY_ROLE[user.role]),
          [page]: access,
        },
      };
      const next = [...prev.filter((record) => record.userId !== userId), nextRecord];
      writeStoredPermissions(next);
      return next;
    });
  };

  // 新增使用者
  const handleAddUser = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      fullName: '',
      phone: '',
      role: 'admin',
      password: '',
      confirmPassword: '',
      isActive: true,
    });
    setShowDialog(true);
  };

  // 編輯使用者
  const handleEditUser = (user: UserData) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      fullName: user.fullName || '',
      phone: user.phone || '',
      role: user.role,
      password: '', // 編輯時不顯示密碼
      confirmPassword: '',
      isActive: user.isActive,
    });
    setShowDialog(true);
  };

  // 切換使用者狀態
  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      // 實際環境中會呼叫 API 更新狀態
      // await api.patch(`/api/users/${id}/status`, { isActive: !currentStatus });
      
      // 本地更新
      setUsers(prev => 
        prev.map(u => u.id === id ? { ...u, isActive: !currentStatus } : u)
      );
    } catch (error) {
      console.error('狀態更新失敗', error);
      alert('狀態更新失敗，請稍後再試');
    }
  };

  // 刪除使用者（軟刪除）
  const handleDeleteUser = async (id: string) => {
    if (!confirm('確定要刪除這個使用者嗎？此操作無法復原。')) return;

    try {
      await api.delete(`/api/users/${id}`);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (error) {
      console.error('刪除失敗', error);
      alert('刪除失敗，請稍後再試');
    }
  };

  // 儲存使用者（新增或更新）
  const handleSaveUser = async () => {
    // 驗證
    if (!formData.email || !formData.fullName) {
      alert('請填寫必填欄位（電子郵件、姓名）');
      return;
    }

    if (!editingUser && (!formData.password || !formData.confirmPassword)) {
      alert('請輸入密碼和確認密碼');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      alert('密碼和確認密碼不一致');
      return;
    }

    const payload = {
      email: formData.email,
      fullName: formData.fullName,
      phone: formData.phone || null,
      role: formData.role,
      isActive: formData.isActive,
      ...(!editingUser && { password: formData.password }),
    };

    try {
      if (editingUser) {
        // 更新
        const updated = await api.put(`/api/users/${editingUser.id}`, payload);
        setUsers(prev => prev.map(u => u.id === editingUser.id ? updated : u));
      } else {
        // 新增
        const newUser = await api.post('/api/users', payload);
        setUsers(prev => [newUser, ...prev]);
      }
      setShowDialog(false);
    } catch (error) {
      console.error('儲存失敗', error);
      alert('儲存失敗，請稍後再試');
    }
  };

  // 角色標籤
  const getRoleBadge = (role: UserData['role']) => {
    switch (role) {
      case 'super_admin': return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">超級管理員</Badge>;
      case 'admin': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">管理員</Badge>;
      default: return <Badge>未知</Badge>;
    }
  };

  // 狀態標籤
  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">啟用中</Badge>;
    } else {
      return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">已停用</Badge>;
    }
  };

  // 清空篩選
  const handleClearFilters = () => {
    setSelectedRole('all');
    setSelectedStatus('all');
    setSearchQuery('');
  };

  return (
    <PageShell>
      <PageHeader
        title="使用者管理"
        description="管理系統使用者帳號、權限與登入狀態"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleAddUser}>
              <PlusCircle className="mr-2 h-4 w-4" />
              新增使用者
            </Button>
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={async () => {
                if (!confirm('確定要「清除所有資料」嗎？\n\n此操作會刪除目前所有測試/業務資料（物業與關聯資料），無法復原。')) {
                  return;
                }

                try {
                  await api.post('/api/users/clear-all-data', { confirm: 'CLEAR_ALL' });
                  window.location.reload();
                } catch (err) {
                  console.error('清除所有資料失敗', err);
                  const message =
                    err instanceof Error ? err.message : (err as any)?.message;
                  alert(`清除失敗：${message || '請稍後再試'}`);
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              清除所有資料
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              匯出名單
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="accounts" className="w-full space-y-4">
        <TabsList>
          <TabsTrigger value="accounts">帳號管理</TabsTrigger>
          <TabsTrigger value="permissions">分頁權限</TabsTrigger>
          <TabsTrigger value="activity">登入紀錄 / 活躍</TabsTrigger>
          <TabsTrigger value="settings">系統設定</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-4 space-y-6">
          {/* 統計卡片 */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">總使用者數</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users.length}</div>
                <p className="text-xs text-muted-foreground">啟用中 {totalActive} 人</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">超級管理員</CardTitle>
                <Shield className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{totalSuperAdmins}</div>
                <p className="text-xs text-muted-foreground">最高權限使用者</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">一般管理員</CardTitle>
                <User className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{totalAdmins}</div>
                <p className="text-xs text-muted-foreground">物業管理權限</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">已停用帳號</CardTitle>
                <XCircle className="h-4 w-4 text-gray-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-600">{totalInactive}</div>
                <p className="text-xs text-muted-foreground">無法登入的帳號</p>
              </CardContent>
            </Card>
          </div>

          {/* 篩選器 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="mr-2 h-5 w-5" />
                篩選條件
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="role">角色</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇角色" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">所有角色</SelectItem>
                      <SelectItem value="super_admin">超級管理員</SelectItem>
                      <SelectItem value="admin">一般管理員</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">狀態</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇狀態" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">所有狀態</SelectItem>
                      <SelectItem value="active">啟用中</SelectItem>
                      <SelectItem value="inactive">已停用</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="search">搜尋</Label>
                  <Input
                    id="search"
                    placeholder="搜尋電子郵件、姓名、電話..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-end space-y-2 lg:col-span-4">
                  <div className="flex space-x-2">
                    <Button className="flex-1" onClick={loadUsers}>
                      重新整理
                    </Button>
                    <Button variant="outline" onClick={handleClearFilters}>
                      清空
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 使用者列表 */}
          <Card>
            <CardHeader>
              <CardTitle>使用者列表</CardTitle>
              <CardDescription>共 {filteredUsers.length} 位使用者</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                    <p className="mt-2 text-sm text-muted-foreground">載入中...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="py-8 text-center text-red-500">
                  <p>{error}</p>
                  <Button variant="outline" onClick={loadUsers} className="mt-2">
                    重試
                  </Button>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground">沒有符合條件的使用者</p>
                  <Button variant="outline" onClick={handleClearFilters} className="mt-2">
                    清除篩選
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>使用者</TableHead>
                        <TableHead>聯絡資訊</TableHead>
                        <TableHead>角色</TableHead>
                        <TableHead>狀態</TableHead>
                        <TableHead>最後登入</TableHead>
                        <TableHead>建立時間</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{user.fullName || '未設定姓名'}</div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {user.phone ? (
                              <div className="flex items-center">
                                <Phone className="mr-1 h-3 w-3" />
                                <span className="text-sm">{user.phone}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">未設定電話</span>
                            )}
                          </TableCell>
                          <TableCell>{getRoleBadge(user.role)}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {getStatusBadge(user.isActive)}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleStatus(user.id, user.isActive)}
                              >
                                {user.isActive ? '停用' : '啟用'}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            {user.lastLoginAt ? (
                              <div className="text-sm">{formatDate(user.lastLoginAt)}</div>
                            ) : (
                              <span className="text-sm text-muted-foreground">從未登入</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{formatDate(user.createdAt)}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button variant="outline" size="sm" onClick={() => handleEditUser(user)}>
                                編輯
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteUser(user.id)}
                                className="text-red-600 hover:text-red-700"
                                disabled={user.role === 'super_admin'}
                              >
                                刪除
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>分頁權限設定</CardTitle>
              <CardDescription>
                目前為前端權限模型：可控制分頁顯示、唯讀與可管理。後端 API 權限仍需另行實作才算完整安全。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚無使用者可設定權限</p>
              ) : (
                users.map((user) => {
                  const permissions = getPermissionMatrix(user);
                  return (
                    <div key={user.id} className="space-y-4 rounded-lg border p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium">{user.fullName || user.email}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getRoleBadge(user.role)}
                          {getStatusBadge(user.isActive)}
                        </div>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        {ALL_PAGE_ACCESS_OPTIONS.map((pageKey) => (
                          <div key={pageKey} className="flex items-center justify-between gap-4 rounded-md border bg-slate-50 px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{PAGE_LABELS[pageKey]}</p>
                              <p className="text-xs text-muted-foreground">
                                hidden / read_only / manage
                              </p>
                            </div>
                            <Select
                              value={permissions[pageKey]}
                              onValueChange={(value) =>
                                updatePermission(user.id, pageKey, value as AccessLevel)
                              }
                            >
                              <SelectTrigger className="w-[132px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="hidden">隱藏</SelectItem>
                                <SelectItem value="read_only">唯讀</SelectItem>
                                <SelectItem value="manage">可管理</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>目前活躍使用者</CardTitle>
                <CardDescription>以本機 Session 心跳推估，預設 5 分鐘內視為活躍。</CardDescription>
              </CardHeader>
              <CardContent>
                {activeSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">目前沒有本機記錄到的活躍使用者。</p>
                ) : (
                  <div className="space-y-3">
                    {activeSessions.map((session) => (
                      <div key={session.sessionId} className="rounded-md border px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{session.fullName || session.username}</p>
                            <p className="text-xs text-muted-foreground">
                              {session.role} · Session {session.sessionId.slice(0, 8)}
                            </p>
                          </div>
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">活躍中</Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          最近活動：{formatDate(session.lastSeenAt)} {session.currentPath ? `· ${session.currentPath}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>登入紀錄</CardTitle>
                <CardDescription>目前以前端本機審計記錄為主；完整後端登入歷史仍需 API 支援。</CardDescription>
              </CardHeader>
              <CardContent>
                {auditRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground">目前沒有本機登入紀錄。</p>
                ) : (
                  <div className="space-y-3">
                    {auditRecords.slice(0, 20).map((record) => (
                      <div key={record.id} className="rounded-md border px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{record.username}</p>
                          <Badge variant="outline">{record.event}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          角色：{record.role} · 時間：{formatDate(record.at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>系統設定</CardTitle>
              <CardDescription>合約與計價預設值（存於此瀏覽器 localStorage）</CardDescription>
            </CardHeader>
            <CardContent className="max-w-lg space-y-4">
              <div className="space-y-2">
                <Label>甲方名稱（合約用）</Label>
                <Input value={sysLandlord} onChange={(e) => setSysLandlord(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>預設電費單價（元/度）</Label>
                <Input value={sysElec} onChange={(e) => setSysElec(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>日租金計算基數（天數）</Label>
                <Input value={sysDailyDiv} onChange={(e) => setSysDailyDiv(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>逾期警示天數（相對於當月幾號前）</Label>
                <Input value={sysOverdue} onChange={(e) => setSysOverdue(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>洗衣機收費（元/次）</Label>
                <Input value={sysLaundry} onChange={(e) => setSysLaundry(e.target.value)} />
              </div>
              <Button
                type="button"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  setSetting(SETTINGS_KEYS.landlordName, sysLandlord);
                  setSetting(SETTINGS_KEYS.defaultElectricityYuan, sysElec);
                  setSetting(SETTINGS_KEYS.dailyRentDivisor, sysDailyDiv);
                  setSetting(SETTINGS_KEYS.overdueGraceDays, sysOverdue);
                  setSetting(SETTINGS_KEYS.laundryFeeYuan, sysLaundry);
                  alert('已儲存');
                }}
              >
                儲存設定
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 新增/編輯使用者對話框 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? '編輯使用者' : '新增使用者'}
            </DialogTitle>
            <DialogDescription>
              {editingUser 
                ? '修改使用者資訊與權限' 
                : '建立新的系統使用者帳號'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">電子郵件 *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="user@example.com"
                  disabled={!!editingUser}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">電話</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="0912-345-678"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">姓名 *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                placeholder="輸入使用者姓名"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">角色</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(value: 'super_admin' | 'admin') => setFormData({...formData, role: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇角色" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">一般管理員</SelectItem>
                    <SelectItem value="super_admin">超級管理員</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="isActive">啟用狀態</Label>
                <Select 
                  value={formData.isActive ? "active" : "inactive"} 
                  onValueChange={(value) => setFormData({...formData, isActive: value === "active"})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">啟用中</SelectItem>
                    <SelectItem value="inactive">已停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!editingUser && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">密碼 *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="輸入密碼"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">確認密碼 *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    placeholder="再次輸入密碼"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSaveUser}>
              {editingUser ? '更新' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}