import { describe, expect, it, jest } from '@jest/globals';

import { ParticipantController } from '../../../controllers/participant.controller';

describe('ParticipantController host authorization', () => {
  it('다른 캘린더의 방장 토큰으로 참가자를 강퇴할 수 없다', async () => {
    const participantService = {
      getParticipantByUuid: jest.fn(async () => ({
        id: 1,
        participant_uuid: 'acting-host',
        calendar_id: 10,
        role: 'host',
      })),
      getParticipantIdByUuid: jest.fn(),
      deleteParticipant: jest.fn(),
    };
    const calendarService = {
      getCalendarBySlug: jest.fn(async () => ({ id: 20, slug: 'target-calendar' })),
    };
    const controller = new ParticipantController(
      participantService as never,
      calendarService as never,
      {} as never,
      {} as never
    );
    const request = {
      params: { slug: 'target-calendar', participantUuid: 'target-participant' },
      participantUuid: 'acting-host',
      userRole: 'host',
      userUuid: 'owner-user',
    };

    await expect(
      controller.deleteParticipantAsHost(request as never, {} as never, jest.fn())
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(participantService.deleteParticipant).not.toHaveBeenCalled();
  });
});
