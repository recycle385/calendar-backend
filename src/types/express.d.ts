declare global {
  namespace Express {
    interface Request {
      userUuid?: string;
      userRole?: 'host' | 'guest';
      nickname?: string;

      participantUuid?: string;
      calendarId?: string;
    }
  }
}

export {};
