import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ids, prismaInventario } from './soporte/inventario-prisma';

jest.mock('../src/prisma/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('../src/generated/prisma/client', () => ({
  Prisma: jest.requireActual<typeof import('@prisma/client/runtime/client')>(
    '@prisma/client/runtime/client',
  ),
}));

const base = () => ({
  claveIdempotencia: randomUUID(),
  fechaEfectiva: '2026-01-10T10:00:00-03:00',
  motivo: 'Prueba HTTP inventario',
});
const compra = () => ({
  ...base(),
  proveedorId: ids.proveedor,
  comprobante: randomUUID(),
  detalles: [
    { presentacionId: ids.presentacion, paquetes: 4, costoTotal: '4000' },
  ],
});
const lote = () => ({
  ...base(),
  codigo: randomUUID(),
  productoId: ids.producto,
  presentacionBolsaId: ids.presentacion,
  responsableId: ids.usuario,
  bolsasUsadas: 10,
  bolsasRotas: 0,
  cantidadApta: 10,
  hieloDescartadoKg: '0',
});

describe('Inventario HTTP: app, JWT, permisos, DTO y servicio reales; Prisma simulado', () => {
  let app: INestApplication<App>;
  let token: string;
  let rol = 'ADMIN';
  let doble: ReturnType<typeof prismaInventario>;
  beforeEach(async () => {
    rol = 'ADMIN';
    doble = prismaInventario();
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        ...doble.prisma,
        usuario: {
          ...doble.prisma.usuario,
          findUnique: jest.fn(() =>
            Promise.resolve({ id: ids.usuario, rol, activo: true }),
          ),
        },
      })
      .compile();
    app = modulo.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    token = app.get(JwtService).sign({ sub: ids.usuario, rol: 'ADMIN' });
  });
  afterEach(async () => {
    await app.close();
  });
  const post = (ruta: string, datos: object) =>
    request(app.getHttpServer())
      .post('/inventario/' + ruta)
      .auth(token, { type: 'bearer' })
      .send(datos);
  const get = (ruta: string) =>
    request(app.getHttpServer())
      .get('/inventario/' + ruta)
      .auth(token, { type: 'bearer' });

  it('CA-27 completo por HTTP con alertas y sobrantes', async () => {
    await post('compras', compra()).expect(201);
    await get('insumos')
      .expect(200)
      .expect(({ body }: { body: { alerta: boolean }[] }) =>
        expect(body[0].alerta).toBe(false),
      );
    await post('traslados', {
      ...base(),
      presentacionId: ids.presentacion,
      paquetes: 1,
    }).expect(201);
    await post('produccion', lote())
      .expect(201)
      .expect(({ body }: { body: { datos: { bolsasSobrantes: string } } }) =>
        expect(body.datos.bolsasSobrantes).toBe('90'),
      );
    await get('stock')
      .expect(200)
      .expect(({ body }: { body: { cantidad: number }[] }) =>
        expect(body[0].cantidad).toBe(10),
      );
    await get('insumos')
      .expect(200)
      .expect(
        ({
          body,
        }: {
          body: { deposito: string; produccion: string; alerta: boolean }[];
        }) =>
          expect(body[0]).toMatchObject({
            deposito: '300',
            produccion: '90',
            alerta: true,
          }),
      );
  });
  it('una clave repetida no confirma dos compras', async () => {
    const dto = compra();
    const primera = await post('compras', dto).expect(201);
    const segunda = await post('compras', dto).expect(201);
    expect(segunda.body).toEqual(primera.body);
    expect(doble.estado().compras).toHaveLength(1);
    await post('compras', { ...dto, motivo: 'Otro motivo' }).expect(409);
  });
  it('stock insuficiente devuelve 409 sin lote ni cambios parciales', async () => {
    await post('produccion', lote()).expect(409);
    expect(doble.estado().lotes).toHaveLength(0);
    expect(doble.estado().operaciones).toHaveLength(0);
  });
  it('exige autenticación', async () => {
    await request(app.getHttpServer()).get('/inventario/stock').expect(401);
  });
  it.each(['insumos', 'stock', 'compras', 'produccion', 'movimientos'])(
    'lector puede consultar %s',
    async (ruta) => {
      rol = 'LECTOR';
      await get(ruta).expect(200);
    },
  );
  it.each([
    'compras',
    'traslados',
    'produccion',
    'insumos/movimientos',
    'stock/movimientos',
    'insumos',
  ])('lector no puede escribir %s', async (ruta) => {
    rol = 'LECTOR';
    await post(ruta, {}).expect(403);
  });
  it.each(['compras', 'traslados', 'produccion', 'insumos/movimientos'])(
    'operador no puede escribir %s',
    async (ruta) => {
      rol = 'OPERADOR';
      await post(ruta, {}).expect(403);
    },
  );
  it.each(['AJUSTE', 'CONTEO', 'PERDIDA', 'DEVOLUCION'])(
    'operador no puede registrar %s',
    async (accion) => {
      rol = 'OPERADOR';
      await post('stock/movimientos', {
        ...base(),
        productoId: ids.producto,
        accion,
        cantidad: 1,
      }).expect(403);
    },
  );
  it('operador puede registrar obsequio con responsable y motivo', async () => {
    await post('compras', compra()).expect(201);
    await post('traslados', {
      ...base(),
      presentacionId: ids.presentacion,
      paquetes: 1,
    }).expect(201);
    await post('produccion', lote()).expect(201);
    rol = 'OPERADOR';
    await post('stock/movimientos', {
      ...base(),
      productoId: ids.producto,
      accion: 'OBSEQUIO',
      cantidad: 2,
      responsableId: ids.usuario,
    }).expect(201);
    expect(doble.estado().stocks[0].cantidad).toBe(8);
  });
  it.each([
    ['fecha sin zona', { fechaEfectiva: '2026-01-10T10:00:00' }],
    ['fecha inválida', { fechaEfectiva: '2026-02-31T10:00:00Z' }],
    ['clave inválida', { claveIdempotencia: 'repetir' }],
    ['motivo vacío', { motivo: ' ' }],
    ['propiedad inesperada', { saldo: -1 }],
    ['detalle vacío', { detalles: [] }],
    ['detalle nulo', { detalles: [null] }],
    ['detalle que no es un objeto', { detalles: [1] }],
    ['pago nulo', { pago: null }],
    ['proveedor nulo', { proveedorId: null }],
    [
      'cantidad fraccionaria',
      {
        detalles: [
          { presentacionId: ids.presentacion, paquetes: 1.5, costoTotal: '1' },
        ],
      },
    ],
    [
      'importe con demasiados decimales',
      {
        detalles: [
          {
            presentacionId: ids.presentacion,
            paquetes: 1,
            costoTotal: '1.001',
          },
        ],
      },
    ],
    [
      'presentación repetida',
      {
        detalles: [
          { presentacionId: ids.presentacion, paquetes: 1, costoTotal: '1' },
          { presentacionId: ids.presentacion, paquetes: 1, costoTotal: '1' },
        ],
      },
    ],
  ])('rechaza compra: %s', async (_caso, cambio) => {
    await post('compras', { ...compra(), ...cambio }).expect(400);
    expect(doble.estado().compras).toHaveLength(0);
  });
  it.each([
    {},
    { nombre: 'Bolsas', tipo: 'BOLSA', unidad: 'unidad' },
    { nombre: 'Bolsas', tipo: 'BOLSA', unidad: 'unidad', presentacion: null },
  ])('rechaza insumo incompleto %j', async (dto) => {
    await post('insumos', dto).expect(400);
  });
  it('rechaza cursor inválido', async () => {
    await get('movimientos?cursor=otro').expect(400);
  });
  it('conteo de terminado registra la diferencia', async () => {
    await post('stock/movimientos', {
      ...base(),
      productoId: ids.producto,
      accion: 'CONTEO',
      cantidad: 7,
    }).expect(201);
    await post('stock/movimientos', {
      ...base(),
      productoId: ids.producto,
      accion: 'CONTEO',
      cantidad: 5,
    }).expect(201);
    expect(doble.estado().terminados.at(-1)).toMatchObject({
      saldoAnterior: 7,
      saldoPosterior: 5,
      cantidad: -2,
    });
  });
});
