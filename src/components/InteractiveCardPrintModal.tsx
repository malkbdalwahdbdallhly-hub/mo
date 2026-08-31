import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '../types';
import {
  Printer,
  Download,
  X,
  Upload,
  Image as ImageIcon,
  CheckSquare,
  Square,
  Move,
  Type,
  Maximize2,
  Minimize2,
  RefreshCw,
  Eye,
  Sliders,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';

interface InteractiveCardPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: Card[];
  batchTitle?: string;
}

interface ElementStyle {
  show: boolean;
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  fontSize: number; // in px
  color: string;
  isBold: boolean;
  prefix: string;
  hasBackground: boolean;
  bgColor: string;
}

const DEFAULT_TEMPLATES = [
  {
    id: 'blue_waves',
    name: 'أزرق شبكي حديث',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300" viewBox="0 0 500 300"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231e1b4b"/><stop offset="50%" stop-color="%231e3a8a"/><stop offset="100%" stop-color="%230f172a"/></linearGradient><linearGradient id="acc" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="%2338bdf8"/><stop offset="100%" stop-color="%23818cf8"/></linearGradient></defs><rect width="500" height="300" rx="20" fill="url(%23bg)" stroke="%2338bdf8" stroke-width="2"/><circle cx="450" cy="50" r="100" fill="%2338bdf8" opacity="0.1"/><circle cx="50" cy="250" r="80" fill="%23818cf8" opacity="0.1"/><path d="M 0,200 Q 150,150 300,220 T 500,180 L 500,300 L 0,300 Z" fill="url(%23acc)" opacity="0.15"/><text x="40" y="55" font-family="sans-serif" font-weight="900" font-size="22" fill="%23ffffff">MAKEEN WIFI</text><text x="40" y="78" font-family="sans-serif" font-size="12" fill="%2393c5fd">بطاقة إنترنت فائق السرعة</text><rect x="35" y="110" width="430" height="60" rx="10" fill="%23ffffff" opacity="0.08" stroke="%23ffffff" stroke-dasharray="4" stroke-opacity="0.3"/><rect x="35" y="185" width="430" height="60" rx="10" fill="%23ffffff" opacity="0.08" stroke="%23ffffff" stroke-dasharray="4" stroke-opacity="0.3"/><text x="440" y="275" font-family="sans-serif" font-size="11" fill="%2394a3b8" text-anchor="end">اتصل بالشبكة وأدخل البيانات أعلاه</text></svg>',
  },
  {
    id: 'gold_vip',
    name: 'ذهبي فاخر (VIP)',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300" viewBox="0 0 500 300"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231c1917"/><stop offset="100%" stop-color="%230c0a09"/></linearGradient><linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23f59e0b"/><stop offset="50%" stop-color="%23fbbf24"/><stop offset="100%" stop-color="%23d97706"/></linearGradient></defs><rect width="500" height="300" rx="20" fill="url(%23bg)" stroke="url(%23gold)" stroke-width="2.5"/><rect x="15" y="15" width="470" height="270" rx="14" fill="none" stroke="%23f59e0b" stroke-width="1" stroke-opacity="0.3"/><text x="250" y="55" font-family="sans-serif" font-weight="900" font-size="20" fill="url(%23gold)" text-anchor="middle">⚡ كرت إنترنت مكين VIP ⚡</text><rect x="40" y="105" width="420" height="65" rx="12" fill="%23292524" stroke="%23f59e0b" stroke-width="1"/><rect x="40" y="185" width="420" height="65" rx="12" fill="%23292524" stroke="%23f59e0b" stroke-width="1"/></svg>',
  },
  {
    id: 'minimal_white',
    name: 'أبيض اقتصادي للحبر',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300" viewBox="0 0 500 300"><rect width="500" height="300" rx="16" fill="%23ffffff" stroke="%230f172a" stroke-width="2"/><line x1="20" y1="65" x2="480" y2="65" stroke="%23e2e8f0" stroke-width="2"/><text x="35" y="45" font-family="sans-serif" font-weight="bold" font-size="18" fill="%230f172a">كوبون شبكة الإنترنت</text><rect x="35" y="100" width="430" height="65" rx="8" fill="%23f8fafc" stroke="%23cbd5e1" stroke-width="1.5"/><rect x="35" y="180" width="430" height="65" rx="8" fill="%23f8fafc" stroke="%23cbd5e1" stroke-width="1.5"/></svg>',
  },
];

export const InteractiveCardPrintModal: React.FC<InteractiveCardPrintModalProps> = ({
  isOpen,
  onClose,
  cards,
  batchTitle,
}) => {
  // Mode: 'designer' | 'preview'
  const [activeTab, setActiveTab] = useState<'designer' | 'preview'>('designer');

  // Custom Template Image (from gallery/device)
  const [templateImage, setTemplateImage] = useState<string>(() => {
    return localStorage.getItem('makeen_card_template_img') || DEFAULT_TEMPLATES[0].url;
  });

  // Controls beside the template:
  // 1. Username
  const [usernameConfig, setUsernameConfig] = useState<ElementStyle>(() => {
    const fallback: ElementStyle = {
      show: true,
      x: 35,
      y: 42,
      fontSize: 16,
      color: '#ffffff',
      isBold: true,
      prefix: '',
      hasBackground: false,
      bgColor: 'rgba(0,0,0,0.5)',
    };
    const saved = localStorage.getItem('makeen_card_user_style');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...fallback, ...parsed };
        }
      } catch {}
    }
    return fallback;
  });

  // 2. Password
  const [passwordConfig, setPasswordConfig] = useState<ElementStyle>(() => {
    const fallback: ElementStyle = {
      show: true,
      x: 35,
      y: 68,
      fontSize: 16,
      color: '#ffffff',
      isBold: true,
      prefix: '',
      hasBackground: false,
      bgColor: 'rgba(0,0,0,0.5)',
    };
    const saved = localStorage.getItem('makeen_card_pass_style');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...fallback, ...parsed };
        }
      } catch {}
    }
    return fallback;
  });

  // Optional QR code & Extra metadata
  const [showQrCode, setShowQrCode] = useState(false);
  const [qrPos, setQrPos] = useState({ x: 80, y: 55, size: 50 });
  const [cardsPerPage, setCardsPerPage] = useState<number>(24);
  const [networkName, setNetworkName] = useState('شبكة مكين الذكية');
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [exportingPdf, setExportingPdf] = useState(false);

  // Active dragging state
  const [activeDragElement, setActiveDragElement] = useState<'username' | 'password' | 'qr' | null>(null);
  const cardPreviewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save configurations
  useEffect(() => {
    localStorage.setItem('makeen_card_user_style', JSON.stringify(usernameConfig));
  }, [usernameConfig]);

  useEffect(() => {
    localStorage.setItem('makeen_card_pass_style', JSON.stringify(passwordConfig));
  }, [passwordConfig]);

  useEffect(() => {
    if (templateImage) {
      localStorage.setItem('makeen_card_template_img', templateImage);
    }
  }, [templateImage]);

  // Pre-generate QR codes if needed
  useEffect(() => {
    if (!showQrCode || cards.length === 0) return;
    let isMounted = true;
    const generateQrs = async () => {
      const qrs: Record<string, string> = {};
      for (const card of cards.slice(0, 100)) {
        try {
          const qrData = `http://192.168.88.1/login?username=${encodeURIComponent(card.username)}&password=${encodeURIComponent(card.password || '')}`;
          const url = await QRCode.toDataURL(qrData, {
            margin: 1,
            width: 100,
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
  }, [showQrCode, cards]);

  // Handle uploading image from phone gallery or file picker
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (PNG, JPG, SVG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setTemplateImage(result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Dragging logic with Pointer Events for both touch (phones) and mouse
  const handlePointerDown = (element: 'username' | 'password' | 'qr', e: React.PointerEvent) => {
    e.stopPropagation();
    setActiveDragElement(element);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeDragElement || !cardPreviewRef.current) return;
      const rect = cardPreviewRef.current.getBoundingClientRect();
      const rawX = ((e.clientX - rect.left) / rect.width) * 100;
      const rawY = ((e.clientY - rect.top) / rect.height) * 100;

      const clampedX = Math.round(Math.max(5, Math.min(95, rawX)));
      const clampedY = Math.round(Math.max(5, Math.min(95, rawY)));

      if (activeDragElement === 'username') {
        setUsernameConfig((prev) => ({ ...prev, x: clampedX, y: clampedY }));
      } else if (activeDragElement === 'password') {
        setPasswordConfig((prev) => ({ ...prev, x: clampedX, y: clampedY }));
      } else if (activeDragElement === 'qr') {
        setQrPos((prev) => ({ ...prev, x: clampedX, y: clampedY }));
      }
    },
    [activeDragElement]
  );

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeDragElement) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setActiveDragElement(null);
    }
  };

  // Nudge controls for fine adjustment on mobile
  const nudge = (element: 'username' | 'password', dx: number, dy: number) => {
    if (element === 'username') {
      setUsernameConfig((prev) => ({
        ...prev,
        x: Math.max(2, Math.min(98, prev.x + dx)),
        y: Math.max(2, Math.min(98, prev.y + dy)),
      }));
    } else {
      setPasswordConfig((prev) => ({
        ...prev,
        x: Math.max(2, Math.min(98, prev.x + dx)),
        y: Math.max(2, Math.min(98, prev.y + dy)),
      }));
    }
  };

  // Browser Print trigger
  const handlePrint = () => {
    window.print();
  };

  // Fast & Sharp PDF Generator
  const handleExportPdf = async () => {
    if (cards.length === 0) return;
    setExportingPdf(true);

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8;

      let cols = 3;
      let rows = 8;
      if (cardsPerPage <= 8) {
        cols = 2;
        rows = 4;
      } else if (cardsPerPage <= 12) {
        cols = 3;
        rows = 4;
      } else if (cardsPerPage <= 20) {
        cols = 4;
        rows = 5;
      } else if (cardsPerPage <= 24) {
        cols = 3;
        rows = 8;
      } else {
        cols = 4;
        rows = 8;
      }

      const cardWidth = (pageWidth - margin * 2) / cols;
      const cardHeight = (pageHeight - margin * 2) / rows;
      const cardsPerSheet = cols * rows;

      // Preload template image as HTMLImageElement
      const imgObj = new Image();
      imgObj.crossOrigin = 'anonymous';
      await new Promise((resolve) => {
        imgObj.onload = resolve;
        imgObj.onerror = resolve;
        imgObj.src = templateImage;
      });

      for (let i = 0; i < cards.length; i++) {
        if (i > 0 && i % cardsPerSheet === 0) {
          doc.addPage();
        }

        const pageIndex = i % cardsPerSheet;
        const col = pageIndex % cols;
        const row = Math.floor(pageIndex / cols);
        const x = margin + col * cardWidth;
        const y = margin + row * cardHeight;

        const card = cards[i];

        // Draw card background image
        try {
          if (imgObj.complete && imgObj.naturalWidth > 0) {
            doc.addImage(imgObj, 'PNG', x + 1, y + 1, cardWidth - 2, cardHeight - 2);
          } else {
            doc.setFillColor(248, 250, 252);
            doc.rect(x + 1, y + 1, cardWidth - 2, cardHeight - 2, 'F');
            doc.setDrawColor(203, 213, 225);
            doc.rect(x + 1, y + 1, cardWidth - 2, cardHeight - 2, 'S');
          }
        } catch {
          doc.setFillColor(248, 250, 252);
          doc.rect(x + 1, y + 1, cardWidth - 2, cardHeight - 2, 'F');
        }

        // Draw Username if enabled
        if (usernameConfig.show) {
          const userX = x + (cardWidth * usernameConfig.x) / 100;
          const userY = y + (cardHeight * usernameConfig.y) / 100;

          doc.setFontSize(Math.max(7, Math.round(usernameConfig.fontSize * 0.55)));
          doc.setFont('helvetica', usernameConfig.isBold ? 'bold' : 'normal');

          // Parse color
          let r = 0,
            g = 0,
            b = 0;
          if (usernameConfig.color.startsWith('#')) {
            const hex = usernameConfig.color.replace('#', '');
            if (hex.length === 6) {
              r = parseInt(hex.substring(0, 2), 16);
              g = parseInt(hex.substring(2, 4), 16);
              b = parseInt(hex.substring(4, 6), 16);
            }
          }
          doc.setTextColor(r, g, b);
          const userText = usernameConfig.prefix ? `${usernameConfig.prefix} ${card.username}` : card.username;
          doc.text(userText, userX, userY, { align: 'center' });
        }

        // Draw Password if enabled
        if (passwordConfig.show && card.password) {
          const passX = x + (cardWidth * passwordConfig.x) / 100;
          const passY = y + (cardHeight * passwordConfig.y) / 100;

          doc.setFontSize(Math.max(7, Math.round(passwordConfig.fontSize * 0.55)));
          doc.setFont('helvetica', passwordConfig.isBold ? 'bold' : 'normal');

          let r = 0,
            g = 0,
            b = 0;
          if (passwordConfig.color.startsWith('#')) {
            const hex = passwordConfig.color.replace('#', '');
            if (hex.length === 6) {
              r = parseInt(hex.substring(0, 2), 16);
              g = parseInt(hex.substring(2, 4), 16);
              b = parseInt(hex.substring(4, 6), 16);
            }
          }
          doc.setTextColor(r, g, b);
          const passText = passwordConfig.prefix ? `${passwordConfig.prefix} ${card.password}` : card.password;
          doc.text(passText, passX, passY, { align: 'center' });
        }

        // Draw QR Code if enabled
        if (showQrCode && qrCodes[card.id]) {
          try {
            const qSize = Math.min(cardHeight * 0.35, cardWidth * 0.28);
            const qX = x + (cardWidth * qrPos.x) / 100 - qSize / 2;
            const qY = y + (cardHeight * qrPos.y) / 100 - qSize / 2;
            doc.addImage(qrCodes[card.id], 'PNG', qX, qY, qSize, qSize);
          } catch {}
        }
      }

      doc.save(`makeen-cards-batch-${Date.now()}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  if (!isOpen) return null;

  const sampleCard = cards[0] || {
    id: 'sample',
    username: 'MK920481',
    password: '5812',
    profile: '1d-Daily',
    price: 5,
    status: 'AVAILABLE',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto"
      dir="rtl"
    >
      <div className="w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Header (hidden in print) */}
        <div className="bg-slate-950 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                نظام تصميم قوالب وطباعة الكروت
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                  {cards.length} كرت محدد
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {batchTitle || 'طباعة الدفعة المضافة في User Manager مع مطابقة القالب وتحريك الحقول بحرية'}
              </p>
            </div>
          </div>

          {/* Action Tabs & Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center text-xs">
              <button
                onClick={() => setActiveTab('designer')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'designer'
                    ? 'bg-indigo-600 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Move className="w-3.5 h-3.5" />
                تعديل القالب وموضع الحقول
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'preview'
                    ? 'bg-indigo-600 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                معاينة صفحة الطباعة A4
              </button>
            </div>

            <button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs flex items-center gap-1.5 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              {exportingPdf ? 'جارِ التصدير...' : 'تصدير PDF'}
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              طباعة الآن
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0B1120]">
          {activeTab === 'designer' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Interactive Card Canvas (7 cols) */}
              <div className="lg:col-span-7 flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    اسحب الحقول وضعها في المكان المناسب على القالب:
                  </span>
                  <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                    يدعم اللمس على الهاتف والماوس على الكمبيوتر
                  </span>
                </div>

                {/* The Interactive Card Preview Box */}
                <div
                  ref={cardPreviewRef}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className="relative w-full max-w-[480px] aspect-[1.6/1] rounded-2xl overflow-hidden shadow-2xl border-2 border-indigo-500/30 select-none touch-none cursor-crosshair bg-slate-950 flex items-center justify-center"
                  style={{
                    backgroundImage: `url("${templateImage}")`,
                    backgroundSize: '100% 100%',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                  }}
                >
                  {/* Draggable Username */}
                  {usernameConfig.show && (
                    <div
                      onPointerDown={(e) => handlePointerDown('username', e)}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing select-none px-2 py-1 rounded-lg transition-shadow duration-100 flex items-center gap-1.5 ${
                        activeDragElement === 'username'
                          ? 'ring-2 ring-cyan-400 bg-cyan-950/80 shadow-lg shadow-cyan-500/50'
                          : 'hover:ring-1 hover:ring-cyan-500/70'
                      }`}
                      style={{
                        left: `${usernameConfig.x}%`,
                        top: `${usernameConfig.y}%`,
                        fontSize: `${usernameConfig.fontSize}px`,
                        color: usernameConfig.color,
                        fontWeight: usernameConfig.isBold ? 800 : 500,
                        backgroundColor: usernameConfig.hasBackground ? usernameConfig.bgColor : undefined,
                        textShadow: usernameConfig.hasBackground
                          ? 'none'
                          : '0 1px 3px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.6)',
                      }}
                    >
                      <Move className="w-3 h-3 text-cyan-400 opacity-70 pointer-events-none" />
                      <span className="font-mono tracking-wider pointer-events-none">
                        {usernameConfig.prefix} {sampleCard.username}
                      </span>
                    </div>
                  )}

                  {/* Draggable Password */}
                  {passwordConfig.show && (
                    <div
                      onPointerDown={(e) => handlePointerDown('password', e)}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing select-none px-2 py-1 rounded-lg transition-shadow duration-100 flex items-center gap-1.5 ${
                        activeDragElement === 'password'
                          ? 'ring-2 ring-amber-400 bg-amber-950/80 shadow-lg shadow-amber-500/50'
                          : 'hover:ring-1 hover:ring-amber-500/70'
                      }`}
                      style={{
                        left: `${passwordConfig.x}%`,
                        top: `${passwordConfig.y}%`,
                        fontSize: `${passwordConfig.fontSize}px`,
                        color: passwordConfig.color,
                        fontWeight: passwordConfig.isBold ? 800 : 500,
                        backgroundColor: passwordConfig.hasBackground ? passwordConfig.bgColor : undefined,
                        textShadow: passwordConfig.hasBackground
                          ? 'none'
                          : '0 1px 3px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.6)',
                      }}
                    >
                      <Move className="w-3 h-3 text-amber-400 opacity-70 pointer-events-none" />
                      <span className="font-mono tracking-wider pointer-events-none">
                        {passwordConfig.prefix} {sampleCard.password || '1234'}
                      </span>
                    </div>
                  )}

                  {/* Draggable QR Code if enabled */}
                  {showQrCode && (
                    <div
                      onPointerDown={(e) => handlePointerDown('qr', e)}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing select-none p-1 bg-white rounded-md shadow-md ${
                        activeDragElement === 'qr' ? 'ring-2 ring-indigo-400' : ''
                      }`}
                      style={{
                        left: `${qrPos.x}%`,
                        top: `${qrPos.y}%`,
                        width: `${qrPos.size}px`,
                        height: `${qrPos.size}px`,
                      }}
                    >
                      <div className="w-full h-full bg-slate-900 flex items-center justify-center text-[9px] text-white font-mono">
                        QR
                      </div>
                    </div>
                  )}
                </div>

                {/* Precise Nudge controls for phone users */}
                <div className="w-full max-w-[480px] mt-4 p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-400">ضبط دقيق للموضع (أزرار التحريك):</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                      <button
                        onClick={() => nudge('username', 0, -1)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-300"
                        title="اسم المستخدم للأعلى"
                      >
                        <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
                      </button>
                      <button
                        onClick={() => nudge('username', 0, 1)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-300"
                        title="اسم المستخدم للأسفل"
                      >
                        <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
                      </button>
                      <button
                        onClick={() => nudge('username', 1, 0)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-300"
                        title="اسم المستخدم لليمين"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                      </button>
                      <button
                        onClick={() => nudge('username', -1, 0)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-300"
                        title="اسم المستخدم لليسار"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
                      </button>
                      <span className="text-[10px] text-cyan-400 font-mono px-1">المستخدم</span>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                      <button
                        onClick={() => nudge('password', 0, -1)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-300"
                        title="الرمز للأعلى"
                      >
                        <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                      </button>
                      <button
                        onClick={() => nudge('password', 0, 1)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-300"
                        title="الرمز للأسفل"
                      >
                        <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                      </button>
                      <button
                        onClick={() => nudge('password', 1, 0)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-300"
                        title="الرمز لليمين"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                      </button>
                      <button
                        onClick={() => nudge('password', -1, 0)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-300"
                        title="الرمز لليسار"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
                      </button>
                      <span className="text-[10px] text-amber-400 font-mono px-1">الرمز</span>
                    </div>
                  </div>
                </div>

                {/* Preset templates selector */}
                <div className="w-full max-w-[480px] mt-4">
                  <span className="text-xs font-semibold text-slate-400 mb-2 block">
                    أو اختر قالباً جاهزاً فورياً:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {DEFAULT_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => setTemplateImage(tpl.url)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          templateImage === tpl.url
                            ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300 font-bold'
                            : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-[11px] block truncate">{tpl.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Controls, Upload & Toggles (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                {/* 1. Upload Template Image from Gallery / Camera */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5">
                  <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-cyan-400" />
                    صورة القالب من معرض الهاتف / الحاسوب
                  </h4>
                  <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                    يمكنك رفع صورة تصميم كرتك المطبوع من المعرض ليتم دمج بيانات الكروت فوقها مباشرة
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      اختيار صورة القالب من المعرض
                    </button>

                    <button
                      onClick={() => setTemplateImage(DEFAULT_TEMPLATES[0].url)}
                      title="استعادة القالب الافتراضي"
                      className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 2. Options beside the template: Username & Password Checkboxes & Customization */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                  <h4 className="text-xs font-bold text-white mb-1 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    الحقول المعروضة على القالب
                  </h4>
                  <p className="text-[11px] text-slate-400 mb-3">
                    اضغط علامة الصح لإظهار أو إخفاء الحقل، ثم اسحبه في صورة القالب للموضع المناسب.
                  </p>

                  {/* Option 1: Username Field */}
                  <div
                    className={`p-3.5 rounded-xl border transition-all ${
                      usernameConfig.show
                        ? 'bg-slate-950/80 border-cyan-500/40'
                        : 'bg-slate-950/30 border-slate-800 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer select-none">
                        <button
                          type="button"
                          onClick={() => setUsernameConfig((p) => ({ ...p, show: !p.show }))}
                          className="text-cyan-400 focus:outline-none"
                        >
                          {usernameConfig.show ? (
                            <CheckSquare className="w-5 h-5 text-cyan-400" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-600" />
                          )}
                        </button>
                        <span>اسم المستخدم (Username)</span>
                      </label>
                      <span className="text-[10px] text-cyan-300/80 font-mono">
                        X: {usernameConfig.x}% | Y: {usernameConfig.y}%
                      </span>
                    </div>

                    {usernameConfig.show && (
                      <div className="space-y-2.5 pt-2 border-t border-slate-800 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-slate-400 block mb-1">حجم الخط ({usernameConfig.fontSize ?? 16}px)</span>
                            <input
                              type="range"
                              min={10}
                              max={32}
                              value={usernameConfig.fontSize ?? 16}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setUsernameConfig((p) => ({ ...p, fontSize: Number.isNaN(val) ? 16 : val }));
                              }}
                              className="w-full accent-cyan-500 cursor-pointer"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block mb-1">لون الخط</span>
                            <div className="flex items-center gap-1.5">
                              {['#ffffff', '#0f172a', '#38bdf8', '#fbbf24', '#ef4444'].map((col) => (
                                <button
                                  key={col}
                                  onClick={() => setUsernameConfig((p) => ({ ...p, color: col }))}
                                  className={`w-5 h-5 rounded-full border border-slate-600 transition-transform ${
                                    (usernameConfig.color ?? '#ffffff') === col ? 'scale-125 ring-2 ring-cyan-400' : ''
                                  }`}
                                  style={{ backgroundColor: col }}
                                />
                              ))}
                              <input
                                type="color"
                                value={usernameConfig.color ?? '#ffffff'}
                                onChange={(e) => setUsernameConfig((p) => ({ ...p, color: e.target.value || '#ffffff' }))}
                                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-slate-300 text-[11px] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!usernameConfig.isBold}
                              onChange={(e) => setUsernameConfig((p) => ({ ...p, isBold: e.target.checked }))}
                              className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                            />
                            <span>خط عريض (Bold)</span>
                          </label>

                          <label className="flex items-center gap-1.5 text-slate-300 text-[11px] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!usernameConfig.hasBackground}
                              onChange={(e) => setUsernameConfig((p) => ({ ...p, hasBackground: e.target.checked }))}
                              className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                            />
                            <span>خلفية مظللة للنص</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Option 2: Password Field */}
                  <div
                    className={`p-3.5 rounded-xl border transition-all ${
                      passwordConfig.show
                        ? 'bg-slate-950/80 border-amber-500/40'
                        : 'bg-slate-950/30 border-slate-800 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer select-none">
                        <button
                          type="button"
                          onClick={() => setPasswordConfig((p) => ({ ...p, show: !p.show }))}
                          className="text-amber-400 focus:outline-none"
                        >
                          {passwordConfig.show ? (
                            <CheckSquare className="w-5 h-5 text-amber-400" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-600" />
                          )}
                        </button>
                        <span>كلمة المرور (Password)</span>
                      </label>
                      <span className="text-[10px] text-amber-300/80 font-mono">
                        X: {passwordConfig.x}% | Y: {passwordConfig.y}%
                      </span>
                    </div>

                    {passwordConfig.show && (
                      <div className="space-y-2.5 pt-2 border-t border-slate-800 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-slate-400 block mb-1">حجم الخط ({passwordConfig.fontSize ?? 16}px)</span>
                            <input
                              type="range"
                              min={10}
                              max={32}
                              value={passwordConfig.fontSize ?? 16}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setPasswordConfig((p) => ({ ...p, fontSize: Number.isNaN(val) ? 16 : val }));
                              }}
                              className="w-full accent-amber-500 cursor-pointer"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block mb-1">لون الخط</span>
                            <div className="flex items-center gap-1.5">
                              {['#ffffff', '#0f172a', '#fbbf24', '#38bdf8', '#ef4444'].map((col) => (
                                <button
                                  key={col}
                                  onClick={() => setPasswordConfig((p) => ({ ...p, color: col }))}
                                  className={`w-5 h-5 rounded-full border border-slate-600 transition-transform ${
                                    (passwordConfig.color ?? '#ffffff') === col ? 'scale-125 ring-2 ring-amber-400' : ''
                                  }`}
                                  style={{ backgroundColor: col }}
                                />
                              ))}
                              <input
                                type="color"
                                value={passwordConfig.color ?? '#ffffff'}
                                onChange={(e) => setPasswordConfig((p) => ({ ...p, color: e.target.value || '#ffffff' }))}
                                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-slate-300 text-[11px] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!passwordConfig.isBold}
                              onChange={(e) => setPasswordConfig((p) => ({ ...p, isBold: e.target.checked }))}
                              className="rounded bg-slate-900 border-slate-700 text-amber-500"
                            />
                            <span>خط عريض (Bold)</span>
                          </label>

                          <label className="flex items-center gap-1.5 text-slate-300 text-[11px] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!passwordConfig.hasBackground}
                              onChange={(e) => setPasswordConfig((p) => ({ ...p, hasBackground: e.target.checked }))}
                              className="rounded bg-slate-900 border-slate-700 text-amber-500"
                            />
                            <span>خلفية مظللة للنص</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Print Page Setup */}
                  <div className="pt-2">
                    <span className="text-[11px] text-slate-400 block mb-1 font-semibold">
                      عدد الكروت في صفحة A4:
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      {[8, 12, 16, 20, 24, 30].map((num) => (
                        <button
                          key={num}
                          onClick={() => setCardsPerPage(num)}
                          className={`py-1.5 px-2 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                            cardsPerPage === num
                              ? 'border-indigo-500 bg-indigo-950/60 text-white font-bold'
                              : 'border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {num} كرت
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* A4 Print Sheet Preview */
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs print:hidden">
                <span className="text-slate-300">
                  معاينة ورقة A4 كاملة ({cards.length} كرت، مقسمة {cardsPerPage} كرت بالصفحة):
                </span>
                <button
                  onClick={handlePrint}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  بدء الطباعة على الطابعة
                </button>
              </div>

              {/* A4 Container */}
              <div className="flex justify-center p-2 sm:p-6 bg-slate-950 rounded-2xl overflow-x-auto print:bg-white print:p-0">
                <div
                  className="bg-white text-slate-900 shadow-2xl p-4 sm:p-6 rounded-lg w-[210mm] min-h-[297mm] box-border print:p-0 print:m-0 print:w-full print:shadow-none"
                  style={{ direction: 'rtl' }}
                >
                  <div
                    className="grid gap-2.5"
                    style={{
                      gridTemplateColumns:
                        cardsPerPage <= 8
                          ? 'repeat(2, 1fr)'
                          : cardsPerPage <= 12
                          ? 'repeat(3, 1fr)'
                          : cardsPerPage <= 20
                          ? 'repeat(4, 1fr)'
                          : cardsPerPage <= 24
                          ? 'repeat(3, 1fr)'
                          : 'repeat(4, 1fr)',
                    }}
                  >
                    {cards.slice(0, cardsPerPage).map((card) => (
                      <div
                        key={card.id}
                        className="relative rounded-lg overflow-hidden border border-slate-300 box-border"
                        style={{
                          aspectRatio: '1.6 / 1',
                          backgroundImage: `url("${templateImage}")`,
                          backgroundSize: '100% 100%',
                          backgroundRepeat: 'no-repeat',
                          minHeight: cardsPerPage <= 12 ? '130px' : '90px',
                        }}
                      >
                        {/* Username */}
                        {usernameConfig.show && (
                          <div
                            className="absolute -translate-x-1/2 -translate-y-1/2 font-mono whitespace-nowrap"
                            style={{
                              left: `${usernameConfig.x}%`,
                              top: `${usernameConfig.y}%`,
                              fontSize: `${Math.max(8, Math.round(usernameConfig.fontSize * 0.75))}px`,
                              color: usernameConfig.color,
                              fontWeight: usernameConfig.isBold ? 800 : 500,
                              backgroundColor: usernameConfig.hasBackground ? usernameConfig.bgColor : undefined,
                              padding: usernameConfig.hasBackground ? '1px 4px' : undefined,
                              borderRadius: '4px',
                            }}
                          >
                            {usernameConfig.prefix} {card.username}
                          </div>
                        )}

                        {/* Password */}
                        {passwordConfig.show && card.password && (
                          <div
                            className="absolute -translate-x-1/2 -translate-y-1/2 font-mono whitespace-nowrap"
                            style={{
                              left: `${passwordConfig.x}%`,
                              top: `${passwordConfig.y}%`,
                              fontSize: `${Math.max(8, Math.round(passwordConfig.fontSize * 0.75))}px`,
                              color: passwordConfig.color,
                              fontWeight: passwordConfig.isBold ? 800 : 500,
                              backgroundColor: passwordConfig.hasBackground ? passwordConfig.bgColor : undefined,
                              padding: passwordConfig.hasBackground ? '1px 4px' : undefined,
                              borderRadius: '4px',
                            }}
                          >
                            {passwordConfig.prefix} {card.password}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
