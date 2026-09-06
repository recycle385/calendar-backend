import { DateInfoRepository } from '../../../repositories/dateInfo.repository';

describe('DateInfoRepository Unit Test', () => {
  it('existsPublicApiByYear는 해당 연도 public-api 데이터 존재 여부를 반환해야 한다', async () => {
    const mockPool = {
      execute: jest.fn().mockResolvedValue([[{ 1: 1 }]]),
    };
    const repository = new DateInfoRepository(mockPool as any);

    const result = await repository.existsPublicApiByYear('2026');

    expect(result).toBe(true);
    expect(mockPool.execute).toHaveBeenCalledWith(
      expect.stringContaining(
        `SELECT 1 FROM date_info WHERE year = ? AND data_source = 'public-api' LIMIT 1`
      ),
      ['2026']
    );
  });

  it('빈 목록 저장 요청은 DB 쿼리 없이 0을 반환해야 한다', async () => {
    const mockPool = {
      query: jest.fn(),
    };
    const repository = new DateInfoRepository(mockPool as any);

    const result = await repository.insertDateInfos([]);

    expect(result).toBe(0);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('공휴일 배치 저장은 중복 키에서 upsert로 처리해야 한다', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
    };
    const repository = new DateInfoRepository(mockPool as any);

    const result = await repository.insertDateInfos([
      {
        locationDate: new Date('2026-01-01T00:00:00.000Z'),
        year: '2026',
        seq: 1,
        dateName: '신정',
        dateKind: '01',
        isHoliday: true,
        dataSource: 'public-api',
      },
    ]);

    expect(result).toBe(1);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('ON DUPLICATE KEY UPDATE'),
      [expect.any(Array)]
    );
  });
});
