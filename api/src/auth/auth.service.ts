import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { compare } from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const normalizarUsername = username.trim();

    const user = await this.prismaService.usuario.findUnique({
      where: {
        username: normalizarUsername,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Username o contrasenia incorrecto');
    }

    if (!user.activo) {
      throw new UnauthorizedException('Username o contrasenia incorrecto');
    }

    const compararPassword = await compare(password, user.passwordHash);

    if (!compararPassword) {
      throw new UnauthorizedException('Username o contrasenia incorrecto');
    }

    await this.prismaService.usuario.update({
      where: { id: user.id },
      data: {
        ultimoAcceso: new Date(),
      },
    });

    const payload = { sub: user.id, rol: user.rol };

    const authResponse = {
      id: user.id,
      username: user.username,
      rol: user.rol,
      activo: user.activo,
      mensaje: 'Ingreso con exito',
      token: this.jwtService.sign(payload),
    };

    return authResponse;
  }
}
