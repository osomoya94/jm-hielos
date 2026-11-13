import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { hash } from 'bcrypt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Prisma } from '../../src/generated/prisma/client';

const operacion = (respuesta: { body: unknown }) =>
  respuesta.body as {
    operacionId: string;
    datos: { id: string; bolsasSobrantes: string; diferencia: string };
  };
const flujo = (respuesta: { body: unknown }) =>
  respuesta.body as { totalEgresos: string };

// Esta suite utiliza PostgreSQL real. Ningún provider ni transacción está simulado.
describe('Inventario contra PostgreSQL QA aislado', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: { id: string; token: string };
  let operador: { id: string; token: string };
  let lector: { id: string; token: string };
  const base = () => ({
    claveIdempotencia: randomUUID(),
    fechaEfectiva: '2026-01-10T10:00:00-03:00',
    motivo: 'Aceptación QA de inventario',
  });

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      url.hostname !== '127.0.0.1' ||
      url.port !== '5433' ||
      url.pathname !== '/jm_hielos_qa_ers14' ||
      process.env.JM_QA_DATABASE_NAME !== 'jm_hielos_qa_ers14'
    ) {
      throw new Error(
        'Se rechaza ejecutar pruebas operativas fuera de la base QA',
      );
    }
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    const destino = await prisma.$queryRaw<
      { nombre: string }[]
    >`SELECT current_database() AS nombre`;
    if (destino[0].nombre !== 'jm_hielos_qa_ers14')
      throw new Error('Destino PostgreSQL no autorizado');
    const passwordHash = await hash(randomUUID(), 4);
    const crearUsuario = async (rol: 'ADMIN' | 'OPERADOR' | 'LECTOR') => {
      const usuario = await prisma.usuario.create({
        data: { username: 'qa-' + randomUUID(), passwordHash, rol },
      });
      return {
        id: usuario.id,
        token: app.get(JwtService).sign({ sub: usuario.id, rol }),
      };
    };
    admin = await crearUsuario('ADMIN');
    operador = await crearUsuario('OPERADOR');
    lector = await crearUsuario('LECTOR');
  });
  afterAll(async () => {
    if (app) await app.close();
  });

  const post = (ruta: string, datos: object, token?: string) =>
    request(app.getHttpServer())
      .post('/inventario/' + ruta)
      .auth(token ?? admin.token, { type: 'bearer' })
      .send(datos);
  async function escenario(factor = '100') {
    const producto = await prisma.producto.create({
      data: { nombre: 'QA hielo ' + randomUUID(), pesoKg: 3, unidad: 'bolsa' },
    });
    const proveedor = await prisma.proveedor.create({
      data: { nombre: 'QA proveedor ' + randomUUID() },
    });
    const cuenta = await prisma.cuentaFinanciera.create({
      data: {
        nombre: 'QA caja ' + randomUUID(),
        tipo: 'EFECTIVO',
        titularInterno: 'QA',
        saldoInicial: '1000000',
        fechaApertura: new Date('2026-01-01T03:00:00Z'),
      },
    });
    const categoria = await prisma.categoriaFlujo.create({
      data: {
        nombre: 'QA compra ' + randomUUID(),
        grupo: 'OPERACION',
        sentido: 'EGRESO',
      },
    });
    const respuesta = await post('insumos', {
      nombre: 'QA bolsas ' + randomUUID(),
      tipo: 'BOLSA',
      unidad: 'unidad',
      productoId: producto.id,
      presentacion: { nombre: 'Paquete', factor },
    }).expect(201);
    const insumo = respuesta.body as {
      id: string;
      stockMinimo: string;
      presentaciones: { id: string }[];
    };
    const presentacionId = insumo.presentaciones[0].id;
    const compra = (paquetes = 4, costoTotal = '4000') => ({
      ...base(),
      proveedorId: proveedor.id,
      comprobante: randomUUID(),
      detalles: [{ presentacionId, paquetes, costoTotal }],
    });
    const pago = (importe: string) => ({
      cuentaId: cuenta.id,
      categoriaId: categoria.id,
      importe,
    });
    const traslado = (paquetes = 1) => ({
      ...base(),
      presentacionId,
      paquetes,
    });
    const lote = () => ({
      ...base(),
      codigo: randomUUID(),
      productoId: producto.id,
      presentacionBolsaId: presentacionId,
      responsableId: admin.id,
      ayudantesIds: [operador.id],
      bolsasUsadas: 10,
      bolsasRotas: 0,
      cantidadApta: 10,
      cantidadEsperada: 100,
      hieloDescartadoKg: '0',
    });
    const existencia = (ubicacion: 'DEPOSITO' | 'PRODUCCION') =>
      prisma.existenciaInsumo.findUniqueOrThrow({
        where: { presentacionId_ubicacion: { presentacionId, ubicacion } },
      });
    return {
      producto,
      proveedor,
      cuenta,
      categoria,
      insumo,
      presentacionId,
      compra,
      pago,
      traslado,
      lote,
      existencia,
    };
  }

  it('CA-27: recibe 400, traslada 100, produce 10 y conserva 90 abiertas sin pérdida ficticia', async () => {
    const e = await escenario();
    await post('compras', e.compra()).expect(201);
    expect((await e.existencia('DEPOSITO')).unidades.toString()).toBe('400');
    await post('traslados', e.traslado()).expect(201);
    const resultado = await post('produccion', e.lote()).expect(201);
    expect(operacion(resultado).datos.bolsasSobrantes).toBe('90');
    expect((await e.existencia('DEPOSITO')).unidades.toString()).toBe('300');
    expect((await e.existencia('PRODUCCION')).valor.toString()).toBe('900');
    expect(
      (
        await prisma.stockTerminado.findUniqueOrThrow({
          where: { productoId: e.producto.id },
        })
      ).cantidad,
    ).toBe(10);
    const consulta = await request(app.getHttpServer())
      .get('/inventario/insumos')
      .auth(lector.token, { type: 'bearer' })
      .expect(200);
    const insumos = consulta.body as { id: string; alerta: boolean }[];
    expect(insumos.find((i) => i.id === e.insumo.id)?.alerta).toBe(true);
  });

  it('CA-30/42: pagos parciales, reintentos y períodos no duplican stock, costo ni Cash Flow', async () => {
    const e = await escenario();
    const compra = { ...e.compra(4, '100000'), pago: e.pago('40000') };
    const primera = await post('compras', compra).expect(201);
    expect((await post('compras', compra).expect(201)).body).toEqual(
      primera.body,
    );
    const compraId = operacion(primera).datos.id;
    const pago = {
      ...base(),
      fechaEfectiva: '2026-02-10T10:00:00-03:00',
      pago: e.pago('20000'),
    };
    const segundo = await post('compras/' + compraId + '/pagos', pago).expect(
      201,
    );
    expect(
      (await post('compras/' + compraId + '/pagos', pago).expect(201)).body,
    ).toEqual(segundo.body);
    expect((await e.existencia('DEPOSITO')).unidades.toString()).toBe('400');
    expect((await e.existencia('DEPOSITO')).valor.toString()).toBe('100000');
    expect(
      await prisma.movimientoInsumo.count({
        where: { presentacionId: e.presentacionId },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.compraInsumo.findUniqueOrThrow({ where: { id: compraId } })
      ).pagado.toString(),
    ).toBe('60000');
    expect(await prisma.pagoCompraInsumo.count({ where: { compraId } })).toBe(
      2,
    );
    for (const [desde, hasta, egreso] of [
      ['2026-01-01', '2026-01-31', '40000.00'],
      ['2026-02-01', '2026-02-28', '20000.00'],
    ]) {
      const consultar = () =>
        request(app.getHttpServer())
          .get('/cash-flow')
          .query({ desde, hasta, cuentaId: e.cuenta.id })
          .auth(operador.token, { type: 'bearer' });
      expect(flujo(await consultar().expect(200)).totalEgresos).toBe(egreso);
      expect(flujo(await consultar().expect(200)).totalEgresos).toBe(egreso);
    }
    expect(
      await prisma.movimientoFinanciero.count({
        where: { cuentaId: e.cuenta.id },
      }),
    ).toBe(2);
    await post('compras/' + compraId + '/pagos', {
      ...pago,
      pago: e.pago('21000'),
    }).expect(409);
    await post('compras/' + compraId + '/pagos', {
      ...base(),
      pago: e.pago('40001'),
    }).expect(400);
  });

  it('una compra impaga recibe todo el stock sin generar movimientos financieros', async () => {
    const e = await escenario();
    await post('compras', e.compra()).expect(201);
    expect((await e.existencia('DEPOSITO')).unidades.toString()).toBe('400');
    expect(
      await prisma.movimientoFinanciero.count({
        where: { cuentaId: e.cuenta.id },
      }),
    ).toBe(0);
  });

  it('un pago inicial inválido revierte compra, recepción y operación en PostgreSQL', async () => {
    const e = await escenario();
    const dto = { ...e.compra(), pago: e.pago('4001') };
    await post('compras', dto).expect(400);
    expect(
      await prisma.existenciaInsumo.count({
        where: { presentacionId: e.presentacionId },
      }),
    ).toBe(0);
    expect(
      await prisma.compraInsumo.count({
        where: { proveedorId: e.proveedor.id },
      }),
    ).toBe(0);
    expect(
      await prisma.operacionInventario.count({
        where: { claveIdempotencia: dto.claveIdempotencia },
      }),
    ).toBe(0);
  });

  it('insuficiencia al registrar roturas revierte también las bolsas ya consumidas', async () => {
    const e = await escenario();
    await post('compras', e.compra()).expect(201);
    await post('traslados', e.traslado()).expect(201);
    const lote = { ...e.lote(), bolsasRotas: 95 };
    await post('produccion', lote).expect(409);
    expect((await e.existencia('PRODUCCION')).unidades.toString()).toBe('100');
    expect(
      await prisma.loteProduccion.count({
        where: { productoId: e.producto.id },
      }),
    ).toBe(0);
    expect(
      await prisma.stockTerminado.count({
        where: { productoId: e.producto.id },
      }),
    ).toBe(0);
  });

  it('dos traslados concurrentes compiten por el último paquete sin stock negativo', async () => {
    const e = await escenario();
    await post('compras', e.compra(1, '1000')).expect(201);
    const resultados = await Promise.all([
      post('traslados', e.traslado()),
      post('traslados', e.traslado()),
    ]);
    expect(resultados.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await e.existencia('DEPOSITO')).unidades.toString()).toBe('0');
    expect((await e.existencia('PRODUCCION')).unidades.toString()).toBe('100');
  });

  it('dos solicitudes concurrentes con la misma clave devuelven una sola operación', async () => {
    const e = await escenario();
    await post('compras', e.compra(1, '1000')).expect(201);
    const dto = e.traslado();
    const resultados = await Promise.all([
      post('traslados', dto),
      post('traslados', dto),
    ]);
    expect(resultados.map((r) => r.status)).toEqual([201, 201]);
    expect(resultados[0].body).toEqual(resultados[1].body);
    expect(
      await prisma.operacionInventario.count({
        where: { claveIdempotencia: dto.claveIdempotencia },
      }),
    ).toBe(1);
    expect((await e.existencia('PRODUCCION')).unidades.toString()).toBe('100');
  });

  it('el índice único de comprobante evita dos compras concurrentes y revierte la perdedora', async () => {
    const e = await escenario();
    const dto = e.compra(1, '1000');
    const resultados = await Promise.all([
      post('compras', dto),
      post('compras', { ...dto, claveIdempotencia: randomUUID() }),
    ]);
    expect(resultados.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await e.existencia('DEPOSITO')).unidades.toString()).toBe('100');
    expect(
      await prisma.compraInsumo.count({
        where: { proveedorId: e.proveedor.id },
      }),
    ).toBe(1);
  });

  it('dos pagos concurrentes no pueden superar el saldo real de la compra', async () => {
    const e = await escenario();
    const compra = await post('compras', e.compra(1, '100000')).expect(201);
    const compraId = operacion(compra).datos.id;
    const resultados = await Promise.all([
      post('compras/' + compraId + '/pagos', {
        ...base(),
        pago: e.pago('70000'),
      }),
      post('compras/' + compraId + '/pagos', {
        ...base(),
        pago: e.pago('70000'),
      }),
    ]);
    expect(resultados.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(
      (
        await prisma.compraInsumo.findUniqueOrThrow({ where: { id: compraId } })
      ).pagado.toString(),
    ).toBe('70000');
    expect(
      await prisma.movimientoFinanciero.count({
        where: { cuentaId: e.cuenta.id },
      }),
    ).toBe(1);
  });

  it('dos lotes concurrentes no consumen dos veces las últimas bolsas', async () => {
    const e = await escenario('10');
    await post('compras', e.compra(1, '100')).expect(201);
    await post('traslados', e.traslado()).expect(201);
    const resultados = await Promise.all([
      post('produccion', e.lote()),
      post('produccion', e.lote()),
    ]);
    expect(resultados.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await e.existencia('PRODUCCION')).unidades.toString()).toBe('0');
    expect(
      (
        await prisma.stockTerminado.findUniqueOrThrow({
          where: { productoId: e.producto.id },
        })
      ).cantidad,
    ).toBe(10);
  });

  it('cuenta insumos, conserva el costo promedio y exige paquetes completos en depósito', async () => {
    const e = await escenario();
    await post('compras', e.compra()).expect(201);
    await post('traslados', e.traslado()).expect(201);
    await post('insumos/movimientos', {
      ...base(),
      presentacionId: e.presentacionId,
      ubicacion: 'DEPOSITO',
      accion: 'CONTEO',
      cantidad: '299',
    }).expect(400);
    const dto = {
      ...base(),
      presentacionId: e.presentacionId,
      ubicacion: 'PRODUCCION',
      accion: 'CONTEO',
      cantidad: '85',
    };
    const conteo = await post('insumos/movimientos', dto).expect(201);
    expect(operacion(conteo).datos.diferencia).toBe('-15');
    expect((await post('insumos/movimientos', dto).expect(201)).body).toEqual(
      conteo.body,
    );
    expect((await e.existencia('PRODUCCION')).valor.toString()).toBe('850');
  });

  it('conteos y correcciones de terminado conservan el original y rechazan pérdidas excesivas', async () => {
    const e = await escenario();
    const dto = {
      ...base(),
      productoId: e.producto.id,
      accion: 'CONTEO',
      cantidad: 7,
    };
    const conteo = await post('stock/movimientos', dto).expect(201);
    await post('stock/movimientos', {
      ...base(),
      productoId: e.producto.id,
      accion: 'AJUSTE',
      cantidad: 1,
      corrigeOperacionId: operacion(conteo).operacionId,
    }).expect(201);
    await post('stock/movimientos', {
      ...base(),
      productoId: e.producto.id,
      accion: 'PERDIDA',
      cantidad: 9,
    }).expect(409);
    expect(
      (
        await prisma.stockTerminado.findUniqueOrThrow({
          where: { productoId: e.producto.id },
        })
      ).cantidad,
    ).toBe(8);
    expect(
      await prisma.operacionInventario.count({
        where: { corrigeOperacionId: operacion(conteo).operacionId },
      }),
    ).toBe(1);
  });

  it('las restricciones CHECK de PostgreSQL rechazan stock negativo fuera de la API', async () => {
    const e = await escenario();
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.stockTerminado.create({
          data: { productoId: e.producto.id, cantidad: -1 },
        });
      }),
    ).rejects.toThrow();
    expect(
      await prisma.stockTerminado.count({
        where: { productoId: e.producto.id },
      }),
    ).toBe(0);
  });

  it('la API aplica permisos reales y permite obsequios al operador con participantes', async () => {
    const e = await escenario();
    await post('compras', e.compra(), lector.token).expect(403);
    await post('compras', e.compra(), operador.token).expect(403);
    await post('produccion', e.lote(), operador.token).expect(403);
    await post('stock/movimientos', {
      ...base(),
      productoId: e.producto.id,
      accion: 'CONTEO',
      cantidad: 5,
    }).expect(201);
    await post(
      'stock/movimientos',
      {
        ...base(),
        productoId: e.producto.id,
        accion: 'OBSEQUIO',
        cantidad: 2,
        responsableId: operador.id,
        ayudantesIds: [admin.id],
      },
      operador.token,
    ).expect(201);
    await post(
      'stock/movimientos',
      { ...base(), productoId: e.producto.id, accion: 'AJUSTE', cantidad: 1 },
      operador.token,
    ).expect(403);
    expect(
      (
        await prisma.stockTerminado.findUniqueOrThrow({
          where: { productoId: e.producto.id },
        })
      ).cantidad,
    ).toBe(3);
  });

  it('factor 80, roturas y consumo conservan las unidades y el valor sin redondeos flotantes', async () => {
    const e = await escenario('80');
    await post('compras', e.compra(1, '1200')).expect(201);
    await post('traslados', e.traslado()).expect(201);
    await post('produccion', { ...e.lote(), bolsasRotas: 2 }).expect(201);
    const existencia = await e.existencia('PRODUCCION');
    expect(existencia.unidades.toString()).toBe('68');
    expect(existencia.valor.toString()).toBe('1020');
    const total = await prisma.movimientoInsumo.aggregate({
      where: { presentacionId: e.presentacionId },
      _sum: { valor: true },
    });
    expect(total._sum.valor?.equals(new Prisma.Decimal('1020'))).toBe(true);
  });
});
