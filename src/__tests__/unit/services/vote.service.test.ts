import { DateOption } from '../../../models/DateOption';
import { DateVoteStatus } from '../../../models/Vote';
import { IDateOptionRepository } from '../../../repositories/dateOption.repository';
import { IVoteRepository } from '../../../repositories/vote.repository';
import { VoteService } from '../../../services/vote.service';
import { Errors } from '../../../utils/errors';

// TransactionManager Mocking
jest.mock('../../../infrastructure/transaction.manager', () => ({
  TransactionManager: {
    run: jest.fn((callback) => callback({})), // 콜백 즉시 실행, connection 객체는 빈 객체로 전달
  },
}));

// Dependencies Mocking
const mockVoteRepository: jest.Mocked<IVoteRepository> = {
  upsertVote: jest.fn(),
  upsertVotes: jest.fn(),
  findByParticipantAndDateOption: jest.fn(),
  findAllByParticipant: jest.fn(),
  findAllByCalendar: jest.fn(),
  delete: jest.fn(),
  deleteAllByParticipant: jest.fn(),
  getDateVoteStatus: jest.fn(),
};

const mockDateOptionRepository: jest.Mocked<IDateOptionRepository> = {
  create: jest.fn(),
  createBatch: jest.fn(),
  findById: jest.fn(),
  findOptionsByIds: jest.fn(),
  findByCalendarId: jest.fn(),
  findDateOptionsByCalendarAndDate: jest.fn(),
  findByCalendarAndDate: jest.fn(),
  delete: jest.fn(),
  deleteByCalendarId: jest.fn(),
};

describe('VoteService Unit Test', () => {
  let voteService: VoteService;

  beforeEach(() => {
    jest.clearAllMocks();
    voteService = new VoteService(mockVoteRepository, mockDateOptionRepository);
  });

  // =================================================================
  // 1. 투표 제출 (submitVotes)
  // =================================================================
  describe('submitVotes', () => {
    const participantId = 1;
    const calendarId = 100;
    const selectedDates = ['2025-01-01', '2025-01-02'];
    const voteType = 'available';

    it('[성공] 유효한 날짜들에 대해 투표(Available)가 정상적으로 저장되어야 한다', async () => {
      // Mock: 날짜 옵션 조회 성공 (활성화된 날짜)
      mockDateOptionRepository.findByCalendarAndDate
        .mockResolvedValueOnce({ id: 10, is_enabled: true } as DateOption) // 2025-01-01
        .mockResolvedValueOnce({ id: 11, is_enabled: true } as DateOption); // 2025-01-02

      // Mock: 투표 일괄 저장 성공 (영향받은 행 수 반환)
      mockVoteRepository.upsertVotes.mockResolvedValue(2);

      // 실행
      const result = await voteService.submitVotes(
        participantId,
        calendarId,
        selectedDates,
        voteType
      );

      // 검증
      expect(mockDateOptionRepository.findByCalendarAndDate).toHaveBeenCalledTimes(2);
      expect(mockVoteRepository.upsertVotes).toHaveBeenCalledWith(
        participantId,
        [10, 11], // 조회된 dateOptionId 목록
        voteType,
        expect.anything() // connection
      );
      expect(result).toBe(2);
    });

    it('[로직] 기존 투표 내역 삭제 후 재생성(Upsert) 확인 - upsertVotes 호출 검증', async () => {
      // *참고: 실제 삭제 후 생성 로직은 Repository 내부에 구현되어 있으므로,
      // Service 테스트에서는 Service가 Repository의 올바른 메서드(upsertVotes)를 호출하는지 검증합니다.

      mockDateOptionRepository.findByCalendarAndDate.mockResolvedValue({
        id: 10,
        is_enabled: true,
      } as DateOption);
      mockVoteRepository.upsertVotes.mockResolvedValue(1);

      await voteService.submitVotes(participantId, calendarId, ['2025-01-01'], 'maybe');

      // upsertVotes 메서드가 호출되었는지 확인
      expect(mockVoteRepository.upsertVotes).toHaveBeenCalled();
    });

    it('[실패] 캘린더 범위 밖의 날짜(존재하지 않는 날짜 옵션)에 투표 시도 시 BadRequest', async () => {
      // Mock: 날짜 옵션 조회 실패 (null 반환)
      mockDateOptionRepository.findByCalendarAndDate.mockResolvedValue(null);

      await expect(
        voteService.submitVotes(participantId, calendarId, ['2099-12-31'])
      ).rejects.toThrow('유효하지 않은 날짜입니다');
    });

    it('[실패] 비활성화된 날짜 옵션에 투표 시도 시 BadRequest', async () => {
      // Mock: 날짜 옵션 조회 성공했으나 비활성화됨
      mockDateOptionRepository.findByCalendarAndDate.mockResolvedValue({
        id: 99,
        is_enabled: false,
      } as DateOption);

      await expect(
        voteService.submitVotes(participantId, calendarId, ['2025-01-01'])
      ).rejects.toThrow('비활성화된 날짜입니다');
    });

    it('[실패] 선택된 날짜가 비어있는 경우 BadRequest', async () => {
      await expect(voteService.submitVotes(participantId, calendarId, [])).rejects.toThrow(
        '최소 하나 이상의 날짜를 선택해야 합니다'
      );
    });
  });

  // =================================================================
  // 2. 투표 현황 조회 (getVoteStatusByCalendar)
  // =================================================================
  describe('getVoteStatusByCalendar', () => {
    const calendarId = 100;

    it('[성공] getVoteStatusByCalendar 호출 시 날짜별 투표 현황 데이터를 반환해야 한다', async () => {
      const mockVoteStatus: DateVoteStatus[] = [
        {
          date_option_id: 10,
          date_value: '2025-01-01',
          is_enabled: true,
          votes: [
            {
              participant_id: 1,
              participant_nickname: 'User1',
              participant_color: '#FF0000',
              vote_type: 'available',
            },
          ],
        },
      ];

      // Mock 설정
      mockVoteRepository.getDateVoteStatus.mockResolvedValue(mockVoteStatus);

      // 실행
      const result = await voteService.getVoteStatusByCalendar(calendarId);

      // 검증
      expect(mockVoteRepository.getDateVoteStatus).toHaveBeenCalledWith(calendarId);
      expect(result).toEqual(mockVoteStatus);
      expect(result[0].votes).toHaveLength(1);
      expect(result[0].votes[0].participant_nickname).toBe('User1');
    });
  });
});
