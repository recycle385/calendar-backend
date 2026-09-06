import pool from '../config/database';
import { redisClient } from '../config/redis';
import { CalendarRepository, ICalendarRepository } from '../repositories/calendar.repository';
import { DateInfoRepository, IDateInfoRepository } from '../repositories/dateInfo.repository';
import { DateOptionRepository, IDateOptionRepository } from '../repositories/dateOption.repository';
import {
  IParticipantRepository,
  ParticipantRepository,
} from '../repositories/participant.repository';
import {
  IRedisBlacklistRepository,
  RedisBlacklistRepository,
} from '../repositories/redisBlacklist.repository';
import {
  IRedisSignupRepository,
  RedisSignupRepository,
} from '../repositories/redisSignup.repository';
import { IUserRepository, UserRepository } from '../repositories/user.repository';
import { IVoteRepository, VoteRepository } from '../repositories/vote.repository';
const db = pool;

export const calendarRepository: ICalendarRepository = new CalendarRepository(db);
export const dateOptionRepository: IDateOptionRepository = new DateOptionRepository(db);
export const participantRepository: IParticipantRepository = new ParticipantRepository(db);
export const voteRepository: IVoteRepository = new VoteRepository(db);
export const userRepository: IUserRepository = new UserRepository(db);
export const dateInfoRepository: IDateInfoRepository = new DateInfoRepository(db);
export const redisBlacklistRepository: IRedisBlacklistRepository = new RedisBlacklistRepository(
  redisClient
);
export const redisSignupRepository: IRedisSignupRepository = new RedisSignupRepository(redisClient);
