import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/crear-cliente.dto';
import { UpdateClienteDto } from './dto/editar-cliente.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado-cliente.dto';
import { Rol } from '../generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';

@Roles(Rol.ADMIN)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  listar() {
    return this.clientesService.listar();
  }

  @Get('inactivos')
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  listarInactivos() {
    return this.clientesService.listarInactivos();
  }

  @Get(':id')
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  consultarUno(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientesService.consultarUno(id);
  }

  @Post()
  crear(@Body() createClienteDto: CreateClienteDto) {
    return this.clientesService.crear(createClienteDto);
  }

  @Patch(':id')
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateClienteDto: UpdateClienteDto,
  ) {
    return this.clientesService.editar(id, updateClienteDto);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cambiarEstado: CambiarEstadoDto,
  ) {
    return this.clientesService.cambiarEstado(id, cambiarEstado);
  }
}
