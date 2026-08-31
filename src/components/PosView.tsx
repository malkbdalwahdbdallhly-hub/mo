import React, { useState } from 'react';
import { POS, Server } from '../types';
import { api } from '../api';
import { Store, Plus, Phone, User, Trash2, Edit2, CheckCircle, AlertTriangle } from 'lucide-react';

interface PosViewProps {
  server: Server;
  posList: POS[];
  onRefreshPos: () => void;
}

export const PosView: React.FC<PosViewProps> = ({
  server,
  posList,
  onRefreshPos,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingPosId, setEditingPosId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [prefix, setPrefix] = useState('');

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const openCreate = () => {
    setEditingPosId(null);
    setName('');
    setManagerName('');
    setPhone('');
    const count = posList.length + 1;
    setPrefix(`POS${count.toString().padStart(3, '0')}`);
    setShowModal(true);
    setErr(null);
  };

  const openEdit = (pos: POS) => {
    setEditingPosId(pos.id);
    setName(pos.name);
    setManagerName(pos.managerName);
    setPhone(pos.phone || '');
    setPrefix(pos.prefix);
    setShowModal(true);
    setErr(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    try {
      if (editingPosId) {
        // Edit
        await api.createPos(server.id, { name, managerName, phone, prefix });
        setMsg('تم تعديل نقطة البيع بنجاح.');
      } else {
        // Create
        await api.createPos(server.id, { name, managerName, phone, prefix });
        setMsg('تمت إضافة نقطة البيع بنجاح.');
      }
      setShowModal(false);
      onRefreshPos();
    } catch (e: any) {
      setErr(e.message || 'فشل حفظ نقطة البيع.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (posId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف نقطة البيع هذه؟')) return;
    try {
      await api.deletePos(server.id, posId);
      onRefreshPos();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Store className="w-4 h-4 text-indigo-400" />
            نقاط البيع والموزعين (Points of Sale)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            إدارة منافذ توزيع الكروت، متابعة المبيعات، ومراقبة المخزون المتبقي لكل وكيل
          </p>
        </div>

        <button
          onClick={openCreate}
          className="px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-sm shadow-indigo-600/30 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          إضافة نقطة بيع جديدة
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {posList.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 text-xs bg-slate-800/40 border border-slate-800 rounded-xl">
            لا توجد نقاط بيع مسجلة حتى الآن. أضف أول نقطة بيع لتوزيع الكروت.
          </div>
        ) : (
          posList.map((pos) => (
            <div
              key={pos.id}
              className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{pos.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 font-mono border border-indigo-800/80">
                      {pos.prefix}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <User className="w-3 h-3 text-slate-500" />
                    <span>{pos.managerName}</span>
                  </div>
                  {pos.phone && (
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-500" />
                      <span className="font-mono">{pos.phone}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(pos)}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(pos.id)}
                    className="p-1.5 rounded bg-slate-800 hover:bg-red-900/60 text-slate-400 hover:text-red-300 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-800 text-[11px]">
                <div>
                  <span className="text-slate-500 block">المتبقي:</span>
                  <span className="font-bold text-indigo-400 font-mono text-sm">{pos.cardsRemaining} كرت</span>
                </div>
                <div>
                  <span className="text-slate-500 block">المباع:</span>
                  <span className="font-bold text-emerald-400 font-mono text-sm">{pos.cardsSold} كرت</span>
                </div>
                <div>
                  <span className="text-slate-500 block">المبيعات:</span>
                  <span className="font-bold text-white font-mono text-sm">{pos.totalSales} ر.س</span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                <span>الحالة:</span>
                <span className="text-emerald-400 font-medium">نشط ومفعل</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* POS Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-bold text-white mb-4">
              {editingPosId ? 'تعديل نقطة البيع' : 'إضافة نقطة بيع جديدة'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  اسم نقطة البيع / المحل *
                </label>
                <input
                  type="text"
                  required
                  value={name ?? ''}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="بقالة النور - الفرع 1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  اسم المسؤول / الوكيل *
                </label>
                <input
                  type="text"
                  required
                  value={managerName ?? ''}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="أحمد علي"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  رقم الهاتف للتواصل
                </label>
                <input
                  type="tel"
                  value={phone ?? ''}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0501234567"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:border-cyan-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  بادئة كروت النقطة (Prefix) *
                </label>
                <input
                  type="text"
                  required
                  value={prefix ?? ''}
                  onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                  placeholder="POS001"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:border-cyan-500 outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg transition-all disabled:opacity-50"
                >
                  {saving ? 'جارِ الحفظ...' : 'حفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
