import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Roles } from './auth/decorators/roles.decorator';
import { Rol } from './generated/prisma/enums';

@Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/health')
  getHealth() {
    return this.appService.getHealth();
  }
}
