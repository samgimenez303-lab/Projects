import React from 'react';
import { useNotification } from '../context/NotificationContext';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

const Toast = () => {
  const { toasts, removeToast } = useNotification();

  if (!toasts || toasts.length === 0) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-navy-500 flex-shrink-0" />,
  };

  const borders = {
    success: 'border-l-4 border-l-emerald-500 bg-white',
    error: 'border-l-4 border-l-rose-500 bg-white',
    warning: 'border-l-4 border-l-amber-500 bg-white',
    info: 'border-l-4 border-l-navy-500 bg-white',
  };

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto p-4 rounded-lg shadow-lg border border-slate-200 ${
            borders[toast.type] || borders.info
          } transition-all duration-200 transform translate-y-0 opacity-100 flex items-start justify-between gap-3`}
        >
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {icons[toast.type] || icons.info}
            <div className="flex-1 min-w-0">
              {toast.title && (
                <h5 className="text-sm font-semibold text-slate-900 leading-tight">
                  {toast.title}
                </h5>
              )}
              {toast.message && (
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed break-words">
                  {toast.message}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toast;

