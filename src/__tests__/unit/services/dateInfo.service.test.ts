import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { DateInfo, DateKind, DateNamePair, SafeDateInfo } from '../../../models/DateInfo';
import { IDateInfoRepository } from '../../../repositories/dateInfo.repository';
import { DateInfoService } from '../../../services/dateInfo.service';

jest.mock('../../../infrastructure/transaction.manager', () => ({
  TransactionManager: {
    run: jest.fn(async (callback: (connection: object) => unknown) => callback({})),
  },
}));

const mockDateInfoRepository: jest.Mocked<IDateInfoRepository> = {
  insertDateInfos: jest.fn(),
  findByIds: jest.fn(),
  findByYears: jest.fn(),
  findByYearBefore: jest.fn(),
  deleteByIds: jest.fn(),
  deleteByYearBefore: jest.fn(),
  getAllDateInfosByDateKinds: jest.fn(),
  getAllDateInfos: jest.fn(),
  getDateInfosByYearsAndDateKinds: jest.fn(),
  deleteByDatesAndNames: jest.fn(),
  getIdsByDatesAndNames: jest.fn(),
};

const makeSafeDateInfo = (overrides: Partial<SafeDateInfo> = {}): SafeDateInfo => ({
  locationDate: new Date('2026-01-01T00:00:00.000Z'),
  year: '2026',
  seq: 1,
  dateName: '신정',
  dateKind: '01',
  isHoliday: true,
  dataSource: 'custom',
  ...overrides,
});

const makeDateInfo = (overrides: Partial<DateInfo> = {}): DateInfo => ({
  id: 1,
  locationDate: new Date('2026-01-01T00:00:00.000Z'),
  year: '2026',
  seq: 1,
  dateName: '신정',
  dateKind: '01' as DateKind,
  isHoliday: true,
  dataSource: 'custom',
  updatedAt: new Date('2026-01-01T12:00:00.000Z'),
  ...overrides,
});

describe('DateInfoService Unit Test', () => {
  let service: DateInfoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DateInfoService(mockDateInfoRepository);
  });

  describe('addDateInfo', () => {
    it('[성공] 단건 추가 시 1건이 반환되어야 한다', async () => {
      mockDateInfoRepository.insertDateInfos.mockResolvedValue(1);

      const result = await service.addDateInfo(makeSafeDateInfo());

      expect(mockDateInfoRepository.insertDateInfos).toHaveBeenCalledWith([expect.any(Object)]);
      expect(result).toBe(1);
    });

    it('[실패] 단건 추가 결과가 1이 아니면 에러를 던져야 한다', async () => {
      mockDateInfoRepository.insertDateInfos.mockResolvedValue(0);

      await expect(service.addDateInfo(makeSafeDateInfo())).rejects.toThrow(
        '정보가 정상적으로 추가되지 않았습니다.'
      );
    });
  });

  describe('addDateInfos', () => {
    it('[성공] 배치 추가 건수와 실제 반영 건수가 같아야 한다', async () => {
      const payload = [makeSafeDateInfo(), makeSafeDateInfo({ seq: 2, dateName: '다음기념일' })];
      mockDateInfoRepository.insertDateInfos.mockResolvedValue(2);

      const result = await service.addDateInfos(payload);

      expect(mockDateInfoRepository.insertDateInfos).toHaveBeenCalledWith(payload);
      expect(result).toBe(2);
    });

    it('[실패] 배치 추가 건수 불일치 시 에러를 던져야 한다', async () => {
      const payload = [makeSafeDateInfo(), makeSafeDateInfo({ seq: 2 })];
      mockDateInfoRepository.insertDateInfos.mockResolvedValue(1);

      await expect(service.addDateInfos(payload)).rejects.toThrow(
        '정보가 정상적으로 추가되지 않았습니다.'
      );
    });
  });

  describe('getDateInfosByYears', () => {
    it('[성공] 조회 결과를 연도별 map으로 그룹핑하고 빈 연도도 포함해야 한다', async () => {
      mockDateInfoRepository.findByYears.mockResolvedValue([
        makeDateInfo({
          id: 10,
          year: '2024',
          seq: 1,
          dateName: '테스트A',
          locationDate: new Date('2024-01-01T00:00:00.000Z'),
        }),
        makeDateInfo({
          id: 11,
          year: '2026',
          seq: 2,
          dateName: '테스트B',
          locationDate: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ]);

      const result = await service.getDateInfosByYears(['2024', '2025', '2026']);

      expect(Object.keys(result)).toEqual(['2024', '2025', '2026']);
      expect(result['2025']).toEqual([]);
      expect(result['2024'][0].locationDate).toBe('20240101');
      expect(result['2026'][0].dateName).toBe('테스트B');
    });
  });

  describe('deleteByDatesAndNames', () => {
    const pairs: DateNamePair[] = [
      { locationDate: new Date('2026-01-01T00:00:00.000Z'), dateName: '신정' },
      { locationDate: new Date('2026-02-01T00:00:00.000Z'), dateName: '테스트' },
    ];

    it('[성공] 일치하는 id를 조회 후 같은 개수만큼 삭제되어야 한다', async () => {
      mockDateInfoRepository.getIdsByDatesAndNames.mockResolvedValue([101, 102]);
      mockDateInfoRepository.deleteByIds.mockResolvedValue(2);

      const result = await service.deleteByDatesAndNames(pairs);

      expect(mockDateInfoRepository.getIdsByDatesAndNames).toHaveBeenCalled();
      expect(mockDateInfoRepository.deleteByIds).toHaveBeenCalledWith(
        [101, 102],
        expect.anything()
      );
      expect(result).toBe(2);
    });

    it('[성공] 삭제 대상 id가 없으면 0을 반환하고 deleteByIds를 호출하지 않아야 한다', async () => {
      mockDateInfoRepository.getIdsByDatesAndNames.mockResolvedValue([]);

      const result = await service.deleteByDatesAndNames(pairs);

      expect(mockDateInfoRepository.deleteByIds).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it('[실패] 조회한 id 개수와 삭제 개수가 다르면 에러를 던져야 한다', async () => {
      mockDateInfoRepository.getIdsByDatesAndNames.mockResolvedValue([101, 102]);
      mockDateInfoRepository.deleteByIds.mockResolvedValue(1);

      await expect(service.deleteByDatesAndNames(pairs)).rejects.toThrow(
        '삭제된 정보의 개수가 일치하지 않습니다.'
      );
    });
  });
});
