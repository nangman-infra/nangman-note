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
    this._outputBufferSize = 4096; // 다운샘플링 후 이 크기가 되면 전송
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

    // 다운샘플링: ratio만큼 건너뛰기 (linear interpolation)
    const ratio = this._resampleRatio;

    for (let i = 0; i < channelData.length; i++) {
      this._inputBuffer.push(channelData[i]);
    }

    // 충분한 입력이 쌓이면 다운샘플링
    while (this._inputBuffer.length >= ratio) {
      // 간단한 linear 다운샘플링: ratio 간격으로 샘플 추출
      const sample = this._inputBuffer[0];
      this._outputBuffer.push(sample);

      // ratio만큼 건너뛰기 (정수가 아닐 수 있으므로 floor)
      const skip = Math.max(1, Math.floor(ratio));
      this._inputBuffer.splice(0, skip);

      if (this._outputBuffer.length >= this._outputBufferSize) {
        this._flush();
      }
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