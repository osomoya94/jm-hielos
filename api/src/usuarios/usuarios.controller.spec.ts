import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

// Las pruebas usan un Prisma simulado y no se conectan a la base de datos.
jest.mock('../prisma/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('../generated/prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {},
  },
}));

describe('UsuariosController', () => {
  let app: INestApplication<App>;
  const usuario = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    username: 'admin',
    rol: 'ADMIN',
    activo: true,
    ultimoAcceso: null,
  };
  const camposPublicosUsuario = {
    id: true,
    username: true,
    rol: true,
    activo: true,
    ultimoAcceso: true,
  };
  const prismaService = {
    usuario: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn<Promise<typeof usuario>, [Prisma.UsuarioCreateArgs]>(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaService.usuario.findMany.mockResolvedValue([usuario]);
    prismaService.usuario.findUnique.mockResolvedValue(usuario);
    prismaService.usuario.create.mockResolvedValue(usuario);
    prismaService.usuario.update.mockResolvedValue(usuario);
    prismaService.usuario.count.mockResolvedValue(2);

    const module = await Test.createTestingModule({
      controllers: [UsuariosController],
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('conserva la creacion de usuarios sin devolver passwordHash', async () => {
    prismaService.usuario.findUnique.mockResolvedValueOnce(null);

    const respuesta = await request(app.getHttpServer())
      .post('/usuarios')
      .send({
        username: '  admin  ',
        password: 'ClaveSegura123',
        rol: 'ADMIN',
      })
      .expect(201)
      .expect({
        id: usuario.id,
        username: usuario.username,
        rol: usuario.rol,
        activo: usuario.activo,
        message: 'Usuario creado con éxito',
      });

    const datosCreacion = prismaService.usuario.create.mock.calls[0][0].data;

    expect(prismaService.usuario.create.mock.calls[0][0].select).toEqual(
      camposPublicosUsuario,
    );
    expect(datosCreacion.username).toBe('admin');
    expect(datosCreacion.rol).toBe('ADMIN');
    expect(datosCreacion.passwordHash).toEqual(expect.any(String));
    expect(datosCreacion.passwordHash).not.toBe('ClaveSegura123');
    expect(respuesta.body).not.toHaveProperty('passwordHash');
  });

  it('rechaza crear un usuario con username duplicado', async () => {
    await request(app.getHttpServer())
      .post('/usuarios')
      .send({
        username: usuario.username,
        password: 'ClaveSegura123',
        rol: 'ADMIN',
      })
      .expect(409);

    expect(prismaService.usuario.create).not.toHaveBeenCalled();
  });

  it('lista solamente los usuarios activos ordenados por username ascendente', async () => {
    await request(app.getHttpServer())
      .get('/usuarios')
      .expect(200)
      .expect([usuario]);

    expect(prismaService.usuario.findMany).toHaveBeenCalledWith({
      where: { activo: true },
      select: camposPublicosUsuario,
      orderBy: { username: 'asc' },
    });
  });

  it('lista solamente los usuarios inactivos ordenados por username ascendente', async () => {
    const usuarioInactivo = { ...usuario, activo: false };
    prismaService.usuario.findMany.mockResolvedValue([usuarioInactivo]);

    await request(app.getHttpServer())
      .get('/usuarios/inactivos')
      .expect(200)
      .expect([usuarioInactivo]);

    expect(prismaService.usuario.findMany).toHaveBeenCalledWith({
      where: { activo: false },
      select: camposPublicosUsuario,
      orderBy: { username: 'asc' },
    });
  });

  it('consulta por ID un usuario inactivo sin devolver passwordHash', async () => {
    const usuarioInactivo = { ...usuario, activo: false };
    prismaService.usuario.findUnique.mockResolvedValue(usuarioInactivo);

    const respuesta = await request(app.getHttpServer())
      .get(`/usuarios/${usuario.id}`)
      .expect(200)
      .expect(usuarioInactivo);

    expect(prismaService.usuario.findUnique).toHaveBeenCalledWith({
      where: { id: usuario.id },
      select: camposPublicosUsuario,
    });
    expect(respuesta.body).not.toHaveProperty('passwordHash');
  });

  it('permite cambiar el rol si existen dos administradores activos', async () => {
    const usuarioEditado = {
      ...usuario,
      username: 'operador',
      rol: 'OPERADOR',
    };
    prismaService.usuario.findUnique
      .mockResolvedValueOnce(usuario)
      .mockResolvedValueOnce(null);
    prismaService.usuario.update.mockResolvedValue(usuarioEditado);

    await request(app.getHttpServer())
      .patch(`/usuarios/${usuario.id}`)
      .send({ username: '  operador  ', rol: 'OPERADOR' })
      .expect(200)
      .expect({ ...usuarioEditado, message: 'Usuario editado con éxito' });

    expect(prismaService.usuario.update).toHaveBeenCalledWith({
      where: { id: usuario.id },
      data: { username: 'operador', rol: 'OPERADOR' },
      select: camposPublicosUsuario,
    });
    expect(prismaService.usuario.count).toHaveBeenCalledWith({
      where: { rol: 'ADMIN', activo: true },
    });
  });

  it.each(['OPERADOR', 'LECTOR'])(
    'rechaza cambiar el rol del último administrador activo a %s',
    async (rol) => {
      prismaService.usuario.count.mockResolvedValue(1);

      await request(app.getHttpServer())
        .patch(`/usuarios/${usuario.id}`)
        .send({ rol })
        .expect(400)
        .expect(({ body }: { body: { message: string } }) => {
          expect(body.message).toBe(
            'No se puede cambiar el rol del último administrador activo',
          );
        });

      expect(prismaService.usuario.count).toHaveBeenCalledWith({
        where: { rol: 'ADMIN', activo: true },
      });
      expect(prismaService.usuario.update).not.toHaveBeenCalled();
    },
  );

  it('permite conservar el mismo username del usuario editado', async () => {
    prismaService.usuario.findUnique
      .mockResolvedValueOnce(usuario)
      .mockResolvedValueOnce({ id: usuario.id });

    await request(app.getHttpServer())
      .patch(`/usuarios/${usuario.id}`)
      .send({ username: usuario.username })
      .expect(200);

    expect(prismaService.usuario.update).toHaveBeenCalled();
  });

  it('rechaza editar con el username de otro usuario', async () => {
    prismaService.usuario.findUnique
      .mockResolvedValueOnce(usuario)
      .mockResolvedValueOnce({
        id: '7ce9df79-673a-47ad-b49e-f23a116b1e00',
      });

    await request(app.getHttpServer())
      .patch(`/usuarios/${usuario.id}`)
      .send({ username: 'otro-usuario' })
      .expect(409);

    expect(prismaService.usuario.update).not.toHaveBeenCalled();
  });

  it('rechaza una edicion vacia', async () => {
    await request(app.getHttpServer())
      .patch(`/usuarios/${usuario.id}`)
      .send({})
      .expect(400);

    expect(prismaService.usuario.findUnique).not.toHaveBeenCalled();
    expect(prismaService.usuario.update).not.toHaveBeenCalled();
  });

  it('rechaza editar un usuario inactivo', async () => {
    prismaService.usuario.findUnique.mockResolvedValue({
      ...usuario,
      activo: false,
    });

    await request(app.getHttpServer())
      .patch(`/usuarios/${usuario.id}`)
      .send({ rol: 'LECTOR' })
      .expect(400)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'El usuario está inactivo, no puede modificarse',
        );
      });

    expect(prismaService.usuario.update).not.toHaveBeenCalled();
  });

  it('permite desactivar un administrador si existe otro activo', async () => {
    const usuarioInactivo = { ...usuario, activo: false };
    prismaService.usuario.update.mockResolvedValue(usuarioInactivo);

    await request(app.getHttpServer())
      .patch(`/usuarios/${usuario.id}/estado`)
      .send({ activo: false })
      .expect(200)
      .expect({
        ...usuarioInactivo,
        message: 'Se actualizó estado con éxito',
      });

    expect(prismaService.usuario.update).toHaveBeenCalledWith({
      where: { id: usuario.id },
      data: { activo: false },
      select: camposPublicosUsuario,
    });
    expect(prismaService.usuario.count).toHaveBeenCalledWith({
      where: { rol: 'ADMIN', activo: true },
    });
  });

  it('rechaza desactivar al último administrador activo', async () => {
    prismaService.usuario.count.mockResolvedValue(1);

    await request(app.getHttpServer())
      .patch(`/usuarios/${usuario.id}/estado`)
      .send({ activo: false })
      .expect(400)
      .expect(({ body }: { body: { message: string } }) => {
        expect(body.message).toBe(
          'No se puede desactivar al último administrador activo',
        );
      });

    expect(prismaService.usuario.count).toHaveBeenCalledWith({
      where: { rol: 'ADMIN', activo: true },
    });
    expect(prismaService.usuario.update).not.toHaveBeenCalled();
  });

  it('reactiva un usuario inactivo', async () => {
    prismaService.usuario.findUnique.mockResolvedValue({
      ...usuario,
      activo: false,
    });

    await request(app.getHttpServer())
      .patch(`/usuarios/${usuario.id}/estado`)
      .send({ activo: true })
      .expect(200)
      .expect({ ...usuario, message: 'Se actualizó estado con éxito' });

    expect(prismaService.usuario.update).toHaveBeenCalledWith({
      where: { id: usuario.id },
      data: { activo: true },
      select: camposPublicosUsuario,
    });
  });

  it.each([true, false])('rechaza repetir el estado %s', async (activo) => {
    prismaService.usuario.findUnique.mockResolvedValue({
      ...usuario,
      activo,
    });

    await request(app.getHttpServer())
      .patch(`/usuarios/${usuario.id}/estado`)
      .send({ activo })
      .expect(400);

    expect(prismaService.usuario.update).not.toHaveBeenCalled();
  });

  it('devuelve 404 al consultar, editar o cambiar el estado de un usuario inexistente', async () => {
    prismaService.usuario.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get(`/usuarios/${usuario.id}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/usuarios/${usuario.id}`)
      .send({ rol: 'LECTOR' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/usuarios/${usuario.id}/estado`)
      .send({ activo: false })
      .expect(404);

    expect(prismaService.usuario.update).not.toHaveBeenCalled();
  });

  it.each([
    { username: '' },
    { username: '   ' },
    { username: null },
    { username: 123 },
    { rol: '' },
    { rol: null },
    { rol: 'SUPERADMIN' },
    { password: 'NuevaClave123' },
    { activo: false },
  ])('rechaza una edicion invalida: %j', async (datos) => {
    await request(app.getHttpServer())
      .patch(`/usuarios/${usuario.id}`)
      .send(datos)
      .expect(400);

    expect(prismaService.usuario.update).not.toHaveBeenCalled();
  });

  it.each([{}, { activo: null }, { activo: 'false' }, { activo: 1 }])(
    'rechaza un estado invalido: %j',
    async (datos) => {
      await request(app.getHttpServer())
        .patch(`/usuarios/${usuario.id}/estado`)
        .send(datos)
        .expect(400);

      expect(prismaService.usuario.update).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['GET', '/usuarios/id-invalido', undefined],
    ['PATCH', '/usuarios/id-invalido', { rol: 'LECTOR' }],
    ['PATCH', '/usuarios/id-invalido/estado', { activo: false }],
  ])('rechaza un ID invalido en %s %s', async (metodo, ruta, datos) => {
    const peticion =
      metodo === 'GET'
        ? request(app.getHttpServer()).get(ruta)
        : request(app.getHttpServer()).patch(ruta).send(datos);

    await peticion.expect(400);
    expect(prismaService.usuario.findUnique).not.toHaveBeenCalled();
    expect(prismaService.usuario.update).not.toHaveBeenCalled();
  });
});
