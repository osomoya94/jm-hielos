import 'dotenv/config';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { hash } from 'bcrypt';
import { spawn, spawnSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

// Chrome usa un perfil QA separado. Las credenciales aleatorias de prueba no se imprimen.
const raiz = fileURLToPath(new URL('../../', import.meta.url));
const presentacion = process.argv.includes('--presentacion');
const nombreQa = presentacion
  ? 'jm_hielos_qa_presentacion'
  : 'jm_hielos_qa_ers14';
const puertoWeb = presentacion ? 5173 : 5175;
const puertoApi = presentacion ? 3106 : 3105;
const urlWeb = 'http://127.0.0.1:' + puertoWeb;
const urlApi = 'http://127.0.0.1:' + puertoApi;
const archivoAcceso = raiz + 'api/.tmp/demo-qa-acceso.json';
const original = new Client({ connectionString: process.env.DATABASE_URL })
  .connectionParameters;
if (
  original.host !== '127.0.0.1' ||
  Number(original.port) !== 5433 ||
  original.database !== 'jm_hielos'
)
  throw new Error(
    'Se requiere la configuración local de desarrollo para derivar QA',
  );
const urlQa = new URL(process.env.DATABASE_URL);
urlQa.pathname = '/' + nombreQa;
const destino = new Client({ connectionString: urlQa.toString() })
  .connectionParameters;
if (
  destino.database !== nombreQa ||
  destino.host !== '127.0.0.1' ||
  Number(destino.port) !== 5433
)
  throw new Error('Destino QA inválido');
for (const puerto of [puertoApi, puertoWeb]) {
  const prueba = createServer();
  await new Promise((resolve, reject) => {
    prueba.once('error', () =>
      reject(
        new Error(
          'El puerto ' +
            puerto +
            ' está ocupado; revisá el servidor existente antes de iniciar QA',
        ),
      ),
    );
    prueba.listen(puerto, '127.0.0.1', () => prueba.close(resolve));
  });
}
if (presentacion) {
  // Una base exclusiva para exponer ejemplos sin tocar desarrollo ni limpiar QA.
  const administrativa = new URL(process.env.DATABASE_URL);
  administrativa.pathname = '/postgres';
  const administrador = new Client({
    connectionString: administrativa.toString(),
  });
  try {
    await administrador.connect();
    const existe = await administrador.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [nombreQa],
    );
    if (!existe.rowCount)
      await administrador.query('CREATE DATABASE "jm_hielos_qa_presentacion"');
  } finally {
    await administrador.end();
  }
  const migrar = spawnSync(
    process.execPath,
    [
      'node_modules/prisma/build/index.js',
      'migrate',
      'deploy',
      '--config',
      'prisma7.config.ts',
    ],
    {
      env: { ...process.env, DATABASE_URL: urlQa.toString() },
      encoding: 'utf8',
    },
  );
  if (migrar.status !== 0)
    throw new Error(
      'No se pudo preparar el historial existente en la base de presentación',
    );
}
process.env.DATABASE_URL = urlQa.toString();
process.env.JWT_SECRET = randomUUID();
const { AppModule } = await import('../dist/src/app.module.js');
const { PrismaService } = await import('../dist/src/prisma/prisma.service.js');
const app = await NestFactory.create(AppModule, { logger: false });
let chrome, vite, websocket;
try {
  app.enableCors({ origin: urlWeb });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(puertoApi, '127.0.0.1');
  const prisma = app.get(PrismaService);
  const actual = await prisma.$queryRaw`SELECT current_database() AS nombre`;
  assert.equal(actual[0].nombre, nombreQa);
  let accesoGuardado;
  if (presentacion) {
    try {
      accesoGuardado = JSON.parse(await readFile(archivoAcceso, 'utf8'));
      assert.equal(accesoGuardado.base, nombreQa);
    } catch (error) {
      if (error.code !== 'ENOENT')
        throw new Error(
          'Revisá el archivo local de acceso a la demo; no se sobrescribirá',
        );
    }
  }
  const clave = accesoGuardado?.clave ?? randomUUID();
  const passwordHash = await hash(clave, 4);
  const personas = {};
  for (const rol of ['ADMIN', 'OPERADOR', 'LECTOR']) {
    personas[rol] = accesoGuardado
      ? await prisma.usuario.findUniqueOrThrow({
          where: { username: accesoGuardado.usuarios[rol] },
        })
      : await prisma.usuario.create({
          data: { username: 'qa-web-' + randomUUID(), passwordHash, rol },
        });
    assert.equal(personas[rol].rol, rol);
    assert.equal(personas[rol].activo, true);
  }
  const sufijo = randomUUID().slice(0, 8);
  let producto, productoDos, cliente, proveedor, categoria, categoriaEgreso;
  const cuentas = [];
  vite = spawn(
    process.execPath,
    [
      raiz + 'web/node_modules/vite/bin/vite.js',
      '--host',
      '127.0.0.1',
      '--port',
      String(puertoWeb),
      '--strictPort',
    ],
    {
      cwd: raiz + 'web',
      windowsHide: true,
      stdio: 'ignore',
      env: { ...process.env, VITE_API_URL: urlApi },
    },
  );
  const esperar = async (fn, mensaje) => {
    for (let i = 0; i < 100; i++) {
      try {
        if (await fn()) return;
      } catch {
        /* Puede seguir cargando. */
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(mensaje);
  };
  await esperar(
    async () => (await fetch(urlWeb)).ok,
    'Vite QA no inició en el puerto ' + puertoWeb,
  );
  assert.equal(
    vite.exitCode,
    null,
    'El servidor Vite QA terminó inesperadamente',
  );
  assert.ok(
    (await (await fetch(urlWeb + '/src/api.js')).text()).includes(urlApi),
    'La web no apunta a la API QA aislada',
  );
  if (!accesoGuardado) {
    const perfil = raiz + 'api/.tmp/chrome-comercial-' + randomUUID();
    await mkdir(perfil, { recursive: true });
    chrome = spawn(
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--remote-debugging-port=0',
        '--user-data-dir=' + perfil,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-component-update',
        '--disable-sync',
        'about:blank',
      ],
      { windowsHide: true, stdio: 'ignore' },
    );
    let puerto;
    await esperar(async () => {
      puerto = (await readFile(perfil + '/DevToolsActivePort', 'utf8')).split(
        '\n',
      )[0];
      return puerto;
    }, 'Chrome QA no inició');
    const paginas = await (
      await fetch('http://127.0.0.1:' + puerto + '/json/list', {
        signal: AbortSignal.timeout(5000),
      })
    ).json();
    websocket = new WebSocket(
      paginas.find((p) => p.type === 'page').webSocketDebuggerUrl,
    );
    await new Promise((resolve, reject) => {
      websocket.addEventListener('open', resolve, { once: true });
      websocket.addEventListener('error', reject, { once: true });
    });
    let secuencia = 0;
    const pendientes = new Map();
    const erroresPagina = [];
    websocket.addEventListener('message', (e) => {
      const mensaje = JSON.parse(e.data);
      if (mensaje.method === 'Runtime.exceptionThrown')
        erroresPagina.push(mensaje.params.exceptionDetails.text);
      if (mensaje.id && pendientes.has(mensaje.id)) {
        const { resolve, reject, timer } = pendientes.get(mensaje.id);
        clearTimeout(timer);
        pendientes.delete(mensaje.id);
        if (mensaje.error) reject(new Error(mensaje.error.message));
        else resolve(mensaje.result);
      }
    });
    const cdp = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++secuencia;
        const timer = setTimeout(() => {
          pendientes.delete(id);
          reject(new Error('Chrome no respondió a ' + method));
        }, 5000);
        pendientes.set(id, { resolve, reject, timer });
        websocket.send(JSON.stringify({ id, method, params }));
      });
    const evaluar = async (expression) => {
      const r = await cdp('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (r.exceptionDetails)
        throw new Error(
          'Interacción QA: ' +
            String(
              r.exceptionDetails.exception?.description ??
                r.exceptionDetails.text,
            )
              .replaceAll(clave, '[clave QA omitida]')
              .slice(0, 500),
        );
      return r.result.value;
    };
    const rellenar = async (selector, valor) => {
      const exito = await evaluar(
        `(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false; const prototipo = e.tagName === 'SELECT' ? HTMLSelectElement.prototype : e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototipo, 'value').set.call(e, ${JSON.stringify(String(valor))}); e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', {bubbles:true})); return true; })()`,
      );
      assert.equal(exito, true, 'Falta el campo ' + selector);
    };
    const click = async (texto) => {
      assert.equal(
        await evaluar(
          `(() => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === ${JSON.stringify(texto)}); if (!b) return false; b.click(); return true; })()`,
        ),
        true,
        'Falta acción ' + texto,
      );
    };
    const navegar = async (hash, titulo) => {
      await evaluar('location.hash=' + JSON.stringify(hash));
      await esperar(
        () =>
          evaluar(
            'document.querySelector("h1")?.textContent === ' +
              JSON.stringify(titulo) +
              ' && !document.querySelector(".estado-carga")',
          ),
        'No cargó ' + titulo,
      );
    };
    const cerrarFormulario = () =>
      esperar(
        () =>
          evaluar(
            '!document.querySelector("dialog[open]") && !document.querySelector(".estado-carga")',
          ),
        'El formulario no confirmó el registro',
      );
    async function login(rol) {
      await esperar(
        () => evaluar('Boolean(document.querySelector("#username"))'),
        'No se mostró login',
      );
      await rellenar('#username', personas[rol].username);
      await rellenar('#password', clave);
      await click('Ingresar');
      await esperar(
        () => evaluar('Boolean(document.querySelector(".sidebar"))'),
        'Falló el login QA de ' + rol,
      );
    }
    const clickFila = async (nombre, accion) => {
      assert.equal(
        await evaluar(
          `(() => { const fila = [...document.querySelectorAll('tbody tr')].find(f => f.textContent.includes(${JSON.stringify(nombre)})); const boton = fila && [...fila.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(accion)}); if (!boton) return false; boton.click(); return true; })()`,
        ),
        true,
        'Falta ' + accion + ' de ' + nombre,
      );
    };
    async function crearCatalogo(vista, titulo, boton, campos, modelo) {
      await navegar(vista, titulo);
      await click(boton);
      for (const [campo, valor] of Object.entries(campos))
        await rellenar('dialog [name=' + campo + ']', valor);
      await evaluar('document.querySelector("dialog form").requestSubmit()');
      await cerrarFormulario();
      return prisma[modelo].findFirstOrThrow({
        where: { nombre: campos.nombre },
      });
    }
    async function editarYActivar(vista, titulo, registro, modelo) {
      await navegar(vista, titulo);
      await rellenar('#buscar-catalogo', registro.nombre);
      await clickFila(registro.nombre, 'Editar');
      const nombre = registro.nombre + ' editado';
      await rellenar('dialog [name=nombre]', nombre);
      await click('Guardar cambios');
      await cerrarFormulario();
      await rellenar('#buscar-catalogo', nombre);
      await clickFila(nombre, 'Desactivar');
      await evaluar(
        'document.querySelector("dialog .dialogo-acciones .primario").click()',
      );
      await cerrarFormulario();
      assert.equal(
        (await prisma[modelo].findUniqueOrThrow({ where: { id: registro.id } }))
          .activo,
        false,
      );
      await rellenar('#estado-catalogo', 'inactivos');
      await clickFila(nombre, 'Activar');
      await evaluar(
        'document.querySelector("dialog .dialogo-acciones .primario").click()',
      );
      await cerrarFormulario();
      const actualizado = await prisma[modelo].findUniqueOrThrow({
        where: { id: registro.id },
      });
      assert.equal(actualizado.activo, true);
      assert.equal(actualizado.nombre, nombre);
      return actualizado;
    }
    await cdp('Page.enable');
    await cdp('Runtime.enable');
    await cdp('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp('Page.navigate', { url: urlWeb });
    await login('ADMIN');
    console.log(
      'QA: login ADMIN aprobado; verificando catálogos desde la web.',
    );

    // Todo el circuito de negocio se carga con React y la API real.
    producto = await crearCatalogo(
      'productos',
      'Productos',
      'Nuevo producto',
      {
        nombre: 'QA demo 3 kg ' + sufijo,
        pesoKg: '3',
        unidad: 'bolsa',
      },
      'producto',
    );
    producto = await editarYActivar(
      'productos',
      'Productos',
      producto,
      'producto',
    );
    productoDos = await crearCatalogo(
      'productos',
      'Productos',
      'Nuevo producto',
      {
        nombre: 'QA demo 5 kg ' + sufijo,
        pesoKg: '5',
        unidad: 'bolsa',
      },
      'producto',
    );
    cliente = await crearCatalogo(
      'clientes',
      'Clientes',
      'Nuevo cliente',
      {
        nombre: 'QA demo cliente ' + sufijo,
        tipoCliente: 'HABITUAL',
        observaciones: 'Datos ficticios exclusivos de QA',
      },
      'cliente',
    );
    cliente = await editarYActivar('clientes', 'Clientes', cliente, 'cliente');
    proveedor = await crearCatalogo(
      'proveedores',
      'Proveedores',
      'Nuevo proveedor',
      {
        nombre: 'QA demo proveedor ' + sufijo,
      },
      'proveedor',
    );
    proveedor = await editarYActivar(
      'proveedores',
      'Proveedores',
      proveedor,
      'proveedor',
    );
    for (const tipo of ['EFECTIVO', 'BANCO']) {
      const cuenta = await crearCatalogo(
        'cuentas',
        'Cuentas financieras',
        'Nueva cuenta',
        {
          nombre: 'QA demo ' + tipo + ' ' + sufijo,
          tipo,
          titularInterno: 'QA',
          saldoInicial: tipo === 'EFECTIVO' ? '10000' : '0',
          fechaApertura: '2026-01-01',
        },
        'cuentaFinanciera',
      );
      cuentas.push(
        await editarYActivar(
          'cuentas',
          'Cuentas financieras',
          cuenta,
          'cuentaFinanciera',
        ),
      );
    }
    for (const sentido of ['INGRESO', 'EGRESO']) {
      let cat = await crearCatalogo(
        'categorias',
        'Categorías',
        'Nueva categoría',
        {
          nombre: 'QA demo ' + sentido + ' ' + sufijo,
          grupo: 'OPERACION',
          sentido,
        },
        'categoriaFlujo',
      );
      cat = await editarYActivar(
        'categorias',
        'Categorías',
        cat,
        'categoriaFlujo',
      );
      if (sentido === 'INGRESO') categoria = cat;
      else categoriaEgreso = cat;
    }

    const insumos = [];
    console.log(
      'QA: catálogos aprobados; verificando compras, pagos y producción.',
    );
    for (const p of [producto, productoDos]) {
      await navegar('insumos', 'Insumos');
      await click('Nuevo insumo');
      const nombre = 'Bolsas vacías ' + p.nombre;
      await rellenar('dialog [name=nombre]', nombre);
      await rellenar('dialog [name=productoId]', p.id);
      await rellenar('dialog [name=stockMinimo]', '100');
      await click('Confirmar registro');
      await cerrarFormulario();
      insumos.push(
        await prisma.insumo.findUniqueOrThrow({
          where: { nombre },
          include: { presentaciones: true },
        }),
      );
    }
    const presentaciones = insumos.map((i) => i.presentaciones[0]);
    await click('Registrar compra');
    await rellenar('dialog [name=proveedorId]', proveedor.id);
    const comprobante = 'QA-COMPRA-' + sufijo;
    await rellenar('dialog [name=comprobante]', comprobante);
    await rellenar('#compra-presentacion-0', presentaciones[0].id);
    await rellenar('#compra-paquetes-0', '4');
    await rellenar('#compra-costo-0', '4000');
    await click('Agregar insumo a la compra');
    await rellenar('#compra-presentacion-1', presentaciones[1].id);
    await rellenar('#compra-paquetes-1', '2');
    await rellenar('#compra-costo-1', '3000');
    await rellenar('dialog [name=paga]', 'si');
    await rellenar('dialog [name=cuentaId]', cuentas[0].id);
    await rellenar('dialog [name=categoriaId]', categoriaEgreso.id);
    await rellenar('dialog [name=importe]', '2000');
    await rellenar('dialog [name=motivo]', 'Compra parcial QA');
    await click('Confirmar registro');
    await cerrarFormulario();
    let compra = await prisma.compraInsumo.findFirstOrThrow({
      where: { proveedorId: proveedor.id, comprobante },
    });
    assert.equal(compra.total.toString(), '7000');
    assert.equal(compra.pagado.toString(), '2000');
    const deposito = async () =>
      Promise.all(
        presentaciones.map((p) =>
          prisma.existenciaInsumo
            .findUniqueOrThrow({
              where: {
                presentacionId_ubicacion: {
                  presentacionId: p.id,
                  ubicacion: 'DEPOSITO',
                },
              },
            })
            .then((e) => e.unidades.toString()),
        ),
      );
    assert.deepEqual(await deposito(), ['400', '200']);
    await clickFila(comprobante, 'Registrar pago');
    await rellenar('dialog [name=cuentaId]', cuentas[0].id);
    await rellenar('dialog [name=categoriaId]', categoriaEgreso.id);
    await rellenar('dialog [name=importe]', '1000');
    await rellenar(
      'dialog [name=motivo]',
      'Segundo pago QA sin duplicar insumos',
    );
    await click('Confirmar registro');
    await cerrarFormulario();
    compra = await prisma.compraInsumo.findUniqueOrThrow({
      where: { id: compra.id },
    });
    assert.equal(compra.pagado.toString(), '3000');
    assert.deepEqual(await deposito(), ['400', '200']);

    for (const p of presentaciones) {
      await click('Trasladar a producción');
      await rellenar('dialog [name=presentacionId]', p.id);
      await rellenar('dialog [name=paquetes]', '1');
      await rellenar('dialog [name=motivo]', 'Abrir un paquete QA');
      await click('Confirmar registro');
      await cerrarFormulario();
    }
    assert.deepEqual(await deposito(), ['300', '100']);
    for (const [i, p] of [producto, productoDos].entries()) {
      await navegar('produccion', 'Producción');
      await click('Registrar lote');
      await rellenar('dialog [name=codigo]', 'LOTE-QA-' + sufijo + '-' + i);
      await rellenar('dialog [name=productoId]', p.id);
      await rellenar('dialog [name=presentacionBolsaId]', presentaciones[i].id);
      await rellenar('dialog [name=responsableId]', personas.ADMIN.id);
      const cantidad = i === 0 ? '50' : '20';
      await rellenar('dialog [name=bolsasUsadas]', cantidad);
      await rellenar('dialog [name=cantidadApta]', cantidad);
      await rellenar('dialog [name=motivo]', 'Producción real del circuito QA');
      await click('Confirmar registro');
      await cerrarFormulario();
      assert.equal(
        (
          await prisma.stockTerminado.findUniqueOrThrow({
            where: { productoId: p.id },
          })
        ).cantidad,
        Number(cantidad),
      );
    }
    await navegar('precios', 'Precios');
    console.log('QA: producción aprobada; verificando precios y ventas.');
    const nombreLista = 'QA web lista ' + randomUUID().slice(0, 8);
    await click('Nueva lista');
    await rellenar('dialog [name=nombre]', nombreLista);
    await rellenar('dialog [name=tipo]', 'MAYORISTA');
    await rellenar(
      'dialog [name=motivo]',
      'Aceptación real desde navegador QA',
    );
    await click('Confirmar registro');
    await cerrarFormulario();
    const lista = await prisma.listaPrecio.findUniqueOrThrow({
      where: { nombre: nombreLista },
    });
    await click('Configurar precio');
    await rellenar('dialog [name=listaId]', lista.id);
    await rellenar('dialog [name=productoId]', producto.id);
    await rellenar('dialog [name=precio]', '2000');
    await rellenar('dialog [name=motivo]', 'Precio QA');
    await click('Confirmar registro');
    await cerrarFormulario();
    await click('Asignar lista al cliente');
    await rellenar('dialog [name=clienteId]', cliente.id);
    await rellenar('dialog [name=listaId]', lista.id);
    await rellenar('dialog [name=motivo]', 'Condición QA');
    await click('Confirmar registro');
    await cerrarFormulario();
    await click('Configurar precio');
    await rellenar('dialog [name=listaId]', lista.id);
    await rellenar('dialog [name=productoId]', productoDos.id);
    await rellenar('dialog [name=precio]', '3000');
    await rellenar('dialog [name=motivo]', 'Precio del segundo producto QA');
    await click('Confirmar registro');
    await cerrarFormulario();
    await click('Precio particular');
    await rellenar('dialog [name=clienteId]', cliente.id);
    await rellenar('dialog [name=productoId]', productoDos.id);
    await rellenar('dialog [name=precio]', '3200');
    await rellenar('dialog [name=motivo]', 'Acuerdo particular QA');
    await click('Confirmar registro');
    await cerrarFormulario();
    await click('Cerrar sesión');
    await login('OPERADOR');
    await navegar('insumos', 'Insumos');
    assert.equal(
      await evaluar(
        '[...document.querySelectorAll("button")].some(b => /Nuevo insumo|Registrar compra|Trasladar a producción/.test(b.textContent))',
      ),
      false,
      'OPERADOR recibió acciones de administración de insumos',
    );
    await navegar('ventas', 'Ventas y entregas');
    await click('Registrar venta entregada');
    await rellenar('dialog [name=clienteId]', cliente.id);
    await esperar(
      () => evaluar('!document.querySelector("dialog [role=status]")'),
      'No cargó el precio del cliente',
    );
    await rellenar('dialog [name=productoId]', producto.id);
    await rellenar('dialog [name=cantidad]', '45');
    await rellenar('dialog [name=preparacionResponsable]', personas.ADMIN.id);
    await rellenar('dialog [name=entregaResponsable]', personas.OPERADOR.id);
    await click('Agregar cobro real en otra cuenta');
    await rellenar('#cobro-cuenta-0', cuentas[0].id);
    await rellenar('#cobro-categoria-0', categoria.id);
    await rellenar('#cobro-importe-0', '40000');
    await click('Agregar cobro real en otra cuenta');
    await rellenar('#cobro-cuenta-1', cuentas[1].id);
    await rellenar('#cobro-categoria-1', categoria.id);
    await rellenar('#cobro-importe-1', '30000');
    await rellenar('dialog [name=motivo]', 'Venta QA desde navegador');
    assert.equal(
      await evaluar(
        'document.querySelector("dialog .resumen-operacion").textContent.includes("20.000,00")',
      ),
      true,
      'No se mostró el fiado antes de confirmar',
    );
    await click('Confirmar venta y cobros');
    await cerrarFormulario();
    const venta = await prisma.venta.findFirstOrThrow({
      where: { clienteId: cliente.id },
    });
    assert.equal(venta.total.toString(), '90000');
    assert.equal(
      (
        await prisma.stockTerminado.findUniqueOrThrow({
          where: { productoId: producto.id },
        })
      ).cantidad,
      5,
    );
    assert.equal(
      await prisma.operacionInventario.count({
        where: { origenTipo: 'VENTA', origenId: venta.id },
      }),
      1,
    );
    await navegar('deudas', 'Deudas de clientes');
    await rellenar('#comercial-cliente', cliente.id);
    await click('Cobrar saldo');
    await rellenar('#cobro-cuenta-0', cuentas[0].id);
    await rellenar('#cobro-categoria-0', categoria.id);
    await rellenar('#cobro-importe-0', '20000');
    await rellenar('dialog [name=motivo]', 'Saldo QA desde navegador');
    await click('Confirmar registro');
    await cerrarFormulario();
    assert.equal(
      await prisma.cobroVenta.count({ where: { ventaId: venta.id } }),
      2,
    );
    assert.equal(
      (
        await prisma.stockTerminado.findUniqueOrThrow({
          where: { productoId: producto.id },
        })
      ).cantidad,
      5,
    );
    await navegar('ventas', 'Ventas y entregas');
    await rellenar('#comercial-cliente', cliente.id);
    async function abrirVenta(lineas) {
      await click('Registrar venta entregada');
      await rellenar('dialog [name=clienteId]', cliente.id);
      await esperar(
        () => evaluar('!document.querySelector("dialog [role=status]")'),
        'No cargaron los precios QA',
      );
      for (const [i, linea] of lineas.entries()) {
        if (i) await click('Agregar producto');
        await rellenar('#venta-producto-' + i, linea.productoId);
        await rellenar('#venta-cantidad-' + i, linea.cantidad);
      }
      await rellenar('dialog [name=preparacionResponsable]', personas.ADMIN.id);
      await rellenar('dialog [name=entregaResponsable]', personas.OPERADOR.id);
      await rellenar('dialog [name=motivo]', 'Venta adicional QA');
    }
    await abrirVenta([
      { productoId: producto.id, cantidad: '2' },
      { productoId: productoDos.id, cantidad: '2' },
    ]);
    await click('Agregar cobro real en otra cuenta');
    await rellenar('#cobro-cuenta-0', cuentas[1].id);
    await rellenar('#cobro-categoria-0', categoria.id);
    await rellenar('#cobro-importe-0', '10400');
    await click('Confirmar venta y cobros');
    await cerrarFormulario();
    const completa = await prisma.venta.findFirstOrThrow({
      where: { clienteId: cliente.id, total: '10400' },
      include: { detalles: true, cobros: true },
    });
    assert.equal(completa.detalles.length, 2);
    assert.equal(completa.cobros[0].importe.toString(), '10400');
    const cobrosAntesFiado = await prisma.cobroVenta.count({
      where: { venta: { clienteId: cliente.id } },
    });
    await abrirVenta([{ productoId: productoDos.id, cantidad: '3' }]);
    await click('Confirmar venta y cobros');
    await cerrarFormulario();
    const fiada = await prisma.venta.findFirstOrThrow({
      where: { clienteId: cliente.id, total: '9600' },
      include: { cobros: true },
    });
    assert.equal(fiada.cobros.length, 0);
    assert.equal(
      await prisma.cobroVenta.count({
        where: { venta: { clienteId: cliente.id } },
      }),
      cobrosAntesFiado,
    );
    await navegar('deudas', 'Deudas de clientes');
    await rellenar('#comercial-cliente', cliente.id);
    await click('Cobrar saldo');
    await rellenar('#cobro-cuenta-0', cuentas[0].id);
    await rellenar('#cobro-categoria-0', categoria.id);
    await rellenar('#cobro-importe-0', '3200');
    await rellenar(
      'dialog [name=motivo]',
      'Cobro posterior de la venta fiada QA',
    );
    await click('Confirmar registro');
    await cerrarFormulario();
    for (const [i, p] of [producto, productoDos].entries())
      assert.equal(
        (
          await prisma.stockTerminado.findUniqueOrThrow({
            where: { productoId: p.id },
          })
        ).cantidad,
        [3, 15][i],
      );

    await navegar('cash-flow', 'Cash Flow');
    console.log('QA: ventas y cobros aprobados; verificando Cash Flow.');
    for (const [i, cuenta] of cuentas.entries()) {
      await rellenar('#filtroCuenta', cuenta.id);
      await click('Consultar período');
      await esperar(
        () =>
          evaluar(
            '!document.querySelector(".estado-carga") && document.body.textContent.includes(' +
              JSON.stringify(cuenta.nombre) +
              ')',
          ),
        'No actualizó Cash Flow QA',
      );
      const totales = await evaluar(
        '[...document.querySelectorAll(".metricas .metrica strong")].map(e => e.textContent.replace(/[^0-9,.-]/g, ""))',
      );
      const cuerpo = await evaluar(
        'document.querySelector("main").textContent',
      );
      assert.ok(
        cuerpo.includes(i === 0 ? '63.200,00' : '40.400,00'),
        'Cash Flow no refleja los ingresos reales de la cuenta',
      );
      assert.ok(
        cuerpo.includes(i === 0 ? '3.000,00' : '0,00'),
        'Cash Flow no refleja solamente los pagos efectivos',
      );
      assert.deepEqual(
        totales,
        i === 0
          ? ['63.200,00', '3.000,00', '60.200,00']
          : ['40.400,00', '0,00', '40.400,00'],
      );
      assert.ok(
        cuerpo.includes(i === 0 ? '70.200,00' : '40.400,00'),
        'El saldo de libro no coincide con apertura y movimientos',
      );
    }
    await navegar('ventas', 'Ventas y entregas');
    await rellenar('#comercial-cliente', cliente.id);
    const capturas = raiz + 'docs/capturas/';
    await mkdir(capturas, { recursive: true });
    for (const ancho of [1440, 390]) {
      await cdp('Emulation.setDeviceMetricsOverride', {
        width: ancho,
        height: ancho === 390 ? 844 : 1000,
        deviceScaleFactor: 1,
        mobile: ancho === 390,
      });
      await new Promise((r) => setTimeout(r, 200));
      assert.equal(
        await evaluar('document.documentElement.scrollWidth <= innerWidth + 1'),
        true,
        'Desborde horizontal de página a ' + ancho,
      );
      const png = await cdp('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });
      await writeFile(
        capturas + 'comercial-qa-' + ancho + '.png',
        Buffer.from(png.data, 'base64'),
      );
    }
    await cdp('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await click('Cerrar sesión');
    await login('LECTOR');
    await navegar('precios', 'Precios');
    await rellenar('#precios-cliente', cliente.id);
    await esperar(
      () => evaluar('Boolean(document.getElementById("precios-del-cliente"))'),
      'LECTOR no pudo consultar los precios del cliente',
    );
    await navegar('ventas', 'Ventas y entregas');
    assert.equal(
      await evaluar(
        '[...document.querySelectorAll("button")].some(b => /Registrar venta|Cobrar saldo|Anular con motivo/.test(b.textContent))',
      ),
      false,
      'LECTOR recibió acciones de escritura',
    );
    for (const [vista, titulo] of Object.entries({
      inicio: 'Inicio',
      productos: 'Productos',
      clientes: 'Clientes',
      proveedores: 'Proveedores',
      cuentas: 'Cuentas financieras',
      categorias: 'Categorías',
      insumos: 'Insumos',
      produccion: 'Producción',
      stock: 'Stock',
      precios: 'Precios',
      deudas: 'Deudas de clientes',
      'cash-flow': 'Cash Flow',
      movimientos: 'Movimientos',
    })) {
      await navegar(vista, titulo);
      assert.equal(
        await evaluar('Boolean(document.querySelector("[role=alert]"))'),
        false,
        'No cargó la pantalla ' + titulo + ' para LECTOR',
      );
      assert.equal(
        await evaluar(
          '[...document.querySelectorAll("button")].some(b => /^(Nuevo |Nueva |Registrar compra|Registrar lote|Registrar venta|Confirmar registro|Cobrar saldo|Anular con motivo)/.test(b.textContent.trim()))',
        ),
        false,
        'LECTOR recibió escritura en ' + titulo,
      );
    }
    if (!presentacion) {
      // Cuenta separada: comprobar Movimientos sin mezclarlo con cobros de ventas.
      await click('Cerrar sesión');
      await login('ADMIN');
      const manual = await crearCatalogo(
        'cuentas',
        'Cuentas financieras',
        'Nueva cuenta',
        {
          nombre: 'QA manual ' + sufijo,
          tipo: 'EFECTIVO',
          titularInterno: 'QA',
          saldoInicial: '0',
          fechaApertura: '2026-01-01',
        },
        'cuentaFinanciera',
      );
      await navegar('movimientos', 'Movimientos');
      for (const tipo of ['COBRO', 'PAGO']) {
        await evaluar(
          'document.querySelector(\'input[name="tipo"][value="' +
            tipo +
            '"]\').click()',
        );
        await rellenar('#cuentaId', manual.id);
        await rellenar(
          '#categoriaId',
          tipo === 'COBRO' ? categoria.id : categoriaEgreso.id,
        );
        await rellenar('#importe', '1000');
        await rellenar(
          '#detalle',
          'Movimiento manual QA independiente de ventas',
        );
        await click(tipo === 'COBRO' ? 'Registrar cobro' : 'Registrar pago');
        await esperar(
          () =>
            evaluar(
              'document.querySelector(".confirmacion-movimiento strong")?.textContent.includes(' +
                JSON.stringify(
                  tipo === 'COBRO' ? 'Cobro registrado' : 'Pago registrado',
                ) +
                ')',
            ),
          'No se confirmó el movimiento manual QA',
        );
      }
      assert.equal(
        await prisma.movimientoFinanciero.count({
          where: { cuentaId: manual.id },
        }),
        2,
      );
      await navegar('cash-flow', 'Cash Flow');
      await rellenar('#filtroCuenta', manual.id);
      await click('Consultar período');
      await esperar(
        () =>
          evaluar(
            '!document.querySelector(".estado-carga") && document.querySelector(".movimientos .panel-cabecera").textContent.includes(' +
              JSON.stringify(manual.nombre) +
              ')',
          ),
        'No cargó Cash Flow manual QA',
      );
      const importes = await evaluar(
        '[...document.querySelectorAll(".metricas .metrica strong")].map(e => e.textContent.replace(/[^0-9,.-]/g, ""))',
      );
      assert.deepEqual(importes, ['1.000,00', '1.000,00', '0,00']);
    }
    assert.deepEqual(erroresPagina, []);
    if (presentacion) {
      await writeFile(
        archivoAcceso,
        JSON.stringify(
          {
            base: nombreQa,
            web: urlWeb,
            api: urlApi,
            clave,
            usuarios: Object.fromEntries(
              Object.entries(personas).map(([rol, p]) => [rol, p.username]),
            ),
            registros: {
              clienteId: cliente.id,
              productos: [producto.id, productoDos.id],
              cuentas: cuentas.map((c) => c.id),
            },
          },
          null,
          2,
        ),
        { flag: 'wx' },
      );
    }
    console.log(
      JSON.stringify(
        {
          resultado: 'APROBADO',
          entorno: 'PostgreSQL QA + NestJS real + React/Vite + Chrome',
          circuito:
            'CRUD sin borrados; cuentas y categorías; compra 7000/pagos 3000; traslados; producción 50/20; precios; venta parcial 90000, venta mixta 10400 y fiada 9600; cobros posteriores; Cash Flow; tres roles',
          stockFinal: [3, 15],
          saldoCliente: '6400.00',
          saldoProveedor: '4000.00',
          cobros: 4,
          responsive: [1440, 390],
          erroresJavascript: 0,
          desarrollo: 'sin escrituras',
          capturas: [
            'docs/capturas/comercial-qa-1440.png',
            'docs/capturas/comercial-qa-390.png',
          ],
        },
        null,
        2,
      ),
    );
  }
  if (presentacion) {
    websocket?.close();
    websocket = undefined;
    chrome?.kill();
    chrome = undefined;
    console.log('Presentación QA lista en ' + urlWeb);
    console.log(
      'Base aislada: ' +
        nombreQa +
        '. Accesos de prueba en api/.tmp/demo-qa-acceso.json (ignorado por Git).',
    );
    console.log(
      'Los datos de desarrollo permanecen intactos. Ctrl+C cierra estos servidores.',
    );
    await new Promise((resolve) => {
      process.once('SIGINT', resolve);
      process.once('SIGTERM', resolve);
    });
  }
} catch (error) {
  console.error(
    'La prueba web QA falló:',
    String(error.message).replace(
      /postgres(?:ql)?:\/\/[^\s'"<>]+/g,
      '[conexión omitida]',
    ),
  );
  process.exitCode = 1;
} finally {
  websocket?.close();
  chrome?.kill();
  vite?.kill();
  await app.close();
}
