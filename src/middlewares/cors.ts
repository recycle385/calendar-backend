import cors from 'cors';

import { env } from '../config/env';
import { Errors } from '../utils/errors';

const allowedOrigins = [env.CLIENT_URL, env.BACKEND_URL];

const corsOptions: cors.CorsOptions = {
  /**
   * origin: 요청을 보내는 출처를 확인하는 부분입니다.
   * - allowedOrigins 목록에 있는 출처만 허용합니다.
   * - !origin: Postman 같은 서버 간 요청은 origin이 없으므로 허용합니다.
   */
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true); // 허용
    } else {
      callback(Errors.BadRequest('허용되지 않은 출처입니다')); // 거부
    }
  },

  /**
   * methods: 허용할 HTTP 메서드를 지정합니다.
   * 나중에 필요한 메서드만 남기고 제거
   */
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],

  /**
   * allowedHeaders: 요청 헤더에 포함될 수 있는 커스텀 헤더를 지정합니다.
   * 'Authorization'은 JWT 같은 인증 토큰을 주고받을 때 필요합니다.
   */
  allowedHeaders: ['Content-Type', 'Authorization'],

  /**
   * credentials: 자격 증명(쿠키, 인증 헤더 등)을 포함한 요청을 허용할지 여부입니다.
   * true로 설정해야 프론트엔드에서 보낸 쿠키나 인증 정보를 서버가 받을 수 있습니다.
   */
  credentials: true,
};

// 설정 객체를 cors 함수에 전달하여 미들웨어 생성
export const corsMiddleware = cors(corsOptions);
