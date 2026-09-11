import { getOrCreateUser, updateUserAgeGate, decrementUserTokens } from '../database/users';
import { getRecentMessages, saveMessage } from '../database/messages';
import { getMemories } from '../database/memories';
import { buildSystemPrompt } from '../character';
import { generateAishaResponse } from '../ai';
import { processMemory } from '../memory';
import { isPhotoRequest, getPhotoExcuse, checkRateLimit } from '../safety';
import { logger } from '../utils/logger';

export interface MediaPart {
  mimeType: string;
  data: string; // base64
}

export async function handleIncomingMessage(
  telegramId: number,
  firstName: string,
  username: string | undefined,
  text: string,
  media: MediaPart | null,
  replyFn: (text: string) => Promise<void>
) {
  try {
    if (!checkRateLimit(telegramId)) {
      return;
    }

    const user = await getOrCreateUser(telegramId, firstName);

    // Admin Check - Bypass token limits for @OwlEye2
    const isAdmin = username === 'OwlEye2';
    const isPremium = user.premium_until ? new Date(user.premium_until) > new Date() : false;
    const isUnlimited = isAdmin || isPremium;

    // Token Check
    if (!isUnlimited && user.tokens <= 0) {
      await replyFn("You have 0 coins left. You can earn coins by: 1. Claiming Daily coins -> [Claim](https://t.me/AishaAiChat) 2. Inviting friends: /invite 3. Buy Premium: /buy");
      return;
    }

    // Age Gate Logic
    if (user.age_gate_status === 'UNKNOWN') {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('yes')) {
        await updateUserAgeGate(telegramId, 'OVER_18');
        await replyFn("Oh! Okay okay... you're 18+. I'll speak freely now... So what's up?");
        return;
      } else if (lowerText.includes('no')) {
        await updateUserAgeGate(telegramId, 'UNDER_18');
        await replyFn("Oh... got it! Nice to meet you... so what's up?");
        return;
      } else {
        await replyFn("Wait... before we talk... gotta ask real quick... are you 18 or older? (just reply yes or no 😭)");
        return;
      }
    }

    // Deduct token
    if (!isUnlimited) {
      await decrementUserTokens(telegramId);
    }

    // Photo Request Logic
    if (isPhotoRequest(text)) {
      await saveMessage(user.id, 'user', text);
      const excuse = getPhotoExcuse();
      await saveMessage(user.id, 'model', excuse);
      await replyFn(excuse);
      return;
    }

    // Save user message (append media tag if present so context remembers)
    const savedText = media ? `${text} [Media attached]`.trim() : text;
    await saveMessage(user.id, 'user', savedText);

    // Extract memory asynchronously (fire and forget)
    processMemory(user.id, savedText);

    // Load Context
    const history = await getRecentMessages(user.id, 10);
    const memories = await getMemories(user.id);
    const systemPrompt = buildSystemPrompt(user, memories);

    // Generate Response
    const response = await generateAishaResponse(systemPrompt, history, text, media);

    // Save & Reply
    await saveMessage(user.id, 'model', response);
    await replyFn(response);

  } catch (err) {
    logger.error('Error handling message:', err);
    await replyFn("Oh! Wait... something went wrong... give me a sec!");
  }
}
