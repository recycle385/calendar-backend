import { DateInfoController } from '../controllers/dateInfo.controller';
import { dateInfoService } from './service.container';

export const dateInfoController = new DateInfoController(dateInfoService);
