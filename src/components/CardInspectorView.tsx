import React, { useState, useEffect } from 'react';
import { Card, Server } from '../types';
import { api } from '../api';
import {
  Search,
  CheckCircle,
  AlertTriangle,
  Clock,
  HardDrive,
  User,
  Store,
  Calendar,
  KeyRound,
  Shield,
} from 'lucide-react';

interface CardInspectorViewProps {
  server: Server;
  initialQuery?: string;
}

export const CardInspectorView: React.FC<CardInspectorViewProps> = ({
  server,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setCard(null);

    try {
      const res = await api.checkCard(server.id, query.trim());
      if (res.card) {
        setCard(res.card);
      } else {
        setError('لم يتم العثور على الكرت المطلوب في قاعدة بيانات User Manager.');
      }
    } catch (err: any) {
      setError(err.message || 'فشل فحص الكرت.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      handleSearch();
    }
  }, [initialQuery]);

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Search className="w-4 h-4 text-indigo-400" />
          فاحص الكروت الذكي (Card Inspector)
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          استعلام فوري وتفصيلي عن كروت المشتركين، أوقات الاستخدام، الاستهلاك، وحالة الصلاحية
        </p>

        {/* Search Input */}
        <form onSubmit={handleSearch} className="mt-3 flex gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-2.5 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={query ?? ''}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="أدخل اسم المستخدم أو رقم الكرت (مثل: MK1001)..."
              className="w-full bg-slate-950 border border-slate-800 rounded pr-9 pl-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 outline-none font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm shadow-indigo-600/30 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'جارِ الفحص...' : 'فحص الكرت'}
          </button>
        </form>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {card && (
        <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
          {/* Card Top Identity */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2.5">
                <span className="text-xl font-bold text-white font-mono">{card.username}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {card.status}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                باقة المشترك: <strong className="text-slate-200">{card.profile}</strong> | السعر:{' '}
                <strong className="text-emerald-400">{card.price} ر.س</strong>
              </p>
            </div>

            <div className="text-left rtl:text-right sm:rtl:text-left text-[11px] font-mono text-slate-400">
              <div>كود الدفعة: {card.batchId || 'يدوي'}</div>
              <div>المعرّف الداخلي: {card.id}</div>
            </div>
          </div>

          {/* Detailed Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Password */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>كلمة المرور</span>
                <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div className="text-base font-mono font-bold text-slate-200">
                {card.password || <span className="text-slate-500 font-sans text-xs">بدون كلمة مرور</span>}
              </div>
            </div>

            {/* Total Uptime / Remaining */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>الوقت المستهلك / المتبقي</span>
                <Clock className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-base font-mono font-bold text-amber-300">
                {card.totalUptime || '0m'} مستهلك
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                المتبقي: {card.remainingTime || card.duration}
              </div>
            </div>

            {/* Data Usage */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>استهلاك البيانات (Data Traffic)</span>
                <HardDrive className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <div className="text-base font-mono font-bold text-white">
                ↓ {formatBytes(card.downloadBytes)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                ↑ {formatBytes(card.uploadBytes)} رفع
              </div>
            </div>

            {/* Creation Date */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>تاريخ الإنشاء</span>
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-xs font-mono text-slate-200">
                {new Date(card.creationDate).toLocaleString('ar-SA')}
              </div>
            </div>

            {/* First & Last Login */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>أول وآخر تسجيل دخول</span>
                <User className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div className="text-[11px] text-slate-300">
                أول دخول: {card.firstLogin ? new Date(card.firstLogin).toLocaleDateString('ar-SA') : 'لم يسجل بعد'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                آخر نشاط: {card.lastLogin ? new Date(card.lastLogin).toLocaleDateString('ar-SA') : '-'}
              </div>
            </div>

            {/* Assigned POS */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>نقطة البيع المسند إليها</span>
                <Store className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="text-xs font-bold text-slate-200">
                {card.posName || 'المخزون العام غير المخصص'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
