export const EXPENSE_CATEGORIES = [
  { code: 'landlord_rent', label: '房東租金' },
  { code: 'landlord_deposit', label: '房東押金' },
  { code: 'utility_electric', label: '台電電費' },
  { code: 'utility_water', label: '水費' },
  { code: 'internet', label: '網路' },
  { code: 'cleaning', label: '清潔' },
  { code: 'renovation', label: '裝潢' },
  { code: 'equipment', label: '設備' },
  { code: 'repair', label: '維修' },
  { code: 'other', label: '其他' },
] as const;

export const INCOME_SOURCES = [
  { code: 'laundry', label: '洗衣機' },
  { code: 'vending', label: '販賣機' },
  { code: 'other', label: '其他' },
] as const;
