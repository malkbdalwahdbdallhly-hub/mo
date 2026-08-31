import React, { useState, useEffect } from 'react';
import { Server } from '../types';
import { api } from '../api';
import {
  TrendingUp,
  Download,
  Calendar,
  DollarSign,
  CreditCard,
  HardDrive,
  Users,
  Store,
  RefreshCw,
} from 'lucide-react';

interface ReportsViewProps {
  server: Server;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ server }) => {
  const [period, setPeriod] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'>('DAILY');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.getReport(server.id, { type: 'SALES', period });
      setReport(res.report);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [server.id, period]);

  const handleExportCsv = async () => {
    try {
      const token = api.getToken();
      const res = await fetch(`/api/servers/${server.id}/reports/export-csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'SALES', period }),
      });

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `makeen-report-${period}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('CSV export failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            التقارير والمؤشرات المالية للمبيعات
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            ملخص حركة الكروت ومبيعات نقاط البيع واستهلاك البيانات للفترة المحددة
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Period selector */}
          <div className="flex bg-slate-900 p-0.5 rounded border border-slate-800 text-xs">
            {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
                  period === p ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {p === 'DAILY' ? 'اليوم' : p === 'WEEKLY' ? 'أسبوعياً' : 'شهرياً'}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            تصدير CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-xs flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
          <span>جارِ تجميع بيانات التقرير...</span>
        </div>
      ) : report ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3">
              <span className="text-slate-400 text-[10px] block mb-0.5">إجمالي الإيرادات</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">
                {report.summary.totalRevenue} ر.س
              </span>
            </div>

            <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3">
              <span className="text-slate-400 text-[10px] block mb-0.5">إجمالي الكروت</span>
              <span className="text-lg font-bold text-white font-mono">
                {report.summary.totalCards}
              </span>
            </div>

            <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3">
              <span className="text-slate-400 text-[10px] block mb-0.5">الكروت المباعة</span>
              <span className="text-lg font-bold text-indigo-400 font-mono">
                {report.summary.soldCards}
              </span>
            </div>

            <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3">
              <span className="text-slate-400 text-[10px] block mb-0.5">المتاحة بالمخزون</span>
              <span className="text-lg font-bold text-amber-400 font-mono">
                {report.summary.availableCards}
              </span>
            </div>

            <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3">
              <span className="text-slate-400 text-[10px] block mb-0.5">المنتهية</span>
              <span className="text-lg font-bold text-slate-400 font-mono">
                {report.summary.expiredCards}
              </span>
            </div>

            <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3">
              <span className="text-slate-400 text-[10px] block mb-0.5">استهلاك البيانات</span>
              <span className="text-lg font-bold text-violet-400 font-mono">
                {report.summary.totalTrafficMB} MB
              </span>
            </div>
          </div>

          {/* POS Breakdown Table */}
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <Store className="w-3.5 h-3.5 text-indigo-400" />
                أداء نقاط البيع والموزعين خلال الفترة
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right rtl:text-right">
                <thead className="bg-slate-900/50 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-medium">
                  <tr>
                    <th className="py-2.5 px-3">نقطة البيع</th>
                    <th className="py-2.5 px-3">البادئة</th>
                    <th className="py-2.5 px-3">المسؤول</th>
                    <th className="py-2.5 px-3">إجمالي الكروت المخصصة</th>
                    <th className="py-2.5 px-3">الكروت المباعة</th>
                    <th className="py-2.5 px-3">إجمالي المبيعات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {report.posBreakdown.map((p: any) => (
                    <tr key={p.posId} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-white">{p.name}</td>
                      <td className="py-2.5 px-3 font-mono text-indigo-300">{p.prefix}</td>
                      <td className="py-2.5 px-3 text-slate-300">{p.manager}</td>
                      <td className="py-2.5 px-3 font-mono">{p.cardsCount} كرت</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-400 font-medium">{p.soldCount} كرت</td>
                      <td className="py-2.5 px-3 font-mono text-white font-bold">{p.revenue} ر.س</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
