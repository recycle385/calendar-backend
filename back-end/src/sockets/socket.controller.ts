import { CustomSocket } from '../types/socket.types';

export class CalendarSocketController {
  public handleSocketEvent(socket: CustomSocket) {
    socket.on('joinCalendarRoom', () => {
      // [디버깅] 이벤트 수신 확인용 로그 (필수!)
      console.log(`[DEBUG] joinCalendarRoom 이벤트 수신: Socket ID ${socket.id}`);
      try {
        this.joinCalendarRoom(socket);
      } catch (err) {
        console.error(`joinCalendarRoom 핸들러 에러: ${(err as Error).message}`);
        socket.emit('error', { message: 'Internal Server Error during Join' });
      }
    });

    socket.on('leaveCalendarRoom', () => {
      try {
        this.handleLeave(socket);
        console.log(
          `유저 ${socket.data.sub}님이 캘린더 방 ${socket.data.calendarId}에서 나갔습니다.`
        );
      } catch (err) {
        console.error(`leaveCalendarRoom 에러: ${(err as Error).message}`);
      }
    });

    socket.on('disconnect', () => {
      try {
        this.handleLeave(socket);
        console.log(`유저 ${socket.data.sub}님이 연결을 종료했습니다.`);
      } catch (err) {
        console.error(`disconnect 에러: ${(err as Error).message}`);
      }
    });

    socket.on('error', (err: Error) => {
      console.error(`소켓 에러 발생: ${err.message}`);
    });
  }

  private async joinCalendarRoom(socket: CustomSocket) {
    try {
      // 🚨 [안전장치 1] 변수명 방어 로직
      // socket.data에 calendarId가 없으면 calendarSlug나 calendar_id도 찾아봅니다.
      const calendarId =
        socket.data.calendarId ||
        (socket.data as any).calendarSlug ||
        (socket.data as any).calendar_id;

      const { nickname, sub, role } = socket.data;

      // 🚨 [안전장치 2] ID 누락 시 즉시 에러 처리
      if (!calendarId) {
        console.error(`[ERROR] 방 입장 실패: Calendar ID가 없습니다. User: ${sub}`);
        // 클라이언트(테스트)에게 에러를 알려줘서 타임아웃 대신 실패하게 함
        socket.emit('error', { message: 'Calendar ID is missing in socket data' });
        return;
      }

      // [디버깅] 실제 입장 시도 로그
      console.log(`[DEBUG] 입장 시도 - ID: ${sub}, Room: ${calendarId}`);

      if (socket.rooms.has(calendarId)) {
        console.log(`[DEBUG] 이미 방에 존재함: ${calendarId}`);
        return;
      }

      await socket.join(calendarId);

      console.log(`아이디: ${sub}가 캘린더 방: ${calendarId} 입장 성공`);

      socket.to(calendarId).emit('userOnline', { sub, nickname, role });

      const sockets = await socket.in(calendarId).fetchSockets();

      const onlineUsers = sockets.map((s) => {
        const data = (s as unknown as CustomSocket).data;
        return { sub: data.sub, nickname: data.nickname, role: data.role };
      });

      // 내 정보도 포함해서 전송
      onlineUsers.push({ sub, nickname, role });

      socket.emit('onlineUsers', onlineUsers);
    } catch (err) {
      console.error(`joinCalendarRoom 내부 로직 에러: ${(err as Error).message}`);
      socket.emit('error', { message: 'Join Room Failed' });
    }
  }

  private handleLeave(socket: CustomSocket) {
    try {
      // 나갈 때도 안전하게 체크
      const calendarId = socket.data.calendarId || (socket.data as any).calendarSlug;
      const { nickname, sub } = socket.data;

      if (calendarId) {
        socket.leave(calendarId);

        socket.to(calendarId).emit('userOffline', { sub, nickname });

        console.log(`아이디: ${sub}가 캘린더 방: ${calendarId} 퇴장`);
      }
    } catch (err) {
      console.error(`handleLeave 에러: ${(err as Error).message}`);
    }
  }
}
