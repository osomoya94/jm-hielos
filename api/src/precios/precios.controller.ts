import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Rol } from '../generated/prisma/enums';
import { PreciosService } from './precios.service';
import {
  CondicionClienteDto,
  CrearListaDto,
  EditarListaDto,
  MotivoPrecioDto,
  PrecioParticularDto,
  PrecioProductoDto,
} from './dto/precios.dto';

@Controller('precios')
@Roles(Rol.ADMIN)
export class PreciosController {
  constructor(private readonly service: PreciosService) {}
  @Post(':id/configuracion')
  editarLista(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditarListaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.editarLista(id, dto, req.user!.id);
  }
  @Get() @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR) listar() {
    return this.service.listar();
  }
  @Get('clientes/:id') @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR) cliente(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.consultarCliente(id);
  }
  @Post() crear(@Body() dto: CrearListaDto, @Req() req: AuthenticatedRequest) {
    return this.service.crear(dto, req.user!.id);
  }
  @Post('inicializar') inicializar(
    @Body() dto: MotivoPrecioDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.inicializar(dto, req.user!.id);
  }
  @Post(':id/productos') precio(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PrecioProductoDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.guardarPrecio(id, dto, req.user!.id);
  }
  @Post('clientes/:id/condicion') condicion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CondicionClienteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.configurarCliente(id, dto, req.user!.id);
  }
  @Post('clientes/:id/particulares') particular(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PrecioParticularDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.guardarParticular(id, dto, req.user!.id);
  }
}
