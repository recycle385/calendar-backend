import axios from 'axios';

import { env } from '../config/env';
import { logger } from '../config/logger';
import { DateKind, dateKindMap, SafeDateInfo, SpcdeItem } from '../models/DateInfo';
import { AppError, Errors } from '../utils/errors';

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
      `http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/${dateKind}`,
      {
        params: {
          solYear: year,
          ServiceKey: env.GET_REST_DE_INFO,
          _type: 'json',
          numOfRows: 100,
        },
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
        locationDate: new Date(
          item.locdate.toString().replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
        ),
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

    logger.error(
      `[SpcdeAPI] 호출 중 예외 발생: ${err instanceof Error ? err.message : String(err)}`
    );
    throw Errors.BadGateway('공공', '공공 API 호출 중 오류가 발생했습니다.');
  }
}
