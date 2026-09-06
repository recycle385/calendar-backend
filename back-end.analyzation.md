# Back-End Performance Analyzation

작성일: 2026-07-09

## 목적

백엔드 코드 전체를 수정 없이 검토하고, 앞으로 성능 개선 및 튜닝할 요소가 많은지 확인했다. 이후 k6를 이용해 개선 전후를 비교하기 위해 어떤 테스트를 해야 하는지도 정리했다.

검토 범위는 주로 `back-end/src`이며, Express/TypeScript, MySQL, Redis, Socket.IO 기반 구조를 기준으로 봤다.

## 사용자 요청 요약

1. 백엔드 부분을 전체적으로 확인하되, 수정은 하지 말고 성능 개선 및 튜닝 요소가 많은지 봐달라고 요청했다.
2. 성능 개선 전후 비교를 위해 k6 테스트를 어떤 식으로 설계하면 좋을지 물었다.
3. 지금까지의 질문과 답변을 `back-end.analyzation.md` 파일로 정리해달라고 요청했다.

## 백엔드 성능 리뷰 요약

결론적으로 현재 백엔드는 소규모 사용량에서는 큰 문제가 없어 보이지만, 참가자 수, 날짜 수, 투표 수, 동시 접속자가 늘어나면 병목이 생길 지점이 꽤 명확하다.

특히 다음 영역이 주요 튜닝 후보로 보인다.

## 주요 성능 개선 후보

### 1. 투표 제출 후 전체 투표 현황 재조회

가장 우선순위가 높은 병목 후보다.

관련 코드:

- `back-end/src/controllers/vote.controller.ts`
- `back-end/src/services/vote.service.ts`
- `back-end/src/repositories/vote.repository.ts`

현재 `POST /api/v1/calendars/{slug}/votes` 요청은 투표를 저장한 뒤 `getVoteStatusByCalendar()`를 호출한다. 이 메서드는 해당 캘린더의 `date_options`, `votes`, `participants`를 조인해 전체 투표 현황을 다시 가져오고, 애플리케이션 레벨에서 날짜별로 그룹화한다.

즉, 투표 1회가 단순 write가 아니라 다음 작업까지 포함한다.

- 캘린더 조회
- 참가자 조회
- 날짜 옵션 조회
- votes bulk upsert
- 전체 vote status 재조회
- Socket.IO broadcast payload 생성

참가자 수와 날짜 수가 늘어나면 `POST /votes` 하나가 점점 무거워진다.

개선 후보:

- 변경된 투표 정보만 socket emit
- 전체 voteStatus Redis 캐시
- 날짜별/참가자별 vote summary 테이블
- 투표 저장 응답과 broadcast 계산 분리
- background job 또는 debounce 기반 현황 재계산

### 2. 인덱스 보강 필요

스키마에는 기본적인 외래키와 일부 인덱스가 있지만 실제 조회 패턴 기준으로 복합 인덱스가 더 필요해 보인다.

후보:

- `calendars(owner_id, created_at)`
- `calendars(is_closed, end_date)`
- `calendars(expired_at)`
- `participants(user_id, calendar_id)`
- `participants(user_id, role, calendar_id)`
- `date_info(year)`
- `date_info(year, date_kind)`
- `date_info(date_kind, year)`

특히 다음 쿼리들이 커질 때 영향을 받을 수 있다.

- 내 캘린더 목록 조회
- 만료 캘린더 삭제 cron
- 종료된 캘린더 자동 마감 cron
- 참가자 UUID 조회
- 공휴일 정보 조회

### 3. 페이지네이션 없는 전체 조회

여러 조회 API가 limit 없이 전체 데이터를 가져온다.

관련 예시:

- `GET /api/v1/calendars/my`
- `GET /api/v1/calendars/{slug}/participants`
- `GET /api/v1/date-infos`

초기에는 단순해서 괜찮지만, 데이터가 쌓이면 응답 시간과 payload 크기가 같이 커진다.

개선 후보:

- page/limit 기반 pagination
- cursor 기반 pagination
- 필요한 컬럼만 select
- 관리자성 전체 조회와 일반 사용자 조회 분리

### 4. 읽기 캐시 부재

Redis는 이미 rate limit, signup token, refresh token blacklist 등에 쓰이고 있지만, 핵심 읽기 API 캐시는 거의 없다.

캐시 후보:

- `slug -> calendar`
- calendar detail
- voteStatus
- participantsWithVotes
- dateInfo by year
- dateInfo by year and dateKind

특히 공휴일 정보는 변경 빈도가 낮고 조회 빈도가 높을 수 있어 캐시 효율이 좋다. 투표 현황은 invalidate 전략이 필요하지만, 개선 전후 비교 가치가 크다.

### 5. Socket.IO 확장성

`@socket.io/redis-adapter` 의존성은 있지만 실제 Socket.IO 초기화 코드에는 Redis adapter가 붙어 있지 않다.

관련 코드:

- `back-end/src/sockets/socket.container.ts`
- `back-end/src/sockets/socket.controller.ts`

단일 프로세스에서는 괜찮지만, PM2 cluster 또는 서버 여러 대로 확장하면 room broadcast와 `fetchSockets()`가 인스턴스 간 공유되지 않을 수 있다.

또한 `joinCalendarRoom`에서 `fetchSockets()`로 방의 온라인 유저 목록을 가져오는 구조는 방 인원이 많아질수록 비용이 증가한다.

개선 후보:

- Socket.IO Redis adapter 적용
- 온라인 유저 목록 Redis set으로 관리
- join/leave 이벤트의 DB 또는 socket 조회 최소화
- 큰 room에서 broadcast payload 크기 측정 및 제한

### 6. Cron 배치 처리

현재 cron은 만료/마감 대상 캘린더를 한 번에 조회하고, id 배열을 이용해 bulk update/delete 한다.

관련 코드:

- `back-end/src/services/cron.service.ts`
- `back-end/src/repositories/calendar.repository.ts`

대상 캘린더가 많아지면 큰 `IN (?)` 쿼리와 큰 socket broadcast 루프가 부담이 될 수 있다.

개선 후보:

- 일정 크기 단위 batch 처리
- `LIMIT` 기반 반복 처리
- cron 실행 시간/처리량 로깅
- 실패한 batch 재시도

### 7. `SELECT *` 사용

레포지토리 전반에서 `SELECT *`가 많다. 특히 participants 조회는 `password_hash`까지 가져온 뒤 컨트롤러에서 응답에서 제외하는 흐름이다.

개선 후보:

- 응답에 필요한 컬럼만 select
- public/safe 조회용 repository method 분리
- hot path 쿼리부터 컬럼 축소

## k6 테스트 전략

겉핥기식 API 평균 응답 테스트가 아니라, 이 서버의 실제 병목 후보를 직접 검증하는 시나리오가 필요하다.

우선순위는 다음 순서가 적절하다.

1. `POST /votes` write storm
2. `GET /votes` hot calendar read
3. mixed real user flow
4. participant churn
5. large calendar create
6. socket room scale
7. dateInfo cache/index test

### 1. Hot Calendar Read Test

대상:

- `GET /api/v1/calendars/{slug}/votes`

목적:

대형 캘린더 하나에 대해 전체 투표 현황 조회가 얼마나 버티는지 확인한다.

데이터 세트:

- 캘린더 1개
- 날짜 30개, 90개, 365개
- 참가자 50명, 200명, 500명
- 각 참가자가 날짜의 30~100%에 투표

확인 지표:

- `http_req_duration` p95/p99
- `http_req_failed`
- 응답 payload 크기
- DB CPU
- slow query
- Node.js CPU
- Node.js memory RSS

### 2. Vote Write Storm Test

대상:

- `POST /api/v1/calendars/{slug}/votes`

목적:

동시에 많은 참가자가 투표할 때 write와 전체 voteStatus 재조회가 합쳐져 얼마나 병목이 되는지 확인한다.

데이터 세트:

- 같은 캘린더에 참가자 100~500명
- 참가자별 participant token 준비
- `selectedDates` 1개, 7개, 30개 케이스 분리

부하 예시:

- 50 VU
- 100 VU
- 300 VU
- 30초 spike로 2~3배 증가

확인 지표:

- POST p95/p99
- DB lock wait
- deadlock 여부
- upsert 처리량
- socket emit 때문에 응답이 느려지는지
- 전체 voteStatus 재조회 쿼리 비용

### 3. Mixed Real User Flow Test

실제 사용자 흐름을 반영한 종합 테스트다.

비율 예시:

- 40% `GET /api/v1/calendars/{slug}`
- 30% `GET /api/v1/calendars/{slug}/votes`
- 15% `GET /api/v1/calendars/{slug}/participants`
- 10% `POST /api/v1/calendars/{slug}/votes`
- 5% `GET /api/v1/calendars/{slug}/votes/{participantUuid}`

목적:

인덱스, 캐시, voteStatus 구조 개선 전후의 사용자 체감 성능을 비교한다.

### 4. Participant Churn Test

대상:

- `POST /api/v1/calendars/{slug}/participants`
- `POST /api/v1/calendars/{slug}/participants/login`
- `GET /api/v1/calendars/{slug}/participants`

목적:

참가자가 한 번에 몰릴 때 bcrypt hash/compare, nickname 중복 체크, 참가자 통계 조회가 얼마나 버티는지 확인한다.

케이스:

- 동시에 100명 참가
- 동시에 300명 로그인
- 참가자 목록 조회를 함께 섞기

### 5. Large Calendar Create Test

대상:

- `POST /api/v1/calendars`

목적:

캘린더 생성 시 날짜 범위만큼 `date_options`를 bulk insert하는 비용을 측정한다.

케이스:

- 7일 캘린더 생성
- 30일 캘린더 생성
- 365일 캘린더 생성
- 동시 생성 20~100 VU

확인 지표:

- transaction 시간
- date_options insert 시간
- DB connection pool 대기
- slug 중복 확인 쿼리 비용

### 6. My Calendars List Test

대상:

- `GET /api/v1/calendars/my`

목적:

한 유저가 많은 캘린더를 가진 상황에서 페이지네이션 없는 목록 조회가 얼마나 느려지는지 확인한다.

데이터 세트:

- 한 유저가 캘린더 100개
- 한 유저가 캘린더 1,000개
- 한 유저가 캘린더 5,000개

### 7. DateInfo Read Test

대상:

- `GET /api/v1/date-infos`
- `GET /api/v1/date-infos/years?years[]=2026`
- `GET /api/v1/date-infos/kinds?...`

목적:

공휴일 데이터 조회의 인덱스 및 캐시 개선 효과를 비교한다.

공휴일 데이터는 변경 빈도가 낮아 캐시 전후 비교에 적합하다.

### 8. Socket Scale Test

Socket.IO는 기본 k6 WebSocket API만으로 테스트하기 까다롭다. 필요하면 `xk6-socketio` 계열 확장 또는 별도 Node.js 부하 스크립트를 고려해야 한다.

테스트할 내용:

- 1개 room에 100명 join
- 1개 room에 500명 join
- 1개 room에 1,000명 join
- 동시에 `joinCalendarRoom`
- 투표 발생 시 `voteUpdated` 수신 지연
- `fetchSockets()` 비용
- 서버 다중 프로세스 환경에서 broadcast 정상 동작 여부

## 부하 유형

k6 테스트는 다음 유형으로 나누는 것이 좋다.

- Baseline: 1~5 VU로 정상 기준선 측정
- Load: 예상 트래픽 수준, 예: 50~200 VU
- Stress: 예상보다 큰 트래픽, 예: 300~1,000 VU
- Spike: 10~30초 안에 급격히 증가
- Soak: 1~3시간 유지해 메모리 누수, connection 누수 확인

## 개선 전후 비교 지표

최소한 다음 지표는 같은 표로 비교해야 한다.

```text
scenario
throughput req/s
http_req_duration avg
http_req_duration p95
http_req_duration p99
http_req_failed
DB CPU
DB slow query count
Node CPU
Node memory RSS
payload size
```

## 최종 정리

현재 백엔드는 기능 단위로는 잘 나뉘어 있지만, 대규모 트래픽을 고려하면 읽기 캐시, 인덱스, voteStatus 계산 방식, Socket.IO 확장성, batch 처리에서 개선할 부분이 많다.

가장 먼저 검증해야 할 병목은 다음 두 가지다.

1. `GET /api/v1/calendars/{slug}/votes`
2. `POST /api/v1/calendars/{slug}/votes`

특히 `POST /votes`는 write 요청이면서 내부적으로 전체 voteStatus 재조회와 socket broadcast 준비까지 수행하므로, 대규모 처리 관점에서 최우선 테스트 대상이다.
