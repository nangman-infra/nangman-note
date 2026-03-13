import { Injectable, OnModuleInit } from '@nestjs/common';
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

const DEFAULT_SAMPLE_RATE = 48_000;
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
  implements StreamingTranscriptionProvider, OnModuleInit
{
  private readonly logger = new StructuredLogger(
    AwsStreamingTranscriptionProvider.name,
  );
  private readonly sessions = new Map<string, ActiveSession>();
  private readonly client: TranscribeStreamingClient;
  private readonly maxBufferedAudioBytes: number;

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
  }

  onModuleInit(): void {
    void this.awsClientFactory.warmCredentials().catch((error: unknown) => {
      this.logger.warn('transcription.streaming.credentials_warm_failed', {
        errorMessage:
          error instanceof Error ? error.message : String(error),
      });
    });
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

    // 비동기로 결과 수신 루프 실행
    this.runResultLoop(meetingId, command, onTranscript, onError, onClose);
  }

  feedAudio(meetingId: string, chunk: Buffer): boolean {
    const session = this.sessions.get(meetingId);
    if (!session || session.closed) return false;
    return session.audioQueue.push(chunk);
  }

  stopSession(meetingId: string): Promise<void> {
    const session = this.sessions.get(meetingId);
    if (!session) return Promise.resolve();

    this.logger.log('transcription.streaming.session.stopping', {
      meetingId,
    });

    session.closed = true;
    session.audioQueue.end();
    session.abortController.abort();
    this.sessions.delete(meetingId);
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
   */
  private runResultLoop(
    meetingId: string,
    command: StartStreamTranscriptionCommand,
    onTranscript: (event: StreamingTranscriptEvent) => void,
    onError: (error: Error) => void,
    onClose: () => void,
  ): void {
    void (async () => {
      try {
        this.logger.debug('transcription.streaming.command.sending', {
          meetingId,
        });
        const response = await this.client.send(command);
        const activeSession = this.sessions.get(meetingId);
        if (activeSession) {
          activeSession.ready = true;
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
          // 세션이 이미 종료되었으면 루프 탈출
          if (!this.sessions.has(meetingId)) break;

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

              const transcriptEvent: StreamingTranscriptEvent = {
                type: result.IsPartial ? 'partial' : 'final',
                text,
                startTime: result.StartTime ?? 0,
                endTime: result.EndTime ?? 0,
                resultId: result.ResultId ?? '',
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
        // 세션 정리
        const session = this.sessions.get(meetingId);
        if (session) {
          session.closed = true;
          session.ready = false;
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
