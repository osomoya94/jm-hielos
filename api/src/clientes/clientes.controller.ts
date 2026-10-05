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

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  listar() {
    return this.clientesService.listar();
  }

  @Get('inactivos')
  listarInactivos() {
    return this.clientesService.listarInactivos();
  }

  @Get(':id')
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
