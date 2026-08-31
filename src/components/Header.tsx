import React from 'react';
import { Server, User, ServerStatus } from '../types';
import {
  Server as ServerIcon,
  Bot,
  Wifi,
  WifiOff,
  AlertTriangle,
  Clock,
  LogOut,
  Shield,
  RefreshCw,
  Sliders,
} from 'lucide-react';

interface HeaderProps {
  user: User | null;
  servers: Server[];
  activeServer: Server | null;
  onSelectServer: (server: Server) => void;
  onLogout: () => void;
  onOpenServerSettings: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  onToggleSidebar?: () => void;
  onQuickReboot?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  servers,
  activeServer,
  onSelectServer,
  onLogout,
  onOpenServerSettings,
  onRefresh,
  isRefreshing,
  onToggleSidebar,
  onQuickReboot,
}) => {
  const getStatusBadge = (status: ServerStatus) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            متصل
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            جارِ الاتصال
          </span>
        );
      case 'AUTH_FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-2.5 h-2.5" />
            فشل المصادقة
          </span>
        );
      case 'TIMEOUT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <Clock className="w-2.5 h-2.5" />
            انتهاء المهلة
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <WifiOff className="w-2.5 h-2.5" />
            خطأ اتصال
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <WifiOff className="w-2.5 h-2.5" />
            غير متصل
          </span>
        );
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-[#0F172A] flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-20">
      {/* Left side (RTL start): Status indicators & Server selector */}
      <div className="flex items-center gap-3 sm:gap-6">
        {/* Mobile menu toggle */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            aria-label="القائمة الجانبية"
            className="md:hidden p-2 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
          >
            <Sliders className="w-4 h-4" />
          </button>
        )}

        {/* MikroTik Status Indicator */}
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              activeServer?.status === 'CONNECTED'
                ? 'bg-emerald-500'
                : activeServer?.status === 'CONNECTING'
                ? 'bg-amber-400 animate-spin'
                : 'bg-red-500'
            }`}
          ></span>
          <span className="text-xs font-medium text-slate-400 hidden sm:inline">
            حالة MikroTik:
          </span>
          <span className="text-xs font-semibold text-slate-200">
            {activeServer?.status === 'CONNECTED' ? 'متصل' : activeServer ? 'غير متصل' : 'لا يوجد سيرفر'}
          </span>
        </div>

        {/* Server Selector dropdown */}
        {servers.length > 0 && activeServer && (
          <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/80 rounded px-2 py-1">
            <ServerIcon className="w-3.5 h-3.5 text-indigo-400" />
            <select
              aria-label="اختيار السيرفر"
              value={activeServer.id}
              onChange={(e) => {
                const s = servers.find((item) => item.id === e.target.value);
                if (s) onSelectServer(s);
              }}
              className="bg-transparent text-xs font-medium text-slate-200 outline-none cursor-pointer pr-1 pl-2"
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                  {s.name} ({s.host})
                </option>
              ))}
            </select>
            {getStatusBadge(activeServer.status)}
          </div>
        )}

        {/* Telegram Status Indicator */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
          <span className="text-xs font-medium text-slate-400">بوت تليجرام:</span>
          <span className="text-xs font-semibold text-emerald-400">نشط</span>
        </div>
      </div>

      {/* Right side (RTL end): High Density action buttons */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Refresh Data button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="px-3 py-1.5 text-xs font-medium bg-slate-800 text-slate-200 rounded border border-slate-700 hover:bg-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          <span className="hidden sm:inline">تحديث البيانات</span>
        </button>

        {/* Quick Reboot button if handler provided */}
        {onQuickReboot && (
          <button
            onClick={onQuickReboot}
            className="px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-400 rounded border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>إعادة التشغيل</span>
          </button>
        )}
      </div>
    </header>
  );
};
