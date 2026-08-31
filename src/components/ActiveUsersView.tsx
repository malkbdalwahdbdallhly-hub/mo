import React, { useState } from 'react';
import { ActiveUser, Server } from '../types';
import { api } from '../api';
import {
  Users,
  Search,
  RefreshCw,
  UserX,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  Radio,
  ArrowDown,
  ArrowUp,
  Globe,
} from 'lucide-react';

interface ActiveUsersViewProps {
  server: Server;
  activeUsers: ActiveUser[];
  onRefresh: () => void;
}

export const ActiveUsersView: React.FC<ActiveUsersViewProps> = ({
  server,
  activeUsers,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isReal = server.connectionType !== 'MOCK';

  const filteredUsers = activeUsers.filter((u) => {
    const q = search.toLowerCase().trim();
    return (
      !q ||
      u.username.toLowerCase().includes(q) ||
      u.ipAddress.toLowerCase().includes(q) ||
      u.macAddress.toLowerCase().includes(q)
    );
  });

  const handleDisconnect = async (username: string) => {
    if (!window.confirm(`هل أنت متأكد من فصل المشترك [${username}] فوراً من راوتر MikroTik؟`)) return;
    setDisconnecting(username);
    setMsg(null);
    setErr(null);

    try {
      await api.disconnectUser(server.id, username);
      setMsg(`تم فصل المشترك [${username}] بنجاح من الراوتر.`);
      onRefresh();
    } catch (e: any) {
      setErr(e.message || 'فشل فصل المشترك.');
    } finally {
      setDisconnecting(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Users className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-white">
              المستخدمون النشطون حالياً ({activeUsers.length})
            </h2>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                isReal
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              {isReal ? 'بيانات حية من راوتر MikroTik' : 'بيئة تجريبية'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            مراقبة الجلسات الحية على سيرفر ({server.name}) واستعراض استهلاك البيانات وقطع الاتصال الفوري.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute right-3.5 top-3 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search ?? ''}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو IP أو MAC..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-10 pl-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 outline-none font-mono"
            />
          </div>

          <button
            onClick={onRefresh}
            title="تحديث البيانات"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {err && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{err}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-xs font-semibold">
              <tr>
                <th className="py-3.5 px-5">اسم المستخدم</th>
                <th className="py-3.5 px-5">عنوان IP</th>
                <th className="py-3.5 px-5">عنوان MAC</th>
                <th className="py-3.5 px-5">الخدمة</th>
                <th className="py-3.5 px-5">الباقة</th>
                <th className="py-3.5 px-5">مدة الاتصال (Uptime)</th>
                <th className="py-3.5 px-5">تحميل / رفع</th>
                <th className="py-3.5 px-5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-sm">
                    لا يوجد متصلون نشطون على هذا السيرفر حالياً.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-850/60 transition-colors">
                    <td className="py-3.5 px-5 font-bold text-white font-mono flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>{u.username}</span>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-indigo-300">{u.ipAddress}</td>
                    <td className="py-3.5 px-5 font-mono text-slate-400 text-[11px]">{u.macAddress}</td>
                    <td className="py-3.5 px-5 uppercase text-slate-300 font-semibold text-[11px]">{u.service}</td>
                    <td className="py-3.5 px-5 text-slate-200">{u.profile}</td>
                    <td className="py-3.5 px-5 font-mono text-amber-400">{u.uptime}</td>
                    <td className="py-3.5 px-5 font-mono text-slate-300 text-xs">
                      <span className="text-emerald-400">↓ {formatBytes(u.downloadBytes)}</span>
                      <span className="mx-1 text-slate-600">|</span>
                      <span className="text-cyan-400">↑ {formatBytes(u.uploadBytes)}</span>
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <button
                        onClick={() => handleDisconnect(u.username)}
                        disabled={disconnecting === u.username}
                        title="فصل المشترك فوراً"
                        className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold flex items-center gap-1.5 mx-auto transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>{disconnecting === u.username ? 'فصل...' : 'فصل'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
