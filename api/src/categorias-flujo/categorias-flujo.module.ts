import { Module } from '@nestjs/common';
import { CategoriasFlujoController } from './categorias-flujo.controller';
import { CategoriasFlujoService } from './categorias-flujo.service';

@Module({
  controllers: [CategoriasFlujoController],
  providers: [CategoriasFlujoService],
})
export class CategoriasFlujoModule {}
