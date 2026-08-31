import React from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Makeen UI Error Caught:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0F172A] text-slate-100 flex items-center justify-center p-4 font-sans" dir="rtl">
          <div className="max-w-md w-full bg-[#1E293B] border border-slate-700/60 rounded-2xl p-6 shadow-2xl text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 shadow-inner">
              <AlertTriangle className="w-7 h-7" />
            </div>
            
            <h2 className="text-lg font-bold text-white mb-2">
              حدث خطأ أثناء تحميل الواجهة
            </h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              تعذر استكمال العرض لأحد المكونات. يمكنك إعادة تحميل الصفحة أو تنظيف الذاكرة المؤقتة.
            </p>

            {this.state.error && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 mb-5 text-right font-mono text-[11px] text-red-400 max-h-32 overflow-y-auto" dir="ltr">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة تحميل</span>
              </button>

              <button
                onClick={this.handleClearCache}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-700"
                title="تنظيف الذاكرة المحلية وإعادة التحميل"
              >
                <Trash2 className="w-4 h-4 text-slate-400" />
                <span>مسح الكاش</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
