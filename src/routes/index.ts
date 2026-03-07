import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import { swaggerSets } from '../config/swagger';
import {
  AUTH_ROUTES,
  CALENDAR_ROUTES,
  PARTICIPANT_ROUTES,
  PROXY_ROUTES,
  SWAGGER_ROUTES,
  VOTE_ROUTES,
} from '../constants/routes.constants';
import { authController } from '../containers/auth.container';
import { calendarController } from '../containers/calendar.container';
import { participantController } from '../containers/participant.container';
import { voteController } from '../containers/vote.container';
import { createAuthRouter } from './auth.routes';
import { createCalendarRouter } from './calendar.routes';
import { createParticipantRouter } from './participant.routes';
import publicdata from './proxy/publicdata';
import { createVoteRouter } from './vote.routes';

const router = Router();
const authRouter = createAuthRouter(authController);
const calendarRouter = createCalendarRouter(calendarController);
const participantRouter = createParticipantRouter(participantController);
const voteRouter = createVoteRouter(voteController);
const swaggerRouter = swaggerUi.setup(swaggerSets);

router.use(PROXY_ROUTES.PUBLIC_DATA, publicdata);
router.use(AUTH_ROUTES.BASE, authRouter);
router.use(CALENDAR_ROUTES.BASE, calendarRouter);
router.use(PARTICIPANT_ROUTES.BASE, participantRouter);
router.use(VOTE_ROUTES.BASE, voteRouter);
router.use(SWAGGER_ROUTES.BASE, swaggerUi.serve, swaggerRouter);

export default router;
