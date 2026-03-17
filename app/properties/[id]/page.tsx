'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building, MapPin, Phone, Calendar, Home, Users, Plus, Edit, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';
import { api } from '@/lib/api-client';

// 模擬物業資料類型
interface Property {
  id: string;
  name: string;
  address: string;
  totalFloors: number;
  landlordName: string;
  landlordPhone: string;
  landlordDeposit: number;
  landlordMonthlyRent: number;
  prepaidPeriod: number;
  contractStartDate: string | null;
  contractEndDate: string | null;
  createdAt: string;
  updatedAt: string;
}

// 房間資料類型
interface Room {
  id: string;
  propertyId: string;
  roomNumber: string;
  floor: number;
  monthlyRent: number;
  depositAmount: number;
  electricityRate: number;
  status: 'vacant' | 'occupied' | 'reserved' | 'maintenance';
  createdAt: string;
  updatedAt: string;
}

// 房間狀態對應的標籤和顏色
const roomStatusConfig = {
  vacant: { label: '空房', color: 'bg-green-100 text-green-800 border-green-200' },
  occupied: { label: '已入住', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  reserved: { label: '已預訂', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  maintenance: { label: '維修中', color: 'bg-red-100 text-red-800 border-red-200' },
};

export default function PropertyDetailPage() {
  const params = useParams();
  const propertyId = params?.['id'] as string;
  
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setShowRoomForm] = useState(false);

  // 載入物業詳情和房間列表
  useEffect(() => {
    if (propertyId) {
      loadPropertyAndRooms();
    }
  }, [propertyId]);

  const loadPropertyAndRooms = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const p = await api.get<Property>(`/api/properties/${propertyId}`);
      const r = await api.get<Room[]>(`/api/rooms?propertyId=${propertyId}`);
      setProperty(p);
      setRooms(r);
    } catch (err) {
      setError('載入資料失敗，請稍後再試');
      console.error('載入物業詳情錯誤:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRoom = () => {
    setShowRoomForm(true);
  };

  const handleEditRoom = (room: Room) => {
    alert(`編輯房間：${room.roomNumber}`);
  };

  const handleDeleteRoom = (room: Room) => {
    if (confirm(`確定要刪除房間 ${room.roomNumber} 嗎？`)) {
      alert(`已刪除房間：${room.roomNumber}`);
      // 實際開發時這裡會呼叫 API 刪除
    }
  };

  const handleRoomStatusChange = (roomId: string, newStatus: Room['status']) => {
    setRooms(prev => prev.map(room => 
      room.id === roomId ? { ...room, status: newStatus } : room
    ));
    alert(`房間狀態已更新為：${roomStatusConfig[newStatus].label}`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center mb-8">
          <Link href="/properties">
            <Button variant="outline" size="sm" className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回物業列表
            </Button>
          </Link>
          <div className="h-8 bg-gray-200 rounded w-64"></div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <Card className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <div className="h-6 bg-gray-200 rounded w-48"></div>
              <div className="h-10 bg-gray-200 rounded w-32"></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-5 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center mb-8">
          <Link href="/properties">
            <Button variant="outline" size="sm" className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回物業列表
            </Button>
          </Link>
        </div>
        
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="text-red-500 text-lg font-medium">{error || '找不到指定的物業'}</div>
              <Button 
                onClick={loadPropertyAndRooms}
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

  // 計算房間統計
  const roomStats = {
    total: rooms.length,
    vacant: rooms.filter(r => r.status === 'vacant').length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
    reserved: rooms.filter(r => r.status === 'reserved').length,
    maintenance: rooms.filter(r => r.status === 'maintenance').length,
  };

  // 計算月租金總收入（僅已入住和已預訂房間）
  const monthlyRentIncome = rooms
    .filter(r => r.status === 'occupied' || r.status === 'reserved')
    .reduce((sum, room) => sum + room.monthlyRent, 0);

  return (
    <div className="container mx-auto py-8">
      {/* 返回按鈕 */}
      <div className="flex items-center mb-8">
        <Link href="/properties">
          <Button variant="outline" size="sm" className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回物業列表
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">{property.name}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左側：物業資訊 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building className="h-5 w-5 mr-2 text-gray-500" />
                物業資訊
              </CardTitle>
              <CardDescription>基本資訊與合約</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center text-gray-700">
                  <div className="w-6">
                    <MapPin className="h-4 w-4 text-gray-500" />
                  </div>
                  <span className="ml-2">{property.address}</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <div className="w-6">
                    <Home className="h-4 w-4 text-gray-500" />
                  </div>
                  <span className="ml-2">{property.totalFloors} 層樓</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <div className="w-6">
                    <Users className="h-4 w-4 text-gray-500" />
                  </div>
                  <span className="ml-2">{property.landlordName}</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <div className="w-6">
                    <Phone className="h-4 w-4 text-gray-500" />
                  </div>
                  <span className="ml-2">{property.landlordPhone}</span>
                </div>
                {property.contractStartDate && (
                  <div className="flex items-center text-gray-700">
                    <div className="w-6">
                      <Calendar className="h-4 w-4 text-gray-500" />
                    </div>
                    <span className="ml-2">
                      合約：{formatDate(property.contractStartDate, 'short')} - 
                      {property.contractEndDate ? formatDate(property.contractEndDate, 'short') : '未設定'}
                    </span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">給房東押金</span>
                  <span className="font-bold text-gray-900">
                    {formatCurrency(property.landlordDeposit)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">給房東月租</span>
                  <span className="font-bold text-gray-900">
                    {formatCurrency(property.landlordMonthlyRent)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">預付週期</span>
                  <span className="font-bold text-gray-900">
                    {property.prepaidPeriod} 個月
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 統計卡片 */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">房間統計</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">總房間數</span>
                  <span className="font-bold text-gray-900">{roomStats.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">空房</span>
                  <Badge className={roomStatusConfig.vacant.color}>
                    {roomStats.vacant}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">已入住</span>
                  <Badge className={roomStatusConfig.occupied.color}>
                    {roomStats.occupied}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">已預訂</span>
                  <Badge className={roomStatusConfig.reserved.color}>
                    {roomStats.reserved}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">維修中</span>
                  <Badge className={roomStatusConfig.maintenance.color}>
                    {roomStats.maintenance}
                  </Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center pt-2">
                  <span className="text-gray-600">月租金總收入</span>
                  <span className="font-bold text-green-700">
                    {formatCurrency(monthlyRentIncome)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右側：房間列表 */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">房間管理</h2>
              <p className="text-gray-600 mt-1">管理此物業的所有房間</p>
            </div>
            <Button onClick={handleAddRoom}>
              <Plus className="h-4 w-4 mr-2" />
              新增房間
            </Button>
          </div>

          {rooms.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Home className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">尚無房間資料</h3>
                  <p className="text-gray-600 mb-6">開始新增房間以出租</p>
                  <Button onClick={handleAddRoom}>
                    <Plus className="h-4 w-4 mr-2" />
                    新增房間
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rooms.map((room) => (
                <Card key={room.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl font-bold text-gray-900">
                          {room.roomNumber} 號房
                        </CardTitle>
                        <CardDescription className="flex items-center mt-1">
                          <Home className="h-4 w-4 mr-1" />
                          {room.floor} 樓
                        </CardDescription>
                      </div>
                      <Badge className={roomStatusConfig[room.status].color}>
                        {roomStatusConfig[room.status].label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">月租金</span>
                        <span className="font-bold text-gray-900">
                          {formatCurrency(room.monthlyRent)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">押金</span>
                        <span className="font-bold text-gray-900">
                          {formatCurrency(room.depositAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">電費單價</span>
                        <span className="font-bold text-gray-900">
                          {(room.electricityRate / 100).toFixed(2)} 元/度
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditRoom(room)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        編輯
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleDeleteRoom(room)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        刪除
                      </Button>
                    </div>

                    {/* 快速狀態切換 */}
                    <div className="pt-3 border-t">
                      <p className="text-sm text-gray-600 mb-2">快速切換狀態：</p>
                      <div className="grid grid-cols-4 gap-2">
                        {Object.entries(roomStatusConfig).map(([status, config]) => (
                          <Button
                            key={status}
                            size="sm"
                            variant={room.status === status ? "default" : "outline"}
                            className={`text-xs ${room.status === status ? '' : 'text-gray-600'}`}
                            onClick={() => handleRoomStatusChange(room.id, status as Room['status'])}
                            disabled={room.status === status}
                          >
                            {config.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>共 {rooms.length} 個房間 • 系統建置中 v2.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}