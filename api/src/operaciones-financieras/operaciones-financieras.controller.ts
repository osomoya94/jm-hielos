import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Rol } from '../generated/prisma/enums';
import { CreatePagoManualDto } from './dto/create-pago-manual.dto';
import { CreateCobroManualDto } from './dto/create-cobro-manual.dto';
import { OperacionesFinancierasService } from './operaciones-financieras.service';

@Roles(Rol.ADMIN)
@Controller('operaciones-financieras')
export class OperacionesFinancierasController {
  constructor(private readonly service: OperacionesFinancierasService) {}

  @Post('pagos-manuales')
  registrarPago(
    @Body() dto: CreatePagoManualDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user) throw new UnauthorizedException('Usuario no autenticado');
    return this.service.registrarPagoManual(dto, req.user.id);
  }

  @Post('cobros-manuales')
  registrarCobro(
    @Body() dto: CreateCobroManualDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user) throw new UnauthorizedException('Usuario no autenticado');
    return this.service.registrarCobroManual(dto, req.user.id);
  }
}
