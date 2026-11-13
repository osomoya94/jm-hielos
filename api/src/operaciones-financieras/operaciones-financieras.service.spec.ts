import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaClientKnownRequestError,
  Decimal,
} from '@prisma/client/runtime/client';
import type {
  CuentaFinanciera,
  CategoriaFlujo,
  OperacionFinanciera,
  MovimientoFinanciero,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OperacionesFinancierasService } from './operaciones-financieras.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('../generated/prisma/client', () => ({
  Prisma: jest.requireActual<typeof import('@prisma/client/runtime/client')>(
    '@prisma/client/runtime/client',
  ),
}));

describe('OperacionesFinancierasService', () => {
  const usuarioId = '123e4567-e89b-42d3-a456-426614174001';
  const dto = {
    claveIdempotencia: 'pago-prueba-1',
    cuentaId: '123e4567-e89b-42d3-a456-426614174002',
    categoriaId: '123e4567-e89b-42d3-a456-426614174003',
    importe: '100.20',
    fechaEfectiva: '2026-11-10T12:00:00-03:00',
    detalle: 'Pago de insumos',
  };
  const cuenta: CuentaFinanciera = {
    id: dto.cuentaId,
    nombre: 'Caja',
    tipo: 'EFECTIVO',
    moneda: 'ARS',
    titularInterno: 'JM',
    activo: true,
    fechaApertura: new Date('2026-11-01T03:00:00Z'),
    saldoInicial: new Decimal('1000'),
  };
  const categoria: CategoriaFlujo = {
    id: dto.categoriaId,
    nombre: 'Insumos',
    grupo: 'OPERACION',
    sentido: 'EGRESO',
    activo: true,
  };
  const operacion: OperacionFinanciera = {
    id: 'operacion-1',
    claveIdempotencia: dto.claveIdempotencia,
    tipo: 'PAGO',
    usuarioId,
    origenTipo: 'MANUAL',
    origenId: null,
    motivo: null,
    referencia: null,
    reversionDeId: null,
    fechaRegistro: new Date('2026-11-10T15:00:00Z'),
  };
  const movimiento: MovimientoFinanciero = {
    id: 'movimiento-1',
    cuentaId: dto.cuentaId,
    categoriaId: dto.categoriaId,
    usuarioId,
    operacionId: operacion.id,
    clase: 'FLUJO_EXTERNO',
    sentido: 'EGRESO',
    importe: new Decimal(dto.importe),
    fechaEfectiva: new Date(dto.fechaEfectiva),
    fechaRegistro: operacion.fechaRegistro,
    detalle: dto.detalle,
  };
  const prisma = {
    cuentaFinanciera: {
      findUnique: jest.fn<
        Promise<CuentaFinanciera | null>,
        [Prisma.CuentaFinancieraFindUniqueArgs]
      >(),
    },
    categoriaFlujo: {
      findUnique: jest.fn<
        Promise<CategoriaFlujo | null>,
        [Prisma.CategoriaFlujoFindUniqueArgs]
      >(),
    },
    operacionFinanciera: {
      findUnique: jest.fn<
        Promise<
          (OperacionFinanciera & { movimientos: MovimientoFinanciero[] }) | null
        >,
        [Prisma.OperacionFinancieraFindUniqueArgs]
      >(),
      create: jest.fn<
        Promise<OperacionFinanciera>,
        [Prisma.OperacionFinancieraCreateArgs]
      >(),
    },
    movimientoFinanciero: {
      create: jest.fn<
        Promise<MovimientoFinanciero>,
        [Prisma.MovimientoFinancieroCreateArgs]
      >(),
    },
    $transaction: jest.fn<
      Promise<unknown>,
      [(tx: Prisma.TransactionClient) => Promise<unknown>]
    >(),
  };
  const service = new OperacionesFinancierasService(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-11-11T15:00:00Z'));
    prisma.cuentaFinanciera.findUnique.mockResolvedValue(cuenta);
    prisma.categoriaFlujo.findUnique.mockResolvedValue(categoria);
    prisma.operacionFinanciera.findUnique.mockResolvedValue(null);
    prisma.operacionFinanciera.create.mockResolvedValue(operacion);
    prisma.movimientoFinanciero.create.mockResolvedValue(movimiento);
    prisma.$transaction.mockImplementation((callback) =>
      callback(prisma as unknown as Prisma.TransactionClient),
    );
  });
  afterEach(() => jest.useRealTimers());

  it('should be defined', () => expect(service).toBeDefined());

  it.each(['PAGO', 'COBRO'] as const)(
    'registra %s con usuario, origen y movimiento en una transacción',
    async (tipo) => {
      const sentido = tipo === 'PAGO' ? 'EGRESO' : 'INGRESO';
      prisma.categoriaFlujo.findUnique.mockResolvedValue({
        ...categoria,
        sentido,
      });
      const resultado =
        tipo === 'PAGO'
          ? await service.registrarPagoManual(dto, usuarioId)
          : await service.registrarCobroManual(dto, usuarioId);
      expect(resultado.movimiento.id).toBe(movimiento.id);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.operacionFinanciera.create).toHaveBeenCalledWith({
        data: {
          claveIdempotencia: dto.claveIdempotencia,
          tipo,
          usuarioId,
          origenTipo: 'MANUAL',
        },
      });
      expect(prisma.movimientoFinanciero.create.mock.calls[0][0]).toMatchObject(
        {
          data: {
            sentido,
            clase: 'FLUJO_EXTERNO',
            usuarioId,
            operacionId: operacion.id,
            importe: new Decimal('100.20'),
          },
        },
      );
    },
  );

  it.each(['0', '-1', '1.001', 'NaN', '10000000000000000', '1e2'])(
    'rechaza importe %s sin escribir',
    async (importe) => {
      await expect(
        service.registrarPagoManual({ ...dto, importe }, usuarioId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each([
    '2026-11-10',
    '2026-11-10T12:00:00',
    '2026-11-12T12:00:00Z',
    'invalida',
  ])('rechaza fecha %s', async (fechaEfectiva) => {
    await expect(
      service.registrarPagoManual({ ...dto, fechaEfectiva }, usuarioId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.movimientoFinanciero.create).not.toHaveBeenCalled();
  });

  it('rechaza cuenta inexistente', async () => {
    prisma.cuentaFinanciera.findUnique.mockResolvedValue(null);
    await expect(
      service.registrarPagoManual(dto, usuarioId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.operacionFinanciera.create).not.toHaveBeenCalled();
  });
  it.each([
    { activo: false },
    { moneda: 'USD' },
    { fechaApertura: new Date('2026-11-11T03:00:00Z') },
  ])('rechaza cuenta inválida %j', async (cambio) => {
    prisma.cuentaFinanciera.findUnique.mockResolvedValue({
      ...cuenta,
      ...cambio,
    });
    await expect(
      service.registrarPagoManual(dto, usuarioId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.operacionFinanciera.create).not.toHaveBeenCalled();
  });
  it('rechaza categoría inexistente', async () => {
    prisma.categoriaFlujo.findUnique.mockResolvedValue(null);
    await expect(
      service.registrarPagoManual(dto, usuarioId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it.each([{ activo: false }, { sentido: 'INGRESO' as const }])(
    'rechaza categoría inválida %j',
    async (cambio) => {
      prisma.categoriaFlujo.findUnique.mockResolvedValue({
        ...categoria,
        ...cambio,
      });
      await expect(
        service.registrarPagoManual(dto, usuarioId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.operacionFinanciera.create).not.toHaveBeenCalled();
    },
  );
  it('rechaza categoría EGRESO para un cobro', async () => {
    await expect(
      service.registrarCobroManual(dto, usuarioId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('devuelve el resultado original con importe y fecha equivalentes, sin revalidar estados ni escribir', async () => {
    prisma.operacionFinanciera.findUnique.mockResolvedValue({
      ...operacion,
      movimientos: [movimiento],
    });
    await expect(
      service.registrarPagoManual(
        { ...dto, importe: '0100.2', fechaEfectiva: '2026-11-10T15:00:00Z' },
        usuarioId,
      ),
    ).resolves.toEqual({ operacion, movimiento });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.cuentaFinanciera.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    { importe: '100.21' },
    { detalle: 'otro' },
    { cuentaId: 'otra' },
    { categoriaId: 'otra' },
    { fechaEfectiva: '2026-11-10T16:00:00Z' },
  ])('rechaza misma clave con otros datos %j', async (cambio) => {
    prisma.operacionFinanciera.findUnique.mockResolvedValue({
      ...operacion,
      movimientos: [movimiento],
    });
    await expect(
      service.registrarPagoManual({ ...dto, ...cambio }, usuarioId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('no permite reutilizar la clave desde otro usuario ni como COBRO', async () => {
    prisma.operacionFinanciera.findUnique.mockResolvedValue({
      ...operacion,
      movimientos: [movimiento],
    });
    await expect(
      service.registrarPagoManual(dto, 'otro-usuario'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.registrarCobroManual(dto, usuarioId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([false, true])(
    'recupera una colisión P2002; datos distintos=%s',
    async (distintos) => {
      prisma.operacionFinanciera.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ...operacion,
          movimientos: [
            { ...movimiento, detalle: distintos ? 'otro' : dto.detalle },
          ],
        });
      prisma.$transaction.mockRejectedValueOnce(
        new PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: '7',
        }),
      );
      const pedido = service.registrarPagoManual(dto, usuarioId);
      if (distintos)
        await expect(pedido).rejects.toBeInstanceOf(ConflictException);
      else await expect(pedido).resolves.toEqual({ operacion, movimiento });
    },
  );

  it('propaga el fallo del movimiento para que la transacción revierta también la operación', async () => {
    const error = new Error('No se pudo guardar el movimiento');
    prisma.movimientoFinanciero.create.mockRejectedValueOnce(error);
    await expect(service.registrarPagoManual(dto, usuarioId)).rejects.toBe(
      error,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
