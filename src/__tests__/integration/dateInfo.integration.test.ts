import request from 'supertest';

import { app } from '../../app';
import pool, { closeDatabaseConnection } from '../../config/database';

describe('DateInfo Integration Test', () => {
  const TARGET_YEAR = '2099';
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
    // Ensure clean state if DB is reachable
    try {
      await pool.query('DELETE FROM date_info WHERE year = ?', [TARGET_YEAR]);
    } catch (err) {
      console.warn('DB not reachable in beforeAll, integration tests will be skipped.');
    }
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM date_info WHERE year = ?', [TARGET_YEAR]);
    } catch (err) {
      console.warn('DB not reachable in afterAll, skipping cleanup.');
    }
    try {
      await closeDatabaseConnection();
    } catch (err) {
      console.warn('Error closing DB connection (likely unreachable).');
    }
  });

  it('POST /api/v1/date-infos/batch inserts rows and returns 201', async () => {
    // check DB reachable
    try {
      await pool.query('SELECT 1');
    } catch (err) {
      console.warn('DB not reachable, skipping integration test for batch insert');
      return;
    }

    const res = await request(app).post('/api/v1/date-infos/batch').send(payload);

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
    // If DB not reachable, validator still runs so we can run this check without DB
    const res = await request(app)
      .post('/api/v1/date-infos/batch')
      .send({ dateInfoList: payload.dateInfos });
    expect(res.status).toBe(400);
  });
});
