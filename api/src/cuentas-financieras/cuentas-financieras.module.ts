import { Module } from '@nestjs/common';
import { CuentasFinancierasService } from './cuentas-financieras.service';
import { CuentasFinancierasController } from './cuentas-financieras.controller';

@Module({
  providers: [CuentasFinancierasService],
  controllers: [CuentasFinancierasController],
})
export class CuentasFinancierasModule {}
