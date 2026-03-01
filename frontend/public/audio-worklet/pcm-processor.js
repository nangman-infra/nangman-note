/**
 * PCM Audio Worklet Processor
 * 브라우저 마이크에서 Float32 오디오를 받아 다운샘플링 후
 * Int16 PCM (16-bit LE, mono)으로 변환합니다.
 *
 * 이 파일은 AudioWorklet 컨텍스트에서 실행됩니다 (별도 스레드).
 */

class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._stopped = false;
    this._nativeSampleRate = 48000; // 기본값, init 메시지로 갱신
    this._targetSampleRate = 16000;
    this._resampleRatio = 3; // 48000 / 16000

    // 다운샘플링용 버퍼
    this._inputBuffer = [];
    this._resampleCursor = 0;
    // AWS 권장 청크(50~200ms) 중 100ms로 고정
    this._outputBufferSize = 1600; // 16kHz * 0.1s
    this._outputBuffer = [];

    this.port.onmessage = (event) => {
      if (event.data === 'stop') {
        this._stopped = true;
        if (this._outputBuffer.length > 0) {
          this._flush();
        }
        return;
      }

      if (event.data && event.data.type === 'init') {
        this._nativeSampleRate = event.data.nativeSampleRate || 48000;
        this._targetSampleRate = event.data.targetSampleRate || 16000;
        this._resampleRatio = this._nativeSampleRate / this._targetSampleRate;
        this._outputBufferSize = Math.max(
          320,
          Math.round(this._targetSampleRate * 0.1),
        );
      }
    };
  }

  process(inputs) {
    if (this._stopped) return false;

    const input = inputs[0];
    if (!input || input.length === 0) return true;

    // mono channel (channel 0)
    const channelData = input[0];
    if (!channelData) return true;

    // 다운샘플링: fractional ratio 지원 linear interpolation
    const ratio = this._resampleRatio;
    if (!Number.isFinite(ratio) || ratio <= 0) return true;

    for (let i = 0; i < channelData.length; i++) {
      this._inputBuffer.push(channelData[i]);
    }

    while (this._resampleCursor + 1 < this._inputBuffer.length) {
      const leftIndex = Math.floor(this._resampleCursor);
      const rightIndex = leftIndex + 1;
      const frac = this._resampleCursor - leftIndex;
      const left = this._inputBuffer[leftIndex];
      const right = this._inputBuffer[rightIndex];
      const sample = left + (right - left) * frac;
      this._outputBuffer.push(sample);
      this._resampleCursor += ratio;

      if (this._outputBuffer.length >= this._outputBufferSize) {
        this._flush();
      }
    }

    const consumed = Math.floor(this._resampleCursor);
    if (consumed > 0) {
      this._inputBuffer = this._inputBuffer.slice(consumed);
      this._resampleCursor -= consumed;
    }

    return true;
  }

  _flush() {
    if (this._outputBuffer.length === 0) return;

    const pcmData = this._float32ToInt16(this._outputBuffer);
    this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
    this._outputBuffer = [];
  }

  /**
   * Float32 [-1.0, 1.0] → Int16 [-32768, 32767]
   */
  _float32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  }
}

registerProcessor('pcm-processor', PcmProcessor);
