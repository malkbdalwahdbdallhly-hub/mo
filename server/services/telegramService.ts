import { db } from '../database/db';
import { TelegramAccount, TelegramLinkToken } from '../types';
import { generateRandomCode } from '../security/crypto';

export class TelegramService {
  createLinkToken(userId: string): TelegramLinkToken {
    // Purge expired tokens
    db.telegramLinkTokens = db.telegramLinkTokens.filter((t) => new Date(t.expiresAt) > new Date());

    // Generate random 6-character code
    const token = `MK-${generateRandomCode(5)}`;
    const linkToken: TelegramLinkToken = {
      token,
      userId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes validity
    };

    db.telegramLinkTokens.push(linkToken);
    db.save();
    return linkToken;
  }

  getLinkedAccounts(userId: string): TelegramAccount[] {
    return db.telegramAccounts.filter((a) => a.userId === userId);
  }

  unlinkAccount(accountId: string, userId: string): boolean {
    const idx = db.telegramAccounts.findIndex((a) => a.id === accountId && a.userId === userId);
    if (idx === -1) return false;

    db.telegramAccounts.splice(idx, 1);
    db.save();
    return true;
  }

  toggleAccountAuthorization(accountId: string, userId: string, isAuthorized: boolean): TelegramAccount {
    const acc = db.telegramAccounts.find((a) => a.id === accountId && a.userId === userId);
    if (!acc) throw new Error('حساب Telegram غير موجود.');

    acc.isAuthorized = isAuthorized;
    db.save();
    return acc;
  }
}

export const telegramService = new TelegramService();
