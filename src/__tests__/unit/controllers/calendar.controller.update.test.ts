import type { Request, Response } from 'express';

import { CalendarController } from '../../../controllers/calendar.controller';
import { ICalendarService } from '../../../services/calendar.service';
import { IParticipantService } from '../../../services/participant.service';
import { ITokenService } from '../../../services/token.service';
import { IUserService } from '../../../services/user.service';

jest.mock('../../../sockets', () => ({ getIO: () => ({ to: () => ({ emit: jest.fn() }) }) }));

it.each(['', null])(
  '설명을 %p 값으로 지우는 요청을 실제 수정으로 처리한다',
  async (description) => {
    const updateCalendar = jest.fn(async () => ({ slug: 'calendar', description }));
    const controller = new CalendarController(
      { updateCalendar } as unknown as ICalendarService,
      { getIdUsingUuid: async () => 1 } as unknown as IUserService,
      {} as IParticipantService,
      {} as ITokenService
    );
    const req = {
      params: { slug: 'calendar' },
      body: { description },
      participantUuid: 'host',
      userRole: 'host',
      userUuid: 'user',
    } as unknown as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;

    await controller.updateCalendar(req, res, jest.fn());

    expect(updateCalendar).toHaveBeenCalledWith(
      'calendar',
      1,
      expect.objectContaining({ description })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        calendar: expect.objectContaining({ description }),
      })
    );
  }
);
