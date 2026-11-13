import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import type {
  TipoOperacionInventario,
  UbicacionInsumo,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { esConflictoTransaccion } from '../prisma/conflicto-transaccion';
import {
  AccionInsumo,
  AccionStock,
  CompraInsumoDto,
  CrearInsumoDto,
  EditarInsumoDto,
  LoteDto,
  MovimientoInsumoDto,
  MovimientoStockDto,
  OperacionInventarioDto,
  PagoCompraDto,
  PagoDto,
  PresentacionDto,
  TrasladoDto,
} from './dto/inventario.dto';

type Tx = Prisma.TransactionClient;
type Presentacion = Prisma.PresentacionInsumoGetPayload<{
  include: { insumo: true };
}>;
const decimal = (valor: string | number | Prisma.Decimal) =>
  new Prisma.Decimal(valor);
const publico = { id: true, username: true, rol: true } as const;

// Ordena las claves para que el orden de las propiedades JSON no cambie la huella.
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
export class InventarioService {
  constructor(private readonly prisma: PrismaService) {}

  private fecha(valor: string) {
    const fecha = new Date(valor);
    if (
      !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(valor) ||
      !Number.isFinite(fecha.getTime()) ||
      fecha > new Date()
    )
      throw new BadRequestException(
        'La fecha debe incluir zona horaria y no puede ser futura',
      );
    return fecha;
  }

  private async presentacion(tx: Tx, id: string) {
    const p = await tx.presentacionInsumo.findUnique({
      where: { id },
      include: { insumo: true },
    });
    if (!p) throw new NotFoundException('Presentación no encontrada');
    if (!p.activo || !p.insumo.activo)
      throw new BadRequestException(
        'El insumo o la presentación están inactivos',
      );
    return p;
  }

  private async producto(tx: Tx, id: string) {
    const p = await tx.producto.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    if (!p.activo) throw new BadRequestException('El producto está inactivo');
    return p;
  }

  private async participantes(
    tx: Tx,
    responsableId?: string,
    ayudantesIds: string[] = [],
  ) {
    if (!responsableId)
      throw new BadRequestException('Se requiere un responsable principal');
    const ids = [responsableId, ...ayudantesIds];
    if (ayudantesIds.length > 2 || new Set(ids).size !== ids.length)
      throw new BadRequestException(
        'El responsable y hasta dos ayudantes deben ser diferentes',
      );
    const usuarios = await tx.usuario.findMany({
      where: { id: { in: ids }, activo: true },
      select: publico,
    });
    if (usuarios.length !== ids.length)
      throw new BadRequestException(
        'Los participantes deben ser usuarios activos',
      );
    return {
      responsable: usuarios.find((u) => u.id === responsableId),
      ayudantes: ayudantesIds.map((id) => usuarios.find((u) => u.id === id)),
    };
  }

  // Todas las existencias se escriben aquí, dentro de transacciones serializables.
  // El valor que sale es proporcional al costo promedio de la ubicación de origen.
  private async moverInsumo(
    tx: Tx,
    operacionId: string,
    p: Presentacion,
    ubicacion: UbicacionInsumo,
    cambio: Prisma.Decimal,
    detalle: string,
    valorEntrada?: Prisma.Decimal,
  ) {
    if (p.insumo.tipo === 'BOLSA' && !cambio.isInteger())
      throw new BadRequestException(
        'Las bolsas se registran en unidades enteras',
      );
    if (ubicacion === 'DEPOSITO' && !cambio.mod(p.factor).isZero())
      throw new BadRequestException(
        'En depósito solo se admiten presentaciones completas',
      );
    const where = {
      presentacionId_ubicacion: { presentacionId: p.id, ubicacion },
    };
    const anterior = await tx.existenciaInsumo.findUnique({ where });
    const unidades = anterior?.unidades ?? decimal(0);
    const valor = anterior?.valor ?? decimal(0);
    const saldo = unidades.plus(cambio);
    if (saldo.lt(0))
      throw new ConflictException(
        'Stock de insumos insuficiente en ' + ubicacion.toLowerCase(),
      );
    if (saldo.gt('999999999999.999'))
      throw new BadRequestException('La existencia excede el límite permitido');
    let costo = decimal(0);
    if (cambio.lt(0))
      costo = cambio.negated().equals(unidades)
        ? valor.negated()
        : valor.mul(cambio).div(unidades).toDecimalPlaces(6);
    else if (cambio.gt(0)) {
      if (valorEntrada === undefined)
        throw new BadRequestException('Indicá el costo del ingreso de insumos');
      costo = valorEntrada.toDecimalPlaces(6);
      if (costo.lt(0))
        throw new BadRequestException('El costo no puede ser negativo');
    }
    const valorPosterior = valor.plus(costo);
    if (valorPosterior.gt('999999999999999999.999999')) {
      throw new BadRequestException(
        'El valor del inventario excede el límite permitido',
      );
    }
    await tx.existenciaInsumo.upsert({
      where,
      create: {
        presentacionId: p.id,
        ubicacion,
        unidades: saldo,
        valor: valorPosterior,
      },
      update: { unidades: saldo, valor: valorPosterior },
    });
    return tx.movimientoInsumo.create({
      data: {
        operacionId,
        presentacionId: p.id,
        ubicacion,
        unidades: cambio,
        valor: costo,
        saldoPosterior: saldo,
        detalle,
      },
    });
  }

  async moverTerminado(
    tx: Tx,
    operacionId: string,
    productoId: string,
    cantidad: number,
  ) {
    const anterior = await tx.stockTerminado.findUnique({
      where: { productoId },
    });
    const saldoAnterior = anterior?.cantidad ?? 0;
    const saldoPosterior = saldoAnterior + cantidad;
    if (!Number.isSafeInteger(cantidad) || saldoPosterior < 0)
      throw new ConflictException('Stock terminado insuficiente');
    if (saldoPosterior > 2147483647)
      throw new BadRequestException(
        'El stock terminado excede el límite permitido',
      );
    await tx.stockTerminado.upsert({
      where: { productoId },
      create: { productoId, cantidad: saldoPosterior },
      update: { cantidad: saldoPosterior },
    });
    return tx.movimientoStock.create({
      data: {
        operacionId,
        productoId,
        cantidad,
        saldoAnterior,
        saldoPosterior,
      },
    });
  }

  private async ejecutar(
    tipo: TipoOperacionInventario,
    dto: OperacionInventarioDto,
    usuarioId: string,
    trabajo: (tx: Tx, id: string) => Promise<unknown>,
    origen?: { tipo: string; id: string },
    corrigeOperacionId?: string,
  ) {
    const fechaEfectiva = this.fecha(dto.fechaEfectiva);
    const huella = createHash('sha256')
      .update(
        JSON.stringify(
          ordenar({ tipo, usuarioId, dto, origen, corrigeOperacionId }),
        ),
      )
      .digest('hex');
    const repetida = async () => {
      const op = await this.prisma.operacionInventario.findUnique({
        where: { claveIdempotencia: dto.claveIdempotencia },
      });
      if (!op) return undefined;
      if (op.huella !== huella)
        throw new ConflictException(
          'La clave de idempotencia ya se utilizó con otros datos',
        );
      return op.resultado;
    };
    const existente = await repetida();
    if (existente !== undefined) return existente;
    for (let intento = 0; intento < 3; intento++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const id = randomUUID();
            if (
              corrigeOperacionId &&
              !(await tx.operacionInventario.findUnique({
                where: { id: corrigeOperacionId },
              }))
            )
              throw new NotFoundException('Operación a corregir no encontrada');
            await tx.operacionInventario.create({
              data: {
                id,
                tipo,
                huella,
                claveIdempotencia: dto.claveIdempotencia,
                usuarioId,
                fechaEfectiva,
                motivo: dto.motivo,
                origenTipo: origen?.tipo ?? tipo,
                origenId: origen?.id ?? id,
                corrigeOperacionId,
              },
            });
            const datos = await trabajo(tx, id);
            // JSON conserva exactamente la respuesta del primer envío, incluyendo sobrantes.
            const resultado = JSON.parse(
              JSON.stringify({ operacionId: id, datos }),
            ) as Prisma.InputJsonObject;
            await tx.operacionInventario.update({
              where: { id },
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
            'Otra operación cambió el stock. Reintentá con la misma clave',
          );
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2002') {
            const ganadora = await repetida();
            if (ganadora !== undefined) return ganadora;
            throw new ConflictException(
              'Ya existe el comprobante, código de lote u origen de esta operación',
            );
          }
        }
        throw error;
      }
    }
    throw new ConflictException('No se pudo confirmar la operación');
  }

  async crearInsumo(dto: CrearInsumoDto) {
    if (dto.tipo === 'BOLSA' && !dto.productoId)
      throw new BadRequestException(
        'La bolsa vacía debe estar vinculada a un producto',
      );
    if (dto.tipo === 'OTRO' && dto.productoId)
      throw new BadRequestException(
        'Solo las bolsas vacías se vinculan a un producto',
      );
    const factor = decimal(
      dto.presentacion.factor ?? (dto.tipo === 'BOLSA' ? '100' : '1'),
    );
    this.validarFactor(factor, dto.tipo);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const p = dto.productoId
            ? await this.producto(tx, dto.productoId)
            : null;
          const umbral = p
            ? ({ 1: 300, 3: 300, 5: 200, 10: 100 }[p.pesoKg] ?? 0)
            : 0;
          const stockMinimo = decimal(dto.stockMinimo ?? umbral);
          if (dto.tipo === 'BOLSA' && !stockMinimo.isInteger())
            throw new BadRequestException(
              'El mínimo de bolsas debe ser entero',
            );
          return tx.insumo.create({
            data: {
              nombre: dto.nombre,
              tipo: dto.tipo,
              unidad: dto.unidad,
              productoId: dto.productoId,
              stockMinimo,
              presentaciones: {
                create: { nombre: dto.presentacion.nombre, factor },
              },
            },
            include: { presentaciones: true },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      this.conflictoCatalogo(error);
    }
  }

  private validarFactor(factor: Prisma.Decimal, tipo: string) {
    if (factor.lte(0) || (tipo === 'BOLSA' && !factor.isInteger()))
      throw new BadRequestException(
        'El factor debe ser positivo y entero para bolsas',
      );
  }

  private conflictoCatalogo(error: unknown): never {
    if (esConflictoTransaccion(error)) {
      throw new ConflictException(
        'El catálogo cambió durante la operación. Reintentá con los mismos datos',
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new ConflictException(
        'Ya existe un insumo o presentación con ese nombre',
      );
    throw error;
  }

  async editarInsumo(id: string, dto: EditarInsumoDto) {
    const insumo = await this.prisma.insumo.findUnique({ where: { id } });
    if (!insumo) throw new NotFoundException('Insumo no encontrado');
    if (!Object.keys(dto).length)
      throw new BadRequestException('Indicá al menos un cambio');
    if (
      dto.stockMinimo !== undefined &&
      insumo.tipo === 'BOLSA' &&
      !decimal(dto.stockMinimo).isInteger()
    )
      throw new BadRequestException('El mínimo de bolsas debe ser entero');
    try {
      return await this.prisma.insumo.update({ where: { id }, data: dto });
    } catch (error) {
      this.conflictoCatalogo(error);
    }
  }

  async agregarPresentacion(id: string, dto: PresentacionDto) {
    const insumo = await this.prisma.insumo.findUnique({ where: { id } });
    if (!insumo) throw new NotFoundException('Insumo no encontrado');
    if (!insumo.activo)
      throw new BadRequestException('El insumo está inactivo');
    const factor = decimal(
      dto.factor ?? (insumo.tipo === 'BOLSA' ? '100' : '1'),
    );
    this.validarFactor(factor, insumo.tipo);
    // Cambiar el envase crea una presentación: los paquetes anteriores conservan su factor.
    try {
      return await this.prisma.presentacionInsumo.create({
        data: { insumoId: id, nombre: dto.nombre, factor },
      });
    } catch (error) {
      this.conflictoCatalogo(error);
    }
  }

  async listarInsumos() {
    const insumos = await this.prisma.insumo.findMany({
      include: {
        producto: true,
        presentaciones: {
          include: { existencias: true },
          orderBy: { nombre: 'asc' },
        },
      },
      orderBy: { nombre: 'asc' },
    });
    return insumos.map((i) => {
      let deposito = decimal(0),
        produccion = decimal(0),
        valor = decimal(0);
      for (const p of i.presentaciones)
        for (const e of p.existencias) {
          if (e.ubicacion === 'DEPOSITO') deposito = deposito.plus(e.unidades);
          else produccion = produccion.plus(e.unidades);
          valor = valor.plus(e.valor);
        }
      const total = deposito.plus(produccion);
      return {
        ...i,
        deposito,
        produccion,
        valor,
        costoPromedio: total.gt(0) ? valor.div(total).toDecimalPlaces(6) : null,
        alerta: i.activo && deposito.lte(i.stockMinimo),
      };
    });
  }

  listarCompras() {
    return this.prisma.compraInsumo.findMany({
      include: {
        proveedor: true,
        operacion: {
          select: { fechaEfectiva: true, fechaRegistro: true, motivo: true },
        },
        detalles: { include: { presentacion: { include: { insumo: true } } } },
        pagos: true,
      },
      orderBy: { operacion: { fechaRegistro: 'desc' } },
    });
  }

  private async pagar(
    tx: Tx,
    compraId: string,
    operacionId: string,
    dto: PagoDto,
    usuarioId: string,
    fechaEfectiva: Date,
    motivo: string,
  ) {
    const compra = await tx.compraInsumo.findUniqueOrThrow({
      where: { id: compraId },
    });
    const importe = decimal(dto.importe);
    if (importe.lte(0) || importe.gt(compra.total.minus(compra.pagado)))
      throw new BadRequestException(
        'El pago debe ser positivo y no superar el saldo de la compra',
      );
    const cuenta = await tx.cuentaFinanciera.findUnique({
      where: { id: dto.cuentaId },
    });
    const categoria = await tx.categoriaFlujo.findUnique({
      where: { id: dto.categoriaId },
    });
    if (
      !cuenta?.activo ||
      cuenta.moneda !== 'ARS' ||
      fechaEfectiva < cuenta.fechaApertura
    )
      throw new BadRequestException(
        'La cuenta debe estar activa, operar en ARS y estar abierta en la fecha del pago',
      );
    if (!categoria?.activo || categoria.sentido !== 'EGRESO')
      throw new BadRequestException('La categoría debe ser un egreso activo');
    if (
      fechaEfectiva <
      (
        await tx.operacionInventario.findUniqueOrThrow({
          where: { id: compra.operacionId },
        })
      ).fechaEfectiva
    )
      throw new BadRequestException(
        'El pago no puede ser anterior a la compra',
      );
    const financiera = await tx.operacionFinanciera.create({
      data: {
        claveIdempotencia: operacionId,
        tipo: 'PAGO',
        origenTipo: 'COMPRA_INSUMO',
        origenId: compraId,
        usuarioId,
        motivo,
      },
    });
    await tx.movimientoFinanciero.create({
      data: {
        operacionId: financiera.id,
        cuentaId: dto.cuentaId,
        categoriaId: dto.categoriaId,
        usuarioId,
        importe,
        sentido: 'EGRESO',
        clase: 'FLUJO_EXTERNO',
        fechaEfectiva,
        detalle: motivo,
      },
    });
    await tx.compraInsumo.update({
      where: { id: compraId },
      data: { pagado: compra.pagado.plus(importe) },
    });
    return tx.pagoCompraInsumo.create({
      data: {
        compraId,
        operacionId,
        operacionFinancieraId: financiera.id,
        importe,
      },
    });
  }

  comprar(dto: CompraInsumoDto, usuarioId: string) {
    return this.ejecutar('COMPRA', dto, usuarioId, async (tx, operacionId) => {
      if (
        !(await tx.proveedor.findUnique({ where: { id: dto.proveedorId } }))
          ?.activo
      )
        throw new BadRequestException('El proveedor debe estar activo');
      let total = decimal(0);
      const detalles: Prisma.DetalleCompraInsumoCreateWithoutCompraInput[] = [];
      for (const linea of dto.detalles) {
        const p = await this.presentacion(tx, linea.presentacionId);
        const costo = decimal(linea.costoTotal);
        if (costo.lte(0))
          throw new BadRequestException(
            'El costo de cada línea debe ser mayor a cero',
          );
        total = total.plus(costo);
        detalles.push({
          presentacion: { connect: { id: p.id } },
          paquetes: linea.paquetes,
          factor: p.factor,
          costoTotal: costo,
        });
        await this.moverInsumo(
          tx,
          operacionId,
          p,
          'DEPOSITO',
          p.factor.mul(linea.paquetes),
          'Compra de insumos',
          costo,
        );
      }
      if (total.gt('999999999999.99'))
        throw new BadRequestException(
          'El total de la compra excede el límite permitido',
        );
      const compra = await tx.compraInsumo.create({
        data: {
          proveedorId: dto.proveedorId,
          comprobante: dto.comprobante,
          operacionId,
          total,
          vencimiento: dto.vencimiento
            ? new Date(dto.vencimiento + 'T00:00:00-03:00')
            : undefined,
          detalles: { create: detalles },
        },
      });
      if (dto.pago)
        await this.pagar(
          tx,
          compra.id,
          operacionId,
          dto.pago,
          usuarioId,
          this.fecha(dto.fechaEfectiva),
          dto.motivo,
        );
      return tx.compraInsumo.findUniqueOrThrow({
        where: { id: compra.id },
        include: { detalles: true, pagos: true },
      });
    });
  }

  pagarCompra(id: string, dto: PagoCompraDto, usuarioId: string) {
    return this.ejecutar(
      'PAGO_COMPRA',
      dto,
      usuarioId,
      async (tx, op) => {
        if (!(await tx.compraInsumo.findUnique({ where: { id } })))
          throw new NotFoundException('Compra no encontrada');
        return this.pagar(
          tx,
          id,
          op,
          dto.pago,
          usuarioId,
          this.fecha(dto.fechaEfectiva),
          dto.motivo,
        );
      },
      { tipo: 'PAGO_COMPRA', id: dto.claveIdempotencia + ':' + id },
    );
  }

  trasladar(dto: TrasladoDto, usuarioId: string) {
    return this.ejecutar('TRASLADO', dto, usuarioId, async (tx, op) => {
      const p = await this.presentacion(tx, dto.presentacionId);
      const unidades = p.factor.mul(dto.paquetes);
      const salida = await this.moverInsumo(
        tx,
        op,
        p,
        'DEPOSITO',
        unidades.negated(),
        'Traslado a producción',
      );
      const entrada = await this.moverInsumo(
        tx,
        op,
        p,
        'PRODUCCION',
        unidades,
        'Apertura de paquetes',
        salida.valor.negated(),
      );
      return { salida, entrada };
    });
  }

  producir(dto: LoteDto, usuarioId: string) {
    return this.ejecutar('PRODUCCION', dto, usuarioId, async (tx, op) => {
      await this.producto(tx, dto.productoId);
      await this.participantes(tx, dto.responsableId, dto.ayudantesIds);
      if (dto.cantidadApta > dto.bolsasUsadas)
        throw new BadRequestException(
          'Las bolsas aptas no pueden superar las bolsas vacías usadas',
        );
      if (
        !dto.bolsasUsadas &&
        !dto.bolsasRotas &&
        !decimal(dto.hieloDescartadoKg).gt(0)
      )
        throw new BadRequestException(
          'El lote debe registrar producción o pérdidas reales',
        );
      const p = await this.presentacion(tx, dto.presentacionBolsaId);
      if (p.insumo.tipo !== 'BOLSA' || p.insumo.productoId !== dto.productoId)
        throw new BadRequestException(
          'La presentación de bolsas no corresponde al producto',
        );
      await this.moverInsumo(
        tx,
        op,
        p,
        'PRODUCCION',
        decimal(dto.bolsasUsadas).negated(),
        'Bolsas usadas en el lote',
      );
      if (dto.bolsasRotas)
        await this.moverInsumo(
          tx,
          op,
          p,
          'PRODUCCION',
          decimal(dto.bolsasRotas).negated(),
          'Bolsas rotas en el lote',
        );
      for (const consumo of dto.otrosConsumos ?? []) {
        const otro = await this.presentacion(tx, consumo.presentacionId);
        if (otro.insumo.tipo === 'BOLSA')
          throw new BadRequestException(
            'Las bolsas se registran en usadas o rotas',
          );
        if (decimal(consumo.cantidad).lte(0))
          throw new BadRequestException('El consumo debe ser mayor a cero');
        await this.moverInsumo(
          tx,
          op,
          otro,
          'PRODUCCION',
          decimal(consumo.cantidad).negated(),
          'Otro insumo utilizado en el lote',
        );
      }
      const lote = await tx.loteProduccion.create({
        data: {
          codigo: dto.codigo,
          operacionId: op,
          productoId: dto.productoId,
          responsableId: dto.responsableId,
          bolsasUsadas: dto.bolsasUsadas,
          bolsasRotas: dto.bolsasRotas,
          cantidadApta: dto.cantidadApta,
          cantidadEsperada: dto.cantidadEsperada,
          hieloDescartadoKg: dto.hieloDescartadoKg,
          participantes: {
            create: (dto.ayudantesIds ?? []).map((usuarioId) => ({
              usuarioId,
            })),
          },
        },
      });
      const stock = await this.moverTerminado(
        tx,
        op,
        dto.productoId,
        dto.cantidadApta,
      );
      const sobrantes = await tx.existenciaInsumo.findUniqueOrThrow({
        where: {
          presentacionId_ubicacion: {
            presentacionId: p.id,
            ubicacion: 'PRODUCCION',
          },
        },
      });
      return { lote, stock, bolsasSobrantes: sobrantes.unidades };
    });
  }

  moverMateriaPrima(dto: MovimientoInsumoDto, usuarioId: string) {
    return this.ejecutar(
      dto.accion,
      dto,
      usuarioId,
      async (tx, op) => {
        const p = await this.presentacion(tx, dto.presentacionId);
        const actual = await tx.existenciaInsumo.findUnique({
          where: {
            presentacionId_ubicacion: {
              presentacionId: p.id,
              ubicacion: dto.ubicacion,
            },
          },
        });
        const cantidad = decimal(dto.cantidad);
        let cambio = cantidad;
        if (dto.accion === AccionInsumo.CONTEO) {
          if (cantidad.lt(0))
            throw new BadRequestException('El conteo no puede ser negativo');
          cambio = cantidad.minus(actual?.unidades ?? 0);
        } else if (dto.accion !== AccionInsumo.AJUSTE) {
          if (cantidad.lte(0))
            throw new BadRequestException('La cantidad debe ser positiva');
          cambio = cantidad.negated();
        } else if (cantidad.isZero())
          throw new BadRequestException('El ajuste no puede ser cero');
        if (
          dto.accion === AccionInsumo.CONSUMO &&
          dto.ubicacion !== 'PRODUCCION'
        )
          throw new BadRequestException('El consumo debe salir de producción');
        if (dto.corrigeOperacionId)
          await this.validarCorreccionInsumo(
            tx,
            dto.corrigeOperacionId,
            p.id,
            dto.ubicacion,
          );
        const costo =
          cambio.gt(0) && dto.costoUnitario !== undefined
            ? cambio.mul(dto.costoUnitario)
            : undefined;
        const movimiento = await this.moverInsumo(
          tx,
          op,
          p,
          dto.ubicacion,
          cambio,
          dto.motivo,
          costo,
        );
        return {
          movimiento,
          cantidadFisica: dto.accion === AccionInsumo.CONTEO ? cantidad : null,
          diferencia: cambio,
        };
      },
      undefined,
      dto.corrigeOperacionId,
    );
  }

  private async validarCorreccionInsumo(
    tx: Tx,
    operacionId: string,
    presentacionId: string,
    ubicacion: UbicacionInsumo,
  ) {
    if (
      !(await tx.movimientoInsumo.findFirst({
        where: { operacionId, presentacionId, ubicacion },
      }))
    )
      throw new BadRequestException(
        'La corrección debe referir a un movimiento de esa presentación y ubicación',
      );
  }

  moverStock(dto: MovimientoStockDto, usuarioId: string) {
    return this.ejecutar(
      dto.accion,
      dto,
      usuarioId,
      async (tx, op) => {
        await this.producto(tx, dto.productoId);
        const especial = [
          AccionStock.OBSEQUIO,
          AccionStock.CONSUMO_INTERNO,
        ].includes(dto.accion);
        const personas = especial
          ? await this.participantes(tx, dto.responsableId, dto.ayudantesIds)
          : null;
        if (!especial && (dto.responsableId || dto.ayudantesIds?.length))
          throw new BadRequestException(
            'Los participantes se asignan a salidas especiales',
          );
        if (
          dto.corrigeOperacionId &&
          !(await tx.movimientoStock.findFirst({
            where: {
              operacionId: dto.corrigeOperacionId,
              productoId: dto.productoId,
            },
          }))
        )
          throw new BadRequestException(
            'La corrección debe referir a un movimiento del mismo producto',
          );
        const actual = await tx.stockTerminado.findUnique({
          where: { productoId: dto.productoId },
        });
        let cambio = dto.cantidad;
        if (dto.accion === AccionStock.CONTEO) {
          if (dto.cantidad < 0)
            throw new BadRequestException('El conteo no puede ser negativo');
          cambio = dto.cantidad - (actual?.cantidad ?? 0);
        } else if (dto.accion !== AccionStock.AJUSTE) {
          if (dto.cantidad <= 0)
            throw new BadRequestException('La cantidad debe ser positiva');
          cambio =
            dto.accion === AccionStock.DEVOLUCION
              ? dto.cantidad
              : -dto.cantidad;
        } else if (!dto.cantidad)
          throw new BadRequestException('El ajuste no puede ser cero');
        return {
          movimiento: await this.moverTerminado(tx, op, dto.productoId, cambio),
          participantes: personas,
          cantidadFisica:
            dto.accion === AccionStock.CONTEO ? dto.cantidad : null,
          diferencia: cambio,
        };
      },
      undefined,
      dto.corrigeOperacionId,
    );
  }

  // Punto de integración interno para la futura transacción de Ventas.
  // No confirma ventas ni expone un endpoint. El origen único bloquea dobles descuentos.
  async descontarVentaEnTransaccion(
    tx: Tx,
    ventaId: string,
    operacionId: string,
    lineas: { productoId: string; cantidad: number }[],
  ) {
    const op = await tx.operacionInventario.findUnique({
      where: { id: operacionId },
    });
    if (
      !op ||
      op.tipo !== 'VENTA' ||
      op.origenTipo !== 'VENTA' ||
      op.origenId !== ventaId
    )
      throw new BadRequestException(
        'Se requiere una operación de inventario con origen de venta único',
      );
    if (await tx.movimientoStock.findFirst({ where: { operacionId } }))
      throw new ConflictException('La venta ya descontó inventario');
    if (
      !lineas.length ||
      new Set(lineas.map((l) => l.productoId)).size !== lineas.length
    )
      throw new BadRequestException('Las líneas de la venta deben ser únicas');
    for (const linea of lineas) {
      if (!Number.isSafeInteger(linea.cantidad) || linea.cantidad <= 0)
        throw new BadRequestException('La cantidad debe ser entera y positiva');
      await this.producto(tx, linea.productoId);
      await this.moverTerminado(
        tx,
        operacionId,
        linea.productoId,
        -linea.cantidad,
      );
    }
  }

  listarStock() {
    return this.prisma.producto
      .findMany({ include: { stock: true }, orderBy: { pesoKg: 'asc' } })
      .then((productos) =>
        productos.map((p) => ({ ...p, cantidad: p.stock?.cantidad ?? 0 })),
      );
  }

  listarLotes() {
    return this.prisma.loteProduccion.findMany({
      include: {
        producto: true,
        responsable: { select: publico },
        participantes: { include: { usuario: { select: publico } } },
        operacion: {
          select: { fechaEfectiva: true, fechaRegistro: true, motivo: true },
        },
      },
      orderBy: { operacion: { fechaRegistro: 'desc' } },
    });
  }

  async listarMovimientos(cursor?: string) {
    const lista = await this.prisma.operacionInventario.findMany({
      take: 51,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ fechaRegistro: 'desc' }, { id: 'desc' }],
      include: {
        usuario: { select: publico },
        movimientosStock: { include: { producto: true } },
        movimientosInsumos: {
          include: { presentacion: { include: { insumo: true } } },
        },
      },
    });
    return {
      datos: lista.slice(0, 50),
      siguienteCursor: lista.length > 50 ? lista[49].id : null,
    };
  }
}
