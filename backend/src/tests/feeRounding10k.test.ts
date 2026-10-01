import { roundupToTenThousand } from '../services/businessFormula';

describe('FIXED FEE ROUNDING (-4 / 10,000 VND) MANDATORY TEST SUITE', () => {
  test('Mandatory 10k Rounding Matrix for Fixed Fund', () => {
    expect(roundupToTenThousand(1)).toBe(10000);
    expect(roundupToTenThousand(9999)).toBe(10000);
    expect(roundupToTenThousand(10000)).toBe(10000);
    expect(roundupToTenThousand(10001)).toBe(20000);

    expect(roundupToTenThousand(750000)).toBe(750000);
    expect(roundupToTenThousand(750001)).toBe(760000);
    expect(roundupToTenThousand(751000)).toBe(760000);
    expect(roundupToTenThousand(753855)).toBe(760000); // User Example 1
    expect(roundupToTenThousand(458868)).toBe(460000); // User Example 2
    expect(roundupToTenThousand(759999)).toBe(760000);
    expect(roundupToTenThousand(760000)).toBe(760000);
    expect(roundupToTenThousand(760001)).toBe(770000);
  });
});
