※ 백엔드 해야할 일

- utils의 토큰 통합
- 테스트 코드 작성
  단위, 통합 80프로 완료.
  --엣지케이스, 크론 및 세부 흐름 등 추가예정
- model의 모호한 부분들 type으로 분리 및 분류
- 참가자 토큰과 메인토큰의 jwt_secret분리
- 미들웨어 validation 활용 √
- 미들웨어 rateLimiter개선 필요
- 회원가입 모드 명확히 하기 Pending 모드 | Immediate 모드
- 이미 처음에 토큰안 id의 변수명을 calendar_id라고 정하고 코드를 짜서
  현재는 calendar_id에 실제로 들어가는 아이디는 slug이지만 변수명을
  전체적으로 calendar_slug로 통일예정.
- asyncHandler 활용
- n+1 쿼리 수정하여 성능 저하 해결 √

---

※ 비용이 크지만 하면 좋은 할 일(안할 확률이 높고 우선순위 낮음)

- 쿼리문에서 type orm으로 변경
- 트랜잭션 같은 부분 라이브러리를 사용

k6테스트(http테스트) 보완 필요.
--예상 규모를 보아 최대 100명 동시접속, 동시 요청, 투표 테스트 필요
k6를 이용한 그라파나 실시간 모니터링 기능 추가예정
altillery 테스트(소켓 테스트) 추가 필요
k6 테스트와 altillery 테스트를 같이 사용
=> 하이브리드 전략으로 소켓과 http 모두 안정성 확보예정

---

http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getHoliDeInfo?solYear=${year}&ServiceKey=env.GET_REST_DE_INFO&_type=json

getRestDeInfo → 빨간날 표시 (실제 쉬는 날)
getHoliDeInfo → 국경일 이름 표시 (삼일절, 광복절 등)

getAnniversaryInfo → 기념일 표시 (어버이날, 스승의날 등)
get24DivisionsInfo → 절기 표시(입춘, 동지 등)

getRestDeInfo
getHoliDeInfo
getAnniversaryInfo
get24DivisionsInfo
