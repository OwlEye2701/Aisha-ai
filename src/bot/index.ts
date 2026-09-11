import { Telegraf } from 'telegraf';
import { config } from '../config';
import { handleIncomingMessage } from '../services/messaging';
import { logger } from '../utils/logger';

export const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);

import { addTokens, setPremiumUntil } from '../database/users';

bot.command('buy', async (ctx) => {
  await ctx.reply("Choose a package to buy with Telegram Stars:", {
    reply_parameters: { message_id: ctx.message.message_id },
    reply_markup: {
      inline_keyboard: [
        [{ text: "50 Messages (100 ⭐️)", callback_data: "buy_50" }],
        [{ text: "100 Messages (200 ⭐️)", callback_data: "buy_100" }],
        [{ text: "500 Messages (1000 ⭐️)", callback_data: "buy_500" }],
        [{ text: "1 Week Unlimited (1250 ⭐️)", callback_data: "buy_week" }]
      ]
    }
  });
});

bot.on('callback_query', async (ctx: any) => {
  const data = ctx.callbackQuery.data;
  let title = '';
  let description = '';
  let payload = '';
  let price = 0;

  if (data === 'buy_50') { title = '50 Messages'; description = 'Add 50 messages to your balance.'; payload = '50_msgs'; price = 100; }
  else if (data === 'buy_100') { title = '100 Messages'; description = 'Add 100 messages to your balance.'; payload = '100_msgs'; price = 200; }
  else if (data === 'buy_500') { title = '500 Messages'; description = 'Add 500 messages to your balance.'; payload = '500_msgs'; price = 1000; }
  else if (data === 'buy_week') { title = '1 Week Unlimited'; description = 'Unlimited messages for 7 days.'; payload = '1_week'; price = 1250; }
  else return;

  await ctx.sendInvoice({
    title,
    description,
    payload,
    provider_token: "", // Telegram Stars
    currency: "XTR",
    prices: [{ label: title, amount: price }]
  });
  await ctx.answerCbQuery();
});

bot.on('pre_checkout_query', async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on('successful_payment', async (ctx: any) => {
  const payload = ctx.message.successful_payment.invoice_payload;
  const telegramId = ctx.from.id;

  if (payload === '50_msgs') await addTokens(telegramId, 50);
  else if (payload === '100_msgs') await addTokens(telegramId, 100);
  else if (payload === '500_msgs') await addTokens(telegramId, 500);
  else if (payload === '1_week') {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    await setPremiumUntil(telegramId, nextWeek.toISOString());
  }

  await ctx.reply("Payment successful! ✨ Enjoy chatting with Aisha!");
});

bot.command('invite', async (ctx) => {
  await ctx.reply("Invite system is not active yet!", { reply_parameters: { message_id: ctx.message.message_id } });
});

bot.start(async (ctx) => {
  const telegramId = ctx.from.id;
  const firstName = ctx.from.first_name || 'User';
  const username = ctx.from.username;
  const messageId = ctx.message.message_id;
  
  ctx.sendChatAction('typing').catch(() => {});
  
  await handleIncomingMessage(
    telegramId, 
    firstName, 
    username,
    "Hello! It's my first time here.", 
    null,
    async (text: string) => {
      await ctx.reply(text, { reply_parameters: { message_id: messageId } });
    }
  );
});

async function downloadMedia(ctx: any, fileId: string): Promise<{mimeType: string, data: string} | null> {
  try {
    const fileUrl = await ctx.telegram.getFileLink(fileId);
    const response = await fetch(fileUrl.href);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
      mimeType: 'image/jpeg',
      data: buffer.toString('base64')
    };
  } catch (err) {
    logger.error('Error downloading media:', err);
    return null;
  }
}

bot.on(['text', 'photo', 'sticker', 'animation'], async (ctx) => {
  const telegramId = ctx.from.id;
  const firstName = ctx.from.first_name || 'User';
  const username = ctx.from.username;
  const messageId = ctx.message.message_id;

  let text = '';
  let mediaPart = null;

  if ('text' in ctx.message) {
    text = ctx.message.text;
  } else if ('photo' in ctx.message) {
    text = ctx.message.caption || '';
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    mediaPart = await downloadMedia(ctx, photo.file_id);
  } else if ('sticker' in ctx.message) {
    text = ctx.message.sticker.emoji ? `(sent a sticker: ${ctx.message.sticker.emoji})` : '(sent a sticker)';
    // You could also download the sticker if it's webp/png, but emoji representation is usually enough.
  } else if ('animation' in ctx.message) {
    text = ctx.message.caption || '(sent a GIF)';
    const thumb = ctx.message.animation.thumbnail || (ctx.message.animation as any).thumb;
    if (thumb) {
      mediaPart = await downloadMedia(ctx, thumb.file_id);
    }
  }

  let isTyping = true;
  const chatId = ctx.chat?.id || ctx.from?.id;

  const sendTyping = async () => {
    if (!isTyping || !chatId) return;
    try {
      await ctx.telegram.sendChatAction(chatId, 'typing');
    } catch (e) {
      logger.error('Typing error:', e);
    }
  };

  sendTyping();
  const typeInterval = setInterval(sendTyping, 4000);

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
