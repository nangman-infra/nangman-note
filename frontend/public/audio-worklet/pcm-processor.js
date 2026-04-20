/**
 * PCM Audio Worklet Processor
 *
 * ARTS 참조 + AWS Transcribe Streaming 호환:
 * - 브라우저 기본 sampleRate(보통 48kHz)에서 16kHz로 HQ 다운샘플링
 * - 동적 게인 제어 (노이즈 게이트 + 자동 게인)
 * - DataView.setInt16 으로 명시적 little-endian PCM 인코딩
 * - outputs에 입력 복사 → destination 연결 유지 (process() 호출 보장)
 * - 200ms 청크 단위로 전송 (ARTS 검증 크기)
 */

const TARGET_RATE = 16000;

/**
 * 고품질 안티앨리어싱 다운샘플링 (ARTS 동일)
 */
function downsampleBufferHQ(input, inputRate, targetRate) {
  if (targetRate === inputRate) return input;
  if (targetRate > inputRate) return input; // 업샘플링은 하지 않음

  const ratio = inputRate / targetRate;
  const newLength = Math.round(input.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const center = i * ratio;
    const start = Math.max(0, Math.floor(center - ratio / 2));
    const end = Math.min(input.length - 1, Math.ceil(center + ratio / 2));

    let sum = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      sum += input[j];
      count++;
    }
    result[i] = count > 0 ? sum / count : 0;
  }

  return result;
}

/**
 * 동적 게인 제어 (ARTS 동일)
 */
function applyDynamicGain(input, targetRMS) {
  if (targetRMS === undefined) targetRMS = 0.1;

  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    sum += input[i] * input[i];
  }
  const currentRMS = Math.sqrt(sum / input.length);

  // 노이즈 게이트: -60dB 이하 무시
  if (currentRMS < 0.001) return input;

  // 동적 게인 (최대 8배, 최소 1배)
  const gainFactor = Math.min(8.0, Math.max(1.0, targetRMS / currentRMS));

  const output = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    output[i] = input[i] * gainFactor;
  }
  return output;
}

class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._stopped = false;
    this._inputRate = sampleRate; // 브라우저 기본 (보통 48000)
    // 200ms 분량을 16kHz 기준으로 계산 (ARTS 검증 크기)
    this._chunkSizeSamples = TARGET_RATE * 0.2; // 3200 samples
    this._buffer = [];
    this._bufferLength = 0;

    this.port.onmessage = (event) => {
      if (event.data === 'stop') {
        this._stopped = true;
        if (this._bufferLength > 0) {
          this._flush();
        }
      }
    };
  }

  process(inputs, outputs) {
    if (this._stopped) return false;
    if (!inputs.length || !inputs[0].length) return true;

    const channelData = inputs[0][0];
    if (!channelData) return true;

    // outputs에 입력 복사 → destination 연결 유지
    if (outputs.length && outputs[0].length && outputs[0][0]) {
      outputs[0][0].set(channelData);
    }

    // HQ 다운샘플링: 48kHz → 16kHz (ARTS 동일)
    const downsampled = downsampleBufferHQ(channelData, this._inputRate, TARGET_RATE);

    // 버퍼에 추가
    this._buffer.push(downsampled);
    this._bufferLength += downsampled.length;

    // 청크 크기 이상 쌓이면 전송
    while (this._bufferLength >= this._chunkSizeSamples) {
      this._flush();
    }

    return true;
  }

  _flush() {
    if (this._bufferLength === 0) return;

    // 버퍼 병합
    const merged = new Float32Array(this._bufferLength);
    let offset = 0;
    for (const chunk of this._buffer) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // 청크 크기만큼 잘라서 전송 (나머지는 다음 청크로)
    const chunkSamples = merged.subarray(0, Math.min(this._chunkSizeSamples, merged.length));
    const remaining = merged.length > this._chunkSizeSamples
      ? merged.subarray(this._chunkSizeSamples)
      : null;

    // 동적 게인 적용 (ARTS 동일)
    const gained = applyDynamicGain(chunkSamples);

    // PCM 16-bit little-endian 인코딩
    const pcmBuffer = this._pcmEncode(gained);

    this.port.postMessage(pcmBuffer, [pcmBuffer]);

    // 버퍼 리셋 (남은 데이터 보존)
    this._buffer = remaining ? [remaining] : [];
    this._bufferLength = remaining ? remaining.length : 0;
  }

  /**
   * Float32Array → ArrayBuffer (PCM signed 16-bit little-endian)
   */
  _pcmEncode(input) {
    const numSamples = input.length;
    const buffer = new ArrayBuffer(numSamples * 2);
    const view = new DataView(buffer);

    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return buffer;
  }
}

registerProcessor('pcm-processor', PcmProcessor);
