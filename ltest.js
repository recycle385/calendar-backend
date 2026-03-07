import { check, sleep } from 'k6';
import http from 'k6/http';

// 1. 테스트 설정
export const options = {
  // 10명의 가상 유저가 30초 동안 지속적으로 접속
  vus: 100,
  duration: '30s',
};

// 방금 만드신 캘린더의 SLUG
const TARGET_SLUG = '1ef5262014c35780';
const BASE_URL = 'http://localhost:3000/api/v1';

export default function () {
  // --- 시나리오 1: 캘린더 정보 조회 (GET) ---
  // 유저가 링크를 타고 처음 들어왔을 때
  const calendarRes = http.get(`${BASE_URL}/calendars/${TARGET_SLUG}`);

  check(calendarRes, {
    '캘린더 조회 성공 (200)': (r) => r.status === 200,
    '응답 시간 < 200ms': (r) => r.timings.duration < 200,
  });

  // --- 시나리오 2: 참가자 등록 (POST) ---
  // 유저가 닉네임을 입력하고 입장 버튼을 눌렀을 때
  const nickname = `T${__VU}_${__ITER}_${Math.floor(Math.random() * 10000)}`;

  const payload = JSON.stringify({
    nickname: nickname,
    password: 'password123',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const joinRes = http.post(`${BASE_URL}/calendars/${TARGET_SLUG}/participants`, payload, params);

  check(joinRes, {
    '참가 성공 (201)': (r) => r.status === 201,
  });

  /*
  // --- 시나리오 3: 참가자 목록 조회 (GET) ---
  // 입장 후 누가 있나 확인
  const listRes = http.get(`${BASE_URL}/calendars/${TARGET_SLUG}/participants`);

  check(listRes, {
    '참가자 목록 조회 성공 (200)': (r) => r.status === 200,
  });
*/
  // 부하 조절을 위해 1초 대기 (너무 빠르면 Rate Limit에 걸릴 수 있음)
  sleep(1);
}
