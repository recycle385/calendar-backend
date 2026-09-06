import axios from 'axios';

import { getSpcdeInfoUrl } from '../../../utils/Spcde.api';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Spcde API Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('totalCount가 numOfRows보다 크면 모든 페이지를 조회해 합쳐야 한다', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          response: {
            header: { resultCode: '00' },
            body: {
              pageNo: 1,
              numOfRows: 100,
              totalCount: 101,
              items: {
                item: [
                  {
                    locdate: 20270101,
                    seq: 1,
                    dateName: '첫번째',
                    isHoliday: 'N',
                  },
                ],
              },
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          response: {
            header: { resultCode: '00' },
            body: {
              pageNo: 2,
              numOfRows: 100,
              totalCount: 101,
              items: {
                item: {
                  locdate: 20271231,
                  seq: 1,
                  dateName: '마지막',
                  isHoliday: 'Y',
                },
              },
            },
          },
        },
      });

    const result = await getSpcdeInfoUrl(2027, '03');

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('getAnniversaryInfo'),
      expect.objectContaining({
        params: expect.objectContaining({ pageNo: 1, numOfRows: 100 }),
      })
    );
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('getAnniversaryInfo'),
      expect.objectContaining({
        params: expect.objectContaining({ pageNo: 2, numOfRows: 100 }),
      })
    );
    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dateName: '첫번째',
          dateKind: '03',
          dataSource: 'public-api',
        }),
        expect.objectContaining({
          dateName: '마지막',
          dateKind: '03',
          isHoliday: true,
        }),
      ])
    );
  });
});
