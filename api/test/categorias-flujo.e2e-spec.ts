import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import type { CategoriaFlujo, Prisma } from '../src/generated/prisma/client';
import { GrupoFlujo, Rol, TipoMovimiento } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

// Aplicación, DTO y guards reales; Prisma simulado. No se accede a PostgreSQL ni a .env.
jest.mock('../src/prisma/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('../src/generated/prisma/client', () => ({
  Prisma: jest.requireActual<typeof import('@prisma/client/runtime/client')>(
    '@prisma/client/runtime/client',
  ),
}));

describe('CategoriasFlujo (e2e con Prisma simulado)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let tokenAdmin: string;
  const usuario = {
    id: '123e4567-e89b-42d3-a456-426614174001',
    rol: Rol.ADMIN,
    activo: true,
  };
  const categoria: CategoriaFlujo = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    nombre: 'Ventas de hielo',
    grupo: GrupoFlujo.OPERACION,
    sentido: TipoMovimiento.INGRESO,
    activo: true,
  };
  const datosCreacion = {
    nombre: categoria.nombre,
    grupo: categoria.grupo,
    sentido: categoria.sentido,
  };
  const rutasConsulta = [
    '/categorias-flujo',
    '/categorias-flujo/inactivas',
    `/categorias-flujo/${categoria.id}`,
  ];
  const rutasEscritura = [
    { metodo: 'post', ruta: '/categorias-flujo', datos: datosCreacion },
    {
      metodo: 'patch',
      ruta: `/categorias-flujo/${categoria.id}`,
      datos: { nombre: 'Cobros de ventas' },
    },
    {
      metodo: 'patch',
      ruta: `/categorias-flujo/${categoria.id}/estado`,
      datos: { activo: false },
    },
  ] as const;
  const prismaService = {
    usuario: {
      findUnique: jest.fn<
        Promise<typeof usuario | null>,
        [Prisma.UsuarioFindUniqueArgs]
      >(),
    },
    categoriaFlujo: {
      findMany: jest.fn<
        Promise<CategoriaFlujo[]>,
        [Prisma.CategoriaFlujoFindManyArgs]
      >(),
      findUnique: jest.fn<
        Promise<CategoriaFlujo | null>,
        [Prisma.CategoriaFlujoFindUniqueArgs]
      >(),
      create: jest.fn<
        Promise<CategoriaFlujo>,
        [Prisma.CategoriaFlujoCreateArgs]
      >(),
      update: jest.fn<
        Promise<CategoriaFlujo>,
        [Prisma.CategoriaFlujoUpdateArgs]
      >(),
    },
    movimientoFinanciero: {
      findFirst: jest.fn<
        Promise<{ id: string } | null>,
        [Prisma.MovimientoFinancieroFindFirstArgs]
      >(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .compile();

    jwtService = module.get(JwtService);
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    tokenAdmin = jwtService.sign({ sub: usuario.id, rol: Rol.ADMIN });
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prismaService.usuario.findUnique.mockResolvedValue(usuario);
    prismaService.categoriaFlujo.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(where.id === categoria.id ? categoria : null),
    );
    prismaService.categoriaFlujo.findMany.mockResolvedValue([categoria]);
    prismaService.categoriaFlujo.create.mockImplementation(({ data }) =>
      Promise.resolve({
        ...categoria,
        nombre: data.nombre,
        grupo: data.grupo,
        sentido: data.sentido,
      }),
    );
    prismaService.categoriaFlujo.update.mockImplementation(({ data }) =>
      Promise.resolve({
        ...categoria,
        nombre:
          typeof data.nombre === 'string' ? data.nombre : categoria.nombre,
        activo:
          typeof data.activo === 'boolean' ? data.activo : categoria.activo,
      }),
    );
    prismaService.movimientoFinanciero.findFirst.mockResolvedValue(null);
  });

  afterAll(async () => {
    await app.close();
  });

  describe.each(Object.values(Rol))('Consultas de %s', (rol) => {
    it.each(rutasConsulta)('permite GET %s', async (ruta) => {
      prismaService.usuario.findUnique.mockResolvedValueOnce({
        ...usuario,
        rol,
      });
      const token = jwtService.sign({ sub: usuario.id, rol });

      await request(app.getHttpServer())
        .get(ruta)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  it.each(rutasConsulta)('rechaza GET %s sin autenticación', async (ruta) => {
    await request(app.getHttpServer()).get(ruta).expect(401);
    expect(prismaService.categoriaFlujo.findUnique).not.toHaveBeenCalled();
    expect(prismaService.categoriaFlujo.findMany).not.toHaveBeenCalled();
  });

  it.each(rutasEscritura)(
    'rechaza $metodo $ruta sin autenticación',
    async ({ metodo, ruta, datos }) => {
      await request(app.getHttpServer())[metodo](ruta).send(datos).expect(401);
      expect(prismaService.categoriaFlujo.create).not.toHaveBeenCalled();
      expect(prismaService.categoriaFlujo.update).not.toHaveBeenCalled();
    },
  );

  describe.each([Rol.OPERADOR, Rol.LECTOR])('Escrituras de %s', (rol) => {
    it.each(rutasEscritura)(
      'deniega $metodo $ruta con 403',
      async ({ metodo, ruta, datos }) => {
        prismaService.usuario.findUnique.mockResolvedValueOnce({
          ...usuario,
          rol,
        });
        const token = jwtService.sign({ sub: usuario.id, rol });

        await request(app.getHttpServer())
          [metodo](ruta)
          .set('Authorization', `Bearer ${token}`)
          .send(datos)
          .expect(403);

        expect(prismaService.categoriaFlujo.findUnique).not.toHaveBeenCalled();
        expect(prismaService.categoriaFlujo.create).not.toHaveBeenCalled();
        expect(prismaService.categoriaFlujo.update).not.toHaveBeenCalled();
      },
    );
  });

  it('aplica el rol vigente del usuario aunque el token diga ADMIN', async () => {
    prismaService.usuario.findUnique.mockResolvedValueOnce({
      ...usuario,
      rol: Rol.LECTOR,
    });

    await request(app.getHttpServer())
      .post('/categorias-flujo')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(datosCreacion)
      .expect(403);
    expect(prismaService.categoriaFlujo.create).not.toHaveBeenCalled();
  });

  it('ADMIN crea una categoría activa recortando espacios del nombre', async () => {
    await request(app.getHttpServer())
      .post('/categorias-flujo')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...datosCreacion, nombre: '  Ventas de hielo  ' })
      .expect(201)
      .expect({ ...categoria, message: 'Categoría de flujo creada con éxito' });

    expect(prismaService.categoriaFlujo.create).toHaveBeenCalledWith({
      data: datosCreacion,
    });
  });

  it.each(Object.values(GrupoFlujo))(
    'acepta el grupo %s generado por Prisma',
    async (grupo) => {
      await request(app.getHttpServer())
        .post('/categorias-flujo')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ...datosCreacion, grupo })
        .expect(201)
        .expect({
          ...categoria,
          grupo,
          message: 'Categoría de flujo creada con éxito',
        });
    },
  );

  it.each(Object.values(TipoMovimiento))(
    'acepta el sentido %s generado por Prisma',
    async (sentido) => {
      await request(app.getHttpServer())
        .post('/categorias-flujo')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ...datosCreacion, sentido })
        .expect(201)
        .expect({
          ...categoria,
          sentido,
          message: 'Categoría de flujo creada con éxito',
        });
    },
  );

  it.each(['A', 'a'.repeat(100)])(
    'acepta el límite válido del nombre: %s',
    async (nombre) => {
      await request(app.getHttpServer())
        .post('/categorias-flujo')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ...datosCreacion, nombre })
        .expect(201);
      expect(prismaService.categoriaFlujo.create).toHaveBeenCalledWith({
        data: { ...datosCreacion, nombre },
      });
    },
  );

  it.each([
    { nombre: undefined },
    { nombre: '' },
    { nombre: ' \t\n ' },
    { nombre: null },
    { nombre: 123 },
    { nombre: [] },
    { nombre: {} },
    { nombre: 'a'.repeat(101) },
    { grupo: undefined },
    { grupo: null },
    { grupo: 'INEXISTENTE' },
    { grupo: 'operacion' },
    { grupo: 1 },
    { sentido: undefined },
    { sentido: null },
    { sentido: 'ENTRADA' },
    { sentido: 'ingreso' },
    { sentido: 1 },
    { activo: false },
    { activo: true },
    { id: categoria.id },
    { movimientos: [] },
    { desconocido: 'valor' },
  ])('rechaza una creación inválida: %j', async (datos) => {
    await request(app.getHttpServer())
      .post('/categorias-flujo')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...datosCreacion, ...datos })
      .expect(400);

    expect(prismaService.categoriaFlujo.findUnique).not.toHaveBeenCalled();
    expect(prismaService.categoriaFlujo.create).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'devuelve 409 para una combinación duplicada con activo=%s',
    async (activo) => {
      prismaService.categoriaFlujo.findUnique.mockResolvedValueOnce({
        ...categoria,
        activo,
      });

      await request(app.getHttpServer())
        .post('/categorias-flujo')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(datosCreacion)
        .expect(409);
      expect(prismaService.categoriaFlujo.create).not.toHaveBeenCalled();
    },
  );

  it.each(['crear', 'editar'] as const)(
    'responde 409 ante P2002 al %s',
    async (operacion) => {
      const error = new PrismaClientKnownRequestError('Combinación duplicada', {
        code: 'P2002',
        clientVersion: '7.10.0',
      });

      if (operacion === 'crear') {
        prismaService.categoriaFlujo.create.mockRejectedValueOnce(error);
        await request(app.getHttpServer())
          .post('/categorias-flujo')
          .set('Authorization', `Bearer ${tokenAdmin}`)
          .send(datosCreacion)
          .expect(409);
      } else {
        prismaService.categoriaFlujo.update.mockRejectedValueOnce(error);
        await request(app.getHttpServer())
          .patch(`/categorias-flujo/${categoria.id}`)
          .set('Authorization', `Bearer ${tokenAdmin}`)
          .send({ nombre: 'Otro nombre' })
          .expect(409);
      }
    },
  );

  it.each([true, false])(
    'filtra el listado con activo=%s y ordena por nombre',
    async (activo) => {
      prismaService.categoriaFlujo.findMany.mockResolvedValueOnce([
        { ...categoria, activo },
      ]);

      await request(app.getHttpServer())
        .get(activo ? '/categorias-flujo' : '/categorias-flujo/inactivas')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .expect(200)
        .expect([{ ...categoria, activo }]);
      expect(prismaService.categoriaFlujo.findMany).toHaveBeenCalledWith({
        where: { activo },
        orderBy: { nombre: 'asc' },
      });
    },
  );

  it('devuelve una lista vacía cuando no hay categorías', async () => {
    prismaService.categoriaFlujo.findMany.mockResolvedValueOnce([]);

    await request(app.getHttpServer())
      .get('/categorias-flujo')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200)
      .expect([]);
  });

  it.each([true, false])(
    'consulta por ID una categoría con activo=%s',
    async (activo) => {
      prismaService.categoriaFlujo.findUnique.mockResolvedValueOnce({
        ...categoria,
        activo,
      });

      await request(app.getHttpServer())
        .get(`/categorias-flujo/${categoria.id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .expect(200)
        .expect({ ...categoria, activo });
    },
  );

  it('ADMIN renombra una categoría sin movimientos recortando el nombre', async () => {
    await request(app.getHttpServer())
      .patch(`/categorias-flujo/${categoria.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: '  Cobros de ventas  ' })
      .expect(200)
      .expect({
        ...categoria,
        nombre: 'Cobros de ventas',
        message: 'Categoría de flujo editada con éxito',
      });

    expect(prismaService.categoriaFlujo.update).toHaveBeenCalledWith({
      where: { id: categoria.id, activo: true, movimientos: { none: {} } },
      data: { nombre: 'Cobros de ventas' },
    });
  });

  it.each([
    {},
    { nombre: '' },
    { nombre: '   ' },
    { nombre: null },
    { nombre: false },
    { nombre: [] },
    { nombre: 'a'.repeat(101) },
    { nombre: 'Otro nombre', grupo: GrupoFlujo.OTROS },
    { nombre: 'Otro nombre', grupo: categoria.grupo },
    { nombre: 'Otro nombre', sentido: TipoMovimiento.EGRESO },
    { nombre: 'Otro nombre', sentido: categoria.sentido },
    { nombre: 'Otro nombre', activo: false },
    { nombre: 'Otro nombre', movimientos: [] },
    { nombre: 'Otro nombre', id: categoria.id },
  ])(
    'rechaza una edición inválida o con campos inmutables: %j',
    async (datos) => {
      await request(app.getHttpServer())
        .patch(`/categorias-flujo/${categoria.id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(datos)
        .expect(400);

      expect(prismaService.categoriaFlujo.update).not.toHaveBeenCalled();
    },
  );

  it('rechaza editar una categoría inactiva', async () => {
    prismaService.categoriaFlujo.findUnique.mockResolvedValueOnce({
      ...categoria,
      activo: false,
    });

    await request(app.getHttpServer())
      .patch(`/categorias-flujo/${categoria.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Otro nombre' })
      .expect(400);
    expect(prismaService.categoriaFlujo.update).not.toHaveBeenCalled();
  });

  it('rechaza renombrar una categoría con movimientos relacionados', async () => {
    prismaService.movimientoFinanciero.findFirst.mockResolvedValueOnce({
      id: 'movimiento',
    });

    await request(app.getHttpServer())
      .patch(`/categorias-flujo/${categoria.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Otro nombre' })
      .expect(400);
    expect(prismaService.categoriaFlujo.update).not.toHaveBeenCalled();
  });

  it('permite conservar el nombre de una categoría con movimientos sin escribir', async () => {
    prismaService.movimientoFinanciero.findFirst.mockResolvedValueOnce({
      id: 'movimiento',
    });

    await request(app.getHttpServer())
      .patch(`/categorias-flujo/${categoria.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: '  Ventas de hielo  ' })
      .expect(200);
    expect(prismaService.categoriaFlujo.update).not.toHaveBeenCalled();
  });

  it('rechaza renombrar usando una combinación ya ocupada', async () => {
    prismaService.categoriaFlujo.findUnique
      .mockResolvedValueOnce(categoria)
      .mockResolvedValueOnce({ ...categoria, id: 'otra-categoria' });

    await request(app.getHttpServer())
      .patch(`/categorias-flujo/${categoria.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Otro nombre' })
      .expect(409);
    expect(prismaService.categoriaFlujo.update).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'ADMIN cambia a activo=%s sin escribir ni borrar movimientos',
    async (activo) => {
      prismaService.categoriaFlujo.findUnique.mockResolvedValueOnce({
        ...categoria,
        activo: !activo,
      });

      await request(app.getHttpServer())
        .patch(`/categorias-flujo/${categoria.id}/estado`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ activo })
        .expect(200)
        .expect({
          ...categoria,
          activo,
          message: 'Se actualizó estado con éxito',
        });

      expect(prismaService.categoriaFlujo.update).toHaveBeenCalledWith({
        where: { id: categoria.id },
        data: { activo },
      });
      for (const consulta of Object.values(
        prismaService.movimientoFinanciero,
      )) {
        expect(consulta).not.toHaveBeenCalled();
      }
    },
  );

  it.each([true, false])(
    'rechaza repetir el estado activo=%s',
    async (activo) => {
      prismaService.categoriaFlujo.findUnique.mockResolvedValueOnce({
        ...categoria,
        activo,
      });

      await request(app.getHttpServer())
        .patch(`/categorias-flujo/${categoria.id}/estado`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ activo })
        .expect(400);
      expect(prismaService.categoriaFlujo.update).not.toHaveBeenCalled();
    },
  );

  it.each([
    {},
    { activo: null },
    { activo: 'false' },
    { activo: 'true' },
    { activo: 0 },
    { activo: 1 },
    { activo: [] },
    { activo: false, nombre: 'Otro nombre' },
    { activo: false, grupo: GrupoFlujo.OTROS },
    { activo: false, sentido: TipoMovimiento.EGRESO },
  ])('rechaza un cambio de estado inválido: %j', async (datos) => {
    await request(app.getHttpServer())
      .patch(`/categorias-flujo/${categoria.id}/estado`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(datos)
      .expect(400);
    expect(prismaService.categoriaFlujo.update).not.toHaveBeenCalled();
  });

  it.each([
    { metodo: 'get', sufijo: '', datos: {} },
    { metodo: 'patch', sufijo: '', datos: { nombre: 'Otro nombre' } },
    { metodo: 'patch', sufijo: '/estado', datos: { activo: false } },
  ] as const)(
    'rechaza un UUID inválido en $metodo :id$sufijo',
    async ({ metodo, sufijo, datos }) => {
      await request(app.getHttpServer())
        [metodo](`/categorias-flujo/id-invalido${sufijo}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(datos)
        .expect(400);
      expect(prismaService.categoriaFlujo.findUnique).not.toHaveBeenCalled();
    },
  );

  it.each([
    { metodo: 'get', sufijo: '', datos: {} },
    { metodo: 'patch', sufijo: '', datos: { nombre: 'Otro nombre' } },
    { metodo: 'patch', sufijo: '/estado', datos: { activo: false } },
  ] as const)(
    'devuelve 404 para un ID inexistente en $metodo :id$sufijo',
    async ({ metodo, sufijo, datos }) => {
      prismaService.categoriaFlujo.findUnique.mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        [metodo](`/categorias-flujo/${categoria.id}${sufijo}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(datos)
        .expect(404);
      expect(prismaService.categoriaFlujo.update).not.toHaveBeenCalled();
    },
  );

  it('no expone DELETE', async () => {
    await request(app.getHttpServer())
      .delete(`/categorias-flujo/${categoria.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(404);
    expect(prismaService.categoriaFlujo.update).not.toHaveBeenCalled();
  });
});
