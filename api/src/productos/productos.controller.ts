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

@Controller('productos')
export class ProductosController {
  constructor(private readonly productoService: ProductosService) {}

  @Get()
  listar() {
    return this.productoService.listar();
  }

  @Get('inactivos')
  listarInactivos() {
    return this.productoService.listarInactivos();
  }

  @Get(':id')
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
