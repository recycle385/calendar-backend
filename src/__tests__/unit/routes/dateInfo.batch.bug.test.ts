import express from 'express';
import request from 'supertest';

import { env } from '../../../config/env';
import { DateInfoController } from '../../../controllers/dateInfo.controller';
import { errorHandler } from '../../../middlewares/errorHandler';
import { createDateInfoRouter } from '../../../routes/dateInfo.routes';

describe('DateInfo Batch API Bug Reproduction', () => {
  const OPERATOR_TOKEN = 'date-info-route-test-operator-token';

  beforeAll(() => {
    env.HOST_ACCESS_TOKEN = OPERATOR_TOKEN;
  });

  const buildApp = () => {
    const app = express();
    app.use(express.json());

    // addDateInfos는 전달받은 리스트 길이를 참조하므로 undefined면 TypeError가 발생한다.
    const mockService = {
      addDateInfos: jest.fn(async (dateInfoList: unknown[]) => dateInfoList.length),
    };

    const controller = new DateInfoController(mockService as any);

    app.use('/date-infos', createDateInfoRouter(controller));
    app.use(errorHandler);

    return { app, mockService };
  };

  it('유효한 dateInfos 요청이어도 컨트롤러가 dateInfoList를 읽어 500이 발생한다', async () => {
    const { app, mockService } = buildApp();

    const response = await request(app)
      .post('/date-infos/batch')
      .set('Authorization', `Bearer ${OPERATOR_TOKEN}`)
      .send({
        dateInfos: [
          {
            locationDate: '20260101',
            year: '2026',
            seq: 1,
            dateName: '테스트',
            dateKind: '01',
            isHoliday: true,
            dataSource: 'custom',
          },
        ],
      });

    // 이제 컨트롤러가 `dateInfos`를 읽도록 수정했으므로 정상 처리되어야 한다
    expect(response.status).toBe(201);
    expect(response.text).toContain('1개의 정보가 추가됐습니다.');
    expect(mockService.addDateInfos).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ dateName: '테스트', year: '2026' })])
    );
  });

  it('dateInfoList 키로 요청하면 검증 단계에서 400으로 차단된다', async () => {
    const { app, mockService } = buildApp();

    const response = await request(app)
      .post('/date-infos/batch')
      .set('Authorization', `Bearer ${OPERATOR_TOKEN}`)
      .send({
        dateInfoList: [
          {
            locationDate: '20260101',
            year: '2026',
            seq: 1,
            dateName: '테스트',
            dateKind: '01',
            isHoliday: true,
            dataSource: 'custom',
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(mockService.addDateInfos).not.toHaveBeenCalled();
  });

  it('운영자 토큰이 없으면 401로 차단된다', async () => {
    const { app, mockService } = buildApp();

    const response = await request(app).post('/date-infos/batch').send({ dateInfos: [] });

    expect(response.status).toBe(401);
    expect(mockService.addDateInfos).not.toHaveBeenCalled();
  });
});
