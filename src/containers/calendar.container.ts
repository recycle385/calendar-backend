import { CalendarController } from '../controllers/calendar.controller';
import {
  calendarService,
  participantService,
  tokenService,
  userService,
} from './service.container';

export const calendarController = new CalendarController(
  calendarService,
  userService,
  participantService,
  tokenService
);
