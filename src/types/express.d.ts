declare global {
  namespace Express {
    interface Request {
      userUuid?: string;
      userRole?: 'host' | 'guest';
      nickname?: string;

      participantUuid?: string;
      calendarSlug?: string;
      /** @deprecated Participant token의 legacy slug 필드. 새 코드는 calendarSlug 사용. */
      calendarId?: string;
    }
  }
}

export {};
