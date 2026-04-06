// @ts-nocheck

// ===== 型別定義 =====

export interface PagePermission {
  page: string; // 權限 key
  visible: boolean; // 側邊欄可見
  editable: boolean; // 可操作（新增/編輯/刪除）
}

// ===== 所有分頁定義 =====
// displayOnly = true 表示這個頁面是純顯示，沒有「可操作」選項

export const ALL_PAGES = [
  { page: 'dashboard', label: '儀表板', displayOnly: true },
  { page: 'properties', label: '物業管理', displayOnly: false },
  { page: 'rooms', label: '房間管理', displayOnly: false },
  { page: 'payments', label: '收款明細', displayOnly: false },
  { page: 'payment-details', label: '收款明細', displayOnly: false, hidden: true }, // 301 轉址用，不在設定顯示
  { page: 'deposits', label: '押金管理', displayOnly: false },
  { page: 'landlord-payments', label: '房東付款', displayOnly: false },
  { page: 'checkout', label: '退租結算', displayOnly: false },
  { page: 'finance', label: '收支管理', displayOnly: false },
  { page: 'reports', label: '損益報表', displayOnly: true },
  { page: 'meter-history', label: '電錶歷史', displayOnly: true },
  { page: 'history', label: '歷史租約', displayOnly: true },
  { page: 'import', label: '舊資料補登', displayOnly: false },
  { page: 'users', label: '使用者管理', displayOnly: false },
];

// 設定 UI 用（排除 hidden 的）
export const CONFIGURABLE_PAGES = ALL_PAGES.filter((p) => !p.hidden);

// ===== 路由 → 權限 key 對照表 =====

export const ROUTE_PERMISSION_MAP: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/properties': 'properties',
  '/rooms': 'rooms',
  '/payments': 'payments',
  '/payment-details': 'payments',
  '/deposits': 'deposits',
  '/landlord-payments': 'landlord-payments',
  '/checkout': 'checkout',
  '/finance': 'finance',
  '/reports': 'reports',
  '/meter-history': 'meter-history',
  '/history': 'history',
  '/import': 'import',
  '/users': 'users',
};

// ===== 角色預設權限 =====

function makePerms(pages: { page: string; visible: boolean; editable: boolean }[]): PagePermission[] {
  return ALL_PAGES.map((p) => {
    const override = pages.find((o) => o.page === p.page);
    if (override) return override;
    return { page: p.page, visible: false, editable: false };
  });
}

export const ROLE_DEFAULTS: {
  super_admin: PagePermission[];
  admin: PagePermission[];
  viewer: PagePermission[];
} = {
  super_admin: ALL_PAGES.map((p) => ({ page: p.page, visible: true, editable: true })),

  admin: makePerms([
    { page: 'dashboard', visible: true, editable: false },
    { page: 'properties', visible: true, editable: true },
    { page: 'rooms', visible: true, editable: true },
    { page: 'payments', visible: true, editable: true },
    { page: 'deposits', visible: true, editable: false },
    { page: 'checkout', visible: true, editable: true },
    { page: 'meter-history', visible: true, editable: false },
    { page: 'reports', visible: true, editable: false },
  ]),

  viewer: makePerms([
    { page: 'dashboard', visible: true, editable: false },
    { page: 'payments', visible: true, editable: false },
    { page: 'deposits', visible: true, editable: false },
    { page: 'meter-history', visible: true, editable: false },
  ]),
};

// ===== localStorage 存取 =====

const PERMS_KEY = 'user_permissions';

export function getPermissions(): PagePermission[] {
  if (typeof window === 'undefined') {
    return ROLE_DEFAULTS.super_admin;
  }
  try {
    const stored = localStorage.getItem(PERMS_KEY);
    if (stored) return JSON.parse(stored);

    const userStr = localStorage.getItem('current_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      const key = user.role as keyof typeof ROLE_DEFAULTS;
      const fromRole = ROLE_DEFAULTS[key];
      return fromRole || ROLE_DEFAULTS.super_admin;
    }

    return ROLE_DEFAULTS.super_admin;
  } catch {
    return ROLE_DEFAULTS.super_admin;
  }
}

export function savePermissions(permissions: PagePermission[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PERMS_KEY, JSON.stringify(permissions));
}

/** 補齊缺漏的 page 項目（舊資料或部分儲存時使用）；儀表板永遠可見 */
export function normalizePagePermissions(raw: PagePermission[]): PagePermission[] {
  const map = new Map(raw.map((p) => [p.page, p]));
  return ALL_PAGES.map((m) => {
    const found = map.get(m.page);
    const row = found || { page: m.page, visible: false, editable: false };
    if (m.page === 'dashboard') {
      return { ...row, visible: true };
    }
    return row;
  });
}

// ===== 查詢函數（給頁面和導航用） =====

export function isPageVisible(page: string): boolean {
  if (page === 'dashboard') return true;
  const perms = getPermissions();
  const found = perms.find((p) => p.page === page);
  return found ? found.visible : true;
}

export function isPageEditable(page: string): boolean {
  const perms = getPermissions();
  const found = perms.find((p) => p.page === page);
  return found ? found.editable : true;
}

export function filterVisibleNav(href: string): boolean {
  const permKey = ROUTE_PERMISSION_MAP[href];
  if (!permKey) return true;
  return isPageVisible(permKey);
}

export function hasPageAccess(pathname: string): boolean {
  if (!pathname || pathname === '/') return isPageVisible('dashboard');
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];
  if (first === 'login') return true;
  const base = '/' + first;
  const permKey = ROUTE_PERMISSION_MAP[base];
  if (!permKey) return true;
  return isPageVisible(permKey);
}

// ===== 系統設定（localStorage） =====

const SYSTEM_SETTINGS_KEY = 'system_settings';

const DEFAULT_SYSTEM_SETTINGS = {
  landlordDisplayName: '',
  defaultElectricityRate: 6.0,
  dailyRentBase: 30,
  overdueDays: 5,
  laundryFee: '',
};

export function getSystemSettings() {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SYSTEM_SETTINGS };
  }
  try {
    const stored = localStorage.getItem(SYSTEM_SETTINGS_KEY);
    return stored ? JSON.parse(stored) : { ...DEFAULT_SYSTEM_SETTINGS };
  } catch {
    return { ...DEFAULT_SYSTEM_SETTINGS };
  }
}

export function saveSystemSettings(settings: any) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SYSTEM_SETTINGS_KEY, JSON.stringify(settings));
}
