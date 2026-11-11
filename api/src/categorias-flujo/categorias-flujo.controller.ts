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
import { CategoriasFlujoService } from './categorias-flujo.service';
import { CambiarEstadoCategoriaDto } from './dto/cambiar-estado-categoria.dto';
import { CreateCategoriaFlujoDto } from './dto/create-categoria-flujo.dto';
import { UpdateCategoriaFlujoDto } from './dto/update-categoria-flujo.dto';

@Controller('categorias-flujo')
export class CategoriasFlujoController {
  constructor(
    private readonly categoriasFlujoService: CategoriasFlujoService,
  ) {}

  @Get()
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  listar() {
    return this.categoriasFlujoService.listar();
  }

  @Get('inactivas')
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  listarInactivas() {
    return this.categoriasFlujoService.listarInactivas();
  }

  @Get(':id')
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  consultarUno(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriasFlujoService.consultarUno(id);
  }

  @Post()
  @Roles(Rol.ADMIN)
  crear(@Body() createCategoriaFlujoDto: CreateCategoriaFlujoDto) {
    return this.categoriasFlujoService.crear(createCategoriaFlujoDto);
  }

  @Patch(':id')
  @Roles(Rol.ADMIN)
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoriaFlujoDto: UpdateCategoriaFlujoDto,
  ) {
    return this.categoriasFlujoService.editar(id, updateCategoriaFlujoDto);
  }

  @Patch(':id/estado')
  @Roles(Rol.ADMIN)
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cambiarEstadoCategoriaDto: CambiarEstadoCategoriaDto,
  ) {
    return this.categoriasFlujoService.cambiarEstado(
      id,
      cambiarEstadoCategoriaDto,
    );
  }
}
