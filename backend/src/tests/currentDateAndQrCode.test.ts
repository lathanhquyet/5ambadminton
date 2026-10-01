import { getCurrentMonthKey, getCurrentDateStr } from '../utils/dateUtils';

describe('Current Date and Month Utility Tests (Asia/Ho_Chi_Minh timezone)', () => {
  test('Case 1: 2026-10-01 -> currentMonth = 2026-10', () => {
    // 2026-10-01 10:00:00 GMT+7 (03:00 UTC)
    const date = new Date('2026-10-01T03:00:00.000Z');
    expect(getCurrentMonthKey(date)).toBe('2026-10');
    expect(getCurrentDateStr(date)).toBe('2026-10-01');
  });

  test('Case 2: 2026-10-31 -> currentMonth = 2026-10', () => {
    // 2026-10-31 23:59:00 GMT+7 (16:59 UTC)
    const date = new Date('2026-10-31T16:59:00.000Z');
    expect(getCurrentMonthKey(date)).toBe('2026-10');
    expect(getCurrentDateStr(date)).toBe('2026-10-31');
  });

  test('Case 3: 2026-11-01 -> currentMonth = 2026-11', () => {
    // 2026-11-01 08:00:00 GMT+7 (01:00 UTC)
    const date = new Date('2026-11-01T01:00:00.000Z');
    expect(getCurrentMonthKey(date)).toBe('2026-11');
    expect(getCurrentDateStr(date)).toBe('2026-11-01');
  });

  test('Case 4: 2027-01-01 -> currentMonth = 2027-01', () => {
    // 2027-01-01 09:00:00 GMT+7 (02:00 UTC)
    const date = new Date('2027-01-01T02:00:00.000Z');
    expect(getCurrentMonthKey(date)).toBe('2027-01');
    expect(getCurrentDateStr(date)).toBe('2027-01-01');
  });

  test('UTC Midnight Rollover Case: 2026-09-30 17:30 UTC = 2026-10-01 00:30 Vietnam -> 2026-10', () => {
    // 00:30 AM in Vietnam on 2026-10-01 is 17:30 PM UTC on 2026-09-30
    const utcMidnightDate = new Date('2026-09-30T17:30:00.000Z');
    expect(getCurrentMonthKey(utcMidnightDate)).toBe('2026-10');
    expect(getCurrentDateStr(utcMidnightDate)).toBe('2026-10-01');
  });
});
