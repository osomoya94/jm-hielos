import { Decimal } from '@prisma/client/runtime/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { CuentaFinanciera, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CashFlowService } from './cash-flow.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('../generated/prisma/client', () => ({
  Prisma: {
    ...jest.requireActual<typeof import('@prisma/client/runtime/client')>(
      '@prisma/client/runtime/client',
    ),
    TransactionIsolationLevel: { RepeatableRead: 'RepeatableRead' },
  },
}));

type MovimientoInforme = Prisma.MovimientoFinancieroGetPayload<{
  include: { cuenta: true; categoria: true; usuario: true; operacion: true };
}>;

describe('CashFlowService', () => {
  const cuenta: CuentaFinanciera = {
    id: 'cuenta-1',
    nombre: 'Caja',
    tipo: 'EFECTIVO',
    moneda: 'ARS',
    titularInterno: 'JM',
    activo: false,
    fechaApertura: new Date('2026-11-01T03:00:00Z'),
    saldoInicial: new Decimal('1000'),
  };
  function movimiento(
    importe: string,
    sentido: 'INGRESO' | 'EGRESO',
    clase: 'FLUJO_EXTERNO' | 'TRANSFERENCIA_INTERNA' | 'AJUSTE_SIN_FLUJO',
    tipo = 'COBRO',
  ) {
    return {
      importe: new Decimal(importe),
      sentido,
      clase,
      operacion: { tipo },
    } as MovimientoInforme;
  }
  const prisma = {
    cuentaFinanciera: {
      findMany: jest.fn<
        Promise<CuentaFinanciera[]>,
        [Prisma.CuentaFinancieraFindManyArgs]
      >(),
    },
    movimientoFinanciero: {
      findMany: jest.fn<
        Promise<MovimientoInforme[]>,
        [Prisma.MovimientoFinancieroFindManyArgs]
      >(),
    },
    $transaction: jest.fn<
      Promise<unknown>,
      [(tx: Prisma.TransactionClient) => Promise<unknown>, unknown]
    >(),
  };
  const service = new CashFlowService(prisma as unknown as PrismaService);
  const dto = { desde: '2026-11-10', hasta: '2026-11-11' };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-11-11T18:00:00Z'));
    prisma.cuentaFinanciera.findMany.mockResolvedValue([cuenta]);
    prisma.movimientoFinanciero.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation((callback) =>
      callback(prisma as unknown as Prisma.TransactionClient),
    );
  });
  afterEach(() => jest.useRealTimers());

  it('calcula flujo externo exacto y separa apertura, transferencias y ajustes', async () => {
    prisma.movimientoFinanciero.findMany
      .mockResolvedValueOnce([movimiento('10.10', 'INGRESO', 'FLUJO_EXTERNO')])
      .mockResolvedValueOnce([
        movimiento('0.10', 'INGRESO', 'FLUJO_EXTERNO'),
        movimiento('0.20', 'INGRESO', 'FLUJO_EXTERNO'),
        movimiento('0.05', 'EGRESO', 'FLUJO_EXTERNO', 'PAGO'),
        movimiento('500', 'EGRESO', 'TRANSFERENCIA_INTERNA'),
        movimiento('500', 'INGRESO', 'TRANSFERENCIA_INTERNA'),
        movimiento('5', 'INGRESO', 'AJUSTE_SIN_FLUJO'),
      ]);
    const resultado = await service.consultar(dto);
    expect(resultado).toMatchObject({
      totalIngresos: '0.30',
      totalEgresos: '0.05',
      flujoNeto: '0.25',
      saldoInicial: '1010.10',
      transferenciasNetas: '0.00',
      ajustesSinFlujo: '5.00',
      saldoFinalPorFlujo: '1010.35',
      saldoFinalLibro: '1015.35',
      coberturaCompleta: true,
    });
    expect(resultado.movimientos).toHaveLength(3);
    expect(resultado.transferencias).toHaveLength(2);
    // No se filtran las cuentas inactivas con historial.
    expect(prisma.cuentaFinanciera.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { nombre: 'asc' },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    });
  });

  it('usa rango inclusivo argentino y excluye fechas futuras en las consultas', async () => {
    await service.consultar(dto);
    expect(prisma.movimientoFinanciero.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          cuentaId: { in: [cuenta.id] },
          fechaEfectiva: {
            gte: new Date('2026-11-10T03:00:00Z'),
            lt: new Date('2026-11-12T03:00:00Z'),
            lte: new Date('2026-11-11T18:00:00Z'),
          },
        },
      }),
    );
  });

  it('muestra cero flujo sin movimientos y conserva el saldo', async () => {
    const resultado = await service.consultar(dto);
    expect(resultado).toMatchObject({
      totalIngresos: '0.00',
      totalEgresos: '0.00',
      flujoNeto: '0.00',
      saldoInicial: '1000.00',
      saldoFinalLibro: '1000.00',
      movimientos: [],
    });
  });

  it('incorpora una apertura del período como ajuste sin flujo y advierte cobertura incompleta', async () => {
    prisma.cuentaFinanciera.findMany.mockResolvedValue([
      { ...cuenta, fechaApertura: new Date('2026-11-10T15:00:00Z') },
    ]);
    const resultado = await service.consultar(dto);
    expect(resultado).toMatchObject({
      saldoInicial: '0.00',
      totalIngresos: '0.00',
      aperturasDelPeriodo: '1000.00',
      ajustesSinFlujo: '1000.00',
      saldoFinalLibro: '1000.00',
      coberturaCompleta: false,
    });
  });

  it('no agrega aperturas futuras al saldo', async () => {
    prisma.cuentaFinanciera.findMany.mockResolvedValue([
      { ...cuenta, fechaApertura: new Date('2026-12-01T03:00:00Z') },
    ]);
    expect(
      await service.consultar({ desde: '2026-11-01', hasta: '2026-12-31' }),
    ).toMatchObject({
      saldoInicial: '0.00',
      aperturasDelPeriodo: '0.00',
      saldoFinalLibro: '0.00',
    });
  });

  it('separa la transferencia que cruza una selección de cuenta', async () => {
    prisma.movimientoFinanciero.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        movimiento('100', 'EGRESO', 'TRANSFERENCIA_INTERNA'),
      ]);
    expect(
      await service.consultar({ ...dto, cuentaId: cuenta.id }),
    ).toMatchObject({
      flujoNeto: '0.00',
      transferenciasNetas: '-100.00',
      saldoFinalLibro: '900.00',
    });
  });

  it('resta las reversiones en su componente original y conserva el flujo neto', async () => {
    prisma.movimientoFinanciero.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        movimiento('100', 'INGRESO', 'FLUJO_EXTERNO'),
        movimiento('100', 'EGRESO', 'FLUJO_EXTERNO', 'REVERSION'),
        movimiento('30', 'EGRESO', 'FLUJO_EXTERNO', 'PAGO'),
        movimiento('30', 'INGRESO', 'FLUJO_EXTERNO', 'REVERSION'),
      ]);
    expect(await service.consultar(dto)).toMatchObject({
      totalIngresos: '0.00',
      totalEgresos: '0.00',
      flujoNeto: '0.00',
    });
  });

  it('rechaza rango invertido sin consultar el libro', async () => {
    await expect(
      service.consultar({ desde: '2026-11-11', hasta: '2026-11-10' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('distingue ausencia de cuentas de período cubierto', async () => {
    prisma.cuentaFinanciera.findMany.mockResolvedValue([]);
    expect(await service.consultar(dto)).toMatchObject({
      coberturaCompleta: false,
      movimientos: [],
    });
    await expect(
      service.consultar({ ...dto, cuentaId: 'inexistente' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('rechaza consolidar monedas diferentes', async () => {
    prisma.cuentaFinanciera.findMany.mockResolvedValue([
      { ...cuenta, moneda: 'USD' },
    ]);
    await expect(service.consultar(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
