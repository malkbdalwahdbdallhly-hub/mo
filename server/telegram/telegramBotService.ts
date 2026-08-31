import { db } from '../database/db';
import { TelegramUpdate, BotResponsePayload } from './types';
import { telegramCommandRouter } from './commandRouter';

export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
}

export interface TelegramBotStatus {
  isConfigured: boolean;
  isActive: boolean;
  isPolling: boolean;
  mode: 'POLLING' | 'WEBHOOK' | 'IDLE';
  botInfo: TelegramBotInfo | null;
  botUsername: string | null;
  botFirstName: string | null;
  lastPollTime: string | null;
  lastError: string | null;
  processedCount: number;
}

export class TelegramBotService {
  private botToken: string = '';
  private botInfo: TelegramBotInfo | null = null;
  private isPolling: boolean = false;
  private pollAbortController: AbortController | null = null;
  private currentPollingSessionId: number = 0;
  private lastUpdateId: number = 0;
  private lastPollTime: string | null = null;
  private lastError: string | null = null;
  private processedCount: number = 0;
  private mode: 'POLLING' | 'WEBHOOK' | 'IDLE' = 'IDLE';

  /**
   * Initialize service on server boot
   */
  async init(): Promise<void> {
    const tokenFromDb = db.telegramSettings?.botToken;
    const tokenFromEnv = process.env.TELEGRAM_BOT_TOKEN;
    const token = (tokenFromDb || tokenFromEnv || '').trim();

    if (!token || token === 'your_telegram_bot_token_from_botfather') {
      console.log('ℹ️ Telegram Bot: No token provided yet. Waiting for configuration via UI or environment.');
      this.mode = 'IDLE';
      return;
    }

    try {
      await this.setToken(token, (db.telegramSettings?.mode as 'POLLING' | 'WEBHOOK') || 'POLLING');
      console.log(`✅ Telegram Bot initialized successfully as @${this.botInfo?.username}`);
    } catch (err: any) {
      this.lastError = err.message;
      console.warn(`⚠️ Telegram Bot initialization warning: ${err.message}`);
    }
  }

  /**
   * Set and validate bot token, then start polling or webhook
   */
  async setToken(token: string, mode: 'POLLING' | 'WEBHOOK' = 'POLLING'): Promise<TelegramBotInfo> {
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      throw new Error('توكين البوت لا يمكن أن يكون فارغاً.');
    }

    // Stop current polling session if running
    this.stopPolling();

    // Verify token with getMe
    const info = await this.fetchGetMe(trimmedToken);
    this.botToken = trimmedToken;
    this.botInfo = info;
    this.mode = mode;
    this.lastError = null;

    // Persist in db
    if (!db.telegramSettings) {
      db.telegramSettings = {
        botToken: trimmedToken,
        botUsername: info.username,
        botFirstName: info.first_name,
        mode: mode,
        isActive: true,
        updatedAt: new Date().toISOString(),
      };
    } else {
      db.telegramSettings.botToken = trimmedToken;
      db.telegramSettings.botUsername = info.username;
      db.telegramSettings.botFirstName = info.first_name;
      db.telegramSettings.mode = mode;
      db.telegramSettings.isActive = true;
      db.telegramSettings.updatedAt = new Date().toISOString();
    }
    db.save();

    if (mode === 'POLLING') {
      // Clear any prior webhook so getUpdates works without conflict
      await this.deleteWebhook();
      this.startPolling();
    }

    return info;
  }

  /**
   * Remove token and stop bot
   */
  async disconnect(): Promise<void> {
    this.stopPolling();
    this.botToken = '';
    this.botInfo = null;
    this.mode = 'IDLE';

    if (db.telegramSettings) {
      db.telegramSettings.botToken = '';
      db.telegramSettings.isActive = false;
      db.telegramSettings.updatedAt = new Date().toISOString();
      db.save();
    }
  }

  /**
   * Fetch getMe from Telegram API
   */
  async fetchGetMe(token: string): Promise<TelegramBotInfo> {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const body: any = await res.json().catch(() => ({}));
        throw new Error(body.description || `فشل التحقق من التوكين: كود الخطأ ${res.status}`);
      }

      const data: any = await res.json();
      if (!data.ok || !data.result) {
        throw new Error(data.description || 'فشل استرجاع بيانات البوت من تيليجرام.');
      }

      return data.result as TelegramBotInfo;
    } catch (err: any) {
      throw new Error(`تعذر الاتصال بـ Telegram Bot API: ${err.message}`);
    }
  }

  /**
   * Delete existing webhook on Telegram
   */
  async deleteWebhook(): Promise<boolean> {
    if (!this.botToken) return false;
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/deleteWebhook`, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
      });
      const data: any = await res.json().catch(() => ({}));
      return !!data.ok;
    } catch {
      return false;
    }
  }

  /**
   * Configure Webhook URL
   */
  async setWebhook(webhookUrl: string): Promise<boolean> {
    if (!this.botToken) throw new Error('يرجى ضبط توكين البوت أولاً.');
    this.stopPolling();

    const res = await fetch(`https://api.telegram.org/bot${this.botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message', 'callback_query'] }),
      signal: AbortSignal.timeout(10000),
    });

    const data: any = await res.json().catch(() => ({}));
    if (!data.ok) {
      throw new Error(data.description || 'فشل تفعيل الويب هوك على تيليجرام.');
    }

    this.mode = 'WEBHOOK';
    if (db.telegramSettings) {
      db.telegramSettings.mode = 'WEBHOOK';
      db.telegramSettings.webhookUrl = webhookUrl;
      db.save();
    }
    return true;
  }

  /**
   * Start Long-Polling background loop
   */
  startPolling(): void {
    if (this.isPolling) return;
    if (!this.botToken) {
      console.warn('⚠️ Telegram Bot: Cannot start polling without a valid bot token.');
      return;
    }

    this.isPolling = true;
    this.mode = 'POLLING';
    const sessionId = ++this.currentPollingSessionId;
    this.pollAbortController = new AbortController();

    console.log(`🤖 Telegram Bot: Polling loop started for @${this.botInfo?.username || 'bot'} (session #${sessionId})`);
    this.runPollingLoop(sessionId);
  }

  /**
   * Stop Long-Polling loop gracefully
   */
  stopPolling(): void {
    if (!this.isPolling && !this.pollAbortController) return;
    this.currentPollingSessionId++;
    this.isPolling = false;
    if (this.pollAbortController) {
      try {
        this.pollAbortController.abort();
      } catch {}
      this.pollAbortController = null;
    }
    console.log('🛑 Telegram Bot: Polling loop stopped.');
  }

  /**
   * Continuous Long-Polling loop with session guard, timeout management, and backoff
   */
  private async runPollingLoop(sessionId: number): Promise<void> {
    let consecutiveErrors = 0;

    while (this.isPolling && this.botToken && sessionId === this.currentPollingSessionId) {
      try {
        this.lastPollTime = new Date().toISOString();

        // 8-second long polling window prevents cloud proxies from closing idle sockets
        const params = new URLSearchParams({
          offset: String(this.lastUpdateId + 1),
          timeout: '8',
          allowed_updates: JSON.stringify(['message', 'callback_query']),
        });
        const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?${params.toString()}`;

        // 12-second client timeout ensures connections never hang indefinitely
        const timeoutSignal = AbortSignal.timeout(12000);
        const combinedSignal = this.pollAbortController?.signal
          ? AbortSignal.any([this.pollAbortController.signal, timeoutSignal])
          : timeoutSignal;

        const res = await fetch(url, {
          method: 'GET',
          signal: combinedSignal,
        });

        // If session was invalidated while awaiting network response, stop immediately
        if (!this.isPolling || sessionId !== this.currentPollingSessionId) {
          break;
        }

        if (!res.ok) {
          const errData: any = await res.json().catch(() => ({}));
          const description = errData.description || `HTTP ${res.status}`;

          // Telegram 409 Conflict: another getUpdates request is active
          if (res.status === 409) {
            consecutiveErrors++;
            this.lastError = 'تعارض في اتصال البوت (جاري الانتظار لإعادة المزامنة)';
            // Wait 6 seconds to allow conflicting connection to finish
            await new Promise((r) => setTimeout(r, 6000));
            continue;
          }

          throw new Error(description);
        }

        const data: any = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          consecutiveErrors = 0;
          this.lastError = null;

          for (const update of data.result as TelegramUpdate[]) {
            if (!this.isPolling || sessionId !== this.currentPollingSessionId) break;

            if (update.update_id >= this.lastUpdateId) {
              this.lastUpdateId = update.update_id;
            }

            this.processedCount++;
            await this.processUpdate(update);
          }
        }
      } catch (err: any) {
        if (!this.isPolling || sessionId !== this.currentPollingSessionId) {
          break;
        }

        const isAbort =
          err.name === 'AbortError' ||
          err.cause?.name === 'AbortError' ||
          err.message?.includes('aborted') ||
          err.message?.includes('The operation was aborted');

        if (isAbort) {
          if (this.pollAbortController?.signal.aborted) {
            // Intentional service stop
            break;
          }
          // Request client timeout fired (normal when Telegram had no updates within 12s)
          continue;
        }

        const isTimeout =
          err.name === 'TimeoutError' ||
          err.cause?.name === 'TimeoutError' ||
          err.name === 'ETIMEDOUT' ||
          err.code === 'ETIMEDOUT';

        if (isTimeout) {
          // Normal timeout on long-polling with no updates, continue quietly
          continue;
        }

        consecutiveErrors++;
        const errMsg = err.message || 'unknown error';
        this.lastError = errMsg;

        const delay = Math.min(Math.max(consecutiveErrors * 1500, 2000), 12000);

        // Only log warning if errors persist (3+ times) or if it is a major API issue
        if (consecutiveErrors >= 3 || (!errMsg.includes('fetch failed') && !errMsg.includes('socket'))) {
          console.warn(`⚠️ Telegram Polling (${errMsg}). Reconnecting in ${delay / 1000}s...`);
        }

        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  /**
   * Process a single incoming Telegram update
   */
  async processUpdate(update: TelegramUpdate): Promise<void> {
    try {
      // 1. If callback query, acknowledge it promptly so Telegram removes loading clock
      if (update.callback_query) {
        await this.answerCallbackQuery(update.callback_query.id).catch(() => {});
      }

      // 2. Route update to TelegramCommandRouter
      const reply = await telegramCommandRouter.handleUpdate(update);

      // 3. Send response if generated
      if (reply && reply.chat_id) {
        await this.sendMessage(reply.chat_id, reply.text, {
          parse_mode: reply.parse_mode,
          reply_markup: reply.reply_markup,
        });
      }
    } catch (err: any) {
      console.error('❌ Error processing Telegram update:', err);
    }
  }

  /**
   * Send a message to a Telegram chat
   */
  async sendMessage(
    chatId: number | string,
    text: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      reply_markup?: any;
    }
  ): Promise<any> {
    if (!this.botToken) {
      throw new Error('توكين البوت غير متوفر لإرسال الرسالة.');
    }

    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode || 'HTML',
    };

    if (options?.reply_markup) {
      payload.reply_markup = options.reply_markup;
    }

    const res = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    const data: any = await res.json().catch(() => ({}));
    if (!data.ok) {
      throw new Error(data.description || 'فشل إرسال الرسالة إلى تيليجرام.');
    }

    return data.result;
  }

  /**
   * Answer a callback query
   */
  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<boolean> {
    if (!this.botToken) return false;

    try {
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text || undefined,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const data: any = await res.json().catch(() => ({}));
      return !!data.ok;
    } catch {
      return false;
    }
  }

  /**
   * Broadcast alert notification to all authorized system admins on Telegram
   */
  async notifyAdmins(text: string, serverId?: string): Promise<{ sent: number; failed: number }> {
    if (!this.botToken) return { sent: 0, failed: 0 };

    const authorizedAccounts = db.telegramAccounts.filter((a) => a.isAuthorized);
    let sent = 0;
    let failed = 0;

    for (const acc of authorizedAccounts) {
      // If serverId is given, check server permissions
      if (serverId && acc.allowedServerIds && acc.allowedServerIds.length > 0) {
        if (!acc.allowedServerIds.includes(serverId)) continue;
      }

      try {
        await this.sendMessage(acc.telegramUserId, text, { parse_mode: 'HTML' });
        sent++;
      } catch (err) {
        failed++;
      }
    }

    return { sent, failed };
  }

  /**
   * Get current operational status
   */
  getStatus(): TelegramBotStatus {
    const isConfigured = !!this.botToken;
    return {
      isConfigured,
      isActive: isConfigured && (this.isPolling || this.mode === 'WEBHOOK'),
      isPolling: this.isPolling,
      mode: this.mode,
      botInfo: this.botInfo,
      botUsername: this.botInfo?.username || db.telegramSettings?.botUsername || null,
      botFirstName: this.botInfo?.first_name || db.telegramSettings?.botFirstName || null,
      lastPollTime: this.lastPollTime,
      lastError: this.lastError,
      processedCount: this.processedCount,
    };
  }
}

export const telegramBotService = new TelegramBotService();
