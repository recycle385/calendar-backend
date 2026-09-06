# Calendar Backend

모임 날짜 조율 캘린더 백엔드입니다. Google OAuth 로그인, 캘린더 생성/참가, 날짜별 투표, 공휴일 정보 관리, 실시간 접속 상태 알림을 제공합니다.

## 기술 스택

- Runtime: Node.js 20
- Language: TypeScript
- Server: Express, Socket.IO
- Database: MySQL 8, Redis
- Auth: JWT, Google OAuth
- Validation: Joi
- Docs: Swagger UI
- Test: Jest, Supertest, socket.io-client
- Infra: Docker, Docker Compose, PM2

## 주요 기능

- Google OAuth 로그인 및 회원가입
- Access Token / Refresh Token 발급, 갱신, 로그아웃
- 공유 가능한 slug 기반 캘린더 생성, 조회, 수정, 삭제, 마감
- 회원/비회원 참가자 등록 및 참가자 토큰 발급
- 날짜별 투표 제출, 수정, 집계 조회
- 공휴일/기념일 `date_info` 데이터 등록, 조회, 삭제
- Socket.IO 기반 캘린더 방 입장/퇴장 및 온라인 사용자 알림
- Cron 기반 자동 마감, 만료 캘린더 삭제, 공휴일 데이터 정기 업데이트

## 프로젝트 구조

```text
src
├─ app.ts                         # Express 앱 및 공통 미들웨어 등록
├─ web.ts                         # DB/Redis/Socket/Cron 초기화 후 서버 시작
├─ config                         # env, database, redis, swagger, logger 설정
├─ constants                      # API prefix 및 라우트 상수
├─ containers                     # controller/service/repository 의존성 조립
├─ controllers                    # HTTP 요청/응답 처리
├─ services                       # 비즈니스 로직
├─ repositories                   # MySQL/Redis 데이터 접근
├─ models                         # 도메인 모델, DTO, DB schema
├─ middlewares                    # 인증, 검증, 로깅, CORS, rate limit, 에러 처리
├─ routes                         # Express 라우터
├─ sockets                        # Socket.IO 초기화 및 이벤트 처리
├─ utils                          # JWT, 날짜, 공공데이터 API, 에러 유틸
├─ types                          # Express/Socket/Auth 타입 확장
└─ __tests__                      # unit/integration 테스트
```

## 실행 준비

```bash
npm install
```

필수 환경 변수는 `.env` 또는 테스트 환경의 `.env.test`에 설정합니다.

```env
PORT=4000
NODE_ENV=development

MAIN_JWT_SECRET=...
PARTICIPANT_JWT_SECRET=...
REFRESH_JWT_SECRET=...
LEGACY_JWT_SECRET=...
SESSION_SECRET=...
SIGNUP_MODE=immediate
HOST_ACCESS_TOKEN=...

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=...
DB_USER_PASSWORD=...
DB_ROOT_PASSWORD=...
DB_NAME=...
DB_CONNECTION_LIMIT=10

REDIS_URL=redis://127.0.0.1:6379

CLIENT_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

GET_REST_DE_INFO=...
ENABLE_RATE_LIMIT=false
```

`MAIN_JWT_SECRET`, `PARTICIPANT_JWT_SECRET`, `REFRESH_JWT_SECRET`은 서로 다른 긴 무작위 값으로 설정합니다. `LEGACY_JWT_SECRET`은 기존 단일 JWT secret에서 분리 배포할 때만 임시로 설정하고, 기존 토큰 만료 기간이 지난 뒤 제거합니다. `SIGNUP_MODE`는 `pending` 또는 `immediate`, `ENABLE_RATE_LIMIT`는 `true` 또는 `false`만 허용합니다. `DB_ROOT_PASSWORD`는 Docker Compose의 MySQL 컨테이너에서 사용합니다. 애플리케이션 내부 검증 필수값은 `src/config/env.ts` 기준입니다.

## 개발 실행

로컬 MySQL/Redis를 직접 띄운 뒤 개발 서버를 실행합니다.

```bash
npm run dev
```

Docker Compose로 앱, MySQL, Redis를 함께 실행할 수도 있습니다.

```bash
docker compose up --build
```

DB 초기 스키마는 `src/models/schema/calendar_db.sql`이 MySQL 컨테이너 시작 시 적용됩니다.

## 빌드 및 운영

```bash
npm run build
npm run start
```

`npm run build`는 TypeScript를 `dist`로 컴파일합니다. `npm run start`는 PM2로 `dist/web.js`를 `tooniz` 이름으로 실행합니다.

```bash
npm run reload
npm run stop
```

## 테스트

테스트용 MySQL/Redis는 `docker-compose.test.yml` 기준으로 각각 `3307`, `6380` 포트를 사용합니다.

```bash
docker compose -f docker-compose.test.yml up -d db redis
npm test
```

Jest 설정은 `jest.config.js`에 있으며 `src/__tests__/**/*.test.ts`를 실행합니다.

## API

모든 HTTP API는 `/api/v1` prefix를 사용합니다. Swagger UI는 `/api/v1/api-docs`에서 확인할 수 있습니다.

### Auth

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/v1/auth/google` | Google OAuth 로그인 페이지로 리다이렉트 |
| GET | `/api/v1/auth/google/callback` | Google OAuth 콜백 처리 |
| POST | `/api/v1/auth/register` | signupToken 기반 회원가입 완료 |
| POST | `/api/v1/auth/refresh` | Refresh Token으로 Access Token 갱신 |
| POST | `/api/v1/auth/logout` | Refresh Token 무효화 및 쿠키 삭제 |

### Calendars

| Method | Path | 인증 | 설명 |
| --- | --- | --- | --- |
| POST | `/api/v1/calendars` | UserAuth | 캘린더 생성 |
| GET | `/api/v1/calendars/my` | UserAuth | 내 캘린더 목록 조회 |
| GET | `/api/v1/calendars/:slug` | 없음 | slug로 캘린더 조회 |
| PATCH | `/api/v1/calendars/:slug` | ParticipantAuth | 방장 캘린더 수정 |
| DELETE | `/api/v1/calendars/:slug` | ParticipantAuth | 방장 캘린더 삭제 |
| POST | `/api/v1/calendars/:slug/close` | ParticipantAuth | 방장 캘린더 마감 |

### Participants

| Method | Path | 인증 | 설명 |
| --- | --- | --- | --- |
| POST | `/api/v1/calendars/:slug/participants` | 선택 UserAuth | 참가자 등록 |
| POST | `/api/v1/calendars/:slug/participants/login` | 선택 UserAuth | 참가자 로그인 |
| GET | `/api/v1/calendars/:slug/participants` | 없음 | 참가자 및 투표 현황 조회 |
| DELETE | `/api/v1/calendars/:slug/participants/self` | ParticipantAuth | 본인 참가자 삭제 |
| DELETE | `/api/v1/calendars/:slug/participants/:uuid` | ParticipantAuth | 방장이 참가자 강퇴 |

### Votes

| Method | Path | 인증 | 설명 |
| --- | --- | --- | --- |
| POST | `/api/v1/calendars/:slug/votes` | ParticipantAuth | 투표 제출 및 수정 |
| GET | `/api/v1/calendars/:slug/votes` | 없음 | 캘린더 전체 투표 현황 조회 |
| GET | `/api/v1/calendars/:slug/votes/:participantUuid` | 없음 | 특정 참가자 투표 내역 조회 |

투표 타입은 `available`, `unavailable`, `maybe` 중 하나입니다.

### Date Infos

| Method | Path | 설명 |
| --- | --- | --- |
| POST | `/api/v1/date-infos` | 공휴일/기념일 단건 등록 |
| POST | `/api/v1/date-infos/batch` | 공휴일/기념일 배치 등록 |
| GET | `/api/v1/date-infos` | 전체 조회 |
| GET | `/api/v1/date-infos/years?years[]=2025` | 여러 연도 조회 |
| GET | `/api/v1/date-infos/before?year=2025` | 특정 연도 이전 조회 |
| GET | `/api/v1/date-infos/kinds?years[]=2025&dateKinds[]=01` | 여러 연도와 종류로 조회 |
| GET | `/api/v1/date-infos/:year/kinds?dateKinds[]=01` | 특정 연도와 종류로 조회 |
| GET | `/api/v1/date-infos/:year` | 특정 연도 조회 |
| DELETE | `/api/v1/date-infos/before?year=2025` | 특정 연도 이전 삭제 |
| DELETE | `/api/v1/date-infos` | 날짜/이름 쌍으로 삭제 |

`dateKind` 값은 `01`, `02`, `03`, `04`, `05`를 사용합니다.

## 인증 방식

- `UserAuth`: Google 로그인 사용자의 JWT입니다. `Authorization: Bearer <accessToken>` 헤더를 사용합니다.
- `ParticipantAuth`: 캘린더 참가자의 JWT입니다. 캘린더 수정, 삭제, 마감, 투표 제출 등에 사용합니다.
- Refresh Token은 쿠키 기반으로 처리합니다.

## Socket.IO

Socket.IO는 HTTP 서버 위에서 초기화되며 `websocket` transport를 사용합니다. 연결 시 참가자 토큰이 필요합니다.

```ts
io("http://localhost:4000", {
  transports: ["websocket"],
  auth: { token: participantToken },
});
```

클라이언트 이벤트:

- `joinCalendarRoom`: 현재 토큰의 캘린더 방에 입장
- `leaveCalendarRoom`: 캘린더 방에서 퇴장

서버 이벤트:

- `onlineUsers`: 현재 방의 온라인 사용자 목록
- `userOnline`: 다른 사용자의 입장 알림
- `userOffline`: 다른 사용자의 퇴장 알림
- `calendarClosed`: 캘린더 자동 마감 알림
- `calendarDeleted`: 만료 캘린더 삭제 알림

## Cron 작업

`src/services/cron.service.ts`에서 서버 시작 시 다음 작업을 등록합니다.

- 매일 04:00: 보관 기간이 지난 캘린더 삭제, 투표 기간이 끝난 캘린더 자동 마감
- 매년 12월 1일 04:00: 공공데이터 API 기반 공휴일 정보 업데이트 및 오래된 date-info 정리

## 데이터베이스

스키마 파일은 `src/models/schema/calendar_db.sql`입니다.

- `users`: Google OAuth 사용자
- `calendars`: 모임 캘린더
- `date_info`: 공휴일/기념일 정보
- `participants`: 캘린더 참가자
- `date_options`: 투표 대상 날짜
- `votes`: 참가자별 날짜 투표

## 참고 사항

- API 요청 검증은 `src/middlewares/validation.ts`의 Joi schema를 기준으로 합니다.
- 공통 에러 처리는 `src/middlewares/errorHandler.ts`와 `src/utils/errors`에서 관리합니다.
- Redis는 토큰 블랙리스트, rate limit, Socket.IO 관련 기능에 사용됩니다.
- `ENABLE_RATE_LIMIT=true`일 때 `/api/v1` 하위 API에 rate limiter가 적용됩니다.

### 공휴일 데이터 출처 보존

공휴일의 저장 키는 날짜·종류·순번·출처입니다. 같은 날짜와 순번의 `public-api`와 `custom` 항목은 별도로 보존하며, 재동기화는 같은 출처의 항목만 갱신합니다. 서버 시작 시 기존 유니크 키를 하나의 ALTER TABLE로 교체합니다. 이미 이전 동기화에서 덮어써진 데이터는 백업에서 복원해야 합니다. 과거 수동 마이그레이션 SQL을 최신 마이그레이션 이후에 다시 실행하지 마세요.
