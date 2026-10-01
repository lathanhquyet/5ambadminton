/**
 * DTO for Public Saoke Outstanding Debtors endpoint.
 * Explicit ALLOW-LIST DTO to prevent PII, tokens, or internal database fields from leaking.
 * Minimal DTO structure: NO internal DB IDs, NO phone, email, tokens or internal attributes.
 */

export interface PublicDebtorDTO {
  memberName: string;
  memberType: 'FIXED' | 'VISITOR';
  month: string;
  totalFeeRequired: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'PAYMENT_REQUESTED';
  paymentReference: string;
}

/**
 * Clean ASCII uppercase helper for generating public payment reference code.
 */
function toCleanAsciiCode(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

/**
 * Maps internal member debt array to public debtor DTO list.
 * Filters out members with remaining_amount <= 0.
 */
export function toPublicDebtorDTOList(rawDebts: any[], monthKey: string): PublicDebtorDTO[] {
  const [yearStr, monthStr] = monthKey.split('-');

  // Filter only debtors with remaining_amount > 0
  const debtorsOnly = rawDebts.filter((d: any) => d.remaining_amount > 0);

  return debtorsOnly.map((d: any) => {
    const cleanName = toCleanAsciiCode(d.member_name || '');
    const memberCode = cleanName ? cleanName.substring(0, 10) : d.member_id.substring(0, 8).toUpperCase();
    const paymentReference = `5AM-${memberCode}-T${monthStr}-${yearStr}`;

    return {
      memberName: d.member_name,
      memberType: d.member_type === 'VISITOR' ? 'VISITOR' : 'FIXED',
      month: monthKey,
      totalFeeRequired: d.total_fee_required,
      paidAmount: d.paid_amount,
      remainingAmount: d.remaining_amount,
      status: d.status,
      paymentReference
    };
  });
}
