import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

type VentaJson = {
  id: string;
  total: string;
  saldo: string;
  cobrado: string;
  creditoPorAnulacion: string;
  estado: string;
  estadoDeuda: string;
  detalles: {
    precioUnitario: string;
    nombreProducto: string;
    costoUnitario: string | null;
    estadoCosto: string;
  }[];
};
const venta = (r: { body: unknown }) => (r.body as { datos: VentaJson }).datos;
const op = () => ({
  claveIdempotencia: randomUUID(),
  motivo: 'Aceptación QA comercial',
});
const fecha = '2026-01-10T10:00:00-03:00';

describe('Precios, ventas y cobros contra PostgreSQL QA', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: { id: string; token: string };
  let operador: { id: string; token: string };
  let lector: { id: string; token: string };
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      url.hostname !== '127.0.0.1' ||
      url.port !== '5433' ||
      url.pathname !== '/jm_hielos_qa_ers14' ||
      process.env.JM_QA_DATABASE_NAME !== 'jm_hielos_qa_ers14'
    )
      throw new Error('Destino QA obligatorio');
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
    const crear = async (rol: 'ADMIN' | 'OPERADOR' | 'LECTOR') => {
      const u = await prisma.usuario.create({
        data: {
          username: 'qa-' + randomUUID(),
          passwordHash: 'cuenta QA sin acceso por contraseña',
          rol,
        },
      });
      return { id: u.id, token: app.get(JwtService).sign({ sub: u.id, rol }) };
    };
    admin = await crear('ADMIN');
    operador = await crear('OPERADOR');
    lector = await crear('LECTOR');
  });
  afterAll(async () => {
    if (app) await app.close();
  });
  const post = (ruta: string, dto: object, token?: string) =>
    request(app.getHttpServer())
      .post(ruta)
      .auth(token ?? admin.token, { type: 'bearer' })
      .send(dto);
  const get = (ruta: string, token?: string) =>
    request(app.getHttpServer())
      .get(ruta)
      .auth(token ?? admin.token, { type: 'bearer' });
  async function escenario() {
    const producto = await prisma.producto.create({
      data: {
        nombre: 'QA producto ' + randomUUID(),
        pesoKg: 3,
        unidad: 'bolsa',
      },
    });
    const cliente = await prisma.cliente.create({
      data: { nombre: 'QA cliente ' + randomUUID(), tipoCliente: 'HABITUAL' },
    });
    const listaRespuesta = await post('/precios', {
      nombre: 'QA lista ' + randomUUID(),
      tipo: 'MAYORISTA',
      motivo: 'QA',
    }).expect(201);
    const lista = listaRespuesta.body as { id: string };
    await post('/precios/' + lista.id + '/productos', {
      productoId: producto.id,
      precio: '2000',
      motivo: 'QA',
    }).expect(201);
    await post('/precios/clientes/' + cliente.id + '/condicion', {
      listaId: lista.id,
      motivo: 'QA',
    }).expect(201);
    await post('/inventario/stock/movimientos', {
      ...op(),
      fechaEfectiva: fecha,
      productoId: producto.id,
      accion: 'CONTEO',
      cantidad: 50,
    }).expect(201);
    const cuenta = await prisma.cuentaFinanciera.create({
      data: {
        nombre: 'QA caja ' + randomUUID(),
        tipo: 'EFECTIVO',
        titularInterno: 'QA',
        saldoInicial: '0',
        fechaApertura: new Date('2026-01-01T03:00:00Z'),
      },
    });
    const banco = await prisma.cuentaFinanciera.create({
      data: {
        nombre: 'QA banco ' + randomUUID(),
        tipo: 'BANCO',
        titularInterno: 'QA',
        saldoInicial: '0',
        fechaApertura: new Date('2026-01-01T03:00:00Z'),
      },
    });
    const categoria = await prisma.categoriaFlujo.create({
      data: {
        nombre: 'QA venta ' + randomUUID(),
        grupo: 'OPERACION',
        sentido: 'INGRESO',
      },
    });
    const dto = (cantidad = 45) => ({
      ...op(),
      clienteId: cliente.id,
      fechaPedido: fecha,
      fechaEntrega: fecha,
      envio: '0',
      responsableCobranzaId: operador.id,
      preparacion: { responsableId: admin.id, ayudantesIds: [operador.id] },
      entrega: { responsableId: operador.id, ayudantesIds: [admin.id] },
      detalles: [{ productoId: producto.id, cantidad, precioEsperado: '2000' }],
    });
    const pago = (importe: string) => ({
      cuentaId: cuenta.id,
      categoriaId: categoria.id,
      importe,
    });
    const stock = async () =>
      (
        await prisma.stockTerminado.findUniqueOrThrow({
          where: { productoId: producto.id },
        })
      ).cantidad;
    return {
      producto,
      cliente,
      lista,
      cuenta,
      banco,
      categoria,
      dto,
      pago,
      stock,
    };
  }

  it('CA-03/05/06/40: una venta de 90000 cobra 70000 mixtos, deja 20000 y descuenta una vez', async () => {
    const e = await escenario();
    const dto = {
      ...e.dto(),
      cobro: {
        fechaEfectiva: fecha,
        pagos: [e.pago('40000'), { ...e.pago('30000'), cuentaId: e.banco.id }],
      },
    };
    const r = await post('/ventas', dto, operador.token).expect(201);
    expect(venta(r)).toMatchObject({
      total: '90000',
      cobrado: '70000',
      saldo: '20000',
      estadoDeuda: 'PARCIAL',
    });
    expect(await e.stock()).toBe(5);
    expect(
      (await post('/ventas', dto, operador.token).expect(201)).body,
    ).toEqual(r.body);
    expect(
      await prisma.venta.count({ where: { clienteId: e.cliente.id } }),
    ).toBe(1);
    expect(
      await prisma.movimientoStock.count({
        where: { productoId: e.producto.id, operacion: { tipo: 'VENTA' } },
      }),
    ).toBe(1);
    const parcial = await post(
      '/ventas/' + venta(r).id + '/cobros',
      {
        ...op(),
        fechaEfectiva: '2026-02-10T10:00:00-03:00',
        pagos: [e.pago('20000')],
      },
      operador.token,
    ).expect(201);
    expect(venta(parcial)).toMatchObject({
      saldo: '0',
      estadoDeuda: 'SALDADA',
    });
    expect(await e.stock()).toBe(5);
    const cuenta = await get(
      '/ventas/clientes/' + e.cliente.id + '/estado-cuenta',
      lector.token,
    ).expect(200);
    expect((cuenta.body as { deuda: string }).deuda).toBe('0');
    for (const [desde, hasta, esperado] of [
      ['2026-01-01', '2026-01-31', '40000.00'],
      ['2026-02-01', '2026-02-28', '20000.00'],
    ]) {
      const flujo = await get(
        '/cash-flow?cuentaId=' +
          e.cuenta.id +
          '&desde=' +
          desde +
          '&hasta=' +
          hasta,
      ).expect(200);
      expect((flujo.body as { totalIngresos: string }).totalIngresos).toBe(
        esperado,
      );
    }
  });
  it('la venta totalmente fiada no crea cobro ni ingreso ficticio y conserva el seguimiento', async () => {
    const e = await escenario();
    const r = await post('/ventas', e.dto(), operador.token).expect(201);
    expect(venta(r)).toMatchObject({
      saldo: '90000',
      cobrado: '0',
      estadoDeuda: 'PENDIENTE',
    });
    expect(
      await prisma.cobroVenta.count({ where: { ventaId: venta(r).id } }),
    ).toBe(0);
    expect(
      await prisma.movimientoFinanciero.count({
        where: { cuentaId: e.cuenta.id },
      }),
    ).toBe(0);
  });
  it('CA-07: cambiar lista, nombre y precio particular no altera el histórico de una venta', async () => {
    const e = await escenario();
    const r = await post('/ventas', e.dto(2)).expect(201);
    await post('/precios/' + e.lista.id + '/productos', {
      productoId: e.producto.id,
      precio: '3000',
      motivo: 'Actualización QA',
    }).expect(201);
    await prisma.producto.update({
      where: { id: e.producto.id },
      data: { nombre: 'QA producto renombrado' },
    });
    const actual = await get('/ventas/' + venta(r).id).expect(200);
    const historico = actual.body as VentaJson;
    expect(historico.total).toBe('4000');
    expect(historico.detalles[0].precioUnitario).toBe('2000');
    expect(historico.detalles[0].nombreProducto).toBe(e.producto.nombre);
    expect(historico.detalles[0].costoUnitario).toBeNull();
    expect(historico.detalles[0].estadoCosto).toBe('PENDIENTE');
    await post('/precios/clientes/' + e.cliente.id + '/particulares', {
      productoId: e.producto.id,
      precio: '1500',
      motivo: 'Acuerdo QA',
    }).expect(201);
    const especial = e.dto(2);
    especial.detalles[0].precioEsperado = '1500';
    expect(venta(await post('/ventas', especial).expect(201)).total).toBe(
      '3000',
    );
    await post('/precios/clientes/' + e.cliente.id + '/particulares', {
      productoId: e.producto.id,
      precio: '1500',
      activo: false,
      motivo: 'Termina acuerdo QA',
    }).expect(201);
    const lista = e.dto(2);
    lista.detalles[0].precioEsperado = '3000';
    expect(venta(await post('/ventas', lista).expect(201)).total).toBe('6000');
  });
  it('rechaza precio manipulado o desactualizado antes de descontar stock', async () => {
    const e = await escenario();
    const dto = e.dto();
    dto.detalles[0].precioEsperado = '1';
    await post('/ventas', dto).expect(409);
    expect(await e.stock()).toBe(50);
    expect(
      await prisma.venta.count({ where: { clienteId: e.cliente.id } }),
    ).toBe(0);
  });
  it('CA-04: un cobro inicial excesivo revierte venta, participantes, inventario y finanzas', async () => {
    const e = await escenario();
    const dto = {
      ...e.dto(),
      cobro: { fechaEfectiva: fecha, pagos: [e.pago('90001')] },
    };
    await post('/ventas', dto).expect(400);
    expect(await e.stock()).toBe(50);
    expect(
      await prisma.venta.count({ where: { clienteId: e.cliente.id } }),
    ).toBe(0);
    expect(
      await prisma.operacionComercial.count({
        where: { claveIdempotencia: dto.claveIdempotencia },
      }),
    ).toBe(0);
    expect(
      await prisma.movimientoFinanciero.count({
        where: { cuentaId: e.cuenta.id },
      }),
    ).toBe(0);
  });
  it('una categoría de egreso o cuenta inactiva no admite cobros ni efectos parciales', async () => {
    const e = await escenario();
    await prisma.categoriaFlujo.update({
      where: { id: e.categoria.id },
      data: { sentido: 'EGRESO' },
    });
    await post('/ventas', {
      ...e.dto(),
      cobro: { fechaEfectiva: fecha, pagos: [e.pago('1000')] },
    }).expect(400);
    expect(await e.stock()).toBe(50);
    await prisma.categoriaFlujo.update({
      where: { id: e.categoria.id },
      data: { sentido: 'INGRESO' },
    });
    await prisma.cuentaFinanciera.update({
      where: { id: e.cuenta.id },
      data: { activo: false },
    });
    await post('/ventas', {
      ...e.dto(),
      cobro: { fechaEfectiva: fecha, pagos: [e.pago('1000')] },
    }).expect(400);
    expect(await e.stock()).toBe(50);
  });
  it('dos confirmaciones concurrentes de la misma venta devuelven una única operación', async () => {
    const e = await escenario();
    const dto = e.dto();
    const rs = await Promise.all([post('/ventas', dto), post('/ventas', dto)]);
    expect(rs.map((r) => r.status)).toEqual([201, 201]);
    expect(rs[0].body).toEqual(rs[1].body);
    expect(await e.stock()).toBe(5);
  });
  it('dos ventas concurrentes no pueden entregar más stock del disponible', async () => {
    const e = await escenario();
    const rs = await Promise.all([
      post('/ventas', e.dto()),
      post('/ventas', e.dto()),
    ]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await e.stock()).toBe(5);
    expect(
      await prisma.venta.count({ where: { clienteId: e.cliente.id } }),
    ).toBe(1);
  });
  it('dos cobros concurrentes no sobrepasan el saldo y un reintento no cobra de nuevo', async () => {
    const e = await escenario();
    const r = await post('/ventas', e.dto()).expect(201);
    const ruta = '/ventas/' + venta(r).id + '/cobros';
    const a = { ...op(), fechaEfectiva: fecha, pagos: [e.pago('70000')] },
      b = { ...op(), fechaEfectiva: fecha, pagos: [e.pago('70000')] };
    const rs = await Promise.all([post(ruta, a), post(ruta, b)]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 400]);
    const ganadora = rs[0].status === 201 ? a : b;
    await post(ruta, ganadora).expect(201);
    expect(
      await prisma.cobroVenta.count({ where: { ventaId: venta(r).id } }),
    ).toBe(1);
    expect(
      await prisma.movimientoFinanciero.count({
        where: { cuentaId: e.cuenta.id },
      }),
    ).toBe(1);
  });
  it('cambiar datos o usuario conservando la clave devuelve conflicto', async () => {
    const e = await escenario();
    const dto = e.dto(2);
    await post('/ventas', dto).expect(201);
    await post('/ventas', { ...dto, envio: '1' }).expect(409);
    await post('/ventas', dto, operador.token).expect(409);
    expect(await e.stock()).toBe(48);
  });
  it('una venta acepta varios productos y cargo de envío en el mismo descuento atómico', async () => {
    const e = await escenario();
    const otro = await prisma.producto.create({
      data: { nombre: 'QA 5 kg ' + randomUUID(), pesoKg: 5, unidad: 'bolsa' },
    });
    await post('/precios/' + e.lista.id + '/productos', {
      productoId: otro.id,
      precio: '3000',
      motivo: 'QA',
    }).expect(201);
    await post('/inventario/stock/movimientos', {
      ...op(),
      fechaEfectiva: fecha,
      productoId: otro.id,
      accion: 'CONTEO',
      cantidad: 20,
    }).expect(201);
    const dto = e.dto(10);
    dto.detalles.push({
      productoId: otro.id,
      cantidad: 4,
      precioEsperado: '3000',
    });
    dto.envio = '1000';
    expect(venta(await post('/ventas', dto).expect(201)).total).toBe('33000');
    expect(await e.stock()).toBe(40);
    expect(
      (
        await prisma.stockTerminado.findUniqueOrThrow({
          where: { productoId: otro.id },
        })
      ).cantidad,
    ).toBe(16);
  });
  it('anular compensa únicamente las devoluciones aptas declaradas, sin inventar reembolsos', async () => {
    const e = await escenario();
    const r = await post('/ventas', {
      ...e.dto(10),
      cobro: { fechaEfectiva: fecha, pagos: [e.pago('20000')] },
    }).expect(201);
    const dto = {
      ...op(),
      fechaEfectiva: fecha,
      devoluciones: [{ productoId: e.producto.id, cantidad: 3 }],
    };
    const ruta = '/ventas/' + venta(r).id + '/anulacion';
    const anulada = await post(ruta, dto).expect(201);
    expect(venta(anulada)).toMatchObject({
      estado: 'ANULADA',
      saldo: '0',
      creditoPorAnulacion: '20000',
    });
    expect(await e.stock()).toBe(43);
    expect((await post(ruta, dto).expect(201)).body).toEqual(anulada.body);
    expect(await e.stock()).toBe(43);
    expect(
      await prisma.movimientoFinanciero.count({
        where: { cuentaId: e.cuenta.id },
      }),
    ).toBe(1);
    await post(ruta, { ...dto, claveIdempotencia: randomUUID() }).expect(409);
    await post('/ventas/' + venta(r).id + '/cobros', {
      ...op(),
      fechaEfectiva: fecha,
      pagos: [e.pago('1')],
    }).expect(400);
  });
  it('LECTOR consulta; OPERADOR entrega y cobra, pero no cambia precios ni anula', async () => {
    const e = await escenario();
    await post('/ventas', e.dto(2), lector.token).expect(403);
    const r = await post('/ventas', e.dto(2), operador.token).expect(201);
    await get('/ventas/' + venta(r).id, lector.token).expect(200);
    await post(
      '/precios/' + e.lista.id + '/productos',
      { productoId: e.producto.id, precio: '1', motivo: 'QA' },
      operador.token,
    ).expect(403);
    await post(
      '/ventas/' + venta(r).id + '/anulacion',
      { ...op(), fechaEfectiva: fecha, devoluciones: [] },
      operador.token,
    ).expect(403);
  });
  it('el catálogo inicial crea cuatro tamaños/listas y Consumidor final sin precios ficticios ni duplicados', async () => {
    await post('/precios/inicializar', {
      motivo: 'Preparación explícita QA',
    }).expect(201);
    await post('/precios/inicializar', {
      motivo: 'Reintento explícito QA',
    }).expect(201);
    expect(
      await prisma.condicionCliente.count({ where: { consumidorFinal: true } }),
    ).toBe(1);
    for (const pesoKg of [1, 3, 5, 10])
      expect(
        await prisma.producto.count({
          where: { pesoKg, unidad: 'bolsa', activo: true },
        }),
      ).toBeGreaterThan(0);
    const consumidor = await prisma.condicionCliente.findFirstOrThrow({
      where: { consumidorFinal: true },
      include: { lista: true },
    });
    expect(consumidor.lista.tipo).toBe('MINORISTA');
    const e = await escenario();
    await post('/precios/clientes/' + consumidor.clienteId + '/condicion', {
      listaId: e.lista.id,
      motivo: 'QA',
    }).expect(400);
  });
  it('los cambios de precios conservan actor, motivo y valor anterior en auditoría', async () => {
    const e = await escenario();
    await post('/precios/' + e.lista.id + '/productos', {
      productoId: e.producto.id,
      precio: '2500',
      motivo: 'Acuerdo documentado QA',
    }).expect(201);
    const auditoria = await prisma.auditoriaComercial.findFirstOrThrow({
      where: {
        entidadId: e.lista.id + ':' + e.producto.id,
        accion: 'MODIFICAR',
      },
    });
    expect(auditoria.usuarioId).toBe(admin.id);
    expect(auditoria.motivo).toBe('Acuerdo documentado QA');
    expect(auditoria.anterior).toMatchObject({ precio: '2000' });
    expect(auditoria.posterior).toMatchObject({ precio: '2500' });
  });
  it('el administrador edita el nombre/estado de lista y conserva la modalidad e historia', async () => {
    const e = await escenario();
    await post('/precios/' + e.lista.id + '/configuracion', {
      nombre: 'QA lista desactivada ' + randomUUID(),
      activo: false,
      motivo: 'Cambio QA documentado',
    }).expect(201);
    await post('/ventas', e.dto(2)).expect(400);
    expect(await e.stock()).toBe(50);
    expect(
      (
        await prisma.listaPrecio.findUniqueOrThrow({
          where: { id: e.lista.id },
        })
      ).tipo,
    ).toBe('MAYORISTA');
  });
  it('la falta de stock del segundo producto revierte también el descuento del primero', async () => {
    const e = await escenario();
    const otro = await prisma.producto.create({
      data: {
        nombre: 'QA sin stock ' + randomUUID(),
        pesoKg: 5,
        unidad: 'bolsa',
      },
    });
    await post('/precios/' + e.lista.id + '/productos', {
      productoId: otro.id,
      precio: '3000',
      motivo: 'QA',
    }).expect(201);
    const dto = e.dto(2);
    dto.detalles.push({
      productoId: otro.id,
      cantidad: 1,
      precioEsperado: '3000',
    });
    await post('/ventas', dto).expect(409);
    expect(await e.stock()).toBe(50);
    expect(
      await prisma.venta.count({ where: { clienteId: e.cliente.id } }),
    ).toBe(0);
  });
  it.each([
    ['preparación nula', { preparacion: null }],
    ['renglón nulo', { detalles: [null] }],
    ['cobro nulo', { cobro: null }],
    ['entrega futura', { fechaEntrega: '2035-01-01T10:00:00-03:00' }],
    ['envío negativo', { envio: '-1' }],
  ])('rechaza datos comerciales inválidos: %s', async (_nombre, cambio) => {
    const e = await escenario();
    await post('/ventas', { ...e.dto(2), ...cambio }).expect(400);
    expect(await e.stock()).toBe(50);
  });
});
