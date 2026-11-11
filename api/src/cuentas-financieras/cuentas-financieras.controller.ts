import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CuentasFinancierasService } from './cuentas-financieras.service';
import { CreateCuentaFinancieraDto } from './dto/create-cuenta-financiera.dto';
import { UpdateCuentaFinancieraDto } from './dto/update-cuenta-financiera.dto';
import { CambiarEstadoCuentaDto } from './dto/cambiar-estado-cuenta.dto';
import { Rol } from '../generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';

@Roles(Rol.ADMIN)
@Controller('cuentas-financieras')
export class CuentasFinancierasController {
  constructor(
    private readonly cuentasFinancierasService: CuentasFinancierasService,
  ) {}

  @Get()
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  listar() {
    return this.cuentasFinancierasService.listar();
  }

  @Get('inactivas')
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  listarInactivas() {
    return this.cuentasFinancierasService.listarInactivas();
  }

  @Get(':id')
  @Roles(Rol.ADMIN, Rol.OPERADOR, Rol.LECTOR)
  consultarUno(@Param('id', ParseUUIDPipe) id: string) {
    return this.cuentasFinancierasService.consultarUno(id);
  }

  @Post()
  crear(@Body() createCuentaFinancieraDto: CreateCuentaFinancieraDto) {
    return this.cuentasFinancierasService.crear(createCuentaFinancieraDto);
  }

  @Patch(':id')
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCuentaFinancieraDto: UpdateCuentaFinancieraDto,
  ) {
    return this.cuentasFinancierasService.editar(id, updateCuentaFinancieraDto);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cambiarEstadoCuentaDto: CambiarEstadoCuentaDto,
  ) {
    return this.cuentasFinancierasService.cambiarEstado(
      id,
      cambiarEstadoCuentaDto,
    );
  }
}
