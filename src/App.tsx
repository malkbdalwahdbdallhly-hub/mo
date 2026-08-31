import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import {
  User,
  Server,
  ServerStats,
  Card,
  CardProfile,
  CardSettings,
  POS,
  ActiveUser,
  AuditLog,
  TelegramAccount,
} from './types';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { DashboardView } from './components/DashboardView';
import { ServerSetupView } from './components/ServerSetupView';
import { TelegramView } from './components/TelegramView';
import { CardsView } from './components/CardsView';
import { CardPrintEngine } from './components/CardPrintEngine';
import { CardSettingsView } from './components/CardSettingsView';
import { PosView } from './components/PosView';
import { ActiveUsersView } from './components/ActiveUsersView';
import { CardInspectorView } from './components/CardInspectorView';
import { ReportsView } from './components/ReportsView';
import { BackupRestoreView } from './components/BackupRestoreView';
import { DiagnosticsView } from './components/DiagnosticsView';
import { AuditLogsView } from './components/AuditLogsView';

import {
  LayoutDashboard,
  Server as ServerIcon,
  Bot,
  CreditCard,
  Printer,
  Sliders,
  Store,
  Users,
  Search,
  TrendingUp,
  Database,
  Wrench,
  Shield,
  RefreshCw,
  X,
  LogOut,
} from 'lucide-react';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Active Tab & Sidebar State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Multi-server state
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServer, setActiveServer] = useState<Server | null>(null);
  const [serverStats, setServerStats] = useState<ServerStats | null>(null);

  // Entities state
  const [cards, setCards] = useState<Card[]>([]);
  const [profiles, setProfiles] = useState<CardProfile[]>([]);
  const [cardSettings, setCardSettings] = useState<CardSettings | null>(null);
  const [posList, setPosList] = useState<POS[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [telegramAccounts, setTelegramAccounts] = useState<TelegramAccount[]>([]);

  // Print view state
  const [cardsToPrint, setCardsToPrint] = useState<Card[]>([]);

  // Inspector quick query
  const [inspectQuery, setInspectQuery] = useState('');

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Verify token on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = api.getToken();
      if (token) {
        try {
          const res = await api.getMe();
          setUser(res.user);
        } catch {
          api.logout();
          setUser(null);
        }
      }
      setLoadingInitial(false);
    };
    initAuth();
  }, []);

  // Fetch servers list
  const fetchServers = useCallback(async () => {
    try {
      const res = await api.getServers();
      setServers(res.servers || []);
      if (res.servers?.length > 0) {
        setActiveServer((prev) => {
          if (prev && res.servers.some((s: Server) => s.id === prev.id)) {
            return res.servers.find((s: Server) => s.id === prev.id);
          }
          return res.servers.find((s: Server) => s.isDefault) || res.servers[0];
        });
      } else {
        setActiveServer(null);
      }
    } catch (err) {
      console.error('Failed to fetch servers:', err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchServers();
    }
  }, [user, fetchServers]);

  // Fetch active server data in parallel
  const fetchServerData = useCallback(async () => {
    if (!activeServer) return;
    setIsRefreshing(true);

    try {
      const [statsRes, cardsRes, profilesRes, settingsRes, posRes, usersRes, logsRes, tgRes] =
        await Promise.allSettled([
          api.getServerStatus(activeServer.id),
          api.getCards(activeServer.id),
          api.getProfiles(activeServer.id),
          api.getCardSettings(activeServer.id),
          api.getPosList(activeServer.id),
          api.getActiveUsers(activeServer.id),
          api.getAuditLogs(activeServer.id),
          api.getTelegramAccounts(),
        ]);

      if (statsRes.status === 'fulfilled') setServerStats(statsRes.value.stats);
      if (cardsRes.status === 'fulfilled') setCards(cardsRes.value.cards || []);
      if (profilesRes.status === 'fulfilled') setProfiles(profilesRes.value.profiles || []);
      if (settingsRes.status === 'fulfilled') setCardSettings(settingsRes.value.settings || null);
      if (posRes.status === 'fulfilled') setPosList(posRes.value.posList || []);
      if (usersRes.status === 'fulfilled') setActiveUsers(usersRes.value.activeUsers || []);
      if (logsRes.status === 'fulfilled') setAuditLogs(logsRes.value.logs || []);
      if (tgRes.status === 'fulfilled') setTelegramAccounts(tgRes.value.accounts || []);
    } catch (err) {
      console.error('Data refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeServer]);

  useEffect(() => {
    if (activeServer) {
      fetchServerData();
    }
  }, [activeServer, fetchServerData]);

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setActiveServer(null);
    setServers([]);
  };

  const handleOpenPrint = (selectedCards: Card[]) => {
    setCardsToPrint(selectedCards.length > 0 ? selectedCards : cards);
    setActiveTab('card_print');
  };

  const handleInspectCard = (cardUsername: string) => {
    setInspectQuery(cardUsername);
    setActiveTab('inspector');
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center text-white font-black text-2xl animate-pulse mb-4">
          M
        </div>
        <p className="text-sm font-semibold">جارِ تحميل منصة Makeen...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthModal onSuccess={(u) => setUser(u)} />;
  }

  const navTabs = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'server_setup', label: 'إعداد السيرفر', icon: ServerIcon },
    { id: 'telegram', label: 'بوت Telegram', icon: Bot, badge: 'مباشر' },
    { id: 'cards', label: 'إدارة وتوليد الكروت', icon: CreditCard },
    { id: 'card_print', label: 'طباعة الكروت وقوالب A4', icon: Printer },
    { id: 'card_settings', label: 'إعدادات الكروت', icon: Sliders },
    { id: 'pos', label: 'نقاط البيع', icon: Store },
    { id: 'active_users', label: 'المستخدمون النشطون', icon: Users, count: activeUsers.length },
    { id: 'inspector', label: 'فاحص كرت', icon: Search },
    { id: 'reports', label: 'التقارير المالية', icon: TrendingUp },
    { id: 'backups', label: 'النسخ الاحتياطي', icon: Database },
    { id: 'diagnostics', label: 'التشخيص والصيانة', icon: Wrench },
    { id: 'audit', label: 'سجل العمليات', icon: Shield },
  ];

  return (
    <div className="flex h-screen w-full flex-row bg-[#0F172A] font-sans text-slate-200 overflow-hidden" dir="rtl">
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-xs"
        />
      )}

      {/* High Density Aside Sidebar */}
      <aside
        className={`w-64 border-l border-slate-800 bg-[#1E293B] flex flex-col flex-shrink-0 z-40 transition-all duration-200 ${
          sidebarOpen ? 'fixed inset-y-0 right-0 shadow-2xl flex' : 'hidden md:flex'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 text-sm">
              M
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-none">مـكـيـن</h1>
              <span className="text-[10px] text-slate-400 font-mono">Makeen Pro v2.5</span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="إغلاق القائمة"
            className="md:hidden text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <nav aria-label="أقسام المنصة" className="flex-1 p-3 space-y-1 text-sm overflow-y-auto">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 font-semibold'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{tab.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {tab.badge && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/80 font-mono">
                      {tab.badge}
                    </span>
                  )}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                      {tab.count}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold flex-shrink-0">
              {user.name ? user.name.slice(0, 2).toUpperCase() : 'AD'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="تسجيل الخروج"
              className="text-slate-400 hover:text-red-400 transition-colors p-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#0F172A]">
        {/* Header Bar */}
        <Header
          user={user}
          servers={servers}
          activeServer={activeServer}
          onSelectServer={(s) => setActiveServer(s)}
          onLogout={handleLogout}
          onOpenServerSettings={() => setActiveTab('server_setup')}
          onRefresh={fetchServerData}
          isRefreshing={isRefreshing}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onQuickReboot={() => setActiveTab('diagnostics')}
        />

        {/* View Switcher Viewport */}
        <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto bg-[#0F172A]">
          {(!activeServer || servers.length === 0) && activeTab !== 'server_setup' ? (
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-8 text-center max-w-xl mx-auto my-12">
              <ServerIcon className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">يرجى إعداد سيرفر MikroTik أولاً</h2>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                للبدء في إدارة الكروت والمشتركين والربط مع بوت Telegram، قم بإدخال بيانات الاتصال بسيرفر RouterOS.
              </p>
              <button
                onClick={() => setActiveTab('server_setup')}
                className="px-6 py-2.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
              >
                الانتقال لشاشة إعداد السيرفر
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && activeServer && (
                <DashboardView
                  server={activeServer}
                  stats={serverStats}
                  logs={auditLogs}
                  onNavigateTab={(t) => setActiveTab(t)}
                  onRefresh={fetchServerData}
                  isRefreshing={isRefreshing}
                />
              )}

              {activeTab === 'server_setup' && (
                <ServerSetupView
                  servers={servers}
                  activeServer={activeServer}
                  onRefreshServers={fetchServers}
                  onSelectServer={(s) => setActiveServer(s)}
                />
              )}

              {activeTab === 'telegram' && (
                <TelegramView
                  accounts={telegramAccounts}
                  onRefreshAccounts={fetchServerData}
                />
              )}

              {activeTab === 'cards' && activeServer && (
                <CardsView
                  server={activeServer}
                  cards={cards}
                  profiles={profiles}
                  posList={posList}
                  onRefreshCards={fetchServerData}
                  onOpenPrint={handleOpenPrint}
                  onInspectCard={handleInspectCard}
                />
              )}

              {activeTab === 'card_print' && (
                <CardPrintEngine
                  cards={cardsToPrint.length > 0 ? cardsToPrint : cards}
                  settings={cardSettings}
                  onBack={() => setActiveTab('cards')}
                />
              )}

              {activeTab === 'card_settings' && activeServer && (
                <CardSettingsView
                  server={activeServer}
                  settings={cardSettings}
                  profiles={profiles}
                  onRefreshSettings={fetchServerData}
                />
              )}

              {activeTab === 'pos' && activeServer && (
                <PosView
                  server={activeServer}
                  posList={posList}
                  onRefreshPos={fetchServerData}
                />
              )}

              {activeTab === 'active_users' && activeServer && (
                <ActiveUsersView
                  server={activeServer}
                  activeUsers={activeUsers}
                  onRefresh={fetchServerData}
                />
              )}

              {activeTab === 'inspector' && activeServer && (
                <CardInspectorView
                  server={activeServer}
                  initialQuery={inspectQuery}
                />
              )}

              {activeTab === 'reports' && activeServer && (
                <ReportsView server={activeServer} />
              )}

              {activeTab === 'backups' && activeServer && (
                <BackupRestoreView server={activeServer} />
              )}

              {activeTab === 'diagnostics' && activeServer && (
                <DiagnosticsView
                  server={activeServer}
                  stats={serverStats}
                  onRefresh={fetchServerData}
                />
              )}

              {activeTab === 'audit' && activeServer && (
                <AuditLogsView
                  server={activeServer}
                  logs={auditLogs}
                  onRefresh={fetchServerData}
                />
              )}
            </>
          )}

          {/* High Density Status Footer */}
          <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-900/50 p-3 border border-slate-800 rounded-lg text-[10px] text-slate-500 gap-2 mt-8">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                <span>المهام النشطة: 0</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                <span>قاعدة البيانات: متصلة</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400"></span>
                <span>User Manager: نشط</span>
              </div>
            </div>
            <div className="font-mono text-[10px] text-slate-500">
              Makeen Management v2.5 Pro High-Density
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
export default App;
