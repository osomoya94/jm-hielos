# Insumos, producción y stock terminado — ERS 1.4

Implementación local del módulo. Las migraciones de Inventario y Comercial se aplicaron con autorización a desarrollo el 13/11/2026, conservando los datos anteriores. Se verificaron además 37 pruebas HTTP en PostgreSQL QA aislado y el circuito completo desde Chrome. No se hicieron commits ni push. Ver la [guía de presentación](guia-demo.md).

## Decisiones del circuito

- **Depósito:** solo presentaciones completas. Cada presentación tiene su propio factor configurable. Para bolsas se propone 100 al crearla; no se utiliza 100 para calcular los movimientos posteriores.
- **Producción:** unidades ya trasladadas. Abrir un paquete mueve todas sus unidades y su valor; todavía no consume insumos.
- **Lote:** consume las bolsas usadas y las rotas, y opcionalmente otros insumos. Guarda producto, código único, responsable, hasta dos ayudantes, cantidad esperada opcional, cantidad apta e hielo descartado en kg. Las aptas no pueden superar las bolsas usadas.
- **Terminado:** aumenta solo por las bolsas aptas reales. La diferencia con lo esperado no se convierte automáticamente en pérdida. Los sobrantes de bolsas vacías siguen disponibles.
- **Costos:** se conservan unidades y valor por presentación y ubicación. Cada salida usa el promedio ponderado de esa presentación y ubicación; el listado muestra el promedio agregado del insumo. El último retiro se lleva todo el valor restante para evitar residuos de redondeo. Valores con Decimal, hasta seis decimales; dinero con dos.
- **Compras:** reciben inventario una vez. Guardan comprobante único por proveedor, líneas, presentación y factor histórico, costo, total, pagado y vencimiento opcional. Solo un pago real genera egreso en una cuenta y categoría activas. Un pago posterior no modifica insumos ni repite su costo. El saldo pendiente al proveedor se consulta desde compras; no es Fiados de clientes.
- **Alertas:** depósito `<= stockMinimo`. Valores iniciales: 300 unidades para 1 y 3 kg, 200 para 5 kg y 100 para 10 kg. Se pueden cambiar desde Configurar. Los demás insumos comienzan en 0 si no se establece mínimo.
- **Presentaciones:** un factor nuevo se registra como otra presentación, con un nombre diferente. Las existencias anteriores conservan su factor. El catálogo permite desactivar/reactivar el insumo sin borrar historia.
- **Identidad del producto:** no se permite cambiar peso/unidad cuando ya tiene insumos vinculados o movimientos de stock. Para otra medida se crea otro producto; nombre y estado conservan su edición habitual. La comprobación se realiza en una transacción Serializable.
- **Devolución al proveedor:** salida física de insumos; no inventa un reintegro de dinero. **Devolución apta:** entrada de hielo terminado verificado como apto. Regalos y consumo interno son salidas especiales con participantes.
- **Conteo:** se ingresa la cantidad física absoluta. Se conserva el saldo anterior y la diferencia. En depósito debe equivaler a presentaciones completas; en producción puede reflejar unidades sueltas. Si un ajuste o conteo aumenta insumos, exige costo unitario explícito, incluso si el costo autorizado es cero.
- **Correcciones:** movimientos compensatorios con motivo; el campo `corrigeOperacionId` vincula la operación original del mismo producto o de la misma presentación/ubicación. No se editan ni eliminan movimientos. Esto no implementa una anulación integral de compras o lotes.

## Autenticación y permisos

Se reutilizan los JWT y guards del proyecto. La matriz de la ERS autoriza compras/configuración/ajustes al administrador y salidas especiales a socios operadores. No concede una escritura general de producción al operador, por lo que los lotes y traslados quedan bajo ADMIN.

| Acción | ADMIN | OPERADOR | LECTOR |
|---|---|---|---|
| Consultas de inventario, compras, lotes y auditoría | Sí | Sí | Sí |
| Configurar insumos/presentaciones y mínimos | Sí | No | No |
| Compras, pagos, traslados y lotes | Sí | No | No |
| Consumos, pérdidas, devoluciones, ajustes y conteos | Sí | No | No |
| Obsequio y consumo interno de terminado, con participantes | Sí | Sí | No |

## Atomicidad y duplicados

Compras, pagos, traslados, lotes y movimientos usan transacciones `Serializable`, con hasta tres intentos frente a P2034. Un fallo revierte todo el conjunto. Las existencias negativas se rechazan también para administradores en esta versión.

Cada POST operativo exige `claveIdempotencia` UUID v4. La misma clave, usuario y datos devuelven la respuesta original; otra carga con esa clave produce 409. La huella ordena las propiedades JSON, pero conserva el contenido exacto enviado. El frontend conserva la clave al reintentar una solicitud sin respuesta. Cambiar datos inicia otra operación.

Además son únicos el código de lote, comprobante por proveedor y origen de inventario. La respuesta original incluye los sobrantes del momento de confirmar; no se recalcula en un reintento. El historial guarda fecha efectiva y de registro, actor, motivo, origen, movimientos, saldos y valor.

## Migración de Inventario aplicada y comprobada

Archivo: `api/prisma/migrations/20261111180000_inventario_produccion/migration.sql`.

Agrega 12 tablas: Insumo, PresentacionInsumo, ExistenciaInsumo, OperacionInventario, MovimientoInsumo, CompraInsumo, DetalleCompraInsumo, PagoCompraInsumo, LoteProduccion, ProduccionParticipante, StockTerminado y MovimientoStock. Crea tres enums, claves foráneas con eliminación restringida, índices únicos y controles CHECK para cantidades/costos/saldos válidos. Incluye BEGIN/COMMIT.

No contiene DELETE, TRUNCATE, DROP, reinicio, cargas iniciales ni cambios de columnas de las tablas existentes. Las relaciones agregadas a Producto, Usuario, Proveedor y OperacionFinanciera en Prisma son relaciones inversas; no alteran sus registros. Las tablas nuevas comienzan vacías. No se asume inventario inicial cero físico: habrá que registrar la apertura real mediante ajustes o compras verificadas.

El respaldo externo SQL se verificó por legibilidad y SHA-256 antes de aplicar Inventario. Después se compararon conteos y hashes de clientes, productos, proveedores, usuarios y finanzas. Desarrollo conserva nueve migraciones aplicadas, incluida la comercial autorizada y comprobada posteriormente. No hay migraciones pendientes. Consultar [SQL e impacto comercial](comercial-qa.md).

Para consultar el estado y arrancar Inventario, desde `api`:

```powershell
npx.cmd prisma migrate status --config prisma7.config.ts
npx.cmd prisma generate --config prisma7.config.ts
npm.cmd run start:dev
```

Configurar la conexión localmente sin pegar credenciales en documentación, chats o repositorio. Para ensayos usar una base de pruebas o productos/insumos identificados exclusivamente como prueba. No realizar conteos de ejemplo sobre el stock operativo real.

La prueba automática aislada se ejecuta con `npm.cmd run test:postgres`. El ejecutor deriva una conexión exclusiva a `jm_hielos_qa_ers14`, aplica allí las migraciones y no borra datos. Verifica todas las tablas de desarrollo mediante SHA-256 antes/después. La integración de la venta habitual ya usa `descontarVentaEnTransaccion`; el circuito de Eventos permanece pendiente.

## Endpoints

Todos requieren Bearer JWT. Prefijo `/inventario`:

| Método y ruta | Función |
|---|---|
| GET /insumos | Insumos activos/inactivos, presentaciones, existencias por ubicación, valor/promedio y alertas |
| POST /insumos | Crear insumo con presentación inicial |
| PATCH /insumos/:id | Nombre, mínimo y estado; no cambia tipo/unidad/producto histórico |
| POST /insumos/:id/presentaciones | Agregar otro factor/presentación |
| GET /compras | Compras, líneas, proveedor y pagos |
| POST /compras | Recibir mercadería y registrar pago inicial opcional |
| POST /compras/:id/pagos | Pago posterior sin recepción repetida |
| POST /traslados | Abrir presentaciones completas y moverlas a producción |
| POST /insumos/movimientos | CONSUMO, PERDIDA, DEVOLUCION_PROVEEDOR, AJUSTE, CONTEO |
| GET /produccion | Lotes, producto y participantes |
| POST /produccion | Lote con consumo y aumento de terminado atómicos |
| GET /stock | Bolsas aptas y producto, incluyendo productos inactivos con historial |
| POST /stock/movimientos | PERDIDA, DEVOLUCION, OBSEQUIO, CONSUMO_INTERNO, AJUSTE, CONTEO |
| GET /movimientos?cursor=UUID | Historial paginado, 50 operaciones y siguienteCursor |

Los catálogos se administran sin datos inventados; todas las pantallas consultan NestJS. Los valores para selects provienen de los catálogos actuales. El historial no se elimina al desactivar un registro.

## Prueba con PostgreSQL real y Postman

Importar `docs/JM-Hielos-Inventario.postman_collection.json`. Configurar baseUrl de Nest (por ejemplo `http://localhost:3000`, sin `/api`), token de un ADMIN y UUID reales de producto de prueba de 3 kg, proveedor y responsable. Para probar pagos, configurar cuenta y categoría de EGRESO. Obtener IDs desde los GET de catálogos; nunca enviar contraseñas en esta colección.

La colección genera una fecha con zona y una clave distinta por operación **solo si esas variables están vacías**. Un reenvío conserva ambas para probar idempotencia. Para una operación nueva, limpiar su clave y cambiar código de lote/comprobante cuando corresponda. No cambiar el cuerpo y conservar la misma clave: corresponde 409.

1. **Registrar insumo.** Crear bolsa vacía vinculada al producto de 3 kg, unidad `unidad`, presentación Paquete, sin factor ni mínimo explícitos. Comprobar factor 100 y mínimo 300. Guardar insumoId/presentacionId. La colección los guarda de la respuesta.
2. **Compra.** Recibir 4 paquetes con costo total ARS 4.000 y comprobante exclusivo de prueba, sin pago. Debe quedar depósito 400, producción 0, costo promedio 10 y sin egreso financiero. La compra queda pendiente por 4.000. Reenviar exactamente: misma respuesta, mismos 400, una compra. Cambiar importe conservando clave: 409.
3. **Traslado.** Abrir 1 paquete. Deben quedar depósito 300 y producción 100; valores 3.000 y 1.000. La alerta se activa en 300. Reenviar con misma clave: no abre otro paquete.
4. **Lote.** Código único, responsable, 10 bolsas usadas, 0 rotas, 10 aptas, 100 esperadas y 0 kg descartados. Deben quedar 90 bolsas vacías en producción y el terminado aumentar 10 respecto de su saldo anterior. La diferencia de 90 frente a lo esperado no es pérdida. Insumos en producción valen 900. Otro lote de 10 aptas con 2 rotas dejaría 78 bolsas abiertas y terminado +10.
5. **Atómicos.** Intentar un lote que consuma más bolsas que las disponibles. Debe ser 409, sin lote ni cambios en producción/terminado. Una pérdida mayor al terminado también debe ser 409. Usar claves nuevas para estos ensayos.
6. **Alertas y factor configurable.** Cambiar mínimo a 250: con 300 en depósito desaparece la alerta. Volver a 300: reaparece. Agregar presentación Paquete 80 con factor 80; los tres paquetes anteriores siguen siendo de 100. Comprar/trasladar la presentación de 80 utiliza 80, sin modificar existencias históricas.
7. **Ajustes y conteos.** Sobre un producto exclusivo de prueba con 10 terminadas: pérdida de 2 deja 8; devolución apta de 1 deja 9; conteo de 7 guarda diferencia −2 y deja 7; ajuste +1 con motivo y corrigeOperacionId del conteo deja 8. Repetir el mismo conteo con su misma clave no lo aplica otra vez. Un conteo nuevo de 8 registra diferencia cero.
8. **Insumos.** Conteo físico de producción 85 cuando había 90 registra −5; conteo de depósito 299 con factor 100 debe rechazarse. Para aumentar insumos por ajuste/conteo indicar costoUnitario, porque un costo desconocido no se supone cero. Consumo directo de depósito debe rechazarse; primero trasladar.
9. **Pago real, opcional.** Sobre la compra de 4.000 registrar pago de 1.000: pagado 1.000, pendiente 3.000, un egreso de 1.000 en Cash Flow y ningún movimiento físico nuevo. Reintentar sin cambios: un solo pago. Pago superior al pendiente, categoría de ingreso o cuenta inactiva: 400 y ningún efecto.
10. **Permisos.** LECTOR consulta pero POST devuelve 403. OPERADOR no compra, produce, cuenta ni ajusta; puede registrar OBSEQUIO/CONSUMO_INTERNO con responsable y hasta dos ayudantes distintos. Sin JWT: 401.
11. **Concurrencia real pendiente.** Enviar simultáneamente dos traslados de un único paquete disponible, con claves distintas: solo uno puede confirmarse. Con la misma clave: ambos deben recibir la misma respuesta y existir una operación. Repetir con dos lotes que compitan por las últimas bolsas. Verificar también doble código/comprobante con claves diferentes y rollback de inventario/pago ante errores. Estos casos requieren PostgreSQL real; los dobles de Prisma no validan bloqueos ni restricciones SQL.

## Cobertura y pendientes

| Requisito | Implementación |
|---|---|
| RF-INS-01 a 08 | Catálogo, presentaciones, mínimos, compras, pagos, movimientos, costos por ubicación y alertas configurables |
| RF-INS-09 (F1) | Pendiente: duración estimada según consumo histórico |
| RF-INS-10 a 12 | Traslados completos sin consumo, sobrantes y depósito separado de producción |
| RF-STK-01 a 05 | Lotes y participantes, insumos disponibles, aptas reales, usadas/rotas/descartado y aumento real |
| RF-STK-06 a 08 | Parcial: obsequios/consumo interno con participantes e integración interna preparada. Ventas entregadas, eventos y su rendición quedan pendientes; no se implementaron módulos comerciales |
| RF-STK-09 a 10 | Devoluciones aptas, pérdidas, obsequios, consumo interno, ajustes vinculables y conteos con diferencia |
| RF-STK-11 (F1) | Pendiente: reportes de ventas/salidas por persona |
| CA-08, 09, 10 y 27 | Cubiertos en lógica y pruebas con Prisma simulado; falta aceptación sobre PostgreSQL real |
| CA-37 | Conservación de costo de compras/traslados/consumos/pagos probada con doble; venta aún pendiente |

Reglas atendidas: RN-011, 012, 013, 020, 026, 031 y 038. RN-014 a 016 preparadas para futuras ventas; RN-025 conserva originales con compensaciones vinculables, sin anulación completa automática de operaciones compuestas.

No se desarrollaron Ventas, Fiados, eventos/rendición, control físico de heladeras de clientes, predicción automática de reposiciones ni modificación de los datos de clientes/equipos existentes.

`descontarVentaEnTransaccion` es un método interno, sin endpoint. La futura Venta deberá crear su operación con origen único `VENTA/ventaId` y ejecutar todo en la misma transacción Serializable. El método rechaza un segundo descuento para esa operación. El circuito de eventos deberá conservar su descuento original al rendir, cuando se implemente.

## Archivos y presentación

- `api/prisma/schema.prisma` y la migración aditiva: estructura de inventario y restricciones.
- `api/src/inventario/`: DTO, controller, servicio transaccional y módulo; `app.module.ts` lo integra.
- `api/src/productos/productos.service.ts` y su prueba de controller: protegen peso/unidad de productos que ya tienen inventario, sin bloquear el cambio de nombre.
- `api/src/inventario/inventario.service.spec.ts`, `api/test/inventario.e2e-spec.ts`, `api/test/soporte/inventario-prisma.ts`: pruebas de dominio y HTTP con doble de Prisma.
- `web/src/components/inventario/`: pantallas y formularios; `web/src/inventario.js` y `web/test/inventario.test.js`: conversiones de presentación/fecha y visualización exacta de saldo/costos.
- `web/src/App.jsx`, `App.css`, `components/Icono.jsx`, `components/ControlesPendientes.jsx`: navegación, estilos y acceso al stock operativo, conservando login y Cash Flow.
- Esta guía, colección Postman y siete capturas en `docs/capturas/inventario-*.png`.

Skills utilizadas: **jm-hielos-backend** y **UI/UX Pro Max**. Se mantienen React 19, JSX y CSS, sin dependencias nuevas. Contraste y foco heredados del diseño azul, formularios con etiquetas, diálogo con Escape/cancelar y bloqueo durante guardado, tablas con desplazamiento interno accesible por teclado. Las capturas se hicieron a 1440 y 390 px con datos de QA interceptados solo en el navegador aislado; no muestran datos productivos ni introducen fixtures en el frontend entregado.

Los resultados finales de build/lint/pruebas y sus límites se registran en `docs/verificacion-inventario.md`.
