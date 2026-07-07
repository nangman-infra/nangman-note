'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { StatusBanner } from '@/components/feedback/StatusBanner';
import type { InProgressBannerItem } from './meetingStatusView';

interface InProgressBannersProps {
  banners: InProgressBannerItem[];
}

export function InProgressBanners({ banners }: InProgressBannersProps) {
  const [showExtraBanners, setShowExtraBanners] = useState(false);

  if (banners.length === 0) return null;

  const [primary, ...rest] = banners;

  return (
    <div className="px-6 py-2 space-y-2">
      <StatusBanner
        variant={primary.variant}
        title={primary.title}
        message={primary.message}
        onDismiss={primary.onDismiss}
      />
      {rest.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowExtraBanners((value) => !value)}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            {showExtraBanners ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {rest.length}개 추가 알림
          </button>
          {showExtraBanners &&
            rest.map((banner, index) => (
              <StatusBanner
                key={index}
                variant={banner.variant}
                title={banner.title}
                message={banner.message}
                onDismiss={banner.onDismiss}
              />
            ))}
        </>
      )}
    </div>
  );
}
