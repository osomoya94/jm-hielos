
# JM Hielos - Reglas de negocio

Fuente vigente: ERS JM Hielos, versión 1.4, 28/10/2026,
[docs/ERS_JM_Hielos_v1_4_Cash_Flow.docx](../../../../docs/ERS_JM_Hielos_v1_4_Cash_Flow.docx).

Estas reglas representan requisitos del sistema, no funcionalidades
que necesariamente ya estén implementadas.

Si falta información, consultar la ERS completa o preguntar.
Nunca inventar decisiones del negocio.

## Contexto de trabajo y prioridad actual

Por indicación del usuario, el proyecto se desarrolla mediante entregas académicas
progresivas. Actualmente se prioriza el backend relacionado con Cash Flow:
cuentas, aperturas, libro financiero, cobros y pagos, transferencias, trazabilidad
y conciliación. Esto orienta el trabajo solicitado, sin autorizar la implementación
automática de todo el alcance ni establecer fechas de entrega nuevas.

La ERS distingue requisitos MVP, obligatorios para la primera versión productiva,
y F1, que se completan dentro de la primera fase antes del cierre del proyecto.
No confundir esas prioridades con entregas académicas ya aprobadas o funcionalidades
ya implementadas. La fecha de la ERS no implica aprobación docente o de los socios.

## 1. Usuarios y seguridad

Referencias: RF-AUT-01 a RF-AUT-06, RNF-SEC.

- El sistema comienza con tres socios.
- Un administrador tiene acceso completo.
- Dos socios operadores consultan información y registran operaciones autorizadas.
- Solo el administrador modifica configuraciones y precios.
- Cada usuario utiliza credenciales individuales.
- Las contraseñas deben almacenarse mediante hash seguro.
- Los permisos deben verificarse en la API, no solo en el frontend.
- Se requiere cambio de contraseña, gestión de sesiones y bloqueo temporal por intentos fallidos.
- Los usuarios pueden desactivarse sin eliminar su historial.

### Decisión posterior confirmada: rol LECTOR

La ERS 1.4 describe administrador y socio operador. Se conserva la decisión
posterior confirmada por el usuario de utilizar tres roles:

- ADMIN: administración completa.
- OPERADOR: consulta y registra operaciones autorizadas.
- LECTOR: acceso de solo lectura.

El rol LECTOR no puede crear, editar, eliminar ni modificar registros.

Los permisos específicos de consulta se definirán
antes de implementar la autorización.

Esta decisión complementa los roles de la ERS vigente; LECTOR no se atribuye
al contenido del documento. La autorización de solo lectura también se verifica
en la API.

## 2. Productos y clientes

Referencias: RF-PRE, RF-CLI.

- Los productos iniciales son bolsas de 1, 3, 5 y 10 kg.
- Los precios son configurables según lista y cliente.
- Los cambios de precios no modifican ventas anteriores.
- Los clientes pueden crearse, consultarse, modificarse y desactivarse.
- Se debe conservar la información histórica.
- El sistema debe permitir un cliente genérico Consumidor final.

## 3. Stock y ventas

Referencias: RF-STK, RF-VEN, RN-014, RN-015, RN-038.

- Una venta habitual confirmada descuenta stock una sola vez.
- Cada venta registra productos, cantidades, precios y responsables.
- Los eventos descuentan stock al enviar la mercadería.
- Al rendir un evento no se vuelve a descontar lo vendido.
- Las devoluciones aptas regresan al stock.
- Evitar operaciones duplicadas por doble clic o reintentos.
- Una venta debe actualizar stock, pagos, deuda y auditoría de forma atómica.

## 4. Cobros y finanzas

### 4.1 Cobros y pagos parciales

Referencias: RF-DEU-01 a RF-DEU-10, RF-PRO-01 a RF-PRO-03,
RF-GAS-03, RN-004 a RN-007, RN-020, RN-039 a RN-041.

- Una venta y un cobro son operaciones diferentes.
- La deuda del cliente es el total de venta menos los pagos válidos asignados. Los pagos parciales sucesivos reducen el saldo sin reemplazar la deuda original ni perder su historial; solo se salda al llegar a cero.
- Cada cobro identifica cuenta receptora, fecha y persona que lo registró. Puede dividirse entre efectivo y una o más cuentas.
- Una venta fiada o parcialmente cobrada entra al flujo solo por lo recibido. Los cobros posteriores se incluyen en su fecha efectiva, sin volver a registrar la venta.
- Las compras y gastos generan salida solo por lo efectivamente pagado. El resto permanece como obligación; pagar después no crea otra compra, ingreso de stock ni costo.
- Los pagos a proveedores pueden aplicarse a una o varias compras y conservan importe, cuenta, fecha, usuario e historial.

### 4.2 Cuentas financieras y apertura

Referencias: RF-CTA-01 a RF-CTA-07, RF-INI-01, RF-INI-04,
RF-CFL-10 y RF-CFL-13, RN-009, RN-028 y RN-029, sección 9.2.

- Las cuentas son configurables: efectivo, banco, billetera o inversión. Guardan nombre, titular interno, moneda ARS, tipo, estado, fecha y saldo inicial; no son columnas fijas por banco o billetera.
- La carga inicial utiliza una misma fecha de apertura y se distingue de las operaciones ordinarias. El saldo de apertura no es un cobro ni una entrada externa del período.
- El saldo se calcula desde la apertura y los movimientos registrados; no se edita directamente ni se mantienen totales paralelos editables.
- El perímetro del informe es la cuenta o conjunto de cuentas propias seleccionado. Incluye cuentas inactivas con saldo o historial; desactivar una cuenta no borra su participación histórica.
- Separar saldo de libro, fondos disponibles e inversiones sujetas a rescate o valuación. Las cuentas por cobrar no son dinero disponible y no se consolidan monedas distintas.

### 4.3 Cash Flow realizado

Referencias: RF-CFL-01 a RF-CFL-18, RN-039 a RN-052,
RF-REP-10, secciones 6.18, 9.3 y 10.4.

- El Cash Flow se deriva automáticamente de movimientos financieros confirmados del único libro. No equivale a ventas ni a ganancia; se muestra separado del resultado operativo estimado y del resultado de inversiones.
- Solo incluye entradas y salidas reales por fecha efectiva de cobro o pago. Excluye compromisos pendientes y movimientos futuros; un movimiento confirmado no puede tener fecha efectiva futura.
- Permite día, semana de lunes a domingo, mes o rango inclusivo en `America/Argentina/Catamarca`. El rango comprende desde el inicio del primer día hasta antes del día siguiente al último.
- Cada movimiento externo se clasifica en operación, inversión en activos, financiación, aportes, retiros, depósitos en garantía u otros, con categorías configurables y origen histórico conservado.
- Las consultas de resumen y detalle son de solo lectura: no crean pagos ni movimientos adicionales. Los efectos financieros se registran una sola vez en la misma transacción de la operación de origen.
- ADMIN y OPERADOR pueden consultar totales y detalle. La configuración de categorías, los registros financieros manuales, ajustes y correcciones se reservan a ADMIN, con autorización en la API. LECTOR conserva el alcance de solo lectura de la decisión confirmada, sin habilitar escrituras.
- Cuenta y período definen los saldos completos. Los filtros por categoría, tipo u origen afectan el detalle y sus subtotales, sin recortar los saldos de apertura o cierre; un subtotal filtrado se identifica como parcial.
- La proyección futura de caja está fuera de esta versión. La comparación de períodos de igual duración y cobertura y la exportación corresponden a F1 (RF-CFL-09 y RF-CFL-16, CA-58); la exportación conserva filtros, saldos, detalle y fecha de emisión.

### 4.4 Transferencias internas e inversiones

Referencias: RF-CTA-05 y RF-CTA-06, RF-INV-01 a RF-INV-03,
RF-CFL-05 y RF-CFL-08, RN-008, RN-010, RN-042 y RN-045, sección 10.4.

- Una transferencia propia genera un egreso y un ingreso vinculados y atómicos, con auditoría. No es venta, ingreso externo, gasto ni ganancia.
- Al incluir ambas cuentas, su efecto consolidado es cero. Si una punta queda fuera de la selección, se muestra la entrada o salida interna que explica el cambio de saldo de las cuentas consultadas, separada del flujo externo.
- Fondear o rescatar principal de una inversión entre cuentas propias es transferencia interna. Una comisión efectivamente pagada es un egreso externo independiente.
- Las revaluaciones sin efectivo son ajustes sin flujo. Solo un rendimiento efectivamente acreditado y disponible genera entrada financiera; si ya se reconoció como valuación, se revierte o reclasifica esa valuación para no duplicar el saldo.

### 4.5 Saldos del informe y cobertura

Referencias: RF-CFL-02, RF-CFL-10 y RF-CFL-14,
RN-044, RN-046 y RN-052, sección 10.4.

- El saldo inicial del informe es el saldo de libro inmediatamente anterior al inicio: apertura más todos los movimientos y ajustes efectivos anteriores de las cuentas seleccionadas.
- Si una apertura cae dentro del rango, se muestra como incorporación de saldo sin flujo en el puente de ajustes; nunca como cobro.
- Flujo externo neto = entradas externas − salidas externas.
- Transferencias netas de la selección = internas recibidas desde cuentas fuera de la selección − internas enviadas a cuentas fuera de la selección. Con todas las cuentas propias son cero.
- Saldo final por flujo = saldo inicial + flujo externo neto + transferencias netas de la selección.
- Saldo final de libro = saldo final por flujo + ajustes sin flujo del período, con su signo. Debe coincidir con el libro de las mismas cuentas y fecha de corte.
- Un período cubierto sin movimientos muestra entradas, salidas y flujo neto en cero y conserva su saldo inicial. Consultar antes de la fecha inicial disponible muestra cobertura incompleta, no actividad cero supuesta.

### 4.6 Otras entradas y salidas reales

Referencias: RF-GAS-04 a RF-GAS-09, RF-CHQ-01 a RF-CHQ-05,
RF-CFL-17, RN-021, RN-022, RN-035, RN-036, RN-049 y RN-050.

- Solo se contemplan cheques propios. Emitirlos o entregarlos no genera egreso bancario: el débito efectivo produce un único pago y salida. Compra y cheque representan el mismo compromiso; rechazo o anulación no inventan débitos ni reintegros.
- Recibir o devolver garantías genera flujo real sin crear ventas por sí mismo. Aplicar una garantía ya recibida a una venta no genera un segundo cobro.
- Financiación recibida y aportes monetarios son entradas reales. La cuota pagada de un crédito es salida completa, aunque el capital no reduzca la ganancia; capital, interés y comisión se distinguen cuando se conocen. Los retiros de socios no son gastos operativos.
- Un gasto compartido pagado por JM Hielos muestra toda la salida de dinero, separando su parte familiar del costo atribuible al hielo, incluso si esa proporción sigue sin determinar.
- Un gasto pagado por un socio desde una cuenta personal fuera del perímetro no crea una salida de JM Hielos: se registra la obligación o aporte no monetario. Un reintegro posterior desde una cuenta del negocio sí produce salida en su fecha efectiva.

### 4.7 Conciliación y cierre semanal

Referencias: RF-CON-01 a RF-CON-10, RN-027, sección 10.4.

- El administrador concilia semanalmente por período y fecha de corte: compara saldo calculado, saldo real y diferencia en cada caja, banco, billetera e inversión.
- También registra conteos de insumos e hielo y revisa ventas, cobros, deudas, gastos, transferencias y eventos sin rendir.
- Cada diferencia se investiga; si corresponde un ajuste positivo o negativo, exige motivo y auditoría. No se corrige editando el saldo total ni se presume que una diferencia sea un cobro o pago.
- El cierre conserva resumen, usuario y fecha e impide modificaciones ordinarias del período.
- Solo ADMIN puede reabrir con motivo y auditoría. Las correcciones conservan versiones y exigen recalcular los cierres posteriores afectados.

## 5. Auditoría e integridad

Referencias: RF-AUD, RNF-INT-01 a RNF-INT-09, RF-CFL-11,
RF-CFL-12 y RF-CFL-18, RN-025, RN-026, RN-038, RN-047 y RN-048,
secciones 9.1 a 9.3 y 10.4.

- Las operaciones importantes conservan usuario, fecha, motivo y valores relevantes.
- Los registros financieros confirmados no se eliminan físicamente.
- Un error de carga se corrige mediante reversión vinculada en la fecha efectiva del original y reemplazo si corresponde. Si el período está cerrado, primero se reabre. La reversión resta del mismo componente del original, sin inflar entradas y salidas; se conserva la fecha real de corrección.
- Un reembolso real es un egreso en la fecha efectiva de devolución y conserva el cobro histórico. Anular una venta no supone devolver dinero.
- Distinguir fecha operativa, fecha efectiva del dinero y fecha y hora real de carga en UTC; presentar en zona local. La fecha de venta no sustituye a la de cobro.
- Cada movimiento tiene ID único, clave de idempotencia por efecto financiero, cuenta, moneda, importe mayor que cero, sentido, clase, categoría de flujo cuando corresponda, origen con tipo e ID, estado y usuario. Conservar vínculos de transferencia, reversión y aplicación de pago, motivo cuando corresponda, referencia opcional y cierre afectado.
- Cada total permite abrir sus movimientos y operaciones de origen. Resumen y detalle de Cash Flow usan un mismo corte consistente de datos, incluso ante confirmaciones concurrentes.
- Los importes usan ARS y decimales exactos, sin conversiones implícitas; la presentación monetaria tiene dos decimales. Conservar precisión en cálculos y exponer la regla de redondeo aplicada al mostrar o cerrar importes.
- Reintentar una confirmación devuelve la operación existente: no duplica movimientos de dinero, stock ni costos. Las operaciones relacionadas se confirman atómicamente.

## 6. Calidad y experiencia

Referencias: RNF-USA, RNF-ACC, RNF-SEC.

- La aplicación debe funcionar desde celular y computadora.
- Los errores deben ser claros para el usuario.
- Las operaciones frecuentes deben requerir pocos pasos.
- Los formularios deben ser accesibles y fáciles de utilizar.
- No exponer contraseñas, tokens ni información sensible.

## 7. Reglas para la IA

- No asumir que un requisito ya está implementado.
- No agregar funcionalidades fuera de la ERS ni de las decisiones posteriores confirmadas sin autorización.
- Si la ERS contradice el código, informar antes de modificar.
- Priorizar las reglas relacionadas con la tarea actual.
- Consultar la ERS completa cuando este resumen no alcance.
- Si la ERS completa no está disponible o no puede leerse, informarlo y solicitarla; no suponer su contenido.
- Verificar las reglas críticas mediante pruebas.
- Para futuras implementaciones de Cash Flow, usar CA-40 a CA-57 para el MVP y CA-58 para F1, junto con los criterios previos vigentes y la trazabilidad de la sección 14.1. Las pruebas de permisos también deben contemplar la decisión confirmada de LECTOR.
