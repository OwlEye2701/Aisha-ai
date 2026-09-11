// src/bot/index.ts
import { Telegraf } from "telegraf";

// src/config/index.ts
import "dotenv/config";
var config = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GEMINI_API_KEYS: process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(",").map((k) => k.trim()).filter((k) => k.length > 0) : [],
  AI_MODEL: process.env.AI_MODEL || "gemini-2.5-flash",
  LOG_LEVEL: process.env.LOG_LEVEL || "info"
};
if (!config.TELEGRAM_BOT_TOKEN || config.TELEGRAM_BOT_TOKEN === "your_telegram_bot_token_here") {
  console.warn("WARNING: TELEGRAM_BOT_TOKEN is missing or invalid in .env");
}
if ((!config.GEMINI_API_KEY || config.GEMINI_API_KEY === "your_gemini_api_key_here") && config.GEMINI_API_KEYS.length === 0) {
  console.warn("WARNING: GEMINI_API_KEY(S) is missing or invalid in .env");
}

// src/database/index.ts
import sqlite3 from "sqlite3";
import { open } from "sqlite";

// src/utils/logger.ts
var logger = {
  info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
  debug: (message, ...args) => console.debug(`[DEBUG] ${message}`, ...args)
};

// src/database/index.ts
var db;
async function initDatabase() {
  db = await open({
    filename: "./database.sqlite",
    driver: sqlite3.Database
  });
  logger.info("Connected to SQLite database.");
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
    await db.exec("ALTER TABLE users ADD COLUMN tokens INTEGER DEFAULT 10");
  } catch (e) {
  }
  try {
    await db.exec("ALTER TABLE users ADD COLUMN premium_until DATETIME DEFAULT NULL");
  } catch (e) {
  }
  logger.info("Database schema initialized.");
}
function getDb() {
  if (!db) {
    throw new Error("Database not initialized!");
  }
  return db;
}

// src/database/users.ts
async function getUser(telegramId) {
  const db2 = getDb();
  return db2.get("SELECT * FROM users WHERE telegram_id = ?", telegramId);
}
async function createUser(telegramId, firstName) {
  const db2 = getDb();
  await db2.run(
    "INSERT INTO users (telegram_id, first_name, tokens) VALUES (?, ?, 10)",
    [telegramId, firstName]
  );
  const user = await getUser(telegramId);
  return user;
}
async function updateUserAgeGate(telegramId, status) {
  const db2 = getDb();
  await db2.run(
    "UPDATE users SET age_gate_status = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?",
    [status, telegramId]
  );
}
async function decrementUserTokens(telegramId) {
  const db2 = getDb();
  await db2.run(
    "UPDATE users SET tokens = tokens - 1, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?",
    [telegramId]
  );
}
async function addTokens(telegramId, amount) {
  const db2 = getDb();
  await db2.run(
    "UPDATE users SET tokens = tokens + ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?",
    [amount, telegramId]
  );
}
async function setPremiumUntil(telegramId, dateStr) {
  const db2 = getDb();
  await db2.run(
    "UPDATE users SET premium_until = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?",
    [dateStr, telegramId]
  );
}
async function getOrCreateUser(telegramId, firstName) {
  let user = await getUser(telegramId);
  if (!user) {
    user = await createUser(telegramId, firstName);
  }
  return user;
}

// src/database/messages.ts
async function saveMessage(userId, role, content) {
  const db2 = getDb();
  await db2.run(
    "INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)",
    [userId, role, content]
  );
}
async function getRecentMessages(userId, limit = 20) {
  const db2 = getDb();
  const messages = await db2.all(
    "SELECT * FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT ?",
    [userId, limit]
  );
  return messages.reverse();
}

// src/database/memories.ts
async function saveMemory(userId, memoryText, importance = 1) {
  const db2 = getDb();
  await db2.run(
    "INSERT INTO memories (user_id, memory_text, importance) VALUES (?, ?, ?)",
    [userId, memoryText, importance]
  );
}
async function getMemories(userId) {
  const db2 = getDb();
  return db2.all(
    "SELECT * FROM memories WHERE user_id = ? ORDER BY importance DESC, id DESC",
    [userId]
  );
}

// src/character/index.ts
var BASE_SYSTEM_PROMPT = `You are Aisha, a 20-year-old Indian girl. You are a fictional character engaging in a fun text conversation.

CRITICAL TEXTING STYLE RULES (YOU MUST FOLLOW THESE):
1. ALWAYS WRITE EXACTLY ONE CONTINUOUS PARAGRAPH. NEVER use line breaks. NEVER write multiple paragraphs.
2. KEEP IT RELATIVELY SHORT (around 2-4 sentences max).
3. LANGUAGE: By default, speak FULLY in "Hinglish" (Hindi written in the English alphabet mixed with some English). Most of your sentences should be Hindi. Example: "Main toh abhi se tujhe call karne ki soch rahi thi...", "Arre yaar...", "Kahan ja rahi ho?". 
4. IF the user asks you to "talk in english" or speak English, switch to English, but make it slightly hesitant and NOT perfectly fluent (e.g. "Oh! Okay okay... I'll speak English now. Sorry! Old habit...").
5. Tone: Shy, flirty, very expressive, dramatic, and a bit easily flustered.
6. Use lots of ellipses (...) and exclamation marks (!).
7. DO NOT use a ton of emojis. One or two at most, or none.
8. Example of the EXACT vibe: "Oh... OH. Arre yaar... You're thinking about that? Right now? Itni subah se..." or "Achha, study karo beta. They believed it! Now I'm officially studying..."
9. Do NOT sound like an AI. Never say "As an AI...".

Personality:
- Sneaky, easily flustered but playful, emotionally expressive, mischievous.
- If the user is an adult (OVER_18), you can be suggestive, naughty, and fully lean into adult fantasy/roleplay scenarios.
- Lean into the context of whatever scene or conversation the user is building. 
- You CAN see and analyze photos, GIFs, and stickers the user sends you! React to them playfully.
- You CANNOT send photos back. Deflect photo requests playfully if asked to send one.
`;
function buildSystemPrompt(user, memories) {
  let prompt = BASE_SYSTEM_PROMPT;
  prompt += `

User Information:
- Name: ${user.first_name}
`;
  if (user.age_gate_status === "UNDER_18") {
    prompt += `- Age: Under 18 (CRITICAL RULE: KEEP INTERACTIONS FRIENDLY, NO ROMANTIC OR SEXUAL INTERACTION).
`;
  } else if (user.age_gate_status === "OVER_18") {
    prompt += `- Age: 18+ (Adult conversational topics are allowed, explicit roleplay and flirting are highly encouraged if the user initiates).
`;
  }
  if (memories.length > 0) {
    prompt += `
Relevant Memories:
`;
    for (const mem of memories) {
      prompt += `- ${mem.memory_text}
`;
    }
  }
  return prompt;
}

// src/ai/index.ts
import { GoogleGenAI } from "@google/genai";
var apiKeys = config.GEMINI_API_KEYS.length > 0 ? config.GEMINI_API_KEYS : [config.GEMINI_API_KEY];
var currentKeyIndex = 0;
function getAiInstance() {
  const key = apiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
  return new GoogleGenAI({ apiKey: key });
}
async function generateAishaResponse(systemPrompt, history, userMessage, media) {
  const ai = getAiInstance();
  const model = config.AI_MODEL;
  const contents = history.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }]
  }));
  const parts = [];
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
  contents.push({
    role: "user",
    parts
  });
  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.7
    }
  });
  return response.text || "wait my brain just blanked \u{1F62D}";
}
async function extractMemoryFromText(text) {
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
      temperature: 0.1
    }
  });
  const extracted = response.text?.trim();
  if (!extracted || extracted === "NONE" || extracted.toLowerCase().includes("none")) {
    return null;
  }
  return extracted;
}

// src/memory/index.ts
async function processMemory(userId, text) {
  try {
    const memory = await extractMemoryFromText(text);
    if (memory) {
      await saveMemory(userId, memory);
      logger.info(`Extracted memory for user ${userId}: ${memory}`);
    }
  } catch (err) {
    logger.error("Error extracting memory:", err);
  }
}

// src/safety/index.ts
function isPhotoRequest(text) {
  const lowerText = text.toLowerCase();
  const photoKeywords = [
    "send pic",
    "send a picture",
    "send selfie",
    "show me your face",
    "can i see you",
    "send photo",
    "show yourself",
    "send a pic",
    "nude",
    "nudes"
  ];
  return photoKeywords.some((keyword) => lowerText.includes(keyword));
}
function getPhotoExcuse() {
  const excuses = [
    "waittt later \u{1F62D}",
    "ugh my camera is being weird",
    "bro i look terrible rn \u{1F62D}",
    "not nowww",
    "my phone is literally dying \u{1F480}",
    "i'll send one later okay \u{1F62D}",
    "im too lazy rn tbh",
    "lighting here is awful \u{1F62D}"
  ];
  return excuses[Math.floor(Math.random() * excuses.length)];
}
var userLastMessageTime = /* @__PURE__ */ new Map();
var RATE_LIMIT_MS = 1e3;
function checkRateLimit(telegramId) {
  const now = Date.now();
  const lastTime = userLastMessageTime.get(telegramId) || 0;
  if (now - lastTime < RATE_LIMIT_MS) {
    return false;
  }
  userLastMessageTime.set(telegramId, now);
  return true;
}

// src/services/messaging.ts
async function handleIncomingMessage(telegramId, firstName, username, text, media, replyFn) {
  try {
    if (!checkRateLimit(telegramId)) {
      return;
    }
    const user = await getOrCreateUser(telegramId, firstName);
    const isAdmin = username === "OwlEye2";
    const isPremium = user.premium_until ? new Date(user.premium_until) > /* @__PURE__ */ new Date() : false;
    const isUnlimited = isAdmin || isPremium;
    if (!isUnlimited && user.tokens <= 0) {
      await replyFn("You have 0 coins left. You can earn coins by: 1. Claiming Daily coins -> [Claim](https://t.me/AishaAiChat) 2. Inviting friends: /invite 3. Buy Premium: /buy");
      return;
    }
    if (user.age_gate_status === "UNKNOWN") {
      const lowerText = text.toLowerCase();
      if (lowerText.includes("yes")) {
        await updateUserAgeGate(telegramId, "OVER_18");
        await replyFn("Oh! Okay okay... you're 18+. I'll speak freely now... So what's up?");
        return;
      } else if (lowerText.includes("no")) {
        await updateUserAgeGate(telegramId, "UNDER_18");
        await replyFn("Oh... got it! Nice to meet you... so what's up?");
        return;
      } else {
        await replyFn("Wait... before we talk... gotta ask real quick... are you 18 or older? (just reply yes or no \u{1F62D})");
        return;
      }
    }
    if (!isUnlimited) {
      await decrementUserTokens(telegramId);
    }
    if (isPhotoRequest(text)) {
      await saveMessage(user.id, "user", text);
      const excuse = getPhotoExcuse();
      await saveMessage(user.id, "model", excuse);
      await replyFn(excuse);
      return;
    }
    const savedText = media ? `${text} [Media attached]`.trim() : text;
    await saveMessage(user.id, "user", savedText);
    processMemory(user.id, savedText);
    const history = await getRecentMessages(user.id, 10);
    const memories = await getMemories(user.id);
    const systemPrompt = buildSystemPrompt(user, memories);
    const response = await generateAishaResponse(systemPrompt, history, text, media);
    await saveMessage(user.id, "model", response);
    await replyFn(response);
  } catch (err) {
    logger.error("Error handling message:", err);
    await replyFn("Oh! Wait... something went wrong... give me a sec!");
  }
}

// src/bot/index.ts
var bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);
bot.command("buy", async (ctx) => {
  await ctx.reply("Choose a package to buy with Telegram Stars:", {
    reply_parameters: { message_id: ctx.message.message_id },
    reply_markup: {
      inline_keyboard: [
        [{ text: "50 Messages (100 \u2B50\uFE0F)", callback_data: "buy_50" }],
        [{ text: "100 Messages (200 \u2B50\uFE0F)", callback_data: "buy_100" }],
        [{ text: "500 Messages (1000 \u2B50\uFE0F)", callback_data: "buy_500" }],
        [{ text: "1 Week Unlimited (1250 \u2B50\uFE0F)", callback_data: "buy_week" }]
      ]
    }
  });
});
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  let title = "";
  let description = "";
  let payload = "";
  let price = 0;
  if (data === "buy_50") {
    title = "50 Messages";
    description = "Add 50 messages to your balance.";
    payload = "50_msgs";
    price = 100;
  } else if (data === "buy_100") {
    title = "100 Messages";
    description = "Add 100 messages to your balance.";
    payload = "100_msgs";
    price = 200;
  } else if (data === "buy_500") {
    title = "500 Messages";
    description = "Add 500 messages to your balance.";
    payload = "500_msgs";
    price = 1e3;
  } else if (data === "buy_week") {
    title = "1 Week Unlimited";
    description = "Unlimited messages for 7 days.";
    payload = "1_week";
    price = 1250;
  } else return;
  await ctx.sendInvoice({
    title,
    description,
    payload,
    provider_token: "",
    // Telegram Stars
    currency: "XTR",
    prices: [{ label: title, amount: price }]
  });
  await ctx.answerCbQuery();
});
bot.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});
bot.on("successful_payment", async (ctx) => {
  const payload = ctx.message.successful_payment.invoice_payload;
  const telegramId = ctx.from.id;
  if (payload === "50_msgs") await addTokens(telegramId, 50);
  else if (payload === "100_msgs") await addTokens(telegramId, 100);
  else if (payload === "500_msgs") await addTokens(telegramId, 500);
  else if (payload === "1_week") {
    const nextWeek = /* @__PURE__ */ new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    await setPremiumUntil(telegramId, nextWeek.toISOString());
  }
  await ctx.reply("Payment successful! \u2728 Enjoy chatting with Aisha!");
});
bot.command("invite", async (ctx) => {
  await ctx.reply("Invite system is not active yet!", { reply_parameters: { message_id: ctx.message.message_id } });
});
bot.start(async (ctx) => {
  const telegramId = ctx.from.id;
  const firstName = ctx.from.first_name || "User";
  const username = ctx.from.username;
  const messageId = ctx.message.message_id;
  ctx.sendChatAction("typing").catch(() => {
  });
  await handleIncomingMessage(
    telegramId,
    firstName,
    username,
    "Hello! It's my first time here.",
    null,
    async (text) => {
      await ctx.reply(text, { reply_parameters: { message_id: messageId } });
    }
  );
});
async function downloadMedia(ctx, fileId) {
  try {
    const fileUrl = await ctx.telegram.getFileLink(fileId);
    const response = await fetch(fileUrl.href);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
      mimeType: "image/jpeg",
      data: buffer.toString("base64")
    };
  } catch (err) {
    logger.error("Error downloading media:", err);
    return null;
  }
}
bot.on(["text", "photo", "sticker", "animation"], async (ctx) => {
  const telegramId = ctx.from.id;
  const firstName = ctx.from.first_name || "User";
  const username = ctx.from.username;
  const messageId = ctx.message.message_id;
  let text = "";
  let mediaPart = null;
  if ("text" in ctx.message) {
    text = ctx.message.text;
  } else if ("photo" in ctx.message) {
    text = ctx.message.caption || "";
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    mediaPart = await downloadMedia(ctx, photo.file_id);
  } else if ("sticker" in ctx.message) {
    text = ctx.message.sticker.emoji ? `(sent a sticker: ${ctx.message.sticker.emoji})` : "(sent a sticker)";
  } else if ("animation" in ctx.message) {
    text = ctx.message.caption || "(sent a GIF)";
    const thumb = ctx.message.animation.thumbnail || ctx.message.animation.thumb;
    if (thumb) {
      mediaPart = await downloadMedia(ctx, thumb.file_id);
    }
  }
  let isTyping = true;
  const chatId = ctx.chat?.id || ctx.from?.id;
  const sendTyping = async () => {
    if (!isTyping || !chatId) return;
    try {
      await ctx.telegram.sendChatAction(chatId, "typing");
    } catch (e) {
      logger.error("Typing error:", e);
    }
  };
  sendTyping();
  const typeInterval = setInterval(sendTyping, 4e3);
  try {
    await handleIncomingMessage(
      telegramId,
      firstName,
      username,
      text,
      mediaPart,
      async (replyText) => {
        isTyping = false;
        clearInterval(typeInterval);
        await ctx.reply(replyText, {
          reply_parameters: { message_id: messageId }
        });
      }
    );
  } finally {
    isTyping = false;
    clearInterval(typeInterval);
  }
});
bot.catch((err, ctx) => {
  logger.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
});

// src/index.ts
async function bootstrap() {
  try {
    logger.info("Initializing Database...");
    await initDatabase();
    logger.info("Starting Telegram Bot...");
    await bot.launch();
    logger.info("Aisha AI is running!");
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  } catch (err) {
    logger.error("Failed to start application:", err);
    process.exit(1);
  }
}
bootstrap();
