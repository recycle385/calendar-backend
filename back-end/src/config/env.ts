import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  JWT_SECRET: string;
  SESSION_SECRET: string;
  REDIS_URL: string;
  DB_HOST: string;
  DB_USER: string;
  DB_USER_PASSWORD: string;
  DB_NAME: string;
  CLIENT_URL: string;
  GET_REST_DE_INFO: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BACKEND_URL: string;
  SIGNUP_MODE: string;
  DB_CONNECTION_LIMIT: number;
}

function validateEnv(): EnvConfig {
  const required = [
    'JWT_SECRET',
    'SESSION_SECRET',
    'DB_HOST',
    'DB_USER',
    'DB_USER_PASSWORD',
    'DB_NAME',
    'REDIS_URL',
    'CLIENT_URL',
    'GET_REST_DE_INFO',
    'PORT',
    'NODE_ENV',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'BACKEND_URL',
    'SIGNUP_MODE',
    'DB_CONNECTION_LIMIT',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `필수 환경변수를 찾지 못했습니다: ${missing.join(', ')}\n` +
        `env파일을 다시 한 번 확인해주세요.`
    );
  }

  const connectionLimit = Number(process.env.DB_CONNECTION_LIMIT);

  if (!Number.isInteger(connectionLimit) || connectionLimit <= 0) {
    throw new Error(
      `DB_CONNECTION_LIMIT는 1 이상의 정수여야 합니다. 현재 값: ${process.env.DB_CONNECTION_LIMIT}`
    );
  }

  return {
    PORT: parseInt(process.env.PORT!, 10),
    NODE_ENV: process.env.NODE_ENV!,
    JWT_SECRET: process.env.JWT_SECRET!,
    SESSION_SECRET: process.env.SESSION_SECRET!,
    REDIS_URL: process.env.REDIS_URL!,
    DB_HOST: process.env.DB_HOST!,
    DB_USER: process.env.DB_USER!,
    DB_USER_PASSWORD: process.env.DB_USER_PASSWORD!,
    DB_NAME: process.env.DB_NAME!,
    CLIENT_URL: process.env.CLIENT_URL!,
    GET_REST_DE_INFO: process.env.GET_REST_DE_INFO!,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
    BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:4000',
    SIGNUP_MODE: process.env.SIGNUP_MODE!,
    DB_CONNECTION_LIMIT: connectionLimit,
  };
}

export const env = validateEnv();
