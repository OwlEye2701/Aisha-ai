import { extractMemoryFromText } from '../ai';
import { saveMemory } from '../database/memories';
import { logger } from '../utils/logger';

export async function processMemory(userId: number, text: string) {
  try {
    const memory = await extractMemoryFromText(text);
    if (memory) {
      await saveMemory(userId, memory);
      logger.info(`Extracted memory for user ${userId}: ${memory}`);
    }
  } catch (err) {
    logger.error('Error extracting memory:', err);
  }
}
