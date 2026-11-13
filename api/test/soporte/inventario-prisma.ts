import { Decimal } from '@prisma/client/runtime/client';
import type {
  CompraInsumo,
  ExistenciaInsumo,
  Insumo,
  LoteProduccion,
  MovimientoInsumo,
  MovimientoStock,
  OperacionInventario,
  PresentacionInsumo,
  Prisma,
  StockTerminado,
} from '../../src/generated/prisma/client';

export const ids = {
  usuario: '123e4567-e89b-42d3-a456-000000000001',
  producto: '123e4567-e89b-42d3-a456-000000000002',
  insumo: '123e4567-e89b-42d3-a456-000000000003',
  presentacion: '123e4567-e89b-42d3-a456-000000000004',
  proveedor: '123e4567-e89b-42d3-a456-000000000005',
  cuenta: '123e4567-e89b-42d3-a456-000000000006',
  categoria: '123e4567-e89b-42d3-a456-000000000007',
};

// Doble en memoria para comprobar efectos y rollback de la aplicación.
// No simula bloqueos ni aislamiento de PostgreSQL: eso se prueba por separado.
export function prismaInventario() {
  const insumo: Insumo = {
    id: ids.insumo,
    nombre: 'Bolsas vacías 3 kg',
    tipo: 'BOLSA',
    productoId: ids.producto,
    unidad: 'unidad',
    stockMinimo: new Decimal(300),
    activo: true,
  };
  const presentacion: PresentacionInsumo & { insumo: Insumo } = {
    id: ids.presentacion,
    nombre: 'Paquete',
    factor: new Decimal(100),
    activo: true,
    insumoId: ids.insumo,
    insumo,
  };
  const producto = {
    id: ids.producto,
    nombre: 'Hielo 3 kg',
    pesoKg: 3,
    unidad: 'bolsa',
    activo: true,
  };
  let existencias: ExistenciaInsumo[] = [];
  let stocks: StockTerminado[] = [];
  let operaciones: OperacionInventario[] = [];
  let movimientos: MovimientoInsumo[] = [];
  let terminados: MovimientoStock[] = [];
  let compras: CompraInsumo[] = [];
  let lotes: LoteProduccion[] = [];
  let financieros: unknown[] = [];
  let secuencia = 100;
  const siguienteId = () =>
    `123e4567-e89b-42d3-a456-${String(secuencia++).padStart(12, '0')}`;
  const prisma = {
    $transaction: jest.fn(
      async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => {
        const copia = {
          existencias: [...existencias],
          stocks: [...stocks],
          operaciones: [...operaciones],
          movimientos: [...movimientos],
          terminados: [...terminados],
          compras: [...compras],
          lotes: [...lotes],
          financieros: [...financieros],
        };
        try {
          return await fn(clienteTransaccion());
        } catch (error) {
          ({
            existencias,
            stocks,
            operaciones,
            movimientos,
            terminados,
            compras,
            lotes,
            financieros,
          } = copia);
          throw error;
        }
      },
    ),
    usuario: {
      findMany: jest.fn(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(
          where.id.in.map((id) => ({
            id,
            username: 'socio',
            rol: 'ADMIN',
            activo: true,
          })),
        ),
      ),
    },
    producto: {
      findUnique: jest.fn(() => Promise.resolve(producto)),
      findMany: jest.fn(() =>
        Promise.resolve([{ ...producto, stock: stocks[0] ?? null }]),
      ),
    },
    proveedor: {
      findUnique: jest.fn(() =>
        Promise.resolve({ id: ids.proveedor, activo: true }),
      ),
    },
    cuentaFinanciera: {
      findUnique: jest.fn(() =>
        Promise.resolve({
          id: ids.cuenta,
          activo: true,
          moneda: 'ARS',
          fechaApertura: new Date('2020-01-01'),
        }),
      ),
    },
    categoriaFlujo: {
      findUnique: jest.fn(() =>
        Promise.resolve({ id: ids.categoria, activo: true, sentido: 'EGRESO' }),
      ),
    },
    insumo: {
      findUnique: jest.fn(() => Promise.resolve(insumo)),
      findMany: jest.fn(() =>
        Promise.resolve([
          {
            ...insumo,
            producto,
            presentaciones: [{ ...presentacion, existencias }],
          },
        ]),
      ),
      create: jest.fn(({ data }: Prisma.InsumoCreateArgs) =>
        Promise.resolve({ ...data, id: siguienteId() }),
      ),
      update: jest.fn(({ data }: Prisma.InsumoUpdateArgs) =>
        Promise.resolve({ ...insumo, ...data }),
      ),
    },
    presentacionInsumo: {
      findUnique: jest.fn(() => Promise.resolve(presentacion)),
      create: jest.fn(({ data }: Prisma.PresentacionInsumoCreateArgs) =>
        Promise.resolve({ ...data, id: siguienteId() }),
      ),
    },
    existenciaInsumo: {
      findUnique: jest.fn(({ where }: Prisma.ExistenciaInsumoFindUniqueArgs) =>
        Promise.resolve(
          existencias.find(
            (e) =>
              e.presentacionId ===
                where.presentacionId_ubicacion?.presentacionId &&
              e.ubicacion === where.presentacionId_ubicacion.ubicacion,
          ) ?? null,
        ),
      ),
      findUniqueOrThrow: jest.fn(
        ({
          where,
        }: Prisma.ExistenciaInsumoFindUniqueArgs): Promise<ExistenciaInsumo> => {
          const fila = existencias.find(
            (e) =>
              e.presentacionId ===
                where.presentacionId_ubicacion?.presentacionId &&
              e.ubicacion === where.presentacionId_ubicacion.ubicacion,
          );
          if (!fila) throw new Error('Existencia no encontrada en la prueba');
          return Promise.resolve(fila);
        },
      ),
      upsert: jest.fn(
        ({
          create,
          update,
        }: {
          create: Omit<ExistenciaInsumo, 'id'>;
          update: Partial<ExistenciaInsumo>;
        }) => {
          const anterior = existencias.find(
            (e) =>
              e.presentacionId === create.presentacionId &&
              e.ubicacion === create.ubicacion,
          );
          const nuevo = anterior
            ? { ...anterior, ...update }
            : { id: siguienteId(), ...create };
          existencias = [
            ...existencias.filter((e) => e.id !== nuevo.id),
            nuevo,
          ];
          return Promise.resolve(nuevo);
        },
      ),
    },
    operacionInventario: {
      findUnique: jest.fn(
        ({ where }: Prisma.OperacionInventarioFindUniqueArgs) =>
          Promise.resolve(
            operaciones.find((o) =>
              where.id
                ? o.id === where.id
                : o.claveIdempotencia === where.claveIdempotencia,
            ) ?? null,
          ),
      ),
      findUniqueOrThrow: jest.fn(
        ({
          where,
        }: Prisma.OperacionInventarioFindUniqueArgs): Promise<OperacionInventario> => {
          const fila = operaciones.find((o) => o.id === where.id);
          if (!fila) throw new Error('Operación no encontrada en la prueba');
          return Promise.resolve(fila);
        },
      ),
      create: jest.fn(({ data }: { data: OperacionInventario }) => {
        const op = { ...data, fechaRegistro: new Date(), resultado: null };
        operaciones.push(op);
        return Promise.resolve(op);
      }),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<OperacionInventario>;
        }) => {
          operaciones = operaciones.map((o) =>
            o.id === where.id ? { ...o, ...data } : o,
          );
          return Promise.resolve(operaciones.find((o) => o.id === where.id));
        },
      ),
      findMany: jest.fn(() =>
        Promise.resolve(
          operaciones.map((o) => ({
            ...o,
            usuario: { id: ids.usuario, username: 'socio' },
            movimientosInsumos: movimientos.filter(
              (m) => m.operacionId === o.id,
            ),
            movimientosStock: terminados.filter((m) => m.operacionId === o.id),
          })),
        ),
      ),
    },
    movimientoInsumo: {
      create: jest.fn(({ data }: { data: Omit<MovimientoInsumo, 'id'> }) => {
        const m = { id: siguienteId(), ...data };
        movimientos.push(m);
        return Promise.resolve(m);
      }),
      findFirst: jest.fn(({ where }: { where: Partial<MovimientoInsumo> }) =>
        Promise.resolve(
          movimientos.find(
            (m) =>
              m.operacionId === where.operacionId &&
              m.presentacionId === where.presentacionId &&
              m.ubicacion === where.ubicacion,
          ) ?? null,
        ),
      ),
    },
    stockTerminado: {
      findUnique: jest.fn(({ where }: { where: { productoId: string } }) =>
        Promise.resolve(
          stocks.find((s) => s.productoId === where.productoId) ?? null,
        ),
      ),
      upsert: jest.fn(
        ({
          create,
        }: {
          create: StockTerminado;
          update: Partial<StockTerminado>;
        }) => {
          stocks = [
            ...stocks.filter((s) => s.productoId !== create.productoId),
            create,
          ];
          return Promise.resolve(create);
        },
      ),
    },
    movimientoStock: {
      create: jest.fn(({ data }: { data: Omit<MovimientoStock, 'id'> }) => {
        const m = { id: siguienteId(), ...data };
        terminados.push(m);
        return Promise.resolve(m);
      }),
      findFirst: jest.fn(({ where }: { where: Partial<MovimientoStock> }) =>
        Promise.resolve(
          terminados.find(
            (m) =>
              m.operacionId === where.operacionId &&
              (!where.productoId || m.productoId === where.productoId),
          ) ?? null,
        ),
      ),
    },
    compraInsumo: {
      create: jest.fn(({ data }: { data: CompraInsumo }) => {
        const c = { ...data, id: siguienteId(), pagado: new Decimal(0) };
        compras.push(c);
        return Promise.resolve(c);
      }),
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(compras.find((c) => c.id === where.id) ?? null),
      ),
      findUniqueOrThrow: jest.fn(
        ({ where }: { where: { id: string } }): Promise<CompraInsumo> => {
          const fila = compras.find((c) => c.id === where.id);
          if (!fila) throw new Error('Compra no encontrada en la prueba');
          return Promise.resolve(fila);
        },
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<CompraInsumo>;
        }) => {
          compras = compras.map((c) =>
            c.id === where.id ? { ...c, ...data } : c,
          );
          return Promise.resolve(compras.find((c) => c.id === where.id));
        },
      ),
      findMany: jest.fn(() => Promise.resolve(compras)),
    },
    pagoCompraInsumo: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: siguienteId(), ...data }),
      ),
    },
    operacionFinanciera: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: siguienteId(), ...data }),
      ),
    },
    movimientoFinanciero: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        financieros.push(data);
        return Promise.resolve(data);
      }),
    },
    loteProduccion: {
      create: jest.fn(({ data }: { data: LoteProduccion }) => {
        const l = { id: siguienteId(), ...data };
        lotes.push(l);
        return Promise.resolve(l);
      }),
      findMany: jest.fn(() => Promise.resolve(lotes)),
    },
  };
  function clienteTransaccion(): Prisma.TransactionClient {
    return prisma as unknown as Prisma.TransactionClient;
  }
  return {
    prisma,
    producto,
    insumo,
    presentacion,
    estado: () => ({
      existencias,
      stocks,
      operaciones,
      movimientos,
      terminados,
      compras,
      lotes,
      financieros,
    }),
  };
}
