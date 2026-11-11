import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'bcrypt';
import { Rol } from '../generated/prisma/enums';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

describe('AuthService', () => {
  let service: AuthService;
  const jwtService = new JwtService({
    secret: 'clave-exclusiva-para-pruebas',
    signOptions: { expiresIn: '1h' },
  });
  const usuario = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    username: 'admin',
    passwordHash: '',
    rol: Rol.ADMIN,
    activo: true,
  };
  const prismaService = {
    usuario: {
      findUnique: jest.fn(),
      update: jest.fn<Promise<typeof usuario>, [Prisma.UsuarioUpdateArgs]>(),
    },
  };

  beforeAll(async () => {
    usuario.passwordHash = await hash('ClavePrueba123', 4);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaService.usuario.findUnique.mockResolvedValue(usuario);
    prismaService.usuario.update.mockResolvedValue(usuario);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('emite un JWT con vencimiento sin devolver la contraseña ni su hash', async () => {
    const respuesta = await service.login('  admin  ', 'ClavePrueba123');
    const payload = jwtService.verify<{ sub: string; rol: Rol; exp: number }>(
      respuesta.token,
    );

    expect(payload.sub).toBe(usuario.id);
    expect(payload.rol).toBe(Rol.ADMIN);
    expect(payload.exp).toEqual(expect.any(Number));
    expect(respuesta).not.toHaveProperty('passwordHash');
    expect(respuesta).not.toHaveProperty('password');
    expect(prismaService.usuario.findUnique).toHaveBeenCalledWith({
      where: { username: 'admin' },
    });
    const actualizacion = prismaService.usuario.update.mock.calls[0][0];
    expect(actualizacion.where).toEqual({ id: usuario.id });
    expect(actualizacion.data.ultimoAcceso).toBeInstanceOf(Date);
  });

  it('rechaza un usuario inexistente', async () => {
    prismaService.usuario.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.login('admin', 'ClavePrueba123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prismaService.usuario.update).not.toHaveBeenCalled();
  });

  it('rechaza un usuario inactivo', async () => {
    prismaService.usuario.findUnique.mockResolvedValueOnce({
      ...usuario,
      activo: false,
    });

    await expect(
      service.login('admin', 'ClavePrueba123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prismaService.usuario.update).not.toHaveBeenCalled();
  });

  it('rechaza una contraseña incorrecta', async () => {
    await expect(
      service.login('admin', 'ClaveIncorrecta123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prismaService.usuario.update).not.toHaveBeenCalled();
  });
});
