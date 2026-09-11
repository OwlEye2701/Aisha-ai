import { GoogleGenAI } from '@google/genai';
import { config } from '../config';
import { Message } from '../database/messages';
import { MediaPart } from '../services/messaging';

// Support single key or array of keys
const apiKeys = config.GEMINI_API_KEYS.length > 0 ? config.GEMINI_API_KEYS : [config.GEMINI_API_KEY];
let currentKeyIndex = 0;

function getAiInstance() {
  const key = apiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
  return new GoogleGenAI({ apiKey: key });
}

export async function generateAishaResponse(
  systemPrompt: string,
  history: Message[],
  userMessage: string,
  media: MediaPart | null
): Promise<string> {
  const ai = getAiInstance();
  const model = config.AI_MODEL;
  
  // Convert history to Gemini format
  const contents = history.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.content }]
  }));

  const parts: any[] = [];
  if (userMessage) parts.push({ text: userMessage });
  else if (!media) parts.push({ text: "(sent a blank message)" });

  if (media) {
    parts.push({
      inlineData: {
        data: media.data,
        mimeType: media.mimeType
      }
    });
  }

  // Add current user message
  contents.push({
    role: 'user',
    parts: parts
  });

  const response = await ai.models.generateContent({
    model: model,
    contents: contents,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.7,
    }
  });

  return response.text || "wait my brain just blanked 😭";
}

export async function extractMemoryFromText(text: string): Promise<string | null> {
  const ai = getAiInstance();
  const prompt = `Extract ONE concise, important fact about the user from the following text, if any. 
Ignore casual conversation, greetings, or temporary states. 
Examples of useful facts: "User's hobby is fencing", "User has a dog named Max", "User studies biology", "User lives in London".
If there is no important long-term fact, output exactly "NONE".

Text to analyze: "${text}"
Result:`;

  const response = await ai.models.generateContent({
    model: config.AI_MODEL,
    contents: prompt,
    config: {
      temperature: 0.1,
    }
  });

  const extracted = response.text?.trim();
  if (!extracted || extracted === 'NONE' || extracted.toLowerCase().includes('none')) {
    return null;
  }
  return extracted;
}
