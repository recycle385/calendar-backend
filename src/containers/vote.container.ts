import { VoteController } from '../controllers/vote.controller';
import { calendarService, participantService, voteService } from './service.container';
// Controllers
export const voteController = new VoteController(voteService, calendarService, participantService);
