import type { PropertyStatus } from '@/lib/property-status';
import type { LucideIcon } from 'lucide-react';

export type AppPageKey =
  | 'dashboard'
  | 'properties'
  | 'rooms'
  | 'payment-details'
  | 'deposits'
  | 'checkout'
  | 'finance'
  | 'reports'
  | 'meter-history'
  | 'users';

export type AccessLevel = 'hidden' | 'read_only' | 'manage';

export interface CurrentUserLike {
  id?: string | null;
  username?: string | null;
  email?: string | null;
  fullName?: string | null;
  role?: string | null;
  permissions?: Partial<Record<AppPageKey, AccessLevel>>;
}

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const DEFAULT_ACCESS_BY_ROLE: Record<string, Record<AppPageKey, AccessLevel>> = {
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

const DEFAULT_ADMIN_ACCESS: Record<AppPageKey, AccessLevel> = {
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
};

export const PAGE_LABELS: Record<AppPageKey, string> = {
  dashboard: '儀表板',
  properties: '物業管理',
  rooms: '房間管理',
  'payment-details': '收款明細',
  deposits: '押金管理',
  checkout: '退租結算',
  finance: '收支管理',
  reports: '損益報表',
  'meter-history': '電錶歷史',
  users: '使用者管理',
};

export const ALL_PAGE_ACCESS_OPTIONS: AppPageKey[] = [
  'dashboard',
  'properties',
  'rooms',
  'payment-details',
  'deposits',
  'checkout',
  'finance',
  'reports',
  'meter-history',
  'users',
];

export function getPageAccess(user: CurrentUserLike | null | undefined, page: AppPageKey): AccessLevel {
  const fromUser = user?.permissions?.[page];
  if (fromUser) return fromUser;
  const role = String(user?.role ?? 'admin');
  return DEFAULT_ACCESS_BY_ROLE[role]?.[page] ?? DEFAULT_ADMIN_ACCESS[page] ?? 'hidden';
}

export function canViewPage(user: CurrentUserLike | null | undefined, page: AppPageKey): boolean {
  return getPageAccess(user, page) !== 'hidden';
}

export function isReadOnlyPage(user: CurrentUserLike | null | undefined, page: AppPageKey): boolean {
  return getPageAccess(user, page) === 'read_only';
}

export function canManagePage(user: CurrentUserLike | null | undefined, page: AppPageKey): boolean {
  return getPageAccess(user, page) === 'manage';
}

export function canOperateArchivedProperty(
  user: CurrentUserLike | null | undefined,
  page: AppPageKey,
  propertyStatus: PropertyStatus,
): boolean {
  if (propertyStatus === 'archived') return false;
  return canManagePage(user, page);
}

function pageKeyFromHref(href: string): AppPageKey | null {
  switch (href) {
    case '/dashboard':
      return 'dashboard';
    case '/properties':
      return 'properties';
    case '/rooms':
      return 'rooms';
    case '/payment-details':
      return 'payment-details';
    case '/deposits':
      return 'deposits';
    case '/checkout':
      return 'checkout';
    case '/finance':
      return 'finance';
    case '/reports':
      return 'reports';
    case '/meter-history':
      return 'meter-history';
    case '/users':
      return 'users';
    default:
      return null;
  }
}

export type PageAccessLevel = 'hidden' | 'readonly' | 'manage';

export function getPageAccessLevel(
  href: string,
  user: CurrentUserLike | null | undefined,
): PageAccessLevel {
  const page = pageKeyFromHref(href);
  if (!page) return 'manage';
  const access = getPageAccess(user, page);
  if (access === 'read_only') return 'readonly';
  return access;
}

export function getVisibleNavItems<T extends NavItem>(
  items: T[],
  user: CurrentUserLike | null | undefined,
): T[] {
  return items.filter((item) => getPageAccessLevel(item.href, user) !== 'hidden');
}
