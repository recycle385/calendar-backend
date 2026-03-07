import { UserRepository } from '../../../repositories';

describe('userRepository 테스트', () => {
  let userRepository: UserRepository;
  let mockPool: any;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
    };
    userRepository = new UserRepository(mockPool);
  });

  it('', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    const provider = 'google';
    const oauthId = 'some-id';

    await userRepository.findByOauthId(provider, oauthId);

    const expectedSql =
      'SELECT user_uuid, email, oauth_provider, nickname, profile_image_url  FROM users WHERE oauth_provider = ? AND oauth_id = ?';
    const expectedParams = [provider, oauthId];

    expect(mockPool.query).toHaveBeenCalledWith(expectedSql, expectedParams);
  });

  it.only('DB에 유저가 존재하면 User 객체를 반환해야 한다', async () => {
    // 1. DB에서 리턴될 가짜 데이터 (Mock Data) 정의
    const mockDbRow = {
      id: 1,
      user_uuid: 'test-uuid-123',
      email: 'test@example.com',
      oauth_provider: 'google',
      oauth_id: 'google-oauth-id',
      nickname: '테스터',
      profile_image_url: 'http://image.com/profile.jpg',
      isTermsAgreed: 1, // DB에는 보통 1/0으로 저장됨
      created_at: new Date('2023-01-01T00:00:00.000Z'),
    };

    // 2. mockPool이 execute 되었을 때 위 데이터를 반환하도록 설정
    // mysql2 라이브러리는 [rows, fields] 형태의 배열을 반환하므로 [[row]] 형태로 리턴합니다.
    mockPool.execute = jest.fn().mockResolvedValue([[mockDbRow]]);

    // 3. 테스트할 메서드 실행
    const result = await userRepository.findByOauthId('google', 'google-oauth-id');

    // 4. 결과 검증 (반환된 객체가 예상값과 일치하는지)
    expect(result).toEqual({
      id: 1,
      user_uuid: 'test-uuid-123',
      email: 'test@example.com',
      oauth_provider: 'google',
      oauth_id: 'google-oauth-id',
      nickname: '테스터',
      profile_image_url: 'http://image.com/profile.jpg',
      isTermsAgreed: true, // UserRepository 내부 mapToUser에서 boolean으로 변환됨
      created_at: new Date('2023-01-01T00:00:00.000Z'),
    });

    // 5. 호출 검증 (올바른 SQL과 파라미터로 호출되었는지)
    expect(mockPool.execute).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?',
      ['google', 'google-oauth-id']
    );
  });
});
