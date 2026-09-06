# Back-End Performance Improvement Plan

> **Summary**: 대규모 투표 트래픽을 기준으로 백엔드 병목을 가설화하고, k6 측정과 단계별 튜닝으로 개선 전후를 증명하기 위한 계획서
>
> **Project**: Calendar Project Back-End
> **Version**: 0.1
> **Author**: Junho
> **Date**: 2026-07-09
> **Status**: Draft

---

## 1. 목적

이 문서의 목적은 단순한 성능 개선 작업 목록을 만드는 것이 아니다.

취업 포트폴리오와 면접 설명에 사용할 수 있도록, 현재 백엔드의 병목 가능성을 코드와 데이터 흐름에서 명확히 찾고, 그에 대한 가설을 세운 뒤, k6 부하 테스트와 지표를 통해 개선 전후를 수치로 증명하는 것이다.

최종 보고서에서는 다음 흐름이 보여야 한다.

1. 어떤 사용자 시나리오에서 서버가 느려질 것으로 예상했는가
2. 코드상 병목 원인을 어떻게 추론했는가
3. 어떤 가설을 세웠는가
4. 어떤 실험으로 검증했는가
5. 어떤 튜닝을 적용했는가
6. 개선 전후 수치가 어떻게 달라졌는가
7. 개선 과정에서 얻은 설계적 판단은 무엇인가

## 2. 배경

현재 백엔드는 Express, TypeScript, MySQL, Redis, Socket.IO 기반이다.

기능은 캘린더 생성, 참가자 등록, 투표 제출, 투표 현황 조회, 실시간 소켓 알림으로 구성되어 있다. 서비스 특성상 가장 중요한 트래픽은 특정 캘린더에 여러 참가자가 동시에 접속해 투표하고, 전체 투표 현황을 반복 조회하는 상황이다.

정적 분석 결과, 가장 중요한 병목 후보는 `POST /api/v1/calendars/{slug}/votes`와 `GET /api/v1/calendars/{slug}/votes`다.

`POST /votes`는 단순히 투표만 저장하지 않는다. 투표 저장 후 전체 투표 현황을 다시 조회하고, 그 결과를 Socket.IO 이벤트 payload로 만들어 같은 room에 broadcast한다. 따라서 참가자 수와 날짜 수가 커질수록 write 요청 하나의 비용이 커질 가능성이 있다.

## 3. 관련 문서

- 분석 문서: `back-end/back-end.analyzation.md`
- API 명세: `public/api명세서.md`
- 주요 코드:
  - `back-end/src/controllers/vote.controller.ts`
  - `back-end/src/services/vote.service.ts`
  - `back-end/src/repositories/vote.repository.ts`
  - `back-end/src/repositories/participant.repository.ts`
  - `back-end/src/repositories/calendar.repository.ts`
  - `back-end/src/sockets/socket.container.ts`
  - `back-end/src/sockets/socket.controller.ts`

---

## 4. 핵심 목표

### 4.1 1차 목표

대형 캘린더에서 투표 제출과 투표 현황 조회가 어느 정도 부하까지 버티는지 측정하고, 병목 원인을 코드와 DB 쿼리 기준으로 설명한다.

### 4.2 2차 목표

가장 영향이 큰 병목부터 튜닝해 개선 전후를 같은 조건의 k6 테스트로 비교한다.

### 4.3 3차 목표

최종 보고서에 다음을 명확히 남긴다.

- 문제 정의
- 병목 추론
- 가설
- 실험 설계
- 개선 작업
- 결과 수치
- 한계와 다음 개선 방향

---

## 5. 범위

### 5.1 In Scope

- 투표 제출 API 성능 분석
- 투표 현황 조회 API 성능 분석
- 참가자 목록 통계 조회 성능 분석
- 캘린더 생성 시 날짜 옵션 bulk insert 비용 측정
- 주요 DB 인덱스 튜닝 후보 검증
- Redis 캐시 적용 후보 검증
- Socket.IO broadcast 비용 분석
- k6 기반 개선 전후 비교
- 면접용 성능 개선 보고서 작성

### 5.2 Out of Scope

- UI/프론트엔드 성능 개선
- 전체 아키텍처를 MSA로 재설계
- DB 종류 변경
- Redis 외 신규 인프라 도입
- 인증 정책 자체 변경
- 기능 요구사항 변경

---

## 6. 문제 정의

### 6.1 문제 1: 투표 제출 요청이 전체 투표 현황 재계산을 포함한다

현재 `POST /votes` 흐름은 다음과 같다.

1. slug로 캘린더 조회
2. participantUuid로 참가자 조회
3. selectedDates에 해당하는 date_options 조회
4. votes bulk upsert
5. 전체 voteStatus 재조회
6. Socket.IO `voteUpdated` broadcast
7. HTTP 응답 반환

이 구조에서는 투표 저장 요청 수가 늘수록 전체 voteStatus 조회도 같은 횟수만큼 반복된다.

### 6.2 문제 2: 전체 투표 현황 조회가 캘린더 크기에 비례해서 커진다

`GET /votes`는 날짜 옵션, 투표, 참가자를 조인하고 애플리케이션에서 날짜별로 그룹화한다.

캘린더가 커질수록 비용은 대략 다음 요소에 영향을 받는다.

- 날짜 수
- 참가자 수
- 투표 수
- 응답 payload 크기
- JS grouping 비용
- DB join 비용

### 6.3 문제 3: hot path에 캐시가 없다

Redis는 이미 사용 중이지만, 핵심 읽기 데이터인 calendar detail, voteStatus, participantsWithVotes에는 캐시가 적용되어 있지 않다.

같은 캘린더에 여러 사용자가 들어와 같은 데이터를 반복 조회하는 서비스 특성상 캐시 효과를 기대할 수 있다.

### 6.4 문제 4: 실제 조회 패턴에 맞춘 복합 인덱스가 부족하다

기본 인덱스는 있지만 다음 패턴에 맞춘 복합 인덱스가 부족하다.

- owner_id 기준 캘린더 목록 정렬
- is_closed + end_date 기준 자동 마감 대상 조회
- expired_at 기준 만료 대상 조회
- user_id + calendar_id 기준 참가자 조회
- year + date_kind 기준 date_info 조회

### 6.5 문제 5: Socket.IO 확장성이 제한적이다

Socket.IO Redis adapter 의존성은 있지만 실제 초기화 코드에는 adapter가 연결되어 있지 않다.

단일 프로세스에서는 동작하지만, PM2 cluster나 다중 서버 환경에서는 room broadcast와 socket 상태 공유가 문제될 수 있다.

---

## 7. 성능 개선 가설

### H1. `POST /votes`의 p95 지연은 투표 저장보다 전체 voteStatus 재조회 때문에 커질 것이다

근거:

- 투표 저장 후 `getVoteStatusByCalendar()`가 항상 실행된다.
- 이 조회는 캘린더 전체 날짜와 투표 데이터를 가져온다.
- 참가자 수와 날짜 수가 커지면 write 요청 비용이 증가한다.

검증 방법:

- 같은 데이터셋에서 `POST /votes`만 반복 부하
- `selectedDates` 크기를 1, 7, 30으로 나누어 비교
- DB slow query와 API p95를 함께 확인

예상 개선 방향:

- HTTP 응답에서는 저장 결과만 반환
- socket에는 변경분만 전송
- 전체 voteStatus는 별도 조회 API 또는 캐시로 처리

### H2. `GET /votes`는 대형 캘린더에서 DB join과 응답 payload 크기가 p99를 악화시킬 것이다

근거:

- 날짜 옵션 전체와 투표 데이터를 모두 조회한다.
- JS에서 Map으로 그룹화한다.
- 응답 payload가 참가자 수와 투표 수에 비례한다.

검증 방법:

- 날짜 30, 90, 365개
- 참가자 50, 200, 500명
- 동일 VU 조건에서 p95/p99와 payload size 비교

예상 개선 방향:

- voteStatus Redis 캐시
- summary 테이블
- 필요한 범위만 조회
- payload 구조 축소

### H3. 복합 인덱스를 추가하면 목록/cron성 쿼리의 DB 비용이 줄어들 것이다

근거:

- `owner_id ORDER BY created_at`
- `is_closed = false AND end_date < ?`
- `expired_at < ?`
- `user_id AND calendar_id`

검증 방법:

- 인덱스 전후 `EXPLAIN` 비교
- 동일 데이터셋에서 API latency 비교
- slow query 발생 여부 비교

예상 개선 방향:

- 조회 패턴별 복합 인덱스 추가
- 불필요한 `SELECT *` 축소

### H4. 참가자 목록 통계 조회는 참가자 수가 늘면 aggregation 비용이 커질 것이다

근거:

- `participants`와 `votes`를 LEFT JOIN하고 `COUNT(DISTINCT v.date_option_id)`를 계산한다.
- 별도 쿼리로 date_options count도 조회한다.

검증 방법:

- 참가자 50, 200, 500, 1,000명 데이터셋 생성
- `GET /participants` p95/p99 비교

예상 개선 방향:

- 참가자별 vote_count summary
- participantsWithVotes 캐시
- 필요한 컬럼만 select

### H5. Socket room 규모가 커지면 `fetchSockets()`와 broadcast payload가 병목이 될 수 있다

근거:

- join 시 `fetchSockets()`로 onlineUsers를 구성한다.
- voteUpdated는 전체 voteStatus payload를 room에 전송한다.

검증 방법:

- 1개 room에 100, 500, 1,000명 연결
- join latency와 voteUpdated 수신 지연 측정

예상 개선 방향:

- Redis adapter 적용
- onlineUsers를 Redis set으로 관리
- voteUpdated payload 축소

---

## 8. 측정 지표

### 8.1 k6 지표

| Metric                       | 목적                      |
| ---------------------------- | ------------------------- |
| `http_req_duration avg`      | 평균 응답 시간            |
| `http_req_duration p95`      | 대부분 사용자의 체감 지연 |
| `http_req_duration p99`      | tail latency 확인         |
| `http_req_failed`            | 실패율                    |
| `http_reqs`                  | 처리량                    |
| `iterations`                 | 시나리오 수행량           |
| custom trend: `payload_size` | 응답 크기 추적            |

### 8.2 서버 지표

| Metric              | 목적                                           |
| ------------------- | ---------------------------------------------- |
| Node.js CPU         | 애플리케이션 grouping, JSON serialization 비용 |
| Node.js RSS memory  | 응답 객체, Map grouping, 누수 가능성           |
| Event loop delay    | 동시 요청 처리 지연                            |
| DB CPU              | join, aggregation, upsert 비용                 |
| DB slow query count | 병목 쿼리 식별                                 |
| DB connection usage | connection pool 부족 여부                      |
| Redis hit ratio     | 캐시 적용 후 효과                              |

### 8.3 판단 기준

최종 보고서에는 다음 기준으로 결과를 정리한다.

| Grade     | 기준                                        |
| --------- | ------------------------------------------- |
| Success   | p95 30% 이상 개선 또는 처리량 30% 이상 증가 |
| Partial   | p95 10~30% 개선, 실패율 증가 없음           |
| No Effect | p95 10% 미만 개선                           |
| Regressed | p95 악화 또는 실패율 증가                   |

---

## 9. 테스트 데이터 설계

### 9.1 Small Dataset

기준선 확인용이다.

- 캘린더 1개
- 날짜 14개
- 참가자 20명
- 투표율 50%

### 9.2 Medium Dataset

실제 서비스 성장 초기 수준을 가정한다.

- 캘린더 1개
- 날짜 30개
- 참가자 100명
- 투표율 70%

### 9.3 Large Dataset

병목을 드러내기 위한 핵심 데이터셋이다.

- 캘린더 1개
- 날짜 90개
- 참가자 300명
- 투표율 80%

### 9.4 Extreme Dataset

한계 측정용이다.

- 캘린더 1개
- 날짜 365개
- 참가자 500명
- 투표율 80~100%

---

## 10. k6 시나리오 계획

### 10.1 Scenario A: Hot Calendar Read

대상:

- `GET /api/v1/calendars/{slug}/votes`

목적:

대형 캘린더에서 전체 투표 현황 조회가 얼마나 버티는지 측정한다.

부하:

- baseline: 1 VU, 1분
- load: 50 VU, 5분
- stress: 200 VU, 5분
- spike: 500 VU, 30초

성공 기준:

- Medium Dataset 기준 p95 500ms 이하
- Large Dataset 기준 p95 1,000ms 이하
- 실패율 1% 미만

### 10.2 Scenario B: Vote Write Storm

대상:

- `POST /api/v1/calendars/{slug}/votes`

목적:

동시 투표 제출 시 write + 전체 voteStatus 재조회 구조가 얼마나 버티는지 측정한다.

부하:

- baseline: 5 VU, 1분
- load: 50 VU, 5분
- stress: 150 VU, 5분
- spike: 300 VU, 30초

변수:

- selectedDates 1개
- selectedDates 7개
- selectedDates 30개

성공 기준:

- Large Dataset 기준 p95 1,500ms 이하
- 실패율 1% 미만
- DB deadlock 0건

### 10.3 Scenario C: Mixed Real User Flow

대상 비율:

- 40% `GET /api/v1/calendars/{slug}`
- 30% `GET /api/v1/calendars/{slug}/votes`
- 15% `GET /api/v1/calendars/{slug}/participants`
- 10% `POST /api/v1/calendars/{slug}/votes`
- 5% `GET /api/v1/calendars/{slug}/votes/{participantUuid}`

목적:

실제 사용자 흐름에서 개선 전후 체감 성능을 비교한다.

성공 기준:

- 전체 p95 1,000ms 이하
- 실패율 1% 미만
- 개선 후 throughput 30% 이상 증가 또는 p95 30% 이상 감소

### 10.4 Scenario D: Participant Churn

대상:

- `POST /api/v1/calendars/{slug}/participants`
- `POST /api/v1/calendars/{slug}/participants/login`
- `GET /api/v1/calendars/{slug}/participants`

목적:

참가자가 몰리는 상황에서 bcrypt와 참가자 통계 조회 비용을 측정한다.

부하:

- 동시 참가 100명
- 동시 로그인 300명
- 참가자 목록 조회 100 VU

성공 기준:

- 참가/로그인 p95 1,500ms 이하
- 참가자 목록 p95 1,000ms 이하
- bcrypt 때문에 Node CPU가 포화되는지 확인

### 10.5 Scenario E: Large Calendar Creation

대상:

- `POST /api/v1/calendars`

목적:

캘린더 생성 시 날짜 범위에 따른 date_options bulk insert 비용을 측정한다.

케이스:

- 7일
- 30일
- 365일

성공 기준:

- 365일 캘린더 생성 p95 1,500ms 이하
- DB connection pool 대기 과도 증가 없음

### 10.6 Scenario F: DateInfo Read

대상:

- `GET /api/v1/date-infos`
- `GET /api/v1/date-infos/years?years[]=2026`
- `GET /api/v1/date-infos/kinds?...`

목적:

정적 성격의 공휴일 데이터에 캐시/인덱스가 효과적인지 측정한다.

성공 기준:

- 캐시 적용 후 p95 50% 이상 감소
- Redis hit ratio 80% 이상

---

## 11. 개선 단계 계획

### Phase 0. Baseline 측정

목표:

아무 튜닝도 하지 않은 현재 상태를 측정한다.

작업:

- 테스트 데이터 seed 준비
- k6 시나리오 작성
- DB slow query log 활성화
- Node.js CPU/memory 관찰 방법 정리
- Small, Medium, Large Dataset에서 baseline 실행

산출물:

- baseline k6 결과
- 병목 API 순위
- slow query 목록
- 개선 대상 우선순위

### Phase 1. Query/Index 튜닝

목표:

코드 구조 변경 없이 DB 조회 비용을 먼저 줄인다.

후보:

- `calendars(owner_id, created_at)`
- `calendars(is_closed, end_date)`
- `calendars(expired_at)`
- `participants(user_id, calendar_id)`
- `date_info(year, date_kind)`

검증:

- `EXPLAIN` 전후 비교
- k6 Scenario A, C, F 재실행

성공 기준:

- 관련 API p95 10~30% 이상 개선
- slow query 감소

### Phase 2. VoteStatus 조회 최적화

목표:

가장 큰 병목 후보인 전체 투표 현황 조회 비용을 줄인다.

후보:

- 필요한 컬럼만 select
- grouping 비용 측정 후 구조 개선
- voteStatus Redis 캐시
- 투표 변경 시 캐시 invalidate

검증:

- Scenario A 재실행
- Scenario B 재실행
- payload size 비교

성공 기준:

- `GET /votes` p95 30% 이상 개선
- `POST /votes` p95도 함께 개선되는지 확인

### Phase 3. Vote Write Path 분리

목표:

투표 저장 요청에서 전체 voteStatus 재조회 비용을 분리한다.

후보:

- `POST /votes` 응답은 저장 결과 중심으로 축소
- socket `voteUpdated` payload를 변경분 중심으로 축소
- 클라이언트가 필요 시 `GET /votes`를 별도 호출
- 또는 cached voteStatus를 즉시 반환

검증:

- Scenario B 집중 재실행
- socket payload 크기 비교
- 응답 시간과 실패율 비교

성공 기준:

- `POST /votes` p95 30% 이상 개선
- Large Dataset에서 실패율 1% 미만 유지

### Phase 4. Participant 통계 최적화

목표:

참가자 목록과 투표율 조회 비용을 줄인다.

후보:

- participantsWithVotes 캐시
- summary table 검토
- `COUNT(DISTINCT ...)` 비용 감소
- 필요한 컬럼만 select

검증:

- Scenario D 재실행

성공 기준:

- `GET /participants` p95 30% 이상 개선

### Phase 5. Socket.IO 확장성 검토

목표:

실시간 기능이 대규모 room에서도 감당 가능한지 확인한다.

후보:

- Socket.IO Redis adapter 적용
- onlineUsers 관리 방식 변경
- `fetchSockets()` 비용 줄이기
- broadcast payload 축소

검증:

- 별도 Socket.IO 부하 테스트
- 100, 500, 1,000명 room join
- voteUpdated 수신 지연 측정

성공 기준:

- 500명 room에서 join/broadcast 실패율 1% 미만
- 다중 프로세스 환경에서 broadcast 정상 동작

### Phase 6. Long Run Soak Test

목표:

짧은 부하에서는 드러나지 않는 메모리 증가, connection 누수, Redis/DB 불안정성을 확인한다.

부하:

- Mixed Real User Flow
- 1~3시간 유지

성공 기준:

- Node.js memory가 계속 증가하지 않음
- DB connection이 고갈되지 않음
- 실패율 1% 미만
- p95가 시간이 지날수록 악화되지 않음

---

## 12. 보고서 작성 계획

최종 보고서는 다음 구조로 작성한다.

### 12.1 문제 정의

예시 문장:

> 이 서비스는 하나의 캘린더에 여러 참가자가 동시에 투표하고, 같은 투표 현황을 반복 조회하는 구조다. 따라서 단일 API 평균 응답 시간이 아니라, 대형 캘린더에서의 투표 제출과 전체 투표 현황 조회가 핵심 병목이라고 판단했다.

### 12.2 코드 분석 기반 병목 추론

포함할 내용:

- `POST /votes`가 전체 voteStatus 재조회를 포함한다는 점
- `GET /votes`가 조인과 JS grouping을 수행한다는 점
- Redis가 있지만 hot read cache가 없다는 점
- 실제 조회 패턴에 맞춘 복합 인덱스가 부족하다는 점

### 12.3 가설

보고서에는 최소 다음 가설을 넣는다.

- H1: 투표 제출 API의 p95 지연은 votes upsert보다 전체 voteStatus 재조회 때문에 커질 것이다.
- H2: 대형 캘린더에서 `GET /votes`의 p99는 DB join, JS grouping, payload size의 영향을 크게 받을 것이다.
- H3: 복합 인덱스를 추가하면 목록/cron성 조회의 DB 비용이 줄어들 것이다.
- H4: voteStatus 캐시 또는 write path 분리로 `POST /votes`의 p95를 유의미하게 줄일 수 있을 것이다.

### 12.4 실험 설계

포함할 내용:

- 테스트 데이터 규모
- k6 시나리오
- VU 단계
- 측정 지표
- 성공 기준

### 12.5 개선 내용

각 개선마다 다음 형식을 사용한다.

```text
문제:
가설:
적용한 개선:
측정 결과:
해석:
남은 한계:
```

### 12.6 결과 비교 표

예시:

| Scenario          | Before p95 | After p95 | Improvement | Before RPS | After RPS | Error Rate |
| ----------------- | ---------- | --------- | ----------- | ---------- | --------- | ---------- |
| GET /votes Large  | TBD        | TBD       | TBD         | TBD        | TBD       | TBD        |
| POST /votes Large | TBD        | TBD       | TBD         | TBD        | TBD       | TBD        |
| Mixed Flow        | TBD        | TBD       | TBD         | TBD        | TBD       | TBD        |

### 12.7 면접에서 설명할 핵심 포인트

- 단순히 빠르게 만들었다가 아니라, 병목을 먼저 가설화했다.
- API별 평균이 아니라 서비스 특성상 중요한 hot path를 선정했다.
- p95/p99, 실패율, DB slow query, payload size를 함께 봤다.
- 개선 후에도 한계를 숨기지 않고 다음 개선 방향을 제시했다.

---

## 13. 리스크와 대응

| Risk                                     | Impact                           | Likelihood | Mitigation                                                              |
| ---------------------------------------- | -------------------------------- | ---------- | ----------------------------------------------------------------------- |
| 테스트 데이터가 실제 사용 패턴과 다름    | 결과 신뢰도 하락                 | Medium     | Small/Medium/Large/Extreme 데이터셋을 분리한다                          |
| 로컬 환경 한계로 서버보다 PC가 먼저 병목 | 결과 왜곡                        | High       | CPU/DB 지표를 함께 보고, 가능하면 동일 환경에서 before/after만 비교한다 |
| 캐시 적용 후 정합성 문제                 | 사용자에게 오래된 투표 현황 노출 | Medium     | invalidate 조건을 명확히 정의하고 TTL을 둔다                            |
| 인덱스 추가로 write 성능 저하            | 투표/생성 성능 악화              | Medium     | write storm 테스트로 부작용을 확인한다                                  |
| Socket.IO 테스트 도구 한계               | 실시간 성능 검증 부족            | Medium     | k6 HTTP 테스트와 별도 Node.js Socket.IO 부하 스크립트를 분리한다        |
| 수치 개선이 작게 나옴                    | 보고서 설득력 저하               | Medium     | 개선 실패도 원인 분석과 다음 액션으로 정리한다                          |

---

## 14. 우선순위

1. Baseline 측정 환경 구축
2. 대형 캘린더 seed 데이터 생성
3. `GET /votes` hot read 테스트
4. `POST /votes` write storm 테스트
5. Mixed Real User Flow 테스트
6. 인덱스 튜닝
7. voteStatus 조회/캐시 튜닝
8. `POST /votes` write path 분리
9. 참가자 통계 조회 튜닝
10. Socket.IO 확장성 검토
11. 최종 보고서 작성

---

## 15. Definition of Done

- [ ] 현재 구조의 baseline 성능 수치를 확보했다.
- [ ] 병목 API를 p95/p99 기준으로 식별했다.
- [ ] 각 병목에 대한 코드 기반 가설을 문서화했다.
- [ ] 최소 3개 이상의 k6 시나리오를 작성했다.
- [ ] 개선 전후를 같은 조건으로 비교했다.
- [ ] 주요 개선마다 결과 표와 해석을 작성했다.
- [ ] 개선 효과가 작은 항목도 원인과 다음 액션을 정리했다.
- [ ] 면접에서 3~5분 안에 설명 가능한 요약본을 만들었다.

---

## 16. Version History

| Version | Date       | Changes                              | Author |
| ------- | ---------- | ------------------------------------ | ------ |
| 0.1     | 2026-07-09 | Initial performance improvement plan | Junho  |

---

그렇다면 mvp로서는 타당한가 현재의 코드는?

• 네, MVP로는 타당한 편입니다.

이유는 명확합니다. 현재 코드는 기능 경계가 나뉘어 있고, 캘린더 생성/참가/투표/조회/실시간 알림이라는 핵심 사용자 흐름이 이미 동작하는 구조입니다. 성능상 아쉬운 부분은 있지만, 대부분은 “대규모 사용자가 붙었을 때 드러나는
확장성 문제”에 가깝고, MVP 단계에서 반드시 먼저 풀어야 하는 문제는 아닙니다.

다만 MVP로 타당하다는 말이 “그대로 운영 확장해도 된다”는 뜻은 아닙니다.

현재 MVP 기준으로 괜찮은 점:

- 도메인 분리가 비교적 명확함: controller/service/repository 구조
- MySQL 트랜잭션 사용 지점이 있음
- 투표 bulk upsert를 사용함
- Redis를 이미 auth/rate-limit 쪽에 붙일 준비가 되어 있음
- Socket.IO로 핵심 실시간 기능이 구현되어 있음
- 테스트 코드도 어느 정도 존재함

MVP 이후 바로 관리해야 할 위험:

- POST /votes가 전체 투표 현황 재조회까지 수행함
- GET /votes가 대형 캘린더에서 무거워질 가능성이 큼
- pagination/cache가 거의 없음
- 실제 조회 패턴에 맞는 복합 인덱스가 부족함

> MVP 단계에서는 핵심 플로우 완성과 단순한 구조를 우선했다. 이후 코드 리뷰와 부하 테스트를 통해 투표 제출과 투표 현황 조회가 대규모 트래픽의 병목이 될 수 있다고 판단했고, k6 테스트로 가설을 검증한 뒤 인덱스, 캐시,
> voteStatus 계산 구조를 단계적으로 개선했다.
