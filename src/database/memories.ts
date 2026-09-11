import { getDb } from './index';

export interface Memory {
  id: number;
  user_id: number;
  memory_text: string;
  importance: number;
  created_at: string;
  updated_at: string;
}

export async function saveMemory(userId: number, memoryText: string, importance: number = 1): Promise<void> {
  const db = getDb();
  await db.run(
    'INSERT INTO memories (user_id, memory_text, importance) VALUES (?, ?, ?)',
    [userId, memoryText, importance]
  );
}

export async function getMemories(userId: number): Promise<Memory[]> {
  const db = getDb();
  return db.all<Memory[]>(
    'SELECT * FROM memories WHERE user_id = ? ORDER BY importance DESC, id DESC',
    [userId]
  );
}
