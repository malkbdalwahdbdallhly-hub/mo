import React, { useState, useEffect } from 'react';
import { Card, CardProfile, POS, PasswordMode, Server } from '../types';
import { api } from '../api';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Printer,
  CheckCircle,
  AlertTriangle,
  FileText,
  Sliders,
  Trash2,
  CheckSquare,
  Square,
  Hash,
  Sparkles,
  X,
  Layers,
} from 'lucide-react';
import { InteractiveCardPrintModal } from './InteractiveCardPrintModal';

interface CardsViewProps {
  server: Server;
  cards: Card[];
  profiles: CardProfile[];
  posList: POS[];
  onRefreshCards: () => void;
  onOpenPrint: (cardsToPrint: Card[]) => void;
  onInspectCard: (cardUsername: string) => void;
}

export const CardsView: React.FC<CardsViewProps> = ({
  server,
  cards,
  profiles,
  posList,
  onRefreshCards,
  onOpenPrint,
  onInspectCard,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [posFilter, setPosFilter] = useState('ALL');

  // Generator Modal State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(profiles[0]?.name || '1d-Daily');
  const [quantity, setQuantity] = useState(50);
  const [digitsCount, setDigitsCount] = useState<number>(6); // New field: كم يجب ان يكون عدد ارقام الكرت
  const [prefix, setPrefix] = useState('MK');
  const [startingNumber, setStartingNumber] = useState(100001);
  const [passwordMode, setPasswordMode] = useState<PasswordMode>('RANDOM');
  const [customPassword, setCustomPassword] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [genMessage, setGenMessage] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    if (profiles.length > 0 && (!selectedProfile || !profiles.some(p => p.name === selectedProfile))) {
      setSelectedProfile(profiles[0].name);
    }
  }, [profiles, selectedProfile]);

  // Latest Generated Batch State (for unified generation & printing/deleting workflow)
  const [latestBatchCards, setLatestBatchCards] = useState<Card[] | null>(null);
  const [latestBatchMeta, setLatestBatchMeta] = useState<{
    count: number;
    profile: string;
    time: string;
    batchId?: string;
  } | null>(null);
  const [selectedBatchUsernames, setSelectedBatchUsernames] = useState<Set<string>>(new Set());
  const [deletingBatch, setDeletingBatch] = useState(false);

  // Interactive Print Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [cardsForPrint, setCardsForPrint] = useState<Card[]>([]);

  // Filtered Cards
  const filteredCards = cards.filter((c) => {
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesPos = posFilter === 'ALL' || c.posId === posFilter;
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.username.toLowerCase().includes(q) ||
      (c.password && c.password.toLowerCase().includes(q)) ||
      (c.posName && c.posName.toLowerCase().includes(q));
    return matchesStatus && matchesPos && matchesSearch;
  });

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setProgress(15);
    setGenError(null);
    setGenMessage(null);

    try {
      setProgress(45);
      const res = await api.generateCards(server.id, {
        profileName: selectedProfile,
        quantity,
        digitsCount,
        prefix,
        startingNumber,
        passwordMode,
        customPassword: passwordMode === 'CUSTOM' ? customPassword : undefined,
      });

      setProgress(100);
      const createdCards = res.cards && res.cards.length > 0 ? res.cards : [];
      setLatestBatchCards(createdCards);
      // Select all by default as requested:
      setSelectedBatchUsernames(new Set(createdCards.map((c: Card) => c.username)));
      setLatestBatchMeta({
        count: res.created || createdCards.length,
        profile: selectedProfile,
        time: new Date().toLocaleTimeString('ar-SA'),
        batchId: res.batchId,
      });

      setGenMessage(`تم توليد وإضافة ${res.created} كرت بنجاح في User Manager!`);
      setTimeout(() => {
        setShowGenerateModal(false);
        setGenMessage(null);
        setProgress(0);
        onRefreshCards();
      }, 1000);
    } catch (err: any) {
      setGenError(err.message || 'فشل توليد الكروت.');
    } finally {
      setGenerating(false);
    }
  };

  // Toggle select all newly added cards
  const handleToggleSelectAllBatch = () => {
    if (!latestBatchCards) return;
    if (selectedBatchUsernames.size === latestBatchCards.length) {
      setSelectedBatchUsernames(new Set());
    } else {
      setSelectedBatchUsernames(new Set(latestBatchCards.map((c) => c.username)));
    }
  };

  // Toggle single card in batch
  const handleToggleCardSelection = (username: string) => {
    setSelectedBatchUsernames((prev) => {
      const next = new Set(prev);
      if (next.has(username)) {
        next.delete(username);
      } else {
        next.add(username);
      }
      return next;
    });
  };

  // Delete selected batch cards
  const handleDeleteSelectedBatch = async () => {
    if (selectedBatchUsernames.size === 0) {
      alert('يرجى تحديد الكروت المراد حذفها.');
      return;
    }

    const count = selectedBatchUsernames.size;
    if (!window.confirm(`هل أنت متأكد من حذف ${count} كرت من سيرفر المايكروتك وقاعدة البيانات نهائياً؟`)) {
      return;
    }

    setDeletingBatch(true);
    try {
      await api.deleteCardsBatch(server.id, Array.from(selectedBatchUsernames));
      // Remove deleted cards from latest batch
      setLatestBatchCards((prev) => {
        if (!prev) return null;
        const remaining = prev.filter((c) => !selectedBatchUsernames.has(c.username));
        return remaining.length > 0 ? remaining : null;
      });
      setSelectedBatchUsernames(new Set());
      onRefreshCards();
      alert(`تم حذف ${count} كرت بنجاح من User Manager.`);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حذف الكروت.');
    } finally {
      setDeletingBatch(false);
    }
  };

  // Print selected batch cards
  const handlePrintSelectedBatch = () => {
    if (!latestBatchCards) return;
    const selectedCards = latestBatchCards.filter((c) => selectedBatchUsernames.has(c.username));
    if (selectedCards.length === 0) {
      alert('يرجى تحديد كرت واحد على الأقل للطباعة.');
      return;
    }
    setCardsForPrint(selectedCards);
    setShowPrintModal(true);
  };

  const getStatusBadge = (status: Card['status']) => {
    switch (status) {
      case 'AVAILABLE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            متاح للبيع
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            نشط متصل
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-500/10 text-slate-400 border border-slate-700">
            منتهي الصلاحية
          </span>
        );
      case 'USED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            مستخدم
          </span>
        );
      case 'DISABLED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            معطّل
          </span>
        );
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">غير معروف</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Latest Generated Batch Section (Integrated Generation & Print/Delete Workflow) */}
      {latestBatchCards && latestBatchCards.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-2 border-indigo-500/40 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Sparkles className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  الدفعة المضافة حديثاً في User Manager
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    تمت الإضافة بنجاح ({latestBatchCards.length} كرت)
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  باقة: {latestBatchMeta?.profile || 'الافتراضية'} • وقت الإضافة: {latestBatchMeta?.time}
                </p>
              </div>
            </div>

            <button
              onClick={() => setLatestBatchCards(null)}
              className="self-end sm:self-center text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="إخفاء نافذة الدفعة الأخيرة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action Row: Select All + Delete + Print */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800/90">
            {/* Select All Checkbox */}
            <button
              type="button"
              onClick={handleToggleSelectAllBatch}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-700/80 transition-colors cursor-pointer select-none"
            >
              {selectedBatchUsernames.size === latestBatchCards.length ? (
                <CheckSquare className="w-4 h-4 text-cyan-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              <span>تحديد جميع الكروت المضافة ({selectedBatchUsernames.size} من {latestBatchCards.length})</span>
            </button>

            {/* The Two Main Action Options: Delete & Print */}
            <div className="flex items-center gap-2.5">
              {/* 1. Delete Option */}
              <button
                type="button"
                onClick={handleDeleteSelectedBatch}
                disabled={selectedBatchUsernames.size === 0 || deletingBatch}
                className="px-3.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-rose-100 font-semibold text-xs flex items-center gap-1.5 border border-rose-800/60 transition-all disabled:opacity-40 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                {deletingBatch ? 'جارِ الحذف...' : `حذف الكروت المحددة (${selectedBatchUsernames.size})`}
              </button>

              {/* 2. Print Option */}
              <button
                type="button"
                onClick={handlePrintSelectedBatch}
                disabled={selectedBatchUsernames.size === 0}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-40 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                طباعة الكروت المحددة ({selectedBatchUsernames.size})
              </button>
            </div>
          </div>

          {/* Cards Chips List in the batch */}
          <div className="max-h-48 overflow-y-auto p-2 bg-slate-950/50 rounded-xl border border-slate-800/60 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {latestBatchCards.map((card) => {
              const isSelected = selectedBatchUsernames.has(card.username);
              return (
                <div
                  key={card.id}
                  onClick={() => handleToggleCardSelection(card.username)}
                  className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-1.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-950/60 border-indigo-500/60 text-white shadow-sm'
                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="truncate">
                    <span className="font-mono font-bold block truncate text-[11px] text-white">
                      {card.username}
                    </span>
                    {card.password && (
                      <span className="font-mono text-[10px] text-indigo-300 block truncate">
                        P: {card.password}
                      </span>
                    )}
                  </div>
                  <div>
                    {isSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Bar with actions */}
      <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-400" />
            إدارة وتوليد كروت المشتركين ({cards.length})
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            توليد كروت User Manager، مطابقة الدفعات، التخصيص لنقاط البيع، والطباعة
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setCardsForPrint(filteredCards);
              setShowPrintModal(true);
            }}
            disabled={filteredCards.length === 0}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs flex items-center gap-2 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-400" />
            طباعة وتصميم القالب ({filteredCards.length})
          </button>

          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-sm shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            توليد دفعة كروت جديدة
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-800/40 border border-slate-800 p-3 rounded-xl flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute right-3 top-2.5 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={search ?? ''}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم المستخدم أو كلمة المرور..."
            className="w-full bg-slate-900 border border-slate-800 rounded pr-9 pl-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter ?? 'ALL'}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 outline-none cursor-pointer"
          >
            <option value="ALL">جميع الحالات</option>
            <option value="AVAILABLE">متاح للبيع</option>
            <option value="ACTIVE">نشط متصل</option>
            <option value="USED">مستخدم</option>
            <option value="EXPIRED">منتهي الصلاحية</option>
            <option value="DISABLED">معطّل</option>
          </select>

          {/* POS Filter */}
          <select
            value={posFilter ?? 'ALL'}
            onChange={(e) => setPosFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 outline-none cursor-pointer"
          >
            <option value="ALL">جميع نقاط البيع</option>
            {posList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.prefix})
              </option>
            ))}
          </select>

          <button
            onClick={onRefreshCards}
            title="تحديث البيانات"
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Cards Table */}
      <div className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right rtl:text-right">
            <thead className="bg-slate-900/50 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-medium">
              <tr>
                <th className="py-2.5 px-4">اسم المستخدم</th>
                <th className="py-2.5 px-4">كلمة المرور</th>
                <th className="py-2.5 px-4">الباقة (Profile)</th>
                <th className="py-2.5 px-4">السعر</th>
                <th className="py-2.5 px-4">الحالة</th>
                <th className="py-2.5 px-4">نقطة البيع</th>
                <th className="py-2.5 px-4">تاريخ الإنشاء</th>
                <th className="py-2.5 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredCards.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    لا توجد كروت مطابقة للفلاتر الحالية.
                  </td>
                </tr>
              ) : (
                filteredCards.slice(0, 100).map((card) => (
                  <tr key={card.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-bold text-white">{card.username}</td>
                    <td className="py-2.5 px-4 font-mono text-indigo-300">
                      {card.password || <span className="text-slate-500">بدون</span>}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-200">{card.profile}</td>
                    <td className="py-2.5 px-4 text-emerald-400 font-medium font-mono">{card.price} ر.س</td>
                    <td className="py-2.5 px-4">{getStatusBadge(card.status)}</td>
                    <td className="py-2.5 px-4 text-slate-300">
                      {card.posName || <span className="text-slate-500">غير مخصص</span>}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(card.creationDate).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => onInspectCard(card.username)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[10px] transition-colors cursor-pointer"
                      >
                        فحص الكرت
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batch Generator Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                توليد دفعة كروت جديدة (User Manager Batch)
              </h3>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 bg-slate-800 rounded-lg"
              >
                إغلاق
              </button>
            </div>

            {genError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>{genError}</span>
              </div>
            )}

            {genMessage && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>{genMessage}</span>
              </div>
            )}

            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    الباقة (User Manager Profile) *
                  </label>
                  <select
                    value={selectedProfile ?? ''}
                    onChange={(e) => setSelectedProfile(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:border-cyan-500 outline-none"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name} — {p.validity} ({p.price} ر.س)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    العدد المطلوب (1 - 5000) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={quantity ?? 50}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setQuantity(Number.isNaN(val) ? 1 : val);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:border-cyan-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* NEW FIELD: كم يجب ان يكون عدد ارقام الكرت */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-cyan-400" />
                      كم يجب أن يكون عدد أرقام الكرت *
                    </span>
                    <span className="text-[10px] text-cyan-400 font-mono font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                      {digitsCount} خانات
                    </span>
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={16}
                    required
                    value={digitsCount ?? 6}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      const safeVal = Number.isNaN(val) ? 6 : val;
                      setDigitsCount(safeVal);
                      if (safeVal >= 3) {
                        setStartingNumber(Math.pow(10, safeVal - 1) + 1);
                      }
                    }}
                    placeholder="6"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:border-cyan-500 outline-none font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    مثال: تحديد 6 يولد كروت برقم مكون من 6 خانات (مثل: 100001 أو 591240)
                  </p>
                </div>

                {/* Starting Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    الرقم الأولي للترقيم (Starting Number)
                  </label>
                  <input
                    type="number"
                    value={startingNumber ?? 100001}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setStartingNumber(Number.isNaN(val) ? 100001 : val);
                    }}
                    placeholder="100001"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:border-cyan-500 outline-none font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    سيبدأ الترقيم التسلسلي من هذا الرقم
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    بادئة اسم المستخدم (Prefix) - اختياري
                  </label>
                  <input
                    type="text"
                    value={prefix ?? ''}
                    onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                    placeholder="مثال: MK أو تركها فارغة لكروت رقمية بحتة"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:border-cyan-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    نمط كلمة المرور (Password Mode)
                  </label>
                  <select
                    value={passwordMode ?? 'RANDOM'}
                    onChange={(e) => setPasswordMode(e.target.value as PasswordMode)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:border-cyan-500 outline-none"
                  >
                    <option value="RANDOM">أرقام عشوائية بنفس طول الخانات</option>
                    <option value="SAME_AS_USERNAME">نفس اسم المستخدم (User = Pass)</option>
                    <option value="CUSTOM">كلمة مرور مخصصة موحدة للجميع</option>
                    <option value="EMPTY">بدون كلمة مرور (اسم فقط)</option>
                  </select>
                </div>
              </div>

              {passwordMode === 'CUSTOM' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    كلمة المرور الموحدة
                  </label>
                  <input
                    type="text"
                    required
                    value={customPassword ?? ''}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="wifi2025"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:border-cyan-500 outline-none font-mono"
                  />
                </div>
              )}

              {/* Progress bar if running */}
              {generating && (
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-4">
                  <div
                    className="bg-cyan-500 h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {generating ? 'جارِ التوليد في User Manager...' : `تأكيد توليد ${quantity} كرت`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Card Print & Template Designer Modal */}
      <InteractiveCardPrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        cards={cardsForPrint}
        batchTitle={latestBatchMeta ? `دفعة ${latestBatchMeta.profile} (${cardsForPrint.length} كرت)` : undefined}
      />
    </div>
  );
};
