import { Module } from '@nestjs/common';
import { PreciosService } from './precios.service';
import { PreciosController } from './precios.controller';
@Module({
  providers: [PreciosService],
  controllers: [PreciosController],
  exports: [PreciosService],
})
export class PreciosModule {}
