import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import request from 'supertest';
import { App } from 'supertest/types';
import type { Prisma, Proveedor } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProveedoresController } from './proveedores.controller';
import { ProveedoresService } from './proveedores.service';

// Controller, DTO y service reales; Prisma simulado, sin conexión a PostgreSQL.
jest.mock('../prisma/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('../generated/prisma/client', () => ({
  Prisma: jest.requireActual<typeof import('@prisma/client/runtime/client')>(
    '@prisma/client/runtime/client',
  ),
}));

describe('ProveedoresController', () => {
  let app: INestApplication<App>;
  let service: ProveedoresService;
  const proveedor: Proveedor = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    nombre: 'Proveedor de bolsas',
    cuit: '30123456789',
    telefono: '3834123456',
    direccion: 'San Martín 100',
    observaciones: 'Entrega por la mañana',
    activo: true,
  };
  const datosCreacion = {
    nombre: proveedor.nombre,
    cuit: proveedor.cuit,
    telefono: proveedor.telefono,
    direccion: proveedor.direccion,
    observaciones: proveedor.observaciones,
  };
  const prismaService = {
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
    const module = await Test.createTestingModule({
      controllers: [ProveedoresController],
      providers: [
        ProveedoresService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get(ProveedoresService);
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

  beforeEach(() => {
    jest.resetAllMocks();
    prismaService.proveedor.findMany.mockResolvedValue([proveedor]);
    prismaService.proveedor.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(where.id === proveedor.id ? proveedor : null),
    );
    prismaService.proveedor.create.mockResolvedValue(proveedor);
    prismaService.proveedor.update.mockResolvedValue(proveedor);
  });

  afterAll(async () => {
    await app.close();
  });

  it('crea un proveedor con todos los campos permitidos', async () => {
    await request(app.getHttpServer())
      .post('/proveedores')
      .send(datosCreacion)
      .expect(201)
      .expect({ ...proveedor, message: 'Proveedor creado con éxito' });

    expect(prismaService.proveedor.create).toHaveBeenCalledWith({
      data: datosCreacion,
    });
    expect(prismaService.proveedor.findUnique).toHaveBeenCalledWith({
      where: { cuit: proveedor.cuit },
      select: { id: true },
    });
  });

  it.each([undefined, null])('permite crear sin CUIT: %s', async (cuit) => {
    await request(app.getHttpServer())
      .post('/proveedores')
      .send({ nombre: proveedor.nombre, cuit })
      .expect(201);

    expect(prismaService.proveedor.findUnique).not.toHaveBeenCalled();
    expect(prismaService.proveedor.create).toHaveBeenCalledWith({
      data: { nombre: proveedor.nombre, cuit },
    });
  });

  it.each([
    ['post', '/proveedores'],
    ['patch', `/proveedores/${proveedor.id}`],
  ] as const)('recorta los textos en %s', async (metodo, ruta) => {
    await request(app.getHttpServer())
      [metodo](ruta)
      .send({
        nombre: `  ${proveedor.nombre}  `,
        cuit: `  ${proveedor.cuit}  `,
        telefono: `  ${proveedor.telefono}  `,
        direccion: `  ${proveedor.direccion}  `,
        observaciones: `  ${proveedor.observaciones}  `,
      })
      .expect(metodo === 'post' ? 201 : 200);

    const escritura =
      metodo === 'post'
        ? prismaService.proveedor.create
        : prismaService.proveedor.update;
    expect(escritura.mock.calls[0][0].data).toEqual(datosCreacion);
  });

  it.each([true, false])(
    'lista proveedores con activo=%s ordenados por nombre ascendente',
    async (activo) => {
      const proveedores = [{ ...proveedor, activo }];
      prismaService.proveedor.findMany.mockResolvedValueOnce(proveedores);

      await request(app.getHttpServer())
        .get(activo ? '/proveedores' : '/proveedores/inactivos')
        .expect(200)
        .expect(proveedores);

      expect(prismaService.proveedor.findMany).toHaveBeenCalledWith({
        where: { activo },
        orderBy: { nombre: 'asc' },
      });
    },
  );

  it.each([true, false])('consulta por ID con activo=%s', async (activo) => {
    const resultado = { ...proveedor, activo };
    prismaService.proveedor.findUnique.mockResolvedValueOnce(resultado);

    await request(app.getHttpServer())
      .get(`/proveedores/${proveedor.id}`)
      .expect(200)
      .expect(resultado);

    expect(prismaService.proveedor.findUnique).toHaveBeenCalledWith({
      where: { id: proveedor.id },
    });
  });

  it('edita parcialmente sin modificar los campos omitidos', async () => {
    const nombre = 'Otro proveedor';
    prismaService.proveedor.update.mockResolvedValueOnce({
      ...proveedor,
      nombre,
    });

    await request(app.getHttpServer())
      .patch(`/proveedores/${proveedor.id}`)
      .send({ nombre })
      .expect(200)
      .expect({ ...proveedor, nombre, message: 'Proveedor editado con éxito' });

    expect(prismaService.proveedor.update).toHaveBeenCalledWith({
      where: { id: proveedor.id },
      data: { nombre },
    });
  });

  it('permite conservar el CUIT del mismo proveedor', async () => {
    prismaService.proveedor.findUnique.mockResolvedValue(proveedor);

    await request(app.getHttpServer())
      .patch(`/proveedores/${proveedor.id}`)
      .send({ cuit: '30-12345678-9' })
      .expect(200);

    expect(prismaService.proveedor.update).toHaveBeenCalledWith({
      where: { id: proveedor.id },
      data: { cuit: proveedor.cuit },
    });
  });

  it('permite limpiar los campos opcionales con null', async () => {
    const datos = {
      cuit: null,
      telefono: null,
      direccion: null,
      observaciones: null,
    };
    prismaService.proveedor.update.mockResolvedValueOnce({
      ...proveedor,
      ...datos,
    });

    await request(app.getHttpServer())
      .patch(`/proveedores/${proveedor.id}`)
      .send(datos)
      .expect(200)
      .expect({
        ...proveedor,
        ...datos,
        message: 'Proveedor editado con éxito',
      });

    expect(prismaService.proveedor.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaService.proveedor.update).toHaveBeenCalledWith({
      where: { id: proveedor.id },
      data: datos,
    });
  });

  describe.each([
    ['post', '/proveedores'],
    ['patch', `/proveedores/${proveedor.id}`],
  ] as const)('Validaciones de %s', (metodo, ruta) => {
    it.each([
      ['30123456789', '30123456789'],
      ['30-12345678-9', '30123456789'],
      ['30 12345678 9', '30123456789'],
      [' 30 - 12345678 - 9 ', '30123456789'],
      ['00-00000000-0', '00000000000'],
    ])(
      'normaliza CUIT %s antes de consultar duplicados y guardar',
      async (cuit, cuitNormalizado) => {
        await request(app.getHttpServer())
          [metodo](ruta)
          .send({ nombre: proveedor.nombre, cuit })
          .expect(metodo === 'post' ? 201 : 200);

        expect(prismaService.proveedor.findUnique).toHaveBeenLastCalledWith({
          where: { cuit: cuitNormalizado },
          select: { id: true },
        });
        const escritura =
          metodo === 'post'
            ? prismaService.proveedor.create
            : prismaService.proveedor.update;
        expect(escritura.mock.calls[0][0].data).toEqual({
          nombre: proveedor.nombre,
          cuit: cuitNormalizado,
        });
      },
    );

    it.each([
      { nombre: null },
      { nombre: 123 },
      { nombre: '   ' },
      { cuit: 123 },
      { cuit: '   ' },
      { cuit: '' },
      { cuit: '--   --' },
      { cuit: '1234567890' },
      { cuit: '123456789012' },
      { cuit: '30-12345678-X' },
      { cuit: '30.12345678.9' },
      { cuit: 'texto informado' },
      { telefono: 123 },
      { telefono: '' },
      { direccion: 123 },
      { direccion: '   ' },
      { observaciones: 123 },
      { observaciones: '' },
      { activo: false },
      { id: proveedor.id },
      { deuda: 1000 },
    ])('rechaza datos inválidos: %j', async (datos) => {
      await request(app.getHttpServer())
        [metodo](ruta)
        .send({ nombre: proveedor.nombre, ...datos })
        .expect(400);

      expect(prismaService.proveedor.create).not.toHaveBeenCalled();
      expect(prismaService.proveedor.update).not.toHaveBeenCalled();
    });

    it.each([
      ['nombre', 100],
      ['telefono', 30],
      ['direccion', 150],
      ['observaciones', 500],
    ] as const)('valida la longitud de %s', async (campo, limite) => {
      await request(app.getHttpServer())
        [metodo](ruta)
        .send({ nombre: proveedor.nombre, [campo]: 'a'.repeat(limite + 1) })
        .expect(400);

      expect(prismaService.proveedor.create).not.toHaveBeenCalled();
      expect(prismaService.proveedor.update).not.toHaveBeenCalled();
    });

    it('rechaza una solicitud vacía', async () => {
      await request(app.getHttpServer())[metodo](ruta).send({}).expect(400);

      expect(prismaService.proveedor.create).not.toHaveBeenCalled();
      expect(prismaService.proveedor.update).not.toHaveBeenCalled();
    });

    it.each([true, false])(
      'normaliza y rechaza CUIT ocupado por otro proveedor con activo=%s',
      async (activo) => {
        if (metodo === 'patch') {
          prismaService.proveedor.findUnique.mockResolvedValueOnce(proveedor);
        }
        prismaService.proveedor.findUnique.mockResolvedValueOnce({
          ...proveedor,
          id: '123e4567-e89b-42d3-a456-426614174002',
          activo,
        });

        await request(app.getHttpServer())
          [metodo](ruta)
          .send({ ...datosCreacion, cuit: ' 30 - 12345678 - 9 ' })
          .expect(409);

        expect(prismaService.proveedor.findUnique).toHaveBeenLastCalledWith({
          where: { cuit: proveedor.cuit },
          select: { id: true },
        });
        expect(prismaService.proveedor.create).not.toHaveBeenCalled();
        expect(prismaService.proveedor.update).not.toHaveBeenCalled();
      },
    );

    it('convierte P2002 en 409 si aparece un duplicado al escribir', async () => {
      const error = new PrismaClientKnownRequestError('CUIT duplicado', {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: { target: ['cuit'] },
      });
      if (metodo === 'post') {
        prismaService.proveedor.create.mockRejectedValueOnce(error);
      } else {
        prismaService.proveedor.update.mockRejectedValueOnce(error);
      }

      await request(app.getHttpServer())
        [metodo](ruta)
        .send(datosCreacion)
        .expect(409);
    });
  });

  it('impide editar un proveedor inactivo', async () => {
    prismaService.proveedor.findUnique.mockResolvedValueOnce({
      ...proveedor,
      activo: false,
    });

    await request(app.getHttpServer())
      .patch(`/proveedores/${proveedor.id}`)
      .send({ nombre: 'Otro nombre' })
      .expect(400);

    expect(prismaService.proveedor.update).not.toHaveBeenCalled();
  });

  it.each([true, false])('activa o desactiva: activo=%s', async (activo) => {
    prismaService.proveedor.findUnique.mockResolvedValueOnce({
      ...proveedor,
      activo: !activo,
    });
    prismaService.proveedor.update.mockResolvedValueOnce({
      ...proveedor,
      activo,
    });

    await request(app.getHttpServer())
      .patch(`/proveedores/${proveedor.id}/estado`)
      .send({ activo })
      .expect(200)
      .expect({
        ...proveedor,
        activo,
        message: 'Se actualizó estado con éxito',
      });

    expect(prismaService.proveedor.update).toHaveBeenCalledWith({
      where: { id: proveedor.id },
      data: { activo },
    });
  });

  it.each([true, false])('rechaza repetir activo=%s', async (activo) => {
    prismaService.proveedor.findUnique.mockResolvedValueOnce({
      ...proveedor,
      activo,
    });

    await request(app.getHttpServer())
      .patch(`/proveedores/${proveedor.id}/estado`)
      .send({ activo })
      .expect(400);

    expect(prismaService.proveedor.update).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { activo: null },
    { activo: 'false' },
    { activo: 0 },
    { activo: false, nombre: 'Otro nombre' },
  ])('rechaza un cambio de estado inválido: %j', async (datos) => {
    await request(app.getHttpServer())
      .patch(`/proveedores/${proveedor.id}/estado`)
      .send(datos)
      .expect(400);

    expect(prismaService.proveedor.update).not.toHaveBeenCalled();
  });

  describe.each([
    ['get', '', undefined],
    ['patch', '', { nombre: 'Otro nombre' }],
    ['patch', '/estado', { activo: false }],
  ] as const)('%s por ID %s', (metodo, sufijo, datos) => {
    it('devuelve 404 para un proveedor inexistente', async () => {
      prismaService.proveedor.findUnique.mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        [metodo](`/proveedores/${proveedor.id}${sufijo}`)
        .send(datos)
        .expect(404);

      expect(prismaService.proveedor.update).not.toHaveBeenCalled();
    });

    it('rechaza un ID que no es UUID', async () => {
      await request(app.getHttpServer())
        [metodo](`/proveedores/id-invalido${sufijo}`)
        .send(datos)
        .expect(400);

      expect(prismaService.proveedor.findUnique).not.toHaveBeenCalled();
      expect(prismaService.proveedor.update).not.toHaveBeenCalled();
    });
  });

  it.each(['crear', 'editar'] as const)(
    'propaga errores inesperados al %s',
    async (operacion) => {
      const error = new Error('Error inesperado de la base');
      if (operacion === 'crear') {
        prismaService.proveedor.create.mockRejectedValueOnce(error);
        await expect(service.crear(datosCreacion)).rejects.toBe(error);
      } else {
        prismaService.proveedor.update.mockRejectedValueOnce(error);
        await expect(service.editar(proveedor.id, datosCreacion)).rejects.toBe(
          error,
        );
      }
    },
  );

  it('no expone eliminación física', async () => {
    await request(app.getHttpServer())
      .delete(`/proveedores/${proveedor.id}`)
      .expect(404);

    expect(prismaService.proveedor.update).not.toHaveBeenCalled();
  });
});
