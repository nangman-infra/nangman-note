import { Injectable, Logger } from '@nestjs/common';
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  AudioStream,
  LanguageCode,
  MediaEncoding,
  PartialResultsStability,
  type StartStreamTranscriptionCommandInput,
} from '@aws-sdk/client-transcribe-streaming';
import { AwsClientFactory } from '../../../shared/aws/aws-client.factory';
import type {
  StreamingTranscriptionProvider,
  StreamingSessionOptions,
  StreamingTranscriptEvent,
} from '../application/ports/streaming-transcription-provider.port';

const DEFAULT_SAMPLE_RATE = 48_000;
// 버퍼 무제한 — 48kHz PCM은 Transcribe HTTP/2보다 빠르지만
// 침묵 구간에서 따라잡으므로 드랍하지 않음 (96KB/s 수준)
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
  /** abort signal */
  abortController: AbortController;
}

/**
 * 오디오 청크를 async iterable로 변환하는 큐.
 * feedAudio()로 push하면 Transcribe SDK의 AudioStream이 소비합니다.
 */
class AudioChunkQueue {
  private queue: Buffer[] = [];
  private resolve: ((value: IteratorResult<Buffer>) => void) | null = null;
  private done = false;

  push(chunk: Buffer): void {
    if (this.done) return;

    if (this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      r({ value: chunk, done: false });
    } else {
      this.queue.push(chunk);
    }
  }

  end(): void {
    this.done = true;
    if (this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      r({ value: undefined as unknown as Buffer, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<Buffer> {
    return {
      next: (): Promise<IteratorResult<Buffer>> => {
        if (this.queue.length > 0) {
          return Promise.resolve({
            value: this.queue.shift()!,
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
export class AwsStreamingTranscriptionProvider implements StreamingTranscriptionProvider {
  private readonly logger = new Logger(AwsStreamingTranscriptionProvider.name);
  private readonly sessions = new Map<string, ActiveSession>();
  private readonly client: TranscribeStreamingClient;

  constructor(private readonly awsClientFactory: AwsClientFactory) {
    this.client = this.awsClientFactory.createTranscribeStreamingClient();
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
      this.logger.warn(
        `Session already exists for meeting ${meetingId}, stopping previous session`,
      );
      await this.stopSession(meetingId);
    }

    const audioQueue = new AudioChunkQueue();
    const abortController = new AbortController();

    const session: ActiveSession = {
      meetingId,
      audioQueue,
      closed: false,
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
      PartialResultsStability: PartialResultsStability.HIGH,
    };

    if (languageCode) {
      // 특정 언어 지정
      commandInput.LanguageCode = languageCode as LanguageCode;
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

    this.logger.log(
      `Starting streaming session for meeting ${meetingId} (lang=${languageCode ?? 'auto'}, rate=${effectiveSampleRate})`,
    );

    // 비동기로 결과 수신 루프 실행
    this.runResultLoop(meetingId, command, onTranscript, onError, onClose);
  }

  feedAudio(meetingId: string, chunk: Buffer): void {
    const session = this.sessions.get(meetingId);
    if (!session || session.closed) return;
    session.audioQueue.push(chunk);
  }

  stopSession(meetingId: string): Promise<void> {
    const session = this.sessions.get(meetingId);
    if (!session) return Promise.resolve();

    this.logger.log(`Stopping streaming session for meeting ${meetingId}`);

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
        this.logger.debug(
          `Sending StartStreamTranscription command for meeting ${meetingId}...`,
        );
        const response = await this.client.send(command);
        this.logger.debug(
          `StartStreamTranscription response received for meeting ${meetingId}, SessionId=${response.SessionId}`,
        );

        if (!response.TranscriptResultStream) {
          throw new Error('No TranscriptResultStream in response');
        }

        this.logger.debug(
          `Entering TranscriptResultStream loop for meeting ${meetingId}...`,
        );
        let eventCount = 0;
        for await (const event of response.TranscriptResultStream) {
          eventCount++;
          if (eventCount <= 3) {
            this.logger.debug(
              `TranscriptResultStream event #${eventCount} for meeting ${meetingId}: ${JSON.stringify(Object.keys(event))}`,
            );
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

              const transcriptEvent: StreamingTranscriptEvent = {
                type: result.IsPartial ? 'partial' : 'final',
                text,
                startTime: result.StartTime ?? 0,
                endTime: result.EndTime ?? 0,
                resultId: result.ResultId ?? '',
                detectedLanguage: result.LanguageCode ?? undefined,
              };

              try {
                onTranscript(transcriptEvent);
              } catch (callbackError) {
                this.logger.warn(
                  `onTranscript callback error for meeting ${meetingId}: ${callbackError}`,
                );
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
          this.logger.debug(
            `Streaming session aborted (normal) for meeting ${meetingId}`,
          );
        } else {
          this.logger.error(
            `Streaming session error for meeting ${meetingId}: ${error}`,
          );
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
          this.sessions.delete(meetingId);
        }

        try {
          onClose();
        } catch {
          // 콜백 에러 무시
        }

        this.logger.log(`Streaming session ended for meeting ${meetingId}`);
      }
    })();
  }
}
