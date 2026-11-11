# JM Hielos: MVP financiero local

Entrega del 11/11/2026. Alcance: login existente, catálogos financieros, cobros y pagos manuales y consulta del flujo realizado. Es un MVP para demostración del circuito solicitado; no representa la implementación completa de la ERS 1.4.

## Qué se implementó

- Pago manual PAGO / EGRESO y cobro manual COBRO / INGRESO, ambos FLUJO_EXTERNO.
- Operación y movimiento en una única transacción Prisma. Se conservan usuario autenticado, operación de origen y fechas de carga y efectiva.
- Cuenta existente y activa, ARS, fecha no anterior a la apertura; categoría existente, activa y con el sentido correcto.
- Importe obligatorio como string decimal positivo, hasta 16 enteros y 2 decimales. Los cálculos usan Prisma.Decimal; la API devuelve totales como strings con dos decimales, sin redondear importes de carga.
- Fecha efectiva ISO 8601 con hora y zona explícita; no se admiten fechas futuras.
- Idempotencia global por clave: mismo usuario, tipo, cuenta, categoría, importe, instante y detalle devuelve los mismos registros. Importes y zonas equivalentes representan el mismo pedido. Misma clave con otros datos devuelve 409.
- La restricción única existente y la recuperación de P2002 resuelven colisiones concurrentes. No se agregaron migraciones ni se modificó el schema.
- Cash Flow de solo lectura, consolidado o por cuenta, por rango de días inclusivos en America/Argentina/Catamarca. Resumen y detalle salen de una misma transacción RepeatableRead.
- Se incluyen cuentas inactivas con su historial. Se excluyen fechas efectivas futuras.
- Flujo externo separado de transferencias internas, aperturas y ajustes sin efectivo. Los saldos se reconstruyen desde el libro. Las reversiones externas restan del componente original.
- Frontend React/Vite con login, navegación, formulario, catálogos, tarjetas, tabla, comprobantes, filtros y puente de saldos. Sin datos financieros simulados dentro de la aplicación.

## Decisiones

Se conserva JSX porque el frontend existente ya utiliza React con JavaScript. No se agregan Tailwind, bibliotecas de componentes ni dependencias.

La ERS RF-CFL-15 reserva los registros manuales a ADMIN. ADMIN, OPERADOR y LECTOR consultan. Se reutilizan los guards globales actuales, que verifican el usuario y rol vigente en cada petición. El body no admite usuarioId.

El JWT permanece en memoria del navegador. Recargar o cerrar la página requiere otro login; cerrar sesión lo descarta. No se guardan credenciales ni JWT en archivos del proyecto.

El esquema actual no tiene estado pendiente/confirmado del movimiento: este circuito solo crea movimientos confirmados mediante transacciones completas. No se suman ventas, deudas ni compromisos al Cash Flow.

Solo se ofrece filtro de cuenta y rango en esta entrega. No hay subtotales por categoría u origen que puedan confundirse con saldos completos.

## Levantar la demostración en Windows / PowerShell

Necesitás Docker Desktop iniciado, Node y las dependencias instaladas, configuración local existente y un usuario ADMIN activo. No se crearon usuarios, contraseñas ni datos financieros.

Se usa npm.cmd para evitar el bloqueo de npm.ps1 de PowerShell.

Terminal 1, PostgreSQL:

~~~powershell
Set-Location 'C:\Users\Emanuel Moya\Desktop\jm-hielos'
docker compose up -d db
docker compose ps db
~~~

El compose existente publica PostgreSQL en 127.0.0.1:5433. Conserva el volumen existente. POSTGRES_PASSWORD corresponde a la configuración local de compose. No ejecutar down -v, reset ni db push para esta demostración.

Terminal 2, API:

~~~powershell
Set-Location 'C:\Users\Emanuel Moya\Desktop\jm-hielos\api'
npm.cmd ci
npx.cmd prisma generate --config prisma7.config.ts
npx.cmd prisma migrate status --config prisma7.config.ts
npm.cmd run start:dev
~~~

La API necesita DATABASE_URL apuntando a la base local y JWT_SECRET ya configurados. No se inspeccionaron sus valores. Puerto esperado: http://127.0.0.1:3000. Si PORT es distinto, ajustar el destino del proxy en web/vite.config.js.

Las migraciones existentes deben estar aplicadas. No se ejecutaron migraciones durante esta entrega. En una base local nueva y vacía, el comando para aplicar el historial existente es:

~~~powershell
npx.cmd prisma migrate deploy --config prisma7.config.ts
~~~

No aplicar ese comando a ciegas en una base con historial: la migración existente 20261030183008 agrega operacionId obligatorio sin valor por defecto y requiere revisar registros previos si los hubiera. No se alteró esa migración ni se propone borrar datos para resolverla.

Terminal 3, frontend:

~~~powershell
Set-Location 'C:\Users\Emanuel Moya\Desktop\jm-hielos\web'
npm.cmd ci
npm.cmd run dev
~~~

Abrir http://127.0.0.1:5173. El proxy /api apunta a NestJS en el puerto 3000. La sesión utiliza los usuarios reales existentes. Si faltan cuentas o categorías, deben configurarse con los endpoints existentes antes de registrar dinero.

Para evitar reinstalaciones innecesarias durante la demo, podés omitir npm.cmd ci si las dependencias ya están instaladas.

## Endpoints

Salvo el login, todos requieren Authorization: Bearer <JWT>.

| Método | Ruta | Roles |
| --- | --- | --- |
| POST | /auth/login | Público |
| GET | /cuentas-financieras | ADMIN, OPERADOR, LECTOR |
| GET | /cuentas-financieras/inactivas | ADMIN, OPERADOR, LECTOR |
| GET | /categorias-flujo | ADMIN, OPERADOR, LECTOR |
| GET | /categorias-flujo/inactivas | ADMIN, OPERADOR, LECTOR |
| POST | /operaciones-financieras/cobros-manuales | ADMIN |
| POST | /operaciones-financieras/pagos-manuales | ADMIN |
| GET | /cash-flow?desde=2026-11-01&hasta=2026-11-11 | ADMIN, OPERADOR, LECTOR |
| GET | /cash-flow?desde=2026-11-01&hasta=2026-11-11&cuentaId=<UUID> | ADMIN, OPERADOR, LECTOR |

POST manual devuelve 201 con { operacion, movimiento }, también en el reintento exitoso. Cash Flow devuelve 200. Errores: 400 validación, 401 sesión inválida o vencida, 403 rol sin permiso, 404 cuenta o categoría inexistente, 409 clave reutilizada con otros datos.

### Ejemplos JSON para Postman

Importar docs/JM-Hielos-MVP.postman_collection.json. Completar sus variables con credenciales y UUID reales. El login guarda el token dentro de Postman. Los siguientes importes y detalles son ejemplos: reemplazarlos por los datos que corresponda registrar en la base local de demostración.

Login:

~~~json
{
  "username": "{{username}}",
  "password": "{{password}}"
}
~~~

Cobro:

~~~json
{
  "claveIdempotencia": "mvp-cobro-001",
  "cuentaId": "{{cuentaId}}",
  "categoriaId": "{{categoriaIngresoId}}",
  "importe": "15000.00",
  "fechaEfectiva": "2026-11-10T12:00:00-03:00",
  "detalle": "Cobro manual: reemplazar por detalle real"
}
~~~

Pago:

~~~json
{
  "claveIdempotencia": "mvp-pago-001",
  "cuentaId": "{{cuentaId}}",
  "categoriaId": "{{categoriaEgresoId}}",
  "importe": "2500.50",
  "fechaEfectiva": "2026-11-10T12:00:00-03:00",
  "detalle": "Pago manual: reemplazar por detalle real"
}
~~~

La cuenta debe estar abierta para esa fecha. Ajustá la fecha si corresponde. La categoría del cobro debe ser INGRESO; la del pago, EGRESO. No enviar usuarioId.

Para comprobar idempotencia, enviar dos veces el mismo body y verificar que se conservan los IDs. Luego cambiar el importe manteniendo la clave: debe devolver 409. Para registrar otro hecho financiero, usar otra clave. No reemplazar la clave ante un error de conexión: primero reintentar con los mismos datos.

Catálogos existentes, si todavía no están configurados (ADMIN):

POST /cuentas-financieras:

~~~json
{
  "nombre": "Nombre real de la cuenta",
  "tipo": "EFECTIVO",
  "titularInterno": "Titular real",
  "saldoInicial": "0.00",
  "fechaApertura": "2026-11-01T00:00:00-03:00"
}
~~~

Reemplazar saldoInicial por el saldo real de apertura: 0.00 es solo un ejemplo. Las cuentas deben usar una misma fecha de apertura conforme a la ERS.

POST /categorias-flujo, una categoría por sentido:

~~~json
{
  "nombre": "Cobros manuales",
  "grupo": "OPERACION",
  "sentido": "INGRESO"
}
~~~

~~~json
{
  "nombre": "Pagos manuales",
  "grupo": "OPERACION",
  "sentido": "EGRESO"
}
~~~

### Contrato del informe

- totalIngresos, totalEgresos y flujoNeto: exclusivamente flujo externo.
- saldoInicial: aperturas y movimientos efectivos anteriores al comienzo.
- transferenciasNetas: efecto interno de las cuentas seleccionadas, separado del flujo externo.
- aperturasDelPeriodo: incorporación de saldos iniciales dentro del rango.
- ajustesSinFlujo: ajustes firmados más aperturas del rango.
- saldoFinalPorFlujo = saldoInicial + flujoNeto + transferenciasNetas.
- saldoFinalLibro = saldoFinalPorFlujo + ajustesSinFlujo.
- movimientos: solo externos, con cuenta, categoría, usuario y operación vinculados.
- transferencias y ajustes: detalle separado de los registros existentes.
- coberturaCompleta y advertencia: identifican períodos anteriores a la apertura o ausencia de cuentas.

Los totales son strings decimales con dos posiciones. El frontend conserva centavos al presentar importes grandes y negativos menores a un peso. No confundir saldo de libro de inversiones con fondos inmediatamente disponibles.

## Verificación realizada

Resultados y límites de esta entrega:

- API: build exitoso; 426 pruebas unitarias y 266 HTTP exitosas.
- Backend lint: sin errores; una advertencia previa en src/main.ts por bootstrap sin await/void. Se excluye código generado y se desactiva --fix para conservar cambios ajenos.
- Frontend: build y lint exitosos; tres pruebas de formato monetario y zona horaria exitosas.
- Navegador: login de escritorio y móvil, sin desborde a 1440/390 px; navegación, formulario de cobro, conversión decimal, error de red y reintento con idéntica clave y payload; modo OPERADOR y acceso directo al formulario bloqueado.
- Las pruebas HTTP usan Prisma simulado, con guards, DTO y aplicación Nest reales. La prueba del navegador intercepta respuestas exclusivamente en QA; no introduce datos ni simulaciones en el producto.
- No se verificaron aún atomicidad, unicidad concurrente y consultas contra PostgreSQL real.
- Docker no respondió en esta sesión, incluso después de intentar iniciar Docker Desktop. El circuito con credenciales reales queda pendiente.
- El npm test de la raíz es el placeholder previo que termina con "Error: no test specified". Las suites reales están en api y web.
- No se ejecutaron migraciones, no se modificaron datos reales y no se hicieron commit ni push.

Comandos de verificación:

~~~powershell
Set-Location 'C:\Users\Emanuel Moya\Desktop\jm-hielos\api'
npm.cmd test -- --runInBand
npm.cmd run test:e2e -- --runInBand
npm.cmd run build
npm.cmd run lint -- --fix=false --ignore-pattern 'src/generated/**'

Set-Location 'C:\Users\Emanuel Moya\Desktop\jm-hielos\web'
npm.cmd test
npm.cmd run build
npm.cmd run lint
~~~

## Pendiente

- Prueba del circuito con PostgreSQL, migraciones existentes aplicadas y credenciales reales del entorno local.
- Verificación real de colisiones concurrentes y rollback en PostgreSQL; se cubrieron sus caminos mediante mocks, sin afirmar persistencia verificada.
- Configuración de cuentas/categorías reales y acceso ADMIN si todavía no existen.
- Fuera del alcance solicitado: creación de transferencias y ajustes, correcciones/reaperturas, cierres semanales, cheques, ventas/deudas y sus aplicaciones, filtros por categoría/origen, comparación y exportación. El reporte separa los registros internos y ajustes que ya existan, sin crear estas operaciones.
- El historial se consulta en memoria para este MVP; si crece, conviene agregar agregaciones/paginación sin cambiar las reglas del informe.

## Archivos de esta entrega

Se preservaron los cambios locales previos, incluidos schema, migraciones, autenticación y catálogos.

Modificados:

- README.md: enlaces a la guía de demostración y a la colección de Postman.
- api/src/app.module.ts: incorpora CashFlowModule y conserva los módulos previos.
- api/src/operaciones-financieras/operaciones-financieras.service.ts: pagos, cobros, transacción, validaciones e idempotencia.
- api/src/operaciones-financieras/operaciones-financieras.controller.ts: rutas manuales y usuario del JWT.
- api/src/operaciones-financieras/dto/create-pago-manual.dto.ts: clave normalizada y fecha con zona obligatoria.
- api/src/operaciones-financieras/operaciones-financieras.service.spec.ts y operaciones-financieras.controller.spec.ts: pruebas del módulo y configuración correcta de sus dependencias.
- web/src/App.jsx: sesión y navegación.
- web/src/App.css y web/src/index.css: estilos responsive y accesibles.
- web/vite.config.js: proxy a la API.
- web/index.html: idioma, título y descripción.
- web/package.json: script de tests con el runner de Node, sin dependencias nuevas.

Creados:

- api/src/operaciones-financieras/dto/create-cobro-manual.dto.ts.
- api/src/cash-flow/cash-flow.module.ts, cash-flow.controller.ts, cash-flow.service.ts, cash-flow.service.spec.ts y dto/consultar-cash-flow.dto.ts.
- api/test/finanzas.e2e-spec.ts.
- web/src/api.js y web/src/formato.js.
- web/src/components/Login.jsx, Icono.jsx, RegistroManual.jsx, CashFlow.jsx y Catalogos.jsx.
- web/test/formato.test.js.
- docs/MVP-financiero.md y docs/JM-Hielos-MVP.postman_collection.json.

Los archivos de QA del navegador y capturas quedaron en web/.tmp, ignorados por Git. No son datos financieros ni parte del código del producto.
