import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePagoManualDto } from './dto/create-pago-manual.dto';
import { CreateCobroManualDto } from './dto/create-cobro-manual.dto';
import { Prisma } from '../generated/prisma/client';
import {
  TipoMovimiento,
  TipoOperacionFinanciera,
} from '../generated/prisma/enums';

type OperacionConMovimientos = Prisma.OperacionFinancieraGetPayload<{
  include: { movimientos: true };
}>;

@Injectable()
export class OperacionesFinancierasService {
  constructor(private readonly prismaService: PrismaService) {}

  registrarPagoManual(dto: CreatePagoManualDto, usuarioId: string) {
    return this.registrarManual(dto, usuarioId, 'PAGO', 'EGRESO');
  }

  registrarCobroManual(dto: CreateCobroManualDto, usuarioId: string) {
    return this.registrarManual(dto, usuarioId, 'COBRO', 'INGRESO');
  }

  private resultadoExistente(
    existente: OperacionConMovimientos,
    dto: CreatePagoManualDto,
    usuarioId: string,
    tipo: TipoOperacionFinanciera,
  ) {
    const { movimientos, ...operacion } = existente;
    const movimiento = movimientos[0];
    const coincide =
      operacion.tipo === tipo &&
      operacion.usuarioId === usuarioId &&
      movimientos.length === 1 &&
      movimiento.cuentaId === dto.cuentaId &&
      movimiento.categoriaId === dto.categoriaId &&
      movimiento.importe.equals(new Prisma.Decimal(dto.importe)) &&
      movimiento.fechaEfectiva.getTime() ===
        new Date(dto.fechaEfectiva).getTime() &&
      movimiento.detalle === dto.detalle;

    if (!coincide) {
      throw new ConflictException(
        'La clave de idempotencia ya se utilizó con otros datos',
      );
    }
    return { operacion, movimiento };
  }

  private async registrarManual(
    dto: CreatePagoManualDto,
    usuarioId: string,
    tipo: TipoOperacionFinanciera,
    sentido: TipoMovimiento,
  ) {
    // Se usan strings y Decimal para evitar redondeos de punto flotante.
    if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(dto.importe)) {
      throw new BadRequestException(
        'El importe debe ser un decimal con hasta 16 enteros y 2 decimales',
      );
    }
    const importe = new Prisma.Decimal(dto.importe);
    if (importe.lte(0))
      throw new BadRequestException('El importe debe ser mayor a cero');

    const fechaEfectiva = new Date(dto.fechaEfectiva);
    if (
      !/(?:Z|[+-]\d{2}:\d{2})$/.test(dto.fechaEfectiva) ||
      !Number.isFinite(fechaEfectiva.getTime())
    ) {
      throw new BadRequestException(
        'La fecha efectiva debe incluir hora y zona horaria explícita',
      );
    }
    if (fechaEfectiva > new Date()) {
      throw new BadRequestException('La fecha efectiva no puede ser futura');
    }

    // Reintentar sigue funcionando aunque después se desactiven cuenta o categoría.
    const existente = await this.prismaService.operacionFinanciera.findUnique({
      where: { claveIdempotencia: dto.claveIdempotencia },
      include: { movimientos: true },
    });
    if (existente)
      return this.resultadoExistente(existente, dto, usuarioId, tipo);

    try {
      return await this.prismaService.$transaction(async (tx) => {
        const cuenta = await tx.cuentaFinanciera.findUnique({
          where: { id: dto.cuentaId },
        });
        if (!cuenta)
          throw new NotFoundException('Cuenta financiera no encontrada');
        if (!cuenta.activo)
          throw new BadRequestException('La cuenta financiera está inactiva');
        if (cuenta.moneda !== 'ARS')
          throw new BadRequestException('La cuenta debe operar en ARS');
        if (fechaEfectiva < cuenta.fechaApertura) {
          throw new BadRequestException(
            'La fecha efectiva no puede ser anterior a la apertura de la cuenta',
          );
        }

        const categoria = await tx.categoriaFlujo.findUnique({
          where: { id: dto.categoriaId },
        });
        if (!categoria)
          throw new NotFoundException('Categoría de flujo no encontrada');
        if (!categoria.activo)
          throw new BadRequestException('La categoría de flujo está inactiva');
        if (categoria.sentido !== sentido) {
          throw new BadRequestException(
            'La categoría debe corresponder a un ' + sentido,
          );
        }

        const operacion = await tx.operacionFinanciera.create({
          data: {
            claveIdempotencia: dto.claveIdempotencia,
            tipo,
            origenTipo: 'MANUAL',
            usuarioId,
          },
        });
        const movimiento = await tx.movimientoFinanciero.create({
          data: {
            cuentaId: dto.cuentaId,
            categoriaId: dto.categoriaId,
            importe,
            operacionId: operacion.id,
            sentido,
            clase: 'FLUJO_EXTERNO',
            fechaEfectiva,
            detalle: dto.detalle,
            usuarioId,
          },
        });
        return { operacion, movimiento };
      });
    } catch (error) {
      // La restricción única decide entre dos peticiones concurrentes.
      // Se lee la ganadora fuera de la transacción que PostgreSQL revirtió.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const ganadora =
          await this.prismaService.operacionFinanciera.findUnique({
            where: { claveIdempotencia: dto.claveIdempotencia },
            include: { movimientos: true },
          });
        if (ganadora)
          return this.resultadoExistente(ganadora, dto, usuarioId, tipo);
      }
      throw error;
    }
  }
}
