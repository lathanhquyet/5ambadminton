import { Database as DatabaseType } from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { getDb, defaultDb } from './db';
import { runMigrations } from './migrate';

export const runSeed = async (dbInstance?: DatabaseType) => {
  const db = dbInstance || defaultDb;
  runMigrations(db);

  // Check if admin user exists
  const existingAdmin = db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
  if (!existingAdmin) {
    const adminPasswordHash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run('usr_admin_default', 'admin', adminPasswordHash, 'ADMIN');
    console.log('Default admin user created: admin / admin123');
  }

  // Ensure default shuttle product exists and stays synchronized with the current brand name.
  const defaultShuttle = {
    id: 'prod_tc77',
    code: 'SHUTTLE_TC77',
    name: 'Cầu Vina Star',
    pieces_per_tube: 12,
    min_stock_alert: 24,
    notes: 'Cầu thi đấu chính thức'
  };

  const existingProduct = db.prepare("SELECT * FROM inventory_products WHERE code = ?").get(defaultShuttle.code) as any;
  if (!existingProduct) {
    db.prepare(`
      INSERT INTO inventory_products (id, code, name, pieces_per_tube, min_stock_alert, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(defaultShuttle.id, defaultShuttle.code, defaultShuttle.name, defaultShuttle.pieces_per_tube, defaultShuttle.min_stock_alert, defaultShuttle.notes);
    console.log('Default shuttle product created: SHUTTLE_TC77');
  } else {

  const shouldRefreshProduct =
    existingProduct.name !== defaultShuttle.name ||
    existingProduct.pieces_per_tube !== defaultShuttle.pieces_per_tube ||
    existingProduct.min_stock_alert !== defaultShuttle.min_stock_alert ||
    existingProduct.notes !== defaultShuttle.notes;

  if (shouldRefreshProduct) {
    db.prepare(`
      UPDATE inventory_products
      SET name = ?, pieces_per_tube = ?, min_stock_alert = ?, notes = ?
      WHERE code = ?
    `).run(
      defaultShuttle.name,
      defaultShuttle.pieces_per_tube,
      defaultShuttle.min_stock_alert,
      defaultShuttle.notes,
      defaultShuttle.code
    );
    console.log('Default shuttle product metadata synchronized: SHUTTLE_TC77');
  }
}

  // Ensure default active bank account exists
  const existingBank = db.prepare("SELECT * FROM bank_accounts WHERE is_active = 1 LIMIT 1").get();
  if (!existingBank) {
    db.prepare(`
      INSERT INTO bank_accounts (id, bank_name, bank_bin, account_number, account_holder, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run('bank_default_5am', 'MB', '970436', '090123456789', 'QUY CAU LONG 5AM');
    console.log('Default bank account created: MB / 090123456789 / QUY CAU LONG 5AM');
  }

  // Ensure default Telegram settings exist
  const existingTg = db.prepare("SELECT * FROM telegram_settings LIMIT 1").get();
  if (!existingTg) {
    db.prepare(`
      INSERT INTO telegram_settings (id, bot_token, chat_id, enabled)
      VALUES (?, ?, ?, 1)
    `).run('tg_default_5am', '8805766187:AAERLeSyBfeqlu_eoSZF3rNhH8K67b7G3qg', '8505180269');
    console.log('Default Telegram settings created.');
  }
};

if (require.main === module) {
  runSeed().catch(console.error);
}
