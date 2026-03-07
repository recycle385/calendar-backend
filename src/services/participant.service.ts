import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

import {
  CreateParticipantInput,
  Participant,
  ParticipantServiceInput,
  ParticipantWithVotes,
} from '../models/Participant';
import { IParticipantRepository } from '../repositories/participant.repository';
import { Errors } from '../utils/errors';

const SALT_ROUNDS = 10;

export interface IParticipantService {
  registerParticipant(
    input: ParticipantServiceInput
  ): Promise<{ participant: Participant; participantUuid: string }>;
  loginParticipant(
    calendarId: number,
    nickname: string,
    password: string
  ): Promise<{ participant: Participant; participantUuid: string }>;
  loginGuestUserAsParticipant(
    calendarId: number,
    userId: number
  ): Promise<{ participant: Participant; participantUuid: string }>;

  getParticipantById(id: number): Promise<Participant>;
  getParticipantByUuid(uuid: string): Promise<Participant>;
  getParticipantIdByUuid(uuid: string): Promise<number>;
  getParticipantUuidById(id: number): Promise<string>;

  getParticipantUuidByUserIdAndCalendarId(id: number, calendar_id: number): Promise<string>;
  existsParticipantByUuid(uuid: string): Promise<boolean>;

  getParticipantsByCalendarId(calendarId: number): Promise<Participant[]>;
  getParticipantsWithVotes(calendarId: number): Promise<ParticipantWithVotes[]>;

  deleteParticipant(participantId: number, calendarId: number): Promise<void>;
}

export class ParticipantService implements IParticipantService {
  constructor(private participantRepository: IParticipantRepository) {}

  /**
   * 참가자 등록 (닉네임 + 비밀번호)
   */
  async registerParticipant(
    input: ParticipantServiceInput
  ): Promise<{ participant: Participant; participantUuid: string }> {
    // 입력 검증
    if (!input.nickname || input.nickname.trim().length === 0) {
      throw Errors.BadRequest('닉네임은 필수입니다');
    }

    if (input.nickname.trim().length > 20) {
      throw Errors.BadRequest('닉네임은 20자 이하여야 합니다');
    }

    // 닉네임 중복 체크
    const exists = await this.participantRepository.nicknameExists({
      calendar_id: input.calendarId,
      nickname: input.nickname.trim(),
    });

    if (exists) {
      throw Errors.Conflict('이미 사용 중인 닉네임입니다');
    }

    // UUID 생성
    const participantUuid = randomUUID();

    let createInput: CreateParticipantInput;

    if ('userId' in input) {
      if (!input.userId) {
        throw Errors.BadRequest('유효하지 않은 User ID입니다.');
      }
      if (input.role === 'host') {
        createInput = {
          role: 'host',
          calendar_id: input.calendarId,
          participant_uuid: participantUuid,
          nickname: input.nickname.trim(),
          user_id: input.userId,
          color_code: '#FF0000',
        };
      } else {
        createInput = {
          role: 'guest',
          calendar_id: input.calendarId,
          participant_uuid: participantUuid,
          nickname: input.nickname.trim(),
          user_id: input.userId,
          color_code: '#FF0000',
        };
      }
    } else {
      if (!input.password || input.password.length < 4) {
        throw Errors.BadRequest('비밀번호는 최소 4자 이상이어야 합니다');
      }

      if (input.password.length > 50) {
        throw Errors.BadRequest('비밀번호는 50자 이하여야 합니다');
      }

      const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

      createInput = {
        role: 'guest',
        calendar_id: input.calendarId,
        participant_uuid: participantUuid,
        nickname: input.nickname.trim(),
        password_hash: passwordHash, // 필수!
        color_code: '#FF0000',
      };
    }

    // 참가자 생성
    const participant = await this.participantRepository.create(createInput);

    return {
      participant,
      participantUuid: participantUuid, // UUID를 토큰으로 사용
    };
  }

  /**
   * 참가자 로그인 (비밀번호 검증)
   */
  async loginParticipant(
    calendarId: number,
    nickname: string,
    password: string
  ): Promise<{ participant: Participant; participantUuid: string }> {
    // 참가자 조회
    const participant = await this.participantRepository.findByCalendarAndNickname(
      calendarId,
      nickname.trim()
    );

    if (!participant || !participant.password_hash) {
      throw Errors.Unauthorized('닉네임 또는 비밀번호가 일치하지 않습니다');
    }

    // 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(password, participant.password_hash);

    if (!isPasswordValid) {
      throw Errors.Unauthorized('닉네임 또는 비밀번호가 일치하지 않습니다');
    }

    return {
      participant,
      participantUuid: participant.participant_uuid,
    };
  }

  async loginGuestUserAsParticipant(
    calendarId: number,
    userId: number
  ): Promise<{ participant: Participant; participantUuid: string }> {
    const participant = await this.participantRepository.findUserGuestById(calendarId, userId);

    if (!participant) {
      throw Errors.NotFound('등록되지 않은 참가자. 등록 필요');
    }

    return {
      participant,
      participantUuid: participant.participant_uuid,
    };
  }

  /**
   * ID로 참가자 조회
   */
  async getParticipantById(id: number): Promise<Participant> {
    const participant = await this.participantRepository.findById(id);

    if (!participant) {
      throw Errors.NotFound('참가자를 찾을 수 없습니다');
    }

    return participant;
  }

  /**
   * UUID로 참가자 조회
   */
  async getParticipantByUuid(uuid: string): Promise<Participant> {
    const participant = await this.participantRepository.findByUuid(uuid);

    if (!participant) {
      throw Errors.NotFound('참가자를 찾을 수 없습니다');
    }

    return participant;
  }

  async getParticipantIdByUuid(uuid: string): Promise<number> {
    return await this.participantRepository.getIdUsingUuid(uuid);
  }

  async getParticipantUuidById(id: number): Promise<string> {
    return await this.participantRepository.getUuidUsingId(id);
  }

  async existsParticipantByUuid(uuid: string): Promise<boolean> {
    return await this.participantRepository.existsByUuid(uuid);
  }

  async getParticipantUuidByUserIdAndCalendarId(id: number, calendar_id: number): Promise<string> {
    return await this.participantRepository.getParticipantUuidByUserIdAndCalendarId(
      id,
      calendar_id
    );
  }
  /**
   * 캘린더의 모든 참가자 조회
   */
  async getParticipantsByCalendarId(calendarId: number): Promise<Participant[]> {
    return await this.participantRepository.findAllByCalendarId(calendarId);
  }

  /**
   * 캘린더의 모든 참가자 조회 (투표 현황 포함)
   */
  async getParticipantsWithVotes(calendarId: number): Promise<ParticipantWithVotes[]> {
    return await this.participantRepository.findAllByCalendarIdWithVotes(calendarId);
  }

  /**
   * 참가자 삭제 (본인만 가능, 비밀번호 확인)
   */
  async deleteParticipant(participantId: number, calendarId: number): Promise<void> {
    const participant = await this.getParticipantById(participantId);

    // 캘린더 일치 확인
    if (participant.calendar_id !== calendarId) {
      throw Errors.Forbidden('삭제 권한이 없습니다');
    }

    const deleted = await this.participantRepository.delete(participantId);

    if (!deleted) {
      throw Errors.Internal('참가자 삭제에 실패했습니다');
    }
  }
}
