import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';

import dbpool from '../config/database';
import { CreateUserInput, User } from '../models';
import { Errors } from '../utils/errors';

export interface IUserRepository {
  findByOauthId(
    provider: 'google' | 'kakao',
    oauthId: string,
    connection?: PoolConnection
  ): Promise<User | null>;
  findUserInfoById(userId: number, connection?: PoolConnection): Promise<User>;
  findUserInfoByUuid(userUuid: string, connection?: PoolConnection): Promise<User>;
  getIdUsingUuid(userUuid: string, connection?: PoolConnection): Promise<number>;
  createUser(userData: CreateUserInput, connection?: PoolConnection): Promise<User>;
}

export class UserRepository implements IUserRepository {
  constructor(private pool = dbpool) {}

  async findByOauthId(
    provider: 'google' | 'kakao',
    oauthId: string,
    connection?: PoolConnection
  ): Promise<User | null> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?',
      [provider, oauthId]
    );

    return rows.length ? this.mapToUser(rows[0]) : null;
  }

  async findUserInfoById(userId: number, connection?: PoolConnection): Promise<User> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>('SELECT * FROM users WHERE id = ?', [
      userId,
    ]);

    if (rows.length === 0) {
      throw Errors.NotFound('유저 조회 실패');
    }

    return this.mapToUser(rows[0]);
  }

  async findUserInfoByUuid(userUuid: string, connection?: PoolConnection): Promise<User> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'SELECT * FROM users WHERE user_uuid = ?',
      [userUuid]
    );

    if (rows.length === 0) {
      throw Errors.NotFound('유저 조회 실패');
    }

    return this.mapToUser(rows[0]);
  }

  async getIdUsingUuid(userUuid: string, connection?: PoolConnection): Promise<number> {
    const poolToUse = connection || this.pool;

    const [rows] = await poolToUse.execute<RowDataPacket[]>(
      'select id from users where user_uuid = ?',
      [userUuid]
    );

    if (rows.length === 0) {
      throw Errors.NotFound('유저 조회 실패');
    }

    return rows[0].id;
  }

  async createUser(userData: CreateUserInput, connection?: PoolConnection): Promise<User> {
    const poolToUse = connection || this.pool;

    const {
      user_uuid,
      email,
      oauth_provider,
      oauth_id,
      nickname,
      profile_image_url,
      isTermsAgreed,
    } = userData;

    const [result] = await poolToUse.execute<ResultSetHeader>(
      'INSERT INTO users (user_uuid, email, oauth_provider, oauth_id, nickname, profile_image_url, isTermsAgreed) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [user_uuid, email, oauth_provider, oauth_id, nickname, profile_image_url, isTermsAgreed]
    );

    if (result.affectedRows !== 1) {
      throw Errors.Internal('유저 생성 실패');
    }

    const newUser = await this.findUserInfoById(result.insertId, connection);

    if (!newUser) {
      throw Errors.Internal('유저 생성 후 조회 실패');
    }

    return newUser;
  }

  private mapToUser(row: RowDataPacket): User {
    return {
      id: row.id,
      user_uuid: row.user_uuid,
      email: row.email,
      oauth_provider: row.oauth_provider,
      oauth_id: row.oauth_id,
      nickname: row.nickname,
      profile_image_url: row.profile_image_url,
      isTermsAgreed: Boolean(row.isTermsAgreed),
      created_at: new Date(row.created_at),
    };
  }
}
