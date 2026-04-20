/**
 * TranscriptAudioVisualizer source-level contract tests.
 *
 * The frontend vitest setup runs in a node environment, so we verify the
 * component's structural contract (props, SSR-safety, cleanup, a11y, reduced
 * motion) through source inspection — matching the pattern used by the other
 * tests in this repo (see frontend/__tests__/ux-audit-preservation.test.tsx).
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';

const componentPath = path.resolve(
  __dirname,
  './TranscriptAudioVisualizer.tsx',
);

async function loadSource(): Promise<string> {
  return fs.readFile(componentPath, 'utf-8');
}

describe('TranscriptAudioVisualizer', () => {
  it('is a client component', async () => {
    const source = await loadSource();
    expect(source.startsWith("'use client'")).toBe(true);
  });

  it('declares the required props (stream, isActive)', async () => {
    const source = await loadSource();
    expect(source).toContain('stream: MediaStream | null');
    expect(source).toContain('isActive: boolean');
  });

  it('exports a named TranscriptAudioVisualizer component and props interface', async () => {
    const source = await loadSource();
    expect(source).toMatch(/export\s+function\s+TranscriptAudioVisualizer/);
    expect(source).toMatch(
      /export\s+interface\s+TranscriptAudioVisualizerProps/,
    );
  });

  it('uses AudioContext and AnalyserNode via createAnalyser', async () => {
    const source = await loadSource();
    expect(source).toContain('AudioContext');
    expect(source).toContain('createAnalyser');
    expect(source).toContain('createMediaStreamSource');
  });

  it('drives bar updates with requestAnimationFrame and cancels on cleanup', async () => {
    const source = await loadSource();
    expect(source).toContain('requestAnimationFrame');
    expect(source).toContain('cancelAnimationFrame');
  });

  it('closes the AudioContext during cleanup', async () => {
    const source = await loadSource();
    expect(source).toMatch(/audioContext\.close\s*\(/);
  });

  it('is SSR-safe (guards window access before useEffect runs)', async () => {
    const source = await loadSource();
    // useEffect body must exist and guard window for AudioContext/matchMedia.
    expect(source).toContain('useEffect');
    expect(source).toMatch(/typeof\s+window\s*===\s*['"]undefined['"]/);
  });

  it('respects prefers-reduced-motion', async () => {
    const source = await loadSource();
    expect(source).toContain('prefers-reduced-motion: reduce');
  });

  it('uses the Stitch dark bottom-bar skin (h-16 bg-slate-950)', async () => {
    const source = await loadSource();
    expect(source).toContain('h-16');
    expect(source).toContain('bg-slate-950');
  });

  it('uses cyan accent tones for active / resting bars', async () => {
    const source = await loadSource();
    expect(source).toContain('bg-cyan-400');
    expect(source).toContain('bg-cyan-500/30');
  });

  it('hides the visualizer from assistive tech (decorative element)', async () => {
    const source = await loadSource();
    expect(source).toMatch(/aria-hidden=\{?"?true"?/);
  });
});

describe('TranscriptAudioVisualizer integration with in-progress page', () => {
  it('is imported and rendered inside the transcript aside', async () => {
    const pagePath = path.resolve(
      __dirname,
      '../../../app/meeting/in-progress/page.tsx',
    );
    const source = await fs.readFile(pagePath, 'utf-8');

    expect(source).toContain(
      "import { TranscriptAudioVisualizer } from '@/domains/transcription/components/TranscriptAudioVisualizer'",
    );
    expect(source).toContain('<TranscriptAudioVisualizer');
    // Passed the live stream and a derived isActive flag based on recorder /
    // audio streaming state.
    expect(source).toMatch(/stream=\{\s*stream\s*\}/);
    expect(source).toContain("recorderState === 'recording'");
    expect(source).toContain("audioStreamingState === 'streaming'");
  });
});
