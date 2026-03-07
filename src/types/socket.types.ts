import { Socket } from 'socket.io';

import { ParticipantTokenPayload } from './token.types';

export interface CustomSocket extends Socket {
  data: ParticipantTokenPayload;
}
