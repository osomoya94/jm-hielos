-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "pesoKg" INTEGER NOT NULL,
    "unidad" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);
