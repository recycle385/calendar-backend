// service.container.ts
import { AuthService } from '../services/auth.service';
import { CalendarService } from '../services/calendar.service';
import { ParticipantService } from '../services/participant.service';
import { TokenService } from '../services/token.service';
import { UserService } from '../services/user.service';
import { VoteService } from '../services/vote.service';
import {
  calendarRepository,
  dateOptionRepository,
  participantRepository,
  redisBlacklistRepository,
  userRepository,
  voteRepository,
} from './repository.container';

// 1. 의존성이 적은 서비스부터 순서대로 생성
export const userService = new UserService(userRepository);
export const tokenService = new TokenService(redisBlacklistRepository);
export const participantService = new ParticipantService(participantRepository);

// 2. 다른 서비스나 리포지토리를 사용하는 서비스 생성
export const authService = new AuthService(userRepository, tokenService);

export const calendarService = new CalendarService(
  calendarRepository,
  participantRepository,
  dateOptionRepository
);

export const voteService = new VoteService(voteRepository, dateOptionRepository);
