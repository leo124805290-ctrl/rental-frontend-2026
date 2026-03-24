/** 入住日 + 合約月數 → 該期最後一日（與規格書公式一致） */
export function calcContractEnd(checkInDate: string, months: number): Date {
  const d = new Date(checkInDate);
  d.setMonth(d.getMonth() + months + 1);
  d.setDate(0);
  return d;
}

export function isoDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
