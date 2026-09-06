import request from 'supertest';

import { app } from '../../app';
import pool, { closeDatabaseConnection } from '../../config/database';
import { env } from '../../config/env';

describe('DateInfo Integration Test', () => {
  const TARGET_YEAR = '2099';
  const OPERATOR_TOKEN = 'date-info-integration-operator-token';
  let isDbReachable = false;
  const payload = {
    dateInfos: [
      {
        locationDate: '20990101',
        year: TARGET_YEAR,
        seq: 1,
        dateName: '통합테스트일1',
        dateKind: '03',
        isHoliday: false,
        dataSource: 'custom',
      },
      {
        locationDate: '20990102',
        year: TARGET_YEAR,
        seq: 1,
        dateName: '통합테스트일2',
        dateKind: '03',
        isHoliday: false,
        dataSource: 'custom',
      },
    ],
  };

  beforeAll(async () => {
    env.HOST_ACCESS_TOKEN = OPERATOR_TOKEN;
    try {
      await pool.query('SELECT 1');
      isDbReachable = true;
      await pool.query('DELETE FROM date_info WHERE year = ?', [TARGET_YEAR]);
    } catch {
      isDbReachable = false;
    }
  });

  afterAll(async () => {
    if (isDbReachable) {
      await pool.query('DELETE FROM date_info WHERE year = ?', [TARGET_YEAR]);
    }

    try {
      await closeDatabaseConnection();
    } catch {
      console.warn('Error closing DB connection (likely unreachable).');
    }
  });

  it('POST /api/v1/date-infos/batch inserts rows and returns 201', async () => {
    if (!isDbReachable) {
      throw new Error('DateInfo integration insert test requires reachable test DB.');
    }

    const res = await request(app)
      .post('/api/v1/date-infos/batch')
      .set('Authorization', `Bearer ${OPERATOR_TOKEN}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.text).toContain('2개의 정보가 추가됐습니다.');

    const [rows]: any = await pool.query(
      'SELECT location_date, year, date_name FROM date_info WHERE year = ? ORDER BY location_date ASC',
      [TARGET_YEAR]
    );
    expect(rows.length).toBe(2);
    expect(rows[0].location_date).toBe('2099-01-01');
    expect(rows[0].date_name).toBe('통합테스트일1');
    expect(rows[1].location_date).toBe('2099-01-02');
  });

  it('POST /api/v1/date-infos/batch with wrong key returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/date-infos/batch')
      .set('Authorization', `Bearer ${OPERATOR_TOKEN}`)
      .send({ dateInfoList: payload.dateInfos });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/date-infos/batch without operator token returns 401', async () => {
    const res = await request(app).post('/api/v1/date-infos/batch').send(payload);
    expect(res.status).toBe(401);
  });
});
