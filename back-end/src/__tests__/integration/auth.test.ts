import axios from 'axios';
import request from 'supertest';

import { app } from '../../app';
import pool, { closeDatabaseConnection } from '../../config/database';
import { env } from '../../config/env';
import { connectRedis, disconnectRedis, redisClient } from '../../config/redis';

// [중요] 1. Token Constants Mocking (유예 기간 제거)
// 로그아웃 테스트 시 Grace Period 때문에 즉시 차단되지 않는 문제를 해결하기 위해 0으로 설정
jest.mock('../../constants/token.constants', () => {
  const originalModule = jest.requireActual('../../constants/token.constants'); // 실제 모듈 가져오기
  return {
    __esModule: true,
    ...originalModule, // 기존 상수(MAIN_TOKEN_EXPIRES_IN 등)는 그대로 유지
    GRACE_PERIOD: -1, // 테스트를 위해 유예 기간만 0초로 덮어쓰기
  };
});

// 2. Google API (Axios) Mocking
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// 3. 환경 변수 설정
Object.defineProperty(env, 'SIGNUP_MODE', { value: 'immediate' });

describe('Auth Integration Test', () => {
  // 테스트 데이터
  const mockAuthCode = 'mock_google_auth_code';
  const mockGoogleTokens = {
    access_token: 'mock_access_token',
    id_token: 'mock_id_token',
  };
  const mockGoogleProfile = {
    id: '123456789',
    email: 'testuser@example.com',
    name: 'Test User',
    picture: 'http://example.com/profile.jpg',
  };

  beforeAll(async () => {
    await connectRedis();
  });

  afterAll(async () => {
    await closeDatabaseConnection();
    await disconnectRedis();
  });

  afterEach(async () => {
    await pool.query('DELETE FROM users');
    if (redisClient.isOpen) {
      await redisClient.flushAll();
    }
    jest.clearAllMocks();
  });

  // =================================================================
  // 1. Google 로그인 및 회원가입
  // =================================================================
  describe('GET /api/v1/auth/google/callback', () => {
    it('신규 유저가 로그인하면 DB에 유저가 생성되고 토큰이 발급되어야 한다', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: mockGoogleTokens });
      mockedAxios.get.mockResolvedValueOnce({ data: mockGoogleProfile });

      const response = await request(app)
        .get('/api/v1/auth/google/callback')
        .query({ code: mockAuthCode });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('로그인 성공');
      expect(response.body.token).toBeDefined();

      // [수정] oauth_id는 Controller에서 제거해서 보내주므로 검증에서 제외
      expect(response.body.user).toMatchObject({
        email: mockGoogleProfile.email,
        nickname: mockGoogleProfile.name,
        // oauth_id: ...  <-- 삭제됨
      });

      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/jwt=eyJ/);

      const [rows]: any = await pool.query('SELECT * FROM users WHERE email = ?', [
        mockGoogleProfile.email,
      ]);
      expect(rows.length).toBe(1);
      expect(rows[0].nickname).toBe(mockGoogleProfile.name);
    });

    it('기존 유저가 로그인하면 새로운 토큰만 발급되어야 한다 (DB 추가 없음)', async () => {
      await pool.query(
        `INSERT INTO users (user_uuid, email, oauth_provider, oauth_id, nickname, profile_image_url)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'existing-uuid',
          mockGoogleProfile.email,
          'google',
          mockGoogleProfile.id,
          'Existing User',
          'img.jpg',
        ]
      );

      mockedAxios.post.mockResolvedValueOnce({ data: mockGoogleTokens });
      mockedAxios.get.mockResolvedValueOnce({ data: mockGoogleProfile });

      const response = await request(app)
        .get('/api/v1/auth/google/callback')
        .query({ code: mockAuthCode });

      expect(response.status).toBe(200);
      expect(response.body.isNewUser).toBe(false);

      const [rows]: any = await pool.query('SELECT COUNT(*) as count FROM users');
      expect(rows[0].count).toBe(1);
    });
  });

  // =================================================================
  // 2. 토큰 갱신
  // =================================================================
  describe('POST /api/v1/auth/refresh', () => {
    let refreshTokenCookie: string;

    beforeEach(async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: mockGoogleTokens });
      mockedAxios.get.mockResolvedValueOnce({ data: mockGoogleProfile });

      const loginRes = await request(app)
        .get('/api/v1/auth/google/callback')
        .query({ code: mockAuthCode });

      if (loginRes.headers['set-cookie']) {
        refreshTokenCookie = loginRes.headers['set-cookie'][0].split(';')[0];
      }
    });

    it('유효한 Refresh Token으로 요청 시 새로운 Access/Refresh 토큰을 발급해야 한다', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [refreshTokenCookie]);

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();

      const newCookies = response.headers['set-cookie'];
      expect(newCookies).toBeDefined();
      const newRefreshToken = newCookies[0].split(';')[0];

      expect(newRefreshToken).not.toBe(refreshTokenCookie);
    });

    it('Refresh Token 없이 요청 시 401 에러를 반환해야 한다', async () => {
      const response = await request(app).post('/api/v1/auth/refresh');
      expect(response.status).toBe(401);
    });
  });

  // =================================================================
  // 3. 로그아웃
  // =================================================================
  describe('POST /api/v1/auth/logout', () => {
    let refreshTokenCookie: string;

    beforeEach(async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: mockGoogleTokens });
      mockedAxios.get.mockResolvedValueOnce({ data: mockGoogleProfile });

      const loginRes = await request(app)
        .get('/api/v1/auth/google/callback')
        .query({ code: mockAuthCode });

      if (loginRes.headers['set-cookie']) {
        const cookieStr = loginRes.headers['set-cookie'][0];
        refreshTokenCookie = cookieStr.split(';')[0];
      }
    });

    it('로그아웃 시 쿠키가 삭제되고, Refresh Token이 Redis 블랙리스트에 등록되어야 한다', async () => {
      // 1. 로그아웃 요청
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [refreshTokenCookie]);

      expect(response.status).toBe(200);

      const logoutCookies = response.headers['set-cookie'][0];
      // 쿠키 삭제 확인 (Expires가 과거 or Max-Age=0)
      expect(logoutCookies).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/);

      // 2. 블랙리스트 등록 검증 (재사용 시도)
      // 상단에서 GRACE_PERIOD를 0으로 Mocking 했으므로 즉시 차단되어야 함
      const refreshRetryRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [refreshTokenCookie]);

      expect(refreshRetryRes.status).toBe(401);
    });
  });

  // =================================================================
  // 4. [Security] RTR (Refresh Token Rotation) 재사용 감지 테스트
  // =================================================================
  describe('Security: Refresh Token Reuse Detection', () => {
    let oldRefreshTokenCookie: string;
    let newRefreshTokenCookie: string;

    beforeEach(async () => {
      // 1. 로그인
      mockedAxios.post.mockResolvedValueOnce({ data: mockGoogleTokens });
      mockedAxios.get.mockResolvedValueOnce({ data: mockGoogleProfile });

      const loginRes = await request(app)
        .get('/api/v1/auth/google/callback')
        .query({ code: mockAuthCode });

      oldRefreshTokenCookie = loginRes.headers['set-cookie'][0].split(';')[0];
    });

    it('이미 사용된(갱신된) Refresh Token을 다시 사용하면 차단되어야 한다 (Reuse Detection)', async () => {
      // 2. 정상 갱신 (Token A -> Token B)
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [oldRefreshTokenCookie]); // Token A 사용

      expect(refreshRes.status).toBe(200);
      newRefreshTokenCookie = refreshRes.headers['set-cookie'][0].split(';')[0]; // Token B 획득

      // 3. [해킹 시뮬레이션] 이미 쓴 Token A로 다시 갱신 시도
      const hackRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [oldRefreshTokenCookie]); // 버려진 Token A 재사용

      // 4. 검증: 차단되어야 함
      // (서버 구현에 따라 401 Unauthorized 또는 403 Forbidden)
      expect([401, 403]).toContain(hackRes.status);

      // [심화 검증 옵션]
      // 강력한 보안 정책이라면, 해킹 시도가 감지되었을 때
      // 방금 발급해준 유효한 Token B까지도 싹 다 만료(Invalidate)시켜버려야 함.
      // (유저에게 다시 로그인하라고 강제함)
      /*
      const checkValidTokenRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [newRefreshTokenCookie]); // Token B 사용
      
      expect(checkValidTokenRes.status).toBe(401); // 너도 죽어야 한다
      */
    });

    // =================================================================
    // 5. [Access Control] 토큰 유효성 및 미들웨어 검증
    // =================================================================
    describe('Access Token Validation & Protected Routes', () => {
      let validAccessToken: string;

      beforeEach(async () => {
        // [설정] 이메일 중복 방지용 고유 프로필
        const uniqueProfile = {
          ...mockGoogleProfile,
          id: 'validator_id_1',
          email: 'validator@example.com',
        };

        mockedAxios.post.mockResolvedValueOnce({ data: mockGoogleTokens });
        mockedAxios.get.mockResolvedValueOnce({ data: uniqueProfile });

        const res = await request(app)
          .get('/api/v1/auth/google/callback')
          .query({ code: mockAuthCode });

        validAccessToken = res.body.token;
      });

      it('유효한 Access Token으로 보호된 라우트(내 캘린더 조회)에 접근할 수 있어야 한다', async () => {
        const response = await request(app)
          .get('/api/v1/calendars/my')
          .set('Authorization', `Bearer ${validAccessToken}`);

        expect(response.status).toBe(200);
      });

      it('헤더에 토큰이 없으면 401 Unauthorized 에러를 반환해야 한다', async () => {
        const response = await request(app).get('/api/v1/calendars/my');
        expect(response.status).toBe(401);
      });

      it('변조된(유효하지 않은) 토큰으로 접근 시 401 에러를 반환해야 한다', async () => {
        const response = await request(app)
          .get('/api/v1/calendars/my')
          .set('Authorization', 'Bearer invalid_token_string');

        expect(response.status).toBe(401);
      });
    });

    // =================================================================
    // 6. [Scenario] User Guest (회원 자격으로 남의 방 참가) 인증 테스트
    // =================================================================
    describe('Integration: User Guest Authentication', () => {
      let hostToken: string;
      let calendarSlug: string;

      // 테스트용 방장(Host) 및 캘린더 설정
      beforeEach(async () => {
        // 1. Host 로그인 (고유 계정)
        const hostProfile = {
          ...mockGoogleProfile,
          id: 'host_user_1',
          email: 'host_1@test.com',
        };

        mockedAxios.post.mockResolvedValueOnce({ data: mockGoogleTokens });
        mockedAxios.get.mockResolvedValueOnce({ data: hostProfile });

        const hostLogin = await request(app)
          .get('/api/v1/auth/google/callback')
          .query({ code: 'code_host_1' });

        hostToken = hostLogin.body.token;

        // 2. 캘린더 생성
        const calRes = await request(app)
          .post('/api/v1/calendars')
          .set('Authorization', `Bearer ${hostToken}`)
          .send({
            title: 'User Guest Test Room',
            start_date: '2025-01-01',
            end_date: '2025-01-31',
            hostNickname: 'HostNick', // [필드명 확인완료]
          });

        // [수정 핵심] slug는 calendar 객체 안에 있습니다!
        calendarSlug = calRes.body.calendar.slug;
      });

      it('다른 유저(Guest)가 로그인 후, 비밀번호 없이 토큰만으로 참가 요청 시 인증되어야 한다', async () => {
        // 1. Guest 유저(User B) 로그인 모킹
        const guestProfile = {
          id: 'guest_999',
          email: 'guest_user@test.com', // 고유 계정
          name: 'Guest User',
          picture: 'guest.jpg',
        };
        mockedAxios.post.mockResolvedValueOnce({ data: { access_token: 'guest_token' } });
        mockedAxios.get.mockResolvedValueOnce({ data: guestProfile });

        const guestLoginRes = await request(app)
          .get('/api/v1/auth/google/callback')
          .query({ code: 'code_guest' });
        const guestAccessToken = guestLoginRes.body.token;

        // 2. User Guest 참가 요청
        const joinRes = await request(app)
          .post(`/api/v1/calendars/${calendarSlug}/participants`)
          .set('Authorization', `Bearer ${guestAccessToken}`)
          .send({
            nickname: 'Participating User', // [필드명 확인완료]
          });

        expect(joinRes.status).toBe(201);

        // 3. DB 검증
        const [rows]: any = await pool.query(
          'SELECT user_id, nickname FROM participants WHERE participant_uuid = ?',
          [joinRes.body.participant.uuid]
        );
        expect(rows[0].user_id).not.toBeNull();
        expect(rows[0].nickname).toBe('Participating User');
      });
    });

    // =================================================================
    // 7. [Scenario] Non-Member Guest (비회원) 로그인 테스트
    // =================================================================
    describe('Integration: Non-Member Guest Login', () => {
      let calendarSlug: string;
      let guestUuid: string;
      const guestPassword = 'guestPassword123';

      beforeEach(async () => {
        // 1. 캘린더 생성을 위한 임시 Host 로그인
        const hostProfile = {
          ...mockGoogleProfile,
          id: 'host_user_2',
          email: 'host_2@test.com',
        };

        mockedAxios.post.mockResolvedValue({ data: mockGoogleTokens });
        mockedAxios.get.mockResolvedValue({ data: hostProfile });

        const loginRes = await request(app)
          .get('/api/v1/auth/google/callback')
          .query({ code: 'code_host_2' });
        const token = loginRes.body.token;

        // 2. 캘린더 생성
        const calRes = await request(app)
          .post('/api/v1/calendars')
          .set('Authorization', `Bearer ${token}`)
          .send({
            title: 'Guest Login Test',
            start_date: '2025-01-01',
            end_date: '2025-01-05',
            hostNickname: 'HostForGuest',
          });

        calendarSlug = calRes.body.calendar.slug;

        // 3. 비회원 참가 (가입)
        const joinRes = await request(app)
          .post(`/api/v1/calendars/${calendarSlug}/participants`)
          .send({ nickname: 'NonMember', password: guestPassword });

        guestUuid = joinRes.body.participant.uuid;
      });

      it('비회원이 닉네임과 비밀번호로 로그인하면 게스트 전용 토큰을 발급받아야 한다', async () => {
        const loginRes = await request(app)
          .post(`/api/v1/calendars/${calendarSlug}/participants/login`)
          .send({
            nickname: 'NonMember',
            password: guestPassword,
          });

        expect(loginRes.status).toBe(200);
        // [수정] Controller 응답 키에 맞춰 token -> participantToken 변경
        expect(loginRes.body.participantToken).toBeDefined();
      });

      it('비회원이 틀린 비밀번호로 로그인 시도 시 401 에러를 반환해야 한다', async () => {
        const loginRes = await request(app)
          .post(`/api/v1/calendars/${calendarSlug}/participants/login`)
          .send({
            nickname: 'NonMember',
            password: 'WrongPassword',
          });

        expect(loginRes.status).toBe(401);
      });
    });
  });
});
