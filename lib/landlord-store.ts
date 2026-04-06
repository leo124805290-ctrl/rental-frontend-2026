// @ts-nocheck

export interface LandlordContract {
  id: string;
  propertyId: string;
  propertyName: string;
  landlordName: string;
  landlordPhone: string;
  startDate: string;
  endDate: string;
  depositMonths: number;
  depositAmount: number;
  depositPaid: boolean;
  paymentCycle: 'monthly' | 'quarterly' | 'semi-annual' | 'annual';
  yearlyRents: Array<{ year: number; monthlyRent: number }>;
}

export interface LandlordPayment {
  id: string;
  contractId: string;
  propertyId: string;
  propertyName: string;
  dueDate: string;
  amount: number;
  periodLabel: string;
  status: 'pending' | 'paid' | 'overdue';
  paidDate?: string;
  paidAmount?: number;
  paymentMethod?: string;
  notes?: string;
  expenseSynced?: boolean;
}

const STORAGE_CONTRACTS = 'landlord_contracts';
const STORAGE_PAYMENTS = 'landlord_payments';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getContracts(): LandlordContract[] {
  if (typeof window === 'undefined') return [];
  return safeParse<LandlordContract[]>(localStorage.getItem(STORAGE_CONTRACTS), []);
}

export function saveContracts(contracts: LandlordContract[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_CONTRACTS, JSON.stringify(contracts));
}

export function getPayments(): LandlordPayment[] {
  if (typeof window === 'undefined') return [];
  return safeParse<LandlordPayment[]>(localStorage.getItem(STORAGE_PAYMENTS), []);
}

export function savePayments(payments: LandlordPayment[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_PAYMENTS, JSON.stringify(payments));
}

function parseYmd(s: string): Date {
  const parts = s.split('-').map((x) => Number(x));
  const y = parts[0] ?? 2026;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d);
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayYmd(): string {
  const n = new Date();
  return toYmd(new Date(n.getFullYear(), n.getMonth(), n.getDate()));
}

function firstMonthlyDue(start: Date): Date {
  const first = new Date(start.getFullYear(), start.getMonth(), 1);
  if (first.getTime() >= start.getTime()) return first;
  return new Date(start.getFullYear(), start.getMonth() + 1, 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}

function periodMonths(cycle: LandlordContract['paymentCycle']): number {
  switch (cycle) {
    case 'monthly':
      return 1;
    case 'quarterly':
      return 3;
    case 'semi-annual':
      return 6;
    case 'annual':
      return 12;
    default:
      return 1;
  }
}

function rentForCalendarYear(contract: LandlordContract, calendarYear: number): number {
  const row = contract.yearlyRents.find((r) => r.year === calendarYear);
  if (row) return row.monthlyRent;
  const sorted = [...contract.yearlyRents].sort((a, b) => a.year - b.year);
  if (sorted.length === 0) return 0;
  const le = [...sorted].filter((r) => r.year <= calendarYear).pop();
  const ge = sorted.find((r) => r.year >= calendarYear);
  return le?.monthlyRent ?? ge?.monthlyRent ?? sorted[0]!.monthlyRent;
}

function contractYearIndex(contractStart: Date, cal: Date): number {
  return cal.getFullYear() - contractStart.getFullYear() + 1;
}

function inferDueStatus(dueYmd: string): 'pending' | 'overdue' {
  return dueYmd < todayYmd() ? 'overdue' : 'pending';
}

function newPaymentId(contractId: string, dueYmd: string, periodLabel: string): string {
  const slug = `${dueYmd}-${periodLabel}`.replace(/[^\w\u4e00-\u9fff-]+/g, '_');
  return `lp-${contractId}-${slug}`;
}

/** 合併已儲存的付款狀態（依 contractId + dueDate） */
export function mergeScheduleWithSaved(
  contract: LandlordContract,
  generated: LandlordPayment[],
  saved: LandlordPayment[],
): LandlordPayment[] {
  const map = new Map<string, LandlordPayment>();
  for (const p of saved) {
    if (p.contractId === contract.id) {
      map.set(`${p.contractId}|${p.dueDate}`, p);
    }
  }
  return generated.map((g) => {
    const m = map.get(`${contract.id}|${g.dueDate}`);
    if (!m) return g;
    if (m.status === 'paid') {
      return {
        ...g,
        id: m.id,
        status: 'paid',
        paidDate: m.paidDate,
        paidAmount: m.paidAmount,
        paymentMethod: m.paymentMethod,
        notes: m.notes,
        expenseSynced: m.expenseSynced,
      };
    }
    return { ...g, id: m.id };
  });
}

export function generatePaymentSchedule(contract: LandlordContract): LandlordPayment[] {
  const start = parseYmd(contract.startDate);
  const end = parseYmd(contract.endDate);
  if (end < start) return [];

  const pm = periodMonths(contract.paymentCycle);
  const contractStart = parseYmd(contract.startDate);
  const dates: Date[] = [];

  if (contract.paymentCycle === 'monthly') {
    let d = firstMonthlyDue(start);
    while (d <= end) {
      dates.push(new Date(d));
      d = addMonths(d, 1);
    }
  } else if (contract.paymentCycle === 'quarterly') {
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
      for (const mo of [0, 3, 6, 9] as const) {
        const d = new Date(y, mo, 1);
        if (d >= start && d <= end) dates.push(d);
      }
    }
    dates.sort((a, b) => a.getTime() - b.getTime());
  } else if (contract.paymentCycle === 'semi-annual') {
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
      for (const mo of [0, 6] as const) {
        const d = new Date(y, mo, 1);
        if (d >= start && d <= end) dates.push(d);
      }
    }
    dates.sort((a, b) => a.getTime() - b.getTime());
  } else {
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
      const d = new Date(y, 0, 1);
      if (d >= start && d <= end) dates.push(d);
    }
  }

  const out: LandlordPayment[] = [];

  for (const d of dates) {
    const dueYmd = toYmd(d);
    const calYear = d.getFullYear();
    const month = d.getMonth() + 1;
    const monthlyRent = rentForCalendarYear(contract, calYear);
    const amount = monthlyRent * pm;

    const yIdx = contractYearIndex(contractStart, d);
    let periodLabel: string;
    if (contract.paymentCycle === 'monthly') {
      periodLabel = `第${yIdx}年 M${month}`;
    } else if (contract.paymentCycle === 'quarterly') {
      const q = Math.floor(d.getMonth() / 3) + 1;
      periodLabel = `第${yIdx}年 Q${q}`;
    } else if (contract.paymentCycle === 'semi-annual') {
      const h = d.getMonth() < 6 ? 1 : 2;
      periodLabel = `第${yIdx}年 H${h}`;
    } else {
      periodLabel = `第${yIdx}年 年度`;
    }

    const st = inferDueStatus(dueYmd);
    out.push({
      id: newPaymentId(contract.id, dueYmd, periodLabel),
      contractId: contract.id,
      propertyId: contract.propertyId,
      propertyName: contract.propertyName,
      dueDate: dueYmd,
      amount,
      periodLabel,
      status: st,
    });
  }

  return out;
}
