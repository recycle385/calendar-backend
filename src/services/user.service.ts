import { IUserRepository } from '../types/user.types';

export interface IUserService {
  getIdUsingUuid(userUuid: string): Promise<number>;
}

export class UserService implements IUserService {
  constructor(private userRepository: IUserRepository) {}
  async getIdUsingUuid(userUuid: string): Promise<number> {
    return this.userRepository.getIdUsingUuid(userUuid);
  }
}
