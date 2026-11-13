import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../generated/prisma/enums';
import { CashFlowService } from './cash-flow.service';
import { ConsultarCashFlowDto } from './dto/consultar-cash-flow.dto';

@Controller('cash-flow')
@Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
export class CashFlowController {
  constructor(private readonly service: CashFlowService) {}

  @Get()
  consultar(@Query() dto: ConsultarCashFlowDto) {
    return this.service.consultar(dto);
  }
}
