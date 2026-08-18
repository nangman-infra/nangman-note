import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  AudioStream,
  LanguageCode,
  MediaEncoding,
  PartialResultsStability,
  type StartStreamTranscriptionCommandInput,
} from '@aws-sdk/client-transcribe-streaming';
import { AppEnv } from '../../../shared/config/env.validation';
import { AwsClientFactory } from '../../../shared/aws/aws-client.factory';
import type {
  StreamingTranscriptionProvider,
  StreamingSessionOptions,
  StreamingTranscriptEvent,
} from '../application/ports/streaming-transcription-provider.port';
import { StructuredLogger } from '../../../shared/logging/structured-logger';

const DEFAULT_SAMPLE_RATE = 16_000;
const DEFAULT_MAX_BUFFERED_AUDIO_BYTES = 8 * 1024 * 1024; // 8MB
const DEFAULT_LANGUAGE_OPTIONS = [
  'ko-KR',
  'en-US',
  'ja-JP',
  'zh-CN',
  'de-DE',
  'fr-FR',
  'es-ES',
];

interface ActiveSession {
  meetingId: string;
  /** 오디오 청크를 push하면 Transcribe AudioStream이 consume */
  audioQueue: AudioChunkQueue;
  /** 세션 정리 완료 플래그 */
  closed: boolean;
  /** Transcribe 스트림 핸드셰이크 완료 여부 */
  ready: boolean;
  /** abort signal */
  abortController: AbortController;
}

/**
 * 오디오 청크를 async iterable로 변환하는 큐.
 * feedAudio()로 push하면 Transcribe SDK의 AudioStream이 소비합니다.
 */
class AudioChunkQueue {
  private queue: Buffer[] = [];
  private bufferedBytes = 0;
  private resolve: ((value: IteratorResult<Buffer>) => void) | null = null;
  private done = false;

  private fullRejectCount = 0; // 버퍼 초과로 거부된 횟수

  constructor(private readonly maxBufferedBytes: number) {}

  push(chunk: Buffer): boolean {
    if (this.done) return false;

    if (chunk.length <= 0 || chunk.length > this.maxBufferedBytes) {
      return false;
    }

    if (this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      r({ value: chunk, done: false });
      return true;
    }

    if (this.bufferedBytes + chunk.length > this.maxBufferedBytes) {
      this.fullRejectCount++;
      return false;
    }

    this.queue.push(chunk);
    this.bufferedBytes += chunk.length;
    return true;
  }

  end(): void {
    this.done = true;
    if (this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      r({ value: undefined as unknown as Buffer, done: true });
    }
  }

  /** 버퍼 초과 거부 횟수 */
  getFullRejectCount(): number {
    return this.fullRejectCount;
  }

  [Symbol.asyncIterator](): AsyncIterator<Buffer> {
    return {
      next: (): Promise<IteratorResult<Buffer>> => {
        if (this.queue.length > 0) {
          const value = this.queue.shift()!;
          this.bufferedBytes = Math.max(0, this.bufferedBytes - value.length);
          return Promise.resolve({
            value,
            done: false,
          });
        }
        if (this.done) {
          return Promise.resolve({
            value: undefined as unknown as Buffer,
            done: true,
          });
        }
        return new Promise<IteratorResult<Buffer>>((resolve) => {
          this.resolve = resolve;
        });
      },
    };
  }
}

@Injectable()
export class AwsStreamingTranscriptionProvider
  implements StreamingTranscriptionProvider, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new StructuredLogger(
    AwsStreamingTranscriptionProvider.name,
  );
  private readonly sessions = new Map<string, ActiveSession>();
  private readonly client: TranscribeStreamingClient;
  private readonly maxBufferedAudioBytes: number;
  private readonly vocabularyName: string | undefined;

  constructor(
    private readonly awsClientFactory: AwsClientFactory,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {
    this.client = this.awsClientFactory.createTranscribeStreamingClient();
    this.maxBufferedAudioBytes = Math.max(
      64 * 1024,
      this.configService.get('REALTIME_MAX_BUFFERED_AUDIO_BYTES', {
        infer: true,
      }) || DEFAULT_MAX_BUFFERED_AUDIO_BYTES,
    );
    // 커스텀 어휘 (전문용어 사전) — 설정된 경우에만 전달
    const vocabulary = this.configService.get(
      'AWS_TRANSCRIBE_VOCABULARY_NAME',
      {
        infer: true,
      },
    );
    this.vocabularyName = vocabulary?.trim() || undefined;
  }

  onModuleInit(): void {
    void this.awsClientFactory.warmCredentials().catch((error: unknown) => {
      this.logger.warn('transcription.streaming.credentials_warm_failed', {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    const activeMeetingIds = [...this.sessions.keys()];
    await Promise.all(
      activeMeetingIds.map((meetingId) => this.stopSession(meetingId)),
    );
    this.client.destroy();
  }

  async startSession(options: StreamingSessionOptions): Promise<void> {
    const {
      meetingId,
      languageCode,
      languageOptions,
      sampleRate,
      onTranscript,
      onError,
      onClose,
    } = options;

    if (this.sessions.has(meetingId)) {
      this.logger.warn('transcription.streaming.session.replaced', {
        meetingId,
      });
      await this.stopSession(meetingId);
    }

    const audioQueue = new AudioChunkQueue(this.maxBufferedAudioBytes);
    const abortController = new AbortController();

    const session: ActiveSession = {
      meetingId,
      audioQueue,
      closed: false,
      ready: false,
      abortController,
    };
    this.sessions.set(meetingId, session);

    const effectiveSampleRate = sampleRate ?? DEFAULT_SAMPLE_RATE;

    // AudioStream async generator → Transcribe SDK 형식으로 변환
    const audioStream = this.createAudioStream(audioQueue);

    // StartStreamTranscription 파라미터 구성
    const commandInput: StartStreamTranscriptionCommandInput = {
      MediaEncoding: MediaEncoding.PCM,
      MediaSampleRateHertz: effectiveSampleRate,
      AudioStream: audioStream,
      EnablePartialResultsStabilization: true,
      PartialResultsStability: PartialResultsStability.LOW,
    };

    if (languageCode) {
      // 특정 언어 지정 — ShowSpeakerLabel은 LanguageCode 모드에서만 사용 가능
      commandInput.LanguageCode = languageCode as LanguageCode;
      commandInput.ShowSpeakerLabel = true;
      // 커스텀 어휘는 언어 지정 모드에서만 지원
      if (this.vocabularyName) {
        commandInput.VocabularyName = this.vocabularyName;
      }
    } else {
      // 자동 언어 감지
      commandInput.IdentifyLanguage = true;
      const candidates =
        languageOptions && languageOptions.length > 0
          ? languageOptions
          : DEFAULT_LANGUAGE_OPTIONS;
      commandInput.LanguageOptions = candidates.join(',');
    }

    const command = new StartStreamTranscriptionCommand(commandInput);

    this.logger.log('transcription.streaming.session.starting', {
      meetingId,
      languageCode: languageCode ?? 'auto',
      sampleRate: effectiveSampleRate,
    });

    // 비동기로 결과 수신 루프 실행 (세션 객체를 넘겨 identity 기반으로 정리)
    this.runResultLoop(session, command, onTranscript, onError, onClose);
  }

  feedAudio(meetingId: string, chunk: Buffer): boolean {
    const session = this.sessions.get(meetingId);
    if (!session || session.closed) return false;
    return session.audioQueue.push(chunk);
  }

  stopSession(meetingId: string): Promise<void> {
    const session = this.sessions.get(meetingId);
    if (!session || session.closed) return Promise.resolve();

    this.logger.log('transcription.streaming.session.stopping', {
      meetingId,
    });

    session.closed = true;
    // 오디오 큐를 닫아 AWS가 잔여 오디오에 대한 마지막 final을 반환하도록 한다.
    // 즉시 abort하면 사용자의 마지막 발화가 회의록에서 유실된다.
    session.audioQueue.end();

    // 드레인이 hang되지 않도록 일정 시간 후 강제 abort (안전망)
    const forceAbortTimer = setTimeout(() => {
      if (!session.abortController.signal.aborted) {
        this.logger.warn('transcription.streaming.session.force_aborted', {
          meetingId,
        });
        session.abortController.abort();
      }
    }, 5_000);
    forceAbortTimer.unref?.();

    return Promise.resolve();
  }

  hasActiveSession(meetingId: string): boolean {
    const session = this.sessions.get(meetingId);
    return !!session && !session.closed;
  }

  isSessionReady(meetingId: string): boolean {
    const session = this.sessions.get(meetingId);
    return !!session && !session.closed && session.ready;
  }

  getActiveSessionCount(): number {
    // 드레인 중(closed) 세션도 최대 5초간 실제 AWS 스트림을 점유하므로
    // 용량 계산에 포함한다 (한도 초과 → LimitExceededException 연쇄 방지)
    return this.sessions.size;
  }

  /**
   * AsyncIterable<AudioStream> 생성
   * AudioChunkQueue에서 PCM Buffer를 받아 Transcribe AudioStream 이벤트로 변환
   */
  private async *createAudioStream(
    queue: AudioChunkQueue,
  ): AsyncIterable<AudioStream> {
    for await (const chunk of queue) {
      yield { AudioEvent: { AudioChunk: chunk } };
    }
  }

  /**
   * Transcribe Streaming 결과 수신 루프 (비동기 실행)
   *
   * 세션 객체 identity를 기준으로 수명을 관리합니다.
   * meetingId만으로 판별하면 세션 교체(replace) 시 구 루프가 신 세션을
   * 파괴하거나(finally), 구 루프가 계속 살아서 이벤트를 emit하는 버그가
   * 발생합니다.
   */
  private runResultLoop(
    session: ActiveSession,
    command: StartStreamTranscriptionCommand,
    onTranscript: (event: StreamingTranscriptEvent) => void,
    onError: (error: Error) => void,
    onClose: () => void,
  ): void {
    const meetingId = session.meetingId;
    void (async () => {
      try {
        this.logger.debug('transcription.streaming.command.sending', {
          meetingId,
        });
        // abortSignal을 실제로 연결 — 연결하지 않으면 stopSession의 abort()가
        // 아무 효과 없는 dead code가 되어 hang된 스트림을 끊을 수 없다.
        const response = await this.client.send(command, {
          abortSignal: session.abortController.signal,
        });
        if (this.sessions.get(meetingId) === session) {
          session.ready = true;
        }
        this.logger.debug('transcription.streaming.command.accepted', {
          meetingId,
          providerSessionId: response.SessionId,
        });

        if (!response.TranscriptResultStream) {
          throw new Error('No TranscriptResultStream in response');
        }

        this.logger.debug('transcription.streaming.loop.started', {
          meetingId,
        });
        let eventCount = 0;
        for await (const event of response.TranscriptResultStream) {
          eventCount++;
          if (eventCount <= 3) {
            this.logger.debug('transcription.streaming.loop.event_received', {
              meetingId,
              eventCount,
              keys: Object.keys(event),
            });
          }
          // 이 세션이 다른 세션으로 교체되었으면 루프 탈출.
          // (closed 상태여도 map에 남아있는 동안은 잔여 final을 드레인한다)
          if (this.sessions.get(meetingId) !== session) break;

          if (event.TranscriptEvent?.Transcript?.Results) {
            for (const result of event.TranscriptEvent.Transcript.Results) {
              if (!result.Alternatives || result.Alternatives.length === 0) {
                continue;
              }

              const alt = result.Alternatives[0];
              const text = alt.Transcript ?? '';
              if (!text.trim()) continue;

              // Speaker Diarization: Items에서 최다 화자 라벨 추출
              const items = alt.Items ?? [];
              const speakerCounts = new Map<string, number>();
              for (const item of items) {
                const spk = (item as Record<string, unknown>).Speaker as
                  | string
                  | undefined;
                if (spk) {
                  speakerCounts.set(spk, (speakerCounts.get(spk) ?? 0) + 1);
                }
              }
              let speakerLabel: string | undefined;
              if (speakerCounts.size > 0) {
                let maxCount = 0;
                for (const [label, count] of speakerCounts) {
                  if (count > maxCount) {
                    maxCount = count;
                    speakerLabel = label;
                  }
                }
              }

              // 단어별 confidence 평균 (스트리밍 이벤트의 실제 신뢰도 전파)
              let confidenceSum = 0;
              let confidenceCount = 0;
              for (const item of items) {
                const itemConfidence = (item as Record<string, unknown>)
                  .Confidence as number | undefined;
                if (typeof itemConfidence === 'number') {
                  confidenceSum += itemConfidence;
                  confidenceCount += 1;
                }
              }
              const confidence =
                confidenceCount > 0
                  ? confidenceSum / confidenceCount
                  : undefined;

              const transcriptEvent: StreamingTranscriptEvent = {
                type: result.IsPartial ? 'partial' : 'final',
                text,
                startTime: result.StartTime ?? 0,
                endTime: result.EndTime ?? 0,
                // ResultId 누락 시 빈 문자열이면 프론트 중복 제거가
                // 모든 final을 중복으로 오인하므로 고유 폴백 ID를 생성
                resultId:
                  result.ResultId ??
                  `${meetingId}-${result.StartTime ?? 0}-${result.EndTime ?? 0}`,
                confidence,
                detectedLanguage: result.LanguageCode ?? undefined,
                speakerLabel,
              };

              try {
                onTranscript(transcriptEvent);
              } catch (callbackError) {
                this.logger.warn('transcription.streaming.callback_failed', {
                  meetingId,
                  errorMessage:
                    callbackError instanceof Error
                      ? callbackError.message
                      : String(callbackError),
                });
              }
            }
          }
        }
      } catch (error) {
        // AbortError는 정상 종료 (stopSession 호출)
        if (
          error instanceof Error &&
          (error.name === 'AbortError' || error.message.includes('aborted'))
        ) {
          this.logger.debug('transcription.streaming.session.aborted', {
            meetingId,
          });
        } else {
          this.logger.error('transcription.streaming.session.failed', error, {
            meetingId,
          });
          try {
            onError(error instanceof Error ? error : new Error(String(error)));
          } catch {
            // 콜백 에러 무시
          }
        }
      } finally {
        // 세션 정리 — identity가 일치할 때만 map에서 제거한다.
        // (교체된 신 세션을 구 루프가 삭제하는 버그 방지)
        session.closed = true;
        session.ready = false;
        if (this.sessions.get(meetingId) === session) {
          this.sessions.delete(meetingId);
        }

        try {
          onClose();
        } catch {
          // 콜백 에러 무시
        }

        this.logger.log('transcription.streaming.session.ended', {
          meetingId,
        });
      }
    })();
  }
}
