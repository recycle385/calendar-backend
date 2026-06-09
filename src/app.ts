import express from 'express';
import helmet from 'helmet';

import { env } from './config/env';
import { API_PREFIX } from './constants/routes.constants';
import {
  corsMiddleware,
  errorHandler,
  notFoundHandler,
  rateLimiter,
  registerMiddlewares,
  requestLogger,
} from './middlewares';
import routes from './routes';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(corsMiddleware);
registerMiddlewares(app);

app.use(requestLogger);

if (env.ENABLE_RATE_LIMIT === 'true') {
  app.use(API_PREFIX, rateLimiter);
}

app.use(API_PREFIX, routes);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
