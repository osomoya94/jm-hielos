# Verificación del módulo de inventario

Actualización 13/11/2026: Inventario ya está migrado en desarrollo con datos conservados. Se agregaron **15 pruebas HTTP sobre PostgreSQL QA real**, incluidas transacciones, CHECK, índices únicos, pagos parciales y concurrencia. El total actual combinado con el circuito comercial es de 37 pruebas reales. Se corrigió el reconocimiento del conflicto de serialización del adaptador Prisma 7 al COMMIT (40001), además de P2034. API: 474 unitarias, 308 HTTP simuladas, build y lint sin errores; queda una advertencia previa en main.ts. Web: 28 pruebas, build/lint aprobados y recorrido comercial con navegador real. El registro del 11/11 que sigue se conserva como antecedente, no como estado actual de migraciones. Ver [matriz actualizada](estado-ERS.md) y [guía QA/comercial](comercial-qa.md).

Fecha: 11/11/2026. Rama local: `revision-frontend-ers`. Sin commits ni push.

## Resultados

| Control | Resultado |
|---|---|
| API `npm.cmd run build` | Aprobado |
| API `npm.cmd test -- --runInBand` | 16 suites, 473 pruebas aprobadas |
| API `npm.cmd run test:e2e -- --runInBand` | 5 suites, 308 pruebas HTTP aprobadas |
| API lint sin autofix y excluyendo cliente generado | Sin errores; advertencia previa `no-floating-promises` en `src/main.ts:18` |
| Web `npm.cmd run build` | Aprobado |
| Web `npm.cmd run lint` | Aprobado |
| Web `npm.cmd test` | 23 pruebas aprobadas |
| Revisión Chromium 1440×1000 y 390×844 | Aprobada, sin desborde horizontal de página; tablas con desplazamiento interno |
| SQL y colección Postman | Revisión estática: 12 tablas, 3 enums, 11 CHECK, sin operaciones destructivas ni alteración de tablas anteriores; JSON válido, 23 solicitudes |
| Migración / aceptación con PostgreSQL real | **Pendiente. No se ejecutó la migración ni se modificaron datos reales** |

En la primera compilación de Nest hubo un conflicto transitorio `ENOTEMPTY` en `dist`. Se verificó con salida temporal aislada y después se repitió el comando estándar `npm.cmd run build`, que terminó correctamente. No se detuvo el servidor del usuario.

## Qué comprueban las pruebas nuevas

- 44 pruebas de InventarioService: ejemplo CA-27, factores distintos de 100, otros insumos con cantidades fraccionarias, mínimos iniciales por tamaño, costo ponderado, conservación de valor al trasladar, consumo por uso/rotura, pagos parciales/posteriores, rechazo de pago anterior a la compra, idempotencia, stock insuficiente, rollback del circuito, participantes, devoluciones, salidas especiales, ajustes vinculados, conteos sin/con diferencia, fechas y reintentos P2034.
- 42 pruebas HTTP nuevas: aplicación Nest, JWT, roles, DTO y servicio reales, con Prisma simulado. Incluyen circuito completo, 401/403/409, nulos y estructuras inválidas, repetición de presentaciones, límites y fechas inválidas.
- 3 pruebas de protección del producto: rechazar cambio de peso vinculado a insumos o movimientos, y permitir renombrado.
- 3 pruebas web: ubicaciones/presentaciones, fecha argentina con zona explícita y saldo monetario exacto/costos menores a un centavo.
- Se ejecutaron también las pruebas anteriores de catálogos, autenticación, Cash Flow y operaciones financieras.

El doble de Prisma conserva estado y revierte su copia cuando falla un callback transaccional. Esto verifica cómo se agrupan los efectos de la aplicación; **no prueba el aislamiento, los bloqueos, índices ni restricciones de PostgreSQL**. Las comprobaciones reales de migración, persistencia y concurrencia están detalladas en la guía y requieren la revisión previa del SQL solicitada por el usuario.

## Revisión visual e interacción

Se utilizó un Chrome headless con perfil temporal separado. Las peticiones de negocio de esa sesión se interceptaron con datos exclusivos de QA. La aplicación entregada consulta la API; no incorpora mocks ni fallback con cifras de ejemplo.

Comprobado: navegación Stock/Insumos/Producción, alta/configuración de insumo, presentación de 80, compra/pago parcial, traslado, reintento de red conservando la misma clave, registro de lote con roturas, conteo, fallo de consulta/reintento y permisos ADMIN/OPERADOR/LECTOR. Se verificaron etiquetas de campos y ausencia de excepciones de ejecución. Las tablas son regiones con nombre y foco por teclado; se reutilizan el diálogo accesible y los estados de foco existentes.

Capturas:

- [Insumos escritorio](capturas/inventario-insumos-1440.png)
- [Insumos móvil](capturas/inventario-insumos-390.png)
- [Producción escritorio](capturas/inventario-produccion-1440.png)
- [Producción móvil](capturas/inventario-produccion-390.png)
- [Stock escritorio](capturas/inventario-stock-1440.png)
- [Stock móvil](capturas/inventario-stock-390.png)
- [Formulario de lote móvil](capturas/inventario-lote-formulario-390.png)

Las cifras de estas imágenes son de QA y no describen las existencias del negocio. Los formularios largos usan desplazamiento dentro del diálogo; las tablas mantienen el desplazamiento dentro de su contenedor en móvil.

## Entrega y límites

La [guía del módulo](inventario-produccion.md) contiene decisiones, archivos, 14 endpoints, cobertura RF, SQL pendiente y procedimiento de PostgreSQL/Postman. Importar la [colección Postman](JM-Hielos-Inventario.postman_collection.json) únicamente después de revisar/aplicar la migración sobre el destino correcto y configurar IDs/token locales.

Pendientes del alcance posterior: Ventas y Fiados no se desarrollaron; eventos/rendición, duración estimada de insumos (RF-INS-09 F1), reportes comerciales por persona (RF-STK-11 F1) y anulaciones integrales compensadas siguen pendientes. RF-STK-06 a 08 están parcialmente preparados mediante salidas especiales e integración interna para un futuro descuento único de ventas. No existe control físico del hielo en heladeras de clientes ni predicción de reposiciones.
