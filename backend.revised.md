# Backend Revision Record

- 작성일: 2026-07-10
- 최근 수정: 2026-07-11
- 대상: `back-end`
- 목적: MVP 아키텍처 리뷰에서 확인된 불필요 구성과 운영상 중요 문제 수정
- 원칙: 50명 단일 인스턴스 MVP 구조는 유지하고, 기능 요구가 있거나 향후 사용 가능성이 높은 도메인 코드는 보존한다.

## 최종 판단

Controller-Service-Repository 구조, 수동 DI Container, MySQL, Redis, Socket.IO, Cron은 현재 요구에 맞으므로 유지했다. 이번 수정은 구조 변경이 아니라 미사용 의존성, 대체된 코드, 중복 인프라와 실제 운영 오류를 제거하는 데 한정했다.

## 1. 미사용 의존성 제거

### 판단 근거

소스, 테스트, 실행 설정 전체에서 import 또는 호출되지 않는 패키지를 검색했다. 설치만 되어 있는 패키지는 이미지 크기, 취약점 노출 범위, 업데이트 비용을 늘리므로 제거 대상으로 판단했다.

### 제거한 런타임 의존성

- `@portone/server-sdk`
- `@socket.io/redis-adapter`
- `body-parser`
- `bullmq`
- `express-mysql-session`
- `express-session`
- `ioredis`
- `morgan`
- `opossum`
- `tree-cli`
- `tree-node-cli`
- `winston-daily-rotate-file`

관련 미사용 `@types/*` 패키지도 함께 제거했다. `package-lock.json`은 `npm install --package-lock-only --ignore-scripts`로 동기화했다.

### 유지한 항목

- `redis`: 회원가입 임시 토큰, Refresh Token 폐기, Rate Limit에 실제 사용한다.
- `socket.io`: 실시간 투표와 접속자 상태에 사용한다.
- `axios`: Google OAuth와 공공데이터 API 호출에 사용한다.
- `tsx`: Docker Compose 개발 실행 명령에서 사용한다.

## 2. 로거 중복 제거

### 문제

`src/config/logger.ts`와 `src/middlewares/logger.ts`가 서로 다른 Winston 인스턴스를 생성했다. 공공데이터 API만 전자를 사용하고 나머지는 후자를 사용하여 로그 정책과 파일 관리가 분리되어 있었다. `morganLogger`는 생성만 하고 앱에 등록되지 않았다.

### 조치

- `src/config/logger.ts` 삭제
- 공공데이터 API가 공통 `middlewares/logger`를 사용하도록 변경
- 미사용 `morganLogger`와 `morgan` 의존성 제거

### 결과

애플리케이션 전체가 하나의 로거 정책과 파일 회전 설정을 사용한다.

## 3. 죽은 코드와 향후 코드 구분

### 제거한 코드

- `verifyUserToken`: 코드에 명시적으로 미사용/제거 예정이라고 표시되어 있었고 호출처가 없었다.
- JWT Signup Token 구현: 실제 회원가입 임시 토큰은 일회용 Redis 토큰을 사용하므로 중복 구현이었다.
- `getUserCalendars`와 `findByOwnerId`: 참가자 UUID를 포함하는 `getUserCalendarsWithPUuids` 경로로 완전히 대체되어 있었다.
- 관련 미사용 토큰 타입과 상수

### 유지한 코드

- `VoteSummary`와 날짜 요약 타입: 향후 투표 집계 기능에 직접 사용할 수 있는 도메인 모델이다.
- 단건 투표 Repository 메서드와 투표 삭제 메서드: 투표 초기화/부분 수정 기능에 재사용할 가능성이 있다.
- Pagination 공통 타입: 런타임 비용이 없고 목록 API 확장 시 사용할 수 있다.
- `authorize`, `safeAsyncHandler`: 향후 역할 기반 경로에서 사용할 수 있고 현재 구조와 충돌하지 않는다.

보존 항목은 현재 실행 복잡도를 만들지 않는 타입 또는 작은 확장 지점이므로 무리하게 삭제하지 않았다.

## 4. Container 구조

사용자 요청에 따라 변경하지 않았다. Controller별 Container 파일은 작지만 현재 수동 DI 구조와 테스트 대역 주입 방식에 맞으며 런타임 비용도 없다.

## 5. DateInfo 운영 기능

### 요구사항 반영

배치 생성, 운영자 직접 기념일 입력, 조건 삭제 기능은 실제 운영 요구이므로 모두 유지했다. 조회 API는 공개 상태로 유지하고 데이터 변경 API만 운영자 인증 대상으로 지정했다.

### 운영자 인증

다음 요청에 `authenticateOperator`를 적용했다.

- `POST /api/v1/date-infos`
- `POST /api/v1/date-infos/batch`
- `DELETE /api/v1/date-infos/before`
- `DELETE /api/v1/date-infos`

인증 값은 기존 `HOST_ACCESS_TOKEN` 환경변수를 사용한다.

```http
Authorization: Bearer <HOST_ACCESS_TOKEN>
```

토큰 비교는 `timingSafeEqual`을 사용한다. 환경변수가 없으면 500, 헤더가 없으면 401, 값이 틀리면 403을 반환한다. 실제 운영 환경에는 충분히 긴 무작위 값을 반드시 설정해야 한다.

## 별도 중요 문제 수정

### 2026-07-10 추가 재검토 후 수정

#### 운영/개발 의존성 취약점

- 문제: `npm audit --omit=dev` 기준 운영 의존성에 critical/high 취약점이 남아 있었고, 전체 audit에는 dev dependency critical도 남아 있었음
- 조치: `mysql2`를 3.x로 올리고, `axios`, `express`, `express-rate-limit`, `joi`, `socket.io`, `uuid`를 현재 major의 안전 패치 버전으로 갱신
- 조치: Express 4, Socket.IO 4, swagger-jsdoc, jsonwebtoken 하위 전이 의존성은 `overrides`로 취약 패치 버전에 고정
- 조치: dev dependency의 critical/high 취약점 제거를 위해 `nodemon`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`를 최신 패치로 갱신
- 조치: `mysql2` 3.x 타입 변경에 맞춰 DB connection hook의 callback query를 promise 방식으로 변경
- 검증: `npm audit` 0 vulnerabilities, `npm audit --omit=dev` 0 vulnerabilities

#### Refresh Token 회전 버그

- 문제: 정상 refresh 과정에서 기존 토큰 하나만 폐기해야 하는데 `revokeRefreshToken`이 사용자 전체 `user_revoked_at`까지 기록하여 새 refresh token도 차단될 수 있었음
- 조치: 단일 토큰 폐기(`revokeSingleRefreshToken`)와 사용자 전체 폐기(`revokeAllRefreshTokens`)를 분리
- 판단: 정상 token rotation은 이전 refresh token 재사용 탐지를 위해 이전 tokenId만 blacklist에 넣고, logout 또는 재사용 공격 감지 같은 명시적 폐기 경로에서만 사용자 전체 폐기를 기록하는 것이 맞음
- 검증: refresh 회전 시 `recordUserAndRevokedAt`이 호출되지 않는 단위 테스트 추가

#### 캘린더 날짜 범위 수정 시 `date_options` 불일치

- 문제: 캘린더 생성 시에는 날짜 옵션을 만들지만, 기간 수정 시에는 `calendars.start_date/end_date`만 바뀌고 `date_options`가 동기화되지 않았음
- 조치: 날짜 범위 변경 시 트랜잭션 안에서 캘린더를 수정하고, 새 범위 밖 `date_options`를 삭제한 뒤 새 범위 전체에 대해 batch upsert 실행
- 판단: 겹치는 날짜의 기존 `date_options`는 유지되어 기존 투표도 보존된다. 범위 밖으로 빠진 날짜는 `votes.date_option_id` FK cascade에 의해 함께 제거된다.
- 검증: 종료일 확장 및 시작일 변경 시 `deleteOutsideRange`와 `createBatch`가 호출되는 단위 테스트 추가

#### 공휴일/기념일 배치 저장 중복 실패

- 문제: 공공데이터 Cron 또는 운영자 배치 입력이 기존 행과 중복되면 plain INSERT 전체가 실패할 수 있었고, 빈 배열 입력은 `VALUES ?` 오류 가능성이 있었음
- 조치: `DateInfoRepository.insertDateInfos`에 빈 배열 guard 추가
- 조치: `ON DUPLICATE KEY UPDATE`로 중복 행은 갱신 처리
- 조치: schema 기준 unique key를 `(location_date, date_kind, seq)`로 변경하여 같은 날짜의 다른 종류 코드가 충돌하지 않도록 조정
- 조치: 기존 DB에도 같은 제약이 적용되도록 `src/models/migrations/20260711_update_date_info_unique_key.sql` 마이그레이션 추가
- 조치: 서버 시작 시 `runDatabaseMigrations`가 같은 변경을 idempotent하게 적용하도록 `src/config/migrations.ts` 추가
- 판단: 운영자가 직접 입력/삭제하는 기능은 유지하되, 배치 재실행이 멱등적으로 동작해야 Cron 운영이 안정적임
- 검증: 빈 배열 저장은 DB query 없이 0을 반환하고, batch 저장 SQL에 upsert가 포함되는 Repository 단위 테스트 추가
- 판단: `docker-entrypoint-initdb.d`의 schema 파일은 새 MySQL 볼륨에만 적용되므로, 이미 생성된 `db_data`에는 별도 ALTER가 필요하다. 앱 시작 시 자동 마이그레이션과 수동 SQL 파일을 모두 제공해 배포 방식에 따라 반영할 수 있게 했다.
- 운영 실행 예: `mysql -u calendar_user -p calendar_db < src/models/migrations/20260711_update_date_info_unique_key.sql`

#### 예상 밖 에러 로그 민감정보

- 문제: `errorHandler`가 예상 밖 500 에러에서 `req.body`를 원문 그대로 기록하여 password/token류가 로그에 남을 수 있었음
- 조치: 기존 요청 로거의 `sanitizeData`를 export하고, error handler에서도 같은 마스킹 함수를 사용
- 판단: 운영 로그는 장애 분석에 필요하지만 인증 토큰/비밀번호 원문 저장은 위험도가 더 큼

#### DateInfo 통합 테스트의 조용한 성공

- 문제: DB가 없으면 INSERT 통합 테스트가 `return`으로 빠져 실제 검증 없이 통과할 수 있었음
- 조치: DB 연결 여부를 `beforeAll`에서 확인하고, INSERT 검증 테스트는 DB가 없으면 명시적으로 실패하도록 변경
- 판단: DB 없이도 가능한 400/401 라우팅 검증은 유지하지만, DB 반영을 검증하는 테스트는 실제 DB가 없으면 실패해야 함

#### Docker/운영 빌드 정리

- 문제: 운영 이미지에서 dev dependency까지 설치하고, `tsconfig`가 테스트 파일도 `dist`에 포함했음
- 조치: Docker builder는 `npm ci`, final stage는 `npm ci --omit=dev --ignore-scripts` 사용
- 조치: `tsconfig.json`에서 `**/__tests__/**` 제외
- 조치: `npm start`를 설치되지 않은 pm2가 아니라 `node dist/web.js`로 변경
- 판단: 50명 MVP라도 운영 이미지에 테스트 산출물과 dev dependency를 넣을 이유는 없음

#### Socket onlineUsers 중복

- 문제: 방 소켓 목록을 조회한 뒤 자기 자신을 수동으로 다시 추가하여 중복 가능성이 있었음
- 조치: namespace room 전체 소켓을 조회하고 `sub` 기준 중복을 제거
- 판단: 단일 인스턴스 MVP 구조는 유지하되, 클라이언트 상태 목록은 중복 없이 전달되어야 함

### TypeScript 빌드 실패

- 원인: 현재 CommonJS 기반 패키지들과 `NodeNext` 모듈 해석 설정의 타입 호환 문제
- 조치: `module: commonjs`, `moduleResolution: node`로 실행 환경과 일치시킴
- 조치: 테스트 파일의 독립적 타입 검사를 위해 `types`에 `jest` 추가
- 조치: 에디터의 TypeScript 6이 `node` 해석 방식을 deprecated로 진단하지만 현재 의존성은 `Node16` 해석에서 타입 오류가 발생하므로, 검증된 TypeScript 5.8.3을 정확히 고정하고 VS Code가 workspace SDK를 사용하도록 설정
- 판단: `ignoreDeprecations: "6.0"`은 프로젝트 TypeScript 5.8.3에서 유효하지 않아 사용하지 않음. 향후 `mysql2` 등 의존성 업그레이드와 함께 `Node16` 또는 그 이후 해석 방식으로 별도 마이그레이션해야 함
- 결과: `npm run build` 성공

### Docker 실행 경로

- 문제: TypeScript 출력은 `dist/web.js`인데 Docker가 `dist/src/web.js`를 실행
- 조치: Docker CMD를 `node dist/web.js`로 변경

### MySQL 데이터 영속성

- 문제: `db_data` 볼륨을 선언했지만 MySQL 데이터 디렉터리에 연결하지 않음
- 조치: `db_data:/var/lib/mysql` 마운트 추가
- 추가: 최신 Docker Compose에서 불필요한 최상위 `version` 선언 제거

### CORS PATCH 누락

- 문제: 캘린더 수정 API는 PATCH인데 CORS 허용 메서드에 PATCH가 없음
- 조치: `PATCH` 추가

### Refresh Token 쿠키 수명 단위

- 문제: Express Cookie `maxAge`는 밀리초인데 초 단위 값을 전달
- 조치: `toMilliseconds`를 추가하고 쿠키 설정에서 사용
- 검증: 7일이 `604800000ms`로 변환되는 단위 테스트 추가

### 다른 캘린더 방장 토큰을 이용한 강퇴

- 문제: 토큰의 역할만 확인하고 요청 캘린더 소속을 확인하지 않아 다른 방의 방장이 참가자를 강퇴할 수 있었음
- 조치: 행위자 Participant를 DB에서 조회하여 대상 캘린더 소속 및 실제 `host` 역할을 모두 확인
- 검증: 다른 캘린더 방장 요청이 403이고 삭제 Repository가 호출되지 않는 테스트 추가

### 만료 캘린더 Cron 조회

- 문제: `findExpired`가 `id`만 SELECT한 뒤 전체 Calendar로 매핑하여 `slug` 등이 undefined가 됨
- 조치: 전체 Calendar 행을 조회하도록 변경
- 효과: 만료 삭제 후 Socket room 알림과 로그에서 올바른 slug 사용

### 서버 시작 시 DateInfo 업데이트 조건화

- 문제: 서버 시작 시마다 공휴일/기념일 업데이트가 실행되어 이미 현재 연도 데이터가 있는 경우에도 외부 API 호출과 DB upsert가 반복될 수 있었음
- 조치: `DateInfoRepository.existsPublicApiByYear`를 추가하고, `CronService.runHolidayUpdate`가 현재 연도 `public-api` date-info 존재 여부를 확인하도록 변경
- 판단: 운영자가 직접 입력한 `custom` 데이터만 있는 경우에는 공공 API 초기 적재가 아직 되지 않은 상태이므로 업데이트를 실행해야 함
- 검증: 현재 연도 `public-api` 데이터가 있으면 외부 API 호출을 생략하고, 없으면 업데이트와 만료 정리를 실행하는 CronService 단위 테스트 추가

### 공공데이터 API 페이지네이션 누락

- 문제: 공공데이터 API 호출에서 `numOfRows=100`만 지정하고 `pageNo` 반복 처리를 하지 않아 `totalCount`가 100을 넘는 데이터가 일부 누락됨
- 확인: 실제 API QA에서 2027년/2028년 `getAnniversaryInfo`는 `totalCount=115`인데 기존 코드는 첫 100건만 수집했음
- 조치: `getSpcdeInfoUrl`이 첫 페이지의 `totalCount`와 `numOfRows`를 기준으로 전체 페이지를 순회하여 결과를 합치도록 변경
- 검증: 페이지네이션 단위 테스트를 추가했고, 실제 API 재호출에서 2027년/2028년 기념일이 각각 115건으로 수집됨

### Docker 실제 구동 실패

- 문제: 프로덕션 Docker 이미지가 `npm ci --omit=dev`로 빌드되는데 `docker-compose.yml`이 `npm run dev`를 실행하여 `nodemon: not found`로 app 컨테이너가 재시작됨
- 조치: compose의 개발용 command/소스 볼륨 override를 제거하고 Dockerfile의 기본 `npm start` 실행 흐름을 사용하도록 변경
- 문제: `ENABLE_RATE_LIMIT=false`여도 `app` import 시점에 rate limiter 모듈이 RedisStore를 생성하여 Redis 연결 전 `The client is closed` unhandled rejection이 발생함
- 조치: Redis client가 ready 상태일 때만 RedisStore를 만들고, 준비 전에는 메모리 store로 fallback하도록 변경
- 조치: `ENABLE_RATE_LIMIT=false`인 경우에는 RedisStore 생성과 fallback 경고를 모두 생략하도록 변경
- 문제: Docker 실제 구동 중 DB pool `connection` 이벤트에서 callback 기반 mysql2 connection에 promise `.catch()`를 호출하여 서버 초기화가 중단됨
- 조치: DB 세션 타임존 설정 이벤트 핸들러를 mysql2 callback 방식으로 변경
- 검증: `docker compose up -d --build` 후 app/db/redis 컨테이너가 모두 Up 상태로 전환됨
- 검증: 서버 시작 시 공공데이터 API 초기 적재가 실행되어 `date_info`에 972건이 저장됨
- 검증: 앱 재시작 후 현재 연도 `public-api` 데이터가 존재하여 초기 업데이트가 생략되고, `GET /api/v1/date-infos/2026`이 HTTP 200을 반환함
- 검증: 실제 DB에서 동일 `(location_date, date_kind, seq)` upsert와 dateKind만 다른 겹침 데이터 insert가 오류 없이 처리됨

### 투표 서비스 경계와 테스트 불일치

- 문제: 테스트가 과거 날짜별 개별 조회/트랜잭션 인자를 기대했지만 구현은 배치 조회와 배치 UPSERT를 사용
- 조치: 성능상 더 적절한 배치 구현은 유지하고 테스트를 현재 계약에 맞춤
- 조치: Service 직접 호출에서도 빈 날짜 배열을 명시적으로 거부

### 2026-07-11 TODO 미완료 항목 처리

#### JWT Secret 분리

- 문제: 메인 access token, participant token, refresh token이 모두 같은 `JWT_SECRET`으로 서명되어 토큰 종류별 격리가 약했음
- 조치: `MAIN_JWT_SECRET`, `PARTICIPANT_JWT_SECRET`, `REFRESH_JWT_SECRET`을 필수 환경변수로 분리하고 각 JWT 유틸이 자기 secret만 사용하도록 변경
- 조치: 기존 단일 JWT secret으로 발급된 토큰은 `LEGACY_JWT_SECRET`으로 검증 fallback을 허용해 전환 기간을 둘 수 있게 변경
- 판단: 한 종류의 토큰 secret이 노출되거나 검증 경로가 잘못 연결되어도 다른 토큰 종류로 확장되는 위험을 줄인다.
- 검증: participant token과 main token이 서로의 검증 함수에서 거부되는 테스트, legacy secret 토큰 검증 테스트 추가

#### Participant Token의 calendarId 명명 혼동

- 문제: participant token의 `calendarId` 필드에는 DB 숫자 id가 아니라 URL slug가 들어가고 있었음
- 조치: 새 토큰 payload 정식 필드를 `calendarSlug`로 변경
- 조치: 이미 발급된 구버전 토큰 호환을 위해 검증 시 legacy `calendarId`는 `calendarSlug`로 정규화
- 조치: Request 타입과 Socket room 처리도 `calendarSlug` 기준으로 변경
- 판단: DB `calendar_id`와 공유 URL slug가 섞이면 권한 검증이나 room join 코드에서 오해가 생기므로 토큰 의미를 명시적으로 맞췄다.

#### Rate Limiter 설정 개선

- 문제: `ENABLE_RATE_LIMIT`가 문자열이라 `tru`, `june` 같은 오타도 조용히 비활성처럼 동작할 수 있었음
- 문제: Redis store 생성 시점이 Redis 연결 전이라 memory store로 고정될 수 있었음
- 문제: Redis 연결 실패 시에도 서버 시작 로그에 성공처럼 남을 수 있었음
- 조치: `ENABLE_RATE_LIMIT`를 boolean env로 검증하고 `true` 또는 `false`만 허용
- 조치: rate limiter 활성 여부는 `ENABLE_RATE_LIMIT`만 따르게 변경하여 개발 환경에서도 명시적으로 k6 테스트 가능
- 조치: Redis store를 연결 상태와 무관하게 생성하고 `passOnStoreError`로 store 장애 시 요청을 막지 않게 설정
- 조치: `connectRedis`가 boolean을 반환하고, 서버 시작 로그가 실제 연결 결과를 구분하도록 변경
- 판단: k6 테스트를 위해 꺼둘 수는 있어야 하지만, 오타로 꺼지는 상태는 운영 위험이다.

#### 회원가입 모드 명확화

- 문제: `SIGNUP_MODE`가 일반 문자열이라 잘못된 값이 들어와도 pending 경로처럼 동작할 수 있었음
- 조치: `SIGNUP_MODE`를 `pending | immediate`로 검증
- 판단: 가입 정책은 보안/UX에 직접 영향을 주므로 잘못된 환경변수는 서버 시작 단계에서 실패시키는 것이 맞음

#### 테스트 focus 제거

- 문제: `user.repository.test.ts`에 `it.only`가 남아 전체 unit suite 일부가 숨겨질 수 있었음
- 조치: `it.only` 제거 및 현재 `UserRepository.findByOauthId` 구현의 `execute` 기반 계약에 맞게 테스트 수정
- 검증: 전체 unit suite에서 16 suites / 110 tests 통과

#### Model 타입 정리

- 문제: `ParticipantServiceInput`이 anonymous guest와 user participant 입력을 익명 union으로 직접 선언해 의미가 흐렸음
- 조치: `UserParticipantServiceInput`, `AnonymousParticipantServiceInput`으로 분리 후 union 구성
- 판단: 런타임 구조를 바꾸지 않고 타입 이름만 명확히 하여 이후 참가자 흐름 수정 시 실수를 줄인다.

## 의도적으로 변경하지 않은 항목

- Rate Limiter 기본 비활성 상태: k6 부하 테스트를 위해 `.env`에서는 `ENABLE_RATE_LIMIT=false`로 유지하되, 값 검증과 Redis store 생성 방식은 개선함
- Socket.IO Redis adapter: 단일 인스턴스 50명 MVP 전제이므로 추가하지 않음
- Controller별 Container 분할
- DateInfo 수동 생성/배치 생성/삭제 기능
- Redis 장애 시 Refresh Token blacklist fail-open 정책

## 검증 기록

### 성공

- `npm run build`
  - TypeScript 컴파일 성공
- Unit 테스트 전체
  - 명령: `npx jest --runInBand --detectOpenHandles --testMatch "**/src/__tests__/unit/**/*.test.ts"`
  - 16 suites 통과
  - 112 tests 통과
- 수정 핵심 테스트
  - 명령: `npx jest --runInBand --detectOpenHandles --runTestsByPath ...`
  - Token, Calendar, DateInfo Repository, Vote Service 관련 4 suites / 35 tests 통과
- ESLint
  - 명령: `ESLINT_USE_FLAT_CONFIG=false npx eslint src --ext .ts`
  - error 0개
  - warning 19개: 기존 미사용 변수 중심
- Dependency audit
  - `npm audit`: 0 vulnerabilities
  - `npm audit --omit=dev`: 0 vulnerabilities
- `docker compose config --quiet`
  - Compose 설정 검증 성공
- `git diff --check`
  - 공백 오류 없음
- `src/models/migrations/20260711_update_date_info_unique_key.sql`
  - 기존 DB의 `date_info` unique key를 `unique_date_seq`에서 `unique_date_kind_seq(location_date, date_kind, seq)`로 교체하는 idempotent SQL 추가
- `src/config/migrations.ts`
  - 서버 시작 시 기존 DB에도 같은 date_info unique key 마이그레이션을 자동 적용

### 제한

전체 `npm test`는 현재 로컬 테스트 DB/Redis(`127.0.0.1:3307`, `127.0.0.1:6380`)가 떠 있지 않아 integration suite에서 실패했다. Unit 테스트와 빌드, lint, audit는 통과했다. DateInfo INSERT 통합 테스트는 더 이상 DB 미연결을 조용히 통과시키지 않고 명시적으로 실패하도록 바뀌었다.

### 의존성 감사

초기 재검토 시 운영 의존성에 critical/high 취약점이 있었고 전체 audit에는 dev dependency critical도 있었다. 직접 의존성 업그레이드, 전이 의존성 overrides, dev 도구 업데이트를 적용한 뒤 `npm audit`와 `npm audit --omit=dev` 모두 0건으로 확인했다.

## Swagger DTO/명세 정합성 보정

### 문제

- `POST /api/v1/auth/register` 실제 라우트가 Swagger에는 `/api/v1/auth/google/signup`으로 적혀 있었다.
- 참가자 삭제 API 실제 base path는 `/calendars/{slug}/participants`인데 일부 Swagger 경로가 단수형 `/participant`로 적혀 있었다.
- 방장 강퇴 라우트 상수는 `/:uuid`였지만 controller와 validation은 `participantUuid`를 읽고 있어 path param 이름이 서로 달랐다.
- DateInfo 라우트는 Swagger operation 문서가 없고, DTO도 실제 응답 형태와 달랐다. 실제 controller는 `{ dateInfos: [...] }`가 아니라 배열 또는 연도별 map을 그대로 반환하고, 생성/삭제는 문자열 메시지를 반환한다.
- 운영자 전용 DateInfo 생성/삭제 API가 일반 `UserAuth`처럼 보일 수 있어 인증 방식이 불명확했다.
- 일부 request DTO가 Joi validation의 길이/배열 제약을 덜 표현하고 있었다.

### 조치

- `auth.routes.ts` Swagger path를 실제 `AUTH_ROUTES.SIGNUP` 값인 `/api/v1/auth/register`로 수정했다.
- `participant.routes.ts` Swagger path를 실제 mount path와 같은 `/api/v1/calendars/{slug}/participants/...`로 수정했다.
- `PARTICIPANT_ROUTES.DELETE_BY_HOST`를 `/:participantUuid`로 바꿔 Swagger, validation, controller의 path param 이름을 통일했다.
- `dateInfo.dto.ts`에 실제 계약 기준으로 `DateKind`, `DateInfoSource`, `SafeDateInfoDto`, `AddDateInfoRequest`, `AddDateInfosRequest`, `DateInfoMapByYear`, `DeleteDateInfoPairsRequest` 스키마를 추가했다.
- `dateInfo.routes.ts`에 DateInfo 10개 operation의 request/query/path/response Swagger 문서를 추가했다.
- DateInfo 생성/배치/삭제 라우트에 `authenticateOperator`를 적용하고, Swagger 보안 스킴에 `OperatorAuth`를 추가했다.
- Calendar/Participant/Vote DTO에 Joi와 맞는 `minLength`, `maxLength`, `minItems`, `uniqueItems`, `format: uuid`, color code pattern을 보강했다.
- Participant 로그인 DTO는 실제 `loginRequest` validation과 controller 동작에 맞춰 `nickname`, `password` 길이 제약을 제거했다.

### 판단

- Swagger는 현재 프론트/QA가 직접 참조할 계약이므로 실제 controller 응답을 기준으로 맞췄다.
- DateInfo 수동 입력/삭제는 운영자 기능이라는 기존 의도와 맞게 운영자 토큰 인증으로 고정했다.
- 단순 설명 보강이 아니라 실제 path param 이름까지 맞춰 런타임과 문서가 같은 계약을 바라보게 했다.

### 검증

- `npm run build`: TypeScript 컴파일 성공
- `ESLINT_USE_FLAT_CONFIG=false npx eslint ...`: 수정 파일 lint error 0개
- `npx tsx -e "...swaggerSets..."`: Swagger 29개 operation 생성 확인
- 생성된 보안 스킴: `UserAuth`, `ParticipantAuth`, `OperatorAuth`
- `LoginParticipantRequest` 생성 스키마 확인: `nickname`, `password`는 optional string이며 길이 제약 없음
- 관련 단위 테스트:
  - `participant.controller.authorization.test.ts`
  - `dateInfo.batch.bug.test.ts`
  - `Spcde.api.test.ts`
  - 3 suites / 5 tests 통과
