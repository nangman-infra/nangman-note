'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * TranscriptAudioVisualizer
 *
 * Live microphone audio level bars for the Live Meeting Room transcript panel.
 *
 * Design spec (stitch-redesign Phase 3, task 3.4):
 * - Lives INSIDE the dark Transcript aside as a bottom bar (`h-16 bg-slate-950`).
 * - Renders a horizontal row of ~24 bars that pulse with frequency data from the
 *   active microphone MediaStream.
 * - Uses an AudioContext + AnalyserNode fed by requestAnimationFrame to update
 *   the bar heights on each frame.
 * - When inactive (not recording / streaming), bars collapse to a flat, low-
 *   opacity resting state.
 * - Respects `prefers-reduced-motion: reduce` by skipping the RAF loop and
 *   showing a static flat row.
 *
 * The component owns every side-effect it creates: it closes the AudioContext
 * and cancels its RAF handle on unmount or whenever the stream changes.
 */
export interface TranscriptAudioVisualizerProps {
  /** Active MediaStream from `useAudioCapture`. Null when the mic is not ready. */
  stream: MediaStream | null;
  /** True while recording or realtime streaming is active. */
  isActive: boolean;
  /** Number of bars to render. Defaults to 24. */
  barCount?: number;
  /** Optional className passthrough. */
  className?: string;
}

const DEFAULT_BAR_COUNT = 24;
const MIN_HEIGHT_PERCENT = 8; // resting floor height for bars when inactive
const MAX_HEIGHT_PERCENT = 92;

/**
 * Read `prefers-reduced-motion: reduce` safely on the client.
 * Returns false during SSR / tests where matchMedia is unavailable.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }
    // Older Safari fallback
    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }, []);

  return reduced;
}

export function TranscriptAudioVisualizer({
  stream,
  isActive,
  barCount = DEFAULT_BAR_COUNT,
  className,
}: TranscriptAudioVisualizerProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const barRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Keep the refs array sized to the current barCount so we don't leak
  // references across barCount prop changes.
  if (barRefs.current.length !== barCount) {
    barRefs.current = new Array<HTMLDivElement | null>(barCount).fill(null);
  }

  useEffect(() => {
    // Bail out when we have no stream, the visualizer is inactive, or the user
    // prefers reduced motion. In all these cases the flat resting bars remain.
    if (!stream || !isActive || prefersReducedMotion) {
      // Reset bars to resting height in case we were previously active.
      for (const bar of barRefs.current) {
        if (bar) bar.style.height = `${MIN_HEIGHT_PERCENT}%`;
      }
      return;
    }

    if (typeof window === 'undefined') return;

    // Prefer the standard AudioContext; fall back to the webkit-prefixed
    // variant so Safari keeps working.
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      return;
    }

    let audioContext: AudioContext;
    let analyser: AnalyserNode;
    let source: MediaStreamAudioSourceNode;
    let dataArray: Uint8Array<ArrayBuffer>;
    let rafId = 0;
    let cancelled = false;

    try {
      audioContext = new AudioCtx();
      source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 64; // 32 frequency bins; we sample `barCount` of them.
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);

      dataArray = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    } catch {
      // If the browser rejects the graph (e.g. already-ended tracks), skip
      // animation — the static resting bars remain visible.
      return;
    }

    const step = () => {
      if (cancelled) return;
      analyser.getByteFrequencyData(dataArray);

      const binCount = dataArray.length;
      const bars = barRefs.current;
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        if (!bar) continue;
        // Map bar index to a frequency bin. Low indices are bass, high are treble.
        const binIndex = Math.min(binCount - 1, Math.floor((i / bars.length) * binCount));
        const amplitude = dataArray[binIndex] / 255; // 0..1
        const heightPct =
          MIN_HEIGHT_PERCENT +
          (MAX_HEIGHT_PERCENT - MIN_HEIGHT_PERCENT) * amplitude;
        bar.style.height = `${heightPct}%`;
      }
      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);

    return () => {
      cancelled = true;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      try {
        source.disconnect();
      } catch {
        // Already disconnected; ignore.
      }
      try {
        analyser.disconnect();
      } catch {
        // Already disconnected; ignore.
      }
      // close() returns a Promise — swallow any rejection so teardown never throws.
      void audioContext.close().catch(() => {
        // Context may already be closed (e.g. tab backgrounded). Ignore.
      });
    };
  }, [stream, isActive, prefersReducedMotion, barCount]);

  return (
    <div
      ref={containerRef}
      role="presentation"
      aria-hidden="true"
      className={`relative flex h-16 items-end justify-center gap-1 bg-slate-950 px-4 py-3 ${
        className ?? ''
      }`}
      data-testid="transcript-audio-visualizer"
      data-active={isActive ? 'true' : 'false'}
    >
      {Array.from({ length: barCount }).map((_, index) => (
        <div
          key={index}
          ref={(el) => {
            barRefs.current[index] = el;
          }}
          className={`w-1 rounded-full transition-opacity duration-300 ${
            isActive ? 'bg-cyan-400 opacity-90' : 'bg-cyan-500/30 opacity-70'
          }`}
          style={{ height: `${MIN_HEIGHT_PERCENT}%` }}
        />
      ))}
    </div>
  );
}
