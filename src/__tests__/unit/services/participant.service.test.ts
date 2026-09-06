import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

import { Participant } from '../../../models/Participant';
import { IParticipantRepository } from '../../../repositories/participant.repository';
import { ParticipantService } from '../../../services/participant.service';
import { Errors } from '../../../utils/errors';

// 외부 라이브러리 Mocking
jest.mock('bcrypt');
jest.mock('crypto', () => ({
  randomUUID: jest.fn(),
}));

// Repository Mocking
const mockParticipantRepository: jest.Mocked<IParticipantRepository> = {
  create: jest.fn(),
  findById: jest.fn(),
  findByUuid: jest.fn(),
  existsByUuid: jest.fn(),
  existsByCalendarAndUser: jest.fn(),
  getIdUsingUuid: jest.fn(),
  getUuidUsingId: jest.fn(),
  getParticipantUuidByUserIdAndCalendarId: jest.fn(),
  findUserGuestById: jest.fn(),
  findByCalendarAndNickname: jest.fn(),
  findAllByCalendarId: jest.fn(),
  findAllByCalendarIdWithVotes: jest.fn(),
  nicknameExists: jest.fn(),
  delete: jest.fn(),
};

describe('ParticipantService Unit Test', () => {
  let participantService: ParticipantService;

  beforeEach(() => {
    // 모든 모의 객체의 호출 기록과 반환값 설정을 초기화합니다.
    jest.resetAllMocks();
    mockParticipantRepository.existsByCalendarAndUser.mockResolvedValue(false);
    participantService = new ParticipantService(mockParticipantRepository);
  });

  // =================================================================
  // 1. 참가자 등록 (registerParticipant)
  // =================================================================
  describe('registerParticipant', () => {
    const calendarId = 1;
    const nickname = 'GuestUser';
    const password = 'password123';
    const mockUuid = 'mock-uuid-123';

    beforeEach(() => {
      (randomUUID as jest.Mock).mockReturnValue(mockUuid);
    });

    it('이미 참여한 회원은 다른 닉네임으로도 중복 등록할 수 없다', async () => {
      mockParticipantRepository.existsByCalendarAndUser.mockResolvedValue(true);

      await expect(
        participantService.registerParticipant({
          calendarId,
          userId: 42,
          nickname: '다른 닉네임',
        })
      ).rejects.toThrow('이미 이 캘린더에 참여한 회원입니다');

      expect(mockParticipantRepository.create).not.toHaveBeenCalled();
    });

    it('[성공] Guest 등록 시 닉네임과 해싱된 비밀번호로 생성되어야 한다', async () => {
      const input = { calendarId, nickname, password };
      const hashedPassword = 'hashed_password';

      // Mock 설정
      mockParticipantRepository.nicknameExists.mockResolvedValue(false);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword as never);
      mockParticipantRepository.create.mockResolvedValue({
        id: 1,
        participant_uuid: mockUuid,
        nickname,
        role: 'guest',
      } as Participant);

      // 실행
      const result = await participantService.registerParticipant(input);

      // 검증
      expect(mockParticipantRepository.nicknameExists).toHaveBeenCalledWith({
        calendar_id: calendarId,
        nickname,
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);

      // 수정됨: Service 코드에서 connection 인자를 넘기지 않으므로 expect.anything() 제거
      expect(mockParticipantRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'guest',
          nickname,
          password_hash: hashedPassword,
          participant_uuid: mockUuid,
        })
      );
      expect(result.participantUuid).toBe(mockUuid);
    });

    it('[성공] 로그인한 User가 Guest로 참여 시 userId가 매핑되어야 한다', async () => {
      const userId = 100;
      const input = { calendarId, nickname, userId, role: 'guest' as const };

      mockParticipantRepository.nicknameExists.mockResolvedValue(false);
      mockParticipantRepository.create.mockResolvedValue({
        id: 2,
        participant_uuid: mockUuid,
        user_id: userId,
        nickname,
      } as Participant);

      // 실행
      const result = await participantService.registerParticipant(input);

      // 검증: 비밀번호 해싱은 호출되지 않아야 함
      expect(bcrypt.hash).not.toHaveBeenCalled();

      // 수정됨: Service 코드에서 connection 인자를 넘기지 않으므로 expect.anything() 제거
      expect(mockParticipantRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'guest',
          user_id: userId,
          nickname,
        })
      );
    });

    it('[실패] 캘린더 내 중복된 닉네임 사용 시 Conflict 에러를 던져야 한다', async () => {
      mockParticipantRepository.nicknameExists.mockResolvedValue(true);

      const input = { calendarId, nickname, password };

      await expect(participantService.registerParticipant(input)).rejects.toThrow(
        '이미 사용 중인 닉네임입니다'
      );
    });

    it('[실패] 비밀번호가 너무 짧은 경우 BadRequest 에러를 던져야 한다', async () => {
      // 중요: 이전 테스트의 mockResolvedValue(true)가 영향을 주지 않도록 false로 명시적 설정
      mockParticipantRepository.nicknameExists.mockResolvedValue(false);

      const shortPasswordInput = { calendarId, nickname, password: '123' }; // 4자 미만

      await expect(participantService.registerParticipant(shortPasswordInput)).rejects.toThrow(
        '비밀번호는 최소 4자 이상이어야 합니다'
      );
    });

    it('[실패] 비밀번호가 너무 긴 경우 BadRequest 에러를 던져야 한다', async () => {
      // 중요: 이전 테스트의 영향 방지
      mockParticipantRepository.nicknameExists.mockResolvedValue(false);

      const longPassword = 'a'.repeat(51); // 50자 초과
      const longPasswordInput = { calendarId, nickname, password: longPassword };

      await expect(participantService.registerParticipant(longPasswordInput)).rejects.toThrow(
        '비밀번호는 50자 이하여야 합니다'
      );
    });
  });

  // =================================================================
  // 2. 참가자 로그인 (loginParticipant)
  // =================================================================
  describe('loginParticipant', () => {
    const calendarId = 1;
    const nickname = 'GuestUser';
    const password = 'password123';
    const hashedPassword = 'hashed_password';
    const participant = {
      id: 1,
      participant_uuid: 'uuid-123',
      nickname,
      password_hash: hashedPassword,
      calendar_id: calendarId,
    } as Participant;

    it('[성공] 닉네임과 비밀번호 일치 시 로그인에 성공해야 한다', async () => {
      mockParticipantRepository.findByCalendarAndNickname.mockResolvedValue(participant);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true as never);

      const result = await participantService.loginParticipant(calendarId, nickname, password);

      expect(mockParticipantRepository.findByCalendarAndNickname).toHaveBeenCalledWith(
        calendarId,
        nickname
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result.participant).toEqual(participant);
      expect(result.participantUuid).toBe(participant.participant_uuid);
    });

    it('[실패] 비밀번호 불일치 시 Unauthorized 에러를 던져야 한다', async () => {
      mockParticipantRepository.findByCalendarAndNickname.mockResolvedValue(participant);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false as never); // 불일치

      await expect(
        participantService.loginParticipant(calendarId, nickname, password)
      ).rejects.toThrow('닉네임 또는 비밀번호가 일치하지 않습니다');
    });

    it('[실패] 존재하지 않는 닉네임 조회 시 Unauthorized 에러를 던져야 한다', async () => {
      mockParticipantRepository.findByCalendarAndNickname.mockResolvedValue(null);

      await expect(
        participantService.loginParticipant(calendarId, 'Unknown', password)
      ).rejects.toThrow('닉네임 또는 비밀번호가 일치하지 않습니다');
    });
  });

  // =================================================================
  // 3. 참가자 삭제 (deleteParticipant)
  // =================================================================
  describe('deleteParticipant', () => {
    const calendarId = 1;
    const participantId = 10;
    const participant = {
      id: participantId,
      calendar_id: calendarId,
      nickname: 'TargetUser',
    } as Participant;

    it('[성공] 정상적인 삭제 요청 시 Repository의 delete가 호출되어야 한다', async () => {
      mockParticipantRepository.findById.mockResolvedValue(participant);
      mockParticipantRepository.delete.mockResolvedValue(true);

      await participantService.deleteParticipant(participantId, calendarId);

      expect(mockParticipantRepository.delete).toHaveBeenCalledWith(participantId);
    });

    it('[실패] 요청한 캘린더 ID와 참가자의 캘린더 ID가 다를 경우 Forbidden 에러를 던져야 한다', async () => {
      const otherCalendarId = 999;
      mockParticipantRepository.findById.mockResolvedValue(participant); // participant.calendar_id = 1

      await expect(
        participantService.deleteParticipant(participantId, otherCalendarId)
      ).rejects.toThrow('삭제 권한이 없습니다');

      expect(mockParticipantRepository.delete).not.toHaveBeenCalled();
    });

    it('[실패] 존재하지 않는 참가자 삭제 시 NotFound 에러를 던져야 한다', async () => {
      mockParticipantRepository.findById.mockResolvedValue(null);

      await expect(participantService.deleteParticipant(participantId, calendarId)).rejects.toThrow(
        '참가자를 찾을 수 없습니다'
      );
    });

    it('[실패] DB 삭제 작업 실패 시 Internal 에러를 던져야 한다', async () => {
      mockParticipantRepository.findById.mockResolvedValue(participant);
      mockParticipantRepository.delete.mockResolvedValue(false);

      await expect(participantService.deleteParticipant(participantId, calendarId)).rejects.toThrow(
        '참가자 삭제에 실패했습니다'
      );
    });
  });
});
