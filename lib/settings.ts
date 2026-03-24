/** 系統設定（localStorage，與使用者管理頁同步） */
export const SETTINGS_KEYS = {
  landlordName: 'tl_settings_landlord_name',
  defaultElectricityYuan: 'tl_settings_default_electricity_yuan',
  dailyRentDivisor: 'tl_settings_daily_rent_divisor',
  overdueGraceDays: 'tl_settings_overdue_grace_days',
  laundryFeeYuan: 'tl_settings_laundry_fee_yuan',
} as const;

export function getSetting(key: string, defaultValue: string): string {
  if (typeof window === 'undefined') return defaultValue;
  try {
    return localStorage.getItem(key) ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setSetting(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function getLandlordName(): string {
  return getSetting(SETTINGS_KEYS.landlordName, '甲方');
}
