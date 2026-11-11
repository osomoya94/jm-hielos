import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CambiarEstadoCategoriaDto } from './dto/cambiar-estado-categoria.dto';
import { CreateCategoriaFlujoDto } from './dto/create-categoria-flujo.dto';
import { UpdateCategoriaFlujoDto } from './dto/update-categoria-flujo.dto';

@Injectable()
export class CategoriasFlujoService {
  constructor(private readonly prismaService: PrismaService) {}

  async listar() {
    const categorias = await this.prismaService.categoriaFlujo.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });

    return categorias;
  }

  async listarInactivas() {
    const categorias = await this.prismaService.categoriaFlujo.findMany({
      where: { activo: false },
      orderBy: { nombre: 'asc' },
    });

    return categorias;
  }

  async consultarUno(id: string) {
    const categoria = await this.prismaService.categoriaFlujo.findUnique({
      where: { id },
    });

    if (!categoria) {
      throw new NotFoundException('Categoría de flujo no encontrada');
    }

    return categoria;
  }

  async crear(createCategoriaFlujoDto: CreateCategoriaFlujoDto) {
    const { nombre, grupo, sentido } = createCategoriaFlujoDto;

    const categoriaDuplicada =
      await this.prismaService.categoriaFlujo.findUnique({
        where: { grupo_sentido_nombre: { grupo, sentido, nombre } },
        select: { id: true },
      });

    if (categoriaDuplicada) {
      throw new ConflictException(
        'Ya existe una categoría con el mismo grupo, sentido y nombre',
      );
    }

    try {
      const categoria = await this.prismaService.categoriaFlujo.create({
        data: { nombre, grupo, sentido },
      });

      return { ...categoria, message: 'Categoría de flujo creada con éxito' };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe una categoría con el mismo grupo, sentido y nombre',
        );
      }

      throw error;
    }
  }

  async editar(id: string, updateCategoriaFlujoDto: UpdateCategoriaFlujoDto) {
    const { nombre } = updateCategoriaFlujoDto;

    if (nombre === undefined) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para modificar',
      );
    }

    const categoriaExiste = await this.consultarUno(id);

    if (!categoriaExiste.activo) {
      throw new BadRequestException(
        'La categoría de flujo está inactiva, no puede modificarse',
      );
    }

    // Conservar el mismo nombre no altera la clasificación histórica.
    if (nombre === categoriaExiste.nombre) {
      return {
        ...categoriaExiste,
        message: 'Categoría de flujo editada con éxito',
      };
    }

    const movimientoRelacionado =
      await this.prismaService.movimientoFinanciero.findFirst({
        where: { categoriaId: id },
        select: { id: true },
      });

    if (movimientoRelacionado) {
      throw new BadRequestException(
        'No se puede renombrar una categoría con movimientos financieros relacionados',
      );
    }

    const categoriaDuplicada =
      await this.prismaService.categoriaFlujo.findUnique({
        where: {
          grupo_sentido_nombre: {
            grupo: categoriaExiste.grupo,
            sentido: categoriaExiste.sentido,
            nombre,
          },
        },
        select: { id: true },
      });

    if (categoriaDuplicada && categoriaDuplicada.id !== id) {
      throw new ConflictException(
        'Ya existe una categoría con el mismo grupo, sentido y nombre',
      );
    }

    try {
      const categoria = await this.prismaService.categoriaFlujo.update({
        // Se vuelven a exigir las condiciones al escribir en la base.
        where: { id, activo: true, movimientos: { none: {} } },
        data: { nombre },
      });

      return { ...categoria, message: 'Categoría de flujo editada con éxito' };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Ya existe una categoría con el mismo grupo, sentido y nombre',
          );
        }

        if (error.code === 'P2025') {
          throw new BadRequestException(
            'La categoría dejó de estar activa o ya tiene movimientos financieros, vuelva a consultarla',
          );
        }
      }

      throw error;
    }
  }

  async cambiarEstado(
    id: string,
    cambiarEstadoCategoriaDto: CambiarEstadoCategoriaDto,
  ) {
    const categoria = await this.consultarUno(id);

    if (categoria.activo === cambiarEstadoCategoriaDto.activo) {
      if (categoria.activo) {
        throw new BadRequestException(
          'La categoría de flujo se encuentra activada, no se puede volver a activar',
        );
      }

      throw new BadRequestException(
        'La categoría de flujo se encuentra desactivada, no se puede volver a desactivar',
      );
    }

    const categoriaActualizada = await this.prismaService.categoriaFlujo.update(
      {
        where: { id },
        data: { activo: cambiarEstadoCategoriaDto.activo },
      },
    );

    return {
      ...categoriaActualizada,
      message: 'Se actualizó estado con éxito',
    };
  }
}
