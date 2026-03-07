import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';

import { env } from '../config/env';
import { participantService, tokenService } from '../containers/service.container';
import { CustomSocket } from '../types/socket.types';
import { Errors } from '../utils/errors';
import { CalendarSocketController } from './socket.controller';

let io: Server;
export const initializeSocketIO = (httpServer: HttpServer) => {
  const calendarSocketController = new CalendarSocketController();
  io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
    pingTimeout: 5000,
    pingInterval: 10000,
    transports: ['websocket'],
  });

  io.use(async (socket: CustomSocket, next) => {
    try {
      const authHeader = socket.handshake.headers.authorization;
      const tokenStr = socket.handshake.auth.token || (authHeader && authHeader.split(' ')[1]);

      if (!tokenStr) {
        return next(Errors.Unauthorized('Socket 인증 토큰이 필요합니다'));
      }

      const token = tokenService.verifyParticipantToken(tokenStr);

      const exists = await participantService.existsParticipantByUuid(token.sub);

      if (!exists) {
        return next(Errors.Unauthorized('유효하지 않은 참가자입니다'));
      }

      socket.data = token;
      next();
    } catch (err) {
      next(Errors.Unauthorized('Socket 인증 실패'));
    }
  });

  io.on('connection', (socket: CustomSocket) => {
    console.log(`소켓이 연결됐습니다. 방: ${socket.id} (유저: ${socket.data.sub})`);

    calendarSocketController.handleSocketEvent(socket);

    socket.on('disconnect', () => {
      console.log(`소켓과의 연결이 해제됐습니다: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw Errors.Internal('Socket.IO가 아직 초기화되지 않았습니다.');
  }
  return io;
};
