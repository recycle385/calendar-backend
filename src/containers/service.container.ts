// service.container.ts
import { AuthService } from '../services/auth.service';
import { CalendarService } from '../services/calendar.service';
import { DateInfoService } from '../services/dateInfo.service';
import { ParticipantService } from '../services/participant.service';
import { TokenService } from '../services/token.service';
import { UserService } from '../services/user.service';
import { VoteService } from '../services/vote.service';
import {
  calendarRepository,
  dateInfoRepository,
  dateOptionRepository,
  participantRepository,
  redisBlacklistRepository,
  userRepository,
  voteRepository,
} from './repository.container';

export const userService = new UserService(userRepository);
export const tokenService = new TokenService(redisBlacklistRepository);
export const participantService = new ParticipantService(participantRepository);

export const authService = new AuthService(userRepository, tokenService);
export const dateInfoService = new DateInfoService(dateInfoRepository);

export const calendarService = new CalendarService(
  calendarRepository,
  participantRepository,
  dateOptionRepository
);

export const voteService = new VoteService(voteRepository, dateOptionRepository);
