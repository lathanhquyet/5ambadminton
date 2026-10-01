/**
 * Date and Month utilities for Asia/Ho_Chi_Minh business timezone.
 */

/**
 * Returns current business month key (YYYY-MM) in Asia/Ho_Chi_Minh timezone.
 */
export function getCurrentMonthKey(refDate: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit'
  });
  const parts = formatter.formatToParts(refDate);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  return `${year}-${month}`;
}

/**
 * Returns current business date string (YYYY-MM-DD) in Asia/Ho_Chi_Minh timezone.
 */
export function getCurrentDateStr(refDate: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(refDate);
}
