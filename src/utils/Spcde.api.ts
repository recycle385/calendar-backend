import axios from 'axios';

import { env } from '../config/env';
import { logger } from '../config/logger';
import { DateKind, dateKindMap, SafeDateInfo, SpcdeItem } from '../models/DateInfo';
import { AppError, Errors } from '../utils/errors';
import { normalizeCompactDateOnly, parseDateOnlyToUtcDate } from './dateOnly';

export async function getSpcdeInfoUrl(
  year: number,
  dateKindCode: DateKind
): Promise<SafeDateInfo[]> {
  const dateKind = dateKindMap.get(dateKindCode);

  if (!dateKind) {
    throw new Error(`유효하지 않은 dateKindCode: ${dateKindCode}`);
  }

  try {
    const { data } = await axios.get(
      `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/${dateKind}`,
      {
        params: {
          solYear: year,
          ServiceKey: env.GET_REST_DE_INFO,
          _type: 'json',
          numOfRows: 100,
        },
        timeout: 10000,
      }
    );

    const header = data?.response?.header;
    const body = data?.response?.body;

    if (header?.resultCode !== '00') {
      throw Errors.BadGateway('공공');
    }

    if (!body?.items || body.items === '') {
      return [];
    }

    const items = body.items.item;
    const itemList = Array.isArray(items) ? items : [items];

    return itemList.map(
      (item: SpcdeItem): SafeDateInfo => ({
        locationDate: parseDateOnlyToUtcDate(normalizeCompactDateOnly(item.locdate.toString())),
        year: item.locdate.toString().substring(0, 4),
        seq: item.seq,
        dateName: item.dateName,
        dateKind: dateKindCode,
        isHoliday: item.isHoliday === 'Y',
        dataSource: 'public-api',
      })
    );
  } catch (err) {
    if (err instanceof AppError) throw err;

    if (axios.isAxiosError(err) && err.code === 'ECONNABORTED') {
      logger.error(`[SpcdeAPI] 호출 타임아웃: ${year}, ${dateKindCode}`);
      throw Errors.BadGateway('공공', '공공 API 응답 시간이 초과되었습니다.');
    }

    logger.error(
      `[SpcdeAPI] 호출 중 예외 발생: ${err instanceof Error ? err.message : String(err)}`
    );
    throw Errors.BadGateway('공공', '공공 API 호출 중 오류가 발생했습니다.');
  }
}
