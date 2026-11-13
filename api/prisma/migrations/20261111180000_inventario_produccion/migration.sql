-- Migración aditiva. No carga ni elimina datos existentes.
BEGIN;

-- CreateEnum
CREATE TYPE "TipoInsumo" AS ENUM ('BOLSA', 'OTRO');

-- CreateEnum
CREATE TYPE "UbicacionInsumo" AS ENUM ('DEPOSITO', 'PRODUCCION');

-- CreateEnum
CREATE TYPE "TipoOperacionInventario" AS ENUM ('COMPRA', 'PAGO_COMPRA', 'TRASLADO', 'PRODUCCION', 'CONSUMO', 'PERDIDA', 'DEVOLUCION_PROVEEDOR', 'DEVOLUCION', 'OBSEQUIO', 'CONSUMO_INTERNO', 'AJUSTE', 'CONTEO', 'VENTA');

-- CreateTable
CREATE TABLE "Insumo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoInsumo" NOT NULL,
    "unidad" TEXT NOT NULL,
    "stockMinimo" DECIMAL(18,3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "productoId" TEXT,

    CONSTRAINT "Insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresentacionInsumo" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "factor" DECIMAL(18,3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PresentacionInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExistenciaInsumo" (
    "id" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "ubicacion" "UbicacionInsumo" NOT NULL,
    "unidades" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "valor" DECIMAL(24,6) NOT NULL DEFAULT 0,

    CONSTRAINT "ExistenciaInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperacionInventario" (
    "id" TEXT NOT NULL,
    "claveIdempotencia" TEXT NOT NULL,
    "huella" TEXT NOT NULL,
    "tipo" "TipoOperacionInventario" NOT NULL,
    "fechaEfectiva" TIMESTAMP(3) NOT NULL,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT NOT NULL,
    "origenTipo" TEXT NOT NULL,
    "origenId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "resultado" JSONB,
    "corrigeOperacionId" TEXT,

    CONSTRAINT "OperacionInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoInsumo" (
    "id" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "ubicacion" "UbicacionInsumo" NOT NULL,
    "unidades" DECIMAL(18,3) NOT NULL,
    "valor" DECIMAL(24,6) NOT NULL,
    "saldoPosterior" DECIMAL(18,3) NOT NULL,
    "detalle" TEXT NOT NULL,

    CONSTRAINT "MovimientoInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompraInsumo" (
    "id" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "comprobante" TEXT NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "pagado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vencimiento" TIMESTAMP(3),

    CONSTRAINT "CompraInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleCompraInsumo" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "paquetes" INTEGER NOT NULL,
    "factor" DECIMAL(18,3) NOT NULL,
    "costoTotal" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "DetalleCompraInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoCompraInsumo" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "operacionFinancieraId" TEXT NOT NULL,
    "importe" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "PagoCompraInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoteProduccion" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "responsableId" TEXT NOT NULL,
    "bolsasUsadas" INTEGER NOT NULL,
    "bolsasRotas" INTEGER NOT NULL,
    "cantidadApta" INTEGER NOT NULL,
    "cantidadEsperada" INTEGER,
    "hieloDescartadoKg" DECIMAL(18,3) NOT NULL,

    CONSTRAINT "LoteProduccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProduccionParticipante" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "ProduccionParticipante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTerminado" (
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StockTerminado_pkey" PRIMARY KEY ("productoId")
);

-- CreateTable
CREATE TABLE "MovimientoStock" (
    "id" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "saldoAnterior" INTEGER NOT NULL,
    "saldoPosterior" INTEGER NOT NULL,

    CONSTRAINT "MovimientoStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Insumo_nombre_key" ON "Insumo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "PresentacionInsumo_insumoId_nombre_key" ON "PresentacionInsumo"("insumoId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ExistenciaInsumo_presentacionId_ubicacion_key" ON "ExistenciaInsumo"("presentacionId", "ubicacion");

-- CreateIndex
CREATE UNIQUE INDEX "OperacionInventario_claveIdempotencia_key" ON "OperacionInventario"("claveIdempotencia");

-- CreateIndex
CREATE INDEX "OperacionInventario_fechaEfectiva_tipo_idx" ON "OperacionInventario"("fechaEfectiva", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "OperacionInventario_origenTipo_origenId_key" ON "OperacionInventario"("origenTipo", "origenId");

-- CreateIndex
CREATE INDEX "MovimientoInsumo_presentacionId_ubicacion_idx" ON "MovimientoInsumo"("presentacionId", "ubicacion");

-- CreateIndex
CREATE INDEX "MovimientoInsumo_operacionId_idx" ON "MovimientoInsumo"("operacionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompraInsumo_operacionId_key" ON "CompraInsumo"("operacionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompraInsumo_proveedorId_comprobante_key" ON "CompraInsumo"("proveedorId", "comprobante");

-- CreateIndex
CREATE UNIQUE INDEX "DetalleCompraInsumo_compraId_presentacionId_key" ON "DetalleCompraInsumo"("compraId", "presentacionId");

-- CreateIndex
CREATE UNIQUE INDEX "PagoCompraInsumo_operacionId_key" ON "PagoCompraInsumo"("operacionId");

-- CreateIndex
CREATE UNIQUE INDEX "PagoCompraInsumo_operacionFinancieraId_key" ON "PagoCompraInsumo"("operacionFinancieraId");

-- CreateIndex
CREATE UNIQUE INDEX "LoteProduccion_codigo_key" ON "LoteProduccion"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "LoteProduccion_operacionId_key" ON "LoteProduccion"("operacionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProduccionParticipante_loteId_usuarioId_key" ON "ProduccionParticipante"("loteId", "usuarioId");

-- CreateIndex
CREATE INDEX "MovimientoStock_productoId_operacionId_idx" ON "MovimientoStock"("productoId", "operacionId");

-- AddForeignKey
ALTER TABLE "Insumo" ADD CONSTRAINT "Insumo_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentacionInsumo" ADD CONSTRAINT "PresentacionInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExistenciaInsumo" ADD CONSTRAINT "ExistenciaInsumo_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "PresentacionInsumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacionInventario" ADD CONSTRAINT "OperacionInventario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacionInventario" ADD CONSTRAINT "OperacionInventario_corrigeOperacionId_fkey" FOREIGN KEY ("corrigeOperacionId") REFERENCES "OperacionInventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInsumo" ADD CONSTRAINT "MovimientoInsumo_operacionId_fkey" FOREIGN KEY ("operacionId") REFERENCES "OperacionInventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInsumo" ADD CONSTRAINT "MovimientoInsumo_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "PresentacionInsumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraInsumo" ADD CONSTRAINT "CompraInsumo_operacionId_fkey" FOREIGN KEY ("operacionId") REFERENCES "OperacionInventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraInsumo" ADD CONSTRAINT "CompraInsumo_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleCompraInsumo" ADD CONSTRAINT "DetalleCompraInsumo_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "CompraInsumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleCompraInsumo" ADD CONSTRAINT "DetalleCompraInsumo_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "PresentacionInsumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoCompraInsumo" ADD CONSTRAINT "PagoCompraInsumo_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "CompraInsumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoCompraInsumo" ADD CONSTRAINT "PagoCompraInsumo_operacionId_fkey" FOREIGN KEY ("operacionId") REFERENCES "OperacionInventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoCompraInsumo" ADD CONSTRAINT "PagoCompraInsumo_operacionFinancieraId_fkey" FOREIGN KEY ("operacionFinancieraId") REFERENCES "OperacionFinanciera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteProduccion" ADD CONSTRAINT "LoteProduccion_operacionId_fkey" FOREIGN KEY ("operacionId") REFERENCES "OperacionInventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteProduccion" ADD CONSTRAINT "LoteProduccion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteProduccion" ADD CONSTRAINT "LoteProduccion_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProduccionParticipante" ADD CONSTRAINT "ProduccionParticipante_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "LoteProduccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProduccionParticipante" ADD CONSTRAINT "ProduccionParticipante_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTerminado" ADD CONSTRAINT "StockTerminado_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_operacionId_fkey" FOREIGN KEY ("operacionId") REFERENCES "OperacionInventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defensa adicional ante escrituras fuera de la API.
ALTER TABLE "Insumo" ADD CONSTRAINT "Insumo_minimo_no_negativo" CHECK ("stockMinimo" >= 0);
ALTER TABLE "Insumo" ADD CONSTRAINT "Insumo_producto_segun_tipo" CHECK (
  ("tipo" = 'BOLSA' AND "productoId" IS NOT NULL) OR ("tipo" = 'OTRO' AND "productoId" IS NULL)
);
ALTER TABLE "PresentacionInsumo" ADD CONSTRAINT "Presentacion_factor_positivo" CHECK ("factor" > 0);
ALTER TABLE "ExistenciaInsumo" ADD CONSTRAINT "Existencia_sin_negativos" CHECK ("unidades" >= 0 AND "valor" >= 0 AND ("unidades" > 0 OR "valor" = 0));
ALTER TABLE "MovimientoInsumo" ADD CONSTRAINT "MovimientoInsumo_saldo_valido" CHECK ("saldoPosterior" >= 0);
ALTER TABLE "CompraInsumo" ADD CONSTRAINT "Compra_importes_validos" CHECK ("total" > 0 AND "pagado" >= 0 AND "pagado" <= "total");
ALTER TABLE "DetalleCompraInsumo" ADD CONSTRAINT "DetalleCompra_valores_positivos" CHECK ("paquetes" > 0 AND "factor" > 0 AND "costoTotal" > 0);
ALTER TABLE "PagoCompraInsumo" ADD CONSTRAINT "PagoCompra_importe_positivo" CHECK ("importe" > 0);
ALTER TABLE "LoteProduccion" ADD CONSTRAINT "Lote_cantidades_validas" CHECK (
  "cantidadApta" >= 0 AND "bolsasUsadas" >= "cantidadApta" AND "bolsasRotas" >= 0 AND "hieloDescartadoKg" >= 0 AND ("cantidadEsperada" IS NULL OR "cantidadEsperada" >= 0)
);
ALTER TABLE "StockTerminado" ADD CONSTRAINT "StockTerminado_no_negativo" CHECK ("cantidad" >= 0);
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_saldos_validos" CHECK ("saldoAnterior" >= 0 AND "saldoPosterior" >= 0 AND "saldoPosterior" = "saldoAnterior" + "cantidad");

COMMIT;
