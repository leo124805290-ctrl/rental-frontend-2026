'use client';

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  fullName?: string;
  role: string;
  permissions?: Record<string, 'hidden' | 'read_only' | 'manage'>;
  sessionId?: string;
}

export interface AuthAuditRecord {
  id: string;
  userId: string;
  username: string;
  role: string;
  event: 'login' | 'logout' | 'switch_account' | 'session_expired';
  at: string;
  userAgent?: string | undefined;
}

export interface ActiveUserSession {
  sessionId: string;
  userId: string;
  username: string;
  fullName?: string | undefined;
  role: string;
  loginAt: string;
  lastSeenAt: string;
  currentPath?: string | undefined;
}

const AUTH_USER_KEY = 'auth_user_profile';
const AUTH_AUDIT_KEY = 'auth_user_audit_records';
const ACTIVE_SESSIONS_KEY = 'auth_active_sessions';
const ACTIVE_SESSION_TTL_MS = 5 * 60 * 1000;
const AUDIT_LIMIT = 100;

function dispatchAuthUserChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('auth-user-changed'));
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function upsertActiveSession(session: ActiveUserSession): void {
  const sessions = getActiveUserSessions().filter((item) => item.sessionId !== session.sessionId);
  sessions.unshift(session);
  writeJson(ACTIVE_SESSIONS_KEY, sessions);
}

export function getStoredAuthUser(): AuthUser | null {
  return readJson<AuthUser | null>(AUTH_USER_KEY, null);
}

export function setStoredAuthUser(user: AuthUser | null): void {
  if (typeof window === 'undefined') return;
  if (!user) {
    localStorage.removeItem(AUTH_USER_KEY);
  } else {
    writeJson(AUTH_USER_KEY, user);
  }
  dispatchAuthUserChanged();
}

export function clearStoredAuthUser(): void {
  setStoredAuthUser(null);
}

export function getAuthAuditRecords(): AuthAuditRecord[] {
  return readJson<AuthAuditRecord[]>(AUTH_AUDIT_KEY, []).sort((a, b) =>
    b.at.localeCompare(a.at),
  );
}

export function recordAuthAudit(
  user: Pick<AuthUser, 'id' | 'username' | 'role'>,
  event: AuthAuditRecord['event'],
): void {
  if (typeof window === 'undefined') return;
  const current = getAuthAuditRecords();
  const next: AuthAuditRecord[] = [
    {
      id: makeId('audit'),
      userId: user.id,
      username: user.username,
      role: user.role,
      event,
      at: nowIso(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    },
    ...current,
  ].slice(0, AUDIT_LIMIT);
  writeJson(AUTH_AUDIT_KEY, next);
}

export function getActiveUserSessions(): ActiveUserSession[] {
  const now = Date.now();
  const sessions = readJson<ActiveUserSession[]>(ACTIVE_SESSIONS_KEY, []).filter((session) => {
    const seen = new Date(session.lastSeenAt).getTime();
    return !Number.isNaN(seen) && now - seen <= ACTIVE_SESSION_TTL_MS;
  });
  writeJson(ACTIVE_SESSIONS_KEY, sessions);
  return sessions.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export function startAuthSession(user: Omit<AuthUser, 'sessionId'>, currentPath?: string): AuthUser {
  const sessionId = makeId('session');
  const session: ActiveUserSession = {
    sessionId,
    userId: user.id,
    username: user.username,
    role: user.role,
    loginAt: nowIso(),
    lastSeenAt: nowIso(),
    ...(user.fullName ? { fullName: user.fullName } : {}),
    ...(currentPath ? { currentPath } : {}),
  };
  const storedUser: AuthUser = { ...user, sessionId };
  setStoredAuthUser(storedUser);
  upsertActiveSession(session);
  recordAuthAudit(user, 'login');
  return storedUser;
}

export function touchAuthSession(currentPath?: string): void {
  const currentUser = getStoredAuthUser();
  if (!currentUser?.sessionId) return;
  const sessions = getActiveUserSessions();
  const match = sessions.find((item) => item.sessionId === currentUser.sessionId);
  if (!match) {
    upsertActiveSession({
      sessionId: currentUser.sessionId,
      userId: currentUser.id,
      username: currentUser.username,
      fullName: currentUser.fullName,
      role: currentUser.role,
      loginAt: nowIso(),
      lastSeenAt: nowIso(),
      currentPath,
    });
    return;
  }
  upsertActiveSession({
    ...match,
    lastSeenAt: nowIso(),
    ...(currentPath ? { currentPath } : {}),
  });
}

export function endAuthSession(reason: Exclude<AuthAuditRecord['event'], 'login'> = 'logout'): void {
  const currentUser = getStoredAuthUser();
  if (!currentUser) return;
  const sessions = getActiveUserSessions().filter(
    (item) => item.sessionId !== currentUser.sessionId,
  );
  writeJson(ACTIVE_SESSIONS_KEY, sessions);
  recordAuthAudit(currentUser, reason);
  clearStoredAuthUser();
}

export type StoredAuthUser = AuthUser;

export function setStoredCurrentUser(user: AuthUser | null): void {
  setStoredAuthUser(user);
}

export interface StoredSessionIdentity {
  sessionId: string;
  userId: string;
}

export function getStoredSessionIdentity(): StoredSessionIdentity | null {
  const user = getStoredAuthUser();
  if (!user?.sessionId) return null;
  return {
    sessionId: user.sessionId,
    userId: user.id,
  };
}

export function getStoredLastLoginAt(): string | null {
  const user = getStoredAuthUser();
  if (!user?.sessionId) return null;
  const session = getActiveUserSessions().find((item) => item.sessionId === user.sessionId);
  return session?.loginAt ?? null;
}
