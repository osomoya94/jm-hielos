import { Module } from '@nestjs/common';
import { InventarioModule } from '../inventario/inventario.module';
import { PreciosModule } from '../precios/precios.module';
import { VentasController } from './ventas.controller';
import { VentasService } from './ventas.service';
@Module({
  imports: [InventarioModule, PreciosModule],
  controllers: [VentasController],
  providers: [VentasService],
})
export class VentasModule {}
