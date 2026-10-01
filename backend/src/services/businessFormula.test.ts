import { calculateExpectedDays, roundupToThousand } from './businessFormula';

describe('Business Formula Engine Tests', () => {
  describe('calculateExpectedDays (ROUNDUP days/month formula)', () => {
    test('October 2026 (31 days) - Mandatory Spec Matrix', () => {
      // October 2026 has 31 days
      expect(calculateExpectedDays(5, 2026, 10)).toBe(23); // 5 * 31 / 7 = 22.14 -> 23
      expect(calculateExpectedDays(4, 2026, 10)).toBe(18); // 4 * 31 / 7 = 17.71 -> 18
      expect(calculateExpectedDays(3, 2026, 10)).toBe(14); // 3 * 31 / 7 = 13.28 -> 14
      expect(calculateExpectedDays(2, 2026, 10)).toBe(9);  // 2 * 31 / 7 = 8.85 -> 9
      expect(calculateExpectedDays(1, 2026, 10)).toBe(5);  // 1 * 31 / 7 = 4.42 -> 5
      expect(calculateExpectedDays(0, 2026, 10)).toBe(0);
    });

    test('Leap Year vs Non-Leap Year February', () => {
      // Feb 2028 is a leap year (29 days)
      expect(calculateExpectedDays(5, 2028, 2)).toBe(21); // 5 * 29 / 7 = 20.71 -> 21

      // Feb 2027 is a normal year (28 days)
      expect(calculateExpectedDays(5, 2027, 2)).toBe(20); // 5 * 28 / 7 = 20 -> 20
    });

    test('Throws error if daysPerWeek > 7', () => {
      expect(() => calculateExpectedDays(8, 2026, 10)).toThrow('days_per_week cannot exceed 7');
    });
  });

  describe('roundupToThousand (ROUNDUP 1,000 VND formula)', () => {
    test('Mandatory financial rounding test cases', () => {
      expect(roundupToThousand(774100)).toBe(775000);
      expect(roundupToThousand(774999)).toBe(775000);
      expect(roundupToThousand(775000)).toBe(775000);
      expect(roundupToThousand(775001)).toBe(776000);
      expect(roundupToThousand(1001)).toBe(2000);
      expect(roundupToThousand(0)).toBe(0);
    });
  });
});
