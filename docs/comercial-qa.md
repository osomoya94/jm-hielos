# Auditoría, QA e implementación comercial — 13/11/2026

Se completó la auditoría de los 178 RF de la ERS 1.4 y la aceptación real del circuito existente de Inventario/Producción. Se implementó el circuito base de Precios, Ventas/Entregas y Cobros/Deudas en backend y web. **La ERS integral y las etapas B–C todavía no están completas.** Las dependencias faltantes se detallan al final y en la [matriz](estado-ERS.md).

## Estado de las bases

- Desarrollo `jm_hielos`, local en `127.0.0.1:5433`: nueve migraciones aplicadas. La comercial se aplicó con autorización el 13/11/2026 y se conservaron los datos de las veinte tablas de negocio previas. Prisma informa cero pendientes y ninguna diferencia con el schema. No se cargaron ejemplos ni se borró ninguna tabla/volumen.
- QA `jm_hielos_qa_ers14`, en el mismo PostgreSQL local: nueve migraciones aplicadas. Base independiente creada para estas pruebas, sin copiar datos ni credenciales de usuarios reales. Las pruebas dejan sus registros QA con nombres exclusivos y UUID nuevos; no usan reset, TRUNCATE ni borrado para repetirse.
- `postgres-qa.mjs` calcula conteos y SHA-256 de **todas** las tablas de desarrollo antes y después. Si detecta un cambio, detiene la ejecución y lo informa. No imprime contenido ni credenciales.
- El respaldo original SQL externo se conserva en `../jm-hielos-respaldos/jm_hielos_pre_inventario_20261112213952.sql` (ruta relativa a la raíz del repositorio); SHA-256 `115a6ea2756de31ef09302bc6fa4e01282db1a08cb42c77e56193a0d486b97e5`.
- El respaldo previo a Comercial está en ../jm-hielos-respaldos/jm_hielos_pre_comercial_20261113_170144Z.sql, junto a su .sha256: e0a671105eb106b70ef7eb0eeafd08296ea7ae138dc3e58d7df37dfa1708fd73. Se verificaron sus 21 bloques COPY y 20 filas antes de aplicar la migración.

## SQL comercial aplicado con autorización

Archivo completo para revisar: [20261113180000_precios_ventas_cobros/migration.sql](../api/prisma/migrations/20261113180000_precios_ventas_cobros/migration.sql).

Contiene BEGIN/COMMIT, dos enums (`TipoListaPrecio`, `EstadoVenta`) y diez tablas nuevas:

| Tabla | Función |
| --- | --- |
| ListaPrecio / PrecioLista | Modalidad y precio actual por producto |
| CondicionCliente / PrecioCliente | Lista asignada, Consumidor final y acuerdos particulares |
| AuditoriaComercial | Actor, fecha, motivo y valores de los cambios comerciales |
| OperacionComercial | Clave de idempotencia, huella y respuesta original |
| Venta / DetalleVenta | Entrega, envío, estado y nombre/peso/precio históricos |
| ParticipanteVenta | Preparación/entrega, responsable y hasta dos ayudantes por tarea |
| CobroVenta | Aplicación del cobro y vínculo con el único libro financiero |

Agrega claves/índices y siete CHECK en tablas nuevas. Dos índices únicos parciales impiden más de un Consumidor final y más de un responsable por tarea/venta. No altera columnas de las tablas existentes, no carga registros y no contiene operaciones destructivas. Las relaciones inversas nuevas en Prisma no crean columnas en clientes, productos, usuarios ni operaciones financieras. Las FK protegen las referencias a registros existentes.

Se verificó primero en QA y luego se aplicó exclusivamente a desarrollo con autorización. El cliente Prisma fue regenerado y los builds de NestJS/React están aprobados. La web ya permite acceder a Precios, Ventas y Deudas sin el bloqueo que dependía de esta migración. Desarrollo conserva sus datos reales y requiere configuración inicial antes de operar.

Comando utilizado para aplicar esta novena migración desde `api/`:

```powershell
npx.cmd prisma migrate deploy --config prisma7.config.ts
```

Aplica todas las migraciones pendientes; revisar nuevamente `migrate status` antes de usarlo.

## Circuitos implementados y evidencia

- **A / Inventario:** compras impagas o parciales, traslado de paquetes completos, costo conservado, uso/roturas/sobrantes de lotes, aptas, alertas, pérdidas/devoluciones, ajustes y conteos. Quince casos HTTP sobre PostgreSQL real, además de las pruebas previas.
- **Precios:** crear, consultar y editar nombre/estado de listas; configurar un precio por producto; asignar lista al cliente y precio particular activable/desactivable. ADMIN puede preparar explícitamente los tamaños iniciales, modalidades y Consumidor final. No se inventan precios ni se cambian los valores existentes al preparar el catálogo. Los cambios comerciales se auditan.
- **Venta habitual:** varios productos, precio validado por el servidor contra el resumen, envío, fechas separadas, preparación y entrega con participantes, seguimiento de cobranza. Conserva nombre, peso y precio históricos. Los costos permanecen `PENDIENTE`/null hasta integrar el costeo H; null no equivale a cero.
- **Confirmación:** venta, detalle, participantes, un solo descuento de stock, cobro/deuda y auditoría en una transacción Serializable. Misma clave/mismos datos devuelve la respuesta original; otra carga o usuario con esa clave devuelve 409.
- **Cobros:** fiado, pagos mixtos y parciales sucesivos. Cada cobro conserva cuenta, categoría, usuario, fecha efectiva y aplicación. No crea una venta ni otro retiro de stock. Se rechazan sobrepagos, cuentas inactivas, moneda distinta de ARS, fechas inválidas y categorías de egreso.
- **Estado de cuenta:** historial de ventas/cobros, saldo real, responsable de seguimiento y antigüedad en días locales de Argentina. El cobro en otro período entra al Cash Flow en su fecha efectiva. No se generan ingresos por deudas pendientes.
- **Anulación de venta:** ADMIN, motivo y devolución apta realmente declarada, limitada por producto vendido. Cancela la deuda y conserva lo cobrado identificado como crédito. No genera automáticamente un reembolso. Reversión de cobros, reembolsos y cierres siguen pendientes.
- **Permisos:** ADMIN configura; ADMIN/OPERADOR entregan y cobran; LECTOR consulta. El servidor comprueba el rol vigente en base de datos. OPERADOR no cambia precios ni anula ventas.

## Pruebas y reproducción

Desde `api/`, con Docker/PostgreSQL local funcionando y la conexión configurada de forma privada:

```powershell
npm.cmd run qa:preparar
npm.cmd run test:postgres
npm.cmd run build
npm.cmd run test:web:qa
```

`qa:preparar` crea QA si no existe y aplica migraciones solo allí. `test:postgres` ejecuta 37 pruebas HTTP usando AppModule, DTO, guards, servicios y Prisma reales. Solo la configuración de firma JWT es exclusiva de pruebas; no se simula ningún proveedor de datos. Jest necesita emitir ESM para cargar el compilador real de Prisma 7: [Jest ESM](https://jestjs.io/docs/30.0/ecmascript-modules), [ts-jest ESM](https://kulshekhar.github.io/ts-jest/docs/guides/esm-support).

`test:web:qa` requiere Chrome instalado en su ruta habitual de Windows. Inicia temporalmente NestJS QA en 3105 y Vite QA en 5175, crea usuarios y credenciales aleatorias exclusivamente QA y usa un perfil Chrome independiente en `api/.tmp`. No imprime credenciales y cierra sus propios procesos al terminar. Es una comprobación real del navegador, sin interceptar API ni usar cifras de fallback. No inicia ni detiene los servidores de desarrollo.

El recorrido ampliado crea y edita catálogos desde React, verifica baja/reactivación lógica, compra por 7.000 con pagos por 3.000, traslada paquetes y produce 50/20 bolsas. Configura lista y precio particular; OPERADOR registra ventas parcial, cobrada con varios productos y fiada, con cobros posteriores. Resultado: stock 3/15, deuda de cliente 6.400, saldo de proveedor 4.000 y cuatro cobros. Cash Flow comprueba ingresos reales 103.600 y egresos 3.000, sin sumar aperturas ni deudas. LECTOR recorre todas las pantallas habilitadas sin escritura. Se comprueban 1440 y 390 px, sin desborde horizontal de página. El modo npm.cmd run demo:qa mantiene otra base local aislada para presentar esos ejemplos en 5173; ver [guia-demo.md](guia-demo.md).

| Verificación final | Resultado |
| --- | --- |
| API unitarias | 474 aprobadas / 16 suites |
| API HTTP con Prisma simulado | 308 aprobadas / 5 suites |
| API HTTP con PostgreSQL QA | 37 aprobadas / 2 suites (15 Inventario, 22 comerciales) |
| NestJS build | Aprobado |
| API lint, incluidos scripts QA, sin autofix | Cero errores; una advertencia previa en main.ts:18 |
| Web pruebas | 28 aprobadas |
| Web lint/build | Aprobados |
| Chrome con API/PostgreSQL reales | Recorrido aprobado y cero excepciones JavaScript |

Las pruebas reales detectaron un conflicto al COMMIT devuelto como `DriverAdapterError`, causa `TransactionWriteConflict/40001`. Se corrigió el reconocimiento además de P2034 en Inventario, Ventas y las escrituras serializables relacionadas. Se conserva el límite de tres intentos y la misma clave de operación. Regresión unitaria y concurrencia real aprobadas. No se modificaron dependencias para ocultar el error.

El ejecutor ESM produce la advertencia experimental de Node y Prisma/pg informa una advertencia de compatibilidad futura sobre consultas del cliente. No son fallos de las verificaciones actuales ni se modificó código de node_modules.

Capturas con registros exclusivamente QA: [escritorio](capturas/comercial-qa-1440.png), [móvil](capturas/comercial-qa-390.png).

## Archivos creados y modificados en estas etapas

- Auditoría/documentación: `docs/estado-ERS.md`, esta guía, actualización de `docs/inventario-produccion.md` y `docs/verificacion-inventario.md`.
- Persistencia: ampliación de api/prisma/schema.prisma y migración comercial aplicada con autorización en desarrollo.
- Backend nuevo: `api/src/precios/` y `api/src/ventas/` (module, controller, service y DTO). Integración en `api/src/app.module.ts`.
- Corrección transaccional: `api/src/prisma/conflicto-transaccion.ts`, `inventario.service.ts`, `inventario.service.spec.ts` y `productos.service.ts`.
- QA: `api/scripts/postgres-qa.mjs`, `api/scripts/comercial-browser-qa.mjs`, `api/test/jest-postgres.json`, `api/test/postgres/setup.ts`, `inventario.postgres-spec.ts` y `ventas.postgres-spec.ts`. Comandos en `api/package.json`; ESLint permite revisar los scripts ESM sin reglas de tipos de TS.
- Web: `web/src/comercial.js`, `web/src/components/comercial/` (vista, formularios de precio/venta/cobro y formulario común), navegación en `App.jsx`, accesos de `Inicio.jsx`/`AccesosRapidos.jsx`, `ControlesPendientes.jsx` y ajuste de ancho interno de tabla en `App.css`. Pruebas en `web/test/comercial.test.js` y dos capturas QA.
- No se agregaron dependencias, commits, push, merge ni cambios en GitHub. Se preservaron los cambios locales anteriores.

## Prueba manual desde la web después de autorizar la migración

1. Arrancar NestJS y Vite con los comandos existentes. Ingresar con ADMIN. Hasta aplicar el SQL autorizado, Precios/Ventas/Deudas muestran habilitación pendiente.
2. En **Precios**, crear listas o preparar explícitamente el catálogo inicial. Ingresar precios reales por producto. Asignar una lista al cliente y, si corresponde, un particular. Consumidor final utiliza minorista.
3. Desde **Cuentas/Categorías**, asegurar cuentas ARS activas y una categoría de INGRESO activa. Para compras pagadas también se requiere EGRESO activo; la categoría de egreso actual no fue reactivada automáticamente.
4. Usar stock real ya recibido/producido, o ejecutar el ejemplo exclusivamente en QA. No registrar conteos ficticios sobre desarrollo.
5. Con OPERADOR, entrar a **Ventas y entregas**, elegir cliente/productos/cantidades, responsables y ayudantes, fechas y envío. Revisar el resumen de total, cobrado y fiado; sin pagos la venta queda pendiente.
6. Confirmar y consultar **Deudas de clientes**. Registrar una cobranza parcial o total con fecha efectiva y cuentas reales. Verificar saldo, historial de venta y Cash Flow en esa fecha; el stock no vuelve a descontarse.
7. ADMIN puede anular con motivo y declarar exclusivamente las aptas que realmente regresaron. Revisar el crédito del cliente; no hubo reembolso automático. LECTOR no dispone de escrituras.

## Pendientes reales

- B–C: origen evento ya descontado; costo histórico/versiones de H; reversión de cobros, reembolsos y semanas cerradas de G. No se consideran cerradas estas etapas por tener una venta básica funcionando.
- D: eventos/rendición y sus garantías; no se desarrollaron en este avance.
- E: obligaciones generales, cheques propios, gastos compartidos, pagos aplicados a varias obligaciones y correcciones de proveedores.
- F: equipos, contratos, comodato, reparaciones y alquileres. No se implementa stock físico de hielo en heladeras de clientes.
- G: transferencias, inversiones/valuación/rendimiento, reversión/reembolso general, disponibilidad, filtros completos, conciliación y cierres/reapertura/versiones.
- H: costeo por bolsa, repartos justificados, costos/versiones históricos, reportes integrados, márgenes, consumo de clientes con cobertura y auditoría general/buscador.
- Otros MVP de fundación: cambio de contraseña/revocación de sesiones, bloqueo por identidad, administración web de usuarios, carga inicial completa, respaldo descargable y restauración probada, OpenAPI/PWA y verificaciones de despliegue. F1 permanece separado.

El pedido integral excede este avance de sesión. El trabajo queda revisable y probado, pero no se afirma aceptación total de la ERS ni habilitación comercial en desarrollo.
