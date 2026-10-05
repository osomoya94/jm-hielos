import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductoDto } from './dto/crear-producto.dto';
import { UpdateProductoDto } from './dto/editar-producto.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado-producto.dto';

@Injectable()
export class ProductosService {
  constructor(private readonly prismaService: PrismaService) {}

  async listar() {
    const productos = await this.prismaService.producto.findMany({
      where: { activo: true },
    });
    return productos;
  }

  async listarInactivos() {
    const productos = await this.prismaService.producto.findMany({
      where: { activo: false },
    });
    return productos;
  }

  async consultarUno(id: string) {
    const producto = await this.prismaService.producto.findUnique({
      where: { id },
    });

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    return producto;
  }

  async crear(createProductoDto: CreateProductoDto) {
    const { nombre, pesoKg, unidad } = createProductoDto;

    const producto = await this.prismaService.producto.create({
      data: {
        nombre,
        pesoKg,
        unidad,
      },
    });

    return { ...producto, message: 'Producto creado con exito' };
  }

  async editar(id: string, updateProductoDto: UpdateProductoDto) {
    if (
      updateProductoDto.nombre === undefined &&
      updateProductoDto.pesoKg === undefined &&
      updateProductoDto.unidad === undefined
    ) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para modificar',
      );
    }

    const productoExiste = await this.consultarUno(id);

    if (!productoExiste.activo) {
      throw new BadRequestException(
        'El producto esta inactivo, no puede modificarse',
      );
    }

    const { nombre, pesoKg, unidad } = updateProductoDto;

    const producto = await this.prismaService.producto.update({
      where: { id },
      data: {
        nombre,
        pesoKg,
        unidad,
      },
    });

    return { ...producto, message: 'Producto editado con exito' };
  }

  async cambiarEstado(id: string, cambiarEstado: CambiarEstadoDto) {
    const producto = await this.consultarUno(id);

    if (producto.activo === cambiarEstado.activo) {
      if (producto.activo === false) {
        throw new BadRequestException(
          'El producto se encuentra desactivado, no se puede volver a desactivar ',
        );
      }

      if (producto.activo === true) {
        throw new BadRequestException(
          'El producto se encuentra activado, no se puede volver a activar ',
        );
      }
    }

    const productoActualizado = await this.prismaService.producto.update({
      where: { id },
      data: { activo: cambiarEstado.activo },
    });

    return { ...productoActualizado, message: 'Se actualizo estado con exito' };
  }
}
