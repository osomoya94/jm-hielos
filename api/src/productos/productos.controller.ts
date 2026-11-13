import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ProductosService } from './productos.service';
import { CreateProductoDto } from './dto/crear-producto.dto';
import { UpdateProductoDto } from './dto/editar-producto.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado-producto.dto';
import { Rol } from '../generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';

@Roles(Rol.ADMIN)
@Controller('productos')
export class ProductosController {
  constructor(private readonly productoService: ProductosService) {}

  @Get()
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  listar() {
    return this.productoService.listar();
  }

  @Get('inactivos')
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  listarInactivos() {
    return this.productoService.listarInactivos();
  }

  @Get(':id')
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  consultarUno(@Param('id', ParseUUIDPipe) id: string) {
    return this.productoService.consultarUno(id);
  }

  @Post()
  crear(@Body() createProductoDto: CreateProductoDto) {
    return this.productoService.crear(createProductoDto);
  }

  @Patch(':id')
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductoDto: UpdateProductoDto,
  ) {
    return this.productoService.editar(id, updateProductoDto);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cambiarEstado: CambiarEstadoDto,
  ) {
    return this.productoService.cambiarEstado(id, cambiarEstado);
  }
}
