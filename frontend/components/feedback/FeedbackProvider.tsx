'use client';

import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
  variant: ToastVariant;
}

interface FeedbackContextValue {
  pushToast: (options: ToastOptions) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
};

const variantIcons = {
  success: CheckCircle2,
  error: CircleAlert,
  info: Info,
} as const;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutMapRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timerId = timeoutMapRef.current.get(id);
    if (timerId) {
      window.clearTimeout(timerId);
      timeoutMapRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ title, description, variant = 'info', durationMs = 2800 }: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((prev) => [...prev, { id, title, description, variant, durationMs }]);

      const timerId = window.setTimeout(() => {
        dismissToast(id);
      }, durationMs);

      timeoutMapRef.current.set(id, timerId);
    },
    [dismissToast],
  );

  useEffect(() => {
    const timeoutMap = timeoutMapRef.current;
    return () => {
      timeoutMap.forEach((timerId) => window.clearTimeout(timerId));
      timeoutMap.clear();
    };
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] space-y-2">
        {toasts.map((toast) => {
          const Icon = variantIcons[toast.variant];
          return (
            <section
              key={toast.id}
              role="status"
              className={`pointer-events-auto motion-rise w-[min(92vw,360px)] rounded-xl border px-3 py-2 shadow-lg ${variantStyles[toast.variant]}`}
            >
              <div className="flex items-start gap-2">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{toast.title}</p>
                  {toast.description ? <p className="mt-0.5 text-xs opacity-90">{toast.description}</p> : null}
                </div>
                <button
                  type="button"
                  aria-label="닫기"
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-md p-1 hover:bg-black/5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return context;
}
