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

interface UndoToastOptions {
  title: string;
  description?: string;
  durationMs?: number;
  onUndo: () => void;
  onExpire: () => void;
}

interface ToastItem extends ToastOptions {
  id: string;
  variant: ToastVariant;
  isUndo?: boolean;
  remainingSeconds?: number;
  onUndo?: () => void;
}

interface FeedbackContextValue {
  pushToast: (options: ToastOptions) => void;
  pushUndoToast: (options: UndoToastOptions) => string;
  dismissToast: (id: string) => void;
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
  const countdownMapRef = useRef<Map<string, number>>(new Map());
  const expireCallbackMapRef = useRef<Map<string, () => void>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timerId = timeoutMapRef.current.get(id);
    if (timerId) {
      window.clearTimeout(timerId);
      timeoutMapRef.current.delete(id);
    }
    const countdownId = countdownMapRef.current.get(id);
    if (countdownId) {
      window.clearInterval(countdownId);
      countdownMapRef.current.delete(id);
    }
    expireCallbackMapRef.current.delete(id);
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const MAX_TOASTS = 3;

  const pushToast = useCallback(
    ({ title, description, variant = 'info', durationMs = 2800 }: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((prev) => {
        const next = [...prev, { id, title, description, variant, durationMs }];
        // Remove oldest toasts if exceeding the limit
        while (next.length > MAX_TOASTS) {
          const removed = next.shift()!;
          const timerId = timeoutMapRef.current.get(removed.id);
          if (timerId) {
            window.clearTimeout(timerId);
            timeoutMapRef.current.delete(removed.id);
          }
        }
        return next;
      });

      const timerId = window.setTimeout(() => {
        dismissToast(id);
      }, durationMs);

      timeoutMapRef.current.set(id, timerId);
    },
    [dismissToast],
  );

  const pushUndoToast = useCallback(
    ({ title, description, durationMs = 5000, onUndo, onExpire }: UndoToastOptions): string => {
      const id = `undo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const totalSeconds = Math.ceil(durationMs / 1000);

      setToasts((prev) => {
        const next = [
          ...prev,
          {
            id,
            title,
            description,
            variant: 'info' as ToastVariant,
            durationMs,
            isUndo: true,
            remainingSeconds: totalSeconds,
            onUndo,
          },
        ];
        while (next.length > MAX_TOASTS) {
          const removed = next.shift()!;
          const timerId = timeoutMapRef.current.get(removed.id);
          if (timerId) {
            window.clearTimeout(timerId);
            timeoutMapRef.current.delete(removed.id);
          }
        }
        return next;
      });

      // Store the expire callback so we can call it when the timer fires
      expireCallbackMapRef.current.set(id, onExpire);

      // Countdown interval — update remainingSeconds every second
      const countdownId = window.setInterval(() => {
        setToasts((prev) =>
          prev.map((t) =>
            t.id === id && t.remainingSeconds !== undefined
              ? { ...t, remainingSeconds: Math.max(0, t.remainingSeconds - 1) }
              : t,
          ),
        );
      }, 1000);
      countdownMapRef.current.set(id, countdownId);

      // Auto-expire after durationMs
      const timerId = window.setTimeout(() => {
        const cb = expireCallbackMapRef.current.get(id);
        dismissToast(id);
        // Guard: only call expire if the toast wasn't already dismissed (e.g., by undo or unmount)
        if (cb) {
          cb();
        }
      }, durationMs);
      timeoutMapRef.current.set(id, timerId);

      return id;
    },
    [dismissToast],
  );

  // Handle undo click — dismiss toast and invoke onUndo callback
  const handleUndoClick = useCallback(
    (toast: ToastItem) => {
      dismissToast(toast.id);
      toast.onUndo?.();
    },
    [dismissToast],
  );

  useEffect(() => {
    const timeoutMap = timeoutMapRef.current;
    const countdownMap = countdownMapRef.current;
    const expireMap = expireCallbackMapRef.current;
    return () => {
      timeoutMap.forEach((timerId) => window.clearTimeout(timerId));
      timeoutMap.clear();
      countdownMap.forEach((id) => window.clearInterval(id));
      countdownMap.clear();
      expireMap.clear();
    };
  }, []);

  const value = useMemo(() => ({ pushToast, pushUndoToast, dismissToast }), [pushToast, pushUndoToast, dismissToast]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] space-y-2 max-sm:bottom-4 max-sm:top-auto max-sm:left-4">
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
                  {toast.isUndo && (
                    <button
                      type="button"
                      onClick={() => handleUndoClick(toast)}
                      className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-white/80 px-2.5 py-1 text-xs font-semibold text-sky-700 shadow-sm transition hover:bg-white"
                    >
                      취소
                      {toast.remainingSeconds !== undefined && (
                        <span className="ml-0.5 tabular-nums text-sky-500">
                          {toast.remainingSeconds}초
                        </span>
                      )}
                    </button>
                  )}
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
