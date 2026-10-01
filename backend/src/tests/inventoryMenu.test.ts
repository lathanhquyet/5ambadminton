import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runSeed } from '../database/seed';
import { runMigrations } from '../database/migrate';
import { getCurrentStockInPieces, formatStockDisplay, getInventoryTransactionsList } from '../services/inventoryService';

describe('INVENTORY MENU & MANUAL MOVEMENTS MANDATORY TEST SUITE', () => {
  let db: ReturnType<typeof Database>;
  let app: any;
  let adminToken: string;

  beforeAll(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    await runSeed(db);
    app = createApp(db);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    adminToken = loginRes.body.data.access_token;
  });

  afterAll(() => {
    if (db) db.close();
  });

  test('TEST 0: Seed synchronizes legacy default shuttle name', async () => {
    const legacyDb = new Database(':memory:');
    legacyDb.pragma('foreign_keys = ON');
    runMigrations(legacyDb);

    legacyDb.prepare(`
      INSERT INTO inventory_products (id, code, name, pieces_per_tube, min_stock_alert, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('prod_tc77', 'SHUTTLE_TC77', 'Cầu Thành Công 77', 12, 24, 'Cầu thi đấu chính thức');

    await runSeed(legacyDb);

    const product = legacyDb.prepare("SELECT name FROM inventory_products WHERE code = 'SHUTTLE_TC77'").get() as { name: string };
    expect(product.name).toBe('Cầu Vina Star');

    legacyDb.close();
  });

  test('TEST 1: Manual Stock Receipt (Nhập kho thủ công)', async () => {
    const stockBefore = getCurrentStockInPieces(db, 'prod_tc77');

    const res = await request(app)
      .post('/api/v1/inventory/receipt')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        date: '2026-09-05',
        tubes_qty: 5,
        pieces_qty: 2,
        supplier: 'Nhà cung cấp Y',
        notes: 'Nhập thủ công'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.piecesAdded).toBe(62); // 5 * 12 + 2 = 62

    const stockAfter = getCurrentStockInPieces(db, 'prod_tc77');
    expect(stockAfter).toBe(stockBefore + 62);
  });

  test('TEST 2: Manual Stock Issue (Xuất kho thủ công)', async () => {
    const stockBefore = getCurrentStockInPieces(db, 'prod_tc77');

    const res = await request(app)
      .post('/api/v1/inventory/issue')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        date: '2026-09-06',
        tubes_qty: 1,
        pieces_qty: 0,
        reason: 'Xuất dùng tập giao hữu'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.piecesDeducted).toBe(12);

    const stockAfter = getCurrentStockInPieces(db, 'prod_tc77');
    expect(stockAfter).toBe(stockBefore - 12);
  });

  test('TEST 3: Manual Stock Issue > Stock must fail with error', async () => {
    const currentStock = getCurrentStockInPieces(db, 'prod_tc77');

    const res = await request(app)
      .post('/api/v1/inventory/issue')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        date: '2026-09-07',
        tubes_qty: 100, // Exceeds current stock
        reason: 'Xuất quá số lượng tồn'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Tồn kho không đủ');
  });

  test('TEST 4: Stock Adjustment without Reason must fail', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/adjustment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        date: '2026-09-08',
        adjustment_type: 'DECREASE',
        quantity_in_pieces: 3,
        reason: '' // Empty reason
      });

    expect(res.status).toBe(400);
  });

  test('TEST 5: Valid Stock Adjustment INCREASE & DECREASE', async () => {
    const stockBefore = getCurrentStockInPieces(db, 'prod_tc77');

    // Increase
    const incRes = await request(app)
      .post('/api/v1/inventory/adjustment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        date: '2026-09-08',
        adjustment_type: 'INCREASE',
        quantity_in_pieces: 6,
        reason: 'Kiểm kê định kỳ phát hiện dư 6 trái'
      });

    expect(incRes.status).toBe(201);
    expect(getCurrentStockInPieces(db, 'prod_tc77')).toBe(stockBefore + 6);

    // Decrease
    const decRes = await request(app)
      .post('/api/v1/inventory/adjustment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        date: '2026-09-08',
        adjustment_type: 'DECREASE',
        quantity_in_pieces: 2,
        reason: 'Phát hiện hỏng 2 trái'
      });

    expect(decRes.status).toBe(201);
    expect(getCurrentStockInPieces(db, 'prod_tc77')).toBe(stockBefore + 4);
  });

  test('TEST 6: Manual Stock Movement on CLOSED Month fails with HTTP 403', async () => {
    const closedMonth = '2026-07';
    db.prepare(`
      INSERT OR REPLACE INTO monthly_closings (id, month_key, status)
      VALUES ('closed_07', ?, 'CLOSED')
    `).run(closedMonth);

    const res = await request(app)
      .post('/api/v1/inventory/receipt')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        date: `${closedMonth}-15`,
        tubes_qty: 2
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('MONTH_CLOSED');
  });

  test('TEST 7: Format Stock Display Utility', () => {
    expect(formatStockDisplay(0, 12)).toBe('0 ống + 0 trái');
    expect(formatStockDisplay(5, 12)).toBe('5 trái');
    expect(formatStockDisplay(12, 12)).toBe('1 ống');
    expect(formatStockDisplay(26, 12)).toBe('2 ống + 2 trái');
  });
});
