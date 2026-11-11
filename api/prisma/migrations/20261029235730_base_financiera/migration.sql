-- CreateEnum
CREATE TYPE "TipoCuentaFinanciera" AS ENUM ('EFECTIVO', 'BANCO', 'BILLETERA', 'INVERSION');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "ClaseMovimiento" AS ENUM ('FLUJO_EXTERNO', 'TRANSFERENCIA_INTERNA', 'AJUSTE_SIN_FLUJO');

-- CreateTable
CREATE TABLE "CuentaFinanciera" (
    "id" TEXT NOT NULL,
    "tipo" "TipoCuentaFinanciera" NOT NULL,
    "nombre" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "titularInterno" TEXT NOT NULL,
    "saldoInicial" DECIMAL(18,2) NOT NULL,
    "fechaApertura" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CuentaFinanciera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoFinanciero" (
    "id" TEXT NOT NULL,
    "sentido" "TipoMovimiento" NOT NULL,
    "importe" DECIMAL(18,2) NOT NULL,
    "clase" "ClaseMovimiento" NOT NULL,
    "fechaEfectiva" TIMESTAMP(3) NOT NULL,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detalle" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "MovimientoFinanciero_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CuentaFinanciera_nombre_key" ON "CuentaFinanciera"("nombre");

-- AddForeignKey
ALTER TABLE "MovimientoFinanciero" ADD CONSTRAINT "MovimientoFinanciero_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaFinanciera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoFinanciero" ADD CONSTRAINT "MovimientoFinanciero_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
