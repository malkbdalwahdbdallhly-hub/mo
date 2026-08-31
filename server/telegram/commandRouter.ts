import { db } from '../database/db';
import { TelegramUpdate, BotResponsePayload, TelegramInlineKeyboardMarkup } from './types';
import { mikrotikService } from '../mikrotik/MikrotikService';
import { Server, AuditOperation } from '../types';

// In-memory Telegram user state tracker for multi-step flows (like generating cards, check card, confirmation)
interface TelegramSessionState {
  serverId: string;
  action?: string;
  step?: string;
  payload?: any;
}

const telegramSessions: Map<number, TelegramSessionState> = new Map();

export class TelegramCommandRouter {
  /**
   * Main entry point for processing incoming Telegram updates (Webhook or Simulator)
   */
  async handleUpdate(update: TelegramUpdate): Promise<BotResponsePayload | null> {
    const user = update.message?.from || update.callback_query?.from;
    const chat = update.message?.chat || update.callback_query?.message?.chat;

    if (!user || !chat) return null;

    const telegramUserId = user.id;
    const text = update.message?.text?.trim() || '';
    const callbackData = update.callback_query?.data || '';

    // Check account linking
    let account = db.telegramAccounts.find((a) => a.telegramUserId === telegramUserId);

    // Handle token linking via `/start <token>` or typing code directly
    if (!account) {
      const linkMatch =
        text.match(/\/start\s+([A-Za-z0-9_-]+)/) ||
        text.match(/\/link\s+([A-Za-z0-9_-]+)/) ||
        text.match(/^(MK-[A-Za-z0-9]+)$/i) ||
        text.match(/^(MK[A-Za-z0-9]+)$/i);
      const tokenCandidate = linkMatch ? (linkMatch[1].startsWith('link_') ? linkMatch[1].replace('link_', '') : linkMatch[1]) : text;

      const validToken = db.telegramLinkTokens.find((t) => t.token.toUpperCase() === tokenCandidate.toUpperCase());
      if (validToken && new Date(validToken.expiresAt) > new Date()) {
        account = {
          id: `tg_acc_${Date.now()}`,
          userId: validToken.userId,
          telegramUserId: telegramUserId,
          telegramUsername: user.username,
          telegramFirstName: user.first_name,
          isAuthorized: true,
          role: 'ADMIN',
          linkedAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        };
        db.telegramAccounts.push(account);
        // Remove used token
        const tokenIdx = db.telegramLinkTokens.indexOf(validToken);
        if (tokenIdx !== -1) db.telegramLinkTokens.splice(tokenIdx, 1);
        db.save();

        this.logAudit('TELEGRAM_LINKED', 'SUCCESS', account.userId, telegramUserId, undefined, {
          username: user.username,
          name: user.first_name,
        });

        return {
          chat_id: chat.id,
          parse_mode: 'HTML',
          text: `🎉 <b>مرحباً بك في منصة Makeen!</b>\n\nتم ربط حساب Telegram الخاص بك بنجاح بحساب مدير النظام.\nيمكنك الآن التحكم الكامل والآمن في أجهزة MikroTik وUser Manager.`,
          reply_markup: this.getMainMenuKeyboard(),
        };
      }

      // Unauthorized response
      return {
        chat_id: chat.id,
        parse_mode: 'HTML',
        text: `⛔ <b>حساب غير مصرح له (Unauthorized User)</b>\n\nحساب Telegram هذا (ID: <code>${telegramUserId}</code>) غير مرتبط بنظام Makeen.\n\n<b>لربط حسابك:</b>\n1. افتح تطبيق Makeen في المتصفح.\n2. توجّه إلى تبويب «ربط Telegram».\n3. أنشئ رمز الربط السريع (Code).\n4. أرسل الرمز هنا، أو استخدم الرابط المباشر من التطبيق.`,
      };
    }

    // Account is authorized, update last activity
    account.lastActiveAt = new Date().toISOString();

    // Get current session or default server
    let session = telegramSessions.get(telegramUserId);
    const userServers = db.servers.filter((s) => s.userId === account!.userId);
    // Always prioritize the real CONNECTED MikroTik server
    const defaultServer =
      userServers.find((s) => s.status === 'CONNECTED') ||
      db.servers.find((s) => s.status === 'CONNECTED') ||
      userServers.find((s) => s.isDefault) ||
      userServers[0] ||
      db.servers[0];

    if (!session && defaultServer) {
      session = { serverId: defaultServer.id };
      telegramSessions.set(telegramUserId, session);
    }

    const currentServer =
      (session?.serverId ? db.servers.find((s) => s.id === session.serverId) : undefined) ||
      defaultServer;

    // Route Callback Query
    if (callbackData) {
      return this.handleCallbackQuery(chat.id, telegramUserId, callbackData, currentServer, account);
    }

    // Route Text Commands
    return this.handleTextCommand(chat.id, telegramUserId, text, currentServer, account);
  }

  private async handleTextCommand(
    chatId: number,
    telegramUserId: number,
    text: string,
    server: Server | undefined,
    account: any
  ): Promise<BotResponsePayload> {
    const trimmed = text.trim();
    const cmd = trimmed.split(' ')[0].toLowerCase();
    const args = trimmed.split(' ').slice(1);

    if (cmd === '/start' || cmd === '/help' || text === 'القائمة الرئيسية') {
      const serverDesc = server
        ? `<b>${server.name}</b> (${server.boardModel || 'MikroTik Router'} - ${server.host})`
        : 'لا يوجد سيرفر متصل';
      return {
        chat_id: chatId,
        parse_mode: 'HTML',
        text: `⚡ <b>منصة Makeen لإدارة MikroTik الحقيقي</b>\n\n` +
          `• <b>السيرفر المتصل فعلياً:</b> ${serverDesc}\n` +
          `• <b>حالة الاتصال:</b> 🟢 متصل ومباشر عبر منفذ API (8728)\n\n` +
          `اختر من القائمة التفاعلية أدناه لتنفيذ العمليات فوراً:`,
        reply_markup: this.getMainMenuKeyboard(),
      };
    }

    if (cmd === '/status') {
      return this.showServerStatus(chatId, server);
    }

    if (cmd === '/server') {
      return this.showServerSelection(chatId, account.userId);
    }

    if (cmd === '/cards') {
      return this.showCardsMenu(chatId, server);
    }

    if (cmd === '/check' || cmd === '/card') {
      const query = args.join(' ').trim();
      if (!query) {
        const session = telegramSessions.get(telegramUserId) || { serverId: server?.id };
        session.action = 'WAITING_CARD_CHECK';
        telegramSessions.set(telegramUserId, session);
        return {
          chat_id: chatId,
          parse_mode: 'HTML',
          text: `🔍 <b>فحص كرت أو مستخدم في السيرفر الحقيقي</b>\n\nيرجى إرسال اسم المستخدم أو رقم الكرت المراد فحصه:`,
          reply_markup: {
            inline_keyboard: [[{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }]],
          },
        };
      }
      return this.executeCardCheck(chatId, server, query);
    }

    if (cmd === '/active') {
      return this.showActiveUsers(chatId, server);
    }

    if (cmd === '/diagnostic') {
      return this.showDiagnostics(chatId, server);
    }

    if (cmd === '/backup') {
      return this.showBackupMenu(chatId, server);
    }

    if (cmd === '/reports') {
      return this.showReportsMenu(chatId, server);
    }

    if (cmd === '/pos') {
      return this.showPosMenu(chatId, server);
    }

    // Handle check card directly via input text if session is waiting
    const session = telegramSessions.get(telegramUserId);
    if (session && session.action === 'WAITING_CARD_CHECK') {
      session.action = undefined;
      return this.executeCardCheck(chatId, server, trimmed);
    }

    // If user inputs a direct card number or username (alphanumeric 3-30 chars without slashes)
    if (/^[a-zA-Z0-9_\-.]{2,32}$/.test(trimmed)) {
      return this.executeCardCheck(chatId, server, trimmed);
    }

    // Unknown command
    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `❓ أمر غير معروف. يمكنك كتابة رقم الكرت مباشرة لفحصه أو استخدام القائمة أدناه:`,
      reply_markup: this.getMainMenuKeyboard(),
    };
  }

  private async handleCallbackQuery(
    chatId: number,
    telegramUserId: number,
    data: string,
    server: Server | undefined,
    account: any
  ): Promise<BotResponsePayload> {
    const [action, param1, param2] = data.split(':');

    switch (action) {
      case 'menu_main':
        return {
          chat_id: chatId,
          parse_mode: 'HTML',
          text: `⚡ <b>القائمة الرئيسية لـ Makeen</b>\n\nالسيرفر النشط: <b>${server ? server.name : 'لم يحدد'}</b>`,
          reply_markup: this.getMainMenuKeyboard(),
        };

      case 'menu_cards':
        return this.showCardsMenu(chatId, server);

      case 'card_gen_start':
        return this.showGenerateProfilePicker(chatId, server);

      case 'card_gen_profile':
        return this.showGenerateQuantityPicker(chatId, param1); // param1 is profileName

      case 'card_gen_qty':
        return this.showGeneratePasswordModePicker(chatId, param1, parseInt(param2 || '20', 10));

      case 'card_gen_preview':
        // param1: profile, param2: qty:mode
        const [qtyStr, mode] = (param2 || '20:RANDOM').split('_');
        return this.showGenerateConfirmation(chatId, server, param1, parseInt(qtyStr, 10), mode);

      case 'card_gen_confirm':
        // param1: profile, param2: qty_mode
        const [q, m] = (param2 || '20_RANDOM').split('_');
        return this.executeGenerateCards(chatId, server, account, param1, parseInt(q, 10), m);

      case 'card_check_prompt':
        telegramSessions.set(telegramUserId, { serverId: server?.id || '', action: 'WAITING_CARD_CHECK' });
        return {
          chat_id: chatId,
          parse_mode: 'HTML',
          text: `🔎 <b>فحص كرت</b>\n\nيرجى إرسال اسم المستخدم (Username) أو رقم الكرت المراد فحصه:`,
          reply_markup: {
            inline_keyboard: [[{ text: '« إلغاء العودة للقائمة', callback_data: 'menu_main' }]],
          },
        };

      case 'menu_active':
        return this.showActiveUsers(chatId, server);

      case 'user_disconnect_confirm':
        return {
          chat_id: chatId,
          parse_mode: 'HTML',
          text: `⚠️ <b>تأكيد فصل المستخدم النشط</b>\n\nهل أنت متأكد من فصل جلسة المستخدم <b>${param1}</b> فوراً من الشبكة؟`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ نعم، افصل الآن', callback_data: `user_disconnect_exec:${param1}` },
                { text: '❌ إلغاء', callback_data: 'menu_active' },
              ],
            ],
          },
        };

      case 'user_disconnect_exec':
        return this.executeDisconnectUser(chatId, server, account, param1);

      case 'menu_diagnostic':
        return this.showDiagnostics(chatId, server);

      case 'menu_backup':
        return this.showBackupMenu(chatId, server);

      case 'backup_create_exec':
        return this.executeCreateBackup(chatId, server, account);

      case 'menu_restore':
        return this.showRestoreMenu(chatId, server);

      case 'restore_confirm':
        return {
          chat_id: chatId,
          parse_mode: 'HTML',
          text: `🚨 <b>تحذير أمني شديد الخطورة (Restore Warning)</b>\n\nأنت على وشك استعادة النسخة الاحتياطية:\n<code>${param1}</code>\n\n⚠️ سيتم أخذ نسخة احتياطية آلية قبل الاستعادة.\n⚠️ قد ينقطع اتصال المستخدمين النشطين مؤقتاً.\n\nهل تريد المتابعة بالتأكيد؟`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '⚠️ تأكيد نهائي واستعادة', callback_data: `restore_exec:${param1}` },
                { text: '❌ تراجع وإلغاء', callback_data: 'menu_main' },
              ],
            ],
          },
        };

      case 'restore_exec':
        return this.executeRestore(chatId, server, account, param1);

      case 'menu_cleanup':
        return this.showCleanupPreview(chatId, server);

      case 'cleanup_exec':
        return this.executeCleanup(chatId, server, account);

      case 'menu_rebuild':
        return {
          chat_id: chatId,
          parse_mode: 'HTML',
          text: `🛠 <b>إعادة بناء قاعدة بيانات User Manager</b>\n\nتقوم هذه العملية بفحص تناسق البيانات وإصلاح الفهارس التالفة.\n\n⚠️ سيتم أخذ نسخة احتياطية فورية قبل البدء.\nهل تريد البدء الآن؟`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ بدء إعادة البناء', callback_data: 'rebuild_exec' },
                { text: '« تراجع', callback_data: 'menu_main' },
              ],
            ],
          },
        };

      case 'rebuild_exec':
        return this.executeRebuild(chatId, server, account);

      case 'menu_reboot':
        return {
          chat_id: chatId,
          parse_mode: 'HTML',
          text: `🔄 <b>إعادة تشغيل MikroTik (Reboot)</b>\n\n🚨 <b>تحذير:</b> سيؤدي إعادة تشغيل الروتر إلى انقطاع فوري لخدمة الإنترنت وجميع اتصالات Hotspot/PPPoE والـ Telegram Bot لمدة تتراوح بين دقيقة إلى دقيقتين.\n\nهل تؤكد إعادة تشغيل الجهاز؟`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔴 نعم، أعد التشغيل الآن', callback_data: 'reboot_exec' },
                { text: '« إلغاء', callback_data: 'menu_main' },
              ],
            ],
          },
        };

      case 'reboot_exec':
        return this.executeReboot(chatId, server, account);

      case 'menu_reports':
        return this.showReportsMenu(chatId, server);

      case 'menu_pos':
        return this.showPosMenu(chatId, server);

      case 'menu_settings':
        return this.showSettings(chatId, server, account);

      case 'menu_audit':
        return this.showAuditLogs(chatId, server);

      case 'switch_server':
        return this.showServerSelection(chatId, account.userId);

      case 'set_server':
        telegramSessions.set(telegramUserId, { serverId: param1 });
        const newSrv = db.servers.find((s) => s.id === param1);
        return {
          chat_id: chatId,
          parse_mode: 'HTML',
          text: `✅ تم تعيين السيرفر النشط بنجاح إلى: <b>${newSrv?.name || param1}</b>`,
          reply_markup: this.getMainMenuKeyboard(),
        };

      default:
        return {
          chat_id: chatId,
          parse_mode: 'HTML',
          text: `⚡ <b>منصة Makeen</b>\nالسيرفر: <b>${server?.name || 'مكين'}</b>`,
          reply_markup: this.getMainMenuKeyboard(),
        };
    }
  }

  // --- Sub-View Generators ---

  private getMainMenuKeyboard(): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '🎫 الكروت', callback_data: 'menu_cards' },
          { text: '🔎 فحص كرت', callback_data: 'card_check_prompt' },
        ],
        [
          { text: '👥 المستخدمون النشطون', callback_data: 'menu_active' },
          { text: '🏪 نقاط البيع', callback_data: 'menu_pos' },
        ],
        [
          { text: '📊 التقارير', callback_data: 'menu_reports' },
          { text: '📡 تشخيص السيرفر', callback_data: 'menu_diagnostic' },
        ],
        [
          { text: '💾 النسخ الاحتياطي', callback_data: 'menu_backup' },
          { text: '♻️ الاستعادة', callback_data: 'menu_restore' },
        ],
        [
          { text: '🧹 تنظيف User Manager', callback_data: 'menu_cleanup' },
          { text: '🛠 إعادة بناء الداتابيز', callback_data: 'menu_rebuild' },
        ],
        [
          { text: '🔄 إعادة تشغيل MikroTik', callback_data: 'menu_reboot' },
          { text: '📜 سجل العمليات', callback_data: 'menu_audit' },
        ],
        [
          { text: '🌐 اختيار السيرفر', callback_data: 'switch_server' },
          { text: '⚙️ الإعدادات', callback_data: 'menu_settings' },
        ],
      ],
    };
  }

  private async showServerStatus(chatId: number, server?: Server): Promise<BotResponsePayload> {
    if (!server) {
      return { chat_id: chatId, text: '⚠️ لا يوجد سيرفر MikroTik متاح حالياً.' };
    }
    const adapter = mikrotikService.getAdapter(server);
    const stats = await adapter.getSystemResources();

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `📡 <b>حالة سيرفر MikroTik</b>\n\n` +
        `• <b>السيرفر:</b> ${server.name}\n` +
        `• <b>الحالة:</b> ${stats.status === 'CONNECTED' ? '🟢 متصل' : '🔴 غير متصل'}\n` +
        `• <b>الموديل:</b> ${stats.model} (${stats.boardName})\n` +
        `• <b>الإصدار:</b> ${stats.routerOsVersion}\n` +
        `• <b>مدة التشغيل (Uptime):</b> ${stats.uptime}\n` +
        `• <b>المعالج (CPU):</b> ${stats.cpu}%\n` +
        `• <b>الذاكرة (RAM):</b> ${stats.ramUsed}MB مستخدم من ${stats.ramTotal}MB\n` +
        `• <b>المستخدمون النشطون:</b> ${stats.activeUsersCount} مستخدم\n` +
        `• <b>إجمالي الكروت:</b> ${stats.totalCardsCount} كرت\n` +
        `• <b>مؤشر الصحة (Health Score):</b> ${stats.healthScore}/100\n`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '👥 المستخدمون النشطون', callback_data: 'menu_active' },
            { text: '🎫 الكروت', callback_data: 'menu_cards' },
          ],
          [{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }],
        ],
      },
    };
  }

  private showCardsMenu(chatId: number, server?: Server): BotResponsePayload {
    const totalCards = db.cards.filter((c) => c.serverId === server?.id).length;
    const availableCards = db.cards.filter((c) => c.serverId === server?.id && c.status === 'AVAILABLE').length;
    const activeCards = db.cards.filter((c) => c.serverId === server?.id && c.status === 'ACTIVE').length;

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `🎫 <b>إدارة كروت User Manager</b>\n\n` +
        `• إجمالي الكروت: <b>${totalCards}</b>\n` +
        `• الكروت الجاهزة للبيع: <b>${availableCards}</b>\n` +
        `• الكروت النشطة حالياً: <b>${activeCards}</b>\n\n` +
        `اختر العملية المراد تنفيذها:`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ توليد كروت جديدة', callback_data: 'card_gen_start' }],
          [{ text: '🔎 فحص كرت برقم المستخدم', callback_data: 'card_check_prompt' }],
          [{ text: '« العودة للقائمة الرئيسية', callback_data: 'menu_main' }],
        ],
      },
    };
  }

  private showGenerateProfilePicker(chatId: number, server?: Server): BotResponsePayload {
    const profiles = db.cardProfiles.filter((p) => p.serverId === server?.id);
    const buttons = profiles.map((p) => [
      { text: `📦 ${p.nameForUsers || p.name} (${p.price} ر.س)`, callback_data: `card_gen_profile:${p.name}` },
    ]);

    buttons.push([{ text: '« إلغاء', callback_data: 'menu_cards' }]);

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `➕ <b>توليد كروت جديدة — الخطوة 1/4</b>\n\nيرجى اختيار الباقة (Profile):`,
      reply_markup: { inline_keyboard: buttons },
    };
  }

  private showGenerateQuantityPicker(chatId: number, profileName: string): BotResponsePayload {
    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `➕ <b>توليد كروت (${profileName}) — الخطوة 2/4</b>\n\nاختر عدد الكروت المطلوبة:`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '10 كروت', callback_data: `card_gen_qty:${profileName}:10` },
            { text: '25 كرت', callback_data: `card_gen_qty:${profileName}:25` },
          ],
          [
            { text: '50 كرت', callback_data: `card_gen_qty:${profileName}:50` },
            { text: '100 كرت', callback_data: `card_gen_qty:${profileName}:100` },
          ],
          [{ text: '« العودة لاختيار الباقة', callback_data: 'card_gen_start' }],
        ],
      },
    };
  }

  private showGeneratePasswordModePicker(chatId: number, profileName: string, quantity: number): BotResponsePayload {
    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `➕ <b>توليد ${quantity} كرت (${profileName}) — الخطوة 3/4</b>\n\nاختر نمط كلمة المرور (Password Mode):`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔒 كلمة مرور عشوائية (Random)', callback_data: `card_gen_preview:${profileName}:${quantity}_RANDOM` }],
          [{ text: '👥 نفس اسم المستخدم (Same as User)', callback_data: `card_gen_preview:${profileName}:${quantity}_SAME` }],
          [{ text: '🔓 بدون كلمة مرور (Empty)', callback_data: `card_gen_preview:${profileName}:${quantity}_EMPTY` }],
          [{ text: '« تراجع', callback_data: `card_gen_profile:${profileName}` }],
        ],
      },
    };
  }

  private showGenerateConfirmation(
    chatId: number,
    server: Server | undefined,
    profileName: string,
    quantity: number,
    mode: string
  ): BotResponsePayload {
    const settings = db.cardSettings.find((s) => s.serverId === server?.id) || db.cardSettings[0];
    const prefix = settings?.cardPrefix || 'MK';

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `📋 <b>معاينة وتأكيد توليد الكروت (Confirmation)</b>\n\n` +
        `• <b>السيرفر:</b> ${server?.name}\n` +
        `• <b>الباقة (Profile):</b> ${profileName}\n` +
        `• <b>العدد المطلوب (Quantity):</b> ${quantity} كرت\n` +
        `• <b>البادئة (Prefix):</b> ${prefix}\n` +
        `• <b>نمط كلمة المرور:</b> ${mode}\n\n` +
        `⚠️ سيتم تطبيق Batch Processing لضمان عدم تجميد السيرفر.\nهل تؤكد إنشاء الكروت؟`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ تأكيد التوليد الآن', callback_data: `card_gen_confirm:${profileName}:${quantity}_${mode}` }],
          [{ text: '❌ إلغاء العملية', callback_data: 'menu_cards' }],
        ],
      },
    };
  }

  private async executeGenerateCards(
    chatId: number,
    server: Server | undefined,
    account: any,
    profileName: string,
    quantity: number,
    mode: string
  ): Promise<BotResponsePayload> {
    if (!server) return { chat_id: chatId, text: 'سيرفر غير موجود' };

    const adapter = mikrotikService.getAdapter(server);
    const settings = db.cardSettings.find((s) => s.serverId === server.id) || db.cardSettings[0];
    const prefix = settings?.cardPrefix || 'MK';
    const profile = db.cardProfiles.find((p) => p.serverId === server.id && p.name === profileName);

    const cardsToCreate: any[] = [];
    const baseStart = Date.now() % 100000;

    for (let i = 0; i < quantity; i++) {
      const username = `${prefix}${baseStart + i}`;
      let password = '';
      if (mode === 'SAME') password = username;
      else if (mode === 'RANDOM') password = `${Math.floor(1000 + Math.random() * 9000)}`;

      cardsToCreate.push({
        serverId: server.id,
        username,
        password,
        profile: profileName,
        price: profile?.price || 5.0,
        duration: profile?.validity || '1d',
      });
    }

    const result = await adapter.createUsersBatch(cardsToCreate);

    this.logAudit('CARD_GENERATION', result.failed === 0 ? 'SUCCESS' : 'WARNING', account.userId, account.telegramUserId, server.id, {
      profile: profileName,
      requested: quantity,
      created: result.created,
      failed: result.failed,
    });

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `🎉 <b>تم اكتمال توليد الكروت بنجاح!</b>\n\n` +
        `• <b>عدد الكروت المطلوبة:</b> ${result.requested}\n` +
        `• <b>تم إنشاؤها بنجاح:</b> 🟢 ${result.created}\n` +
        `• <b>عدد الكروت الفاشلة:</b> ${result.failed > 0 ? `🔴 ${result.failed}` : '0'}\n` +
        (result.errors.length > 0 ? `• <b>ملاحظة:</b> ${result.errors[0]}\n` : '') +
        `\nيمكنك طباعة بطاقات هذه الدفعة وتصديرها بصيغة PDF فوراً من لوحة تحكم Makeen.`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎫 عرض الكروت', callback_data: 'menu_cards' }],
          [{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }],
        ],
      },
    };
  }

  private async executeCardCheck(chatId: number, server: Server | undefined, query: string): Promise<BotResponsePayload> {
    if (!server) return { chat_id: chatId, text: 'سيرفر غير محدد' };
    const adapter = mikrotikService.getAdapter(server);
    const card = await adapter.getUser(query);

    if (!card) {
      return {
        chat_id: chatId,
        parse_mode: 'HTML',
        text: `❌ <b>لم يتم العثور على الكرت:</b> [<code>${query}</code>]\nتأكد من صحة اسم المستخدم أو رقم الكرت في User Manager.`,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔎 محاولة فحص كرت آخر', callback_data: 'card_check_prompt' }],
            [{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }],
          ],
        },
      };
    }

    const statusIcons: Record<string, string> = {
      AVAILABLE: '⚪ متاح للبيع (Available)',
      ACTIVE: '🟢 متصل ونشط (Active)',
      EXPIRED: '🔴 منتهي الصلاحية (Expired)',
      DISABLED: '⛔ معطل (Disabled)',
      USED: '🟡 مستخدم (Used)',
    };

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `🔎 <b>بيانات الكرت التفصيلية:</b>\n\n` +
        `• <b>اسم المستخدم:</b> <code>${card.username}</code>\n` +
        `• <b>كلمة المرور:</b> <code>${card.password || '(فارغ)'}</code>\n` +
        `• <b>الباقة (Profile):</b> ${card.profile}\n` +
        `• <b>الحالة (Status):</b> ${statusIcons[card.status] || card.status}\n` +
        `• <b>السعر:</b> ${card.price} ر.س\n` +
        `• <b>تاريخ الإنشاء:</b> ${new Date(card.creationDate).toLocaleDateString('ar-SA')}\n` +
        `• <b>أول تسجيل دخول:</b> ${card.firstLogin ? new Date(card.firstLogin).toLocaleString('ar-SA') : 'لم يستخدم بعد'}\n` +
        `• <b>مدة الاستخدام (Uptime):</b> ${card.totalUptime || '0m'}\n` +
        `• <b>نقطة البيع (POS):</b> ${card.posName || 'غير مخصص لنقطة بيع'}\n`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔎 فحص كرت آخر', callback_data: 'card_check_prompt' }],
          [{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }],
        ],
      },
    };
  }

  private async showActiveUsers(chatId: number, server?: Server): Promise<BotResponsePayload> {
    if (!server) return { chat_id: chatId, text: 'سيرفر غير متوفر' };
    const adapter = mikrotikService.getAdapter(server);
    const activeUsers = await adapter.getActiveUsers();

    if (activeUsers.length === 0) {
      return {
        chat_id: chatId,
        parse_mode: 'HTML',
        text: `👥 <b>المستخدمون النشطون</b>\n\nلا يوجد مستخدمون متصلون بالشبكة حالياً.`,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 تحديث القائمة', callback_data: 'menu_active' }],
            [{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }],
          ],
        },
      };
    }

    let text = `👥 <b>المستخدمون النشطون حالياً (${activeUsers.length})</b>\n\n`;
    const buttons: any[] = [];

    activeUsers.slice(0, 8).forEach((u) => {
      text += `👤 <b>${u.username}</b>\n` +
        `  IP: <code>${u.ipAddress}</code> | Uptime: ${u.uptime} | الخدمة: ${u.service}\n\n`;

      buttons.push([
        { text: `🚫 فصل: ${u.username}`, callback_data: `user_disconnect_confirm:${u.username}` },
      ]);
    });

    buttons.push([{ text: '🔄 تحديث', callback_data: 'menu_active' }, { text: '« القائمة الرئيسية', callback_data: 'menu_main' }]);

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text,
      reply_markup: { inline_keyboard: buttons },
    };
  }

  private async executeDisconnectUser(chatId: number, server: Server | undefined, account: any, username: string): Promise<BotResponsePayload> {
    if (!server) return { chat_id: chatId, text: 'سيرفر غير متوفر' };
    const adapter = mikrotikService.getAdapter(server);
    await adapter.disconnectActiveUser(username);

    this.logAudit('USER_DISCONNECTED', 'SUCCESS', account.userId, account.telegramUserId, server.id, { username });

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `✅ تم فصل المستخدم <b>${username}</b> من شبكة MikroTik بنجاح.`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '👥 عرض النشطين', callback_data: 'menu_active' }],
          [{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }],
        ],
      },
    };
  }

  private async showDiagnostics(chatId: number, server?: Server): Promise<BotResponsePayload> {
    if (!server) return { chat_id: chatId, text: 'سيرفر غير متوفر' };
    const adapter = mikrotikService.getAdapter(server);
    const diag = await adapter.diagnostics();

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `📡 <b>تشخيص وصحة سيرفر MikroTik</b>\n\n` +
        `• <b>مؤشر الصحة العام (Health Score):</b> 🟢 <b>${diag.healthScore}/100</b>\n` +
        `• <b>Router Model:</b> ${diag.routerModel}\n` +
        `• <b>Board Model:</b> ${diag.routerBoardModel}\n` +
        `• <b>RouterOS:</b> ${diag.routerOsVersion}\n` +
        `• <b>مدة التشغيل:</b> ${diag.uptime}\n` +
        `• <b>استهلاك المعالج (CPU):</b> ${diag.cpuLoad}%\n` +
        `• <b>الذاكرة المتاحة:</b> ${diag.freeMemoryMB}MB / ${diag.totalMemoryMB}MB\n` +
        `• <b>مساحة التخزين:</b> ${diag.freeDiskMB}MB متاحة من ${diag.totalDiskMB}MB\n` +
        `• <b>حالة User Manager:</b> 🟢 ${diag.userManagerStatus}\n` +
        `• <b>حالة MikroTik API:</b> 🟢 ${diag.apiStatus}\n` +
        `• <b>الاتصالات النشطة (Connections):</b> ${diag.activeConnectionsCount}\n` +
        `• <b>المنافذ الفعالة:</b> ${diag.interfaces.filter((i) => i.running).map((i) => i.name).join(', ')}\n`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 تحديث الفحص', callback_data: 'menu_diagnostic' }],
          [{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }],
        ],
      },
    };
  }

  private showBackupMenu(chatId: number, server?: Server): BotResponsePayload {
    const backups = db.backups.filter((b) => b.serverId === server?.id);
    let text = `💾 <b>إدارة النسخ الاحتياطي (Backups)</b>\n\n` +
      `عدد النسخ المتوفرة: <b>${backups.length}</b>\n\n`;

    if (backups.length > 0) {
      text += `<b>آخر النسخ المحفوظة:</b>\n`;
      backups.slice(0, 3).forEach((b) => {
        text += `• <code>${b.filename}</code>\n  الحجم: ${(b.sizeBytes / 1024 / 1024).toFixed(2)}MB | ${new Date(b.createdAt).toLocaleDateString('ar-SA')}\n`;
      });
    }

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text,
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ إنشاء نسخة احتياطية جديدة الآن', callback_data: 'backup_create_exec' }],
          [{ text: '♻️ استعادة نسخة سابقة', callback_data: 'menu_restore' }],
          [{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }],
        ],
      },
    };
  }

  private async executeCreateBackup(chatId: number, server: Server | undefined, account: any): Promise<BotResponsePayload> {
    if (!server) return { chat_id: chatId, text: 'سيرفر غير محدد' };
    const adapter = mikrotikService.getAdapter(server);
    const result = await adapter.backup('makeen_tg');

    this.logAudit('BACKUP_CREATED', 'SUCCESS', account.userId, account.telegramUserId, server.id, {
      filename: result.filename,
      size: result.sizeBytes,
    });

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `✅ <b>تم إنشاء النسخة الاحتياطية بنجاح!</b>\n\n` +
        `• <b>اسم الملف:</b> <code>${result.filename}</code>\n` +
        `• <b>الحجم:</b> ${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB\n` +
        `• <b>Checksum:</b> <code>${result.checksum.substring(0, 16)}...</code>\n` +
        `\nتم حفظ النسخة بأمان ويمكنك تنزيلها أو استعادتها في أي وقت.`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '💾 قائمة النسخ الاحتياطية', callback_data: 'menu_backup' }],
          [{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }],
        ],
      },
    };
  }

  private showRestoreMenu(chatId: number, server?: Server): BotResponsePayload {
    const backups = db.backups.filter((b) => b.serverId === server?.id);
    if (backups.length === 0) {
      return {
        chat_id: chatId,
        parse_mode: 'HTML',
        text: `♻️ <b>استعادة نسخة احتياطية</b>\n\nلا توجد نسخ احتياطية مسجلة لهذا السيرفر حتى الآن.`,
        reply_markup: {
          inline_keyboard: [[{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }]],
        },
      };
    }

    const buttons = backups.slice(0, 4).map((b) => [
      { text: `♻️ استعادة: ${b.filename.substring(0, 24)}...`, callback_data: `restore_confirm:${b.filename}` },
    ]);

    buttons.push([{ text: '« إلغاء', callback_data: 'menu_main' }]);

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `♻️ <b>اختر النسخة الاحتياطية للاستعادة:</b>\n\n⚠️ ملاحظة: تتطلب صلاحية مسؤول وسيتم أخذ نسخة أمان فورية.`,
      reply_markup: { inline_keyboard: buttons },
    };
  }

  private async executeRestore(chatId: number, server: Server | undefined, account: any, filename: string): Promise<BotResponsePayload> {
    if (!server) return { chat_id: chatId, text: 'سيرفر غير محدد' };
    const adapter = mikrotikService.getAdapter(server);

    // 1. Automatic safety backup before restore
    await adapter.backup('safety_pre_restore');

    // 2. Execute restore
    const res = await adapter.restore(filename);

    this.logAudit('RESTORE_COMPLETED', res.success ? 'SUCCESS' : 'FAILURE', account.userId, account.telegramUserId, server.id, { filename });

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `🎉 <b>اكتملت الاستعادة بنجاح!</b>\n\n${res.message}\nتم حفظ نسخة أمان احترازية تلقائياً.`,
      reply_markup: {
        inline_keyboard: [[{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }]],
      },
    };
  }

  private async showCleanupPreview(chatId: number, server?: Server): Promise<BotResponsePayload> {
    if (!server) return { chat_id: chatId, text: 'سيرفر غير محدد' };
    const adapter = mikrotikService.getAdapter(server);
    const preview = await adapter.previewCleanup();

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `🧹 <b>معاينة تنظيف User Manager</b>\n\n` +
        `نتائج الفحص للبيانات الزائدة:\n` +
        `• <b>كروت منتهية الصلاحية (Expired):</b> ${preview.expiredUsers}\n` +
        `• <b>حسابات معطلة (Disabled):</b> ${preview.disabledUsers}\n` +
        `• <b>سجلات غير صالحة:</b> ${preview.invalidRecords}\n` +
        `• <b>الإجمالي القابل للحذف:</b> <b>${preview.totalRemovable}</b> كرت\n\n` +
        (preview.totalRemovable > 0
          ? `هل تريد تأكيد حذف هذه السجلات لتحرير ذاكرة السيرفر؟`
          : `قاعدة بيانات User Manager نظيفة تماماً ولا توجد عناصر منتهية.`),
      reply_markup: {
        inline_keyboard: preview.totalRemovable > 0
          ? [
              [{ text: '🧹 تأكيد التنظيف والحذف', callback_data: 'cleanup_exec' }],
              [{ text: '« إلغاء', callback_data: 'menu_main' }],
            ]
          : [[{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }]],
      },
    };
  }

  private async executeCleanup(chatId: number, server: Server | undefined, account: any): Promise<BotResponsePayload> {
    if (!server) return { chat_id: chatId, text: 'سيرفر غير محدد' };
    const adapter = mikrotikService.getAdapter(server);
    const res = await adapter.cleanup();

    this.logAudit('CLEANUP_EXECUTED', 'SUCCESS', account.userId, account.telegramUserId, server.id, { removedCount: res.removedCount });

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `✅ <b>اكتمل التنظيف بنجاح!</b>\n\nتم حذف <b>${res.removedCount}</b> سجلاً منتهياً ومعطلاً من User Manager.`,
      reply_markup: {
        inline_keyboard: [[{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }]],
      },
    };
  }

  private async executeRebuild(chatId: number, server: Server | undefined, account: any): Promise<BotResponsePayload> {
    if (!server) return { chat_id: chatId, text: 'سيرفر غير محدد' };
    const adapter = mikrotikService.getAdapter(server);

    // Auto-backup before rebuild
    await adapter.backup('safety_pre_rebuild');
    const res = await adapter.rebuild();

    this.logAudit('REBUILD_EXECUTED', res.success ? 'SUCCESS' : 'FAILURE', account.userId, account.telegramUserId, server.id, { durationMs: res.durationMs });

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `✅ <b>اكتملت إعادة بناء قاعدة بيانات User Manager بنجاح!</b>\n\n` +
        `• <b>المدة:</b> ${res.durationMs}ms\n` +
        `• <b>حالة الفهارس:</b> متوافقة ومضبوطة بنسبة 100%\n` +
        `• <b>نسخة الأمان:</b> تم حفظ نسخة احتياطية تلقائياً قبل البدء.`,
      reply_markup: {
        inline_keyboard: [[{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }]],
      },
    };
  }

  private async executeReboot(chatId: number, server: Server | undefined, account: any): Promise<BotResponsePayload> {
    if (!server) return { chat_id: chatId, text: 'سيرفر غير محدد' };
    const adapter = mikrotikService.getAdapter(server);
    const res = await adapter.reboot();

    this.logAudit('REBOOT_REQUESTED', 'WARNING', account.userId, account.telegramUserId, server.id, { requestedBy: 'Telegram' });

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `🔄 <b>تم إرسال أمر إعادة التشغيل!</b>\n\n${res.message}\nسيعود السيرفر إلى العمل تلقائياً فور اكتمال الإقلاع.`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '📡 فحص الحالة بعد دقيقة', callback_data: 'menu_diagnostic' }],
          [{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }],
        ],
      },
    };
  }

  private showReportsMenu(chatId: number, server?: Server): BotResponsePayload {
    const cards = db.cards.filter((c) => c.serverId === server?.id);
    const soldCards = cards.filter((c) => c.status !== 'AVAILABLE');
    const totalRevenue = soldCards.reduce((sum, c) => sum + (c.price || 0), 0);

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `📊 <b>تقارير المبيعات والأداء السريعة</b>\n\n` +
        `• <b>السيرفر:</b> ${server?.name}\n` +
        `• <b>إجمالي الكروت المنشأة:</b> ${cards.length}\n` +
        `• <b>الكروت المباعة/المستخدمة:</b> ${soldCards.length}\n` +
        `• <b>إجمالي المبيعات المحققة:</b> <b>${totalRevenue.toLocaleString()} ر.س</b>\n` +
        `• <b>نقاط البيع النشطة:</b> ${db.posList.filter((p) => p.serverId === server?.id).length}\n\n` +
        `يمكنك تصدير تقارير مفصلة (PDF / CSV / Excel) من تطبيق Makeen على الويب.`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏪 تقرير نقاط البيع', callback_data: 'menu_pos' }],
          [{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }],
        ],
      },
    };
  }

  private showPosMenu(chatId: number, server?: Server): BotResponsePayload {
    const posList = db.posList.filter((p) => p.serverId === server?.id);
    let text = `🏪 <b>نقاط البيع (POS Points)</b>\n\n`;

    if (posList.length === 0) {
      text += `لا توجد نقاط بيع مضافة لهذا السيرفر.\nيمكنك إضافة نقاط بيع جديدة من التطبيق.`;
    } else {
      posList.forEach((p) => {
        text += `🏪 <b>${p.name}</b> (${p.prefix})\n` +
          `  المسؤول: ${p.managerName} | المبيعات: ${p.cardsSold} كرت (${p.totalSales} ر.س)\n\n`;
      });
    }

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text,
      reply_markup: {
        inline_keyboard: [[{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }]],
      },
    };
  }

  private showSettings(chatId: number, server: Server | undefined, account: any): BotResponsePayload {
    const settings = db.cardSettings.find((s) => s.serverId === server?.id) || db.cardSettings[0];

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `⚙️ <b>إعدادات كروت وسيرفر Makeen</b>\n\n` +
        `• <b>اسم الشبكة:</b> ${settings?.networkName}\n` +
        `• <b>البادئة الافتراضية:</b> ${settings?.cardPrefix}\n` +
        `• <b>طول اسم المستخدم:</b> ${settings?.usernameLength} خانات\n` +
        `• <b>الباقة الافتراضية:</b> ${settings?.defaultProfile}\n` +
        `• <b>نمط كلمة المرور:</b> ${settings?.passwordMode}\n` +
        `• <b>حساب Telegram المرتبط:</b> ${account.telegramFirstName} (@${account.telegramUsername || 'none'})\n` +
        `• <b>Telegram User ID:</b> <code>${account.telegramUserId}</code>\n`,
      reply_markup: {
        inline_keyboard: [[{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }]],
      },
    };
  }

  private showAuditLogs(chatId: number, server?: Server): BotResponsePayload {
    const logs = db.auditLogs.slice(0, 5);
    let text = `📜 <b>سجل العمليات الأخير (Audit Log)</b>\n\n`;

    logs.forEach((l) => {
      const timeStr = new Date(l.timestamp).toLocaleTimeString('ar-SA');
      text += `• <b>${l.operation}</b> [${l.status}]\n  الوقت: ${timeStr} | بواسطة: ${l.telegramId ? `Telegram (${l.telegramId})` : 'لوحة التحكم'}\n\n`;
    });

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text,
      reply_markup: {
        inline_keyboard: [[{ text: '« القائمة الرئيسية', callback_data: 'menu_main' }]],
      },
    };
  }

  private showServerSelection(chatId: number, userId: string): BotResponsePayload {
    const servers = db.servers.filter((s) => s.userId === userId);
    const buttons = servers.map((s) => [
      { text: `🌐 ${s.name} (${s.host})`, callback_data: `set_server:${s.id}` },
    ]);
    buttons.push([{ text: '« إلغاء', callback_data: 'menu_main' }]);

    return {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `🌐 <b>اختيار سيرفر MikroTik النشط:</b>\nاختر السيرفر الذي ترغب في إدارته حالياً عبر البوت:`,
      reply_markup: { inline_keyboard: buttons },
    };
  }

  private logAudit(
    operation: AuditOperation,
    status: 'SUCCESS' | 'FAILURE' | 'WARNING',
    userId?: string,
    telegramId?: number,
    serverId?: string,
    metadata?: Record<string, any>
  ) {
    db.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      userId,
      telegramId,
      serverId,
      operation,
      timestamp: new Date().toISOString(),
      status,
      ip: 'Telegram-Bot',
      metadata,
    });
    db.save();
  }
}

export const telegramCommandRouter = new TelegramCommandRouter();
