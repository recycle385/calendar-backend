import { DateInfoRepository } from '../../../repositories/dateInfo.repository';

describe('DateInfoRepository Unit Test', () => {
  it('연도별로 동기화가 완료된 날짜 종류를 반환한다', async () => {
    const mockPool = {
      execute: jest.fn().mockResolvedValue([[{ date_kind: '01' }, { date_kind: '03' }]]),
    };
    const repository = new DateInfoRepository(mockPool as any);

    const result = await repository.findSyncedPublicApiDateKindsByYear('2026');

    expect(result).toEqual(['01', '03']);
    expect(mockPool.execute).toHaveBeenCalledWith(
      expect.stringContaining('SELECT date_kind FROM date_info_sync_status WHERE year = ?'),
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
