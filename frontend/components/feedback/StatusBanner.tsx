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

/* Column banners: soft tint, hairline, state colour carried by icon + rule. */
const variantStyleMap: Record<BannerVariant, string> = {
  error: 'border-[var(--line-soft)] bg-[var(--danger-soft)] text-[var(--ink-strong)] shadow-[inset_3px_0_0_0_var(--danger)] [&_svg]:text-[var(--danger)]',
  success: 'border-[var(--line-soft)] bg-[var(--success-soft)] text-[var(--ink-strong)] shadow-[inset_3px_0_0_0_var(--success)] [&_svg]:text-[var(--success)]',
  info: 'border-[var(--line-soft)] bg-[var(--brand-fixed)] text-[var(--ink-strong)] shadow-[inset_3px_0_0_0_var(--brand)] [&_svg]:text-brand',
  warning: 'border-[var(--line-soft)] bg-[var(--accent-soft)] text-[var(--ink-strong)] shadow-[inset_3px_0_0_0_var(--accent)] [&_svg]:text-[#a4431a]',
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
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={`rounded-lg border px-3.5 py-2.5 text-sm ${variantStyleMap[variant]} ${className || ''}`}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          {title ? <p className="font-medium">{title}</p> : null}
          <p className={title ? 'mt-0.5 text-xs text-[var(--ink-subtle)]' : 'text-xs text-[var(--ink-subtle)]'}>{message}</p>
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
