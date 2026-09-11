import { getDb } from './index';

export interface User {
  id: number;
  telegram_id: number;
  first_name: string;
  age_gate_status: 'UNKNOWN' | 'UNDER_18' | 'OVER_18';
  tokens: number;
  premium_until: string | null;
  created_at: string;
  updated_at: string;
}

export async function getUser(telegramId: number): Promise<User | undefined> {
  const db = getDb();
  return db.get<User>('SELECT * FROM users WHERE telegram_id = ?', telegramId);
}

export async function createUser(telegramId: number, firstName: string): Promise<User> {
  const db = getDb();
  await db.run(
    'INSERT INTO users (telegram_id, first_name, tokens) VALUES (?, ?, 10)',
    [telegramId, firstName]
  );
  const user = await getUser(telegramId);
  return user!;
}

export async function updateUserAgeGate(telegramId: number, status: 'UNDER_18' | 'OVER_18'): Promise<void> {
  const db = getDb();
  await db.run(
    'UPDATE users SET age_gate_status = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?',
    [status, telegramId]
  );
}

export async function decrementUserTokens(telegramId: number): Promise<void> {
  const db = getDb();
  await db.run(
    'UPDATE users SET tokens = tokens - 1, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?',
    [telegramId]
  );
}

export async function addTokens(telegramId: number, amount: number): Promise<void> {
  const db = getDb();
  await db.run(
    'UPDATE users SET tokens = tokens + ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?',
    [amount, telegramId]
  );
}

export async function setPremiumUntil(telegramId: number, dateStr: string): Promise<void> {
  const db = getDb();
  await db.run(
    'UPDATE users SET premium_until = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?',
    [dateStr, telegramId]
  );
}

export async function getOrCreateUser(telegramId: number, firstName: string): Promise<User> {
  let user = await getUser(telegramId);
  if (!user) {
    user = await createUser(telegramId, firstName);
  }
  return user;
}
