/*
  Warnings:

  - Added the required column `operacionId` to the `MovimientoFinanciero` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GrupoFlujo" AS ENUM ('OPERACION', 'INVERSION_ACTIVOS', 'FINANCIACION', 'APORTES', 'RETIROS', 'GARANTIAS', 'OTROS');

-- CreateEnum
CREATE TYPE "TipoOperacionFinanciera" AS ENUM ('COBRO', 'PAGO', 'TRANSFERENCIA', 'AJUSTE', 'REVERSION', 'REEMBOLSO');

-- AlterTable
ALTER TABLE "MovimientoFinanciero" ADD COLUMN     "categoriaId" TEXT,
ADD COLUMN     "operacionId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "CategoriaFlujo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "grupo" "GrupoFlujo" NOT NULL,
    "sentido" "TipoMovimiento" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CategoriaFlujo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperacionFinanciera" (
    "id" TEXT NOT NULL,
    "claveIdempotencia" TEXT NOT NULL,
    "tipo" "TipoOperacionFinanciera" NOT NULL,
    "origenTipo" TEXT,
    "origenId" TEXT,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT,
    "referencia" TEXT,
    "usuarioId" TEXT NOT NULL,
    "reversionDeId" TEXT,

    CONSTRAINT "OperacionFinanciera_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaFlujo_grupo_sentido_nombre_key" ON "CategoriaFlujo"("grupo", "sentido", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "OperacionFinanciera_claveIdempotencia_key" ON "OperacionFinanciera"("claveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "OperacionFinanciera_reversionDeId_key" ON "OperacionFinanciera"("reversionDeId");

-- CreateIndex
CREATE INDEX "MovimientoFinanciero_cuentaId_fechaEfectiva_idx" ON "MovimientoFinanciero"("cuentaId", "fechaEfectiva");

-- CreateIndex
CREATE INDEX "MovimientoFinanciero_operacionId_idx" ON "MovimientoFinanciero"("operacionId");

-- AddForeignKey
ALTER TABLE "MovimientoFinanciero" ADD CONSTRAINT "MovimientoFinanciero_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaFlujo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoFinanciero" ADD CONSTRAINT "MovimientoFinanciero_operacionId_fkey" FOREIGN KEY ("operacionId") REFERENCES "OperacionFinanciera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacionFinanciera" ADD CONSTRAINT "OperacionFinanciera_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacionFinanciera" ADD CONSTRAINT "OperacionFinanciera_reversionDeId_fkey" FOREIGN KEY ("reversionDeId") REFERENCES "OperacionFinanciera"("id") ON DELETE SET NULL ON UPDATE CASCADE;
