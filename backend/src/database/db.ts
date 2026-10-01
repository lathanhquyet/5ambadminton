import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DATABASE_PATH || './data/badminton_fund.db';
const resolvedPath = path.resolve(process.cwd(), dbPath);

// Ensure target directory exists
const dir = path.dirname(resolvedPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const getDb = (dbFilePath?: string) => {
  const targetPath = dbFilePath || resolvedPath;
  const db = new Database(targetPath);
  
  // Enforce WAL mode and Foreign Key constraints
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  
  return db;
};

export const defaultDb = getDb();
