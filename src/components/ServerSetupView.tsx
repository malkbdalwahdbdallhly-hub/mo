import React, { useState } from 'react';
import { Server, ConnectionType } from '../types';
import { api } from '../api';
import {
  Server as ServerIcon,
  Shield,
  Zap,
  Play,
  Square,
  Trash2,
  Edit2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Radio,
  Lock,
  Globe,
  Terminal,
  Copy,
  Check,
  Activity,
  ArrowRight,
  Wifi,
  WifiOff,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from 'lucide-react';

interface ServerSetupViewProps {
  servers: Server[];
  activeServer: Server | null;
  onRefreshServers: () => void;
  onSelectServer: (server: Server) => void;
}

export const ServerSetupView: React.FC<ServerSetupViewProps> = ({
  servers,
  activeServer,
  onRefreshServers,
  onSelectServer,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(activeServer?.id || null);
  const [showCloudGuide, setShowCloudGuide] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState(activeServer?.name || '');
  const [host, setHost] = useState(activeServer?.host || '');
  const [apiPort, setApiPort] = useState(activeServer?.apiPort?.toString() || '8728');
  const [apiSslPort, setApiSslPort] = useState(activeServer?.apiSslPort?.toString() || '8729');
  const [sshPort, setSshPort] = useState(activeServer?.sshPort?.toString() || '22');
  const [username, setUsername] = useState(activeServer?.username || 'admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [connectionType, setConnectionType] = useState<ConnectionType>(
    activeServer?.connectionType || 'ROUTEROS_V6'
  );
  const [osVersion, setOsVersion] = useState<'v6' | 'v7' | 'auto'>(
    activeServer?.osVersion || 'v6'
  );
  const [cloudGuideTab, setCloudGuideTab] = useState<'v6' | 'v7'>('v6');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    message: string;
    version?: string;
    boardName?: string;
    identity?: string;
    cloudDdns?: string;
    publicIp?: string;
    protocol?: string;
    steps?: Array<{ name: string; status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'INFO'; detail: string }>;
    troubleshooting?: string[];
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  const startCreateNew = () => {
    setSelectedServerId(null);
    setName('');
    setHost('');
    setApiPort('8728');
    setApiSslPort('8729');
    setSshPort('22');
    setUsername('admin');
    setPassword('');
    setOsVersion('v6');
    setConnectionType('ROUTEROS_V6');
    setIsEditing(true);
    setTestResult(null);
    setErrorMessage(null);
    setStatusMessage(null);
  };

  const startEdit = (server: Server) => {
    setSelectedServerId(server.id);
    setName(server.name || '');
    setHost(server.host || '');
    setApiPort((server.apiPort ?? 8728).toString());
    setApiSslPort((server.apiSslPort ?? 8729).toString());
    setSshPort((server.sshPort ?? 22).toString());
    setUsername(server.username || 'admin');
    setPassword(''); // leave blank unless changing
    setConnectionType(server.connectionType || 'ROUTEROS_V6');
    setOsVersion(server.osVersion || (server.connectionType === 'ROUTEROS_V6' ? 'v6' : 'auto'));
    setIsEditing(true);
    setTestResult(null);
    setErrorMessage(null);
    setStatusMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      if (selectedServerId) {
        // Update existing
        await api.updateServer(selectedServerId, {
          name,
          host,
          apiPort: parseInt(apiPort, 10) || 8728,
          apiSslPort: parseInt(apiSslPort, 10) || 8729,
          sshPort: parseInt(sshPort, 10) || 22,
          username,
          password: password || undefined,
          connectionType,
          osVersion,
        });
        setStatusMessage('تم تحديث إعدادات السيرفر وحفظ التغييرات بنجاح.');
      } else {
        // Create new
        const res = await api.createServer({
          name,
          host,
          apiPort: parseInt(apiPort, 10) || 8728,
          apiSslPort: parseInt(apiSslPort, 10) || 8729,
          sshPort: parseInt(sshPort, 10) || 22,
          username,
          password,
          connectionType,
          osVersion,
        });
        setSelectedServerId(res.server.id);
        setStatusMessage('تمت إضافة السيرفر بنجاح إلى المنصة.');
      }
      setIsEditing(false);
      onRefreshServers();
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل حفظ إعدادات السيرفر.');
    } finally {
      setSaving(false);
    }
  };

  const handleLiveProbe = async () => {
    if (!host || !username) {
      setErrorMessage('يرجى إدخال عنوان المضيف (IP/Cloud) واسم المستخدم لاختبار الاتصال.');
      return;
    }

    setTesting(true);
    setTestResult(null);
    setErrorMessage(null);

    try {
      let res;
      if (selectedServerId && !password) {
        // Use existing server's stored credentials
        res = await api.testConnection(selectedServerId);
      } else {
        // Direct live probe with form values
        res = await api.probeServer({
          host,
          username,
          password,
          apiPort: parseInt(apiPort, 10) || 8728,
          apiSslPort: parseInt(apiSslPort, 10) || 8729,
          connectionType,
          osVersion,
        });
      }

      setTestResult(res);
      if (res.success) {
        onRefreshServers();
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        message: err.message || 'تعذر الوصول إلى راوتر الميكروتيك.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleToggleState = async (server: Server, newStatus: 'CONNECTED' | 'DISCONNECTED') => {
    try {
      await api.setServerState(server.id, newStatus);
      onRefreshServers();
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السيرفر من المنصة؟ لن يؤثر ذلك على جهاز MikroTik الفعلي.')) {
      return;
    }
    try {
      await api.deleteServer(serverId);
      onRefreshServers();
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ServerIcon className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-white">إدارة والاتصال بسيرفرات MikroTik</h2>
          </div>
          <p className="text-sm text-slate-400">
            ربط حقيقي مباشر مع أجهزة RouterOS عبر الكلاود (Cloud DDNS) أو الـ IP الثابت مع تشفير AES-256 للمصادقة.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCloudGuide(!showCloudGuide)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>دليل إعداد الكلاود</span>
            {showCloudGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={startCreateNew}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-sm shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة سيرفر جديد</span>
          </button>
        </div>
      </div>

      {/* Cloud DDNS Setup Guide Card */}
      {showCloudGuide && (
        <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 shadow-lg relative overflow-hidden">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Terminal className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">
                  دليل ربط راوتر MikroTik عبر الكلاود (Cloud DDNS)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  نفذ الأوامر التالية في Terminal راوتر الميكروتك (عبر WinBox) لفتح الاتصال الحقيقي:
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCloudGuide(false)}
              className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded bg-slate-800 cursor-pointer"
            >
              إغلاق
            </button>
          </div>

          {/* Guide Version Selector Tabs */}
          <div className="flex items-center gap-2 mb-4 p-1 bg-slate-950 rounded-xl border border-slate-800 w-fit">
            <button
              type="button"
              onClick={() => setCloudGuideTab('v6')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                cloudGuideTab === 'v6'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>أوامر RouterOS v6 (نسختك)</span>
              <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.2 rounded font-mono">8728</span>
            </button>
            <button
              type="button"
              onClick={() => setCloudGuideTab('v7')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                cloudGuideTab === 'v7'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>أوامر RouterOS v7</span>
              <span className="text-[10px] bg-blue-500/30 text-blue-300 px-1.5 py-0.2 rounded font-mono">REST / API</span>
            </button>
          </div>

          {cloudGuideTab === 'v6' ? (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs mb-3">
                {/* Step 1 */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-300">1. تفعيل الكلاود (Cloud DDNS)</span>
                    <button
                      onClick={() =>
                        copyToClipboard('/ip cloud set ddns-enabled=yes update-time=yes\n/ip cloud print', 'cmd1_v6')
                      }
                      className="text-slate-400 hover:text-white p-1 rounded bg-slate-800 cursor-pointer"
                    >
                      {copiedCmd === 'cmd1_v6' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <pre className="p-2.5 rounded bg-slate-900 text-[11px] font-mono text-emerald-400 overflow-x-auto border border-slate-800">
                    /ip cloud set ddns-enabled=yes update-time=yes{'\n'}/ip cloud print
                  </pre>
                  <p className="text-slate-400 text-[11px]">
                    انسخ قيمة <span className="text-indigo-300 font-mono">dns-name</span> مثل: <span className="text-indigo-300 font-mono">xxxx.sn.mynetname.net</span>
                  </p>
                </div>

                {/* Step 2 */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-300">2. تفعيل خدمة API منفذ 8728</span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          '/ip service enable api\n/ip service set api port=8728 disabled=no',
                          'cmd2_v6'
                        )
                      }
                      className="text-slate-400 hover:text-white p-1 rounded bg-slate-800 cursor-pointer"
                    >
                      {copiedCmd === 'cmd2_v6' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <pre className="p-2.5 rounded bg-slate-900 text-[11px] font-mono text-emerald-400 overflow-x-auto border border-slate-800">
                    /ip service enable api{'\n'}/ip service set api port=8728 disabled=no
                  </pre>
                  <p className="text-slate-400 text-[11px]">
                    يضمن تشغيل خدمة API الثنائية المتوافقة مع v6.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-300">3. فتح المنفذ بالجدار الناري</span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          '/ip firewall filter add chain=input protocol=tcp dst-port=8728 action=accept comment="Allow-Mikrotik-API-v6" place-before=1',
                          'cmd3_v6'
                        )
                      }
                      className="text-slate-400 hover:text-white p-1 rounded bg-slate-800 cursor-pointer"
                    >
                      {copiedCmd === 'cmd3_v6' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <pre className="p-2.5 rounded bg-slate-900 text-[11px] font-mono text-emerald-400 overflow-x-auto border border-slate-800">
                    /ip firewall filter add chain=input protocol=tcp dst-port=8728 action=accept comment="Allow-Mikrotik-API-v6" place-before=1
                  </pre>
                  <p className="text-slate-400 text-[11px]">
                    خطوة حاسمة للسماح بالاتصال الخارجي عبر الكلاود دون أن يحظره الراوتر.
                  </p>
                </div>
              </div>

              {/* Copy All v6 Commands */}
              <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-300">
                  هل تريد تنفيذ كافة إعدادات RouterOS v6 دفعة واحدة في سطر واحد؟
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      '/ip cloud set ddns-enabled=yes update-time=yes\n/ip service enable api\n/ip service set api port=8728 disabled=no\n/ip firewall filter add chain=input protocol=tcp dst-port=8728 action=accept comment="Allow-Mikrotik-API-v6" place-before=1\n/ip cloud print',
                      'cmd_all_v6'
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  {copiedCmd === 'cmd_all_v6' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>تم النسخ!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ كافة أوامر v6 معاً</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Step 1 v7 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300">1. تفعيل الكلاود وتحديث DDNS</span>
                  <button
                    onClick={() =>
                      copyToClipboard('/ip cloud set ddns-enabled=yes update-time=yes', 'cmd1_v7')
                    }
                    className="text-slate-400 hover:text-white p-1 rounded bg-slate-800 cursor-pointer"
                  >
                    {copiedCmd === 'cmd1_v7' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <pre className="p-2.5 rounded bg-slate-900 text-[11px] font-mono text-emerald-400 overflow-x-auto border border-slate-800">
                  /ip cloud set ddns-enabled=yes update-time=yes
                </pre>
                <p className="text-slate-400 text-[11px]">
                  يعطيك هذا الأمر عنوان مثل: <span className="text-indigo-300 font-mono">xxxx.sn.mynetname.net</span>
                </p>
              </div>

              {/* Step 2 v7 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300">2. تفعيل منافذ REST و API</span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        '/ip service enable api\n/ip service enable www-ssl\n/ip service enable www',
                        'cmd2_v7'
                      )
                    }
                    className="text-slate-400 hover:text-white p-1 rounded bg-slate-800 cursor-pointer"
                  >
                    {copiedCmd === 'cmd2_v7' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <pre className="p-2.5 rounded bg-slate-900 text-[11px] font-mono text-emerald-400 overflow-x-auto border border-slate-800">
                  /ip service enable api{'\n'}/ip service enable www-ssl{'\n'}/ip service enable www
                </pre>
                <p className="text-slate-400 text-[11px]">
                  يفتح المنفذ 8728 (لـ API) والمنفذ 443 (لـ RouterOS v7 REST).
                </p>
              </div>

              {/* Step 3 v7 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300">3. التحقق من اسم الكلاود</span>
                  <button
                    onClick={() => copyToClipboard('/ip cloud print', 'cmd3_v7')}
                    className="text-slate-400 hover:text-white p-1 rounded bg-slate-800 cursor-pointer"
                  >
                    {copiedCmd === 'cmd3_v7' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <pre className="p-2.5 rounded bg-slate-900 text-[11px] font-mono text-emerald-400 overflow-x-auto border border-slate-800">
                  /ip cloud print
                </pre>
                <p className="text-slate-400 text-[11px]">
                  انسخ قيمة <span className="text-indigo-300 font-mono">dns-name</span> وضعها في خانة "المضيف".
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notifications */}
      {statusMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Servers List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {servers.map((server) => {
          const isSelected = activeServer?.id === server.id;
          const isReal = server.connectionType !== 'MOCK';
          const isConnected = server.status === 'CONNECTED';

          return (
            <div
              key={server.id}
              className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-900 border-indigo-500 shadow-md ring-1 ring-indigo-500/30'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
              }`}
            >
              <div>
                {/* Card Top: Server Title, Host & Edit Action */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-base text-white">{server.name}</h4>
                      {server.isDefault && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                          رئيسي
                        </span>
                      )}
                      {(server.osVersion === 'v6' || server.connectionType === 'ROUTEROS_V6') && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-bold font-mono">
                          RouterOS v6
                        </span>
                      )}
                      {server.osVersion === 'v7' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/25 font-medium font-mono">
                          RouterOS v7
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-mono text-indigo-300">
                      <Globe className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{server.host}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(server)}
                      title="تعديل الإعدادات"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteServer(server.id)}
                      title="حذف السيرفر"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors border border-slate-700 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Connection Status Pill */}
                <div className="mb-4">
                  {isConnected ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>{isReal ? 'اتصال حقيقي مباشر بالراوتر' : 'محاكاة تجريبية نشطة'}</span>
                    </div>
                  ) : server.status === 'CONNECTING' ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                      <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                      <span>جارِ فحص الاتصال...</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-red-400"></span>
                      <span>غير متصل: {server.lastErrorMessage || 'فشل الاتصال'}</span>
                    </div>
                  )}
                </div>

                {/* Specs / Details */}
                <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-800 text-xs text-slate-400 mb-4">
                  <div>
                    <span className="block text-[11px] text-slate-500">البروتوكول:</span>
                    <span className="font-semibold text-slate-200">{server.connectionType}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-slate-500">منفذ API:</span>
                    <span className="font-mono text-slate-200">{server.apiPort || 8728}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-slate-500">المستخدم:</span>
                    <span className="font-mono text-slate-200">{server.username}</span>
                  </div>
                </div>

                {server.boardModel && (
                  <div className="mb-3 text-xs flex items-center justify-between text-slate-400 bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-800/80 font-mono">
                    <span>طراز البوردة:</span>
                    <span className="text-white font-medium">{server.boardModel}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectServer(server)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  {isSelected ? 'السيرفر النشط حالياً' : 'تحديد والتبديل'}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setSelectedServerId(server.id);
                      setHost(server.host);
                      setUsername(server.username);
                      setApiPort(server.apiPort.toString());
                      setConnectionType(server.connectionType);
                      handleLiveProbe();
                    }}
                    title="فحص الاتصال الحقيقي"
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>فحص</span>
                  </button>

                  {isConnected ? (
                    <button
                      onClick={() => handleToggleState(server, 'DISCONNECTED')}
                      title="إيقاف الاتصال"
                      className="p-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 transition-colors cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleState(server, 'CONNECTED')}
                      title="تشغيل الاتصال"
                      className="p-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor & Configuration Form */}
      {(isEditing || servers.length === 0) && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md mt-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ServerIcon className="w-5 h-5 text-indigo-400" />
                <span>{selectedServerId ? 'تعديل بيانات وربط السيرفر' : 'إعداد سيرفر MikroTik جديد'}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                يتم التحقق من بيانات الدخول والمصادقة الفعلية مع جهاز MikroTik RouterOS وتخزين البيانات بتشفير AES-256
              </p>
            </div>
            {servers.length > 0 && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 cursor-pointer"
              >
                إلغاء
              </button>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  اسم السيرفر المميز *
                </label>
                <input
                  type="text"
                  required
                  value={name ?? ''}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="سيرفر البرج الرئيسي - RB4011"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  عنوان IP أو كود الكلاود (MikroTik Cloud DDNS) *
                </label>
                <input
                  type="text"
                  required
                  value={host ?? ''}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="مثال: 123456789abc.sn.mynetname.net أو 192.168.88.1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 outline-none font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  يدعم عناوين MikroTik Cloud DDNS الرسمية (*.sn.mynetname.net) أو الـ IP الثابت أو المحلي.
                </p>
              </div>
            </div>

            {/* RouterOS Version Selection Cards */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  إصدار نظام MikroTik RouterOS *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setOsVersion('v6');
                      setConnectionType('ROUTEROS_V6');
                      setApiPort('8728');
                    }}
                    className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
                      osVersion === 'v6'
                        ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500 text-white'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">RouterOS v6</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                        إصدارك ⭐️
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      بروتوكول Native API الثنائي المباشر (منفذ 8728) ومصادقة Challenge-Response
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOsVersion('v7');
                      if (connectionType === 'ROUTEROS_V6') setConnectionType('AUTO');
                    }}
                    className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
                      osVersion === 'v7'
                        ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500 text-white'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">RouterOS v7</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                        REST / API
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      يدعم REST API (منفذ 443 HTTPS) ومنافذ الـ API لإصدار RouterOS 7
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOsVersion('auto');
                      setConnectionType('AUTO');
                    }}
                    className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
                      osVersion === 'auto'
                        ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500 text-white'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">كشف تلقائي</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                        Auto
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      يقوم بفحص المنافذ والإصدار وتحديد البروتوكول الأنسب آلياً
                    </p>
                  </button>
                </div>
              </div>

              {osVersion === 'v6' && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>
                    <strong>تم تفعيل وضع RouterOS v6:</strong> يتم الاتصال مباشرة عبر منفذ API (8728) وتخطي REST غير المتوافق مع v6، مع مصادقة MD5 Challenge-Response لدعم النسخ الأقدم من 6.43 وتحديثات v6 الحديثة.
                  </span>
                </div>
              )}
            </div>

            {/* Protocol & Ports */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  بروتوكول الاتصال
                </label>
                <select
                  value={connectionType ?? 'ROUTEROS_V6'}
                  onChange={(e) => setConnectionType(e.target.value as ConnectionType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:border-indigo-500 outline-none cursor-pointer"
                >
                  <option value="ROUTEROS_V6">RouterOS v6 Native API (منفذ 8728 - موصى به لنسختك)</option>
                  <option value="AUTO">كشف تلقائي ذكي عبر الكلاود</option>
                  <option value="API">RouterOS API الأصلي (المنفذ 8728)</option>
                  <option value="API_SSL">RouterOS API-SSL المشفر (المنفذ 8729)</option>
                  <option value="REST_SSL">RouterOS v7 REST API (HTTPS - منفذ 443)</option>
                  <option value="REST">RouterOS v7 REST API (HTTP - منفذ 80)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  منفذ MikroTik API
                </label>
                <input
                  type="number"
                  value={apiPort ?? '8728'}
                  onChange={(e) => setApiPort(e.target.value)}
                  placeholder="8728"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  منفذ API-SSL (مشفر)
                </label>
                <input
                  type="number"
                  value={apiSslPort ?? '8729'}
                  onChange={(e) => setApiSslPort(e.target.value)}
                  placeholder="8729"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  منفذ SSH (اختياري)
                </label>
                <input
                  type="number"
                  value={sshPort ?? '22'}
                  onChange={(e) => setSshPort(e.target.value)}
                  placeholder="22"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 outline-none font-mono"
                />
              </div>
            </div>

            {/* Credentials */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  اسم مستخدم RouterOS *
                </label>
                <input
                  type="text"
                  required
                  value={username ?? 'admin'}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 outline-none font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-200">
                    كلمة مرور راوتر الميكروتك {selectedServerId && '(اتركها فارغة إذا لم ترغب في التغيير)'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 font-medium cursor-pointer transition-colors bg-slate-900 px-2 py-0.5 rounded border border-slate-800"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                        <span>حجب كلمة المرور</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        <span>إظهار كلمة المرور</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password ?? ''}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={showPassword ? 'اكتب كلمة مرور الراوتر هنا' : '••••••••••••'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-10 pl-11 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'حجب كلمة المرور' : 'إظهار كلمة المرور'}
                    className="absolute left-3 top-2.5 p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-400 hover:text-emerald-400" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] mt-1 flex items-center gap-1 text-slate-400">
                  {showPassword ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      كلمة المرور ظاهرة ومرئية بوضوح (غير محجوبة) للتحقق من دقتها.
                    </span>
                  ) : (
                    <span>كلمة المرور محجوبة برموز نقطية. انقر على الأيقونة لإظهارها.</span>
                  )}
                </p>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleLiveProbe}
                disabled={testing || !host || !username}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 text-xs font-bold flex items-center gap-2 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'جارِ فحص الاتصال الحقيقي...' : 'اختبار الاتصال الفعلي (Live Probe)'}</span>
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'جارِ الحفظ...' : 'حفظ إعدادات السيرفر'}
              </button>
            </div>

            {/* Test Connection Output Diagnostic Console */}
            {testResult && (
              <div
                className={`p-5 rounded-xl text-xs border ${
                  testResult.success
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                    : 'bg-red-950/30 border-red-500/40 text-red-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {testResult.success ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span>نجح الاتصال الحقيقي بالسيرفر!</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                        <span>فشل الاتصال بالسيرفر:</span>
                      </>
                    )}
                  </div>

                  {testResult.latencyMs !== undefined && (
                    <span className="font-mono text-xs px-2.5 py-1 rounded bg-black/40 border border-white/10">
                      زمن الاستجابة: {testResult.latencyMs}ms
                    </span>
                  )}
                </div>

                <p className="text-slate-200 mb-3 font-medium">{testResult.message}</p>

                {/* Router Specs extracted */}
                {testResult.success && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/30 p-3 rounded-lg border border-white/10 mb-3 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">البروتوكول:</span>
                      <span className="text-emerald-300 font-bold">{testResult.protocol || 'RouterOS'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">طراز البوردة:</span>
                      <span className="text-white font-bold">{testResult.boardName || 'RouterBoard'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">إصدار النظام:</span>
                      <span className="text-white font-bold">{testResult.version || 'RouterOS v7'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">كود الكلاود:</span>
                      <span className="text-indigo-300 truncate block">{testResult.cloudDdns || host}</span>
                    </div>
                  </div>
                )}

                {/* Step-by-step diagnostic log */}
                {testResult.steps && testResult.steps.length > 0 && (
                  <div className="space-y-1.5 mt-2 bg-black/40 p-3 rounded-lg border border-white/10 font-mono text-[11px]">
                    <div className="text-slate-400 font-bold mb-1">خطوات الفحص التشخيصي:</div>
                    {testResult.steps.map((s, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            s.status === 'SUCCESS'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : s.status === 'FAILED'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {s.status}
                        </span>
                        <span className="text-slate-300">{s.name}:</span>
                        <span className="text-slate-400">{s.detail}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Troubleshooting help */}
                {testResult.troubleshooting && testResult.troubleshooting.length > 0 && (
                  <div className="mt-3 bg-red-950/40 p-3 rounded-lg border border-red-500/20 text-[11px] text-red-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-red-300 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>إرشادات حل مشكلة الاتصال:</span>
                    </div>
                    {testResult.troubleshooting.map((tip, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="text-red-400">•</span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
};
