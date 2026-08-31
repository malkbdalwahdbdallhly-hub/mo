import React, { useState, useEffect, useRef } from 'react';
import { Card, CardSettings } from '../types';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { Printer, Download, ArrowRight, Eye, Sliders, Check, Sparkles, Image as ImageIcon } from 'lucide-react';
import { InteractiveCardPrintModal } from './InteractiveCardPrintModal';

interface CardPrintEngineProps {
  cards: Card[];
  settings: CardSettings | null;
  onBack: () => void;
}

export const CardPrintEngine: React.FC<CardPrintEngineProps> = ({
  cards,
  settings,
  onBack,
}) => {
  const [template, setTemplate] = useState<'modern' | 'clean' | 'voucher' | 'minimal'>('modern');
  const [cardsPerPage, setCardsPerPage] = useState<number>(settings?.cardsPerPage || 24);
  const [showPassword, setShowPassword] = useState<boolean>(settings?.showPassword ?? true);
  const [showQr, setShowQr] = useState<boolean>(settings?.showQrCode ?? true);
  const [networkName, setNetworkName] = useState<string>(settings?.networkName || 'شبكة مكين الذكية');
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showInteractiveModal, setShowInteractiveModal] = useState(false);

  const printContainerRef = useRef<HTMLDivElement>(null);

  // Generate QR codes for cards
  useEffect(() => {
    let isMounted = true;
    const generateQrs = async () => {
      const qrs: Record<string, string> = {};
      for (const card of cards.slice(0, 120)) {
        try {
          const qrData = `http://192.168.88.1/login?username=${encodeURIComponent(card.username)}&password=${encodeURIComponent(card.password || '')}`;
          const url = await QRCode.toDataURL(qrData, {
            margin: 1,
            width: 120,
            color: { dark: '#0f172a', light: '#ffffff' },
          });
          if (isMounted) qrs[card.id] = url;
        } catch (e) {
          console.error(e);
        }
      }
      if (isMounted) setQrCodes(qrs);
    };

    generateQrs();
    return () => {
      isMounted = false;
    };
  }, [cards]);

  const handleBrowserPrint = () => {
    window.print();
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Simple, fast vector PDF creation
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;

      // Determine cols and rows based on cardsPerPage
      let cols = 3;
      let rows = 8;
      if (cardsPerPage <= 8) { cols = 2; rows = 4; }
      else if (cardsPerPage <= 12) { cols = 3; rows = 4; }
      else if (cardsPerPage <= 24) { cols = 3; rows = 8; }
      else if (cardsPerPage <= 40) { cols = 4; rows = 10; }
      else { cols = 5; rows = 12; }

      const cardWidth = (pageWidth - margin * 2) / cols;
      const cardHeight = (pageHeight - margin * 2) / rows;

      let cardIdx = 0;
      for (let i = 0; i < cards.length; i++) {
        if (cardIdx > 0 && cardIdx % (cols * rows) === 0) {
          doc.addPage();
        }

        const col = (cardIdx % (cols * rows)) % cols;
        const row = Math.floor((cardIdx % (cols * rows)) / cols);
        const x = margin + col * cardWidth;
        const y = margin + row * cardHeight;

        const card = cards[i];

        // Draw card border
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(x + 1, y + 1, cardWidth - 2, cardHeight - 2, 2, 2, 'S');

        // Draw header
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        doc.text(networkName, x + 3, y + 6);

        // Price & profile
        doc.setFontSize(7);
        doc.setTextColor(16, 185, 129);
        doc.text(`${card.price} SAR - ${card.profile}`, x + 3, y + 10);

        // Username
        doc.setFontSize(9);
        doc.setFont('courier', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`U: ${card.username}`, x + 3, y + 16);

        // Password
        if (showPassword && card.password) {
          doc.setFontSize(8);
          doc.setFont('courier', 'normal');
          doc.text(`P: ${card.password}`, x + 3, y + 21);
        }

        // Draw QR code image if available
        if (showQr && qrCodes[card.id]) {
          try {
            const qrSize = Math.min(cardHeight - 6, cardWidth * 0.35);
            doc.addImage(qrCodes[card.id], 'PNG', x + cardWidth - qrSize - 3, y + 3, qrSize, qrSize);
          } catch (e) {
            // image add fallback
          }
        }

        cardIdx++;
      }

      doc.save(`makeen-cards-${Date.now()}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Header */}
      <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Printer className="w-4 h-4 text-indigo-400" />
              محرك طباعة الكروت وقوالب A4
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              تجهيز الكروت للطباعة الورقية وتوليد باركود QR للاتصال الفوري بدون كتابة يدويّة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInteractiveModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-cyan-600/30 transition-all cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5 text-cyan-200" />
            <span>تصميم قالب مخصص (صورة وسحب البيانات)</span>
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {exportingPdf ? 'جارِ إنشاء ملف PDF...' : 'تحميل PDF'}
          </button>
          <button
            onClick={handleBrowserPrint}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            طباعة الكروت مباشرة
          </button>
        </div>
      </div>

      {/* Settings Toolbar */}
      <div className="bg-slate-800/40 border border-slate-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Template Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">القالب:</span>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 focus:border-indigo-500 outline-none cursor-pointer"
            >
              <option value="modern">العصري (Modern Pro)</option>
              <option value="voucher">قسيمة مبيعات (Voucher)</option>
              <option value="clean">نظيف وبسيط (Clean)</option>
              <option value="minimal">اقتصادي للحبر (Minimal Eco)</option>
            </select>
          </div>

          {/* Cards per page */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">كروت بالصفحة:</span>
            <select
              value={cardsPerPage}
              onChange={(e) => setCardsPerPage(parseInt(e.target.value, 10))}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 focus:border-indigo-500 outline-none cursor-pointer"
            >
              <option value="8">8 كروت (حجم كبير)</option>
              <option value="12">12 كرت</option>
              <option value="18">18 كرت</option>
              <option value="24">24 كرت (المعيار المثالي)</option>
              <option value="36">36 كرت</option>
              <option value="48">48 كرت</option>
              <option value="60">60 كرت</option>
              <option value="120">120 كرت (مكثف ومصغر)</option>
            </select>
          </div>

          {/* Toggles */}
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-indigo-500"
            />
            <span>إظهار كلمة المرور</span>
          </label>

          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showQr}
              onChange={(e) => setShowQr(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-indigo-500"
            />
            <span>رمز QR للاتصال الذاتي</span>
          </label>
        </div>

        {/* Network Name Input */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400">اسم الشبكة:</span>
          <input
            type="text"
            value={networkName}
            onChange={(e) => setNetworkName(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 focus:border-indigo-500 outline-none w-44 text-xs"
          />
        </div>
      </div>

      {/* A4 Printable Sheet Container */}
      <div className="flex justify-center p-4 bg-slate-950 rounded-2xl overflow-x-auto">
        <div
          ref={printContainerRef}
          className="bg-white text-slate-900 shadow-2xl p-6 rounded-lg w-[210mm] min-h-[297mm] box-border print:p-0 print:m-0 print:w-full print:shadow-none"
          style={{ direction: 'rtl' }}
        >
          {/* Dynamic Grid */}
          <div
            className="grid gap-2.5"
            style={{
              gridTemplateColumns:
                cardsPerPage <= 8
                  ? 'repeat(2, 1fr)'
                  : cardsPerPage <= 24
                  ? 'repeat(3, 1fr)'
                  : cardsPerPage <= 48
                  ? 'repeat(4, 1fr)'
                  : 'repeat(5, 1fr)',
            }}
          >
            {cards.slice(0, cardsPerPage).map((card) => {
              return (
                <div
                  key={card.id}
                  className={`border rounded-lg p-2.5 flex flex-col justify-between relative overflow-hidden transition-all text-right ${
                    template === 'modern'
                      ? 'border-slate-800 bg-slate-50'
                      : template === 'voucher'
                      ? 'border-emerald-600 border-dashed bg-emerald-50/40'
                      : template === 'minimal'
                      ? 'border-slate-400 bg-white'
                      : 'border-slate-300 bg-white'
                  }`}
                  style={{ minHeight: cardsPerPage <= 24 ? '110px' : '85px' }}
                >
                  {/* Top Bar inside card */}
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-1">
                    <span className="font-extrabold text-[11px] text-slate-800 truncate max-w-[130px]">
                      {networkName}
                    </span>
                    <span className="font-bold text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-mono">
                      {card.price} ر.س
                    </span>
                  </div>

                  {/* Body Content */}
                  <div className="flex items-center justify-between gap-2 my-auto">
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-600 flex items-center gap-1 font-semibold">
                        <span>الباقة:</span>
                        <span className="text-slate-900 font-bold">{card.profile}</span>
                      </div>
                      <div className="text-xs font-mono font-black text-slate-900 tracking-wide">
                        <span className="text-[10px] font-sans font-normal text-slate-500 ms-1">المستخدم:</span>
                        {card.username}
                      </div>
                      {showPassword && card.password && (
                        <div className="text-[11px] font-mono text-slate-700">
                          <span className="text-[10px] font-sans font-normal text-slate-500 ms-1">الرمز:</span>
                          {card.password}
                        </div>
                      )}
                    </div>

                    {/* QR Code */}
                    {showQr && qrCodes[card.id] && (
                      <div className="flex-shrink-0 bg-white p-0.5 border border-slate-200 rounded">
                        <img
                          src={qrCodes[card.id]}
                          alt="QR Login"
                          className="w-14 h-14 object-contain"
                        />
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="pt-1 mt-1 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500">
                    <span>امسح الكود أو ادخل على صفحة الدخول</span>
                    <span className="font-mono">Makeen</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <InteractiveCardPrintModal
        isOpen={showInteractiveModal}
        onClose={() => setShowInteractiveModal(false)}
        cards={cards}
      />
    </div>
  );
};
