import { AuthController } from '../controllers/auth.controller';
import { authService } from './service.container';

export const authController = new AuthController(authService);
