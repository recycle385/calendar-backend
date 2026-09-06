import axios from 'axios';

import { env } from '../config/env';
import { logger } from '../middlewares/logger';
import { DateKind, dateKindMap, SafeDateInfo, SpcdeItem } from '../models/DateInfo';
import { AppError, Errors } from '../utils/errors';
import { normalizeCompactDateOnly, parseDateOnlyToUtcDate } from './dateOnly';

const SPCDE_NUM_OF_ROWS = 100;

export async function getSpcdeInfoUrl(
  year: number,
  dateKindCode: DateKind
): Promise<SafeDateInfo[]> {
  const dateKind = dateKindMap.get(dateKindCode);

  if (!dateKind) {
    throw new Error(`유효하지 않은 dateKindCode: ${dateKindCode}`);
  }

  try {
    const endpoint = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/${dateKind}`;
    const fetchPage = async (pageNo: number) => {
      const { data } = await axios.get(endpoint, {
        params: {
          solYear: year,
          ServiceKey: env.GET_REST_DE_INFO,
          _type: 'json',
          numOfRows: SPCDE_NUM_OF_ROWS,
          pageNo,
        },
        timeout: 10000,
      });

      const header = data?.response?.header;

      if (header?.resultCode !== '00') {
        throw Errors.BadGateway('공공');
      }

      return data?.response?.body;
    };

    const firstBody = await fetchPage(1);

    if (!firstBody?.items || firstBody.items === '') {
      return [];
    }

    const bodies = [firstBody];
    const totalCount = Number(firstBody.totalCount ?? 0);
    const numOfRows = Number(firstBody.numOfRows ?? SPCDE_NUM_OF_ROWS);
    const totalPages = Math.ceil(totalCount / numOfRows);

    for (let pageNo = 2; pageNo <= totalPages; pageNo++) {
      const body = await fetchPage(pageNo);

      if (body?.items && body.items !== '') {
        bodies.push(body);
      }
    }

    const itemList = bodies.flatMap((body) => {
      const items = body.items.item;
      return Array.isArray(items) ? items : [items];
    });

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
