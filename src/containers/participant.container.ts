import { ParticipantController } from '../controllers/participant.controller';
import {
  calendarService,
  participantService,
  tokenService,
  userService,
} from './service.container';

// Controllers
export const participantController = new ParticipantController(
  participantService,
  calendarService,
  userService,
  tokenService
);
