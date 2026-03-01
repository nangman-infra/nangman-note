/**
 * PCM Audio Worklet Processor (AWS Transcribe Streaming 호환)
 *
 * AWS 공식 레퍼런스 구현 기반:
 * https://github.com/aws-samples/sample-dual-audio-transcribe
 *
 * - 다운샘플링 없이 AudioContext의 네이티브 sample rate(보통 48kHz)로 전송
 * - DataView.setInt16 으로 명시적 little-endian PCM 인코딩
 * - outputs에 입력 복사 → destination 연결 유지 (process() 호출 보장)
 * - publishInterval 간격으로 버퍼를 모아 한번에 전송
 */

class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._stopped = false;
    // publishInterval: sampleRate * 0.1 = 100ms 분량
    // AWS 레퍼런스는 sampleRate * 5 (5초)이지만, 실시간 전사는 더 짧은 간격이 필요
    this._publishInterval = Math.round(sampleRate * 0.1);
    this._recordingBuffer = [new Float32Array(0)];
    this._recordedFrames = 0;
    this._framesSinceLastPublish = 0;

    this.port.onmessage = (event) => {
      if (event.data === 'stop') {
        this._stopped = true;
        // 남은 버퍼 플러시
        if (this._recordedFrames > 0) {
          this._publish();
        }
      }
    };
  }

  process(inputs, outputs) {
    if (this._stopped) return false;

    if (!inputs.length || !inputs[0].length) return true;

    const channelData = inputs[0][0]; // mono: input 0, channel 0
    if (!channelData) return true;

    const numSamples = channelData.length;

    // outputs에 입력 복사 → destination 연결이 살아있어야 process()가 계속 호출됨
    if (outputs.length && outputs[0].length && outputs[0][0]) {
      outputs[0][0].set(channelData);
    }

    // 녹음 버퍼에 추가
    const newBuffer = new Float32Array(this._recordedFrames + numSamples);
    newBuffer.set(this._recordingBuffer[0], 0);
    newBuffer.set(channelData, this._recordedFrames);
    this._recordingBuffer[0] = newBuffer;
    this._recordedFrames += numSamples;
    this._framesSinceLastPublish += numSamples;

    // publishInterval 이상 쌓이면 전송
    if (this._framesSinceLastPublish >= this._publishInterval) {
      this._publish();
    }

    return true;
  }

  _publish() {
    if (this._recordedFrames === 0) return;

    // AWS 레퍼런스 pcmEncodeArray 패턴:
    // DataView를 사용해 명시적으로 little-endian Int16 PCM 생성
    const audioData = this._pcmEncode(this._recordingBuffer);

    this.port.postMessage(audioData, [audioData]);

    // 버퍼 리셋
    this._recordingBuffer = [new Float32Array(0)];
    this._recordedFrames = 0;
    this._framesSinceLastPublish = 0;
  }

  /**
   * Float32Array[] → ArrayBuffer (PCM signed 16-bit little-endian)
   * AWS 레퍼런스 pcmEncodeArray 함수와 동일 로직
   */
  _pcmEncode(input) {
    const numChannels = input.length; // 1 (mono)
    const numSamples = input[0].length;
    const bufferLength = numChannels * numSamples * 2; // 2 bytes per sample
    const buffer = new ArrayBuffer(bufferLength);
    const view = new DataView(buffer);

    let index = 0;
    for (let i = 0; i < numSamples; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const s = Math.max(-1, Math.min(1, input[channel][i]));
        view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7fff, true); // true = little-endian
        index += 2;
      }
    }

    return buffer;
  }
}

registerProcessor('pcm-processor', PcmProcessor);