-- DropForeignKey
ALTER TABLE "MovimientoFinanciero" DROP CONSTRAINT "MovimientoFinanciero_categoriaId_fkey";

-- AddForeignKey
ALTER TABLE "MovimientoFinanciero" ADD CONSTRAINT "MovimientoFinanciero_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaFlujo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
