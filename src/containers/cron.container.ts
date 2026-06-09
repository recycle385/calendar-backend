import { CronService } from '../services/cron.service';
import { calendarRepository } from './repository.container';
import { dateInfoRepository } from './repository.container';

export const cronService = new CronService(calendarRepository, dateInfoRepository);
