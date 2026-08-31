import React, { useState, useEffect } from 'react';
import { BackupItem, Server } from '../types';
import { api } from '../api';
import { Database, Plus, RefreshCw, AlertTriangle, CheckCircle, RotateCcw, ShieldCheck } from 'lucide-react';

interface BackupRestoreViewProps {
  server: Server;
}

export const BackupRestoreView: React.FC<BackupRestoreViewProps> = ({ server }) => {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoringFile, setRestoringFile] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await api.getBackups(server.id);
      setBackups(res.backups || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, [server.id]);

  const handleCreateBackup = async () => {
    setCreating(true);
    setMsg(null);
    setErr(null);
    try {
      await api.createBackup(server.id);
      setMsg('تم إنشاء النسخة الاحتياطية بنجاح.');
      fetchBackups();
    } catch (e: any) {
      setErr(e.message || 'فشل إنشاء النسخة الاحتياطية.');
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (filename: string) => {
    if (confirmText !== 'RESTORE') {
      setErr('يرجى كتابة كلمة RESTORE للتأكيد.');
      return;
    }

    setLoading(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await api.restoreBackup(server.id, filename);
      setMsg(res.message || 'تمت استعادة النسخة الاحتياطية بنجاح.');
      setRestoringFile(null);
      setConfirmText('');
      fetchBackups();
    } catch (e: any) {
      setErr(e.message || 'فشلت الاستعادة.');
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    const kb = bytes / 1024;
    if (kb > 1024) return `${(kb / 1024).toFixed(2)} MB`;
    return `${kb.toFixed(1)} KB`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" />
            النسخ الاحتياطي والاستعادة الآمنة
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            أخذ نسخ احتياطية لقاعدة بيانات User Manager وإعدادات RouterOS مع فحص السلامة (Checksum)
          </p>
        </div>

        <button
          onClick={handleCreateBackup}
          disabled={creating}
          className="px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-sm shadow-indigo-600/30 transition-all disabled:opacity-50 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          {creating ? 'جارِ النسخ الاحتياطي...' : 'إنشاء نسخة احتياطية فورية (Backup)'}
        </button>
      </div>

      {msg && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {err && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{err}</span>
        </div>
      )}

      {/* Backups List */}
      <div className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right rtl:text-right">
            <thead className="bg-slate-900/50 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-medium">
              <tr>
                <th className="py-2.5 px-4">اسم الملف</th>
                <th className="py-2.5 px-4">النوع</th>
                <th className="py-2.5 px-4">الحجم</th>
                <th className="py-2.5 px-4">تاريخ الإنشاء</th>
                <th className="py-2.5 px-4">فحص السلامة (Checksum)</th>
                <th className="py-2.5 px-4 text-center">إجراءات الاستعادة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    لا توجد نسخ احتياطية مسجلة لهذا السيرفر حتى الآن.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-bold text-white flex items-center gap-2">
                      <Database className="w-3.5 h-3.5 text-indigo-400" />
                      {b.filename}
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">{b.type}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-300 text-[11px]">{formatSize(b.sizeBytes)}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-400 text-[11px]">
                      {new Date(b.createdAt).toLocaleString('ar-SA')}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        <ShieldCheck className="w-3 h-3" />
                        سليمة ({b.checksum.substring(0, 8)}...)
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => setRestoringFile(b.filename)}
                        className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-[10px] font-medium flex items-center gap-1 mx-auto transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        استعادة (Restore)
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Restore */}
      {restoringFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-xl shadow-2xl p-5">
            <div className="flex items-center gap-2.5 text-amber-400 mb-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <h3 className="text-sm font-bold text-white">تأكيد استعادة النسخة الاحتياطية</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              تحذير: سيتم استبدال قاعدة بيانات User Manager الحالية بالملف:
              <span className="font-mono text-amber-300 block my-1 font-bold">{restoringFile}</span>
              سيقوم النظام بأخذ نسخة احتياطية طارئة تلقائياً قبل البدء.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                اكتب <strong className="text-white font-mono">RESTORE</strong> للتأكيد:
              </label>
              <input
                type="text"
                value={confirmText ?? ''}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESTORE"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white focus:border-amber-500 outline-none font-mono"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRestoringFile(null);
                  setConfirmText('');
                }}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 cursor-pointer border border-slate-700"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={confirmText !== 'RESTORE' || loading}
                onClick={() => handleRestore(restoringFile)}
                className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-40 cursor-pointer"
              >
                {loading ? 'جارِ الاستعادة...' : 'تأكيد الاستعادة الآن'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
