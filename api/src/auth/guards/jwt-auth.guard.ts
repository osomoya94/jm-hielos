import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const esPublica = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (esPublica) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [tipo, token, ...resto] =
      request.headers.authorization?.trim().split(/\s+/) ?? [];

    if (tipo?.toLowerCase() !== 'bearer' || !token || resto.length > 0) {
      throw new UnauthorizedException('Debe enviar un token Bearer válido');
    }

    let payload: { sub?: unknown; exp?: unknown };

    try {
      payload = await this.jwtService.verifyAsync<{
        sub?: unknown;
        exp?: unknown;
      }>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o vencido');
    }

    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      payload.sub.trim() === '' ||
      typeof payload.exp !== 'number'
    ) {
      throw new UnauthorizedException('Token inválido');
    }

    const usuario = await this.prismaService.usuario.findUnique({
      where: { id: payload.sub },
      select: { id: true, rol: true, activo: true },
    });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario no autorizado');
    }

    // El permiso se toma de la base, aunque el JWT contenga un rol anterior.
    request.user = { id: usuario.id, rol: usuario.rol };

    return true;
  }
}
