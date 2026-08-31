import React, { useState } from 'react';
import { AuditLog, Server } from '../types';
import { Shield, Search, Filter, RefreshCw, CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface AuditLogsViewProps {
  server: Server;
  logs: AuditLog[];
  onRefresh: () => void;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({
  server,
  logs,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const filteredLogs = logs.filter((log) => {
    const matchStatus = statusFilter === 'ALL' || log.status === statusFilter;
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      log.operation.toLowerCase().includes(q) ||
      (log.telegramId && log.telegramId.toString().includes(q)) ||
      (log.ip && log.ip.includes(q));
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            سجل العمليات والرقابة الأمنية (Audit Logs)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            توثيق رقمي غير قابل للتلاعب لجميع الأوامر المنفذة عبر Telegram أو لوحة الويب مع تتبع الـ IP والمنفّذ
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search className="absolute right-3 top-2.5 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالعملية أو Telegram ID أو IP..."
              className="w-full bg-slate-900 border border-slate-800 rounded pr-9 pl-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 outline-none cursor-pointer"
          >
            <option value="ALL">جميع النتائج</option>
            <option value="SUCCESS">ناجحة (Success)</option>
            <option value="WARNING">تحذيرية (Warning)</option>
            <option value="FAILURE">فاشلة (Failure)</option>
          </select>

          <button
            onClick={onRefresh}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right rtl:text-right">
            <thead className="bg-slate-900/50 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-medium">
              <tr>
                <th className="py-2.5 px-4">نوع العملية</th>
                <th className="py-2.5 px-4">النتيجة</th>
                <th className="py-2.5 px-4">المنفّذ (Actor)</th>
                <th className="py-2.5 px-4">عنوان IP</th>
                <th className="py-2.5 px-4">التوقيت والتاريخ</th>
                <th className="py-2.5 px-4 text-center">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    لا توجد سجلات مطابقة للبحث.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-white font-mono">{log.operation}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : log.status === 'WARNING'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {log.status === 'SUCCESS' ? 'ناجح' : log.status === 'WARNING' ? 'تحذير' : 'فشل'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">
                      {log.telegramId ? (
                        <span className="text-indigo-300 font-mono text-[11px]">Telegram ID: {log.telegramId}</span>
                      ) : (
                        <span className="text-slate-300">لوحة تحكم الويب</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-400 text-[11px]">{log.ip || '127.0.0.1'}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-400 text-[11px]">
                      {new Date(log.timestamp).toLocaleString('ar-SA')}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-medium border border-slate-700 transition-colors cursor-pointer"
                      >
                        عرض
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">تفاصيل العملية المسجلة: {selectedLog.operation}</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded border border-slate-700 cursor-pointer"
              >
                إغلاق
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">معرّف السجل:</span>
                <span className="font-mono text-slate-200 text-[11px]">{selectedLog.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">التاريخ والوقت:</span>
                <span className="font-mono text-slate-200 text-[11px]">{new Date(selectedLog.timestamp).toISOString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">النتيجة:</span>
                <span className="font-bold text-emerald-400">{selectedLog.status}</span>
              </div>
              {selectedLog.error && (
                <div className="py-1 border-b border-slate-800 text-red-400">
                  <span>الخطأ: </span>
                  <span>{selectedLog.error}</span>
                </div>
              )}
              {selectedLog.metadata && (
                <div>
                  <span className="text-slate-400 block mb-1">البيانات الإضافية (Metadata):</span>
                  <pre className="bg-slate-950 p-3 rounded-lg text-[11px] font-mono text-indigo-300 overflow-x-auto border border-slate-800">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
