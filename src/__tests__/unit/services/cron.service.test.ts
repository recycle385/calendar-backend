import { CronService } from '../../../services/cron.service';
import { getSpcdeInfoUrl } from '../../../utils/Spcde.api';

jest.mock('../../../middlewares/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../utils/Spcde.api', () => ({
  getSpcdeInfoUrl: jest.fn(),
}));

describe('CronService', () => {
  const mockCalendarRepository = {
    findExpired: jest.fn(),
    deleteByIds: jest.fn(),
    findEndedAndOpen: jest.fn(),
    closeByIds: jest.fn(),
  };

  const mockDateInfoRepository = {
    existsPublicApiByYear: jest.fn(),
    insertDateInfos: jest.fn(),
    deleteByYearBefore: jest.fn(),
    findByYearBefore: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDateInfoRepository.insertDateInfos.mockResolvedValue(0);
    mockDateInfoRepository.deleteByYearBefore.mockResolvedValue(0);
    mockDateInfoRepository.findByYearBefore.mockResolvedValue([]);
    (getSpcdeInfoUrl as jest.Mock).mockResolvedValue([]);
  });

  it('서버 시작 시 현재 연도 public-api date-info가 있으면 공휴일 업데이트를 생략해야 한다', async () => {
    mockDateInfoRepository.existsPublicApiByYear.mockResolvedValue(true);
    const cronService = new CronService(
      mockCalendarRepository as any,
      mockDateInfoRepository as any
    );

    await cronService.runHolidayUpdate();

    expect(mockDateInfoRepository.existsPublicApiByYear).toHaveBeenCalledWith(
      new Date().getFullYear().toString()
    );
    expect(getSpcdeInfoUrl).not.toHaveBeenCalled();
    expect(mockDateInfoRepository.insertDateInfos).not.toHaveBeenCalled();
  });

  it('서버 시작 시 현재 연도 public-api date-info가 없으면 공휴일 업데이트를 실행해야 한다', async () => {
    mockDateInfoRepository.existsPublicApiByYear.mockResolvedValue(false);
    const cronService = new CronService(
      mockCalendarRepository as any,
      mockDateInfoRepository as any
    );

    await cronService.runHolidayUpdate();

    expect(getSpcdeInfoUrl).toHaveBeenCalled();
    expect(mockDateInfoRepository.insertDateInfos).toHaveBeenCalled();
    expect(mockDateInfoRepository.deleteByYearBefore).toHaveBeenCalled();
  });
});
