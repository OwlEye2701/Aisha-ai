import 'dotenv/config';

export const config = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_API_KEYS: process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(k => k.length > 0) : [],
  AI_MODEL: process.env.AI_MODEL || 'gemini-2.5-flash',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

if (!config.TELEGRAM_BOT_TOKEN || config.TELEGRAM_BOT_TOKEN === 'your_telegram_bot_token_here') {
  console.warn('WARNING: TELEGRAM_BOT_TOKEN is missing or invalid in .env');
}

if ((!config.GEMINI_API_KEY || config.GEMINI_API_KEY === 'your_gemini_api_key_here') && config.GEMINI_API_KEYS.length === 0) {
  console.warn('WARNING: GEMINI_API_KEY(S) is missing or invalid in .env');
}
