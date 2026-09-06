import cron from 'node-cron';

import { VALID_DATE_KINDS } from '../../../models/DateInfo';
import { ICalendarRepository } from '../../../repositories/calendar.repository';
import { IDateInfoRepository } from '../../../repositories/dateInfo.repository';
import { CronService } from '../../../services/cron.service';
import { getSpcdeInfoUrl } from '../../../utils/Spcde.api';

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../../middlewares/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../utils/Spcde.api', () => ({ getSpcdeInfoUrl: jest.fn() }));

const api = getSpcdeInfoUrl as jest.Mock;

describe('공휴일 동기화 복구', () => {
  let service: CronService;
  const repository = {
    findSyncedPublicApiDateKindsByYear: jest.fn(),
    markPublicApiDateKindSynced: jest.fn(),
    insertDateInfos: jest.fn(),
    deleteByYearBefore: jest.fn(),
    deleteSyncStatusByYearBefore: jest.fn(),
    findByYearBefore: jest.fn(),
  };
  const year = new Date().getUTCFullYear();

  beforeEach(() => {
    jest.resetAllMocks();
    repository.findSyncedPublicApiDateKindsByYear.mockResolvedValue(VALID_DATE_KINDS);
    repository.insertDateInfos.mockResolvedValue(0);
    repository.deleteByYearBefore.mockResolvedValue(0);
    repository.findByYearBefore.mockResolvedValue([]);
    api.mockResolvedValue([]);
    service = new CronService(
      {
        findExpired: async () => [],
        findEndedAndOpen: async () => [],
      } as unknown as ICalendarRepository,
      repository as unknown as IDateInfoRepository
    );
  });

  it('올해가 완료돼도 내년의 누락 종류를 찾아 복구한다', async () => {
    repository.findSyncedPublicApiDateKindsByYear.mockImplementation(async (value) =>
      value === String(year + 1)
        ? VALID_DATE_KINDS.filter((kind) => kind !== '03')
        : VALID_DATE_KINDS
    );
    await service.runHolidayUpdate();
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith(year + 1, '03');
    expect(repository.markPublicApiDateKindSynced).toHaveBeenCalledWith(String(year + 1), '03');
    expect(repository.findSyncedPublicApiDateKindsByYear).toHaveBeenCalledTimes(6);
  });

  it('모든 연도가 완료되면 API를 생략하되 만료 데이터와 상태는 정리한다', async () => {
    await service.runHolidayUpdate();
    expect(api).not.toHaveBeenCalled();
    expect(repository.deleteSyncStatusByYearBefore).toHaveBeenCalledWith(String(year - 3));
  });

  it('실패한 종류는 완료로 기록하지 않고 다음 실행에서 다시 시도한다', async () => {
    repository.findSyncedPublicApiDateKindsByYear.mockImplementation(async (value) =>
      value === String(year + 2)
        ? VALID_DATE_KINDS.filter((kind) => kind !== '01')
        : VALID_DATE_KINDS
    );
    api.mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValue([]);
    await service.runHolidayUpdate();
    expect(repository.markPublicApiDateKindSynced).not.toHaveBeenCalled();
    await service.runHolidayUpdate();
    expect(api).toHaveBeenCalledTimes(2);
    expect(repository.markPublicApiDateKindSynced).toHaveBeenCalledWith(String(year + 2), '01');
  });

  it('겹치는 누락 복구 실행은 한 번만 수행한다', async () => {
    repository.findSyncedPublicApiDateKindsByYear.mockResolvedValue([]);
    await Promise.all([service.runHolidayUpdate(), service.runHolidayUpdate()]);
    expect(api).toHaveBeenCalledTimes(6 * VALID_DATE_KINDS.length);
  });

  it('매일 예약 작업에서도 누락 복구를 실행한다', async () => {
    const run = jest.spyOn(service, 'runHolidayUpdate').mockResolvedValue();
    service.start();
    const schedule = cron.schedule as jest.Mock;
    expect(schedule).toHaveBeenCalledWith('0 4 * * *', expect.any(Function), { timezone: 'UTC' });
    await schedule.mock.calls[0][1]();
    expect(run).toHaveBeenCalled();
  });

  it('전체 갱신은 이미 완료된 종류도 다시 가져온다', async () => {
    await service.runHolidayUpdate(false);
    expect(api).toHaveBeenCalledTimes(6 * VALID_DATE_KINDS.length);
  });
});
