import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';
config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function listModels() {
  const models = await ai.models.list();
  const names = [];
  // Since it might be a pager, let's try to map over its internal items
  for (const m of (models as any)) {
    if (m && m.name) {
       names.push(m.name);
    }
  }
  console.log(names.join('\\n'));
}

listModels().catch(console.error);
