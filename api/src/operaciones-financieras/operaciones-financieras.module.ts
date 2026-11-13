import { Module } from '@nestjs/common';
import { OperacionesFinancierasService } from './operaciones-financieras.service';
import { OperacionesFinancierasController } from './operaciones-financieras.controller';

@Module({
  controllers: [OperacionesFinancierasController],
  providers: [OperacionesFinancierasService],
})
export class OperacionesFinancierasModule {}
