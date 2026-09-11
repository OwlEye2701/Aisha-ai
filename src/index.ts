import { bot } from './bot';
import { initDatabase } from './database';
import { logger } from './utils/logger';

async function bootstrap() {
  try {
    logger.info('Initializing Database...');
    await initDatabase();

    logger.info('Starting Telegram Bot...');
    await bot.launch();
    
    logger.info('Aisha AI is running!');

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  } catch (err) {
    logger.error('Failed to start application:', err);
    process.exit(1);
  }
}

bootstrap();
