# Guía de presentación de JM Hielos

## 1. Iniciar una demostración con ejemplos

Desde la raíz del repositorio, con Docker Desktop abierto:

```powershell
docker compose up -d db
docker compose ps
cd api
npm.cmd run demo:qa
```

Esperá el mensaje **Presentación QA lista en http://127.0.0.1:5173**. La primera preparación tarda unos minutos: crea la base local aislada `jm_hielos_qa_presentacion`, aplica las nueve migraciones existentes y ejecuta el circuito con Chrome, React, NestJS y PostgreSQL reales. Requiere Chrome instalado en su ubicación habitual de Windows y dependencias instaladas en `api/` y `web/`.

Abrí **http://127.0.0.1:5173**. Los accesos ficticios ADMIN, OPERADOR y LECTOR están en **`api/.tmp/demo-qa-acceso.json`**: usá `usuarios.ADMIN` y `clave` para entrar. Abrí ese archivo local en tu editor; está ignorado por Git. La guía no contiene contraseñas.

Este modo usa NestJS en `127.0.0.1:3106` y conserva todos los datos de desarrollo. Los siguientes inicios reutilizan la base y los accesos de la demostración, sin vaciarla ni volver a cargar los ejemplos. Ctrl+C en la terminal cierra los servidores. El puerto 5173 debe estar libre antes de iniciar; no se detienen servidores ajenos automáticamente.

## 2. Recorrido y resultados preparados

Los nombres de los registros del recorrido comienzan con **QA demo**. Los importes son ejemplos en ARS, exclusivos de la base de presentación.

| Orden y pantalla | Qué mostrar y comprobar |
| --- | --- |
| 1. Inicio | Resumen del mes y accesos. La aplicación consulta la API real. |
| 2. Clientes, Productos y Proveedores | Alta, consulta, edición, desactivación y reactivación. Las bajas son lógicas y conservan historia. Hay un cliente, un proveedor y productos de 3 y 5 kg del circuito. |
| 3. Cuentas financieras | Efectivo con apertura de 10.000 y banco con apertura de 0. El saldo de apertura se conserva separado de los ingresos. |
| 4. Categorías | Una categoría activa de INGRESO y otra de EGRESO, grupo Operación. |
| 5. Insumos | Dos bolsas vacías, presentación de 100 unidades. Compra de 7.000: pago inicial 2.000 y posterior 1.000; saldo proveedor 4.000. El segundo pago no vuelve a ingresar bolsas. |
| 6. Producción | Se trasladó un paquete de cada insumo y se produjeron lotes de 50 bolsas de 3 kg y 20 de 5 kg. En depósito quedan 300 y 100 bolsas vacías; abiertas, 50 y 80. |
| 7. Precios | Lista: 3 kg a 2.000 y 5 kg a 3.000. El cliente tiene un precio particular activo de 3.200 para 5 kg. |
| 8. Ventas y entregas | Venta de 90.000: cobro mixto inicial de 70.000 y posterior de 20.000. Otra venta con ambos productos por 10.400, totalmente cobrada. Venta de 9.600 inicialmente fiada, con cobro posterior de 3.200. |
| 9. Deudas de clientes | Deuda restante 6.400. Abrí el detalle para mostrar los cobros y cuentas. |
| 10. Stock | Después de las tres ventas quedan 3 bolsas de 3 kg y 15 de 5 kg. Los cobros posteriores conservaron esas cantidades. |
| 11. Cash Flow | Consultá el mes actual y cada cuenta. Efectivo: ingresos 63.200, egresos 3.000, neto 60.200 y saldo de libro 70.200. Banco: ingresos/neto/saldo 40.400 y egresos 0. Consolidado: ingresos 103.600, egresos 3.000 y saldo de libro 110.600. Las deudas pendientes no son ingresos. |
| 12. Permisos | Cerrá sesión y entrá con OPERADOR: consulta, vende y cobra; la configuración y producción corresponden a ADMIN. LECTOR consulta sin acciones de escritura. |

Estos valores corresponden al final de la preparación inicial. Las operaciones posteriores se conservan y cambian los resultados; reiniciar la demo no los restablece.

## 3. Una operación nueva durante la exposición

En la base de presentación, entrá como ADMIN u OPERADOR:

1. En **Ventas y entregas**, elegí **Registrar venta entregada** y el cliente QA demo.
2. Agregá **2 bolsas de 3 kg** y **1 de 5 kg**. Sin envío, el total debe ser **7.200**. Elegí responsables activos de preparación, entrega y seguimiento; completá el motivo.
3. Para mostrar una venta fiada, confirmá sin agregar cobros. Debe quedar deuda de 7.200 para esa venta; el stock pasa de 3/15 a **1/14**. Cash Flow conserva sus ingresos anteriores.
4. En **Deudas de clientes**, buscá esa venta de 7.200 y elegí **Cobrar saldo**. Recibí **5.000** en efectivo con categoría de ingreso: la venta queda parcial por **2.200** y el stock sigue 1/14.
5. Registrá luego los **2.200** restantes sobre esa misma venta. Queda saldada; el stock sigue 1/14 y los ingresos aumentan, en total, 7.200. La deuda previa del cliente de 6.400 permanece.

Los cobros vinculados se registran desde Ventas/Deudas. No repitas esos mismos hechos como movimientos manuales. Las fechas deben incluir la hora real; el formulario utiliza la zona de Argentina.

## 4. Usar la base real de desarrollo

La migración comercial ya está aplicada en `jm_hielos`. Para trabajar con datos reales, cerrá el modo de presentación e iniciá los procesos habituales en dos terminales, desde la raíz:

```powershell
# Terminal API
cd api
npm.cmd run start:dev
```

```powershell
# Terminal frontend
cd web
npm.cmd run dev
```

Abrí http://127.0.0.1:5173 con tu ADMIN real. La API habitual usa el puerto 3000; el proxy de Vite apunta a esa API. Se conserva la configuración privada existente.

Antes de vender en una instalación sin datos operativos:

1. Revisá productos, clientes y proveedores. En **Precios → Preparar catálogo inicial** podés agregar los tamaños/listas que falten y Consumidor final; completá después los precios reales y asigná la lista a cada cliente.
2. Creá o activá cuentas ARS y categorías de INGRESO/EGRESO. Usá saldos de apertura reales. En la revisión inicial de desarrollo no había categorías activas.
3. Configurá bolsas vacías y su presentación. Registrá compras y pagos efectivamente realizados; para existencias anteriores, usá un conteo/ajuste justificado con costo explícito cuando corresponda.
4. Trasladá paquetes completos a producción. Registrá las bolsas usadas, rotas y terminadas aptas verificadas físicamente. Desarrollo no recibió stock ni precios ficticios durante la preparación de esta presentación.

## 5. Límites que deben explicarse

La ERS 1.4 continúa incompleta. No presentar como terminados: eventos y rendiciones; reposiciones y equipos/alquileres; gastos y obligaciones generales; cheques e inversiones; transferencias, conciliación y cierres; reversión de pagos/cobros y reembolsos; costeo completo y reportes/exportaciones; administración web de usuarios, cambio de contraseña y revocación de sesiones; carga inicial integral, PWA, OpenAPI completo y restauración comprobada.

El costo histórico de las líneas de venta permanece pendiente; no equivale a cero ni permite anunciar ganancia exacta. Anular una venta puede devolver existencias aptas y conservar un crédito, pero no genera un reintegro automático de dinero.

Evidencia y detalle por requisito: [estado-ERS.md](estado-ERS.md). Regresión reproducible: `npm.cmd test -- --runInBand`, `npm.cmd run test:e2e -- --runInBand`, `npm.cmd run test:postgres` y `npm.cmd run test:web:qa` desde `api/`; `npm.cmd test`, `npm.cmd run lint` y `npm.cmd run build` desde `web/`. Las pruebas reales utilizan otra base aislada, `jm_hielos_qa_ers14`.
