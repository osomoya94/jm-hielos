import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../generated/prisma/enums';
import { CambiarEstadoProveedorDto } from './dto/cambiar-estado-proveedor.dto';
import { CreateProveedorDto } from './dto/crear-proveedor.dto';
import { UpdateProveedorDto } from './dto/editar-proveedor.dto';
import { ProveedoresService } from './proveedores.service';

@Roles(Rol.ADMIN)
@Controller('proveedores')
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Get()
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  listar() {
    return this.proveedoresService.listar();
  }

  @Get('inactivos')
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  listarInactivos() {
    return this.proveedoresService.listarInactivos();
  }

  @Get(':id')
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  consultarUno(@Param('id', ParseUUIDPipe) id: string) {
    return this.proveedoresService.consultarUno(id);
  }

  @Post()
  crear(@Body() createProveedorDto: CreateProveedorDto) {
    return this.proveedoresService.crear(createProveedorDto);
  }

  @Patch(':id')
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProveedorDto: UpdateProveedorDto,
  ) {
    return this.proveedoresService.editar(id, updateProveedorDto);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cambiarEstadoProveedorDto: CambiarEstadoProveedorDto,
  ) {
    return this.proveedoresService.cambiarEstado(id, cambiarEstadoProveedorDto);
  }
}
