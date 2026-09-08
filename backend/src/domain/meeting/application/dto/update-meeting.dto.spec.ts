import { validate } from 'class-validator';
import { UpdateMeetingDto } from './update-meeting.dto';

describe('UpdateMeetingDto', () => {
  it('rejects titles longer than the database column limit', async () => {
    const dto = new UpdateMeetingDto();
    dto.title = '가'.repeat(256);

    const errors = await validate(dto);

    const titleError = errors.find((error) => error.property === 'title');
    expect(titleError).toBeDefined();
    expect(titleError?.constraints?.maxLength).toBeDefined();
  });
});
