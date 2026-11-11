import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUsuarioDto } from './dto/crear-usuario.dto';
import * as bcrypt from 'bcrypt';
import { UpdateUsuarioDto } from './dto/editar-usuario.dto';
import { CambiarEstadoUsuarioDto } from './dto/cambiar-estado-usuario.dto';

const camposPublicosUsuario = {
  id: true,
  username: true,
  rol: true,
  activo: true,
  ultimoAcceso: true,
} as const;

@Injectable()
export class UsuariosService {
  constructor(private readonly prismaService: PrismaService) {}

  async listar() {
    const usuarios = await this.prismaService.usuario.findMany({
      where: { activo: true },
      select: camposPublicosUsuario,
      orderBy: { username: 'asc' },
    });

    return usuarios;
  }

  async listarInactivos() {
    const usuarios = await this.prismaService.usuario.findMany({
      where: { activo: false },
      select: camposPublicosUsuario,
      orderBy: { username: 'asc' },
    });

    return usuarios;
  }

  async consultarUno(id: string) {
    const usuario = await this.prismaService.usuario.findUnique({
      where: { id },
      select: camposPublicosUsuario,
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return usuario;
  }

  async consultarUnoUsername(username: string) {
    const usuario = await this.prismaService.usuario.findUnique({
      where: { username },
      select: { id: true },
    });

    return usuario;
  }

  async crear(createUsuarioDto: CreateUsuarioDto) {
    try {
      const { username, password, rol } = createUsuarioDto;

      const existUser = await this.consultarUnoUsername(username);

      if (existUser) {
        throw new ConflictException('El username ya existe');
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const usuario = await this.prismaService.usuario.create({
        data: {
          username,
          passwordHash: passwordHash,
          rol,
        },
        select: camposPublicosUsuario,
      });

      return {
        username: usuario.username,
        id: usuario.id,
        rol: usuario.rol,
        activo: usuario.activo,
        message: 'Usuario creado con éxito',
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('El username ya existe');
      }
      throw error;
    }
  }

  async editar(id: string, updateUsuarioDto: UpdateUsuarioDto) {
    if (Object.values(updateUsuarioDto).every((value) => value === undefined)) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para modificar',
      );
    }

    const usuarioExiste = await this.consultarUno(id);

    if (!usuarioExiste.activo) {
      throw new BadRequestException(
        'El usuario está inactivo, no puede modificarse',
      );
    }

    const { username, rol } = updateUsuarioDto;

    if (username !== undefined) {
      const usuarioConMismoUsername = await this.consultarUnoUsername(username);

      if (usuarioConMismoUsername && usuarioConMismoUsername.id !== id) {
        throw new ConflictException('El username ya existe');
      }
    }

    if (usuarioExiste.rol === 'ADMIN' && rol !== undefined && rol !== 'ADMIN') {
      const administradoresActivos = await this.prismaService.usuario.count({
        where: { rol: 'ADMIN', activo: true },
      });

      if (administradoresActivos <= 1) {
        throw new BadRequestException(
          'No se puede cambiar el rol del último administrador activo',
        );
      }
    }

    try {
      const usuario = await this.prismaService.usuario.update({
        where: { id },
        data: { username, rol },
        select: camposPublicosUsuario,
      });

      return { ...usuario, message: 'Usuario editado con éxito' };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('El username ya existe');
      }

      throw error;
    }
  }

  async cambiarEstado(
    id: string,
    cambiarEstadoUsuarioDto: CambiarEstadoUsuarioDto,
  ) {
    const usuario = await this.consultarUno(id);

    if (usuario.activo === cambiarEstadoUsuarioDto.activo) {
      if (usuario.activo) {
        throw new BadRequestException(
          'El usuario se encuentra activado, no se puede volver a activar',
        );
      }

      throw new BadRequestException(
        'El usuario se encuentra desactivado, no se puede volver a desactivar',
      );
    }

    if (
      usuario.rol === 'ADMIN' &&
      usuario.activo &&
      !cambiarEstadoUsuarioDto.activo
    ) {
      const administradoresActivos = await this.prismaService.usuario.count({
        where: { rol: 'ADMIN', activo: true },
      });

      if (administradoresActivos <= 1) {
        throw new BadRequestException(
          'No se puede desactivar al último administrador activo',
        );
      }
    }

    const usuarioActualizado = await this.prismaService.usuario.update({
      where: { id },
      data: { activo: cambiarEstadoUsuarioDto.activo },
      select: camposPublicosUsuario,
    });

    return {
      ...usuarioActualizado,
      message: 'Se actualizó estado con éxito',
    };
  }
}
