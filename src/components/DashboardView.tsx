import React, { useState } from 'react';
import { Server, ServerStats, AuditLog } from '../types';
import { api } from '../api';
import {
  Activity,
  Cpu,
  HardDrive,
  Users,
  Clock,
  Bot,
  Database,
  ShieldCheck,
  Zap,
  RefreshCw,
  Server as ServerIcon,
  Globe,
  Radio,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  CreditCard,
  Printer,
  Search,
} from 'lucide-react';

interface DashboardViewProps {
  server: Server;
  stats: ServerStats | null;
  logs: AuditLog[];
  onNavigateTab: (tab: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  server,
  stats,
  logs,
  onNavigateTab,
  onRefresh,
  isRefreshing,
}) => {
  const [testingProbe, setTestingProbe] = useState(false);
  const [probeResult, setProbeResult] = useState<{
    success: boolean;
    latencyMs?: number;
    message: string;
  } | null>(null);

  const isReal = server.connectionType !== 'MOCK';
  const isConnected = server.status === 'CONNECTED';

  const handleTestProbe = async () => {
    setTestingProbe(true);
    setProbeResult(null);
    try {
      const res = await api.testConnection(server.id);
      setProbeResult(res);
      onRefresh();
    } catch (err: any) {
      setProbeResult({
        success: false,
        message: err.message || 'تعذر الاتصال بالسيرفر.',
      });
    } finally {
      setTestingProbe(false);
    }
  };

  // Safe CPU & RAM calculation
  const cpuVal = stats?.cpu !== undefined ? stats.cpu : isConnected ? 0 : null;
  const ramUsed = stats?.ramUsed ?? (isConnected ? 0 : null);
  const ramTotal = stats?.ramTotal ?? (isConnected ? 0 : null);
  const ramPercent =
    ramUsed !== null && ramTotal && ramTotal > 0
      ? Math.round((ramUsed / ramTotal) * 100)
      : null;

  return (
    <div className="space-y-6">
      {/* 1. MikroTik RouterOS Live Hardware & Cloud Status Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Left: Router Identity & Specs */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <ServerIcon className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">{server.name}</h2>

              {/* Status Badge */}
              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {isReal ? 'اتصال سحابي حقيقي مباشر بالراوتر' : 'محاكاة تجريبية (Demo Sandbox)'}
                </span>
              ) : server.status === 'CONNECTING' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  جارِ محاولة الاتصال...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  غير متصل (Disconnected)
                </span>
              )}
            </div>

            {/* Metadata Tags */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
              <div className="flex items-center gap-1 font-mono text-indigo-300">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>{server.host}</span>
              </div>
              <span className="text-slate-600">•</span>
              <div>
                <span>البروتوكول: </span>
                <span className="font-semibold text-slate-200">{server.connectionType}</span>
              </div>
              <span className="text-slate-600">•</span>
              <div>
                <span>المنفذ: </span>
                <span className="font-mono text-slate-200">{server.apiPort || 8728}</span>
              </div>
              {(stats?.boardName || server.boardModel) && (
                <>
                  <span className="text-slate-600">•</span>
                  <div>
                    <span>طراز البوردة: </span>
                    <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700 font-mono">
                      {stats?.boardName || server.boardModel}
                    </span>
                  </div>
                </>
              )}
              {stats?.routerOsVersion && (
                <>
                  <span className="text-slate-600">•</span>
                  <div>
                    <span>نظام التشغيل: </span>
                    <span className="font-bold text-cyan-300 font-mono">
                      {stats.routerOsVersion}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleTestProbe}
              disabled={testingProbe}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 border border-slate-700 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingProbe ? 'animate-spin' : ''}`} />
              <span>{testingProbe ? 'جارِ فحص الاتصال...' : 'فحص الاتصال الفعلي'}</span>
            </button>

            <button
              onClick={() => onNavigateTab('servers')}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              إدارة السيرفرات
            </button>
          </div>
        </div>

        {/* Live Probe Feedback Banner */}
        {probeResult && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs border flex items-center justify-between gap-3 ${
              probeResult.success
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                : 'bg-red-950/40 border-red-500/30 text-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {probeResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              )}
              <span>{probeResult.message}</span>
            </div>
            {probeResult.latencyMs !== undefined && (
              <span className="font-mono text-[11px] bg-black/40 px-2 py-0.5 rounded border border-white/10">
                {probeResult.latencyMs}ms
              </span>
            )}
          </div>
        )}
      </div>

      {/* 2. Top 4 Live Telemetry Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. CPU */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-semibold">المعالج (CPU)</span>
            <Cpu className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-3xl font-black text-white font-mono">
              {cpuVal !== null ? `${cpuVal}%` : '—'}
            </h3>
            <span className="text-xs text-slate-400">
              {cpuVal !== null && cpuVal < 60
                ? 'حمل طبيعي'
                : cpuVal !== null && cpuVal < 85
                ? 'حمل متوسط'
                : cpuVal !== null
                ? 'حمل مرتفع'
                : 'غير متصل'}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                (cpuVal || 0) < 60
                  ? 'bg-indigo-500'
                  : (cpuVal || 0) < 85
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(cpuVal || 0, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* 2. RAM */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-semibold">الذاكرة (RAM)</span>
            <HardDrive className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-3xl font-black text-white font-mono">
              {ramUsed !== null ? `${ramUsed} MB` : '—'}
            </h3>
            <span className="text-xs text-slate-400">
              {ramTotal ? `من ${ramTotal} MB` : 'غير متوفر'}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="bg-cyan-500 h-full transition-all duration-500"
              style={{ width: `${Math.min(ramPercent || 0, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* 3. Active Users */}
        <div
          onClick={() => onNavigateTab('active_users')}
          className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm cursor-pointer hover:border-indigo-500/60 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-semibold group-hover:text-indigo-300 transition-colors">
              المستخدمون المتصلون (Hotspot)
            </span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-3xl font-black text-white font-mono">
              {stats?.activeUsersCount !== undefined ? stats.activeUsersCount : 0}
            </h3>
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              نشط الآن
            </span>
          </div>
          <p className="text-[11px] text-slate-500 flex items-center gap-1 group-hover:text-indigo-400 transition-colors">
            <span>عرض وإدارة المتصلين بالشبكة</span>
            <ChevronRight className="w-3 h-3" />
          </p>
        </div>

        {/* 4. Uptime & RouterOS */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-semibold">مدة التشغيل (Uptime)</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-2xl font-black text-white font-mono">
              {stats?.uptime || '—'}
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              {stats?.routerOsVersion || ''}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            {isConnected ? 'الجهاز يعمل باستقرار' : 'بانتظار الاتصال'}
          </p>
        </div>
      </div>

      {/* 3. Quick Action Hub */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          onClick={() => onNavigateTab('cards')}
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-850 transition-all text-right group cursor-pointer"
        >
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 w-fit mb-3 group-hover:scale-105 transition-transform">
            <CreditCard className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-white group-hover:text-indigo-300">توليد وإصدار كروت</h4>
          <p className="text-xs text-slate-400 mt-0.5">إنشاء حزم كروت وتحديد الباقات والأسعار</p>
        </button>

        <button
          onClick={() => onNavigateTab('card_print')}
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-850 transition-all text-right group cursor-pointer"
        >
          <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 w-fit mb-3 group-hover:scale-105 transition-transform">
            <Printer className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-white group-hover:text-cyan-300">محرك طباعة الكروت</h4>
          <p className="text-xs text-slate-400 mt-0.5">تصاميم احترافية مع باركود QR و A4</p>
        </button>

        <button
          onClick={() => onNavigateTab('inspector')}
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-850 transition-all text-right group cursor-pointer"
        >
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 w-fit mb-3 group-hover:scale-105 transition-transform">
            <Search className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-white group-hover:text-amber-300">فاحص الكروت الفوري</h4>
          <p className="text-xs text-slate-400 mt-0.5">الاستعلام عن الرصيد والصلاحية والماك</p>
        </button>

        <button
          onClick={() => onNavigateTab('telegram')}
          className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 transition-all text-right group cursor-pointer"
        >
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 w-fit mb-3 group-hover:scale-105 transition-transform">
            <Bot className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-white group-hover:text-emerald-300">بوت تليجرام الذكي</h4>
          <p className="text-xs text-slate-400 mt-0.5">إصدار الكروت وتنبيهات المبيعات عبر المحادثة</p>
        </button>
      </div>

      {/* 4. Split Section: Audit Logs & Hardware Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Real Audit Log */}
        <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm flex flex-col">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <Activity className="w-5 h-5 text-indigo-400" />
              <h4 className="font-bold text-base text-white">سجل العمليات الأخير (Audit Log)</h4>
            </div>
            <button
              onClick={() => onNavigateTab('audit')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
            >
              عرض السجل الكامل
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3">نوع العملية</th>
                  <th className="px-5 py-3">المصدر</th>
                  <th className="px-5 py-3">الوقت</th>
                  <th className="px-5 py-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500 text-xs">
                      لا توجد عمليات مسجلة حتى الآن.
                    </td>
                  </tr>
                ) : (
                  logs.slice(0, 6).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-200">
                        {log.operation}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">
                        {log.telegramId ? `تليجرام (${log.telegramId})` : 'لوحة التحكم'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString('ar-SA', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold ${
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : log.status === 'WARNING'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-red-500/10 text-red-400 border-red-500/30'
                          }`}
                        >
                          {log.status === 'SUCCESS' ? 'ناجح' : log.status === 'WARNING' ? 'تنبيه' : 'فشل'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Server Hardware Details */}
        <div className="space-y-6">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm">
            <h4 className="font-bold text-base text-white mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <span>معلومات البنية التحتية</span>
            </h4>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-800 pb-2.5">
                <span className="text-slate-400">اسم الجهاز</span>
                <span className="text-white font-bold">{server.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2.5">
                <span className="text-slate-400">العنوان / المضيف</span>
                <span className="text-indigo-300 font-mono text-[11px] truncate max-w-[180px]">
                  {server.host}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2.5">
                <span className="text-slate-400">طراز البوردة</span>
                <span className="text-white font-mono">
                  {stats?.boardName || server.boardModel || 'RouterOS'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2.5">
                <span className="text-slate-400">إصدار النظام</span>
                <span className="text-cyan-300 font-mono font-bold">
                  {stats?.routerOsVersion || 'RouterOS'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">آخر اتصال ناجح</span>
                <span className="text-slate-300 font-mono text-[11px]">
                  {server.lastConnectedAt
                    ? new Date(server.lastConnectedAt).toLocaleTimeString('ar-SA')
                    : 'الآن'}
                </span>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('diagnostics')}
              className="w-full mt-5 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              أدوات الفحص والتشخيص المتقدم
            </button>
          </div>

          {/* User Manager / Hotspot engine quick indicator */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-semibold">محرك Hotspot / User Manager</span>
              <div className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>متصل وجاهز لإصدار الكروت</span>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('cards')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
            >
              الكروت
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
