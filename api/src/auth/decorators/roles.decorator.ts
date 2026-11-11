import { SetMetadata } from '@nestjs/common';
import { Rol } from '../../generated/prisma/enums';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
