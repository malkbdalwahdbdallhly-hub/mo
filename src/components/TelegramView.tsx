import React, { useState, useEffect, useRef } from 'react';
import { TelegramAccount } from '../types';
import { api } from '../api';
import {
  Bot,
  Key,
  Shield,
  Trash2,
  Send,
  RefreshCw,
  Copy,
  Check,
  Smartphone,
  ExternalLink,
  Eye,
  EyeOff,
  Radio,
  CheckCircle2,
  AlertTriangle,
  BellRing,
  HelpCircle,
  Cpu,
  Power,
  Zap,
} from 'lucide-react';

interface TelegramViewProps {
  accounts: TelegramAccount[];
  onRefreshAccounts: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  keyboard?: { text: string; callback_data: string }[][];
  timestamp: string;
}

interface TelegramBotStatus {
  isConfigured: boolean;
  isActive: boolean;
  isPolling: boolean;
  mode: 'POLLING' | 'WEBHOOK' | 'IDLE';
  botInfo: { id: number; username: string; first_name: string } | null;
  botUsername: string | null;
  botFirstName: string | null;
  lastPollTime: string | null;
  lastError: string | null;
  processedCount: number;
}

export const TelegramView: React.FC<TelegramViewProps> = ({
  accounts,
  onRefreshAccounts,
}) => {
  // Bot Token Configuration State
  const [botStatus, setBotStatus] = useState<TelegramBotStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenSuccess, setTokenSuccess] = useState<string | null>(null);

  // Bot Test Message State
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Link Token State
  const [linkToken, setLinkToken] = useState<{ token: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [loadingToken, setLoadingToken] = useState(false);

  // Bot Simulator State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'bot',
      text: 'مرحباً بك في بوت منصة Makeen لإدارة MikroTik! 🤖\nاضغط على /start أو اختر أحد الأوامر أدناه للتحكم المباشر في السيرفر:',
      keyboard: [
        [
          { text: '📊 حالة السيرفر', callback_data: 'nav:status' },
          { text: '🎫 توليد كروت', callback_data: 'nav:generate' },
        ],
        [
          { text: '👥 النشطون', callback_data: 'nav:users' },
          { text: '🔎 فحص كرت', callback_data: 'nav:check' },
        ],
        [
          { text: '📈 تقرير المبيعات', callback_data: 'nav:report' },
          { text: '💾 نسخة احتياطية', callback_data: 'nav:backup' },
        ],
      ],
      timestamp: new Date().toLocaleTimeString('ar-SA'),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [simulating, setSimulating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load Bot Status on mount
  const fetchBotStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await api.getTelegramBotConfig();
      setBotStatus(res.status);
    } catch (err: any) {
      console.warn('Failed to load bot status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchBotStatus();
  }, []);

  // Save Bot Token
  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    setSavingToken(true);
    setTokenError(null);
    setTokenSuccess(null);

    try {
      const res = await api.setTelegramBotConfig(tokenInput.trim(), 'POLLING');
      setBotStatus(res.status);
      setTokenSuccess(`تم تفعيل البوت بنجاح باسم @${res.botInfo.username}، وبدأ الاستماع للأوامر عبر Long-Polling!`);
      setTokenInput('');
      onRefreshAccounts();
    } catch (err: any) {
      setTokenError(err.message || 'فشل حفظ وتفعيل توكين البوت.');
    } finally {
      setSavingToken(false);
    }
  };

  // Disconnect Bot
  const handleDisconnectBot = async () => {
    if (!window.confirm('هل أنت متأكد من تعطيل وفصل بوت تيليجرام؟')) return;

    try {
      const res = await api.disconnectTelegramBot();
      setBotStatus(res.status);
      setTokenSuccess('تم فصل البوت بنجاح.');
      setTokenError(null);
    } catch (err: any) {
      setTokenError(err.message);
    }
  };

  // Send Test Alert via Bot
  const handleSendTestMessage = async () => {
    setSendingTest(true);
    setTestResult(null);

    try {
      const res = await api.testTelegramBot();
      setTestResult({
        success: true,
        message: 'تم إرسال الرسالة التجريبية بنجاح إلى حسابك في تيليجرام!',
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'تعذر إرسال الرسالة. تأكد من ربط حسابك أولاً.',
      });
    } finally {
      setSendingTest(false);
    }
  };

  // Generate Link Token
  const handleGenerateToken = async () => {
    setLoadingToken(true);
    try {
      const res = await api.getTelegramToken();
      setLinkToken(res.linkToken);
    } catch (err) {
      console.error('Failed to generate token:', err);
    } finally {
      setLoadingToken(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyDirectLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Unlink Account
  const handleUnlink = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من إلغاء ربط هذا الحساب؟ لن يتمكن من إرسال أوامر للسيرفر.')) return;
    try {
      await api.unlinkTelegram(id);
      onRefreshAccounts();
    } catch (err) {
      console.error(err);
    }
  };

  // Simulate Telegram interaction
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || simulating) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString('ar-SA'),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setSimulating(true);

    try {
      const res = await api.simulateTelegram({ text: text.trim(), telegramUserId: 99887766 });
      if (res.reply) {
        const botMsg: ChatMessage = {
          id: `bot_${Date.now()}`,
          sender: 'bot',
          text: res.reply.text,
          keyboard: res.reply.reply_markup?.inline_keyboard,
          timestamp: new Date().toLocaleTimeString('ar-SA'),
        };
        setMessages((prev) => [...prev, botMsg]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot_err_${Date.now()}`,
          sender: 'bot',
          text: `⚠️ خطأ: ${err.message}`,
          timestamp: new Date().toLocaleTimeString('ar-SA'),
        },
      ]);
    } finally {
      setSimulating(false);
    }
  };

  const handleCallbackClick = async (callbackData: string) => {
    if (simulating) return;
    setSimulating(true);

    try {
      const res = await api.simulateTelegram({
        callbackData,
        telegramUserId: 99887766,
      });

      if (res.reply) {
        const botMsg: ChatMessage = {
          id: `bot_${Date.now()}`,
          sender: 'bot',
          text: res.reply.text,
          keyboard: res.reply.reply_markup?.inline_keyboard,
          timestamp: new Date().toLocaleTimeString('ar-SA'),
        };
        setMessages((prev) => [...prev, botMsg]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot_err_${Date.now()}`,
          sender: 'bot',
          text: `⚠️ خطأ: ${err.message}`,
          timestamp: new Date().toLocaleTimeString('ar-SA'),
        },
      ]);
    } finally {
      setSimulating(false);
    }
  };

  const directStartLink =
    botStatus?.botUsername && linkToken
      ? `https://t.me/${botStatus.botUsername}?start=link_${linkToken.token}`
      : botStatus?.botUsername
      ? `https://t.me/${botStatus.botUsername}`
      : null;

  return (
    <div className="space-y-6">
      {/* Top Banner: Telegram Bot Live Status & Configuration */}
      <div className="bg-slate-850 border border-slate-750 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-750">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-white">ربط وتحكم الميكروتيك عبر بوت تيليجرام</h2>
                {botStatus?.isActive ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    متصل ونشط (Long-Polling)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    بانتظار توكين البوت (Awaiting Token)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                إدارة كاملة لراوتر الميكروتيك وتوليد الكروت وفحص الرصيد وفصل المستخدمين مباشرة من تطبيق Telegram
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchBotStatus}
              disabled={loadingStatus}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer disabled:opacity-50"
              title="تحديث حالة البوت"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
              تحديث الحالة
            </button>

            {botStatus?.botUsername && (
              <a
                href={`https://t.me/${botStatus.botUsername}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                فتح @{botStatus.botUsername} في Telegram
              </a>
            )}
          </div>
        </div>

        {/* Bot Token Configuration & Stats Form */}
        <div className="pt-4">
          {botStatus?.isConfigured && botStatus?.botUsername ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 block">معلومات البوت المسجل:</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">{botStatus.botFirstName || 'Makeen Bot'}</span>
                  <span className="text-xs text-indigo-400 font-mono">@{botStatus.botUsername}</span>
                </div>
                <span className="text-[10px] text-slate-500 block">
                  معرف البوت (Bot ID): {botStatus.botInfo?.id || 'مسجل'}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 block">حالة الاتصال الفعلي:</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                    <Radio className="w-3.5 h-3.5" />
                    استماع حي (Long Polling نشط)
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 block">
                  الرسائل المعالجة: {botStatus.processedCount} تحديث
                </span>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleSendTestMessage}
                  disabled={sendingTest}
                  className="px-3 py-1.5 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-medium flex items-center gap-1.5 transition-colors border border-emerald-500/30 cursor-pointer disabled:opacity-50"
                  title="إرسال رسالة تنبيهية عبر تيليجرام"
                >
                  <BellRing className="w-3.5 h-3.5" />
                  {sendingTest ? 'جارِ الإرسال...' : 'اختبار الاتصال برسالة'}
                </button>

                <button
                  onClick={handleDisconnectBot}
                  className="px-3 py-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium flex items-center gap-1.5 transition-colors border border-red-500/30 cursor-pointer"
                  title="إيقاف البوت وتغيير التوكين"
                >
                  <Power className="w-3.5 h-3.5" />
                  فصل البوت
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveToken} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
                    <Key className="w-4 h-4" />
                  </div>
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput ?? ''}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="أدخل توكين بوت تيليجرام هنا (مثال: 1234567890:ABCdefGHIjklMNO... من @BotFather)"
                    className="w-full bg-slate-950 border border-slate-750 focus:border-indigo-500 rounded-lg pr-9 pl-10 py-2.5 text-xs text-white placeholder-slate-500 outline-none font-mono transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-white cursor-pointer"
                    title={showToken ? 'إخفاء التوكين' : 'إظهار التوكين'}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!tokenInput.trim() || savingToken}
                  className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <Zap className="w-3.5 h-3.5" />
                  {savingToken ? 'جارِ التحقق والاتصال...' : 'حفظ وتفعيل اتصال البوت (Connect Bot)'}
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  يمكنك الحصول على التوكين مجاناً خلال 30 ثانية من حساب{' '}
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 underline hover:text-indigo-300 font-mono"
                  >
                    @BotFather
                  </a>{' '}
                  عبر كتابة <code>/newbot</code>. بمجرد لصق التوكين سيتصل النظام تلقائياً.
                </span>
              </div>
            </form>
          )}

          {tokenError && (
            <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{tokenError}</span>
            </div>
          )}

          {tokenSuccess && (
            <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{tokenSuccess}</span>
            </div>
          )}

          {testResult && (
            <div
              className={`mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}
            >
              {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Management & Live Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Account Linking & Authorized Accounts List */}
        <div className="lg:col-span-5 space-y-6">
          {/* Token Generator & Deep Link Card */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">ربط حساب مدير النظام</h3>
                <p className="text-xs text-slate-400">توثيق هويتك لمنحك صلاحيات الإدارة الكاملة في تيليجرام</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              لتمكين حسابك على Telegram من إرسال أوامر راوتر الميكروتيك، أنشئ رمز الربط السريع:
            </p>

            {linkToken ? (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 mb-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">رمز الربط السريع (Code):</span>
                    <span className="text-lg font-bold text-indigo-400 font-mono tracking-wider">
                      {linkToken.token}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(`/link ${linkToken.token}`)}
                    className="px-2.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'تم النسخ' : 'نسخ الأمر'}
                  </button>
                </div>

                {/* Direct One-Click Link if Bot Username is known */}
                {directStartLink && (
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-1.5">أو الربط المباشر بنقرة واحدة:</span>
                    <div className="flex gap-2">
                      <a
                        href={directStartLink}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-1.5 px-3 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        فتح البوت والربط تلقائياً
                      </a>
                      <button
                        onClick={() => handleCopyDirectLink(directStartLink)}
                        className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs cursor-pointer"
                        title="نسخ الرابط المباشر"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-slate-500">
                  صالح لمدة 15 دقيقة حتى: {new Date(linkToken.expiresAt).toLocaleTimeString('ar-SA')}
                </p>
              </div>
            ) : (
              <button
                onClick={handleGenerateToken}
                disabled={loadingToken}
                className="w-full py-2.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Key className="w-3.5 h-3.5" />
                {loadingToken ? 'جارِ توليد الرمز...' : 'توليد رمز ربط حسابي (Generate Link Code)'}
              </button>
            )}

            <div className="mt-3 pt-2.5 border-t border-slate-800 text-[10px] text-slate-400 space-y-1">
              <div>🛡️ <strong>حماية فائقة:</strong> لا يُسمح بتنفيذ أي أمر دون ترخيص حساب Telegram المسبق.</div>
              <div>⚡ <strong>تحكم فوري:</strong> بمجرد الربط يمكنك طلب /status أو /cards أو إعادة التشغيل.</div>
            </div>
          </div>

          {/* Linked Accounts List */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-xs text-white flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                الحسابات المربوطة والمصرح لها ({accounts.length})
              </h3>
              <button
                onClick={onRefreshAccounts}
                title="تحديث القائمة"
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {accounts.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                لا توجد حسابات Telegram مربوطة حالياً. استخدم رمز الربط أعلاه لربط حسابك.
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">
                          {acc.telegramFirstName || 'مدير ميكروتك'}
                        </span>
                        {acc.telegramUsername && (
                          <span className="text-indigo-400 font-mono text-[11px]">@{acc.telegramUsername}</span>
                        )}
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 text-[10px] border border-emerald-500/20">
                          {acc.role}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Telegram ID: {acc.telegramUserId} | تم الربط: {new Date(acc.linkedAt).toLocaleDateString('ar-SA')}
                      </div>
                    </div>

                    <button
                      onClick={() => handleUnlink(acc.id)}
                      title="إلغاء الربط وسحب الصلاحية"
                      className="p-1.5 rounded bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors cursor-pointer border border-slate-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Cheatsheet of Telegram Bot Commands */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 text-xs">
            <h4 className="font-bold text-white mb-2 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              أوامر البوت السريعة المتاحة في تيليجرام:
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300">
              <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800">
                <span className="text-indigo-400">/start</span> - القائمة الرئيسية
              </div>
              <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800">
                <span className="text-indigo-400">/status</span> - حالة السيرفر
              </div>
              <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800">
                <span className="text-indigo-400">/cards</span> - توليد كروت
              </div>
              <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800">
                <span className="text-indigo-400">/active</span> - المتصلين الآن
              </div>
              <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800">
                <span className="text-indigo-400">/check</span> - فحص كرت
              </div>
              <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800">
                <span className="text-indigo-400">/backup</span> - نسخة احتياطية
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Realistic Interactive Live Simulator */}
        <div className="lg:col-span-7">
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl shadow-sm flex flex-col h-[700px] overflow-hidden">
            {/* Telegram Phone/Chat Header */}
            <div className="bg-slate-900/70 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-white">
                      {botStatus?.botFirstName || 'Makeen MikroTik Bot'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 font-mono border border-indigo-500/20">
                      bot
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    محاكي تفاعلي متصل ومتاح للتنفيذ الفعلي
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSendMessage('/start')}
                  className="text-[11px] px-2.5 py-1 rounded bg-slate-800 text-indigo-400 hover:bg-slate-700 font-mono transition-colors border border-slate-700 cursor-pointer"
                >
                  /start
                </button>
              </div>
            </div>

            {/* Chat Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none shadow-sm'
                        : 'bg-slate-800/90 text-slate-200 rounded-bl-none border border-slate-700/80 shadow-sm font-sans whitespace-pre-wrap'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Inline Keyboard Buttons */}
                  {msg.keyboard && msg.keyboard.length > 0 && (
                    <div className="mt-1.5 w-full max-w-[85%] space-y-1.5">
                      {msg.keyboard.map((row, rIdx) => (
                        <div key={rIdx} className="flex gap-1.5 flex-wrap">
                          {row.map((btn, bIdx) => (
                            <button
                              key={bIdx}
                              onClick={() => handleCallbackClick(btn.callback_data)}
                              disabled={simulating}
                              className="flex-1 min-w-[110px] py-1.5 px-2.5 rounded-lg bg-slate-800/90 hover:bg-indigo-900/40 hover:border-indigo-500/80 border border-slate-700 text-slate-200 text-[11px] font-medium transition-all text-center cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                            >
                              {btn.text}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  <span className="text-[10px] text-slate-500 mt-0.5 px-1">{msg.timestamp}</span>
                </div>
              ))}
              {simulating && (
                <div className="flex items-center gap-2 text-xs text-indigo-400 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
                  <span>البوت يكتب الآن...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Shortcuts Bar */}
            <div className="px-3 py-1.5 bg-slate-900/60 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto">
              {['/start', '/status', '/cards', '/active', '/reports', '/backup', '/cleanup'].map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => handleSendMessage(cmd)}
                  disabled={simulating}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono whitespace-nowrap transition-colors cursor-pointer border border-slate-750"
                >
                  {cmd}
                </button>
              ))}
            </div>

            {/* Input & Send Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-2.5 bg-slate-900/80 border-t border-slate-800 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText ?? ''}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="اكتب أمراً (مثل: /status أو /check user1001 أو /start)..."
                disabled={simulating}
                className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || simulating}
                className="p-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
