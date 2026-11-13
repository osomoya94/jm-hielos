import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/crear-usuario.dto';
import { UpdateUsuarioDto } from './dto/editar-usuario.dto';
import { CambiarEstadoUsuarioDto } from './dto/cambiar-estado-usuario.dto';
import { Rol } from '../generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';

@Roles(Rol.ADMIN)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  listar() {
    return this.usuariosService.listar();
  }

  @Get('inactivos')
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  listarInactivos() {
    return this.usuariosService.listarInactivos();
  }

  @Get(':id')
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  consultarUno(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuariosService.consultarUno(id);
  }

  @Post()
  async crear(@Body() createUsuarioDto: CreateUsuarioDto) {
    return this.usuariosService.crear(createUsuarioDto);
  }

  @Patch(':id')
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.editar(id, updateUsuarioDto);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cambiarEstadoUsuarioDto: CambiarEstadoUsuarioDto,
  ) {
    return this.usuariosService.cambiarEstado(id, cambiarEstadoUsuarioDto);
  }
}
