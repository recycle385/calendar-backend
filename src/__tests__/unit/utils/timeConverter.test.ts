import { toMilliseconds, toSeconds } from '../../../utils/timeConverter';

describe('timeConverter', () => {
  it('JWT용 기간을 초 단위로 변환한다', () => {
    expect(toSeconds('7d')).toBe(604800);
  });

  it('쿠키용 기간을 밀리초 단위로 변환한다', () => {
    expect(toMilliseconds('7d')).toBe(604800000);
  });
});
