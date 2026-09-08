import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

describe('pcm audio worklet', () => {
  it('preserves resampling phase across 128-sample render blocks', () => {
    const source = readFileSync(
      new URL('../../../public/audio-worklet/pcm-processor.js', import.meta.url),
      'utf8',
    );
    type ProcessorConstructor = new () => {
      port: { postMessage: ReturnType<typeof vi.fn> };
      process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean;
    };
    let ProcessorClass: ProcessorConstructor | null = null;

    class MockAudioWorkletProcessor {
      port = {
        onmessage: null,
        postMessage: vi.fn(),
      };
    }

    runInNewContext(source, {
      AudioWorkletProcessor: MockAudioWorkletProcessor,
      sampleRate: 48_000,
      registerProcessor: (
        name: string,
        processor: NonNullable<typeof ProcessorClass>,
      ) => {
        expect(name).toBe('pcm-processor');
        ProcessorClass = processor;
      },
      Float32Array,
      ArrayBuffer,
      DataView,
      Math,
    });

    expect(ProcessorClass).not.toBeNull();
    const RegisteredProcessor = ProcessorClass as unknown as ProcessorConstructor;
    const processor = new RegisteredProcessor();
    const blockSize = 128;
    const blockCount = 48_000 / blockSize;

    for (let index = 0; index < blockCount; index++) {
      const input = new Float32Array(blockSize).fill(0.05);
      const output = new Float32Array(blockSize);
      expect(processor.process([[input]], [[output]])).toBe(true);
    }

    const postMessageCalls = processor.port.postMessage.mock.calls as Array<
      [ArrayBuffer]
    >;
    const emittedSamples = postMessageCalls.reduce(
      (total: number, [pcmBuffer]: [ArrayBuffer]) =>
        total + pcmBuffer.byteLength / 2,
      0,
    );

    expect(Math.abs(emittedSamples - 16_000)).toBeLessThanOrEqual(1);
  });
});
