export function isPhotoRequest(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  const photoKeywords = [
    'send pic', 'send a picture', 'send selfie', 'show me your face', 
    'can i see you', 'send photo', 'show yourself', 'send a pic', 'nude', 'nudes'
  ];

  return photoKeywords.some(keyword => lowerText.includes(keyword));
}

export function getPhotoExcuse(): string {
  const excuses = [
    "waittt later 😭",
    "ugh my camera is being weird",
    "bro i look terrible rn 😭",
    "not nowww",
    "my phone is literally dying 💀",
    "i'll send one later okay 😭",
    "im too lazy rn tbh",
    "lighting here is awful 😭"
  ];
  return excuses[Math.floor(Math.random() * excuses.length)];
}

const userLastMessageTime = new Map<number, number>();
const RATE_LIMIT_MS = 1000;

export function checkRateLimit(telegramId: number): boolean {
  const now = Date.now();
  const lastTime = userLastMessageTime.get(telegramId) || 0;
  
  if (now - lastTime < RATE_LIMIT_MS) {
    return false; // Rate limited
  }
  
  userLastMessageTime.set(telegramId, now);
  return true;
}
