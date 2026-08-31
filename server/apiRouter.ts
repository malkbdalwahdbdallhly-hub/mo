import { Router, Response } from 'express';
import { authService } from './services/authService';
import { serverService } from './services/serverService';
import { cardService } from './services/cardService';
import { posService } from './services/posService';
import { reportService } from './services/reportService';
import { telegramService } from './services/telegramService';
import { auditService } from './services/auditService';
import { jobQueue } from './jobs/jobQueue';
import { telegramCommandRouter } from './telegram/commandRouter';
import { telegramBotService } from './telegram/telegramBotService';
import { authenticate, requireRole, rateLimit, AuthenticatedRequest } from './middleware/authMiddleware';
import { probeMikrotik } from './mikrotik/RouterOSClient';

export const apiRouter = Router();

// --- Auth Routes ---
apiRouter.post('/auth/register', rateLimit(10, 60000), async (req, res) => {
  try {
    const { email, name, password } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة (الاسم، البريد، كلمة المرور).' });
    }
    const result = await authService.register(email, name, password);
    auditService.log('SETTINGS_UPDATED', 'SUCCESS', result.user.id, undefined, undefined, req.ip, { action: 'REGISTER' });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/auth/login', rateLimit(15, 60000), async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.' });
    }
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/auth/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const user = authService.getUserById(req.user!.userId);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  res.json({ user });
});

apiRouter.post('/auth/change-password', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'يرجى إدخال كلمة المرور الحالية والجديدة.' });
    }
    await authService.changePassword(req.user!.userId, currentPassword, newPassword);
    auditService.log('SETTINGS_UPDATED', 'SUCCESS', req.user!.userId, undefined, undefined, req.ip, { action: 'PASSWORD_CHANGE' });
    res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/auth/recovery', rateLimit(5, 60000), async (req, res) => {
  const { email } = req.body;
  const result = await authService.requestPasswordRecovery(email || '');
  res.json(result);
});

// --- Server Management Routes ---
apiRouter.get('/servers', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const servers = await serverService.getServers(req.user!.userId);
  res.json({ servers });
});

apiRouter.post('/servers', authenticate, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, host, apiPort, apiSslPort, sshPort, username, password, connectionType, osVersion } = req.body;
    if (!name || !host || !username) {
      return res.status(400).json({ error: 'اسم السيرفر وعنوان المضيف واسم المستخدم حقول إجبارية.' });
    }
    const server = await serverService.createServer(req.user!.userId, {
      name,
      host,
      apiPort: apiPort ? parseInt(apiPort, 10) : undefined,
      apiSslPort: apiSslPort ? parseInt(apiSslPort, 10) : undefined,
      sshPort: sshPort ? parseInt(sshPort, 10) : undefined,
      username,
      password,
      connectionType,
      osVersion,
    });
    auditService.log('SERVER_CREATED', 'SUCCESS', req.user!.userId, undefined, server.id, req.ip, { name, host });
    res.json({ server });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/servers/:id', authenticate, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const server = await serverService.updateServer(req.params.id, req.user!.userId, req.body);
    auditService.log('SERVER_UPDATED', 'SUCCESS', req.user!.userId, undefined, server.id, req.ip);
    res.json({ server });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/servers/:id', authenticate, requireRole('OWNER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await serverService.deleteServer(req.params.id, req.user!.userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/servers/probe', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { host, username, password, apiPort, apiSslPort, connectionType, osVersion } = req.body;
    if (!host || !username) {
      return res.status(400).json({ success: false, message: 'عنوان المضيف واسم المستخدم مطلوبان.' });
    }
    const result = await probeMikrotik({
      host,
      username,
      password,
      apiPort: apiPort ? parseInt(apiPort, 10) : undefined,
      apiSslPort: apiSslPort ? parseInt(apiSslPort, 10) : undefined,
      connectionType,
      osVersion,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.post('/servers/:id/test', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await serverService.testConnection(req.params.id, req.user!.userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

apiRouter.post('/servers/:id/state', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.body;
    const server = await serverService.setServerStatus(req.params.id, req.user!.userId, status);
    auditService.log('SERVER_CONNECTED', 'SUCCESS', req.user!.userId, undefined, server.id, req.ip, { status });
    res.json({ server });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/servers/:id/status', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await serverService.getServerStats(req.params.id, req.user!.userId);
    res.json({ stats });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/servers/:id/diagnostics', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const server = await serverService.getServerById(req.params.id, req.user!.userId);
    if (!server) return res.status(404).json({ error: 'السيرفر غير موجود' });
    const stats = await serverService.getServerStats(req.params.id, req.user!.userId);
    res.json({ stats });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Cards & Profiles ---
apiRouter.get('/servers/:id/cards', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, posId, search } = req.query;
    const cards = await cardService.getCards(req.params.id, {
      status: status as string,
      posId: posId as string,
      search: search as string,
    });
    res.json({ cards });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/servers/:id/cards/check', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم أو رقم الكرت.' });
    const card = await cardService.checkCard(req.params.id, query);
    res.json({ card });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/servers/:id/cards/generate', authenticate, requireRole('OPERATOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { profileName, quantity, prefix, passwordMode, startingNumber, customPassword, digitsCount, usernameLength, posId } = req.body;
    if (!profileName || !quantity) {
      return res.status(400).json({ error: 'الباقة وعدد الكروت حقول مطلوبة.' });
    }

    const result = await cardService.generateCardsBatch(req.params.id, req.user!.userId, {
      profileName,
      quantity: parseInt(quantity, 10),
      prefix,
      digitsCount: digitsCount ? parseInt(digitsCount, 10) : (usernameLength ? parseInt(usernameLength, 10) : undefined),
      passwordMode,
      startingNumber: startingNumber !== undefined && startingNumber !== '' ? parseInt(startingNumber, 10) : undefined,
      customPassword,
      posId,
    });

    auditService.log('CARD_GENERATION', 'SUCCESS', req.user!.userId, undefined, req.params.id, req.ip, {
      profile: profileName,
      count: quantity,
      batchId: result.batchId,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/servers/:id/cards/delete-batch', authenticate, requireRole('OPERATOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { usernames } = req.body;
    if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
      return res.status(400).json({ error: 'يرجى تحديد الكروت المراد حذفها.' });
    }

    const result = await cardService.deleteCardsBatch(req.params.id, req.user!.userId, usernames);
    auditService.log('CARD_DELETED', 'SUCCESS', req.user!.userId, undefined, req.params.id, req.ip, {
      count: result.deleted,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/servers/:id/cards/:username', authenticate, requireRole('OPERATOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username } = req.params;
    await cardService.deleteCard(req.params.id, req.user!.userId, username);
    auditService.log('CARD_DELETED', 'SUCCESS', req.user!.userId, undefined, req.params.id, req.ip, {
      username,
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/servers/:id/settings', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const settings = await cardService.getSettings(req.user!.userId, req.params.id);
  res.json({ settings });
});

apiRouter.put('/servers/:id/settings', authenticate, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const settings = await cardService.updateSettings(req.user!.userId, { ...req.body, serverId: req.params.id });
  auditService.log('SETTINGS_UPDATED', 'SUCCESS', req.user!.userId, undefined, req.params.id, req.ip);
  res.json({ settings });
});

apiRouter.get('/servers/:id/profiles', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const profiles = await cardService.getProfiles(req.params.id);
  res.json({ profiles });
});

// --- Active Users ---
apiRouter.get('/servers/:id/active-users', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activeUsers = await cardService.getActiveUsers(req.params.id, req.user!.userId);
    res.json({ activeUsers });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/servers/:id/active-users/disconnect', authenticate, requireRole('OPERATOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'اسم المستخدم مطلوب.' });
    await cardService.disconnectUser(req.params.id, req.user!.userId, username);
    auditService.log('USER_DISCONNECTED', 'SUCCESS', req.user!.userId, undefined, req.params.id, req.ip, { username });
    res.json({ success: true, message: `تم فصل المستخدم ${username} بنجاح.` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- POS Points ---
apiRouter.get('/servers/:id/pos', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const posList = await posService.getPosList(req.params.id, req.user!.userId);
  res.json({ posList });
});

apiRouter.post('/servers/:id/pos', authenticate, requireRole('OPERATOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, managerName, phone, prefix } = req.body;
    if (!name || !managerName) {
      return res.status(400).json({ error: 'اسم نقطة البيع واسم المسؤول حقول مطلوبة.' });
    }
    const pos = await posService.createPos(req.params.id, req.user!.userId, { name, managerName, phone, prefix });
    auditService.log('POS_CREATED', 'SUCCESS', req.user!.userId, undefined, req.params.id, req.ip, { name, prefix: pos.prefix });
    res.json({ pos });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/servers/:id/pos/:posId', authenticate, requireRole('OPERATOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pos = await posService.updatePos(req.params.posId, req.user!.userId, req.body);
    res.json({ pos });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/servers/:id/pos/:posId', authenticate, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await posService.deletePos(req.params.posId, req.user!.userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Reports ---
apiRouter.post('/servers/:id/reports', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, period, startDate, endDate } = req.body;
    const report = reportService.generateReport(req.user!.userId, {
      serverId: req.params.id,
      type: type || 'SALES',
      period: period || 'DAILY',
      startDate,
      endDate,
    });
    res.json({ report });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/servers/:id/reports/export-csv', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, period, startDate, endDate } = req.body;
    const report = reportService.generateReport(req.user!.userId, {
      serverId: req.params.id,
      type: type || 'SALES',
      period: period || 'DAILY',
      startDate,
      endDate,
    });
    const csv = reportService.exportCsv(report);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=makeen-report-${Date.now()}.csv`);
    res.send(csv);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Backup & Restore (Protected) ---
apiRouter.get('/servers/:id/backups', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { db } = await import('./database/db');
  const backups = db.backups.filter((b) => b.serverId === req.params.id);
  res.json({ backups });
});

apiRouter.post('/servers/:id/backups', authenticate, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await cardService.createBackup(req.params.id, req.user!.userId);
    auditService.log('BACKUP_CREATED', 'SUCCESS', req.user!.userId, undefined, req.params.id, req.ip, { filename: result.filename });
    res.json({ success: true, backup: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/servers/:id/restore', authenticate, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { filename, confirmed } = req.body;
    if (!confirmed) {
      return res.status(400).json({ error: 'يلزم تأكيد عملية الاستعادة بوضوح نظراً لحساسيتها.' });
    }
    auditService.log('RESTORE_STARTED', 'WARNING', req.user!.userId, undefined, req.params.id, req.ip, { filename });
    const result = await cardService.restoreBackup(req.params.id, req.user!.userId, filename);
    auditService.log('RESTORE_COMPLETED', 'SUCCESS', req.user!.userId, undefined, req.params.id, req.ip, { filename });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Maintenance & Dangerous Operations (Protected) ---
apiRouter.get('/servers/:id/cleanup/preview', authenticate, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const preview = await cardService.previewCleanup(req.params.id, req.user!.userId);
    res.json({ preview });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/servers/:id/cleanup', authenticate, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { confirmed } = req.body;
    if (!confirmed) return res.status(400).json({ error: 'تأكيد العملية مطلوب.' });
    const result = await cardService.executeCleanup(req.params.id, req.user!.userId);
    auditService.log('CLEANUP_EXECUTED', 'SUCCESS', req.user!.userId, undefined, req.params.id, req.ip, { count: result.removedCount });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/servers/:id/rebuild', authenticate, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { confirmed } = req.body;
    if (!confirmed) return res.status(400).json({ error: 'تأكيد العملية مطلوب.' });
    const result = await cardService.executeRebuild(req.params.id, req.user!.userId);
    auditService.log('REBUILD_EXECUTED', 'SUCCESS', req.user!.userId, undefined, req.params.id, req.ip, result);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/servers/:id/reboot', authenticate, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { confirmed } = req.body;
    if (!confirmed) return res.status(400).json({ error: 'تأكيد العملية مطلوب.' });
    const result = await cardService.executeReboot(req.params.id, req.user!.userId);
    auditService.log('REBOOT_REQUESTED', 'WARNING', req.user!.userId, undefined, req.params.id, req.ip);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Telegram Linking, Bot Config & Webhook ---
apiRouter.get('/telegram/bot-config', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const status = telegramBotService.getStatus();
  res.json({ status });
});

apiRouter.post('/telegram/bot-config', authenticate, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { token, mode } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'توكين البوت مطلوب كقيمة نصية صالحة.' });
    }
    const info = await telegramBotService.setToken(token, mode || 'POLLING');
    auditService.log('SETTINGS_UPDATED', 'SUCCESS', req.user!.userId, undefined, undefined, req.ip, {
      action: 'TELEGRAM_BOT_CONFIGURED',
      botUsername: info.username,
    });
    res.json({ success: true, botInfo: info, status: telegramBotService.getStatus() });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/telegram/bot-config', authenticate, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await telegramBotService.disconnect();
    auditService.log('SETTINGS_UPDATED', 'SUCCESS', req.user!.userId, undefined, undefined, req.ip, {
      action: 'TELEGRAM_BOT_DISCONNECTED',
    });
    res.json({ success: true, status: telegramBotService.getStatus() });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/telegram/bot-test', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chatId, message } = req.body;
    const targetChatId = chatId || telegramService.getLinkedAccounts(req.user!.userId)[0]?.telegramUserId;
    if (!targetChatId) {
      return res.status(400).json({ error: 'يرجى تحديد معرف الدردشة (Chat ID) أو ربط حسابك بتيليجرام أولاً.' });
    }
    const text = message || `🔔 <b>رسالة تجريبية من منصة Makeen لإدارة MikroTik</b>\n\nالاتصال بين النظام وبوت Telegram يعمل بنجاح! 🚀\nالوقت: ${new Date().toLocaleTimeString('ar-SA')}`;
    const result = await telegramBotService.sendMessage(targetChatId, text, { parse_mode: 'HTML' });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/telegram/token', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const token = telegramService.createLinkToken(req.user!.userId);
  res.json({ linkToken: token });
});

apiRouter.get('/telegram/accounts', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const accounts = telegramService.getLinkedAccounts(req.user!.userId);
  res.json({ accounts });
});

apiRouter.delete('/telegram/accounts/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const success = telegramService.unlinkAccount(req.params.id, req.user!.userId);
  auditService.log('TELEGRAM_UNLINKED', 'SUCCESS', req.user!.userId, undefined, undefined, req.ip);
  res.json({ success });
});

// Telegram Official Webhook receiver
apiRouter.post('/telegram/webhook', async (req, res) => {
  try {
    await telegramBotService.processUpdate(req.body);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(200).json({ ok: false, error: err.message });
  }
});

// Interactive Telegram Bot Simulator endpoint (allows live testing directly inside Makeen UI)
apiRouter.post('/telegram/simulate', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { text, callbackData, telegramUserId, firstName, username } = req.body;

    const mockUpdate = {
      update_id: Date.now(),
      message: text
        ? {
            message_id: Math.floor(Math.random() * 10000),
            date: Math.floor(Date.now() / 1000),
            chat: { id: telegramUserId || 99887766, type: 'private' as const, first_name: firstName || 'مدير ميكروتك' },
            from: {
              id: telegramUserId || 99887766,
              is_bot: false,
              first_name: firstName || 'مدير ميكروتك',
              username: username || 'mikrotik_admin',
            },
            text,
          }
        : undefined,
      callback_query: callbackData
        ? {
            id: `cb_${Date.now()}`,
            from: {
              id: telegramUserId || 99887766,
              is_bot: false,
              first_name: firstName || 'مدير ميكروتك',
              username: username || 'mikrotik_admin',
            },
            data: callbackData,
            message: {
              message_id: 101,
              date: Math.floor(Date.now() / 1000),
              chat: { id: telegramUserId || 99887766, type: 'private' as const },
            },
          }
        : undefined,
    };

    const reply = await telegramCommandRouter.handleUpdate(mockUpdate);
    res.json({ reply });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Audit Logs & Jobs ---
apiRouter.get('/audit-logs', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const serverId = req.query.serverId as string;
  const logs = auditService.getLogs(serverId);
  res.json({ logs });
});

apiRouter.get('/jobs', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const jobs = jobQueue.getUserJobs(req.user!.userId);
  res.json({ jobs });
});
