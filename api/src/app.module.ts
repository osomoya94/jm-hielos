import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { ProductosModule } from './productos/productos.module';
import { ClientesModule } from './clientes/clientes.module';
import { ProveedoresModule } from './proveedores/proveedores.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { AuthModule } from './auth/auth.module';
import { CuentasFinancierasModule } from './cuentas-financieras/cuentas-financieras.module';
import { CategoriasFlujoModule } from './categorias-flujo/categorias-flujo.module';
import { OperacionesFinancierasModule } from './operaciones-financieras/operaciones-financieras.module';
import { CashFlowModule } from './cash-flow/cash-flow.module';
import { InventarioModule } from './inventario/inventario.module';
import { PreciosModule } from './precios/precios.module';
import { VentasModule } from './ventas/ventas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ProductosModule,
    ClientesModule,
    ProveedoresModule,
    UsuariosModule,
    AuthModule,
    CuentasFinancierasModule,
    CategoriasFlujoModule,
    OperacionesFinancierasModule,
    CashFlowModule,
    InventarioModule,
    PreciosModule,
    VentasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
