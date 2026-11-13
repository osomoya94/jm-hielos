
# JM Hielos - Patrones existentes del backend

Este documento describe cómo está organizado actualmente el backend.

Objetivo: mantener código sencillo, consistente y fácil de entender.

Los ejemplos existentes son referencias, no modelos perfectos.
No copiar errores ni prácticas inseguras.

Referencia funcional vigente: ERS JM Hielos 1.4 del 28/10/2026,
`docs/ERS_JM_Hielos_v1_4_Cash_Flow.docx`.
Consultar [ers-rules.md](ers-rules.md) para las reglas de negocio y la decisión
confirmada de roles ADMIN, OPERADOR y LECTOR de solo lectura.

El proyecto avanza mediante entregas académicas progresivas y actualmente prioriza
el backend de Cash Flow. Esa prioridad no implica que sus requisitos ya estén
implementados ni cambia los patrones técnicos descritos aquí.

## 1. Organización del proyecto

El backend está en `api/`.

La sección 12.4 de la ERS 1.4 presenta `apps/api` como organización recomendada.
Conservar la ubicación actual y no reorganizar el repositorio sin una tarea autorizada.

Tecnologías:
- NestJS y TypeScript.
- PostgreSQL y Prisma.
- class-validator y class-transformer.
- Jest para las pruebas.

Módulos de referencia:
- `api/src/clientes/`
- `api/src/productos/`

Cada módulo utiliza principalmente:
- Controller: recibe las peticiones HTTP.
- Service: contiene la lógica y consulta la base.
- DTO: valida los datos recibidos.
- Module: conecta los componentes.
- Tests: comprueban el comportamiento.

## 2. Controllers

Revisar `clientes.controller.ts` y `productos.controller.ts`.

Patrones utilizados:
- Decoradores @Controller, @Get, @Post y @Patch.
- @Body para recibir datos.
- @Param con ParseUUIDPipe para identificadores UUID.
- Inyección del Service en el constructor.
- El Controller delega las operaciones al Service.

Mantener los Controllers sencillos.
No colocar consultas Prisma directamente en ellos.

## 3. Services

Revisar `clientes.service.ts` y `productos.service.ts`.

Patrones utilizados:
- @Injectable().
- PrismaService inyectado en el constructor.
- Métodos async para operaciones con la base.
- Consultas mediante findMany, findUnique, create y update.
- NotFoundException cuando no existe un registro.
- BadRequestException para operaciones inválidas.

Utilizar nombres de métodos claros y comprensibles.

No introducir capas adicionales sin necesidad.

## 4. DTO y validaciones

Revisar los DTO existentes antes de crear nuevos.

Patrones utilizados:
- class-validator.
- class-transformer.
- @IsString, @IsNotEmpty, @IsOptional.
- @Min, @Max, @MaxLength según corresponda.
- @Transform para eliminar espacios exteriores en textos.
- @Matches para rechazar textos compuestos solo por espacios.

Aplicar validaciones adecuadas al tipo de dato.

Distinguir correctamente entre null y undefined.
No copiar validaciones incorrectas entre módulos.

## 5. Estados activos e inactivos

Clientes y Productos utilizan un campo `activo`.

Comportamiento actual:
- Listado principal: solamente activos.
- Listado de inactivos: endpoint separado.
- Consulta por ID: permite consultar también inactivos.
- No se permite editar registros inactivos.
- Se permite activar y desactivar.
- Se rechaza repetir un cambio al mismo estado.

No copiar este patrón automáticamente a entidades financieras.
Las anulaciones y movimientos históricos siguen reglas de la ERS.

## 6. Pruebas

Los módulos existentes cuentan con archivos `.spec.ts`.

Al implementar una funcionalidad:
- Revisar las pruebas de módulos similares.
- Comprobar los casos correctos.
- Comprobar datos inválidos.
- Comprobar registros inexistentes.
- Comprobar restricciones de negocio.
- No eliminar tests para conseguir que pasen.

Comandos desde `api/`:

`npm run test -- --runInBand`

`npm run build`

Informar resultados reales, no supuestos.

En futuras implementaciones financieras, verificar los criterios aplicables de la
ERS 1.4: CA-40 a CA-57 para Cash Flow MVP y CA-58 para comparación y exportación F1.
Incluir permisos según los roles confirmados, atomicidad, protección contra duplicados,
precisión decimal y consistencia entre resumen, detalle y saldos del libro.

## 7. Reglas para Codex y Gemini

- Respetar el estilo existente cuando sea correcto.
- Priorizar código legible sobre abstracciones complejas.
- No refactorizar módulos ajenos a la tarea.
- No instalar dependencias sin justificarlo.
- No modificar archivos cuando se solicite únicamente revisión.
- Si la tarea implica un concepto nuevo para el desarrollador, explicar y guiar antes de implementar.
- Delegar implementación repetitiva solo cuando el usuario lo autorice.
- Informar archivos modificados y pruebas realizadas.
- Nunca hacer commit ni push sin autorización.
- Consultar [ers-rules.md](ers-rules.md) para las reglas del negocio de la ERS 1.4 y las decisiones posteriores confirmadas.

IMPORTANTE:
Autenticación, autorización, contraseñas y operaciones financieras
necesitan controles propios. No basta con copiar un CRUD existente.

Para el backend de Cash Flow, mantener NestJS, TypeScript, Prisma y PostgreSQL,
con Controllers sencillos, Services, DTO y pruebas según los patrones actuales.
El informe agrega movimientos financieros confirmados; las escrituras y su auditoría
permanecen en la operación de origen y su transacción. No crear una carga paralela
de totales ni tratar estas reglas pendientes como módulos ya implementados.
