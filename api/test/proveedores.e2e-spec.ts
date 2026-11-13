import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import type { Prisma, Proveedor } from '../src/generated/prisma/client';
import { Rol } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

// AppModule y guards reales; Prisma simulado y clave de prueba desde setup.ts.
jest.mock('../src/prisma/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('../src/generated/prisma/client', () => ({
  Prisma: jest.requireActual<typeof import('@prisma/client/runtime/client')>(
    '@prisma/client/runtime/client',
  ),
}));

describe('Proveedores (e2e con Prisma simulado)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let token: string;
  const usuario = {
    id: '123e4567-e89b-42d3-a456-426614174001',
    rol: Rol.ADMIN as Rol,
    activo: true,
  };
  const proveedor: Proveedor = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    nombre: 'Proveedor de bolsas',
    cuit: null,
    telefono: null,
    direccion: null,
    observaciones: null,
    activo: true,
  };
  const rutasConsulta = [
    '/proveedores',
    '/proveedores/inactivos',
    `/proveedores/${proveedor.id}`,
  ];
  const rutasEscritura = [
    {
      metodo: 'post',
      ruta: '/proveedores',
      datos: { nombre: proveedor.nombre },
    },
    {
      metodo: 'patch',
      ruta: `/proveedores/${proveedor.id}`,
      datos: { nombre: 'Otro proveedor' },
    },
    {
      metodo: 'patch',
      ruta: `/proveedores/${proveedor.id}/estado`,
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
    proveedor: {
      findMany: jest.fn<Promise<Proveedor[]>, [Prisma.ProveedorFindManyArgs]>(),
      findUnique: jest.fn<
        Promise<Proveedor | null>,
        [Prisma.ProveedorFindUniqueArgs]
      >(),
      create: jest.fn<Promise<Proveedor>, [Prisma.ProveedorCreateArgs]>(),
      update: jest.fn<Promise<Proveedor>, [Prisma.ProveedorUpdateArgs]>(),
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
    token = jwtService.sign({ sub: usuario.id, rol: Rol.ADMIN });
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prismaService.usuario.findUnique.mockResolvedValue(usuario);
    prismaService.proveedor.findMany.mockResolvedValue([proveedor]);
    prismaService.proveedor.findUnique.mockResolvedValue(proveedor);
    prismaService.proveedor.create.mockResolvedValue(proveedor);
    prismaService.proveedor.update.mockResolvedValue(proveedor);
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

      await request(app.getHttpServer())
        .get(ruta)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  it.each(rutasEscritura)(
    'permite a ADMIN $metodo $ruta',
    async ({ metodo, ruta, datos }) => {
      await request(app.getHttpServer())
        [metodo](ruta)
        .set('Authorization', `Bearer ${token}`)
        .send(datos)
        .expect(metodo === 'post' ? 201 : 200);
    },
  );

  describe.each([Rol.OPERADOR, Rol.LECTOR])('Escrituras de %s', (rol) => {
    it.each(rutasEscritura)(
      'rechaza $metodo $ruta',
      async ({ metodo, ruta, datos }) => {
        // El JWT conserva ADMIN, pero el guard toma el permiso actual de la base.
        prismaService.usuario.findUnique.mockResolvedValueOnce({
          ...usuario,
          rol,
        });

        await request(app.getHttpServer())
          [metodo](ruta)
          .set('Authorization', `Bearer ${token}`)
          .send(datos)
          .expect(403);

        expect(prismaService.proveedor.findUnique).not.toHaveBeenCalled();
        expect(prismaService.proveedor.create).not.toHaveBeenCalled();
        expect(prismaService.proveedor.update).not.toHaveBeenCalled();
      },
    );
  });

  it.each(rutasConsulta)('rechaza GET %s sin autenticación', async (ruta) => {
    await request(app.getHttpServer()).get(ruta).expect(401);

    expect(prismaService.proveedor.findMany).not.toHaveBeenCalled();
    expect(prismaService.proveedor.findUnique).not.toHaveBeenCalled();
  });

  it.each(rutasEscritura)(
    'rechaza $metodo $ruta sin autenticación',
    async ({ metodo, ruta, datos }) => {
      await request(app.getHttpServer())[metodo](ruta).send(datos).expect(401);

      expect(prismaService.proveedor.create).not.toHaveBeenCalled();
      expect(prismaService.proveedor.update).not.toHaveBeenCalled();
    },
  );

  it('rechaza un token inválido', async () => {
    await request(app.getHttpServer())
      .get('/proveedores')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);

    expect(prismaService.proveedor.findMany).not.toHaveBeenCalled();
  });

  it('rechaza un usuario desactivado', async () => {
    prismaService.usuario.findUnique.mockResolvedValueOnce({
      ...usuario,
      activo: false,
    });

    await request(app.getHttpServer())
      .get('/proveedores')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(prismaService.proveedor.findMany).not.toHaveBeenCalled();
  });
});
