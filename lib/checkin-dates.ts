/** 合約月數：1 / 3 / 6 / 12 */
export const CONTRACT_TERM_OPTIONS = [1, 3, 6, 12] as const;
export type ContractTermMonths = (typeof CONTRACT_TERM_OPTIONS)[number];

function lastDayOfMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

/** YYYY-MM-DD → 本地日期 */
export function parseLocalYmd(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return new Date(NaN);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(y, mo - 1, d);
}

/**
 * 入住日 + 合約月數 → 該段最後一日（與後端一致）。
 * 1 號入住：+ (term - 1) 個月曆月後取月底；非 1 號：+ term 個月曆月後取月底。
 */
export function computeExpectedCheckoutDate(checkIn: Date, contractTermMonths: number): Date {
  if (Number.isNaN(checkIn.getTime())) return checkIn;
  const day = checkIn.getDate();
  const y = checkIn.getFullYear();
  const mi = checkIn.getMonth();
  const monthsToAdd = day === 1 ? contractTermMonths - 1 : contractTermMonths;
  const end = new Date(y, mi + monthsToAdd, 1);
  const ld = lastDayOfMonth(end.getFullYear(), end.getMonth());
  return new Date(end.getFullYear(), end.getMonth(), ld);
}

/** YYYY-MM-DD 字串 + 合約月數 → YYYY-MM-DD */
export function formatExpectedCheckoutIso(checkInIso: string, contractTermMonths: number): string {
  const d = parseLocalYmd(checkInIso);
  if (Number.isNaN(d.getTime())) return '';
  const e = computeExpectedCheckoutDate(d, contractTermMonths);
  const y = e.getFullYear();
  const m = String(e.getMonth() + 1).padStart(2, '0');
  const day = String(e.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 當月剩餘天數（月底 − 入住日），與後端規格一致 */
export function daysRemainingInMonthForRent(checkIn: Date): number {
  const last = new Date(checkIn.getFullYear(), checkIn.getMonth() + 1, 0).getDate();
  return last - checkIn.getDate();
}

export function prorationRentYuan(monthlyRentYuan: number, checkIn: Date): number {
  const days = daysRemainingInMonthForRent(checkIn);
  const daily = monthlyRentYuan / 30;
  return Math.round(daily * days);
}

export function ymFromCheckInLocal(isoDate: string): string {
  const d = parseLocalYmd(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** @deprecated 改用 formatExpectedCheckoutIso */
export function addOneYearToIsoDate(isoDate: string): string {
  return formatExpectedCheckoutIso(isoDate, 12);
}

export function paymentMonthFromCheckIn(isoDate: string): string {
  if (!isoDate) return new Date().toISOString().slice(0, 7);
  return isoDate.slice(0, 7);
}
