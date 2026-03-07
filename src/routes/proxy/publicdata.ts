import axios from 'axios';
import { NextFunction, Request, Response, Router } from 'express';

import { env } from '../../config/env';

const router = Router();

router.get('/holidays', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = String(req.query.year ?? '2025').trim();
    const month = String(req.query.month ?? '09').padStart(2, '0');

    if (!env.GET_REST_DE_INFO) {
      throw new Error('GET_REST_DE_INFO 환경 변수가 설정되지 않았습니다.');
    }

    const { data } = await axios.get(
      'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo',
      {
        params: {
          ServiceKey: env.GET_REST_DE_INFO,
          solYear: year,
          solMonth: month,
          numOfRows: 100,
          _type: 'json',
        },
      }
    );

    const header = data?.response?.header;
    const items = data?.response?.body?.items?.item ?? [];

    if (!header || header.resultCode !== '00') {
      return res.status(502).json({
        error: header?.resultMsg || 'Upstream error',
        code: header?.resultCode,
      });
    }

    res.json(Array.isArray(items) ? items : [items]);
  } catch (err) {
    console.error(err);
    next(err);
  }
});

export default router;
