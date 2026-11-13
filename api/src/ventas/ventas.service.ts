import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { esConflictoTransaccion } from '../prisma/conflicto-transaccion';
import { InventarioService } from '../inventario/inventario.service';
import { PreciosService } from '../precios/precios.service';
import {
  AnularVentaDto,
  CobrarVentaDto,
  CobroDto,
  ConfirmarVentaDto,
  ParticipantesVentaDto,
} from './dto/ventas.dto';

type Tx = Prisma.TransactionClient;
const publico = { id: true, username: true, rol: true } as const;
const incluirVenta = {
  cliente: true,
  detalles: true,
  participantes: { include: { usuario: { select: publico } } },
  responsableCobranza: { select: publico },
  cobros: {
    include: {
      operacionFinanciera: {
        include: {
          movimientos: { include: { cuenta: true, categoria: true } },
        },
      },
    },
  },
} satisfies Prisma.VentaInclude;
type VentaConSaldo = Prisma.VentaGetPayload<{
  include: typeof incluirVenta;
}> & {
  cobrado: Prisma.Decimal;
  saldo: Prisma.Decimal;
  creditoPorAnulacion: Prisma.Decimal;
  estadoDeuda: string;
};
function ordenar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenar);
  if (valor && typeof valor === 'object')
    return Object.fromEntries(
      Object.entries(valor)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, ordenar(v)]),
    );
  return valor;
}
@Injectable()
export class VentasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventario: InventarioService,
    private readonly precios: PreciosService,
  ) {}

  async disponibilidad() {
    const tablas = await this.prisma.$queryRaw<
      { disponible: boolean }[]
    >`SELECT to_regclass('public."Venta"') IS NOT NULL AND to_regclass('public."ListaPrecio"') IS NOT NULL AS disponible`;
    return { disponible: tablas[0].disponible };
  }
  private fecha(valor: string) {
    const fecha = new Date(valor);
    if (
      !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(valor) ||
      !Number.isFinite(fecha.getTime()) ||
      fecha > new Date()
    )
      throw new BadRequestException(
        'La fecha debe incluir zona horaria y no ser futura',
      );
    return fecha;
  }
  private async participantes(
    tx: Tx,
    dto: ParticipantesVentaDto,
    tarea: string,
  ) {
    const ids = [dto.responsableId, ...(dto.ayudantesIds ?? [])];
    if (ids.length > 3 || new Set(ids).size !== ids.length)
      throw new BadRequestException(
        'El responsable y hasta dos ayudantes deben ser diferentes',
      );
    const personas = await tx.usuario.count({
      where: { id: { in: ids }, activo: true },
    });
    if (personas !== ids.length)
      throw new BadRequestException(
        'Los participantes deben ser usuarios activos',
      );
    return ids.map((usuarioId, i) => ({
      usuarioId,
      tarea,
      responsable: i === 0,
    }));
  }
  private async ejecutar(
    tipo: string,
    dto: { claveIdempotencia: string },
    usuarioId: string,
    origenId: string | undefined,
    trabajo: (tx: Tx, op: string) => Promise<unknown>,
  ) {
    const huella = createHash('sha256')
      .update(JSON.stringify(ordenar({ tipo, dto, usuarioId, origenId })))
      .digest('hex');
    const repetida = async () => {
      const op = await this.prisma.operacionComercial.findUnique({
        where: { claveIdempotencia: dto.claveIdempotencia },
      });
      if (!op) return undefined;
      if (op.huella !== huella)
        throw new ConflictException(
          'La clave de idempotencia ya se utilizó con otros datos',
        );
      return op.resultado;
    };
    const anterior = await repetida();
    if (anterior !== undefined) return anterior;
    for (let intento = 0; intento < 3; intento++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const op = await tx.operacionComercial.create({
              data: {
                tipo,
                huella,
                usuarioId,
                claveIdempotencia: dto.claveIdempotencia,
              },
            });
            const datos = await trabajo(tx, op.id);
            const resultado = JSON.parse(
              JSON.stringify({ operacionId: op.id, datos }),
            ) as Prisma.InputJsonObject;
            await tx.operacionComercial.update({
              where: { id: op.id },
              data: { resultado },
            });
            return resultado;
          },
          { isolationLevel: 'Serializable' },
        );
      } catch (error) {
        if (esConflictoTransaccion(error)) {
          if (intento < 2) continue;
          throw new ConflictException(
            'Otra operación cambió los datos. Reintentá conservando la misma clave',
          );
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2002') {
            const ganadora = await repetida();
            if (ganadora !== undefined) return ganadora;
            throw new ConflictException('La operación ya fue confirmada');
          }
        }
        throw error;
      }
    }
    throw new ConflictException('No se pudo confirmar la operación');
  }
  private async verVenta(tx: Tx, id: string) {
    const venta = await tx.venta.findUnique({
      where: { id },
      include: incluirVenta,
    });
    if (!venta) throw new NotFoundException('Venta no encontrada');
    const cobrado = venta.cobros.reduce(
      (suma, cobro) => suma.plus(cobro.importe),
      new Prisma.Decimal(0),
    );
    return {
      ...venta,
      cobrado,
      saldo:
        venta.estado === 'ANULADA'
          ? new Prisma.Decimal(0)
          : venta.total.minus(cobrado),
      creditoPorAnulacion:
        venta.estado === 'ANULADA' ? cobrado : new Prisma.Decimal(0),
      estadoDeuda:
        venta.estado === 'ANULADA'
          ? 'ANULADA'
          : cobrado.equals(venta.total)
            ? 'SALDADA'
            : cobrado.isZero()
              ? 'PENDIENTE'
              : 'PARCIAL',
    };
  }
  private async cobrar(
    tx: Tx,
    ventaId: string,
    operacionId: string,
    dto: CobroDto,
    usuarioId: string,
    motivo: string,
  ) {
    const venta = await this.verVenta(tx, ventaId);
    if (venta.estado !== 'CONFIRMADA')
      throw new BadRequestException('No se puede cobrar una venta anulada');
    const fechaEfectiva = this.fecha(dto.fechaEfectiva);
    const total = dto.pagos.reduce(
      (suma, pago) => suma.plus(pago.importe),
      new Prisma.Decimal(0),
    );
    if (total.lte(0) || total.gt(venta.saldo))
      throw new BadRequestException(
        'El cobro debe ser positivo y no superar el saldo pendiente',
      );
    if (new Set(dto.pagos.map((p) => p.cuentaId)).size !== dto.pagos.length)
      throw new BadRequestException(
        'Cada cuenta debe aparecer una sola vez en el cobro',
      );
    const financiera = await tx.operacionFinanciera.create({
      data: {
        claveIdempotencia: 'cobro-venta:' + operacionId,
        tipo: 'COBRO',
        usuarioId,
        origenTipo: 'VENTA',
        origenId: ventaId,
        motivo,
      },
    });
    for (const pago of dto.pagos) {
      if (new Prisma.Decimal(pago.importe).lte(0))
        throw new BadRequestException('Cada importe debe ser positivo');
      const cuenta = await tx.cuentaFinanciera.findUnique({
        where: { id: pago.cuentaId },
      });
      const categoria = await tx.categoriaFlujo.findUnique({
        where: { id: pago.categoriaId },
      });
      if (
        !cuenta?.activo ||
        cuenta.moneda !== 'ARS' ||
        cuenta.fechaApertura > fechaEfectiva
      )
        throw new BadRequestException(
          'La cuenta debe estar activa, en ARS y abierta en la fecha del cobro',
        );
      if (!categoria?.activo || categoria.sentido !== 'INGRESO')
        throw new BadRequestException(
          'La categoría debe ser un ingreso activo',
        );
      await tx.movimientoFinanciero.create({
        data: {
          operacionId: financiera.id,
          cuentaId: cuenta.id,
          categoriaId: categoria.id,
          usuarioId,
          sentido: 'INGRESO',
          clase: 'FLUJO_EXTERNO',
          importe: pago.importe,
          fechaEfectiva,
          detalle: motivo,
        },
      });
    }
    return tx.cobroVenta.create({
      data: {
        ventaId,
        operacionId,
        operacionFinancieraId: financiera.id,
        importe: total,
      },
    });
  }
  confirmar(dto: ConfirmarVentaDto, usuarioId: string) {
    return this.ejecutar('VENTA', dto, usuarioId, undefined, async (tx, op) => {
      const fechaPedido = this.fecha(dto.fechaPedido),
        fechaEntrega = this.fecha(dto.fechaEntrega);
      if (fechaEntrega < fechaPedido)
        throw new BadRequestException(
          'La entrega no puede ser anterior al pedido',
        );
      const seguimiento = await tx.usuario.findUnique({
        where: { id: dto.responsableCobranzaId },
        select: { activo: true },
      });
      if (!seguimiento?.activo)
        throw new BadRequestException(
          'El responsable de seguimiento debe estar activo',
        );
      const participantes = [
        ...(await this.participantes(tx, dto.preparacion, 'PREPARACION')),
        ...(await this.participantes(tx, dto.entrega, 'ENTREGA')),
      ];
      const detalles: Prisma.DetalleVentaCreateWithoutVentaInput[] = [];
      let total = new Prisma.Decimal(dto.envio);
      if (total.lt(0))
        throw new BadRequestException('El envío no puede ser negativo');
      for (const linea of dto.detalles) {
        const precio = await this.precios.precioParaVenta(
          tx,
          dto.clienteId,
          linea.productoId,
        );
        if (!precio.precio.equals(linea.precioEsperado))
          throw new ConflictException(
            'Cambió el precio de ' +
              precio.producto.nombre +
              '. Revisá el resumen antes de confirmar',
          );
        total = total.plus(precio.precio.mul(linea.cantidad));
        detalles.push({
          producto: { connect: { id: linea.productoId } },
          nombreProducto: precio.producto.nombre,
          pesoKg: precio.producto.pesoKg,
          cantidad: linea.cantidad,
          precioUnitario: precio.precio,
          origenPrecio: precio.origen,
        });
      }
      if (total.lte(0) || total.gt('999999999999.99'))
        throw new BadRequestException(
          'El total está fuera del rango permitido',
        );
      const venta = await tx.venta.create({
        data: {
          operacionId: op,
          clienteId: dto.clienteId,
          fechaPedido,
          fechaEntrega,
          envio: dto.envio,
          total,
          responsableCobranzaId: dto.responsableCobranzaId,
          detalles: { create: detalles },
          participantes: { create: participantes },
        },
      });
      const inventario = await tx.operacionInventario.create({
        data: {
          claveIdempotencia: 'venta:' + op,
          huella: op,
          tipo: 'VENTA',
          fechaEfectiva: fechaEntrega,
          motivo: dto.motivo,
          origenTipo: 'VENTA',
          origenId: venta.id,
          usuarioId,
        },
      });
      await this.inventario.descontarVentaEnTransaccion(
        tx,
        venta.id,
        inventario.id,
        dto.detalles,
      );
      if (dto.cobro)
        await this.cobrar(tx, venta.id, op, dto.cobro, usuarioId, dto.motivo);
      await tx.auditoriaComercial.create({
        data: {
          usuarioId,
          entidad: 'VENTA',
          entidadId: venta.id,
          accion: 'CONFIRMAR',
          motivo: dto.motivo,
          posterior: { operacionId: op, total: total.toFixed(2) },
        },
      });
      return this.verVenta(tx, venta.id);
    });
  }
  cobrarVenta(id: string, dto: CobrarVentaDto, usuarioId: string) {
    return this.ejecutar('COBRO_VENTA', dto, usuarioId, id, async (tx, op) => {
      await this.cobrar(tx, id, op, dto, usuarioId, dto.motivo);
      await tx.auditoriaComercial.create({
        data: {
          usuarioId,
          entidad: 'VENTA',
          entidadId: id,
          accion: 'COBRAR',
          motivo: dto.motivo,
          posterior: { operacionId: op },
        },
      });
      return this.verVenta(tx, id);
    });
  }
  anular(id: string, dto: AnularVentaDto, usuarioId: string) {
    return this.ejecutar(
      'ANULACION_VENTA',
      dto,
      usuarioId,
      id,
      async (tx, op) => {
        const venta = await this.verVenta(tx, id);
        const fechaEfectiva = this.fecha(dto.fechaEfectiva);
        if (venta.estado === 'ANULADA')
          throw new ConflictException('La venta ya está anulada');
        if (fechaEfectiva < venta.fechaEntrega)
          throw new BadRequestException(
            'La devolución no puede ser anterior a la entrega',
          );
        if (dto.devoluciones.length) {
          const inv = await tx.operacionInventario.create({
            data: {
              claveIdempotencia: 'anulacion:' + op,
              huella: op,
              tipo: 'DEVOLUCION',
              fechaEfectiva,
              motivo: dto.motivo,
              origenTipo: 'ANULACION_VENTA',
              origenId: id,
              usuarioId,
            },
          });
          for (const retorno of dto.devoluciones) {
            const linea = venta.detalles.find(
              (l) => l.productoId === retorno.productoId,
            );
            if (!linea || retorno.cantidad > linea.cantidad)
              throw new BadRequestException(
                'La devolución apta no puede superar lo vendido de cada producto',
              );
            await this.inventario.moverTerminado(
              tx,
              inv.id,
              retorno.productoId,
              retorno.cantidad,
            );
          }
        }
        await tx.venta.update({ where: { id }, data: { estado: 'ANULADA' } });
        await tx.auditoriaComercial.create({
          data: {
            usuarioId,
            entidad: 'VENTA',
            entidadId: id,
            accion: 'ANULAR',
            motivo: dto.motivo,
            anterior: { estado: venta.estado },
            posterior: {
              estado: 'ANULADA',
              operacionId: op,
              devoluciones: JSON.parse(
                JSON.stringify(dto.devoluciones),
              ) as Prisma.InputJsonValue,
            },
          },
        });
        // No se modifica dinero: lo cobrado queda identificado como crédito a devolver.
        return this.verVenta(tx, id);
      },
    );
  }
  async listar(clienteId?: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const lista = await tx.venta.findMany({
          where: clienteId ? { clienteId } : {},
          select: { id: true },
          orderBy: [{ fechaEntrega: 'desc' }, { id: 'desc' }],
        });
        const ventas: VentaConSaldo[] = [];
        for (const venta of lista)
          ventas.push(await this.verVenta(tx, venta.id));
        return ventas;
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  consultar(id: string) {
    return this.prisma.$transaction((tx) => this.verVenta(tx, id), {
      isolationLevel: 'RepeatableRead',
    });
  }
  async estadoCuenta(clienteId: string) {
    const ventas = await this.listar(clienteId);
    const deuda = ventas.reduce(
      (suma, v) => suma.plus(v.saldo),
      new Prisma.Decimal(0),
    );
    const fechaCorte = new Date();
    const formato = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Argentina/Catamarca',
      dateStyle: 'short',
    });
    const corteLocal = Date.parse(formato.format(fechaCorte) + 'T00:00:00Z');
    return {
      clienteId,
      fechaCorte,
      deuda,
      ventas: ventas.map((v) => ({
        ...v,
        antiguedadDias: Math.max(
          0,
          Math.floor(
            (corteLocal -
              Date.parse(formato.format(v.fechaEntrega) + 'T00:00:00Z')) /
              86400000,
          ),
        ),
      })),
    };
  }
}
