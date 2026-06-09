import { Router } from 'express';

import { DATE_INFO_ROUTES } from '../constants/routes.constants';
import { DateInfoController } from '../controllers/dateInfo.controller';
import { asyncHandler } from '../middlewares/errorHandler';
import {
  dateInfoSchemas,
  validateBody,
  validateParams,
  validateQuery,
} from '../middlewares/validation';

export const createDateInfoRouter = (controller: DateInfoController): Router => {
  const router = Router();

  router.post(
    DATE_INFO_ROUTES.CREATE,
    validateBody(dateInfoSchemas.createRequest),
    asyncHandler(controller.addDateInfo)
  );

  router.post(
    DATE_INFO_ROUTES.CREATE_BATCH,
    validateBody(dateInfoSchemas.createBatchRequest),
    asyncHandler(controller.addDateInfos)
  );

  router.get(DATE_INFO_ROUTES.GET_ALL, asyncHandler(controller.getAllDateInfos));

  router.get(
    DATE_INFO_ROUTES.GET_BY_YEARS,
    validateQuery(dateInfoSchemas.yearsQuery),
    asyncHandler(controller.getDateInfosByYears)
  );

  router.get(
    DATE_INFO_ROUTES.GET_BEFORE,
    validateQuery(dateInfoSchemas.yearQuery),
    asyncHandler(controller.getDateInfosByYearBefore)
  );

  router.get(
    DATE_INFO_ROUTES.GET_BY_YEARS_AND_KINDS,
    validateQuery(dateInfoSchemas.yearsAndKindsQuery),
    asyncHandler(controller.getDateInfosByYearsAndDateKinds)
  );

  router.get(
    DATE_INFO_ROUTES.GET_BY_YEAR_AND_KINDS,
    validateParams(dateInfoSchemas.yearParams),
    validateQuery(dateInfoSchemas.yearKindsQuery),
    asyncHandler(controller.getDateInfosByYearAndDateKinds)
  );

  router.get(
    DATE_INFO_ROUTES.GET_BY_YEAR,
    validateParams(dateInfoSchemas.yearParams),
    asyncHandler(controller.getDateInfosByYear)
  );

  router.delete(
    DATE_INFO_ROUTES.DELETE_BEFORE,
    validateQuery(dateInfoSchemas.yearQuery),
    asyncHandler(controller.deleteDateInfosByYearBefore)
  );

  router.delete(
    DATE_INFO_ROUTES.DELETE_BY_DATES_AND_NAMES,
    validateBody(dateInfoSchemas.deleteByDatesAndNamesRequest),
    asyncHandler(controller.deleteByDatesAndNames)
  );
  return router;
};
