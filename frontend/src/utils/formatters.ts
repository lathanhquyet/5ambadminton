/**
 * Formats an exact number into Vietnamese currency format (e.g., 3.000.000 ₫).
 * Preserves exact values (no rounding, no Math.ceil, no 10k rounding).
 * Preserves negative sign for negative balances (e.g., -500.000 ₫).
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '0 ₫';
  }
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

/**
 * Formats a month key (YYYY-MM) into Vietnamese display format (e.g. Tháng 09/2026).
 */
export function formatMonthDisplay(monthKey: string): string {
  if (!monthKey || !monthKey.includes('-')) return monthKey;
  const [year, month] = monthKey.split('-');
  return `Tháng ${month}/${year}`;
}
