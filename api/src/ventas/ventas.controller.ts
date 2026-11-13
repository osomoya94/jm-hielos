import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Rol } from '../generated/prisma/enums';
import { VentasService } from './ventas.service';
import {
  AnularVentaDto,
  CobrarVentaDto,
  ConfirmarVentaDto,
} from './dto/ventas.dto';
@Controller('ventas')
@Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
export class VentasController {
  constructor(private readonly service: VentasService) {}
  @Get('disponibilidad') disponibilidad() {
    return this.service.disponibilidad();
  }
  @Get() listar(
    @Query('clienteId', new ParseUUIDPipe({ optional: true }))
    clienteId?: string,
  ) {
    return this.service.listar(clienteId);
  }
  @Get('clientes/:id/estado-cuenta') estado(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.estadoCuenta(id);
  }
  @Get(':id') consultar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.consultar(id);
  }
  @Post() @Roles(Rol.ADMIN, Rol.OPERADOR) confirmar(
    @Body() dto: ConfirmarVentaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.confirmar(dto, req.user!.id);
  }
  @Post(':id/cobros') @Roles(Rol.ADMIN, Rol.OPERADOR) cobrar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CobrarVentaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.cobrarVenta(id, dto, req.user!.id);
  }
  @Post(':id/anulacion') @Roles(Rol.ADMIN) anular(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnularVentaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.anular(id, dto, req.user!.id);
  }
}
