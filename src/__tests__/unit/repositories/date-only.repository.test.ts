import { DateOptionRepository } from '../../../repositories/dateOption.repository';
import { VoteRepository } from '../../../repositories/vote.repository';

describe('DATE 컬럼 문자열 매핑', () => {
  it('DateOptionRepository는 date_value를 YYYY-MM-DD 문자열로 반환해야 한다', async () => {
    const mockPool = {
      execute: jest.fn().mockResolvedValue([
        [
          {
            id: 10,
            calendar_id: 1,
            date_value: '2026-06-08',
            is_enabled: 1,
            created_at: '2026-06-01 00:00:00',
          },
        ],
      ]),
    };
    const repository = new DateOptionRepository(mockPool as any);

    const option = await repository.findById(10);

    expect(option?.date_value).toBe('2026-06-08');
  });

  it('VoteRepository는 투표 현황 date_value를 YYYY-MM-DD 문자열로 반환해야 한다', async () => {
    const mockPool = {
      execute: jest.fn().mockResolvedValue([
        [
          {
            date_option_id: 10,
            date_value: '2026-06-08',
            is_enabled: 1,
            participant_id: null,
            participant_nickname: null,
            participant_color: null,
            vote_type: null,
          },
        ],
      ]),
    };
    const repository = new VoteRepository(mockPool as any);

    const status = await repository.getDateVoteStatus(1);

    expect(status[0].date_value).toBe('2026-06-08');
  });
});
