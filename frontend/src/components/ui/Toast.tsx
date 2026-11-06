import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toastQueue: Toast[] = [];

export function showToast(message: string, type: ToastType = 'info') {
  const id = Math.random().toString(36).slice(2);
  toastQueue = [...toastQueue, { id, type, message }];
  toastListeners.forEach(fn => fn(toastQueue));
  setTimeout(() => {
    toastQueue = toastQueue.filter(t => t.id !== id);
    toastListeners.forEach(fn => fn(toastQueue));
  }, 4500);
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} />,
  error: <XCircle size={18} />,
  info: <Info size={18} />,
  warning: <AlertTriangle size={18} />,
};

const colors: Record<ToastType, string> = {
  success: '#B8F2D0',
  error: '#FFB8A2',
  info: '#C9D5FF',
  warning: '#FFE66D',
};

export function ToastContainer() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  React.useEffect(() => {
    toastListeners.push(setToasts);
    return () => { toastListeners = toastListeners.filter(fn => fn !== setToasts); };
  }, []);

  const dismiss = (id: string) => {
    toastQueue = toastQueue.filter(t => t.id !== id);
    toastListeners.forEach(fn => fn(toastQueue));
  };

  return (
    <div className="toast-container" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl pointer-events-auto"
            style={{
              background: colors[toast.type],
              border: '2px solid #292524',
              boxShadow: '3px 3px 0px #292524',
              maxWidth: 340,
              minWidth: 240,
            }}
          >
            <span style={{ flexShrink: 0 }}>{icons[toast.type]}</span>
            <span className="text-sm font-600 flex-1" style={{ fontSize: '0.875rem', fontWeight: 600 }}>{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              className="btn btn-ghost btn-sm !min-h-0 !p-1 !border-transparent"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
