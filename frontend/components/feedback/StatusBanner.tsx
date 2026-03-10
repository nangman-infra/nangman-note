'use client';

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

type BannerVariant = 'error' | 'success' | 'info' | 'warning';

interface StatusBannerProps {
  title?: string;
  message: string;
  variant?: BannerVariant;
  className?: string;
  onDismiss?: () => void;
}

const variantStyleMap: Record<BannerVariant, string> = {
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
};

const variantIconMap = {
  error: XCircle,
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
} as const;

export function StatusBanner({ title, message, variant = 'info', className, onDismiss }: StatusBannerProps) {
  const Icon = variantIconMap[variant];

  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${variantStyleMap[variant]} ${className || ''}`}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          {title ? <p className="font-semibold">{title}</p> : null}
          <p className={title ? 'mt-0.5 text-xs' : 'text-xs'}>{message}</p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-md p-0.5 opacity-60 transition-opacity hover:opacity-100"
            aria-label="배너 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
