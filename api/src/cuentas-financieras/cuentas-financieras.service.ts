import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCuentaFinancieraDto } from './dto/create-cuenta-financiera.dto';
import { UpdateCuentaFinancieraDto } from './dto/update-cuenta-financiera.dto';
import { CambiarEstadoCuentaDto } from './dto/cambiar-estado-cuenta.dto';

@Injectable()
export class CuentasFinancierasService {
  constructor(private readonly prismaService: PrismaService) {}

  async listar() {
    const cuentas = await this.prismaService.cuentaFinanciera.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });

    return cuentas;
  }

  async listarInactivas() {
    const cuentas = await this.prismaService.cuentaFinanciera.findMany({
      where: { activo: false },
      orderBy: { nombre: 'asc' },
    });

    return cuentas;
  }

  async consultarUno(id: string) {
    const cuenta = await this.prismaService.cuentaFinanciera.findUnique({
      where: { id },
    });

    if (!cuenta) {
      throw new NotFoundException('Cuenta financiera no encontrada');
    }

    return cuenta;
  }

  async crear(createCuentaFinancieraDto: CreateCuentaFinancieraDto) {
    const { nombre, tipo, titularInterno, saldoInicial, fechaApertura } =
      createCuentaFinancieraDto;

    const cuentaConMismoNombre =
      await this.prismaService.cuentaFinanciera.findUnique({
        where: { nombre },
        select: { id: true },
      });

    if (cuentaConMismoNombre) {
      throw new ConflictException(
        'El nombre de la cuenta financiera ya existe',
      );
    }

    try {
      const cuenta = await this.prismaService.cuentaFinanciera.create({
        data: {
          nombre,
          tipo,
          titularInterno,
          saldoInicial: new Prisma.Decimal(saldoInicial),
          fechaApertura: new Date(fechaApertura),
        },
      });

      return { ...cuenta, message: 'Cuenta financiera creada con éxito' };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'El nombre de la cuenta financiera ya existe',
        );
      }

      throw error;
    }
  }

  async editar(
    id: string,
    updateCuentaFinancieraDto: UpdateCuentaFinancieraDto,
  ) {
    const { nombre, titularInterno } = updateCuentaFinancieraDto;

    if (nombre === undefined && titularInterno === undefined) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para modificar',
      );
    }

    const cuentaExiste = await this.consultarUno(id);

    if (!cuentaExiste.activo) {
      throw new BadRequestException(
        'La cuenta financiera está inactiva, no puede modificarse',
      );
    }

    if (nombre !== undefined) {
      const cuentaConMismoNombre =
        await this.prismaService.cuentaFinanciera.findUnique({
          where: { nombre },
          select: { id: true },
        });

      if (cuentaConMismoNombre && cuentaConMismoNombre.id !== id) {
        throw new ConflictException(
          'El nombre de la cuenta financiera ya existe',
        );
      }
    }

    try {
      const cuenta = await this.prismaService.cuentaFinanciera.update({
        where: { id },
        data: { nombre, titularInterno },
      });

      return { ...cuenta, message: 'Cuenta financiera editada con éxito' };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'El nombre de la cuenta financiera ya existe',
        );
      }

      throw error;
    }
  }

  async cambiarEstado(
    id: string,
    cambiarEstadoCuentaDto: CambiarEstadoCuentaDto,
  ) {
    const cuenta = await this.consultarUno(id);

    if (cuenta.activo === cambiarEstadoCuentaDto.activo) {
      if (cuenta.activo) {
        throw new BadRequestException(
          'La cuenta financiera se encuentra activada, no se puede volver a activar',
        );
      }

      throw new BadRequestException(
        'La cuenta financiera se encuentra desactivada, no se puede volver a desactivar',
      );
    }

    const cuentaActualizada = await this.prismaService.cuentaFinanciera.update({
      where: { id },
      data: { activo: cambiarEstadoCuentaDto.activo },
    });

    return { ...cuentaActualizada, message: 'Se actualizó estado con éxito' };
  }
}
