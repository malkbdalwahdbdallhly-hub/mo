import React, { useState } from 'react';
import { api } from '../api';
import { User } from '../types';
import { Shield, KeyRound, Mail, User as UserIcon, Lock, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react';

interface AuthModalProps {
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT'>('LOGIN');
  const [email, setEmail] = useState('admin@makeen.io');
  const [password, setPassword] = useState('Makeen@2025');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('مدير النظام');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'LOGIN') {
        const res = await api.login(email, password);
        onSuccess(res.user);
      } else if (mode === 'REGISTER') {
        const res = await api.register(email, name, password);
        onSuccess(res.user);
      } else if (mode === 'FORGOT') {
        const res = await api.recoverPassword(email);
        setSuccessMsg(res.message + (res.recoveryCode ? ` الرمز التجريبي: ${res.recoveryCode}` : ''));
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('admin@makeen.io');
    setPassword('Makeen@2025');
    setName('مدير النظام (Admin)');
    setMode('LOGIN');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-5 relative overflow-hidden">
        {/* Logo & Header */}
        <div className="text-center mb-5">
          <div className="w-10 h-10 mx-auto rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm mb-2">
            M
          </div>
          <h2 className="text-lg font-bold text-white">منصة Makeen</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            إدارة MikroTik وUser Manager عبر الويب وبوت Telegram
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 mb-4">
          <button
            type="button"
            onClick={() => { setMode('LOGIN'); setError(null); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer ${
              mode === 'LOGIN' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => { setMode('REGISTER'); setError(null); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer ${
              mode === 'REGISTER' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            إنشاء حساب جديد
          </button>
        </div>

        {error && (
          <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'REGISTER' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">الاسم الكامل</label>
              <div className="relative">
                <UserIcon className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="محمد السعيد"
                  className="w-full bg-slate-950 border border-slate-800 rounded pr-8 pl-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:border-indigo-500 outline-none transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@makeen.io"
                className="w-full bg-slate-950 border border-slate-800 rounded pr-8 pl-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:border-indigo-500 outline-none transition-colors"
              />
            </div>
          </div>

          {mode !== 'FORGOT' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-300">كلمة المرور</label>
                {mode === 'LOGIN' && (
                  <button
                    type="button"
                    onClick={() => setMode('FORGOT')}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
                  >
                    نسيت كلمة المرور؟
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={showPassword ? 'كلمة المرور' : '••••••••'}
                  className="w-full bg-slate-950 border border-slate-800 rounded pr-8 pl-8 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:border-indigo-500 outline-none transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-2 top-2 p-0.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                  title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-3 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm shadow-indigo-600/30 transition-all disabled:opacity-50 mt-1 cursor-pointer"
          >
            {loading ? 'جارِ التحقق والاتصال...' : mode === 'LOGIN' ? 'دخول لوحة التحكم' : mode === 'REGISTER' ? 'إنشاء حساب جديد' : 'إرسال رابط الاستعادة'}
          </button>
        </form>

        {mode === 'FORGOT' && (
          <button
            type="button"
            onClick={() => setMode('LOGIN')}
            className="w-full mt-2.5 flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            العودة لشاشة الدخول
          </button>
        )}

        {/* Demo Fast Fill Button */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">تجربة المنصة مباشرة:</span>
          <button
            type="button"
            onClick={handleFillDemo}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded border border-indigo-500/20 transition-colors cursor-pointer"
          >
            دخول تلقائي كمسؤول ⚡
          </button>
        </div>
      </div>
    </div>
  );
};
