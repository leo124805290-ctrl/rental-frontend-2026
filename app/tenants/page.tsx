'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building, User, Phone, Calendar, Plus, Search, Filter } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import CheckinModal from './components/checkin-modal';
import { api } from '@/lib/api-client';

// 租客資料類型
interface Tenant {
  id: string;
  roomId: string;
  propertyId: string;
  nameZh: string;
  nameVi: string;
  phone: string;
  passportNumber?: string;
  checkInDate: string;
  expectedCheckoutDate?: string;
  actualCheckoutDate?: string;
  status: 'active' | 'checked_out';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// 房間資料類型
interface Room {
  id: string;
  propertyId: string;
  roomNumber: string;
  floor: number;
  status: string;
  monthlyRent: number;
  depositAmount: number;
}

// 物業資料類型
interface Property {
  id: string;
  name: string;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rooms, setRooms] = useState<Record<string, Room>>({});
  const [properties, setProperties] = useState<Record<string, Property>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkinOpen, setCheckinOpen] = useState(false);
  
  // 篩選狀態
  const [searchTerm, setSearchTerm] = useState('');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active'); // 'all', 'active', 'checked_out'

  // 載入租客資料
  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 模擬 API 請求延遲
      await new Promise(resolve => setTimeout(resolve, 800));

      // 模擬租客資料
      const mockTenants: Tenant[] = [
        {
          id: 'tenant-1',
          roomId: 'room-1',
          propertyId: 'property-1',
          nameZh: '陳小明',
          nameVi: 'Trần Tiểu Minh',
          phone: '0912-345-678',
          passportNumber: 'A12345678',
          checkInDate: '2026-01-15T00:00:00.000Z',
          expectedCheckoutDate: '2026-07-14T23:59:59.999Z',
          status: 'active',
          notes: '長期租客',
          createdAt: '2026-01-15T00:00:00.000Z',
          updatedAt: '2026-03-14T10:30:00.000Z',
        },
        {
          id: 'tenant-2',
          roomId: 'room-3',
          propertyId: 'property-1',
          nameZh: '李美華',
          nameVi: 'Lý Mỹ Hoa',
          phone: '0987-654-321',
          passportNumber: 'B87654321',
          checkInDate: '2026-02-01T00:00:00.000Z',
          expectedCheckoutDate: '2026-08-31T23:59:59.999Z',
          status: 'active',
          createdAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-03-14T11:15:00.000Z',
        },
        {
          id: 'tenant-3',
          roomId: 'room-5',
          propertyId: 'property-2',
          nameZh: '王大海',
          nameVi: 'Vương Đại Hải',
          phone: '0933-222-111',
          passportNumber: 'C11223344',
          checkInDate: '2026-03-01T00:00:00.000Z',
          status: 'active',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-14T12:45:00.000Z',
        },
        {
          id: 'tenant-4',
          roomId: 'room-2',
          propertyId: 'property-1',
          nameZh: '張美麗',
          nameVi: 'Trương Mỹ Lệ',
          phone: '0922-333-444',
          passportNumber: 'D55667788',
          checkInDate: '2025-12-01T00:00:00.000Z',
          actualCheckoutDate: '2026-02-28T23:59:59.999Z',
          status: 'checked_out',
          notes: '已退租',
          createdAt: '2025-12-01T00:00:00.000Z',
          updatedAt: '2026-02-28T10:30:00.000Z',
        },
      ];

      // 模擬房間資料
      const mockRooms: Record<string, Room> = {
        'room-1': { id: 'room-1', propertyId: 'property-1', roomNumber: '101', floor: 1, status: 'occupied', monthlyRent: 18000, depositAmount: 18000 },
        'room-2': { id: 'room-2', propertyId: 'property-1', roomNumber: '102', floor: 1, status: 'vacant', monthlyRent: 17000, depositAmount: 17000 },
        'room-3': { id: 'room-3', propertyId: 'property-1', roomNumber: '201', floor: 2, status: 'occupied', monthlyRent: 19000, depositAmount: 19000 },
        'room-5': { id: 'room-5', propertyId: 'property-2', roomNumber: '301', floor: 3, status: 'occupied', monthlyRent: 16000, depositAmount: 16000 },
      };

      // 模擬物業資料
      const mockProperties: Record<string, Property> = {
        'property-1': { id: 'property-1', name: '台北市信義區公寓' },
        'property-2': { id: 'property-2', name: '新北市中和區華廈' },
      };

      setTenants(mockTenants);
      setRooms(mockRooms);
      setProperties(mockProperties);
    } catch (err) {
      setError('載入租客資料失敗，請稍後再試');
      console.error('載入租客錯誤:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 篩選租客
  const filteredTenants = tenants.filter(tenant => {
    // 搜尋篩選
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        tenant.nameZh.toLowerCase().includes(searchLower) ||
        tenant.nameVi.toLowerCase().includes(searchLower) ||
        tenant.phone.includes(searchTerm) ||
        (tenant.passportNumber && tenant.passportNumber.toLowerCase().includes(searchLower));
      if (!matchesSearch) return false;
    }

    // 物業篩選
    if (propertyFilter !== 'all' && tenant.propertyId !== propertyFilter) {
      return false;
    }

    // 狀態篩選
    if (statusFilter !== 'all' && tenant.status !== statusFilter) {
      return false;
    }

    return true;
  });

  const handleCheckin = () => setCheckinOpen(true);

  const handleSubmitCheckin = async (data: any) => {
    // 先求「能用」：優先本地更新；如果後端有端點，再嘗試送出
    try {
      // 後端若已提供入住 API，可在此替換成正確 endpoint
      // await api.post('/api/tenants/checkin', data);
      void api; // 保留 import，避免未使用
    } catch (e) {
      console.warn('入住 API 送出失敗（先以本地資料更新）', e);
    }

    const newTenant: Tenant = {
      id: `tenant-${Date.now()}`,
      roomId: data.roomId,
      propertyId: data.propertyId || rooms[data.roomId]?.propertyId || 'unknown',
      nameZh: data.nameZh,
      nameVi: data.nameVi,
      phone: data.phone,
      passportNumber: data.passportNumber || undefined,
      checkInDate: new Date().toISOString(),
      status: 'active',
      notes: data.notes || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setTenants((prev) => [newTenant, ...prev]);
    setRooms((prev) => {
      const room = prev[data.roomId];
      if (!room) return prev;
      // full: occupied，partial/deposit_only: reserved
      const nextStatus =
        data.paymentType === 'full' ? 'occupied' : 'reserved';
      return {
        ...prev,
        [data.roomId]: { ...room, status: nextStatus },
      };
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">租客管理</h1>
            <p className="text-gray-600 mt-2">管理所有租客資訊</p>
          </div>
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            辦理入住
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">租客管理</h1>
            <p className="text-gray-600 mt-2">管理所有租客資訊</p>
          </div>
          <Button onClick={loadTenants}>
            重新載入
          </Button>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="text-red-500 text-lg font-medium">{error}</div>
              <Button 
                onClick={loadTenants}
                className="mt-4"
                variant="outline"
              >
                重試
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* 標題與按鈕 */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">租客管理</h1>
          <p className="text-gray-600 mt-2">管理所有租客資訊</p>
        </div>
        <Button onClick={handleCheckin}>
          <Plus className="mr-2 h-4 w-4" />
          辦理入住
        </Button>
      </div>

      {/* 篩選區域 */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 搜尋框 */}
            <div className="space-y-2">
              <div className="flex items-center">
                <Search className="h-4 w-4 text-gray-500 mr-2" />
                <span className="text-sm font-medium">搜尋租客</span>
              </div>
              <Input
                placeholder="搜尋姓名、電話、護照號碼..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* 物業篩選 */}
            <div className="space-y-2">
              <div className="flex items-center">
                <Building className="h-4 w-4 text-gray-500 mr-2" />
                <span className="text-sm font-medium">篩選物業</span>
              </div>
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="所有物業" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有物業</SelectItem>
                  {Object.values(properties).map(property => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 狀態篩選 */}
            <div className="space-y-2">
              <div className="flex items-center">
                <Filter className="h-4 w-4 text-gray-500 mr-2" />
                <span className="text-sm font-medium">篩選狀態</span>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="所有狀態" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有狀態</SelectItem>
                  <SelectItem value="active">在住中</SelectItem>
                  <SelectItem value="checked_out">已退租</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 租客卡片列表 */}
      {filteredTenants.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <User className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">尚無租客資料</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || propertyFilter !== 'all' || statusFilter !== 'all' 
                  ? '找不到符合篩選條件的租客' 
                  : '開始辦理第一位租客入住'}
              </p>
              <Button onClick={handleCheckin}>
                <Plus className="h-4 w-4 mr-2" />
                辦理入住
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTenants.map((tenant) => {
            const room = rooms[tenant.roomId];
            const property = properties[tenant.propertyId];
            
            return (
              <Card key={tenant.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl font-bold text-gray-900">
                        {tenant.nameZh}
                      </CardTitle>
                      <CardDescription className="flex items-center mt-1">
                        <User className="h-4 w-4 mr-1" />
                        {tenant.nameVi}
                      </CardDescription>
                    </div>
                    <Badge 
                      className={tenant.status === 'active' 
                        ? 'bg-green-100 text-green-800 border-green-200' 
                        : 'bg-gray-100 text-gray-800 border-gray-200'
                      }
                    >
                      {tenant.status === 'active' ? '在住中' : '已退租'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center text-gray-700">
                      <div className="w-6">
                        <Building className="h-4 w-4 text-gray-500" />
                      </div>
                      <span className="ml-2">
                        {property?.name || '未知物業'} • {room?.roomNumber || '未知'} 號房
                      </span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <div className="w-6">
                        <Phone className="h-4 w-4 text-gray-500" />
                      </div>
                      <span className="ml-2">{tenant.phone}</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <div className="w-6">
                        <Calendar className="h-4 w-4 text-gray-500" />
                      </div>
                      <span className="ml-2">
                        入住：{formatDate(tenant.checkInDate, 'short')}
                      </span>
                    </div>
                    {tenant.passportNumber && (
                      <div className="text-sm text-gray-600">
                        護照：{tenant.passportNumber}
                      </div>
                    )}
                    {tenant.expectedCheckoutDate && tenant.status === 'active' && (
                      <div className="text-sm text-gray-600">
                        預期退租：{formatDate(tenant.expectedCheckoutDate, 'short')}
                      </div>
                    )}
                    {tenant.actualCheckoutDate && tenant.status === 'checked_out' && (
                      <div className="text-sm text-gray-600">
                        實際退租：{formatDate(tenant.actualCheckoutDate, 'short')}
                      </div>
                    )}
                    {tenant.notes && (
                      <div className="text-sm text-gray-600 border-t pt-2">
                        備註：{tenant.notes}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <Link href={`/properties/${tenant.propertyId}`}>
                        查看物業
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                    >
                      查看詳情
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 統計資訊 */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          共 {tenants.length} 位租客 • 
          在住中：{tenants.filter(t => t.status === 'active').length} 位 • 
          已退租：{tenants.filter(t => t.status === 'checked_out').length} 位
        </p>
      </div>

      <CheckinModal
        isOpen={checkinOpen}
        onClose={() => setCheckinOpen(false)}
        onSubmit={handleSubmitCheckin}
        rooms={Object.values(rooms)}
      />
    </div>
  );
}