import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { logger } from '../utils/logger';

let db: Database;

export async function initDatabase() {
  db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  logger.info('Connected to SQLite database.');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER UNIQUE NOT NULL,
      first_name TEXT,
      age_gate_status TEXT DEFAULT 'UNKNOWN',
      tokens INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      role TEXT,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      memory_text TEXT,
      importance INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
  `);

  try {
    await db.exec('ALTER TABLE users ADD COLUMN tokens INTEGER DEFAULT 10');
  } catch (e) {}

  try {
    await db.exec('ALTER TABLE users ADD COLUMN premium_until DATETIME DEFAULT NULL');
  } catch (e) {}
  
  logger.info('Database schema initialized.');
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized!');
  }
  return db;
}
