-- PENDIENTE de autorizaci?n para desarrollo. Probada primero en QA aislado.
BEGIN;

-- CreateEnum
CREATE TYPE "TipoListaPrecio" AS ENUM ('MINORISTA', 'MAYORISTA', 'ESPECIAL', 'EVENTOS');

-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('CONFIRMADA', 'ANULADA');

-- CreateTable
CREATE TABLE "ListaPrecio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoListaPrecio" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ListaPrecio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecioLista" (
    "listaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "precio" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "PrecioLista_pkey" PRIMARY KEY ("listaId","productoId")
);

-- CreateTable
CREATE TABLE "CondicionCliente" (
    "clienteId" TEXT NOT NULL,
    "listaId" TEXT NOT NULL,
    "consumidorFinal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CondicionCliente_pkey" PRIMARY KEY ("clienteId")
);

-- CreateTable
CREATE TABLE "PrecioCliente" (
    "clienteId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "precio" DECIMAL(18,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PrecioCliente_pkey" PRIMARY KEY ("clienteId","productoId")
);

-- CreateTable
CREATE TABLE "AuditoriaComercial" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "anterior" JSONB,
    "posterior" JSONB,

    CONSTRAINT "AuditoriaComercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperacionComercial" (
    "id" TEXT NOT NULL,
    "claveIdempotencia" TEXT NOT NULL,
    "huella" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultado" JSONB,

    CONSTRAINT "OperacionComercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venta" (
    "id" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fechaPedido" TIMESTAMP(3) NOT NULL,
    "fechaEntrega" TIMESTAMP(3) NOT NULL,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "envio" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL,
    "estado" "EstadoVenta" NOT NULL DEFAULT 'CONFIRMADA',
    "responsableCobranzaId" TEXT NOT NULL,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleVenta" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "nombreProducto" TEXT NOT NULL,
    "pesoKg" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(18,2) NOT NULL,
    "costoUnitario" DECIMAL(24,6),
    "estadoCosto" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "origenPrecio" TEXT NOT NULL,

    CONSTRAINT "DetalleVenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipanteVenta" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tarea" TEXT NOT NULL,
    "responsable" BOOLEAN NOT NULL,

    CONSTRAINT "ParticipanteVenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CobroVenta" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "operacionId" TEXT NOT NULL,
    "operacionFinancieraId" TEXT NOT NULL,
    "importe" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "CobroVenta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListaPrecio_nombre_key" ON "ListaPrecio"("nombre");

-- CreateIndex
CREATE INDEX "AuditoriaComercial_fechaRegistro_entidad_idx" ON "AuditoriaComercial"("fechaRegistro", "entidad");

-- CreateIndex
CREATE UNIQUE INDEX "OperacionComercial_claveIdempotencia_key" ON "OperacionComercial"("claveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "Venta_operacionId_key" ON "Venta"("operacionId");

-- CreateIndex
CREATE INDEX "Venta_clienteId_fechaEntrega_idx" ON "Venta"("clienteId", "fechaEntrega");

-- CreateIndex
CREATE UNIQUE INDEX "DetalleVenta_ventaId_productoId_key" ON "DetalleVenta"("ventaId", "productoId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipanteVenta_ventaId_tarea_usuarioId_key" ON "ParticipanteVenta"("ventaId", "tarea", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "CobroVenta_operacionId_key" ON "CobroVenta"("operacionId");

-- CreateIndex
CREATE UNIQUE INDEX "CobroVenta_operacionFinancieraId_key" ON "CobroVenta"("operacionFinancieraId");

-- CreateIndex
CREATE INDEX "CobroVenta_ventaId_idx" ON "CobroVenta"("ventaId");

-- AddForeignKey
ALTER TABLE "PrecioLista" ADD CONSTRAINT "PrecioLista_listaId_fkey" FOREIGN KEY ("listaId") REFERENCES "ListaPrecio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioLista" ADD CONSTRAINT "PrecioLista_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CondicionCliente" ADD CONSTRAINT "CondicionCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CondicionCliente" ADD CONSTRAINT "CondicionCliente_listaId_fkey" FOREIGN KEY ("listaId") REFERENCES "ListaPrecio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioCliente" ADD CONSTRAINT "PrecioCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioCliente" ADD CONSTRAINT "PrecioCliente_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditoriaComercial" ADD CONSTRAINT "AuditoriaComercial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacionComercial" ADD CONSTRAINT "OperacionComercial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_operacionId_fkey" FOREIGN KEY ("operacionId") REFERENCES "OperacionComercial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_responsableCobranzaId_fkey" FOREIGN KEY ("responsableCobranzaId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleVenta" ADD CONSTRAINT "DetalleVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleVenta" ADD CONSTRAINT "DetalleVenta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipanteVenta" ADD CONSTRAINT "ParticipanteVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipanteVenta" ADD CONSTRAINT "ParticipanteVenta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CobroVenta" ADD CONSTRAINT "CobroVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CobroVenta" ADD CONSTRAINT "CobroVenta_operacionId_fkey" FOREIGN KEY ("operacionId") REFERENCES "OperacionComercial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CobroVenta" ADD CONSTRAINT "CobroVenta_operacionFinancieraId_fkey" FOREIGN KEY ("operacionFinancieraId") REFERENCES "OperacionFinanciera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Validaciones de integridad de las tablas nuevas.
ALTER TABLE "PrecioLista" ADD CONSTRAINT "PrecioLista_positivo" CHECK ("precio" > 0);
ALTER TABLE "PrecioCliente" ADD CONSTRAINT "PrecioCliente_positivo" CHECK ("precio" > 0);
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_importes_validos" CHECK ("envio" >= 0 AND "total" > 0);
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_fechas_validas" CHECK ("fechaEntrega" >= "fechaPedido");
ALTER TABLE "DetalleVenta" ADD CONSTRAINT "DetalleVenta_valores_validos" CHECK ("cantidad" > 0 AND "pesoKg" > 0 AND "precioUnitario" > 0 AND ("costoUnitario" IS NULL OR "costoUnitario" >= 0));
ALTER TABLE "ParticipanteVenta" ADD CONSTRAINT "ParticipanteVenta_tarea_valida" CHECK ("tarea" IN ('PREPARACION', 'ENTREGA'));
ALTER TABLE "CobroVenta" ADD CONSTRAINT "CobroVenta_importe_positivo" CHECK ("importe" > 0);
CREATE UNIQUE INDEX "CondicionCliente_un_consumidor_final" ON "CondicionCliente" ("consumidorFinal") WHERE "consumidorFinal" = true;
CREATE UNIQUE INDEX "ParticipanteVenta_un_responsable_por_tarea" ON "ParticipanteVenta" ("ventaId", "tarea") WHERE "responsable" = true;

COMMIT;
