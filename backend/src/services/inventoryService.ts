import { Database as DatabaseType } from 'better-sqlite3';
import { defaultDb } from '../database/db';
import { assertMonthNotClosed } from './feeEngine';

export interface StockSummary {
  product_id: string;
  product_code: string;
  product_name: string;
  pieces_per_tube: number;
  total_pieces: number;
  tubes_formatted: string;
}

/**
 * Calculates current inventory stock from `inventory_transactions` (SOURCE OF TRUTH).
 */
export function getCurrentStockInPieces(dbInstance?: DatabaseType, productId: string = 'prod_tc77'): number {
  const db = dbInstance || defaultDb;
  const result = db.prepare(`
    SELECT COALESCE(SUM(quantity_in_pieces), 0) AS total_pieces
    FROM inventory_transactions
    WHERE product_id = ?
  `).get(productId) as { total_pieces: number };

  return result ? result.total_pieces : 0;
}

/**
 * Formats total pieces into "X ống + Y trái" format.
 */
export function formatStockDisplay(totalPieces: number, piecesPerTube: number = 12): string {
  if (totalPieces <= 0) return '0 ống + 0 trái';
  const tubes = Math.floor(totalPieces / piecesPerTube);
  const remainingPieces = totalPieces % piecesPerTube;
  if (tubes === 0) return `${remainingPieces} trái`;
  if (remainingPieces === 0) return `${tubes} ống`;
  return `${tubes} ống + ${remainingPieces} trái`;
}

/**
 * Gets stock summary for all products or a specific product.
 */
export function getStockSummary(dbInstance?: DatabaseType, productId: string = 'prod_tc77'): StockSummary {
  const db = dbInstance || defaultDb;
  const product = db.prepare('SELECT * FROM inventory_products WHERE id = ?').get(productId) as any;
  if (!product) {
    throw new Error(`Sản phẩm kho với ID '${productId}' không tồn tại.`);
  }

  const totalPieces = getCurrentStockInPieces(db, productId);
  const formatted = formatStockDisplay(totalPieces, product.pieces_per_tube);

  return {
    product_id: product.id,
    product_code: product.code,
    product_name: product.name,
    pieces_per_tube: product.pieces_per_tube,
    total_pieces: totalPieces,
    tubes_formatted: formatted
  };
}

/**
 * Updates shuttle usage for a playing session and synchronizes with `inventory_transactions`.
 * Delta = newShuttleUsed - oldShuttleUsed
 */
export function recordSessionShuttleUsage(
  dbInstance: DatabaseType | undefined,
  sessionId: string,
  newShuttleUsed: number,
  userId?: string,
  productId: string = 'prod_tc77'
): { oldShuttleUsed: number; newShuttleUsed: number; delta: number; currentStock: number } {
  const db = dbInstance || defaultDb;

  if (newShuttleUsed < 0) {
    throw new Error('Số cầu sử dụng không được là số âm.');
  }

  const session = db.prepare('SELECT * FROM playing_sessions WHERE id = ?').get(sessionId) as any;
  if (!session) {
    throw new Error('Buổi chơi không tồn tại.');
  }

  if (session.status === 'CANCELLED') {
    throw new Error('Không thể cập nhật số cầu cho buổi chơi đã HỦY (CANCELLED).');
  }

  const oldShuttleUsed = session.shuttle_used || 0;
  const delta = newShuttleUsed - oldShuttleUsed;

  if (delta === 0) {
    return {
      oldShuttleUsed,
      newShuttleUsed,
      delta: 0,
      currentStock: getCurrentStockInPieces(db, productId)
    };
  }

  const currentStock = getCurrentStockInPieces(db, productId);

  // If delta > 0, we need more shuttles (USAGE)
  if (delta > 0) {
    if (currentStock < delta) {
      throw new Error(`Tồn kho không đủ để xuất cầu (Tồn hiện tại: ${currentStock} trái, cần thêm: ${delta} trái).`);
    }

    const txId = 'inv_tx_' + Math.random().toString(36).substring(2, 10);
    db.prepare(`
      INSERT INTO inventory_transactions (
        id, transaction_date, month_key, product_id, transaction_type,
        quantity_in_pieces, reference_type, reference_id, notes, created_by
      ) VALUES (?, ?, ?, ?, 'USAGE', ?, 'PLAYING_SESSION', ?, ?, ?)
    `).run(
      txId,
      session.session_date,
      session.month_key,
      productId,
      -delta, // USAGE is negative
      sessionId,
      `Sử dụng cầu buổi chơi ngày ${session.session_date} (Tăng thêm ${delta} trái)`,
      userId || null
    );
  } else {
    // If delta < 0, we refund shuttles (REFUND)
    const refundPieces = Math.abs(delta);
    const txId = 'inv_tx_' + Math.random().toString(36).substring(2, 10);
    db.prepare(`
      INSERT INTO inventory_transactions (
        id, transaction_date, month_key, product_id, transaction_type,
        quantity_in_pieces, reference_type, reference_id, notes, created_by
      ) VALUES (?, ?, ?, ?, 'REFUND', ?, 'PLAYING_SESSION', ?, ?, ?)
    `).run(
      txId,
      session.session_date,
      session.month_key,
      productId,
      refundPieces, // REFUND is positive
      sessionId,
      `Hoàn trả cầu buổi chơi ngày ${session.session_date} (Giảm ${refundPieces} trái)`,
      userId || null
    );
  }

  // Update shuttle_used on playing_sessions
  db.prepare(`
    UPDATE playing_sessions
    SET shuttle_used = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newShuttleUsed, userId || null, sessionId);

  const newStock = getCurrentStockInPieces(db, productId);

  return {
    oldShuttleUsed,
    newShuttleUsed,
    delta,
    currentStock: newStock
  };
}

/**
 * Cancels a playing session and refunds all used shuttles back to inventory.
 */
export function cancelPlayingSession(
  dbInstance: DatabaseType | undefined,
  sessionId: string,
  userId?: string,
  productId: string = 'prod_tc77'
): { refundedPieces: number; newStock: number } {
  const db = dbInstance || defaultDb;

  const session = db.prepare('SELECT * FROM playing_sessions WHERE id = ?').get(sessionId) as any;
  if (!session) {
    throw new Error('Buổi chơi không tồn tại.');
  }

  if (session.status === 'CANCELLED') {
    const currentStock = getCurrentStockInPieces(db, productId);
    return { refundedPieces: 0, newStock: currentStock };
  }

  const shuttlesToRefund = session.shuttle_used || 0;

  if (shuttlesToRefund > 0) {
    const txId = 'inv_tx_' + Math.random().toString(36).substring(2, 10);
    db.prepare(`
      INSERT INTO inventory_transactions (
        id, transaction_date, month_key, product_id, transaction_type,
        quantity_in_pieces, reference_type, reference_id, notes, created_by
      ) VALUES (?, ?, ?, ?, 'REFUND', ?, 'PLAYING_SESSION', ?, ?, ?)
    `).run(
      txId,
      session.session_date,
      session.month_key,
      productId,
      shuttlesToRefund, // REFUND is positive
      sessionId,
      `Hoàn kho do HỦY buổi chơi ngày ${session.session_date} (Hoàn trả ${shuttlesToRefund} trái)`,
      userId || null
    );
  }

  // Update session status to CANCELLED
  db.prepare(`
    UPDATE playing_sessions
    SET status = 'CANCELLED', updated_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(userId || null, sessionId);

  // Write Audit Log
  const auditId = 'audit_' + Math.random().toString(36).substring(2, 10);
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, module, record_id, old_value_json, new_value_json)
    VALUES (?, ?, 'CANCEL', 'SESSIONS', ?, ?, ?)
  `).run(
    auditId,
    userId || null,
    sessionId,
    JSON.stringify({ status: session.status, shuttle_used: session.shuttle_used }),
    JSON.stringify({ status: 'CANCELLED', refunded_shuttles: shuttlesToRefund })
  );

  const newStock = getCurrentStockInPieces(db, productId);

  return {
    refundedPieces: shuttlesToRefund,
    newStock
  };
}

/**
 * Manual Stock Receipt (Nhập kho thủ công).
 * Does NOT create Expense Transaction.
 */
export function manualStockReceipt(
  dbInstance: DatabaseType | undefined,
  params: {
    productId?: string;
    tubesQty?: number;
    piecesQty?: number;
    date: string;
    supplier?: string;
    notes?: string;
    userId?: string;
  }
) {
  const db = dbInstance || defaultDb;
  const { productId = 'prod_tc77', tubesQty = 0, piecesQty = 0, date, supplier, notes, userId } = params;

  const monthKey = date.substring(0, 7);
  assertMonthNotClosed(db, monthKey);

  const product = db.prepare('SELECT * FROM inventory_products WHERE id = ?').get(productId) as any;
  if (!product) throw new Error(`Sản phẩm kho '${productId}' không tồn tại.`);

  const piecesPerTube = product.pieces_per_tube || 12;
  const totalPieces = (tubesQty * piecesPerTube) + piecesQty;

  if (totalPieces <= 0) {
    throw new Error('Số lượng nhập kho phải lớn hơn 0.');
  }

  const txId = 'inv_man_rec_' + Math.random().toString(36).substring(2, 10);
  const noteStr = notes || (supplier ? `Nhập kho thủ công từ ${supplier}` : 'Nhập kho thủ công');

  db.prepare(`
    INSERT INTO inventory_transactions (
      id, transaction_date, month_key, product_id, transaction_type, quantity_in_pieces,
      reference_type, notes, created_by
    ) VALUES (?, ?, ?, ?, 'RECEIPT', ?, 'MANUAL', ?, ?)
  `).run(txId, date, monthKey, productId, totalPieces, noteStr, userId || null);

  const newStock = getCurrentStockInPieces(db, productId);
  return {
    transactionId: txId,
    piecesAdded: totalPieces,
    formattedAdded: formatStockDisplay(totalPieces, piecesPerTube),
    newStock,
    formattedStock: formatStockDisplay(newStock, piecesPerTube)
  };
}

/**
 * Manual Stock Issue (Xuất kho thủ công).
 * Quantity must be <= current stock. Does NOT create Expense Transaction.
 */
export function manualStockIssue(
  dbInstance: DatabaseType | undefined,
  params: {
    productId?: string;
    tubesQty?: number;
    piecesQty?: number;
    date: string;
    reason?: string;
    notes?: string;
    userId?: string;
  }
) {
  const db = dbInstance || defaultDb;
  const { productId = 'prod_tc77', tubesQty = 0, piecesQty = 0, date, reason, notes, userId } = params;

  const monthKey = date.substring(0, 7);
  assertMonthNotClosed(db, monthKey);

  const product = db.prepare('SELECT * FROM inventory_products WHERE id = ?').get(productId) as any;
  if (!product) throw new Error(`Sản phẩm kho '${productId}' không tồn tại.`);

  const piecesPerTube = product.pieces_per_tube || 12;
  const totalPiecesToIssue = (tubesQty * piecesPerTube) + piecesQty;

  if (totalPiecesToIssue <= 0) {
    throw new Error('Số lượng xuất kho phải lớn hơn 0.');
  }

  const currentStock = getCurrentStockInPieces(db, productId);
  if (currentStock < totalPiecesToIssue) {
    throw new Error(`Tồn kho không đủ để xuất (Tồn hiện tại: ${formatStockDisplay(currentStock, piecesPerTube)}, Yêu cầu: ${formatStockDisplay(totalPiecesToIssue, piecesPerTube)}).`);
  }

  const txId = 'inv_man_iss_' + Math.random().toString(36).substring(2, 10);
  const noteStr = notes || (reason ? `Xuất kho thủ công: ${reason}` : 'Xuất kho thủ công');

  db.prepare(`
    INSERT INTO inventory_transactions (
      id, transaction_date, month_key, product_id, transaction_type, quantity_in_pieces,
      reference_type, notes, created_by
    ) VALUES (?, ?, ?, ?, 'USAGE', ?, 'MANUAL', ?, ?)
  `).run(txId, date, monthKey, productId, -totalPiecesToIssue, noteStr, userId || null);

  const newStock = getCurrentStockInPieces(db, productId);
  return {
    transactionId: txId,
    piecesDeducted: totalPiecesToIssue,
    formattedDeducted: formatStockDisplay(totalPiecesToIssue, piecesPerTube),
    newStock,
    formattedStock: formatStockDisplay(newStock, piecesPerTube)
  };
}

/**
 * Manual Stock Adjustment (Điều chỉnh tồn kho thủ công).
 * Reason is REQUIRED.
 */
export function manualStockAdjustment(
  dbInstance: DatabaseType | undefined,
  params: {
    productId?: string;
    adjustmentType: 'INCREASE' | 'DECREASE';
    quantityInPieces: number;
    date: string;
    reason: string;
    notes?: string;
    userId?: string;
  }
) {
  const db = dbInstance || defaultDb;
  const { productId = 'prod_tc77', adjustmentType, quantityInPieces, date, reason, notes, userId } = params;

  if (!reason || reason.trim() === '') {
    throw new Error('Lý do điều chỉnh tồn kho là bắt buộc.');
  }

  if (quantityInPieces <= 0) {
    throw new Error('Số lượng điều chỉnh phải lớn hơn 0.');
  }

  const monthKey = date.substring(0, 7);
  assertMonthNotClosed(db, monthKey);

  const product = db.prepare('SELECT * FROM inventory_products WHERE id = ?').get(productId) as any;
  if (!product) throw new Error(`Sản phẩm kho '${productId}' không tồn tại.`);

  const piecesPerTube = product.pieces_per_tube || 12;

  const currentStock = getCurrentStockInPieces(db, productId);
  let deltaPieces = quantityInPieces;

  if (adjustmentType === 'DECREASE') {
    if (currentStock < quantityInPieces) {
      throw new Error(`Tồn kho không đủ để điều chỉnh giảm (Tồn hiện tại: ${formatStockDisplay(currentStock, piecesPerTube)}, Giảm: ${formatStockDisplay(quantityInPieces, piecesPerTube)}).`);
    }
    deltaPieces = -quantityInPieces;
  }

  const txId = 'inv_man_adj_' + Math.random().toString(36).substring(2, 10);
  const noteStr = `Điều chỉnh ${adjustmentType === 'INCREASE' ? 'TĂNG' : 'GIẢM'} kho: ${reason}${notes ? ` (${notes})` : ''}`;

  db.prepare(`
    INSERT INTO inventory_transactions (
      id, transaction_date, month_key, product_id, transaction_type, quantity_in_pieces,
      reference_type, notes, created_by
    ) VALUES (?, ?, ?, ?, 'ADJUSTMENT', ?, 'MANUAL', ?, ?)
  `).run(txId, date, monthKey, productId, deltaPieces, noteStr, userId || null);

  const newStock = getCurrentStockInPieces(db, productId);
  return {
    transactionId: txId,
    adjustmentType,
    deltaPieces,
    newStock,
    formattedStock: formatStockDisplay(newStock, piecesPerTube)
  };
}

/**
 * Gets inventory transaction history list.
 */
export function getInventoryTransactionsList(
  dbInstance?: DatabaseType,
  filters?: { monthKey?: string; productId?: string; transactionType?: string }
) {
  const db = dbInstance || defaultDb;
  let query = 'SELECT it.*, p.name AS product_name, p.code AS product_code FROM inventory_transactions it JOIN inventory_products p ON it.product_id = p.id WHERE 1=1';
  const params: any[] = [];

  if (filters?.monthKey) {
    query += ' AND it.month_key = ?';
    params.push(filters.monthKey);
  }
  if (filters?.productId) {
    query += ' AND it.product_id = ?';
    params.push(filters.productId);
  }
  if (filters?.transactionType) {
    query += ' AND it.transaction_type = ?';
    params.push(filters.transactionType);
  }

  query += ' ORDER BY it.transaction_date DESC, it.created_at DESC';

  return db.prepare(query).all(...params);
}
