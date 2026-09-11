# Aisha AI - Telegram Companion Bot

Aisha AI is a Telegram-based AI companion where users communicate naturally with one consistent fictional AI character named Aisha. 
Built using TypeScript, Telegraf, SQLite, and the Google Gemini API.

## Setup

1. Copy `.env.example` to `.env` and fill in the required variables:
   - `TELEGRAM_BOT_TOKEN`
   - `GEMINI_API_KEY`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## Production

To run in production, compile the TypeScript code and start the compiled output:
```bash
npm run build
npm start
```
