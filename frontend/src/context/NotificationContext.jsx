import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null);

  // Auto-dismiss toasts
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', title = null, duration = 4500) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    const newToast = { id, message, type, title, duration };

    setToasts((prev) => [...prev.slice(-4), newToast]); // Keep max 5 visible toasts

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  const showModal = useCallback(({
    title,
    message,
    type = 'info',
    confirmText = 'Got It',
    cancelText = null,
    onConfirm = null,
    onCancel = null
  }) => {
    setModal({
      title,
      message,
      type,
      confirmText,
      cancelText,
      onConfirm: () => {
        if (onConfirm) onConfirm();
        setModal(null);
      },
      onCancel: () => {
        if (onCancel) onCancel();
        setModal(null);
      }
    });
  }, []);

  const closeModal = useCallback(() => {
    setModal(null);
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && modal) {
        if (modal.onCancel) modal.onCancel();
        else closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modal, closeModal]);

  const toastHelpers = {
    success: (msg, title = 'Success') => showToast(msg, 'success', title),
    error: (msg, title = 'Error') => showToast(msg, 'error', title),
    warning: (msg, title = 'Warning') => showToast(msg, 'warning', title),
    info: (msg, title = 'Notice') => showToast(msg, 'info', title),
  };

  const modalHelpers = {
    alert: (opts) => {
      if (typeof opts === 'string') {
        showModal({ title: 'Notification', message: opts, type: 'info' });
      } else {
        showModal(opts);
      }
    },
    success: ({ title = 'Success!', message, confirmText = 'Continue', onConfirm }) => 
      showModal({ title, message, type: 'success', confirmText, onConfirm }),
    error: ({ title = 'Action Failed', message, confirmText = 'Understood', onConfirm }) => 
      showModal({ title, message, type: 'error', confirmText, onConfirm }),
    warning: ({ title = 'Attention Required', message, confirmText = 'Proceed', cancelText = 'Cancel', onConfirm, onCancel }) => 
      showModal({ title, message, type: 'warning', confirmText, cancelText, onConfirm, onCancel }),
    confirm: ({ title = 'Are you sure?', message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel }) => 
      showModal({ title, message, type: 'confirm', confirmText, cancelText, onConfirm, onCancel })
  };

  return (
    <NotificationContext.Provider value={{ showToast, showModal, closeModal, toast: toastHelpers, modal: modalHelpers }}>
      {children}

      {/* Floating Toast Notification Stack */}
      <div 
        aria-live="assertive" 
        className="fixed top-5 right-5 z-[99999] flex flex-col space-y-3 pointer-events-none max-w-sm w-full px-4 sm:px-0"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>

      {/* Central Pop-up Modal Card */}
      {modal && <ModalPopupCard modal={modal} onClose={closeModal} />}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

function ToastCard({ toast, onClose }) {
  const { type, message, title, duration } = toast;

  const typeConfig = {
    success: {
      bg: 'bg-white border-emerald-200',
      iconBg: 'bg-emerald-100 text-emerald-600',
      progressBg: 'bg-emerald-500',
      titleColor: 'text-emerald-950',
      Icon: CheckCircle2
    },
    error: {
      bg: 'bg-white border-rose-200',
      iconBg: 'bg-rose-100 text-rose-600',
      progressBg: 'bg-rose-500',
      titleColor: 'text-rose-950',
      Icon: XCircle
    },
    warning: {
      bg: 'bg-white border-amber-200',
      iconBg: 'bg-amber-100 text-amber-600',
      progressBg: 'bg-amber-500',
      titleColor: 'text-amber-950',
      Icon: AlertTriangle
    },
    info: {
      bg: 'bg-white border-sky-200',
      iconBg: 'bg-sky-100 text-sky-600',
      progressBg: 'bg-sky-500',
      titleColor: 'text-sky-950',
      Icon: Info
    }
  };

  const config = typeConfig[type] || typeConfig.info;
  const Icon = config.Icon;

  return (
    <div
      role="alert"
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border shadow-xl shadow-slate-900/10 p-4 transition-all duration-300 transform translate-y-0 backdrop-blur-md ${config.bg} animate-in fade-in slide-in-from-top-4`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl flex-shrink-0 ${config.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 pt-0.5 min-w-0">
          {title && (
            <h4 className={`text-sm font-bold tracking-tight mb-0.5 ${config.titleColor}`}>
              {title}
            </h4>
          )}
          <p className="text-xs text-slate-600 font-medium leading-relaxed break-words">
            {message}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
          <div 
            className={`h-full ${config.progressBg} transition-all ease-linear`}
            style={{ 
              animation: `shrinkWidth ${duration}ms linear forwards` 
            }}
          />
        </div>
      )}
    </div>
  );
}

function ModalPopupCard({ modal, onClose }) {
  const { title, message, type, confirmText, cancelText, onConfirm, onCancel } = modal;

  const typeConfig = {
    success: {
      ring: 'ring-emerald-100 bg-emerald-50 text-emerald-600',
      btnBg: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20',
      Icon: CheckCircle2
    },
    error: {
      ring: 'ring-rose-100 bg-rose-50 text-rose-600',
      btnBg: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20',
      Icon: XCircle
    },
    warning: {
      ring: 'ring-amber-100 bg-amber-50 text-amber-600',
      btnBg: 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-amber-500/20',
      Icon: AlertTriangle
    },
    confirm: {
      ring: 'ring-amber-100 bg-amber-50 text-amber-600',
      btnBg: 'bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold shadow-amber-400/20',
      Icon: Sparkles
    },
    info: {
      ring: 'ring-sky-100 bg-sky-50 text-sky-600',
      btnBg: 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20',
      Icon: Info
    }
  };

  const config = typeConfig[type] || typeConfig.info;
  const Icon = config.Icon;

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 p-7 max-w-md w-full transform transition-all duration-300 scale-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Dismiss modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center pt-2">
          {/* Animated Hero Icon Badge */}
          <div className="inline-flex items-center justify-center mb-5">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ring-8 ${config.ring} shadow-inner`}>
              <Icon className="w-8 h-8" />
            </div>
          </div>

          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {title}
          </h3>

          <div className="mt-3 text-sm text-slate-600 leading-relaxed font-normal whitespace-pre-line px-2">
            {message}
          </div>

          {/* Action Buttons */}
          <div className="mt-7 flex items-center justify-center gap-3">
            {cancelText && (
              <button
                type="button"
                onClick={onCancel || onClose}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
              >
                {cancelText}
              </button>
            )}
            <button
              type="button"
              onClick={onConfirm || onClose}
              className={`flex-1 py-3 px-5 rounded-xl text-sm font-bold shadow-lg transition-all active:scale-95 inline-flex items-center justify-center gap-2 ${config.btnBg}`}
            >
              <span>{confirmText}</span>
              <ArrowRight className="w-4 h-4 opacity-80" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
