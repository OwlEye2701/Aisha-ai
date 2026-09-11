import { getDb } from './index';

export interface Message {
  id: number;
  user_id: number;
  role: 'user' | 'model';
  content: string;
  created_at: string;
}

export async function saveMessage(userId: number, role: 'user' | 'model', content: string): Promise<void> {
  const db = getDb();
  await db.run(
    'INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)',
    [userId, role, content]
  );
}

export async function getRecentMessages(userId: number, limit: number = 20): Promise<Message[]> {
  const db = getDb();
  const messages = await db.all<Message[]>(
    'SELECT * FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT ?',
    [userId, limit]
  );
  return messages.reverse(); // Return in chronological order
}
