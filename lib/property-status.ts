export type PropertyStatus = 'active' | 'archived' | 'demo' | string | null | undefined;

export interface PropertyStatusLike {
  status?: PropertyStatus;
}

export interface PropertyOptionLike extends PropertyStatusLike {
  id: string;
  name: string;
}

export function isArchivedPropertyStatus(status: PropertyStatus): boolean {
  return status === 'archived';
}

export function isDemoPropertyStatus(status: PropertyStatus): boolean {
  return status === 'demo';
}

export function isOperablePropertyStatus(status: PropertyStatus): boolean {
  return !isArchivedPropertyStatus(status);
}

export function normalizePropertyStatus(status: PropertyStatus): 'active' | 'archived' | 'demo' {
  if (status === 'archived') return 'archived';
  if (status === 'demo') return 'demo';
  return 'active';
}

export function filterOperableProperties<T extends PropertyStatusLike>(properties: T[]): T[] {
  return properties.filter((property) => isOperablePropertyStatus(property.status));
}

export function filterHistoricalVisibleProperties<T extends PropertyStatusLike>(properties: T[]): T[] {
  return properties.filter(Boolean);
}

export function sortPropertiesForHistory<T extends PropertyOptionLike>(properties: T[]): T[] {
  return [...properties].sort((a, b) => {
    const sa = normalizePropertyStatus(a.status);
    const sb = normalizePropertyStatus(b.status);
    if (sa !== sb) {
      if (sa === 'active') return -1;
      if (sb === 'active') return 1;
      if (sa === 'demo') return -1;
      if (sb === 'demo') return 1;
    }
    return a.name.localeCompare(b.name, 'zh-Hant');
  });
}

export function findPropertyById<T extends { id: string }>(properties: T[], id: string): T | undefined {
  return properties.find((property) => property.id === id);
}

export function allPropertiesPath(): string {
  return '/api/properties?include_archived=true';
}

export function propertyStatusLabel(status: PropertyStatus): string {
  switch (status) {
    case 'archived':
      return '已封存';
    case 'demo':
      return '測試用';
    case 'active':
    default:
      return '使用中';
  }
}

export function propertyStatusBadgeClassName(status: PropertyStatus): string {
  switch (status) {
    case 'archived':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'demo':
      return 'border-sky-200 bg-sky-50 text-sky-800';
    case 'active':
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
}

export const isArchivedProperty = isArchivedPropertyStatus;
export const isDemoProperty = isDemoPropertyStatus;
export const isOperableProperty = isOperablePropertyStatus;
export const getPropertyStatusBadgeLabel = propertyStatusLabel;
export const getPropertyStatusBadgeClassName = propertyStatusBadgeClassName;
