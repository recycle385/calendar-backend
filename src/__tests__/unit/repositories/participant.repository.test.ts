import { ParticipantRepository } from '../../../repositories/participant.repository';

describe('ParticipantRepository', () => {
  const execute = jest.fn();
  const repository = new ParticipantRepository({ execute } as never);

  beforeEach(() => {
    execute.mockReset();
  });

  it.each([
    [[{ exists: 1 }], true],
    [[], false],
  ])('캘린더에 연결된 회원 참가자 존재 여부를 반환한다', async (rows, expected) => {
    execute.mockResolvedValue([rows]);

    await expect(repository.existsByCalendarAndUser(12, 34)).resolves.toBe(expected);
    expect(execute).toHaveBeenCalledWith(
      'SELECT 1 FROM participants WHERE calendar_id = ? AND user_id = ? LIMIT 1',
      [12, 34]
    );
  });
});
