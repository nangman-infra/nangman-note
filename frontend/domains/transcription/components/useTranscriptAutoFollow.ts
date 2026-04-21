'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const AUTO_FOLLOW_BOTTOM_THRESHOLD_PX = 24;

interface UseTranscriptAutoFollowParams {
  hasTranscriptData: boolean;
  partialText?: string;
  segmentCount: number;
}

export function useTranscriptAutoFollow({
  hasTranscriptData,
  partialText,
  segmentCount,
}: UseTranscriptAutoFollowParams) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [followLive, setFollowLive] = useState(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const isNearBottom = useCallback((element: HTMLDivElement): boolean => {
    const distance =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    return distance < AUTO_FOLLOW_BOTTOM_THRESHOLD_PX;
  }, []);

  const scrollToBottom = useCallback((opts?: { forceFollow?: boolean }) => {
    const element = scrollRef.current;
    if (!element) return;

    element.scrollTop = element.scrollHeight;
    if (opts?.forceFollow) {
      setFollowLive(true);
      setShowJumpToLatest(false);
    }
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const handleScroll = () => {
      const nearBottom = isNearBottom(element);
      setShowJumpToLatest(!nearBottom);
      setFollowLive((prev) => getNextFollowLiveState(prev, nearBottom));
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, [isNearBottom]);

  useEffect(() => {
    if (!followLive) return;
    if (!hasTranscriptData) return;

    requestAnimationFrame(() => {
      scrollToBottom();
    });
  }, [followLive, hasTranscriptData, partialText, scrollToBottom, segmentCount]);

  const toggleFollowLive = () => {
    if (followLive) {
      setFollowLive(false);
      return;
    }
    scrollToBottom({ forceFollow: true });
  };

  return {
    scrollRef,
    followLive,
    showJumpToLatest,
    scrollToBottom,
    toggleFollowLive,
  };
}

function getNextFollowLiveState(
  previousFollowLive: boolean,
  nearBottom: boolean,
): boolean {
  if (nearBottom) return true;
  if (previousFollowLive) return false;
  return previousFollowLive;
}
