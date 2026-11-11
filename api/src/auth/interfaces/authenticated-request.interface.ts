import { Request } from 'express';
import { Rol } from '../../generated/prisma/enums';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    rol: Rol;
  };
}
