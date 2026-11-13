import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { esConflictoTransaccion } from '../prisma/conflicto-transaccion';
import {
  Prisma,
  type Producto,
  type ListaPrecio,
} from '../generated/prisma/client';
import {
  CondicionClienteDto,
  CrearListaDto,
  EditarListaDto,
  MotivoPrecioDto,
  PrecioParticularDto,
  PrecioProductoDto,
} from './dto/precios.dto';

type Tx = Prisma.TransactionClient;
@Injectable()
export class PreciosService {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.listaPrecio.findMany({
      include: { precios: { include: { producto: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  private async auditar(
    tx: Tx,
    usuarioId: string,
    entidad: string,
    entidadId: string,
    motivo: string,
    anterior: unknown,
    posterior: unknown,
  ) {
    const json = (valor: unknown) =>
      JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
    await tx.auditoriaComercial.create({
      data: {
        usuarioId,
        entidad,
        entidadId,
        accion: anterior ? 'MODIFICAR' : 'CREAR',
        motivo,
        ...(anterior ? { anterior: json(anterior) } : {}),
        posterior: json(posterior),
      },
    });
  }
  private async cambiar<T>(trabajo: (tx: Tx) => Promise<T>) {
    try {
      return await this.prisma.$transaction(trabajo, {
        isolationLevel: 'Serializable',
      });
    } catch (error) {
      if (
        esConflictoTransaccion(error) ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002')
      )
        throw new ConflictException(
          'La configuración ya existe o cambió. Volvé a consultar antes de guardar',
        );
      throw error;
    }
  }
  crear(dto: CrearListaDto, usuarioId: string) {
    return this.cambiar(async (tx) => {
      const lista = await tx.listaPrecio.create({
        data: { nombre: dto.nombre, tipo: dto.tipo },
      });
      await this.auditar(
        tx,
        usuarioId,
        'LISTA_PRECIO',
        lista.id,
        dto.motivo,
        null,
        lista,
      );
      return lista;
    });
  }
  editarLista(id: string, dto: EditarListaDto, usuarioId: string) {
    return this.cambiar(async (tx) => {
      const anterior = await tx.listaPrecio.findUnique({ where: { id } });
      if (!anterior) throw new NotFoundException('Lista no encontrada');
      const lista = await tx.listaPrecio.update({
        where: { id },
        data: { nombre: dto.nombre, activo: dto.activo },
      });
      await this.auditar(
        tx,
        usuarioId,
        'LISTA_PRECIO',
        id,
        dto.motivo,
        anterior,
        lista,
      );
      return lista;
    });
  }
  guardarPrecio(listaId: string, dto: PrecioProductoDto, usuarioId: string) {
    return this.cambiar(async (tx) => {
      const lista = await tx.listaPrecio.findUnique({ where: { id: listaId } });
      const producto = await tx.producto.findUnique({
        where: { id: dto.productoId },
      });
      if (!lista?.activo || !producto?.activo)
        throw new BadRequestException(
          'La lista y el producto deben estar activos',
        );
      if (new Prisma.Decimal(dto.precio).lte(0))
        throw new BadRequestException('El precio debe ser mayor a cero');
      const where = {
        listaId_productoId: { listaId, productoId: dto.productoId },
      };
      const anterior = await tx.precioLista.findUnique({ where });
      const precio = await tx.precioLista.upsert({
        where,
        create: { listaId, productoId: dto.productoId, precio: dto.precio },
        update: { precio: dto.precio },
      });
      await this.auditar(
        tx,
        usuarioId,
        'PRECIO_LISTA',
        listaId + ':' + dto.productoId,
        dto.motivo,
        anterior,
        precio,
      );
      return precio;
    });
  }
  configurarCliente(
    clienteId: string,
    dto: CondicionClienteDto,
    usuarioId: string,
  ) {
    return this.cambiar(async (tx) => {
      const cliente = await tx.cliente.findUnique({ where: { id: clienteId } });
      const lista = await tx.listaPrecio.findUnique({
        where: { id: dto.listaId },
      });
      if (!cliente?.activo || !lista?.activo)
        throw new BadRequestException('Cliente y lista deben estar activos');
      if (dto.consumidorFinal && lista.tipo !== 'MINORISTA')
        throw new BadRequestException(
          'Consumidor final utiliza una lista minorista',
        );
      const anterior = await tx.condicionCliente.findUnique({
        where: { clienteId },
      });
      const condicion = await tx.condicionCliente.upsert({
        where: { clienteId },
        create: {
          clienteId,
          listaId: dto.listaId,
          consumidorFinal: dto.consumidorFinal ?? false,
        },
        update: {
          listaId: dto.listaId,
          consumidorFinal:
            dto.consumidorFinal ?? anterior?.consumidorFinal ?? false,
        },
      });
      if (condicion.consumidorFinal && lista.tipo !== 'MINORISTA')
        throw new BadRequestException(
          'Consumidor final utiliza una lista minorista',
        );
      await this.auditar(
        tx,
        usuarioId,
        'CONDICION_CLIENTE',
        clienteId,
        dto.motivo,
        anterior,
        condicion,
      );
      return condicion;
    });
  }
  guardarParticular(
    clienteId: string,
    dto: PrecioParticularDto,
    usuarioId: string,
  ) {
    return this.cambiar(async (tx) => {
      const cliente = await tx.cliente.findUnique({ where: { id: clienteId } });
      const producto = await tx.producto.findUnique({
        where: { id: dto.productoId },
      });
      if (!cliente?.activo || !producto?.activo)
        throw new BadRequestException('Cliente y producto deben estar activos');
      if (new Prisma.Decimal(dto.precio).lte(0))
        throw new BadRequestException('El precio debe ser mayor a cero');
      const condicion = await tx.condicionCliente.findUnique({
        where: { clienteId },
      });
      if (condicion?.consumidorFinal)
        throw new BadRequestException(
          'Consumidor final conserva el precio minorista',
        );
      const where = {
        clienteId_productoId: { clienteId, productoId: dto.productoId },
      };
      const anterior = await tx.precioCliente.findUnique({ where });
      const precio = await tx.precioCliente.upsert({
        where,
        create: {
          clienteId,
          productoId: dto.productoId,
          precio: dto.precio,
          activo: dto.activo ?? true,
        },
        update: { precio: dto.precio, activo: dto.activo ?? true },
      });
      await this.auditar(
        tx,
        usuarioId,
        'PRECIO_CLIENTE',
        clienteId + ':' + dto.productoId,
        dto.motivo,
        anterior,
        precio,
      );
      return precio;
    });
  }
  inicializar(dto: MotivoPrecioDto, usuarioId: string) {
    return this.cambiar(async (tx) => {
      const productos: Producto[] = [];
      for (const pesoKg of [1, 3, 5, 10]) {
        const existente = await tx.producto.findFirst({
          where: { pesoKg, unidad: 'bolsa', activo: true },
          orderBy: { id: 'asc' },
        });
        productos.push(
          existente ??
            (await tx.producto.create({
              data: {
                nombre: 'Bolsa de hielo ' + pesoKg + ' kg',
                pesoKg,
                unidad: 'bolsa',
              },
            })),
        );
      }
      const listas: ListaPrecio[] = [];
      for (const tipo of [
        'MINORISTA',
        'MAYORISTA',
        'ESPECIAL',
        'EVENTOS',
      ] as const) {
        const existente = await tx.listaPrecio.findFirst({
          where: { tipo, activo: true },
          orderBy: { id: 'asc' },
        });
        listas.push(
          existente ??
            (await tx.listaPrecio.create({
              data: { nombre: tipo[0] + tipo.slice(1).toLowerCase(), tipo },
            })),
        );
      }
      const minorista = listas.find((l) => l.tipo === 'MINORISTA')!;
      let consumidor = await tx.condicionCliente.findFirst({
        where: { consumidorFinal: true },
        include: { cliente: true },
      });
      if (!consumidor) {
        const cliente = await tx.cliente.create({
          data: { nombre: 'Consumidor final', tipoCliente: 'CONSUMIDOR_FINAL' },
        });
        consumidor = await tx.condicionCliente.create({
          data: {
            clienteId: cliente.id,
            listaId: minorista.id,
            consumidorFinal: true,
          },
          include: { cliente: true },
        });
      }
      const resultado = { productos, listas, consumidor };
      await this.auditar(
        tx,
        usuarioId,
        'CONFIGURACION_COMERCIAL',
        consumidor.clienteId,
        dto.motivo,
        null,
        resultado,
      );
      return resultado;
    });
  }
  async precioParaVenta(tx: Tx, clienteId: string, productoId: string) {
    const cliente = await tx.cliente.findUnique({ where: { id: clienteId } });
    const producto = await tx.producto.findUnique({
      where: { id: productoId },
    });
    if (!cliente?.activo || !producto?.activo)
      throw new BadRequestException('Cliente y producto deben estar activos');
    const condicion = await tx.condicionCliente.findUnique({
      where: { clienteId },
      include: { lista: true },
    });
    if (!condicion?.lista.activo)
      throw new BadRequestException(
        'El cliente necesita una lista de precios activa',
      );
    if (condicion.consumidorFinal && condicion.lista.tipo !== 'MINORISTA')
      throw new BadRequestException(
        'Consumidor final necesita una lista minorista',
      );
    const particular = !condicion.consumidorFinal
      ? await tx.precioCliente.findUnique({
          where: { clienteId_productoId: { clienteId, productoId } },
        })
      : null;
    const precio = particular?.activo
      ? particular.precio
      : (
          await tx.precioLista.findUnique({
            where: {
              listaId_productoId: { listaId: condicion.listaId, productoId },
            },
          })
        )?.precio;
    if (!precio)
      throw new BadRequestException(
        'Falta configurar el precio de ' + producto.nombre,
      );
    return {
      producto,
      precio,
      origen: particular?.activo
        ? 'CLIENTE:' + clienteId
        : 'LISTA:' + condicion.listaId,
    };
  }
  async consultarCliente(clienteId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const cliente = await tx.cliente.findUnique({
          where: { id: clienteId },
          include: {
            condicionComercial: { include: { lista: true } },
            preciosParticulares: true,
          },
        });
        if (!cliente) throw new NotFoundException('Cliente no encontrado');
        return cliente;
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
