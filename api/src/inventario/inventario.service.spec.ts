import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventarioService } from './inventario.service';
import {
  AccionInsumo,
  AccionStock,
  CompraInsumoDto,
  LoteDto,
  MovimientoStockDto,
  OperacionInventarioDto,
} from './dto/inventario.dto';
import { ids, prismaInventario } from '../../test/soporte/inventario-prisma';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('../generated/prisma/client', () => ({
  Prisma: jest.requireActual<typeof import('@prisma/client/runtime/client')>(
    '@prisma/client/runtime/client',
  ),
}));

export const base = (): OperacionInventarioDto => ({
  claveIdempotencia: randomUUID(),
  fechaEfectiva: '2026-01-10T10:00:00-03:00',
  motivo: 'Prueba de inventario',
});
export const compra = (): CompraInsumoDto => ({
  ...base(),
  proveedorId: ids.proveedor,
  comprobante: randomUUID(),
  detalles: [
    { presentacionId: ids.presentacion, paquetes: 4, costoTotal: '4000' },
  ],
});
const lote = (): LoteDto => ({
  ...base(),
  codigo: randomUUID(),
  productoId: ids.producto,
  presentacionBolsaId: ids.presentacion,
  responsableId: ids.usuario,
  bolsasUsadas: 10,
  bolsasRotas: 0,
  cantidadApta: 10,
  cantidadEsperada: 100,
  hieloDescartadoKg: '0',
});

describe('Inventario: circuito de insumos, producción y stock', () => {
  let doble: ReturnType<typeof prismaInventario>;
  let service: InventarioService;
  beforeEach(() => {
    doble = prismaInventario();
    service = new InventarioService(doble.prisma as unknown as PrismaService);
  });
  async function abrir() {
    await service.comprar(compra(), ids.usuario);
    return service.trasladar(
      { ...base(), presentacionId: ids.presentacion, paquetes: 1 },
      ids.usuario,
    );
  }
  async function producir() {
    await abrir();
    await service.producir(lote(), ids.usuario);
  }
  const saldo = (ubicacion: string) =>
    doble.estado().existencias.find((e) => e.ubicacion === ubicacion);
  const stock = () => doble.estado().stocks[0]?.cantidad ?? 0;
  const mover = (
    accion: AccionStock,
    cantidad: number,
    extras: Partial<MovimientoStockDto> = {},
  ) =>
    service.moverStock(
      { ...base(), accion, cantidad, productoId: ids.producto, ...extras },
      ids.usuario,
    );

  it.each([
    [1, '300'],
    [3, '300'],
    [5, '200'],
    [10, '100'],
  ])(
    'inicia el umbral de bolsas de %s kg según la ERS',
    async (pesoKg, minimo) => {
      doble.producto.pesoKg = Number(pesoKg);
      await service.crearInsumo({
        nombre: 'Bolsas nuevas',
        tipo: 'BOLSA',
        unidad: 'unidad',
        productoId: ids.producto,
        presentacion: { nombre: 'Paquete' },
      });
      expect(doble.prisma.insumo.create.mock.calls[0][0].data).toMatchObject({
        stockMinimo: new Prisma.Decimal(minimo),
        presentaciones: {
          create: { nombre: 'Paquete', factor: new Prisma.Decimal(100) },
        },
      });
    },
  );
  it('admite mínimo y factor configurados sin reemplazar el factor histórico', async () => {
    await service.crearInsumo({
      nombre: 'Bolsas nuevas',
      tipo: 'BOLSA',
      unidad: 'unidad',
      productoId: ids.producto,
      stockMinimo: '160',
      presentacion: { nombre: 'Paquete 80', factor: '80' },
    });
    await service.agregarPresentacion(ids.insumo, {
      nombre: 'Paquete 50',
      factor: '50',
    });
    expect(doble.presentacion.factor.toString()).toBe('100');
    expect(doble.prisma.presentacionInsumo.create).toHaveBeenCalledWith({
      data: {
        insumoId: ids.insumo,
        nombre: 'Paquete 50',
        factor: new Prisma.Decimal(50),
      },
    });
  });
  it.each(['0', '1.5'])('no admite factor de bolsa %s', async (factor) => {
    await expect(
      service.agregarPresentacion(ids.insumo, { nombre: 'Paquete', factor }),
    ).rejects.toThrow('factor');
  });

  it('CA-27: 400 cerradas, abrir 100 y producir 10 deja 300 cerradas y 90 abiertas', async () => {
    await service.comprar(compra(), ids.usuario);
    expect((await service.listarInsumos())[0].alerta).toBe(false);
    await service.trasladar(
      { ...base(), presentacionId: ids.presentacion, paquetes: 1 },
      ids.usuario,
    );
    expect((await service.listarInsumos())[0].alerta).toBe(true);
    await service.producir(lote(), ids.usuario);
    expect(saldo('DEPOSITO')?.unidades.toString()).toBe('300');
    expect(saldo('PRODUCCION')?.unidades.toString()).toBe('90');
    expect(stock()).toBe(10);
    expect(doble.estado().operaciones).toHaveLength(3);
  });
  it('no toma la cantidad esperada como producción ni como pérdida', async () => {
    await producir();
    expect(stock()).toBe(10);
    expect(doble.estado().lotes[0].bolsasRotas).toBe(0);
  });
  it('consume bolsas rotas y guarda hielo descartado sin sumarlo al stock', async () => {
    await abrir();
    await service.producir(
      { ...lote(), bolsasRotas: 2, hieloDescartadoKg: '3.5' },
      ids.usuario,
    );
    expect(saldo('PRODUCCION')?.unidades.toString()).toBe('88');
    expect(stock()).toBe(10);
    expect(doble.estado().lotes[0].hieloDescartadoKg).toBe('3.5');
  });
  it('preserva costo al trasladar y consume solo el costo usado o roto', async () => {
    await abrir();
    expect(saldo('DEPOSITO')?.valor.toString()).toBe('3000');
    expect(saldo('PRODUCCION')?.valor.toString()).toBe('1000');
    await service.producir(lote(), ids.usuario);
    expect(saldo('PRODUCCION')?.valor.toString()).toBe('900');
    expect((await service.listarInsumos())[0].costoPromedio?.toString()).toBe(
      '10',
    );
  });
  it('registra otros insumos con conversión y consumos fraccionarios', async () => {
    doble.insumo.tipo = 'OTRO';
    doble.insumo.productoId = null;
    doble.insumo.unidad = 'litro';
    doble.presentacion.factor = new Prisma.Decimal('0.5');
    await service.comprar(
      {
        ...compra(),
        detalles: [
          { presentacionId: ids.presentacion, paquetes: 2, costoTotal: '10' },
        ],
      },
      ids.usuario,
    );
    await service.trasladar(
      { ...base(), presentacionId: ids.presentacion, paquetes: 1 },
      ids.usuario,
    );
    await service.moverMateriaPrima(
      {
        ...base(),
        presentacionId: ids.presentacion,
        ubicacion: 'PRODUCCION',
        accion: AccionInsumo.CONSUMO,
        cantidad: '0.125',
      },
      ids.usuario,
    );
    expect(saldo('DEPOSITO')?.unidades.toString()).toBe('0.5');
    expect(saldo('PRODUCCION')?.unidades.toString()).toBe('0.375');
    expect(saldo('PRODUCCION')?.valor.toString()).toBe('3.75');
  });
  it('pondera costos de compras sucesivas y permite factores diferentes de 100', async () => {
    doble.presentacion.factor = new Prisma.Decimal(80);
    await service.comprar(
      {
        ...compra(),
        detalles: [
          { presentacionId: ids.presentacion, paquetes: 2, costoTotal: '1600' },
        ],
      },
      ids.usuario,
    );
    await service.comprar(
      {
        ...compra(),
        detalles: [
          { presentacionId: ids.presentacion, paquetes: 2, costoTotal: '3200' },
        ],
      },
      ids.usuario,
    );
    expect(saldo('DEPOSITO')?.unidades.toString()).toBe('320');
    expect((await service.listarInsumos())[0].costoPromedio?.toString()).toBe(
      '15',
    );
    await service.trasladar(
      { ...base(), presentacionId: ids.presentacion, paquetes: 1 },
      ids.usuario,
    );
    expect(saldo('PRODUCCION')?.unidades.toString()).toBe('80');
    expect(saldo('PRODUCCION')?.valor.toString()).toBe('1200');
  });
  it('compra sin pago no inventa egresos y conserva el compromiso pendiente', async () => {
    await service.comprar(compra(), ids.usuario);
    expect(doble.estado().financieros).toHaveLength(0);
    expect(doble.estado().compras[0].pagado.toString()).toBe('0');
  });
  it('registra pago parcial y pago posterior sin volver a ingresar insumos', async () => {
    const pago = {
      cuentaId: ids.cuenta,
      categoriaId: ids.categoria,
      importe: '1000',
    };
    await service.comprar({ ...compra(), pago }, ids.usuario);
    expect(doble.estado().compras[0].pagado.toString()).toBe('1000');
    await service.pagarCompra(
      doble.estado().compras[0].id,
      { ...base(), pago: { ...pago, importe: '3000' } },
      ids.usuario,
    );
    expect(doble.estado().compras[0].pagado.toString()).toBe('4000');
    expect(saldo('DEPOSITO')?.unidades.toString()).toBe('400');
    expect(doble.estado().financieros).toHaveLength(2);
    expect(doble.estado().movimientos).toHaveLength(1);
  });
  it('pago inválido revierte también la recepción de la compra', async () => {
    await expect(
      service.comprar(
        {
          ...compra(),
          pago: {
            cuentaId: ids.cuenta,
            categoriaId: ids.categoria,
            importe: '5000',
          },
        },
        ids.usuario,
      ),
    ).rejects.toThrow('no superar');
    expect(doble.estado().existencias).toHaveLength(0);
    expect(doble.estado().compras).toHaveLength(0);
    expect(doble.estado().operaciones).toHaveLength(0);
  });
  it('no acepta un pago previo a la compra', async () => {
    await service.comprar(compra(), ids.usuario);
    await expect(
      service.pagarCompra(
        doble.estado().compras[0].id,
        {
          ...base(),
          fechaEfectiva: '2026-01-09T10:00:00-03:00',
          pago: {
            cuentaId: ids.cuenta,
            categoriaId: ids.categoria,
            importe: '1',
          },
        },
        ids.usuario,
      ),
    ).rejects.toThrow('anterior');
  });
  it('reintentar una compra devuelve la misma respuesta sin duplicar mercadería', async () => {
    const dto = compra();
    const primero = await service.comprar(dto, ids.usuario);
    const segundo = await service.comprar(dto, ids.usuario);
    expect(segundo).toEqual(primero);
    expect(doble.estado().compras).toHaveLength(1);
    expect(saldo('DEPOSITO')?.unidades.toString()).toBe('400');
  });
  it('una misma clave con otro importe o usuario devuelve conflicto', async () => {
    const dto = compra();
    await service.comprar(dto, ids.usuario);
    await expect(
      service.comprar({ ...dto, motivo: 'Otro motivo' }, ids.usuario),
    ).rejects.toThrow('otros datos');
    await expect(service.comprar(dto, randomUUID())).rejects.toThrow(
      'otros datos',
    );
  });
  it('reintentar un lote conserva los sobrantes originales de su respuesta', async () => {
    await abrir();
    const dto = lote();
    const primero = await service.producir(dto, ids.usuario);
    await service.producir(lote(), ids.usuario);
    expect(await service.producir(dto, ids.usuario)).toEqual(primero);
    expect(stock()).toBe(20);
    expect(saldo('PRODUCCION')?.unidades.toString()).toBe('80');
  });
  it('no consume del depósito directamente al producir', async () => {
    await service.comprar(compra(), ids.usuario);
    await expect(service.producir(lote(), ids.usuario)).rejects.toThrow(
      'insuficiente',
    );
    expect(stock()).toBe(0);
  });
  it('revierte todo el lote si las rotas superan las bolsas restantes', async () => {
    await abrir();
    await expect(
      service.producir({ ...lote(), bolsasRotas: 91 }, ids.usuario),
    ).rejects.toThrow('insuficiente');
    expect(saldo('PRODUCCION')?.unidades.toString()).toBe('100');
    expect(stock()).toBe(0);
    expect(doble.estado().lotes).toHaveLength(0);
    expect(doble.estado().operaciones).toHaveLength(2);
  });
  it('revierte el consumo si falla el registro de stock terminado', async () => {
    await abrir();
    doble.prisma.movimientoStock.create.mockRejectedValueOnce(
      new Error('Falla simulada'),
    );
    await expect(service.producir(lote(), ids.usuario)).rejects.toThrow(
      'Falla simulada',
    );
    expect(saldo('PRODUCCION')?.unidades.toString()).toBe('100');
    expect(doble.estado().lotes).toHaveLength(0);
  });
  it('no permite producto o bolsa incompatible ni más aptas que bolsas usadas', async () => {
    await abrir();
    await expect(
      service.producir({ ...lote(), cantidadApta: 11 }, ids.usuario),
    ).rejects.toThrow('no pueden superar');
    doble.insumo.productoId = randomUUID();
    await expect(service.producir(lote(), ids.usuario)).rejects.toThrow(
      'no corresponde',
    );
  });
  it('exige responsable y participantes diferentes', async () => {
    await abrir();
    await expect(
      service.producir({ ...lote(), ayudantesIds: [ids.usuario] }, ids.usuario),
    ).rejects.toThrow('diferentes');
  });
  it.each([
    AccionStock.PERDIDA,
    AccionStock.OBSEQUIO,
    AccionStock.CONSUMO_INTERNO,
  ])('%s descuenta una vez sin generar dinero', async (accion) => {
    await producir();
    await mover(
      accion,
      2,
      accion === AccionStock.PERDIDA ? {} : { responsableId: ids.usuario },
    );
    expect(stock()).toBe(8);
    expect(doble.estado().financieros).toHaveLength(0);
  });
  it('una devolución apta aumenta stock y un ajuste puede reducirlo', async () => {
    await producir();
    await mover(AccionStock.DEVOLUCION, 3);
    await mover(AccionStock.AJUSTE, -1);
    expect(stock()).toBe(12);
  });
  it('conteo físico guarda el teórico, el físico y la diferencia', async () => {
    await producir();
    await mover(AccionStock.CONTEO, 7);
    expect(stock()).toBe(7);
    expect(doble.estado().terminados.at(-1)).toMatchObject({
      saldoAnterior: 10,
      saldoPosterior: 7,
      cantidad: -3,
    });
  });
  it('conteo sin diferencia conserva un registro de auditoría', async () => {
    await producir();
    await mover(AccionStock.CONTEO, 10);
    expect(doble.estado().terminados.at(-1)?.cantidad).toBe(0);
  });
  it('bloquea pérdidas que dejarían stock terminado negativo', async () => {
    await producir();
    await expect(mover(AccionStock.PERDIDA, 11)).rejects.toThrow(
      'insuficiente',
    );
    expect(stock()).toBe(10);
  });
  it.each([AccionStock.DEVOLUCION, AccionStock.PERDIDA, AccionStock.CONTEO])(
    'rechaza cantidades negativas para %s',
    async (accion) => {
      await expect(mover(accion, -1)).rejects.toThrow();
    },
  );
  it('conserva el vínculo de una corrección con la operación original', async () => {
    await producir();
    const original = doble.estado().operaciones.at(-1)!.id;
    await mover(AccionStock.AJUSTE, -1, { corrigeOperacionId: original });
    expect(doble.estado().operaciones.at(-1)?.corrigeOperacionId).toBe(
      original,
    );
  });
  it('el consumo genérico solo puede salir de producción', async () => {
    await abrir();
    await expect(
      service.moverMateriaPrima(
        {
          ...base(),
          presentacionId: ids.presentacion,
          ubicacion: 'DEPOSITO',
          accion: AccionInsumo.CONSUMO,
          cantidad: '100',
        },
        ids.usuario,
      ),
    ).rejects.toThrow('salir de producción');
  });
  it('los ajustes de depósito deben respetar paquetes completos', async () => {
    await abrir();
    await expect(
      service.moverMateriaPrima(
        {
          ...base(),
          presentacionId: ids.presentacion,
          ubicacion: 'DEPOSITO',
          accion: AccionInsumo.AJUSTE,
          cantidad: '-1',
        },
        ids.usuario,
      ),
    ).rejects.toThrow('completas');
  });
  it('un aumento manual de insumos requiere costo explícito', async () => {
    await abrir();
    await expect(
      service.moverMateriaPrima(
        {
          ...base(),
          presentacionId: ids.presentacion,
          ubicacion: 'PRODUCCION',
          accion: AccionInsumo.AJUSTE,
          cantidad: '1',
        },
        ids.usuario,
      ),
    ).rejects.toThrow('costo del ingreso');
  });
  it('separa fecha operativa de fecha de registro y conserva el actor', async () => {
    await abrir();
    expect(doble.estado().operaciones[0]).toMatchObject({
      fechaEfectiva: new Date('2026-01-10T13:00:00Z'),
      usuarioId: ids.usuario,
    });
    expect(
      doble.estado().operaciones[0].fechaRegistro.getTime(),
    ).toBeGreaterThan(new Date('2026-01-10').getTime());
  });
  it.each(['2035-01-01T10:00:00Z', '2026-01-01T10:00:00'])(
    'rechaza fecha inválida o futura %s',
    async (fechaEfectiva) => {
      await expect(
        service.comprar({ ...compra(), fechaEfectiva }, ids.usuario),
      ).rejects.toThrow('fecha');
    },
  );
  it.each(['P2034', 'ADAPTADOR'])(
    'reintenta conflicto %s y usa aislamiento Serializable',
    async (tipo) => {
      doble.prisma.$transaction.mockRejectedValueOnce(
        tipo === 'ADAPTADOR'
          ? Object.assign(new Error('TransactionWriteConflict'), {
              cause: {
                kind: 'TransactionWriteConflict',
                originalCode: '40001',
              },
            })
          : new Prisma.PrismaClientKnownRequestError('Conflicto', {
              code: 'P2034',
              clientVersion: '7',
            }),
      );
      await service.comprar(compra(), ids.usuario);
      expect(doble.estado().compras).toHaveLength(1);
      expect(doble.prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: 'Serializable' },
      );
    },
  );
  it('la integración futura exige un origen de venta y rechaza repetir descuentos', async () => {
    await producir();
    await expect(
      service.descontarVentaEnTransaccion(
        doble.prisma as unknown as Prisma.TransactionClient,
        'venta',
        doble.estado().operaciones[0].id,
        [{ productoId: ids.producto, cantidad: 1 }],
      ),
    ).rejects.toThrow('origen de venta');
    const op = {
      ...doble.estado().operaciones[0],
      id: randomUUID(),
      claveIdempotencia: randomUUID(),
      tipo: 'VENTA' as const,
      origenTipo: 'VENTA',
      origenId: 'venta',
    };
    await doble.prisma.operacionInventario.create({ data: op });
    await service.descontarVentaEnTransaccion(
      doble.prisma as unknown as Prisma.TransactionClient,
      'venta',
      op.id,
      [{ productoId: ids.producto, cantidad: 2 }],
    );
    await expect(
      service.descontarVentaEnTransaccion(
        doble.prisma as unknown as Prisma.TransactionClient,
        'venta',
        op.id,
        [{ productoId: ids.producto, cantidad: 2 }],
      ),
    ).rejects.toThrow('ya descontó');
    expect(stock()).toBe(8);
  });
});
