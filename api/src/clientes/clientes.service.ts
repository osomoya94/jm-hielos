import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto } from './dto/crear-cliente.dto';
import { UpdateClienteDto } from './dto/editar-cliente.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly prismaService: PrismaService) {}

  async listar() {
    const clientes = await this.prismaService.cliente.findMany({
      where: { activo: true },
    });
    return clientes;
  }

  async listarInactivos() {
    const clientes = await this.prismaService.cliente.findMany({
      where: { activo: false },
    });
    return clientes;
  }

  async consultarUno(id: string) {
    const cliente = await this.prismaService.cliente.findUnique({
      where: { id },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return cliente;
  }

  async crear(createClienteDto: CreateClienteDto) {
    const {
      nombre,
      telefono,
      direccion,
      referencia,
      tipoCliente,
      observaciones,
    } = createClienteDto;

    const cliente = await this.prismaService.cliente.create({
      data: {
        nombre,
        telefono,
        direccion,
        referencia,
        tipoCliente,
        observaciones,
      },
    });

    return { ...cliente, message: 'Cliente creado con exito' };
  }

  async editar(id: string, updateClienteDto: UpdateClienteDto) {
    if (Object.values(updateClienteDto).every((value) => value === undefined)) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para modificar',
      );
    }

    const clienteExiste = await this.consultarUno(id);

    if (!clienteExiste.activo) {
      throw new BadRequestException(
        'El cliente esta inactivo, no puede modificarse',
      );
    }

    const {
      nombre,
      telefono,
      direccion,
      referencia,
      tipoCliente,
      observaciones,
    } = updateClienteDto;

    const cliente = await this.prismaService.cliente.update({
      where: { id },
      data: {
        nombre,
        telefono,
        direccion,
        referencia,
        tipoCliente,
        observaciones,
      },
    });

    return { ...cliente, message: 'Cliente editado con exito' };
  }

  async cambiarEstado(id: string, cambiarEstado: CambiarEstadoDto) {
    const cliente = await this.consultarUno(id);

    if (cliente.activo === cambiarEstado.activo) {
      if (cliente.activo === false) {
        throw new BadRequestException(
          'El cliente se encuentra desactivado, no se puede volver a desactivar ',
        );
      }

      if (cliente.activo === true) {
        throw new BadRequestException(
          'El cliente se encuentra activado, no se peude volver a activar ',
        );
      }
    }

    const clienteActualizado = await this.prismaService.cliente.update({
      where: { id },
      data: { activo: cambiarEstado.activo },
    });

    return { ...clienteActualizado, message: 'Se actualizo estado con exito' };
  }
}
