import { EventEmitter } from 'events';

describe('Redis 장기 장애와 복구', () => {
  let client: EventEmitter & {
    isOpen: boolean;
    isReady: boolean;
    connect: jest.Mock;
    quit: jest.Mock;
    destroy: jest.Mock;
  };
  let config: typeof import('../../../config/redis');
  let options: {
    disableOfflineQueue: boolean;
    socket: { reconnectStrategy: (retries: number) => number };
  };
  let resolveConnection: () => void;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    client = Object.assign(new EventEmitter(), {
      isOpen: false,
      isReady: false,
      connect: jest.fn(() => {
        client.isOpen = true;
        return new Promise<void>((resolve) => {
          resolveConnection = resolve;
        });
      }),
      quit: jest.fn(async () => {
        client.isOpen = false;
        client.emit('end');
      }),
      destroy: jest.fn(() => {
        client.isOpen = false;
        client.emit('end');
        resolveConnection();
      }),
    });
    jest.doMock('redis', () => ({
      createClient: (value: typeof options) => {
        options = value;
        return client;
      },
    }));
    jest.doMock('../../../config/env', () => ({ env: { REDIS_URL: 'redis://localhost:6379' } }));
    jest.doMock('../../../middlewares/logger', () => ({
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    }));
    config = require('../../../config/redis');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
  });

  it('재시도 한도를 넘겨도 계속 재연결하며 대기 시간은 30초를 넘지 않는다', () => {
    for (const retry of [0, 10, 11, 100, 10000]) {
      const delay = options.socket.reconnectStrategy(retry);
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(30000);
    }
    expect(options.disableOfflineQueue).toBe(true);
  });

  it('시작 대기 시간 초과 후에도 복구되면 같은 클라이언트가 사용 가능해진다', async () => {
    const first = config.connectRedis();
    const second = config.connectRedis();
    await jest.advanceTimersByTimeAsync(5000);
    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(false);
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.listenerCount('ready')).toBe(1); // 영구 로깅 리스너만 남는다.

    client.isReady = true;
    client.emit('ready');
    resolveConnection();
    await expect(config.connectRedis()).resolves.toBe(true);
    expect(client.connect).toHaveBeenCalledTimes(1);
  });

  it('소켓만 열렸을 때 성공으로 판단하지 않고 ready 이벤트를 기다린다', async () => {
    const pending = config.connectRedis();
    await jest.advanceTimersByTimeAsync(10);
    client.isReady = true;
    client.emit('ready');
    resolveConnection();
    await expect(pending).resolves.toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('재연결 중 종료하면 QUIT 대기 없이 연결 시도를 중단한다', async () => {
    const pending = config.connectRedis();
    await config.disconnectRedis();
    await expect(pending).resolves.toBe(false);
    expect(client.destroy).toHaveBeenCalledTimes(1);
    expect(client.quit).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
