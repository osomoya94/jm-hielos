-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "referencia" TEXT,
    "tipoCliente" TEXT NOT NULL,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);
