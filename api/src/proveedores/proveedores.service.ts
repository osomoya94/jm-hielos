import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CambiarEstadoProveedorDto } from './dto/cambiar-estado-proveedor.dto';
import { CreateProveedorDto } from './dto/crear-proveedor.dto';
import { UpdateProveedorDto } from './dto/editar-proveedor.dto';

@Injectable()
export class ProveedoresService {
  constructor(private readonly prismaService: PrismaService) {}

  async listar() {
    const proveedores = await this.prismaService.proveedor.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });

    return proveedores;
  }

  async listarInactivos() {
    const proveedores = await this.prismaService.proveedor.findMany({
      where: { activo: false },
      orderBy: { nombre: 'asc' },
    });

    return proveedores;
  }

  async consultarUno(id: string) {
    const proveedor = await this.prismaService.proveedor.findUnique({
      where: { id },
    });

    if (!proveedor) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    return proveedor;
  }

  async crear(createProveedorDto: CreateProveedorDto) {
    const { nombre, cuit, telefono, direccion, observaciones } =
      createProveedorDto;

    if (cuit !== undefined && cuit !== null) {
      const proveedorConMismoCuit =
        await this.prismaService.proveedor.findUnique({
          where: { cuit },
          select: { id: true },
        });

      if (proveedorConMismoCuit) {
        throw new ConflictException('El CUIT ya existe');
      }
    }

    try {
      const proveedor = await this.prismaService.proveedor.create({
        data: { nombre, cuit, telefono, direccion, observaciones },
      });

      return { ...proveedor, message: 'Proveedor creado con éxito' };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('El CUIT ya existe');
      }

      throw error;
    }
  }

  async editar(id: string, updateProveedorDto: UpdateProveedorDto) {
    if (
      Object.values(updateProveedorDto).every((value) => value === undefined)
    ) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para modificar',
      );
    }

    const proveedorExiste = await this.consultarUno(id);

    if (!proveedorExiste.activo) {
      throw new BadRequestException(
        'El proveedor está inactivo, no puede modificarse',
      );
    }

    const { nombre, cuit, telefono, direccion, observaciones } =
      updateProveedorDto;

    if (cuit !== undefined && cuit !== null) {
      const proveedorConMismoCuit =
        await this.prismaService.proveedor.findUnique({
          where: { cuit },
          select: { id: true },
        });

      if (proveedorConMismoCuit && proveedorConMismoCuit.id !== id) {
        throw new ConflictException('El CUIT ya existe');
      }
    }

    try {
      const proveedor = await this.prismaService.proveedor.update({
        where: { id },
        data: { nombre, cuit, telefono, direccion, observaciones },
      });

      return { ...proveedor, message: 'Proveedor editado con éxito' };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('El CUIT ya existe');
      }

      throw error;
    }
  }

  async cambiarEstado(
    id: string,
    cambiarEstadoProveedorDto: CambiarEstadoProveedorDto,
  ) {
    const proveedor = await this.consultarUno(id);

    if (proveedor.activo === cambiarEstadoProveedorDto.activo) {
      if (proveedor.activo) {
        throw new BadRequestException(
          'El proveedor se encuentra activado, no se puede volver a activar',
        );
      }

      throw new BadRequestException(
        'El proveedor se encuentra desactivado, no se puede volver a desactivar',
      );
    }

    const proveedorActualizado = await this.prismaService.proveedor.update({
      where: { id },
      data: { activo: cambiarEstadoProveedorDto.activo },
    });

    return {
      ...proveedorActualizado,
      message: 'Se actualizó estado con éxito',
    };
  }
}
