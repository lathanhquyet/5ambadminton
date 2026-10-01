import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';
import { roundupToThousand } from './businessFormula';
import { assertMonthNotClosed } from './feeEngine';
import { getCurrentStockInPieces, formatStockDisplay } from './inventoryService';

export interface CourtFeeParams {
  monthKey: string;
  pricePerDay: number;
  totalDays: number;
  totalCourts?: number;
  notes?: string;
  userId?: string;
}

export interface ShuttlePurchaseParams {
  purchaseDate: string;
  monthKey: string;
  productId?: string;
  supplier: string;
  tubesQty: number;
  pricePerTube: number;
  notes?: string;
  userId?: string;
}

export interface MidMonthJoinerParams {
  memberId: string;
  monthKey: string;
  transactionDate: string;
  amount: number;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER';
  notes?: string;
  userId?: string;
}

export interface OtherExpenseParams {
  transactionDate: string;
  monthKey: string;
  description: string;
  recipient?: string;
  amount: number;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER';
  notes?: string;
  userId?: string;
}

export interface CashLedgerSummary {
  month_key: string;
  opening_balance: number;
  total_income: number;
  total_expense: number;
  net_month_balance: number;
  ending_balance: number;
  balance_status: 'POSITIVE' | 'NEGATIVE' | 'ZERO';
  income_breakdown: {
    fixed_fund: number;
    visitor_fee: number;
    other_income: number;
  };
  expense_breakdown: {
    court_fee: number;
    shuttle_purchase: number;
    other_expense: number;
  };
}

/**
 * Records or updates court fee configuration for a month and creates/updates associated expense_transaction.
 */
export function recordCourtFeeConfig(
  dbInstance: DatabaseType | undefined,
  params: CourtFeeParams
): { courtFeeId: string; expenseTransactionId: string; totalAmount: number } {
  const db = dbInstance || defaultDb;
  const { monthKey, pricePerDay, totalDays, totalCourts = 1, notes, userId } = params;

  assertMonthNotClosed(db, monthKey);

  if (pricePerDay < 0 || totalDays <= 0 || totalCourts <= 0) {
    throw new Error('Thông số tiền sân không hợp lệ.');
  }

  const rawTotal = pricePerDay * totalDays * totalCourts;
  const totalAmount = roundupToThousand(rawTotal);

  const existingConfig = db
    .prepare('SELECT * FROM court_fee_configs WHERE month_key = ?')
    .get(monthKey) as any;

  const runAtomic = db.transaction(() => {
    if (existingConfig) {
      // Update existing expense_transaction
      db.prepare(`
        UPDATE expense_transactions
        SET original_amount = ?, rounded_amount = ?, description = ?
        WHERE id = ?
      `).run(
        rawTotal,
        totalAmount,
        `Chi phí sân tháng ${monthKey} (${totalDays} ngày x ${totalCourts} sân)`,
        existingConfig.expense_transaction_id
      );

      // Update court_fee_configs
      db.prepare(`
        UPDATE court_fee_configs
        SET price_per_day = ?, total_days = ?, total_courts = ?, total_amount = ?, notes = ?
        WHERE id = ?
      `).run(pricePerDay, totalDays, totalCourts, totalAmount, notes || null, existingConfig.id);

      return {
        courtFeeId: existingConfig.id,
        expenseTransactionId: existingConfig.expense_transaction_id,
        totalAmount
      };
    } else {
      const courtFeeId = 'court_' + monthKey.replace('-', '');
      const expTxId = 'exp_court_' + monthKey.replace('-', '');

      // 1. Create expense_transaction
      db.prepare(`
        INSERT INTO expense_transactions (
          id, transaction_date, month_key, category, description, recipient, original_amount, rounded_amount,
          payment_method, reference_type, reference_id, is_void, created_by
        ) VALUES (?, ?, ?, 'COURT_FEE', ?, 'Chủ sân cầu lông', ?, ?, 'BANK_TRANSFER', 'COURT_FEE', ?, 0, ?)
      `).run(
        expTxId,
        `${monthKey}-01`,
        monthKey,
        `Chi phí sân tháng ${monthKey} (${totalDays} ngày x ${totalCourts} sân)`,
        rawTotal,
        totalAmount,
        courtFeeId,
        userId || null
      );

      // 2. Create court_fee_configs
      db.prepare(`
        INSERT INTO court_fee_configs (
          id, month_key, price_per_day, total_days, total_courts, total_amount, expense_transaction_id, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        courtFeeId,
        monthKey,
        pricePerDay,
        totalDays,
        totalCourts,
        totalAmount,
        expTxId,
        notes || null,
        userId || null
      );

      return {
        courtFeeId,
        expenseTransactionId: expTxId,
        totalAmount
      };
    }
  });

  return runAtomic();
}

export interface CourtFeeManualParams {
  transactionDate: string;
  monthKey: string;
  description?: string;
  recipient?: string;
  amount: number;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER';
  notes?: string;
  userId?: string;
}

/**
 * Records a manual Court Fee Expense transaction (Phiếu chi phí sân thủ công).
 * Preserves EXACT entered amount without rounding and category COURT_FEE.
 */
export function recordCourtFeeManualExpense(
  dbInstance: DatabaseType | undefined,
  params: CourtFeeManualParams
): { expenseTransactionId: string; amount: number } {
  const db = dbInstance || defaultDb;
  const { transactionDate, monthKey, description, recipient, amount, paymentMethod = 'BANK_TRANSFER', notes, userId } = params;

  assertMonthNotClosed(db, monthKey);

  if (amount === undefined || amount === null || typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || amount <= 0) {
    throw new Error('Số tiền chi phí sân phải là số dương lớn hơn 0.');
  }

  const expTxId = 'exp_court_' + Math.random().toString(36).substring(2, 10);
  const desc = description && description.trim() ? description.trim() : `Chi phí thuê sân tháng ${monthKey}`;
  const rec = recipient && recipient.trim() ? recipient.trim() : 'Chủ sân cầu lông';

  db.prepare(`
    INSERT INTO expense_transactions (
      id, transaction_date, month_key, category, description, recipient, original_amount, rounded_amount,
      payment_method, is_void, created_by
    ) VALUES (?, ?, ?, 'COURT_FEE', ?, ?, ?, ?, ?, 0, ?)
  `).run(
    expTxId,
    transactionDate,
    monthKey,
    desc,
    rec,
    amount,
    amount, // Exact amount without rounding
    paymentMethod,
    userId || null
  );

  return {
    expenseTransactionId: expTxId,
    amount
  };
}

/**
 * Records a shuttle purchase.
 * SIMULTANEOUSLY & ATOMICALLY creates:
 * 1. 1 expense_transaction (Category: SHUTTLE_PURCHASE)
 * 2. 1 inventory_transaction (Type: RECEIPT, quantity: tubesQty * pieces_per_tube)
 */
export function recordShuttlePurchase(
  dbInstance: DatabaseType | undefined,
  params: ShuttlePurchaseParams
): { purchaseId: string; expenseTransactionId: string; inventoryTransactionId: string; totalAmount: number; piecesQty: number } {
  const db = dbInstance || defaultDb;
  const { purchaseDate, monthKey, productId = 'prod_tc77', supplier, tubesQty, pricePerTube, notes, userId } = params;

  assertMonthNotClosed(db, monthKey);

  if (tubesQty <= 0 || pricePerTube <= 0) {
    throw new Error('Số lượng ống và đơn giá/ống phải lớn hơn 0.');
  }

  const product = db.prepare('SELECT * FROM inventory_products WHERE id = ?').get(productId) as any;
  if (!product) {
    throw new Error(`Sản phẩm kho với ID '${productId}' không tồn tại.`);
  }

  const piecesPerTube = product.pieces_per_tube || 12;
  const piecesQty = tubesQty * piecesPerTube;
  const rawTotal = tubesQty * pricePerTube;
  const totalAmount = roundupToThousand(rawTotal);

  const purchaseId = 'pur_' + Math.random().toString(36).substring(2, 10);
  const expTxId = 'exp_pur_' + Math.random().toString(36).substring(2, 10);
  const invTxId = 'inv_pur_' + Math.random().toString(36).substring(2, 10);

  const runAtomic = db.transaction(() => {
    // 1. Create expense_transaction
    db.prepare(`
      INSERT INTO expense_transactions (
        id, transaction_date, month_key, category, description, recipient, original_amount, rounded_amount,
        payment_method, reference_type, reference_id, is_void, created_by
      ) VALUES (?, ?, ?, 'SHUTTLE_PURCHASE', ?, ?, ?, ?, 'BANK_TRANSFER', 'SHUTTLE_PURCHASE', ?, 0, ?)
    `).run(
      expTxId,
      purchaseDate,
      monthKey,
      `Mua cầu ${product.name} (${tubesQty} ống từ ${supplier})`,
      supplier,
      rawTotal,
      totalAmount,
      purchaseId,
      userId || null
    );

    // 2. Create inventory_transaction (RECEIPT)
    db.prepare(`
      INSERT INTO inventory_transactions (
        id, transaction_date, month_key, product_id, transaction_type, quantity_in_pieces,
        reference_type, reference_id, unit_price, total_amount, notes, created_by
      ) VALUES (?, ?, ?, ?, 'RECEIPT', ?, 'PURCHASE', ?, ?, ?, ?, ?)
    `).run(
      invTxId,
      purchaseDate,
      monthKey,
      productId,
      piecesQty, // Positive for RECEIPT
      purchaseId,
      pricePerTube,
      totalAmount,
      `Nhập kho mua cầu đợt ngày ${purchaseDate} (${tubesQty} ống)`,
      userId || null
    );

    // 3. Create shuttle_purchases
    db.prepare(`
      INSERT INTO shuttle_purchases (
        id, purchase_date, month_key, product_id, supplier, tubes_qty, pieces_qty, price_per_tube,
        total_amount, expense_transaction_id, inventory_transaction_id, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      purchaseId,
      purchaseDate,
      monthKey,
      productId,
      supplier,
      tubesQty,
      piecesQty,
      pricePerTube,
      totalAmount,
      expTxId,
      invTxId,
      notes || null,
      userId || null
    );

    return {
      purchaseId,
      expenseTransactionId: expTxId,
      inventoryTransactionId: invTxId,
      totalAmount,
      piecesQty
    };
  });

  return runAtomic();
}

/**
 * Records a contribution from a mid-month joiner.
 * Creates an income_transaction (Category: OTHER_INCOME).
 * Does NOT run Fixed Fund fee allocation engine for this member in the month.
 * Is IDEMPOTENT: updating existing mid-month joiner record if called twice.
 */
export function recordMidMonthJoinerIncome(
  dbInstance: DatabaseType | undefined,
  params: MidMonthJoinerParams
): { incomeTransactionId: string; amount: number } {
  const db = dbInstance || defaultDb;
  const { memberId, monthKey, transactionDate, amount, paymentMethod = 'BANK_TRANSFER', notes, userId } = params;

  assertMonthNotClosed(db, monthKey);

  if (amount <= 0) {
    throw new Error('Số tiền nộp phải lớn hơn 0.');
  }

  const member = db.prepare('SELECT full_name FROM members WHERE id = ?').get(memberId) as { full_name: string } | undefined;
  if (!member) {
    throw new Error('Thành viên không tồn tại.');
  }

  const roundedAmount = roundupToThousand(amount);

  const existingTx = db
    .prepare("SELECT * FROM income_transactions WHERE member_id = ? AND month_key = ? AND category = 'OTHER_INCOME' AND is_void = 0")
    .get(memberId, monthKey) as any;

  if (existingTx) {
    db.prepare(`
      UPDATE income_transactions
      SET original_amount = ?, rounded_amount = ?, transaction_date = ?, payment_method = ?
      WHERE id = ?
    `).run(amount, roundedAmount, transactionDate, paymentMethod, existingTx.id);

    return {
      incomeTransactionId: existingTx.id,
      amount: roundedAmount
    };
  } else {
    const incTxId = 'inc_mid_' + Math.random().toString(36).substring(2, 10);

    db.prepare(`
      INSERT INTO income_transactions (
        id, transaction_date, month_key, category, description, member_id, original_amount, rounded_amount,
        payment_method, is_void, created_by
      ) VALUES (?, ?, ?, 'OTHER_INCOME', ?, ?, ?, ?, ?, 0, ?)
    `).run(
      incTxId,
      transactionDate,
      monthKey,
      `Thu phí thành viên gia nhập giữa tháng - ${member.full_name}`,
      memberId,
      amount,
      roundedAmount,
      paymentMethod,
      userId || null
    );

    return {
      incomeTransactionId: incTxId,
      amount: roundedAmount
    };
  }
}

/**
 * Records an other expense transaction.
 */
export function recordOtherExpense(
  dbInstance: DatabaseType | undefined,
  params: OtherExpenseParams
): { expenseTransactionId: string; amount: number } {
  const db = dbInstance || defaultDb;
  const { transactionDate, monthKey, description, recipient, amount, paymentMethod = 'BANK_TRANSFER', notes, userId } = params;

  assertMonthNotClosed(db, monthKey);

  if (amount === undefined || amount === null || typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || amount <= 0) {
    throw new Error('Số tiền chi phải là số dương lớn hơn 0.');
  }

  const roundedAmount = amount; // Exact amount entered by Admin (NO ROUNDING)
  const expTxId = 'exp_oth_' + Math.random().toString(36).substring(2, 10);

  db.prepare(`
    INSERT INTO expense_transactions (
      id, transaction_date, month_key, category, description, recipient, original_amount, rounded_amount,
      payment_method, reference_type, is_void, created_by
    ) VALUES (?, ?, ?, 'OTHER_EXPENSE', ?, ?, ?, ?, ?, 'MANUAL', 0, ?)
  `).run(
    expTxId,
    transactionDate,
    monthKey,
    description,
    recipient || 'Người nhận',
    amount,
    roundedAmount,
    paymentMethod,
    userId || null
  );

  return {
    expenseTransactionId: expTxId,
    amount: roundedAmount
  };
}

/**
 * Voids a transaction (income or expense). Voided transactions are excluded from Cash Ledger totals.
 */
export function voidTransaction(
  dbInstance: DatabaseType | undefined,
  type: 'INCOME' | 'EXPENSE',
  transactionId: string,
  userId?: string
): void {
  const db = dbInstance || defaultDb;

  if (type === 'INCOME') {
    const tx = db.prepare('SELECT * FROM income_transactions WHERE id = ?').get(transactionId) as any;
    if (!tx) throw new Error('Giao dịch thu không tồn tại.');
    assertMonthNotClosed(db, tx.month_key);

    db.prepare('UPDATE income_transactions SET is_void = 1 WHERE id = ?').run(transactionId);
  } else {
    const tx = db.prepare('SELECT * FROM expense_transactions WHERE id = ?').get(transactionId) as any;
    if (!tx) throw new Error('Giao dịch chi không tồn tại.');
    assertMonthNotClosed(db, tx.month_key);

    db.prepare('UPDATE expense_transactions SET is_void = 1 WHERE id = ?').run(transactionId);
  }

  // Audit Log
  const auditId = 'audit_' + Math.random().toString(36).substring(2, 10);
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, module, record_id, new_value_json)
    VALUES (?, ?, 'VOID', 'TRANSACTIONS', ?, ?)
  `).run(auditId, userId || null, transactionId, JSON.stringify({ is_void: 1, type }));
}

/**
 * Calculates Cash Ledger Summary for a month.
 * Dynamically aggregates from income_transactions & expense_transactions (is_void = 0).
 * Implements CARRY FORWARD:
 * Opening Balance = Cumulative Income (< monthKey) - Cumulative Expense (< monthKey)
 * Net Month Balance = Total Income (monthKey) - Total Expense (monthKey)
 * Ending Balance = Opening Balance + Net Month Balance
 */
export function getCashLedgerSummary(dbInstance: DatabaseType | undefined, monthKey: string): CashLedgerSummary {
  const db = dbInstance || defaultDb;

  // 1. Calculate Opening Balance from all previous months (< monthKey)
  const prevIncomeRes = db
    .prepare("SELECT COALESCE(SUM(rounded_amount), 0) AS total FROM income_transactions WHERE month_key < ? AND is_void = 0")
    .get(monthKey) as { total: number };

  const prevExpenseRes = db
    .prepare("SELECT COALESCE(SUM(rounded_amount), 0) AS total FROM expense_transactions WHERE month_key < ? AND is_void = 0")
    .get(monthKey) as { total: number };

  const openingBalance = (prevIncomeRes ? prevIncomeRes.total : 0) - (prevExpenseRes ? prevExpenseRes.total : 0);

  // 2. Aggregate current month valid incomes (is_void = 0)
  const incomeCatRes = db
    .prepare(`
      SELECT category, COALESCE(SUM(rounded_amount), 0) AS total
      FROM income_transactions
      WHERE month_key = ? AND is_void = 0
      GROUP BY category
    `)
    .all(monthKey) as { category: string; total: number }[];

  let fixedFundInc = 0;
  let visitorFeeInc = 0;
  let otherInc = 0;

  incomeCatRes.forEach((row) => {
    if (row.category === 'FIXED_FUND') fixedFundInc = row.total;
    else if (row.category === 'VISITOR_FEE') visitorFeeInc = row.total;
    else if (row.category === 'OTHER_INCOME') otherInc = row.total;
  });

  const totalIncome = fixedFundInc + visitorFeeInc + otherInc;

  // 3. Aggregate current month valid expenses (is_void = 0)
  const expenseCatRes = db
    .prepare(`
      SELECT category, COALESCE(SUM(rounded_amount), 0) AS total
      FROM expense_transactions
      WHERE month_key = ? AND is_void = 0
      GROUP BY category
    `)
    .all(monthKey) as { category: string; total: number }[];

  let courtFeeExp = 0;
  let shuttlePurExp = 0;
  let otherExp = 0;

  expenseCatRes.forEach((row) => {
    if (row.category === 'COURT_FEE') courtFeeExp = row.total;
    else if (row.category === 'SHUTTLE_PURCHASE') shuttlePurExp = row.total;
    else if (row.category === 'OTHER_EXPENSE') otherExp = row.total;
  });

  const totalExpense = courtFeeExp + shuttlePurExp + otherExp;

  // 4. Compute Net Month Balance & Ending Balance
  const netMonthBalance = totalIncome - totalExpense;
  const endingBalance = openingBalance + netMonthBalance;

  let balanceStatus: 'POSITIVE' | 'NEGATIVE' | 'ZERO' = 'ZERO';
  if (endingBalance > 0) balanceStatus = 'POSITIVE';
  else if (endingBalance < 0) balanceStatus = 'NEGATIVE';

  return {
    month_key: monthKey,
    opening_balance: openingBalance,
    total_income: totalIncome,
    total_expense: totalExpense,
    net_month_balance: netMonthBalance,
    ending_balance: endingBalance,
    balance_status: balanceStatus,
    income_breakdown: {
      fixed_fund: fixedFundInc,
      visitor_fee: visitorFeeInc,
      other_income: otherInc
    },
    expense_breakdown: {
      court_fee: courtFeeExp,
      shuttle_purchase: shuttlePurExp,
      other_expense: otherExp
    }
  };
}

/**
 * Calculates Inventory Carry Forward for a month.
 * Opening Stock = SUM(quantity_in_pieces) (< monthKey)
 * Imported Stock = SUM(quantity_in_pieces > 0) (= monthKey)
 * Used Stock = SUM(ABS(quantity_in_pieces < 0)) (= monthKey)
 * Closing Stock = Opening Stock + Imported Stock - Used Stock
 */
export function getInventoryCarryForward(
  dbInstance: DatabaseType | undefined,
  monthKey: string,
  productId: string = 'prod_tc77'
) {
  const db = dbInstance || defaultDb;

  const prevStockRes = db
    .prepare('SELECT COALESCE(SUM(quantity_in_pieces), 0) AS total FROM inventory_transactions WHERE month_key < ? AND product_id = ?')
    .get(monthKey, productId) as { total: number };

  const openingStockPieces = prevStockRes ? prevStockRes.total : 0;

  const currentMonthImportRes = db
    .prepare('SELECT COALESCE(SUM(quantity_in_pieces), 0) AS total FROM inventory_transactions WHERE month_key = ? AND product_id = ? AND quantity_in_pieces > 0')
    .get(monthKey, productId) as { total: number };

  const importedPieces = currentMonthImportRes ? currentMonthImportRes.total : 0;

  const currentMonthUsedRes = db
    .prepare('SELECT COALESCE(SUM(ABS(quantity_in_pieces)), 0) AS total FROM inventory_transactions WHERE month_key = ? AND product_id = ? AND quantity_in_pieces < 0')
    .get(monthKey, productId) as { total: number };

  const usedPieces = currentMonthUsedRes ? currentMonthUsedRes.total : 0;

  const closingStockPieces = openingStockPieces + importedPieces - usedPieces;

  return {
    month_key: monthKey,
    product_id: productId,
    opening_stock_pieces: openingStockPieces,
    opening_stock_formatted: formatStockDisplay(openingStockPieces),
    imported_pieces: importedPieces,
    imported_formatted: formatStockDisplay(importedPieces),
    used_pieces: usedPieces,
    used_formatted: formatStockDisplay(usedPieces),
    closing_stock_pieces: closingStockPieces,
    closing_stock_formatted: formatStockDisplay(closingStockPieces)
  };
}

export interface VisitorFeeIncomeParams {
  transactionDate: string;
  monthKey: string;
  payerName?: string;
  amount: number;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER';
  notes?: string;
  userId?: string;
}

/**
 * Records a manual Visitor Fee Income transaction (Phiếu thu phí vãng lai).
 * Preserves EXACT entered amount without rounding.
 */
export function recordVisitorFeeManualIncome(
  dbInstance: DatabaseType | undefined,
  params: VisitorFeeIncomeParams
): { incomeTransactionId: string; amount: number } {
  const db = dbInstance || defaultDb;
  const { transactionDate, monthKey, payerName, amount, paymentMethod = 'CASH', notes, userId } = params;

  assertMonthNotClosed(db, monthKey);

  if (amount === undefined || amount === null || typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || amount <= 0) {
    throw new Error('Số tiền nộp phải là số dương lớn hơn 0.');
  }

  const incTxId = 'inc_vis_' + Math.random().toString(36).substring(2, 10);
  const description = payerName && payerName.trim() ? `Thu phí vãng lai - ${payerName.trim()}` : 'Thu phí vãng lai';

  db.prepare(`
    INSERT INTO income_transactions (
      id, transaction_date, month_key, category, description, original_amount, rounded_amount,
      payment_method, is_void, created_by
    ) VALUES (?, ?, ?, 'VISITOR_FEE', ?, ?, ?, ?, 0, ?)
  `).run(
    incTxId,
    transactionDate,
    monthKey,
    description,
    amount,
    amount, // Exact amount without rounding
    paymentMethod,
    userId || null
  );

  return {
    incomeTransactionId: incTxId,
    amount
  };
}

export interface OtherIncomeParams {
  transactionDate: string;
  monthKey: string;
  description: string;
  source?: string;
  amount: number;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER';
  notes?: string;
  userId?: string;
}

/**
 * Records a manual Other Income transaction (Phiếu thu khác).
 * Preserves EXACT entered amount without rounding.
 */
export function recordOtherIncome(
  dbInstance: DatabaseType | undefined,
  params: OtherIncomeParams
): { incomeTransactionId: string; amount: number } {
  const db = dbInstance || defaultDb;
  const { transactionDate, monthKey, description, source, amount, paymentMethod = 'BANK_TRANSFER', notes, userId } = params;

  assertMonthNotClosed(db, monthKey);

  if (!description || !description.trim()) {
    throw new Error('Nội dung thu khác không được để trống.');
  }

  if (amount === undefined || amount === null || typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || amount <= 0) {
    throw new Error('Số tiền thu phải là số dương lớn hơn 0.');
  }

  const incTxId = 'inc_oth_' + Math.random().toString(36).substring(2, 10);
  const fullDesc = source && source.trim() ? `${description.trim()} (${source.trim()})` : description.trim();

  db.prepare(`
    INSERT INTO income_transactions (
      id, transaction_date, month_key, category, description, original_amount, rounded_amount,
      payment_method, is_void, created_by
    ) VALUES (?, ?, ?, 'OTHER_INCOME', ?, ?, ?, ?, 0, ?)
  `).run(
    incTxId,
    transactionDate,
    monthKey,
    fullDesc,
    amount,
    amount, // Exact amount without rounding
    paymentMethod,
    userId || null
  );

  return {
    incomeTransactionId: incTxId,
    amount
  };
}

export interface TransactionHistoryParams {
  monthKey?: string;
  type?: 'ALL' | 'INCOME' | 'EXPENSE';
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface TransactionHistoryItem {
  id: string;
  date: string;
  monthKey: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  categoryLabel: string;
  description: string;
  payerOrRecipient: string;
  incomeAmount: number;
  expenseAmount: number;
  paymentMethod: string;
  reference: string;
  createdBy: string;
  createdAt: string;
}

export interface TransactionHistoryResult {
  items: TransactionHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  summary: {
    totalIncome: number;
    totalExpense: number;
  };
}

/**
 * Fetches unified financial transaction history across both income_transactions & expense_transactions.
 */
export function getTransactionHistory(
  dbInstance: DatabaseType | undefined,
  params: TransactionHistoryParams
): TransactionHistoryResult {
  const db = dbInstance || defaultDb;
  const { monthKey, type = 'ALL', category = 'ALL', search = '', page = 1, limit = 50 } = params;

  let query = `
    SELECT * FROM (
      SELECT
        it.id AS id,
        it.transaction_date AS date,
        it.month_key AS monthKey,
        'INCOME' AS type,
        it.category AS category,
        it.description AS description,
        COALESCE(m.full_name, 'Khách / Khác') AS payerOrRecipient,
        it.rounded_amount AS incomeAmount,
        0 AS expenseAmount,
        it.payment_method AS paymentMethod,
        COALESCE(it.payment_id, it.id) AS reference,
        COALESCE(u.username, 'Hệ thống') AS createdBy,
        it.created_at AS createdAt
      FROM income_transactions it
      LEFT JOIN members m ON it.member_id = m.id
      LEFT JOIN users u ON it.created_by = u.id
      WHERE it.is_void = 0

      UNION ALL

      SELECT
        et.id AS id,
        et.transaction_date AS date,
        et.month_key AS monthKey,
        'EXPENSE' AS type,
        et.category AS category,
        et.description AS description,
        COALESCE(et.recipient, 'Người nhận') AS payerOrRecipient,
        0 AS incomeAmount,
        et.rounded_amount AS expenseAmount,
        et.payment_method AS paymentMethod,
        COALESCE(et.reference_id, et.id) AS reference,
        COALESCE(u.username, 'Hệ thống') AS createdBy,
        et.created_at AS createdAt
      FROM expense_transactions et
      LEFT JOIN users u ON et.created_by = u.id
      WHERE et.is_void = 0
    ) AS history
    WHERE 1=1
  `;

  const queryParams: any[] = [];

  if (monthKey && monthKey.trim()) {
    query += ` AND monthKey = ?`;
    queryParams.push(monthKey.trim());
  }

  if (type && type !== 'ALL') {
    query += ` AND type = ?`;
    queryParams.push(type.trim());
  }

  if (category && category !== 'ALL') {
    query += ` AND category = ?`;
    queryParams.push(category.trim());
  }

  if (search && search.trim()) {
    query += ` AND (description LIKE ? OR payerOrRecipient LIKE ? OR category LIKE ?)`;
    const searchPattern = `%${search.trim()}%`;
    queryParams.push(searchPattern, searchPattern, searchPattern);
  }

  // Count total items & sums
  const countSql = `SELECT COUNT(*) as total, COALESCE(SUM(incomeAmount), 0) as totalIncome, COALESCE(SUM(expenseAmount), 0) as totalExpense FROM (${query})`;
  const countRow = db.prepare(countSql).get(...queryParams) as { total: number; totalIncome: number; totalExpense: number };
  const totalItems = countRow ? countRow.total : 0;
  const totalIncome = countRow ? countRow.totalIncome : 0;
  const totalExpense = countRow ? countRow.totalExpense : 0;

  // Pagination
  const validPage = Math.max(1, page);
  const validLimit = Math.max(1, Math.min(200, limit));
  const offset = (validPage - 1) * validLimit;

  query += ` ORDER BY date DESC, createdAt DESC LIMIT ? OFFSET ?`;
  queryParams.push(validLimit, offset);

  const rawItems = db.prepare(query).all(...queryParams) as any[];

  const categoryLabels: Record<string, string> = {
    FIXED_FUND: 'Phí thành viên',
    VISITOR_FEE: 'Phí vãng lai',
    OTHER_INCOME: 'Thu khác',
    COURT_FEE: 'Phí sân',
    SHUTTLE_PURCHASE: 'Mua cầu',
    OTHER_EXPENSE: 'Chi khác'
  };

  const items: TransactionHistoryItem[] = rawItems.map((item) => ({
    id: item.id,
    date: item.date,
    monthKey: item.monthKey,
    type: item.type,
    category: item.category,
    categoryLabel: categoryLabels[item.category] || item.category,
    description: item.description,
    payerOrRecipient: item.payerOrRecipient,
    incomeAmount: item.incomeAmount,
    expenseAmount: item.expenseAmount,
    paymentMethod: item.paymentMethod,
    reference: item.reference,
    createdBy: item.createdBy,
    createdAt: item.createdAt
  }));

  const totalPages = Math.ceil(totalItems / validLimit) || 1;

  return {
    items,
    pagination: {
      page: validPage,
      limit: validLimit,
      totalItems,
      totalPages
    },
    summary: {
      totalIncome,
      totalExpense
    }
  };
}
