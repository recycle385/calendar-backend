import axios from 'axios';
import http from 'http';
import { AddressInfo } from 'net';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';

import { app } from '../../app';
import pool, { closeDatabaseConnection } from '../../config/database';
import { connectRedis, disconnectRedis, redisClient } from '../../config/redis';
import { initializeSocketIO } from '../../sockets';

// 타임아웃 30초 설정 (통합 테스트용)
jest.setTimeout(30000);

// Mocks
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../../constants/token.constants', () => {
  const original = jest.requireActual('../../constants/token.constants');
  return { ...original, GRACE_PERIOD: 0 };
});

describe('Socket.IO Integration Test', () => {
  let httpServer: http.Server;
  let serverAddress: string;

  // Data
  let hostAccessToken: string;
  let calendarSlug: string;
  let hostParticipantToken: string;
  let guestParticipantToken: string;

  // Sockets
  let clientSocketHost: ClientSocket;
  let clientSocketGuest: ClientSocket;

  const mockGoogleProfile = {
    id: 'host_123',
    email: 'host@test.com',
    name: 'HostUser',
    picture: 'profile.jpg',
  };

  // =================================================================
  // Setup & Teardown
  // =================================================================
  beforeAll(async () => {
    // 1. 인프라 연결
    await connectRedis();
    httpServer = http.createServer(app);
    initializeSocketIO(httpServer);

    // 2. 서버 주소 바인딩 (실제 포트 확보)
    await new Promise<void>((resolve) => {
      httpServer.listen(() => {
        const addr = httpServer.address() as AddressInfo;
        serverAddress = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    // 3. 리소스 정리
    if (clientSocketHost?.connected) clientSocketHost.disconnect();
    if (clientSocketGuest?.connected) clientSocketGuest.disconnect();

    httpServer.close();
    await closeDatabaseConnection();
    await disconnectRedis();
  });

  beforeEach(async () => {
    // DB & Redis 초기화
    await pool.query('DELETE FROM votes');
    await pool.query('DELETE FROM participants');
    await pool.query('DELETE FROM date_options');
    await pool.query('DELETE FROM calendars');
    await pool.query('DELETE FROM users');
    if (redisClient.isOpen) await redisClient.flushAll();

    // 데이터 셋업 (토큰 발급)
    mockedAxios.post.mockResolvedValueOnce({ data: { access_token: 'acc', id_token: 'id' } });
    mockedAxios.get.mockResolvedValueOnce({ data: mockGoogleProfile });

    const loginRes = await request(app)
      .get('/api/v1/auth/google/callback')
      .query({ code: 'auth_code' });
    hostAccessToken = loginRes.body.token;

    const calRes = await request(app)
      .post('/api/v1/calendars')
      .set('Authorization', `Bearer ${hostAccessToken}`)
      .send({
        title: '소켓 테스트 캘린더',
        start_date: '2026-01-01',
        end_date: '2026-01-05',
        hostNickname: '방장',
      });

    calendarSlug = calRes.body.calendar.slug;
    hostParticipantToken = calRes.body.participantToken;

    const joinRes = await request(app)
      .post(`/api/v1/calendars/${calendarSlug}/participants`)
      .send({ nickname: '게스트', password: '1234' });

    guestParticipantToken = joinRes.body.participantToken;
  });

  afterEach(() => {
    // 각 테스트 종료 후 소켓 강제 해제
    if (clientSocketHost) {
      clientSocketHost.removeAllListeners();
      clientSocketHost.disconnect();
    }
    if (clientSocketGuest) {
      clientSocketGuest.removeAllListeners();
      clientSocketGuest.disconnect();
    }
    jest.clearAllMocks();
  });

  // =================================================================
  // [Scenario 1] 소켓 연결 인증
  // =================================================================
  describe('[Scenario 1] 소켓 연결 인증', () => {
    it('유효한 토큰으로 연결 시 성공해야 한다', async () => {
      // ⭐️ 정석 1: forceNew: true로 독립적인 클라이언트 생성
      clientSocketHost = Client(serverAddress, {
        auth: { token: hostParticipantToken },
        transports: ['websocket'],
        forceNew: true,
      });

      // ⭐️ 정석 2: 이벤트를 Promise로 기다림 (Sleep 없음)
      await new Promise<void>((resolve, reject) => {
        clientSocketHost.on('connect', () => {
          try {
            expect(clientSocketHost.connected).toBe(true);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
        clientSocketHost.on('connect_error', (err) => reject(err));
      });
    });

    it('토큰 없이 연결 시도시 연결이 거부되어야 한다', async () => {
      clientSocketHost = Client(serverAddress, {
        transports: ['websocket'],
        forceNew: true, // 필수
      });

      await new Promise<void>((resolve, reject) => {
        clientSocketHost.on('connect_error', (err) => {
          try {
            expect(err.message).toBe('Socket 인증 토큰이 필요합니다');
            resolve();
          } catch (e) {
            reject(e);
          }
        });
        // 연결이 성공하면 실패로 간주
        clientSocketHost.on('connect', () => reject(new Error('인증 없이 연결됨')));
      });
    });
  });

  // =================================================================
  // [Scenario 2] 룸 입장 및 유저 현황
  // =================================================================
  describe('[Scenario 2] 룸 입장 및 유저 현황', () => {
    it('유저 입장 시 onlineUsers 이벤트와 userOnline 이벤트가 발생해야 한다', async () => {
      // 1. 호스트 연결
      clientSocketHost = Client(serverAddress, {
        auth: { token: hostParticipantToken },
        transports: ['websocket'],
        forceNew: true,
      });

      // 호스트 입장 흐름: 연결되면 -> 입장 emit -> 이벤트 수신 대기
      const hostProcess = new Promise<void>((resolve, reject) => {
        clientSocketHost.on('connect', () => {
          clientSocketHost.emit('joinCalendarRoom');
        });

        // "내가 입장했을 때" 현재 인원(나 혼자) 확인
        clientSocketHost.on('onlineUsers', (users: any[]) => {
          try {
            if (users.length === 1) {
              // 게스트 들어오기 전
              expect(users[0].nickname).toBe('방장');
              resolve();
            }
          } catch (e) {
            reject(e);
          }
        });
        clientSocketHost.on('connect_error', reject);
      });

      await hostProcess; // 호스트 입장 완료 보장

      // 2. 게스트 연결
      clientSocketGuest = Client(serverAddress, {
        auth: { token: guestParticipantToken },
        transports: ['websocket'],
        forceNew: true,
      });

      // 호스트가 게스트 입장을 감지하는지 확인 (Promise)
      const hostObservePromise = new Promise<void>((resolve, reject) => {
        clientSocketHost.on('userOnline', (user: any) => {
          try {
            expect(user.nickname).toBe('게스트');
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });

      // 게스트 입장 시도
      const guestJoinPromise = new Promise<void>((resolve) => {
        clientSocketGuest.on('connect', () => {
          clientSocketGuest.emit('joinCalendarRoom');
          resolve();
        });
      });

      await guestJoinPromise;
      await hostObservePromise; // 호스트가 감지할 때까지 대기
    });
  });

  // =================================================================
  // [Scenario 3] 실시간 투표 알림
  // =================================================================
  describe('[Scenario 3] 실시간 투표 알림', () => {
    it('API로 투표 제출 시, 다른 클라이언트에게 voteUpdated 이벤트가 전송되어야 한다', async () => {
      // 두 클라이언트 준비
      clientSocketHost = Client(serverAddress, {
        auth: { token: hostParticipantToken },
        transports: ['websocket'],
        forceNew: true,
      });
      clientSocketGuest = Client(serverAddress, {
        auth: { token: guestParticipantToken },
        transports: ['websocket'],
        forceNew: true,
      });

      // 둘 다 입장 시키기 (Promise.all로 병렬 처리)
      await Promise.all(
        [clientSocketHost, clientSocketGuest].map(
          (s) =>
            new Promise<void>((resolve) => {
              s.on('connect', () => {
                s.emit('joinCalendarRoom');
                resolve();
              });
            })
        )
      );

      // 게스트: 투표 업데이트 이벤트 대기 (Promise)
      const voteUpdatePromise = new Promise<any>((resolve) => {
        clientSocketGuest.on('voteUpdated', (data) => resolve(data));
      });

      // 호스트: API 투표 수행
      const voteDate = '2026-01-01';
      await request(app)
        .post(`/api/v1/calendars/${calendarSlug}/votes`)
        .set('Authorization', `Bearer ${hostParticipantToken}`)
        .send({ selectedDates: [voteDate], voteType: 'available' })
        .expect(200);

      // 결과 검증
      const eventData = await voteUpdatePromise;
      expect(eventData.calendarSlug).toBe(calendarSlug);
      expect(Array.isArray(eventData.voteStatus)).toBe(true);
    });
  });

  // =================================================================
  // [Scenario 4] 연결 종료 및 삭제 브로드캐스트
  // =================================================================
  describe('[Scenario 4] 연결 종료 및 삭제 브로드캐스트', () => {
    it('클라이언트가 연결을 끊으면 userOffline 이벤트가 발생해야 한다', async () => {
      clientSocketHost = Client(serverAddress, {
        auth: { token: hostParticipantToken },
        transports: ['websocket'],
        forceNew: true,
      });
      clientSocketGuest = Client(serverAddress, {
        auth: { token: guestParticipantToken },
        transports: ['websocket'],
        forceNew: true,
      });

      // 입장
      await Promise.all(
        [clientSocketHost, clientSocketGuest].map(
          (s) =>
            new Promise<void>((resolve) => {
              s.on('connect', () => {
                s.emit('joinCalendarRoom');
                resolve();
              });
            })
        )
      );

      // 호스트: 퇴장 이벤트 대기
      const offlinePromise = new Promise<any>((resolve) => {
        clientSocketHost.on('userOffline', (data) => resolve(data));
      });

      // 게스트: 연결 종료
      clientSocketGuest.disconnect();

      const data = await offlinePromise;
      expect(data.nickname).toBe('게스트');
    });

    it('캘린더 삭제 API 호출 시 소켓 연결이 해제되어야 한다', async () => {
      clientSocketGuest = Client(serverAddress, {
        auth: { token: guestParticipantToken },
        transports: ['websocket'],
        forceNew: true,
      });

      // 게스트 입장
      await new Promise<void>((resolve) => {
        clientSocketGuest.on('connect', () => {
          clientSocketGuest.emit('joinCalendarRoom');
          resolve();
        });
      });

      // 연결 끊김(disconnect) 이벤트 대기
      const disconnectPromise = new Promise<void>((resolve) => {
        clientSocketGuest.on('disconnect', () => resolve());
      });

      // API 호출: 캘린더 삭제
      await request(app)
        .delete(`/api/v1/calendars/${calendarSlug}`)
        .set('Authorization', `Bearer ${hostParticipantToken}`)
        .expect(200);

      // 검증
      await disconnectPromise;
      expect(clientSocketGuest.connected).toBe(false);
    });
  });
});
