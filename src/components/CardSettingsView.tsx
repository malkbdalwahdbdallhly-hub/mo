import React, { useState, useEffect } from 'react';
import { CardSettings, CardProfile, PasswordMode, Server } from '../types';
import { api } from '../api';
import { Sliders, Save, CheckCircle, AlertTriangle } from 'lucide-react';

interface CardSettingsViewProps {
  server: Server;
  settings: CardSettings | null;
  profiles: CardProfile[];
  onRefreshSettings: () => void;
}

export const CardSettingsView: React.FC<CardSettingsViewProps> = ({
  server,
  settings,
  profiles,
  onRefreshSettings,
}) => {
  const [cardPrefix, setCardPrefix] = useState(settings?.cardPrefix || 'MK');
  const [usernameLength, setUsernameLength] = useState(settings?.usernameLength || 6);
  const [startingNumber, setStartingNumber] = useState(settings?.startingNumber || 1001);
  const [passwordMode, setPasswordMode] = useState<PasswordMode>(settings?.passwordMode || 'RANDOM');
  const [defaultProfile, setDefaultProfile] = useState(settings?.defaultProfile || '1d-Daily');
  const [defaultPrice, setDefaultPrice] = useState(settings?.defaultPrice || 5.0);
  const [defaultDuration, setDefaultDuration] = useState(settings?.defaultDuration || '1d');
  const [cardTemplate, setCardTemplate] = useState<'default' | 'clean' | 'voucher' | 'modern'>(
    settings?.cardTemplate || 'modern'
  );
  const [cardsPerPage, setCardsPerPage] = useState(settings?.cardsPerPage || 24);
  const [showPassword, setShowPassword] = useState(settings?.showPassword ?? true);
  const [showQrCode, setShowQrCode] = useState(settings?.showQrCode ?? true);
  const [networkName, setNetworkName] = useState(settings?.networkName || 'شبكة مكين الذكية | Makeen WiFi');

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setCardPrefix(settings.cardPrefix ?? 'MK');
      setUsernameLength(settings.usernameLength ?? 6);
      setStartingNumber(settings.startingNumber ?? 1001);
      setPasswordMode(settings.passwordMode ?? 'RANDOM');
      setDefaultProfile(settings.defaultProfile ?? '1d-Daily');
      setDefaultPrice(settings.defaultPrice ?? 5.0);
      setDefaultDuration(settings.defaultDuration ?? '1d');
      setCardTemplate(settings.cardTemplate ?? 'modern');
      setCardsPerPage(settings.cardsPerPage ?? 24);
      setShowPassword(settings.showPassword ?? true);
      setShowQrCode(settings.showQrCode ?? true);
      setNetworkName(settings.networkName ?? 'شبكة مكين الذكية | Makeen WiFi');
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setErr(null);

    try {
      await api.updateCardSettings(server.id, {
        cardPrefix,
        usernameLength,
        startingNumber,
        passwordMode,
        defaultProfile,
        defaultPrice,
        defaultDuration,
        cardTemplate,
        cardsPerPage,
        showPassword,
        showQrCode,
        networkName,
      });
      setMsg('تم حفظ إعدادات الكروت الافتراضية بنجاح.');
      onRefreshSettings();
    } catch (e: any) {
      setErr(e.message || 'فشل حفظ الإعدادات.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-400" />
          إعدادات الكروت الافتراضية والقوالب
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          تحديد الهوية الافتراضية لتوليد كروت User Manager، أسعار البيع، وأنماط التشفير والطباعة.
        </p>
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

      <form onSubmit={handleSave} className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        {/* Section 1: Naming & Numbering */}
        <div>
          <h3 className="text-xs font-bold text-slate-200 mb-3 pb-1.5 border-b border-slate-800">
            1. تسمية وترقيم الكروت
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                بادئة الكروت الافتراضية (Prefix)
              </label>
              <input
                type="text"
                required
                value={cardPrefix ?? ''}
                onChange={(e) => setCardPrefix(e.target.value.toUpperCase())}
                placeholder="MK"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                الرقم الأولي التسلسلي (Starting Number)
              </label>
              <input
                type="number"
                required
                value={startingNumber ?? ''}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setStartingNumber(Number.isNaN(v) ? 0 : v);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                طول اسم المستخدم (بالخانات)
              </label>
              <input
                type="number"
                min={4}
                max={16}
                value={usernameLength ?? ''}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setUsernameLength(Number.isNaN(v) ? 6 : v);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Password Mode */}
        <div>
          <h3 className="text-xs font-bold text-slate-200 mb-3 pb-1.5 border-b border-slate-800">
            2. نمط كلمات المرور
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                النمط الافتراضي لكلمة المرور
              </label>
              <select
                value={passwordMode ?? 'RANDOM'}
                onChange={(e) => setPasswordMode(e.target.value as PasswordMode)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 outline-none cursor-pointer"
              >
                <option value="RANDOM">أرقام عشوائية 4 خانات (موصى به لسهولة المشترك)</option>
                <option value="SAME_AS_USERNAME">مطابقة لاسم المستخدم تماماً</option>
                <option value="CUSTOM">كلمة مرور مخصصة موحدة للدفعة</option>
                <option value="EMPTY">بدون كلمة مرور (اسم مستخدم فقط)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                الباقة الافتراضية
              </label>
              <select
                value={defaultProfile ?? ''}
                onChange={(e) => setDefaultProfile(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 outline-none cursor-pointer"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} ({p.validity} - {p.price} ر.س)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Pricing & Network Branding */}
        <div>
          <h3 className="text-xs font-bold text-slate-200 mb-3 pb-1.5 border-b border-slate-800">
            3. التسعير وهوية الشبكة المطبوعة
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                السعر الافتراضي (ر.س)
              </label>
              <input
                type="number"
                step="0.5"
                value={defaultPrice ?? ''}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setDefaultPrice(Number.isNaN(v) ? 0 : v);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 outline-none font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                اسم الشبكة الظاهر على الكروت المطبوعة
              </label>
              <input
                type="text"
                value={networkName ?? ''}
                onChange={(e) => setNetworkName(e.target.value)}
                placeholder="شبكة مكين الذكية | Makeen WiFi"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Print Layout Defaults */}
        <div>
          <h3 className="text-xs font-bold text-slate-200 mb-3 pb-1.5 border-b border-slate-800">
            4. خيارات الطباعة وورق A4
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                القالب الافتراضي
              </label>
              <select
                value={cardTemplate ?? 'modern'}
                onChange={(e) => setCardTemplate(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 outline-none cursor-pointer"
              >
                <option value="modern">العصري (Modern Pro)</option>
                <option value="voucher">قسيمة مبيعات (Voucher)</option>
                <option value="clean">نظيف وبسيط (Clean)</option>
                <option value="minimal">اقتصادي للحبر (Minimal Eco)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                كروت بالصفحة (1 - 120)
              </label>
              <input
                type="number"
                min={1}
                max={120}
                value={cardsPerPage ?? ''}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setCardsPerPage(Number.isNaN(v) ? 24 : v);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 outline-none font-mono"
              />
            </div>

            <div className="flex items-center gap-5 pt-4">
              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-indigo-500"
                />
                <span>إظهار كلمة المرور</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showQrCode}
                  onChange={(e) => setShowQrCode(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-indigo-500"
                />
                <span>رمز QR التلقائي</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'جارِ الحفظ...' : 'حفظ الإعدادات الافتراضية'}
          </button>
        </div>
      </form>
    </div>
  );
};
