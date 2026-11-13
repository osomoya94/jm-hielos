import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Rol } from '../generated/prisma/enums';
import {
  AccionStock,
  CompraInsumoDto,
  CrearInsumoDto,
  EditarInsumoDto,
  LoteDto,
  MovimientoInsumoDto,
  MovimientoStockDto,
  PagoCompraDto,
  PresentacionDto,
  TrasladoDto,
} from './dto/inventario.dto';
import { InventarioService } from './inventario.service';

@Roles(Rol.ADMIN)
@Controller('inventario')
export class InventarioController {
  constructor(private readonly service: InventarioService) {}

  private usuario(req: AuthenticatedRequest) {
    if (!req.user) throw new UnauthorizedException('Usuario no autenticado');
    return req.user;
  }

  @Get('insumos')
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  insumos() {
    return this.service.listarInsumos();
  }

  @Post('insumos')
  crear(@Body() dto: CrearInsumoDto) {
    return this.service.crearInsumo(dto);
  }

  @Patch('insumos/:id')
  editar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EditarInsumoDto) {
    return this.service.editarInsumo(id, dto);
  }

  @Post('insumos/:id/presentaciones')
  presentacion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PresentacionDto,
  ) {
    return this.service.agregarPresentacion(id, dto);
  }

  @Get('compras')
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  compras() {
    return this.service.listarCompras();
  }

  @Post('compras')
  comprar(@Body() dto: CompraInsumoDto, @Req() req: AuthenticatedRequest) {
    return this.service.comprar(dto, this.usuario(req).id);
  }

  @Post('compras/:id/pagos')
  pagar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PagoCompraDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.pagarCompra(id, dto, this.usuario(req).id);
  }

  @Post('traslados')
  trasladar(@Body() dto: TrasladoDto, @Req() req: AuthenticatedRequest) {
    return this.service.trasladar(dto, this.usuario(req).id);
  }

  @Post('insumos/movimientos')
  moverInsumo(
    @Body() dto: MovimientoInsumoDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.moverMateriaPrima(dto, this.usuario(req).id);
  }

  @Get('produccion')
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  lotes() {
    return this.service.listarLotes();
  }

  @Post('produccion')
  producir(@Body() dto: LoteDto, @Req() req: AuthenticatedRequest) {
    return this.service.producir(dto, this.usuario(req).id);
  }

  @Get('stock')
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  stock() {
    return this.service.listarStock();
  }

  @Post('stock/movimientos')
  @Roles(Rol.ADMIN, Rol.OPERADOR)
  moverStock(
    @Body() dto: MovimientoStockDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const usuario = this.usuario(req);
    if (
      usuario.rol !== Rol.ADMIN &&
      ![AccionStock.OBSEQUIO, AccionStock.CONSUMO_INTERNO].includes(dto.accion)
    )
      throw new ForbiddenException(
        'Solo el administrador puede ajustar, contar, registrar pérdidas o devoluciones',
      );
    return this.service.moverStock(dto, usuario.id);
  }

  @Get('movimientos')
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  movimientos(
    @Query('cursor', new ParseUUIDPipe({ optional: true })) cursor?: string,
  ) {
    return this.service.listarMovimientos(cursor);
  }
}
