'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Building, MapPin, Phone, Calendar } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import PropertyForm, { type PropertyFormData, type PropertyFormSubmitData } from './components/property-form';
import { api } from '@/lib/api-client';
import Link from 'next/link';
import { PageHeader } from '@/components/app-shell/page-header';
import { PageShell } from '@/components/app-shell/page-shell';

// 模擬物業資料類型
interface Property {
  id: string;
  name: string;
  address: string;
  totalFloors: number;
  totalRooms?: number;
  landlordName: string;
  landlordPhone: string;
  landlordDeposit: number;
  landlordMonthlyRent: number;
  prepayCycleMonths: number;
  contractStartDate: string | null;
  contractEndDate: string | null;
  createdAt: string;
  updatedAt: string;
  status?: 'active' | 'archived' | 'demo' | string;
}

interface RoomRow {
  id: string;
  propertyId: string;
  status: string;
}

export default function PropertiesPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomStats, setRoomStats] = useState<Record<string, { total: number; occ: number }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  const loadProperties = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [data, rooms] = await Promise.all([
        api.get<Property[]>('/api/properties'),
        api.get<RoomRow[]>('/api/rooms'),
      ]);
      const stats: Record<string, { total: number; occ: number }> = {};
      for (const r of rooms) {
        const pid = r.propertyId;
        if (!stats[pid]) stats[pid] = { total: 0, occ: 0 };
        stats[pid].total++;
        if (r.status === 'occupied') stats[pid].occ++;
      }
      setRoomStats(stats);
      setProperties(data);
    } catch (err) {
      console.error(err);
      setProperties([]);
      setRoomStats({});
      setError(err instanceof Error ? err.message : '載入物業失敗');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  const handleAddProperty = () => {
    setEditingProperty(null);
    setFormOpen(true);
  };

  const handleEditProperty = (property: Property) => {
    setEditingProperty(property);
    setFormOpen(true);
  };

  const handleDeleteProperty = (property: Property) => {
    if (!confirm('確定刪除？')) return;

    (async () => {
      try {
        await api.delete(`/api/properties/${property.id}`);
        await loadProperties();
      } catch (err) {
        console.error('刪除物業失敗', err);
        alert(err instanceof Error ? err.message : '刪除失敗，請稍後再試');
      }
    })();
  };

  const handleSubmitProperty = async (data: PropertyFormSubmitData) => {
    // PropertyForm 使用的是表單資料（非後端格式），這裡做最小映射
    const payload = {
      name: data.name,
      address: data.address,
      totalFloors: Number(data.totalFloors || 1),
      landlordName: data.landlordName,
      landlordPhone: data.landlordPhone,
      landlordDeposit: Number(data.landlordDeposit || 0),
      landlordMonthlyRent: Number(data.landlordMonthlyRent || 0),
      prepayCycleMonths: Number(data.prepaidPeriod || 1),
      contractStartDate: data.contractStartDate ? new Date(data.contractStartDate).toISOString() : null,
      contractEndDate: data.contractEndDate ? new Date(data.contractEndDate).toISOString() : null,
      // 後端用來判定可否硬刪的 demo 旗標
      is_demo: data.isDemo,
    };

    try {
      if (editingProperty) {
        const updated = await api.put<Property>(`/api/properties/${editingProperty.id}`, payload);
        setProperties((prev) => prev.map((p) => (p.id === editingProperty.id ? updated : p)));
        setFormOpen(false);
      } else {
        const created = await api.post<Property>('/api/properties', payload);
        const roomsPayload: Array<{
          roomNumber: string;
          floor: number;
          monthlyRent: number;
          depositAmount: number;
          electricityRate: number;
        }> = [];
        for (const cfg of data.floorConfigs) {
          const roomCount = Math.max(0, Number(cfg.roomCount) || 0);
          for (let i = 1; i <= roomCount; i++) {
            const roomNumber = String(cfg.floor * 100 + i);
            roomsPayload.push({
              roomNumber,
              floor: cfg.floor,
              monthlyRent: Number(cfg.monthlyRent || 0),
              depositAmount: Number(cfg.depositAmount || 0),
              electricityRate: Math.round(Number(cfg.electricityPrice || 0) * 100),
            });
          }
        }
        if (roomsPayload.length > 0) {
          await api.post('/api/rooms/bulk', {
            propertyId: created.id,
            rooms: roomsPayload,
          });
        }

        setProperties((prev) => [created, ...prev]);
        setFormOpen(false);
        router.push(`/properties/${created.id}`);
      }
    } catch (err) {
      console.error('儲存物業失敗', err);
      alert('儲存失敗，請稍後再試');
    }
  };

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader
          title="物業管理"
          description="管理您的租屋物業資訊"
          actions={
            <Button disabled>
              <Plus className="mr-2 h-4 w-4" />
              新增物業
            </Button>
          }
        />
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
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <PageHeader
          title="物業管理"
          description="管理您的租屋物業資訊"
          actions={<Button onClick={loadProperties}>重新載入</Button>}
        />
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="text-red-500 text-lg font-medium">{error}</div>
              <Button 
                onClick={loadProperties}
                className="mt-4"
                variant="outline"
              >
                重試
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="物業管理"
        description="管理您的租屋物業資訊"
        actions={
          <Button type="button" onClick={handleAddProperty}>
            <Plus className="mr-2 h-4 w-4" />
            新增物業
          </Button>
        }
      />

      {properties.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Building className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">尚無物業資料</h3>
              <p className="text-gray-600 mb-6">開始新增您的第一個租屋物業</p>
              <Button onClick={handleAddProperty}>
                <Plus className="mr-2 h-4 w-4" />
                新增物業
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => {
            const st = roomStats[property.id];
            const total = st?.total ?? 0;
            const occ = st?.occ ?? 0;
            const occPct = total > 0 ? Math.round((occ / total) * 100) : 0;
            return (
            <Card key={property.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-xl font-bold text-gray-900">
                      {property.name}
                    </CardTitle>
                    <CardDescription className="flex items-start mt-2">
                      <MapPin className="h-4 w-4 mr-1 shrink-0 mt-0.5" />
                      <span>{property.address}</span>
                    </CardDescription>
                    <p className="text-sm text-slate-600 mt-2">
                      {total} 間房 · 入住率 {occPct}%
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-slate-50 shrink-0">
                    {property.totalFloors} 層
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center text-gray-700">
                    <div className="w-6">
                      <Building className="h-4 w-4 text-gray-500" />
                    </div>
                    <span className="ml-2 font-medium">{property.landlordName}</span>
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

                <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600">押金</div>
                    <div className="text-lg font-bold text-gray-900">
                      {formatCurrency(property.landlordDeposit)}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600">月租金</div>
                    <div className="text-lg font-bold text-gray-900">
                      {formatCurrency(property.landlordMonthlyRent)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                  <Link href={`/rooms?propertyId=${encodeURIComponent(property.id)}`} className="flex-1 min-w-0">
                    <Button type="button" size="sm" variant="secondary" className="w-full">
                      房間列表
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="sm:flex-1"
                    onClick={() => handleEditProperty(property)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    編輯
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="sm:flex-1 text-red-700 border-red-200 hover:bg-red-50"
                    onClick={() => handleDeleteProperty(property)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    刪除
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
          })}
        </div>
      )}

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>共 {properties.length} 個物業 • 系統建置中 v2.0</p>
      </div>

      <PropertyForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmitProperty}
        isEditing={!!editingProperty}
        {...(editingProperty
          ? {
              initialData: {
                name: editingProperty.name,
                address: editingProperty.address,
                totalFloors: editingProperty.totalFloors,
                landlordName: editingProperty.landlordName,
                landlordPhone: editingProperty.landlordPhone,
                landlordDeposit: editingProperty.landlordDeposit,
                landlordMonthlyRent: editingProperty.landlordMonthlyRent,
                prepaidPeriod: editingProperty.prepayCycleMonths,
                isDemo: editingProperty.status === 'demo',
                ...(editingProperty.contractStartDate
                  ? { contractStartDate: editingProperty.contractStartDate.split('T')[0] }
                  : {}),
                ...(editingProperty.contractEndDate
                  ? { contractEndDate: editingProperty.contractEndDate.split('T')[0] }
                  : {}),
              } satisfies Partial<PropertyFormData>,
            }
          : {})}
      />
    </PageShell>
  );
}