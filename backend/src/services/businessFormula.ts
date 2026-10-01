/**
 * Business Formula Engine V3.1
 * Quỹ Cầu Lông 5AM -- RISE & SHINE
 */

/**
 * Calculates expected playing days in a given month for a fixed member.
 * Formula: ROUNDUP(daysPerWeek * daysInMonth / 7, 0) -> Math.ceil(daysPerWeek * daysInMonth / 7)
 * 
 * @param daysPerWeek Registered playing days per week (0 to 7)
 * @param year Year (e.g. 2026)
 * @param month Month 1-indexed (1 to 12)
 */
export function calculateExpectedDays(daysPerWeek: number, year: number, month: number): number {
  if (daysPerWeek <= 0) return 0;
  if (daysPerWeek > 7) throw new Error('days_per_week cannot exceed 7');

  // New Date(year, month, 0).getDate() returns the number of days in that month
  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.ceil((daysPerWeek * daysInMonth) / 7);
}

/**
 * Financial Rounding Rule: ROUNDUP to 1,000 VND
 * Formula: Math.ceil(amount / 1000) * 1000
 * 
 * @param amount Original numeric amount
 */
export function roundupToThousand(amount: number): number {
  if (amount <= 0) return 0;
  return Math.ceil(amount / 1000) * 1000;
}

/**
 * Fixed Fee Financial Rounding Rule: ROUNDUP to 10,000 VND (-4)
 * Formula: Math.ceil(amount / 10000) * 10000
 * Applicable ONLY for FIXED_FUND fee calculation from business formula.
 *
 * @param amount Original numeric amount
 */
export function roundupToTenThousand(amount: number): number {
  if (amount <= 0) return 0;
  return Math.ceil(amount / 10000) * 10000;
}
