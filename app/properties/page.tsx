'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Building, MapPin, Phone, Calendar } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

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

  // 載入物業資料
  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 模擬 API 請求延遲
      await new Promise(resolve => setTimeout(resolve, 800));

      // 模擬資料
      const mockProperties: Property[] = [
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
        {
          id: '2',
          name: '新北市中和區華廈',
          address: '新北市中和區中山路二段',
          totalFloors: 8,
          landlordName: '李小姐',
          landlordPhone: '0987-654-321',
          landlordDeposit: 80000,
          landlordMonthlyRent: 40000,
          prepaidPeriod: 2,
          contractStartDate: '2026-02-01T00:00:00.000Z',
          contractEndDate: '2027-01-31T23:59:59.999Z',
          createdAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-03-14T11:15:00.000Z',
        },
        {
          id: '3',
          name: '桃園市中壢區透天厝',
          address: '桃園市中壢區中園路',
          totalFloors: 3,
          landlordName: '王先生',
          landlordPhone: '0933-222-111',
          landlordDeposit: 100000,
          landlordMonthlyRent: 50000,
          prepaidPeriod: 6,
          contractStartDate: '2026-03-01T00:00:00.000Z',
          contractEndDate: '2027-02-28T23:59:59.999Z',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-14T12:45:00.000Z',
        },
      ];

      setProperties(mockProperties);
    } catch (err) {
      setError('載入物業資料失敗，請稍後再試');
      console.error('載入物業錯誤:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProperty = () => {
    alert('新增物業功能開發中');
  };

  const handleEditProperty = (property: Property) => {
    alert(`編輯物業：${property.name}`);
  };

  const handleDeleteProperty = (property: Property) => {
    if (confirm(`確定要刪除「${property.name}」嗎？`)) {
      alert(`已刪除物業：${property.name}`);
      // 實際開發時這裡會呼叫 API 刪除
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
    </div>
  );
}