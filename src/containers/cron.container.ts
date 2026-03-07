import { CronService } from '../services/cron.service';
import { calendarRepository } from './repository.container';

export const cronService = new CronService(calendarRepository);
