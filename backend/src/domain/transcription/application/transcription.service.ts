import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeetingService } from '../../meeting/application/meeting.service';
import { TranscriptSegmentEntity } from '../domain/transcript-segment.entity';

@Injectable()
export class TranscriptionService {
  constructor(
    @InjectRepository(TranscriptSegmentEntity)
    private readonly transcriptRepository: Repository<TranscriptSegmentEntity>,
    private readonly meetingService: MeetingService,
  ) {}

  async listByMeetingId(meetingId: string): Promise<TranscriptSegmentEntity[]> {
    await this.meetingService.findById(meetingId);

    return this.transcriptRepository.find({
      where: { meetingId },
      order: { startTime: 'ASC' },
    });
  }

  async createMockSegmentFromAudio(
    meetingId: string,
    payload: unknown,
  ): Promise<TranscriptSegmentEntity> {
    await this.meetingService.findById(meetingId);

    const last = await this.transcriptRepository.findOne({
      where: { meetingId },
      order: { endTime: 'DESC' },
    });

    const now = new Date();
    const startTime = last?.endTime ?? 0;
    const duration = 2.2;
    const size = this.estimatePayloadSize(payload);

    const segment = this.transcriptRepository.create({
      meetingId,
      startTime,
      endTime: Number((startTime + duration).toFixed(1)),
      text: `임시 전사 텍스트 (${now.toLocaleTimeString('ko-KR')}, ${size} bytes)`,
      confidence: 0.82,
    });

    return this.transcriptRepository.save(segment);
  }

  private estimatePayloadSize(payload: unknown): number {
    if (typeof payload === 'string') {
      return Buffer.byteLength(payload);
    }

    if (payload instanceof Uint8Array) {
      return payload.byteLength;
    }

    if (payload instanceof ArrayBuffer) {
      return payload.byteLength;
    }

    return Buffer.byteLength(JSON.stringify(payload ?? {}));
  }
}
