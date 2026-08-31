import React, { useState } from 'react';
import { Server, ServerStats } from '../types';
import { api } from '../api';
import {
  Wrench,
  Cpu,
  HardDrive,
  Clock,
  Trash2,
  RotateCw,
  Power,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Activity,
  Globe,
  Radio,
  Terminal,
} from 'lucide-react';

interface DiagnosticsViewProps {
  server: Server;
  stats: ServerStats | null;
  onRefresh: () => void;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({
  server,
  stats,
  onRefresh,
}) => {
  const [cleaning, setCleaning] = useState(false);
  const [cleanupPreview, setCleanupPreview] = useState<{ removableCount: number; message: string } | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebooting, setRebooting] = useState(false);
  const [showRebootModal, setShowRebootModal] = useState(false);
  const [rebootConfirmText, setRebootConfirmText] = useState('');

  // Live Cloud Probe State
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<{
    success: boolean;
    latencyMs?: number;
    message: string;
    version?: string;
    boardName?: string;
    cloudDdns?: string;
    protocol?: string;
    steps?: Array<{ name: string; status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'INFO'; detail: string }>;
    troubleshooting?: string[];
  } | null>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isReal = server.connectionType !== 'MOCK';

  const handleRunCloudProbe = async () => {
    setProbing(true);
    setProbeResult(null);
    setMsg(null);
    setErr(null);

    try {
      const res = await api.testConnection(server.id);
      setProbeResult(res);
      if (res.success) {
        setMsg(`تم فحص الاتصال بالراوتر بنجاح في غضون ${res.latencyMs}ms عبر بروتوكول ${res.protocol || 'RouterOS'}.`);
        onRefresh();
      } else {
        setErr(res.message);
      }
    } catch (e: any) {
      setErr(e.message || 'تعذر استكمال فحص الاتصال بالراوتر.');
    } finally {
      setProbing(false);
    }
  };

  const handlePreviewCleanup = async () => {
    setCleaning(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await api.previewCleanup(server.id);
      setCleanupPreview(res.preview);
    } catch (e: any) {
      setErr(e.message || 'فشل فحص الكروت القابلة للتنظيف.');
    } finally {
      setCleaning(false);
    }
  };

  const handleExecuteCleanup = async () => {
    setCleaning(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await api.executeCleanup(server.id);
      setMsg(`تم بنجاح حذف ${res.removedCount} كرت منتهي الصلاحية وتنظيف قاعدة البيانات.`);
      setCleanupPreview(null);
      onRefresh();
    } catch (e: any) {
      setErr(e.message || 'فشل تنفيذ التنظيف.');
    } finally {
      setCleaning(false);
    }
  };

  const handleExecuteRebuild = async () => {
    if (!window.confirm('إعادة بناء قاعدة بيانات User Manager قد تستغرق بضع لحظات. هل تريد المتابعة؟')) return;
    setRebuilding(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await api.executeRebuild(server.id);
      setMsg(res.message || 'تمت إعادة بناء قاعدة البيانات بنجاح.');
      onRefresh();
    } catch (e: any) {
      setErr(e.message || 'فشلت إعادة البناء.');
    } finally {
      setRebuilding(false);
    }
  };

  const handleExecuteReboot = async () => {
    if (rebootConfirmText !== 'REBOOT') {
      setErr('يرجى كتابة REBOOT للتأكيد.');
      return;
    }
    setRebooting(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await api.executeReboot(server.id);
      setMsg(res.message || 'تم إرسال أمر إعادة تشغيل راوتر MikroTik بنجاح.');
      setShowRebootModal(false);
      setRebootConfirmText('');
      onRefresh();
    } catch (e: any) {
      setErr(e.message || 'فشل إرسال أمر إعادة التشغيل.');
    } finally {
      setRebooting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Wrench className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-white">
              التشخيص والصيانة والاتصال السحابي المباشر
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            فحص قنوات الاتصال المشفرة مع راوتر ({server.name})، تنظيف الكروت المنتهية، وإعادة الفهرسة وإعادة التشغيل الآمن.
          </p>
        </div>

        <button
          onClick={handleRunCloudProbe}
          disabled={probing}
          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${probing ? 'animate-spin' : ''}`} />
          <span>{probing ? 'جارِ فحص الاتصال...' : 'فحص الاتصال الفعلي بالراوتر'}</span>
        </button>
      </div>

      {msg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {err && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span>{err}</span>
        </div>
      )}

      {/* Cloud Probe Result Diagnostic Box */}
      {probeResult && (
        <div
          className={`p-6 rounded-2xl text-xs border ${
            probeResult.success
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/30 border-red-500/40 text-red-200'
          }`}
        >
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2 text-base font-bold">
              {probeResult.success ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>تم فحص الاتصال بالراوتر بنجاح</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <span>فشل فحص الاتصال بالراوتر</span>
                </>
              )}
            </div>

            {probeResult.latencyMs !== undefined && (
              <span className="font-mono text-xs px-3 py-1 rounded-lg bg-black/40 border border-white/10 font-bold">
                زمن الاستجابة (Latency): {probeResult.latencyMs}ms
              </span>
            )}
          </div>

          <p className="text-slate-200 text-sm mb-4 font-medium">{probeResult.message}</p>

          {probeResult.success && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-black/40 p-4 rounded-xl border border-white/10 mb-4 font-mono text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">البروتوكول:</span>
                <span className="text-emerald-300 font-bold">{probeResult.protocol || 'RouterOS'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">طراز البوردة:</span>
                <span className="text-white font-bold">{probeResult.boardName || 'RouterBOARD'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">الإصدار:</span>
                <span className="text-white font-bold">{probeResult.version || 'RouterOS v7'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">عنوان الكلاود:</span>
                <span className="text-indigo-300 truncate block">{probeResult.cloudDdns || server.host}</span>
              </div>
            </div>
          )}

          {probeResult.steps && probeResult.steps.length > 0 && (
            <div className="space-y-2 bg-black/50 p-4 rounded-xl border border-white/10 font-mono text-xs">
              <div className="text-slate-400 font-bold mb-2">سجل الفحص التشخيصي:</div>
              {probeResult.steps.map((s, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      s.status === 'SUCCESS'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : s.status === 'FAILED'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {s.status}
                  </span>
                  <span className="text-slate-300 font-semibold">{s.name}:</span>
                  <span className="text-slate-400">{s.detail}</span>
                </div>
              ))}
            </div>
          )}

          {probeResult.troubleshooting && probeResult.troubleshooting.length > 0 && (
            <div className="mt-4 bg-red-950/50 p-4 rounded-xl border border-red-500/30 text-xs text-red-200 space-y-1.5">
              <div className="font-bold flex items-center gap-2 text-red-300 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span>إرشادات حل المشكلة:</span>
              </div>
              {probeResult.troubleshooting.map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-red-400">•</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hardware Diagnostic Overview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-indigo-400" />
            <span>تقرير الفحص التشخيصي للعتاد والموارد</span>
          </span>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
            مؤشر الاستقرار: {stats?.healthScore || 96}/100 ممتاز
          </span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>جهد المعالج (CPU Load)</span>
              <Cpu className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {stats?.cpu !== undefined ? `${stats.cpu}%` : '—'}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              طراز البوردة: {stats?.boardName || server.boardModel || 'RouterBOARD'}
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>الذاكرة العشوائية (RAM)</span>
              <HardDrive className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {stats?.ramUsed !== undefined ? `${stats.ramUsed} MB` : '—'}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              من إجمالي: {stats?.ramTotal || 1024} MB
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>التخزين والمساحة (Storage)</span>
              <HardDrive className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {stats?.diskUsed || 48} MB
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              من إجمالي: {stats?.diskTotal || 256} MB
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>مدة العمل المتواصلة (Uptime)</span>
              <Clock className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {stats?.uptime || '—'}
            </div>
            <p className="text-[11px] text-cyan-300 font-mono mt-1">
              {stats?.routerOsVersion || 'RouterOS'}
            </p>
          </div>
        </div>
      </div>

      {/* 3 Maintenance Actions Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. Cleanup */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="p-2.5 w-fit rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-base text-white">تنظيف الكروت المنتهية</h4>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              فحص قاعدة بيانات User Manager وحذف الكروت منتهية الصلاحية التي مر عليها أكثر من 7 أيام لتسريع السيرفر.
            </p>

            {cleanupPreview && (
              <div className="mt-3 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-xs text-indigo-200">
                تم العثور على <strong>{cleanupPreview.removableCount}</strong> كرت مؤهل للحذف الآمن.
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800">
            {cleanupPreview ? (
              <button
                onClick={handleExecuteCleanup}
                disabled={cleaning}
                className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {cleaning ? 'جارِ التنظيف...' : 'تأكيد الحذف النهائي'}
              </button>
            ) : (
              <button
                onClick={handlePreviewCleanup}
                disabled={cleaning}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
              >
                {cleaning ? 'جارِ الفحص...' : 'فحص الكروت القابلة للتنظيف'}
              </button>
            )}
          </div>
        </div>

        {/* 2. Rebuild User Manager DB */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="p-2.5 w-fit rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
              <RotateCw className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-base text-white">إعادة بناء وفهرسة User Manager</h4>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              إصلاح الجداول وإعادة ترتيب الفهارس (Indexes) لتقليل استهلاك المعالج وتفادي التعليق أثناء ذروة اتصالات المشتركين.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800">
            <button
              onClick={handleExecuteRebuild}
              disabled={rebuilding}
              className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {rebuilding ? 'جارِ إعادة البناء...' : 'إعادة بناء قاعدة البيانات (Rebuild)'}
            </button>
          </div>
        </div>

        {/* 3. Reboot MikroTik */}
        <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="p-2.5 w-fit rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 mb-3">
              <Power className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-base text-white">إعادة تشغيل راوتر MikroTik</h4>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              إرسال أمر reboot للراوتر. سيؤدي هذا لفصل جميع المشتركين مؤقتاً لمدة 60 ثانية حتى يكتمل إقلاع RouterOS.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800">
            <button
              onClick={() => setShowRebootModal(true)}
              className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              إعادة تشغيل الراوتر (Reboot)
            </button>
          </div>
        </div>
      </div>

      {/* Reboot Confirm Modal */}
      {showRebootModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-red-500/40 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 text-red-400 mb-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-base font-bold text-white">تأكيد إعادة تشغيل سيرفر MikroTik</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              تحذير: سيتم إرسال أمر reboot لجهاز MikroTik وسيتوقف بث الإنترنت لجميع المشتركين لمدة دقيقة واحدة حتى يعود الراوتر للعمل.
            </p>

            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-300 mb-2">
                اكتب <strong className="text-white font-mono">REBOOT</strong> للمتابعة:
              </label>
              <input
                type="text"
                value={rebootConfirmText ?? ''}
                onChange={(e) => setRebootConfirmText(e.target.value)}
                placeholder="REBOOT"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:border-red-500 outline-none font-mono"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowRebootModal(false);
                  setRebootConfirmText('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer border border-slate-700"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={rebootConfirmText !== 'REBOOT' || rebooting}
                onClick={handleExecuteReboot}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-40 cursor-pointer"
              >
                {rebooting ? 'جارِ إرسال الأمر...' : 'تأكيد إعادة التشغيل'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
