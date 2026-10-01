import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';

export interface PaymentSettingsDTO {
  enabled: boolean;
  bankName: string;
  bankBin: string;
  accountNumber: string;
  accountName: string;
}

export interface UpdatePaymentSettingsParams {
  enabled?: boolean;
  bankName?: string;
  bankBin?: string;
  accountNumber?: string;
  accountName?: string;
}

export function getPaymentSettings(dbInstance?: DatabaseType): PaymentSettingsDTO {
  const db = dbInstance || defaultDb;

  const row = db.prepare('SELECT * FROM bank_accounts ORDER BY created_at DESC LIMIT 1').get() as any;

  if (!row) {
    return {
      enabled: true,
      bankName: 'MB',
      bankBin: '970436',
      accountNumber: '090123456789',
      accountName: 'QUY CAU LONG 5AM'
    };
  }

  return {
    enabled: Boolean(row.is_active),
    bankName: row.bank_name || 'MB',
    bankBin: row.bank_bin || '970436',
    accountNumber: row.account_number || '',
    accountName: row.account_holder || ''
  };
}

export function updatePaymentSettings(
  dbInstance: DatabaseType | undefined,
  params: UpdatePaymentSettingsParams
): PaymentSettingsDTO {
  const db = dbInstance || defaultDb;

  const current = getPaymentSettings(db);

  const bankName = params.bankName !== undefined ? params.bankName.trim() : current.bankName;
  const bankBin = params.bankBin !== undefined ? params.bankBin.trim() : current.bankBin;
  const accountNumber = params.accountNumber !== undefined ? params.accountNumber.trim() : current.accountNumber;
  const accountName = params.accountName !== undefined ? params.accountName.trim() : current.accountName;
  const enabled = params.enabled !== undefined ? Boolean(params.enabled) : current.enabled;

  // Validation
  if (!bankName) {
    throw new Error('Tên ngân hàng (bankName) không được để trống.');
  }

  if (!accountNumber) {
    throw new Error('Số tài khoản (accountNumber) không được để trống.');
  }

  // Account number format validation (digits/letters, 3-35 chars)
  const accNumRegex = /^[A-Za-z0-9\-\.]{3,35}$/;
  if (!accNumRegex.test(accountNumber)) {
    throw new Error('Số tài khoản chứa ký tự không hợp lệ hoặc độ dài không phù hợp (3-35 ký tự).');
  }

  if (!accountName) {
    throw new Error('Tên chủ tài khoản (accountName) không được để trống.');
  }

  const existingRow = db.prepare('SELECT id FROM bank_accounts ORDER BY created_at DESC LIMIT 1').get() as any;

  if (existingRow) {
    db.prepare(`
      UPDATE bank_accounts
      SET bank_name = ?, bank_bin = ?, account_number = ?, account_holder = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(bankName, bankBin || '970436', accountNumber, accountName, enabled ? 1 : 0, existingRow.id);
  } else {
    const newId = 'bank_acc_' + Math.random().toString(36).substring(2, 10);
    db.prepare(`
      INSERT INTO bank_accounts (id, bank_name, bank_bin, account_number, account_holder, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(newId, bankName, bankBin || '970436', accountNumber, accountName, enabled ? 1 : 0);
  }

  return {
    enabled,
    bankName,
    bankBin: bankBin || '970436',
    accountNumber,
    accountName
  };
}
