export const API_PREFIX = '/api/v1';

export const AUTH_ROUTES = {
  BASE: '/auth',

  GOOGLE: '/google',
  GOOGLE_CALLBACK: '/google/callback',

  SIGNUP: '/register',

  REFRESH: '/refresh',

  LOGOUT: '/logout',
};

export const DATE_INFO_ROUTES = {
  BASE: '/date-infos',

  // 생성
  CREATE: '/', // POST /date-infos
  CREATE_BATCH: '/batch', // POST /date-infos/batch

  // 조회
  GET_ALL: '/', // GET /date-infos
  GET_BY_YEARS: '/years', // GET /date-infos/years?years[]=2023&years[]=2024
  GET_BEFORE: '/before', // GET /date-infos/before?year=2025
  GET_BY_YEARS_AND_KINDS: '/kinds', // GET /date-infos/kinds?years[]=2023&dateKinds[]=01
  GET_BY_YEAR_AND_KINDS: '/:year/kinds', // GET /date-infos/2025/kinds?dateKinds[]=01
  GET_BY_YEAR: '/:year', // GET /date-infos/2025

  // 삭제
  DELETE_BEFORE: '/before', // DELETE /date-infos/before?year=2025
  DELETE_BY_DATES_AND_NAMES: '/', // DELETE /date-infos body: { dateNamePairs: [...] }
};

export const CALENDAR_ROUTES = {
  BASE: '/calendars',

  MY_CALENDAR_LIST: '/my',

  CALENDAR_SLUG: '/:slug',

  CALENDAR_CLOSE: '/:slug/close',
};

export const PARTICIPANT_ROUTES = {
  BASE: '/calendars/:slug/participants',

  LOGIN: '/login',

  DELETE_SELF: '/self',

  DELETE_BY_HOST: '/:uuid',
};

export const VOTE_ROUTES = {
  BASE: '/calendars/:slug/votes',

  CHECK_VOTE: '/:participantUuid',
};

export const SWAGGER_ROUTES = {
  BASE: '/api-docs',
};
