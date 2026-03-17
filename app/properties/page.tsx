'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Building, MapPin, Phone, Calendar } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import PropertyForm from './components/property-form';
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

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  // 載入物業資料
  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.get<Property[]>('/api/properties');
      setProperties(data);
    } catch (err) {
      console.warn('載入物業 API 失敗，使用模擬資料', err);
      // 模擬資料（當後端尚未提供或暫時不可用時）
      setProperties([
        {
          id: '1',
          name: '台北市信義區公寓',
          address: '台北市信義區信義路五段',
          totalFloors: 5,
          landlordName: '陳先生',
          landlordPhone: '0912-345-678',
          landlordDeposit: 60000,
          landlordMonthlyRent: 30000,
          prepaidPeriod: 3,
          contractStartDate: '2026-01-01T00:00:00.000Z',
          contractEndDate: '2026-12-31T23:59:59.999Z',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-03-14T10:30:00.000Z',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProperty = () => {
    setEditingProperty(null);
    setFormOpen(true);
  };

  const handleEditProperty = (property: Property) => {
    setEditingProperty(property);
    setFormOpen(true);
  };

  const handleDeleteProperty = (property: Property) => {
    if (confirm(`確定要刪除「${property.name}」嗎？`)) {
      (async () => {
        try {
          await api.delete(`/api/properties/${property.id}`);
          setProperties((prev) => prev.filter((p) => p.id !== property.id));
        } catch (err) {
          console.error('刪除物業失敗', err);
          alert('刪除失敗，請稍後再試');
        }
      })();
    }
  };

  const handleSubmitProperty = async (data: any) => {
    // PropertyForm 使用的是表單資料（非後端格式），這裡做最小映射
    const payload = {
      name: data.name,
      address: data.address,
      totalFloors: Number(data.totalFloors || 1),
      landlordName: data.landlordName,
      landlordPhone: data.landlordPhone,
      landlordDeposit: Number(data.landlordDeposit || 0),
      landlordMonthlyRent: Number(data.landlordMonthlyRent || 0),
      prepaidPeriod: Number(data.prepaidPeriod || 1),
      contractStartDate: data.contractStartDate ? new Date(data.contractStartDate).toISOString() : null,
      contractEndDate: data.contractEndDate ? new Date(data.contractEndDate).toISOString() : null,
    };

    try {
      if (editingProperty) {
        const updated = await api.put<Property>(`/api/properties/${editingProperty.id}`, payload);
        setProperties((prev) => prev.map((p) => (p.id === editingProperty.id ? updated : p)));
      } else {
        const created = await api.post<Property>('/api/properties', payload);
        setProperties((prev) => [created, ...prev]);
      }
    } catch (err) {
      console.error('儲存物業失敗', err);
      alert('儲存失敗，請稍後再試');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">物業管理</h1>
            <p className="text-gray-600 mt-2">管理您的租屋物業資訊</p>
          </div>
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            新增物業
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
            <h1 className="text-3xl font-bold text-gray-900">物業管理</h1>
            <p className="text-gray-600 mt-2">管理您的租屋物業資訊</p>
          </div>
          <Button onClick={loadProperties}>
            重新載入
          </Button>
        </div>
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
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">物業管理</h1>
          <p className="text-gray-600 mt-2">管理您的租屋物業資訊</p>
        </div>
        <Button onClick={handleAddProperty}>
          <Plus className="mr-2 h-4 w-4" />
          新增物業
        </Button>
      </div>

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
          {properties.map((property) => (
            <Card key={property.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl font-bold text-gray-900">
                      {property.name}
                    </CardTitle>
                    <CardDescription className="flex items-center mt-1">
                      <MapPin className="h-4 w-4 mr-1" />
                      {property.address}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {property.totalFloors} 層樓
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

                <div className="flex justify-between pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditProperty(property)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    編輯
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => handleDeleteProperty(property)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    刪除
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
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
        initialData={
          editingProperty
            ? {
                name: editingProperty.name,
                address: editingProperty.address,
                totalFloors: editingProperty.totalFloors,
                landlordName: editingProperty.landlordName,
                landlordPhone: editingProperty.landlordPhone,
                landlordDeposit: editingProperty.landlordDeposit,
                landlordMonthlyRent: editingProperty.landlordMonthlyRent,
                prepaidPeriod: editingProperty.prepaidPeriod,
                contractStartDate: editingProperty.contractStartDate ? editingProperty.contractStartDate.split('T')[0] : '',
                contractEndDate: editingProperty.contractEndDate ? editingProperty.contractEndDate.split('T')[0] : '',
              }
            : undefined
        }
      />
    </div>
  );
}