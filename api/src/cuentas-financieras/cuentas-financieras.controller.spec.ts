import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  Decimal,
  PrismaClientKnownRequestError,
} from '@prisma/client/runtime/client';
import request from 'supertest';
import { App } from 'supertest/types';
import type { Prisma } from '../generated/prisma/client';
import { TipoCuentaFinanciera } from '../generated/prisma/enums';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { CuentasFinancierasModule } from './cuentas-financieras.module';

// No se conecta a la base. Decimal y los errores de Prisma conservan su implementación real.
jest.mock('../prisma/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('../generated/prisma/client', () => ({
  Prisma: jest.requireActual<typeof import('@prisma/client/runtime/client')>(
    '@prisma/client/runtime/client',
  ),
}));

describe('CuentasFinancierasController', () => {
  let app: INestApplication<App>;
  const cuenta = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    nombre: 'Caja principal',
    tipo: TipoCuentaFinanciera.EFECTIVO,
    titularInterno: 'JM Hielos',
    moneda: 'ARS',
    saldoInicial: new Decimal('1234.56'),
    fechaApertura: new Date('2026-10-29'),
    activo: true,
  };
  const cuentaJson = {
    ...cuenta,
    saldoInicial: '1234.56',
    fechaApertura: '2026-10-29T00:00:00.000Z',
  };
  const datosCreacion = {
    nombre: cuenta.nombre,
    tipo: cuenta.tipo,
    titularInterno: cuenta.titularInterno,
    saldoInicial: '1234.56',
    fechaApertura: '2026-10-29',
  };
  const prismaService = {
    cuentaFinanciera: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn<
        Promise<typeof cuenta>,
        [Prisma.CuentaFinancieraCreateArgs]
      >(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prismaService.cuentaFinanciera.findMany.mockResolvedValue([cuenta]);
    prismaService.cuentaFinanciera.findUnique.mockResolvedValue(cuenta);
    prismaService.cuentaFinanciera.create.mockResolvedValue(cuenta);
    prismaService.cuentaFinanciera.update.mockResolvedValue(cuenta);

    const module = await Test.createTestingModule({
      imports: [PrismaModule, CuentasFinancierasModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .compile();

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

  it('crea una cuenta, recorta textos y conserva la apertura sin crear movimientos', async () => {
    prismaService.cuentaFinanciera.findUnique.mockResolvedValueOnce(null);

    await request(app.getHttpServer())
      .post('/cuentas-financieras')
      .send({
        ...datosCreacion,
        nombre: '  Caja principal  ',
        titularInterno: '  JM Hielos  ',
      })
      .expect(201)
      .expect({ ...cuentaJson, message: 'Cuenta financiera creada con éxito' });

    // Solo se escribe la cuenta: no hay movimientos ni moneda o estado recibidos del cliente.
    expect(prismaService.cuentaFinanciera.create).toHaveBeenCalledWith({
      data: {
        nombre: cuenta.nombre,
        tipo: cuenta.tipo,
        titularInterno: cuenta.titularInterno,
        saldoInicial: new Decimal('1234.56'),
        fechaApertura: cuenta.fechaApertura,
      },
    });
  });

  it.each(Object.values(TipoCuentaFinanciera))(
    'acepta el tipo %s generado por Prisma',
    async (tipo) => {
      prismaService.cuentaFinanciera.findUnique.mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .post('/cuentas-financieras')
        .send({ ...datosCreacion, tipo })
        .expect(201);

      expect(
        prismaService.cuentaFinanciera.create.mock.calls[0][0].data.tipo,
      ).toBe(tipo);
    },
  );

  it.each(['0', '0.01', '1234.5', '9999999999999999.99'])(
    'conserva la precisión del saldo inicial %s',
    async (saldoInicial) => {
      prismaService.cuentaFinanciera.findUnique.mockResolvedValueOnce(null);
      prismaService.cuentaFinanciera.create.mockResolvedValueOnce({
        ...cuenta,
        saldoInicial: new Decimal(saldoInicial),
      });

      await request(app.getHttpServer())
        .post('/cuentas-financieras')
        .send({ ...datosCreacion, saldoInicial })
        .expect(201)
        .expect({
          ...cuentaJson,
          saldoInicial,
          message: 'Cuenta financiera creada con éxito',
        });

      const saldoGuardado =
        prismaService.cuentaFinanciera.create.mock.calls[0][0].data
          .saldoInicial;
      expect(saldoGuardado).toBeInstanceOf(Decimal);
      expect(saldoGuardado).toEqual(new Decimal(saldoInicial));
    },
  );

  it.each([
    '2024-02-29',
    '2026-10-29T15:30:00Z',
    '2026-10-29T12:30:00-03:00',
    '2026-10-29T15:30:00.123Z',
  ])('acepta y convierte la fecha de apertura %s', async (fechaApertura) => {
    prismaService.cuentaFinanciera.findUnique.mockResolvedValueOnce(null);

    await request(app.getHttpServer())
      .post('/cuentas-financieras')
      .send({ ...datosCreacion, fechaApertura })
      .expect(201);

    expect(
      prismaService.cuentaFinanciera.create.mock.calls[0][0].data.fechaApertura,
    ).toEqual(new Date(fechaApertura));
  });

  it.each([
    { nombre: undefined },
    { nombre: '' },
    { nombre: '   ' },
    { nombre: null },
    { nombre: 123 },
    { nombre: 'a'.repeat(101) },
    { titularInterno: undefined },
    { titularInterno: '   ' },
    { titularInterno: null },
    { titularInterno: false },
    { titularInterno: 'a'.repeat(101) },
    { tipo: undefined },
    { tipo: null },
    { tipo: 'OTRO' },
    { saldoInicial: undefined },
    { saldoInicial: null },
    { saldoInicial: 100 },
    { saldoInicial: '-0.01' },
    { saldoInicial: '1.234' },
    { saldoInicial: '10000000000000000' },
    { saldoInicial: '1e3' },
    { saldoInicial: '1,50' },
    { saldoInicial: '' },
    { saldoInicial: 'NaN' },
    { saldoInicial: 'Infinity' },
    { fechaApertura: undefined },
    { fechaApertura: null },
    { fechaApertura: 1793232000000 },
    { fechaApertura: 'fecha inválida' },
    { fechaApertura: '2026-02-29' },
    { fechaApertura: '2024-02-30' },
    { fechaApertura: '2026-04-31' },
    { fechaApertura: '2026-13-01' },
    { fechaApertura: '2026-W44-4' },
    { fechaApertura: '2026-302' },
    { fechaApertura: '2026-10-29T12:30:00' },
    { fechaApertura: '2026-10-29T12Z' },
    { fechaApertura: '2026-10-29T123000Z' },
    { fechaApertura: '2026-10-29T12:30:00,5Z' },
    { moneda: 'ARS' },
    { moneda: 'USD' },
    { activo: false },
    { saldoActual: '2000.00' },
    { movimientos: [] },
  ])('rechaza una creación inválida: %j', async (datos) => {
    await request(app.getHttpServer())
      .post('/cuentas-financieras')
      .send({ ...datosCreacion, ...datos })
      .expect(400);

    expect(prismaService.cuentaFinanciera.findUnique).not.toHaveBeenCalled();
    expect(prismaService.cuentaFinanciera.create).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'rechaza crear un nombre duplicado aunque la cuenta existente tenga activo=%s',
    async (activo) => {
      prismaService.cuentaFinanciera.findUnique.mockResolvedValueOnce({
        ...cuenta,
        activo,
      });

      await request(app.getHttpServer())
        .post('/cuentas-financieras')
        .send(datosCreacion)
        .expect(409);

      expect(prismaService.cuentaFinanciera.findUnique).toHaveBeenCalledWith({
        where: { nombre: cuenta.nombre },
        select: { id: true },
      });
      expect(prismaService.cuentaFinanciera.create).not.toHaveBeenCalled();
    },
  );

  it.each(['crear', 'editar'])(
    'convierte el error P2002 de Prisma en 409 al %s',
    async (operacion) => {
      const error = new PrismaClientKnownRequestError('Nombre duplicado', {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: { target: ['nombre'] },
      });

      if (operacion === 'crear') {
        prismaService.cuentaFinanciera.findUnique.mockResolvedValueOnce(null);
        prismaService.cuentaFinanciera.create.mockRejectedValueOnce(error);

        await request(app.getHttpServer())
          .post('/cuentas-financieras')
          .send(datosCreacion)
          .expect(409);
      } else {
        prismaService.cuentaFinanciera.findUnique
          .mockResolvedValueOnce(cuenta)
          .mockResolvedValueOnce(null);
        prismaService.cuentaFinanciera.update.mockRejectedValueOnce(error);

        await request(app.getHttpServer())
          .patch(`/cuentas-financieras/${cuenta.id}`)
          .send({ nombre: 'Otra caja' })
          .expect(409);
      }
    },
  );

  it('lista las cuentas activas ordenadas por nombre', async () => {
    await request(app.getHttpServer())
      .get('/cuentas-financieras')
      .expect(200)
      .expect([cuentaJson]);

    expect(prismaService.cuentaFinanciera.findMany).toHaveBeenCalledWith({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });
  });

  it('lista las cuentas inactivas en su endpoint separado', async () => {
    prismaService.cuentaFinanciera.findMany.mockResolvedValueOnce([
      { ...cuenta, activo: false },
    ]);

    await request(app.getHttpServer())
      .get('/cuentas-financieras/inactivas')
      .expect(200)
      .expect([{ ...cuentaJson, activo: false }]);

    expect(prismaService.cuentaFinanciera.findMany).toHaveBeenCalledWith({
      where: { activo: false },
      orderBy: { nombre: 'asc' },
    });
  });

  it.each([true, false])(
    'consulta por ID una cuenta con activo=%s',
    async (activo) => {
      prismaService.cuentaFinanciera.findUnique.mockResolvedValueOnce({
        ...cuenta,
        activo,
      });

      await request(app.getHttpServer())
        .get(`/cuentas-financieras/${cuenta.id}`)
        .expect(200)
        .expect({ ...cuentaJson, activo });

      expect(prismaService.cuentaFinanciera.findUnique).toHaveBeenCalledWith({
        where: { id: cuenta.id },
      });
    },
  );

  it('permite conservar el nombre y editar el titular interno recortando espacios', async () => {
    prismaService.cuentaFinanciera.findUnique
      .mockResolvedValueOnce(cuenta)
      .mockResolvedValueOnce({ id: cuenta.id });
    prismaService.cuentaFinanciera.update.mockResolvedValueOnce({
      ...cuenta,
      titularInterno: 'Socio',
    });

    await request(app.getHttpServer())
      .patch(`/cuentas-financieras/${cuenta.id}`)
      .send({ nombre: '  Caja principal  ', titularInterno: '  Socio  ' })
      .expect(200)
      .expect({
        ...cuentaJson,
        titularInterno: 'Socio',
        message: 'Cuenta financiera editada con éxito',
      });

    expect(prismaService.cuentaFinanciera.update).toHaveBeenCalledWith({
      where: { id: cuenta.id },
      data: { nombre: cuenta.nombre, titularInterno: 'Socio' },
    });
  });

  it('permite renombrar una cuenta con un nombre disponible', async () => {
    prismaService.cuentaFinanciera.findUnique
      .mockResolvedValueOnce(cuenta)
      .mockResolvedValueOnce(null);
    prismaService.cuentaFinanciera.update.mockResolvedValueOnce({
      ...cuenta,
      nombre: 'Caja secundaria',
    });

    await request(app.getHttpServer())
      .patch(`/cuentas-financieras/${cuenta.id}`)
      .send({ nombre: 'Caja secundaria' })
      .expect(200)
      .expect({
        ...cuentaJson,
        nombre: 'Caja secundaria',
        message: 'Cuenta financiera editada con éxito',
      });
  });

  it('edita solo el titular interno sin comprobar duplicados de nombre', async () => {
    await request(app.getHttpServer())
      .patch(`/cuentas-financieras/${cuenta.id}`)
      .send({ titularInterno: 'Socio' })
      .expect(200);

    expect(prismaService.cuentaFinanciera.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaService.cuentaFinanciera.update).toHaveBeenCalledWith({
      where: { id: cuenta.id },
      data: { nombre: undefined, titularInterno: 'Socio' },
    });
  });

  it('rechaza editar con el nombre de otra cuenta', async () => {
    prismaService.cuentaFinanciera.findUnique
      .mockResolvedValueOnce(cuenta)
      .mockResolvedValueOnce({ id: '7ce9df79-673a-47ad-b49e-f23a116b1e00' });

    await request(app.getHttpServer())
      .patch(`/cuentas-financieras/${cuenta.id}`)
      .send({ nombre: 'Otra caja' })
      .expect(409);

    expect(prismaService.cuentaFinanciera.update).not.toHaveBeenCalled();
  });

  it('rechaza editar una cuenta inactiva', async () => {
    prismaService.cuentaFinanciera.findUnique.mockResolvedValueOnce({
      ...cuenta,
      activo: false,
    });

    await request(app.getHttpServer())
      .patch(`/cuentas-financieras/${cuenta.id}`)
      .send({ nombre: 'Otra caja' })
      .expect(400);

    expect(prismaService.cuentaFinanciera.update).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { nombre: '' },
    { nombre: '   ' },
    { nombre: null },
    { nombre: 123 },
    { nombre: 'a'.repeat(101) },
    { titularInterno: '' },
    { titularInterno: '   ' },
    { titularInterno: null },
    { titularInterno: false },
    { titularInterno: 'a'.repeat(101) },
    { nombre: 'Otra caja', saldoInicial: '100.00' },
    { nombre: 'Otra caja', fechaApertura: '2026-10-28' },
    { nombre: 'Otra caja', tipo: 'BANCO' },
    { nombre: 'Otra caja', moneda: 'USD' },
    { nombre: 'Otra caja', activo: false },
    { nombre: 'Otra caja', saldoActual: '2000.00' },
    { nombre: 'Otra caja', movimientos: [] },
  ])('rechaza una edición inválida: %j', async (datos) => {
    await request(app.getHttpServer())
      .patch(`/cuentas-financieras/${cuenta.id}`)
      .send(datos)
      .expect(400);

    expect(prismaService.cuentaFinanciera.findUnique).not.toHaveBeenCalled();
    expect(prismaService.cuentaFinanciera.update).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'cambia activo a %s actualizando únicamente ese campo y conservando la apertura',
    async (activo) => {
      prismaService.cuentaFinanciera.findUnique.mockResolvedValueOnce({
        ...cuenta,
        activo: !activo,
      });
      prismaService.cuentaFinanciera.update.mockResolvedValueOnce({
        ...cuenta,
        activo,
      });

      await request(app.getHttpServer())
        .patch(`/cuentas-financieras/${cuenta.id}/estado`)
        .send({ activo })
        .expect(200)
        .expect({
          ...cuentaJson,
          activo,
          message: 'Se actualizó estado con éxito',
        });

      // No se borran la cuenta ni sus movimientos relacionados.
      expect(prismaService.cuentaFinanciera.update).toHaveBeenCalledWith({
        where: { id: cuenta.id },
        data: { activo },
      });
    },
  );

  it.each([true, false])('rechaza repetir activo=%s', async (activo) => {
    prismaService.cuentaFinanciera.findUnique.mockResolvedValueOnce({
      ...cuenta,
      activo,
    });

    await request(app.getHttpServer())
      .patch(`/cuentas-financieras/${cuenta.id}/estado`)
      .send({ activo })
      .expect(400);

    expect(prismaService.cuentaFinanciera.update).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { activo: null },
    { activo: 'false' },
    { activo: 1 },
    { activo: false, nombre: 'Otra' },
  ])('rechaza un estado inválido: %j', async (datos) => {
    await request(app.getHttpServer())
      .patch(`/cuentas-financieras/${cuenta.id}/estado`)
      .send(datos)
      .expect(400);

    expect(prismaService.cuentaFinanciera.update).not.toHaveBeenCalled();
  });

  it('devuelve 404 al consultar, editar o cambiar el estado de una cuenta inexistente', async () => {
    prismaService.cuentaFinanciera.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get(`/cuentas-financieras/${cuenta.id}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/cuentas-financieras/${cuenta.id}`)
      .send({ nombre: 'Otra caja' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/cuentas-financieras/${cuenta.id}/estado`)
      .send({ activo: false })
      .expect(404);

    expect(prismaService.cuentaFinanciera.update).not.toHaveBeenCalled();
  });

  it.each([
    ['GET', '/cuentas-financieras/id-invalido', undefined],
    ['PATCH', '/cuentas-financieras/id-invalido', { nombre: 'Otra caja' }],
    ['PATCH', '/cuentas-financieras/id-invalido/estado', { activo: false }],
  ])('rechaza un ID inválido en %s %s', async (metodo, ruta, datos) => {
    const peticion =
      metodo === 'GET'
        ? request(app.getHttpServer()).get(ruta)
        : request(app.getHttpServer()).patch(ruta).send(datos);

    await peticion.expect(400);
    expect(prismaService.cuentaFinanciera.findUnique).not.toHaveBeenCalled();
    expect(prismaService.cuentaFinanciera.update).not.toHaveBeenCalled();
  });

  it('no expone un endpoint DELETE', async () => {
    await request(app.getHttpServer())
      .delete(`/cuentas-financieras/${cuenta.id}`)
      .expect(404);
  });
});
