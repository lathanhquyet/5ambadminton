import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../app';
import { runMigrations } from '../database/migrate';
import { runSeed } from '../database/seed';
import { calculateMonthlyFixedFees } from '../services/feeEngine';
import { updatePaymentSettings } from '../services/paymentSettingsService';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-5am-badminton';

function generateTestToken(role: 'ADMIN' | 'MEMBER', userId = 'test_user_id') {
  return jwt.sign({ userId, username: 'testuser', role }, JWT_SECRET, { expiresIn: '1h' });
}

describe('Phase 5C — Public Saoke Outstanding Debtors & VietQR Payment Remediation', () => {
  let app: any;
  let db: any;
  let adminToken: string;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    runSeed(db);
    app = createApp(db);

    adminToken = generateTestToken('ADMIN', 'admin_id_01');

    // Configure bank settings for VietQR
    updatePaymentSettings(db, {
      enabled: true,
      bankName: 'MBBank',
      bankBin: '970422',
      accountNumber: '090123456789',
      accountName: 'QUY CAU LONG 5AM'
    });

    // Create fixed members
    db.prepare(`
      INSERT INTO members (id, full_name, phone, member_type, status, days_per_week, joined_date)
      VALUES ('mem_fixed_01', 'A Nguyên', '0901111111', 'FIXED', 'ACTIVE', 3, '2026-01-01'),
             ('mem_fixed_02', 'A Thông', '0902222222', 'FIXED', 'ACTIVE', 3, '2026-01-01')
    `).run();

    // Calculate fixed monthly fees for 2026-10 (460k each)
    calculateMonthlyFixedFees(db, {
      monthKey: '2026-10',
      totalCostToAllocate: 920000,
      calculationMethod: 'EQUAL_SPLIT'
    });

    // Fully pay A Thông's fee
    db.prepare(`
      UPDATE member_fees
      SET paid_amount = 460000, remaining_amount = 0, fee_status = 'PAID'
      WHERE member_id = 'mem_fixed_02' AND month_key = '2026-10'
    `).run();
  });

  it('TEST 1 & TEST 2: Fixed member with remaining > 0 appears, fixed member with remaining = 0 does NOT appear', async () => {
    const res = await request(app).get('/api/v1/public/saoke/debtors?month=2026-10');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const debtors = res.body.data;
    const aNguyen = debtors.find((d: any) => d.memberName === 'A Nguyên');
    const aThong = debtors.find((d: any) => d.memberName === 'A Thông');

    expect(aNguyen).toBeDefined();
    expect(aNguyen.remainingAmount).toBe(460000);
    expect(aNguyen.status).toBe('UNPAID');

    // TEST 2: Fully paid member (A Thông) MUST NOT appear
    expect(aThong).toBeUndefined();
  });

  it('TEST 3 & 6: Visitor with visitor fee > 0 and remaining > 0 appears on public saoke debtors list', async () => {
    // Add visitor to session in 2026-10
    const sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        session_date: '2026-10-01',
        visitor: {
          full_name: 'Anh Thông 3',
          amount: 60000,
          is_paid: false
        }
      });
    expect(sessionRes.status).toBe(201);

    const res = await request(app).get('/api/v1/public/saoke/debtors?month=2026-10');

    expect(res.status).toBe(200);
    const debtors = res.body.data;
    const vDebt = debtors.find((d: any) => d.memberName === 'Anh Thông 3');

    expect(vDebt).toBeDefined();
    expect(vDebt.memberType).toBe('VISITOR');
    expect(vDebt.totalFeeRequired).toBe(60000);
    expect(vDebt.paidAmount).toBe(0);
    expect(vDebt.remainingAmount).toBe(60000);
    expect(vDebt.status).toBe('UNPAID');
  });

  it('TEST 4: Visitor with fee = 0 does NOT appear', async () => {
    await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        session_date: '2026-10-02',
        visitor: {
          full_name: 'Dũng Miễn Phí',
          amount: 0,
          is_paid: false
        }
      });

    const res = await request(app).get('/api/v1/public/saoke/debtors?month=2026-10');
    const dung = res.body.data.find((d: any) => d.memberName === 'Dũng Miễn Phí');

    expect(dung).toBeUndefined();
  });

  it('TEST 5: Visitor with fee = 60,000, paid = 60,000, remaining = 0 does NOT appear', async () => {
    await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        session_date: '2026-10-03',
        visitor: {
          full_name: 'Khách Đã Thu 1',
          amount: 60000,
          is_paid: true
        }
      });

    const res = await request(app).get('/api/v1/public/saoke/debtors?month=2026-10');
    const paidVis = res.body.data.find((d: any) => d.memberName === 'Khách Đã Thu 1');

    expect(paidVis).toBeUndefined();
  });

  it('TEST 7: QR amount equals remainingAmount for visitor & fixed member via paymentReference', async () => {
    // 1. Create visitor with 60,000 unpaid
    await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        session_date: '2026-10-04',
        visitor: {
          full_name: 'Khách Vãng Lai QR',
          amount: 60000,
          is_paid: false
        }
      });

    const debtorsRes = await request(app).get('/api/v1/public/saoke/debtors?month=2026-10');
    const vis = debtorsRes.body.data.find((d: any) => d.memberName === 'Khách Vãng Lai QR');
    expect(vis).toBeDefined();

    // 2. Request VietQR via canonical paymentReference
    const qrRes = await request(app)
      .get(`/api/v1/public/payment/qr?month=2026-10&paymentReference=${encodeURIComponent(vis.paymentReference)}`);

    expect(qrRes.status).toBe(200);
    expect(qrRes.body.success).toBe(true);
    expect(qrRes.body.data.amount).toBe(60000); // QR amount equals remainingAmount EXACT
    expect(qrRes.body.data.transferContent).toBe(vis.paymentReference);
  });

  it('TEST 8 & TEST 9: Generating QR creates ZERO financial mutation, ZERO duplicate payment, ZERO duplicate income/ledger', async () => {
    const memberId = 'mem_fixed_01'; // A Nguyên (460k remaining)

    const countIncBefore = db.prepare('SELECT COUNT(*) as cnt FROM income_transactions').get().cnt;
    const countPayBefore = db.prepare('SELECT COUNT(*) as cnt FROM payments').get().cnt;

    // Generate QR multiple times
    for (let i = 0; i < 5; i++) {
      const qrRes = await request(app).get(`/api/v1/public/payment/qr?month=2026-10&memberId=${memberId}`);
      expect(qrRes.status).toBe(200);
    }

    const countIncAfter = db.prepare('SELECT COUNT(*) as cnt FROM income_transactions').get().cnt;
    const countPayAfter = db.prepare('SELECT COUNT(*) as cnt FROM payments').get().cnt;

    expect(countIncAfter).toBe(countIncBefore);
    expect(countPayAfter).toBe(countPayBefore);

    // Remaining debt is still 460,000
    const feeRow = db.prepare("SELECT remaining_amount FROM member_fees WHERE member_id = 'mem_fixed_01' AND month_key = '2026-10'").get();
    expect(feeRow.remaining_amount).toBe(460000);
  });

  it('TEST 10: Month filter returns data strictly for selected month', async () => {
    const octRes = await request(app).get('/api/v1/public/saoke/debtors?month=2026-10');
    expect(octRes.body.data.length).toBeGreaterThan(0);

    const novRes = await request(app).get('/api/v1/public/saoke/debtors?month=2026-11');
    expect(novRes.body.data.length).toBe(0);
  });

  it('TEST 11: Minimal Public DTO contains ONLY approved fields (No memberId, daysPerWeek, password, tokens, PII, email, phone)', async () => {
    const res = await request(app).get('/api/v1/public/saoke/debtors?month=2026-10');
    expect(res.status).toBe(200);
    const debtors = res.body.data;
    expect(debtors.length).toBeGreaterThan(0);

    const debtor = debtors[0];
    const keys = Object.keys(debtor);

    // Minimal approved fields check
    const approvedKeys = [
      'memberName',
      'memberType',
      'month',
      'totalFeeRequired',
      'paidAmount',
      'remainingAmount',
      'status',
      'paymentReference'
    ];

    keys.forEach((k) => {
      expect(approvedKeys).toContain(k);
    });

    // Explicit negative assertions for excluded fields
    expect(debtor).not.toHaveProperty('memberId');
    expect(debtor).not.toHaveProperty('daysPerWeek');
    expect(debtor).not.toHaveProperty('password');
    expect(debtor).not.toHaveProperty('passwordHash');
    expect(debtor).not.toHaveProperty('token');
    expect(debtor).not.toHaveProperty('phone');
    expect(debtor).not.toHaveProperty('email');
    expect(debtor).not.toHaveProperty('address');
  });

  it('TEST 12: Internal protected debt API remains authenticated and unchanged', async () => {
    const unauthRes = await request(app).get('/api/v1/debts?month=2026-10');
    expect(unauthRes.status).toBe(401);

    const authRes = await request(app)
      .get('/api/v1/debts?month=2026-10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(authRes.status).toBe(200);
  });
});
