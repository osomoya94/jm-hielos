import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConsultarCashFlowDto } from './dto/consultar-cash-flow.dto';

const ZONA_HORARIA = 'America/Argentina/Catamarca';

// El offset lo obtiene Intl de la zona de la ERS, sin depender de la zona del servidor.
function inicioDiaLocal(fecha: string) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA,
    timeZoneName: 'longOffset',
  }).formatToParts(new Date(fecha + 'T12:00:00Z'));
  const offset =
    partes
      .find((parte) => parte.type === 'timeZoneName')!
      .value.replace('GMT', '') || 'Z';
  return new Date(fecha + 'T00:00:00' + offset);
}

@Injectable()
export class CashFlowService {
  constructor(private readonly prismaService: PrismaService) {}

  async consultar(dto: ConsultarCashFlowDto) {
    const inicio = inicioDiaLocal(dto.desde);
    const diaSiguiente = new Date(dto.hasta + 'T12:00:00Z');
    diaSiguiente.setUTCDate(diaSiguiente.getUTCDate() + 1);
    const finExclusivo = inicioDiaLocal(
      diaSiguiente.toISOString().slice(0, 10),
    );
    if (dto.desde > dto.hasta) {
      throw new BadRequestException('desde debe ser anterior o igual a hasta');
    }
    const fechaEmision = new Date();

    // Resumen y detalle se calculan en la misma foto del libro.
    return this.prismaService.$transaction(
      async (tx) => {
        const cuentas = await tx.cuentaFinanciera.findMany({
          where: { ...(dto.cuentaId ? { id: dto.cuentaId } : {}) },
          orderBy: { nombre: 'asc' },
        });
        if (dto.cuentaId && cuentas.length === 0) {
          throw new NotFoundException('Cuenta financiera no encontrada');
        }
        if (cuentas.some((cuenta) => cuenta.moneda !== 'ARS')) {
          throw new BadRequestException(
            'El informe solo consolida cuentas en ARS',
          );
        }
        const cuentaIds = cuentas.map((cuenta) => cuenta.id);
        const anteriores = await tx.movimientoFinanciero.findMany({
          where: {
            cuentaId: { in: cuentaIds },
            fechaEfectiva: { lt: inicio, lte: fechaEmision },
          },
          select: { importe: true, sentido: true },
        });
        const movimientos = await tx.movimientoFinanciero.findMany({
          where: {
            cuentaId: { in: cuentaIds },
            fechaEfectiva: { gte: inicio, lt: finExclusivo, lte: fechaEmision },
          },
          include: {
            cuenta: {
              select: {
                id: true,
                nombre: true,
                tipo: true,
                activo: true,
                moneda: true,
              },
            },
            categoria: { select: { id: true, nombre: true, grupo: true } },
            usuario: { select: { id: true, username: true } },
            operacion: true,
          },
          orderBy: [{ fechaEfectiva: 'desc' }, { id: 'asc' }],
        });
        let saldoInicial = new Prisma.Decimal(0);
        let aperturasDelPeriodo = new Prisma.Decimal(0);
        for (const cuenta of cuentas) {
          if (
            cuenta.fechaApertura < inicio &&
            cuenta.fechaApertura <= fechaEmision
          ) {
            saldoInicial = saldoInicial.plus(cuenta.saldoInicial);
          } else if (
            cuenta.fechaApertura >= inicio &&
            cuenta.fechaApertura < finExclusivo &&
            cuenta.fechaApertura <= fechaEmision
          ) {
            aperturasDelPeriodo = aperturasDelPeriodo.plus(cuenta.saldoInicial);
          }
        }
        for (const movimiento of anteriores) {
          saldoInicial =
            movimiento.sentido === 'INGRESO'
              ? saldoInicial.plus(movimiento.importe)
              : saldoInicial.minus(movimiento.importe);
        }

        let totalIngresos = new Prisma.Decimal(0);
        let totalEgresos = new Prisma.Decimal(0);
        let transferenciasNetas = new Prisma.Decimal(0);
        let ajustesSinFlujo = aperturasDelPeriodo;
        for (const movimiento of movimientos) {
          const firmado =
            movimiento.sentido === 'INGRESO'
              ? movimiento.importe
              : movimiento.importe.negated();
          if (movimiento.clase === 'TRANSFERENCIA_INTERNA') {
            transferenciasNetas = transferenciasNetas.plus(firmado);
          } else if (movimiento.clase === 'AJUSTE_SIN_FLUJO') {
            ajustesSinFlujo = ajustesSinFlujo.plus(firmado);
          } else if (movimiento.operacion.tipo === 'REVERSION') {
            // La reversión resta del componente original en lugar de inflar el opuesto.
            if (movimiento.sentido === 'EGRESO')
              totalIngresos = totalIngresos.minus(movimiento.importe);
            else totalEgresos = totalEgresos.minus(movimiento.importe);
          } else if (movimiento.sentido === 'INGRESO') {
            totalIngresos = totalIngresos.plus(movimiento.importe);
          } else {
            totalEgresos = totalEgresos.plus(movimiento.importe);
          }
        }
        const flujoNeto = totalIngresos.minus(totalEgresos);
        const saldoFinalPorFlujo = saldoInicial
          .plus(flujoNeto)
          .plus(transferenciasNetas);
        const saldoFinalLibro = saldoFinalPorFlujo.plus(ajustesSinFlujo);
        const coberturaCompleta =
          cuentas.length > 0 &&
          cuentas.every((cuenta) => cuenta.fechaApertura <= inicio);

        return {
          periodo: {
            desde: dto.desde,
            hasta: dto.hasta,
            zonaHoraria: ZONA_HORARIA,
          },
          fechaEmision,
          moneda: 'ARS',
          coberturaCompleta,
          advertencia: coberturaCompleta
            ? null
            : 'El período comienza antes de la apertura de alguna cuenta o no hay cuentas. El historial no tiene cobertura completa.',
          totalIngresos: totalIngresos.toFixed(2),
          totalEgresos: totalEgresos.toFixed(2),
          flujoNeto: flujoNeto.toFixed(2),
          saldoInicial: saldoInicial.toFixed(2),
          transferenciasNetas: transferenciasNetas.toFixed(2),
          aperturasDelPeriodo: aperturasDelPeriodo.toFixed(2),
          ajustesSinFlujo: ajustesSinFlujo.toFixed(2),
          saldoFinalPorFlujo: saldoFinalPorFlujo.toFixed(2),
          saldoFinalLibro: saldoFinalLibro.toFixed(2),
          cuentas: cuentas.map(({ id, nombre, tipo, activo }) => ({
            id,
            nombre,
            tipo,
            activo,
          })),
          movimientos: movimientos.filter(
            (movimiento) => movimiento.clase === 'FLUJO_EXTERNO',
          ),
          transferencias: movimientos.filter(
            (movimiento) => movimiento.clase === 'TRANSFERENCIA_INTERNA',
          ),
          ajustes: movimientos.filter(
            (movimiento) => movimiento.clase === 'AJUSTE_SIN_FLUJO',
          ),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
