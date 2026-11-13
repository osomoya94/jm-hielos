import { useEffect, useState } from 'react'
import { consultarApi } from '../../api'
import { fechaArgentina, moneda } from '../../formato'
import {
  antiguedadComercial,
  centavosComerciales,
  importeComercial,
  precioCliente,
  tiposLista
} from '../../comercial'
import FormPrecio from './FormPrecio'
import FormVenta from './FormVenta'
import FormCobroVenta from './FormCobroVenta'

function DetalleVenta({ venta }) {
  return (
    <details className="comprobante">
      <summary>Detalle e historial</summary>
      <p>Venta: {venta.id}</p>
      <p>
        Pedido: {fechaArgentina(venta.fechaPedido)} · Entrega: {fechaArgentina(venta.fechaEntrega)}{' '}
        · Carga: {fechaArgentina(venta.fechaRegistro)}
      </p>
      <ul>
        {venta.detalles.map((d) => (
          <li key={d.id}>
            {d.cantidad} × {d.nombreProducto} ({d.pesoKg} kg) a {moneda(d.precioUnitario)} · Costo:{' '}
            {d.costoUnitario === null ? 'pendiente de costeo' : moneda(d.costoUnitario)}
          </li>
        ))}
      </ul>
      <p>
        Envío: {moneda(venta.envio)} · Seguimiento: {venta.responsableCobranza.username}
      </p>
      <ul>
        {venta.participantes.map((p) => (
          <li key={p.id}>
            {p.tarea === 'ENTREGA' ? 'Entrega' : 'Preparación'}: {p.usuario.username} ·{' '}
            {p.responsable ? 'responsable' : 'ayudante'}
          </li>
        ))}
      </ul>
      <p>
        Cobrado: {moneda(venta.cobrado)} · Saldo: {moneda(venta.saldo)}
      </p>
      {venta.cobros.length ? (
        <ul>
          {venta.cobros.flatMap((c) =>
            c.operacionFinanciera.movimientos.map((m) => (
              <li key={m.id}>
                {fechaArgentina(m.fechaEfectiva)} · {m.cuenta.nombre} · {moneda(m.importe)} ·{' '}
                {m.detalle}
              </li>
            ))
          )}
        </ul>
      ) : (
        <p>Sin cobros registrados.</p>
      )}
      {centavosComerciales(venta.creditoPorAnulacion) > 0n && (
        <p className="aviso">
          Crédito del cliente por anulación: {moneda(venta.creditoPorAnulacion)}. No representa un
          reembolso realizado.
        </p>
      )}
    </details>
  )
}

export default function VistaComercial({ vista, sesion, onExpired, onActualizado }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [formulario, setFormulario] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [detalleCliente, setDetalleCliente] = useState(null)
  const [errorCliente, setErrorCliente] = useState('')
  const admin = sesion.rol === 'ADMIN'
  const opera = admin || sesion.rol === 'OPERADOR'
  useEffect(() => {
    let vigente = true
    if (vista === 'precios' && clienteId)
      consultarApi('/precios/clientes/' + clienteId, sesion.token)
        .then((cliente) => {
          if (vigente) setDetalleCliente(cliente)
        })
        .catch((fallo) => {
          if (vigente) {
            if (fallo.status === 401) onExpired()
            else setErrorCliente(fallo.message)
          }
        })
    return () => {
      vigente = false
    }
  }, [vista, clienteId, sesion.token, onExpired, revision])
  useEffect(() => {
    let vigente = true
    async function cargar() {
      const rutas = {
        listas: '/precios',
        clientes: '/clientes',
        productos: '/productos',
        stock: '/inventario/stock',
        usuarios: '/usuarios',
        cuentas: '/cuentas-financieras',
        categorias: '/categorias-flujo',
        ventas: '/ventas'
      }
      const respuestas = await Promise.all(
        Object.entries(rutas).map(async ([clave, ruta]) => [
          clave,
          await consultarApi(ruta, sesion.token)
        ])
      )
      if (vigente) {
        const nuevos = Object.fromEntries(respuestas)
        nuevos.usuarios = nuevos.usuarios.map((u) => ({ ...u, nombre: u.username }))
        setDatos(nuevos)
      }
    }
    cargar().catch((fallo) => {
      if (vigente) {
        if (fallo.status === 401) onExpired()
        else setError(fallo.message)
      }
    })
    return () => {
      vigente = false
    }
  }, [sesion.token, onExpired, revision])
  function actualizar() {
    setDetalleCliente(null)
    setErrorCliente('')
    setDatos(null)
    setError('')
    setRevision((v) => v + 1)
  }
  const abrir = (accion, registro) => {
    setMensaje('')
    setFormulario({ accion, registro })
  }
  function guardado(respuesta) {
    setFormulario(null)
    setMensaje(
      'Registro confirmado.' +
        (respuesta.datos?.saldo !== undefined
          ? ' Saldo pendiente: ' + moneda(respuesta.datos.saldo) + '.'
          : '')
    )
    actualizar()
    onActualizado()
  }
  if (error)
    return (
      <section className="panel">
        <p className="mensaje error" role="alert">
          {error}
        </p>
        <button className="boton secundario" onClick={actualizar}>
          Reintentar carga
        </button>
      </section>
    )
  if (!datos)
    return (
      <p className="panel estado-carga" role="status">
        Consultando gestión comercial…
      </p>
    )
  const props = { sesion, datos, onExpired, onClose: () => setFormulario(null), onSaved: guardado }
  const ventas = datos.ventas.filter(
    (v) =>
      (!clienteId || v.clienteId === clienteId) &&
      (vista !== 'deudas' ||
        centavosComerciales(v.saldo) > 0n ||
        centavosComerciales(v.creditoPorAnulacion) > 0n)
  )
  const deuda = ventas.reduce((suma, v) => suma + centavosComerciales(v.saldo), 0n)
  return (
    <div className="catalogos">
      <div className="catalogo-resumen">
        <p>
          {vista === 'precios'
            ? 'Precios configurables. Las ventas conservan los importes originales.'
            : 'Ventas entregadas, cobros efectivos y saldos pendientes.'}
        </p>
        <div className="catalogo-acciones">
          <button className="boton secundario" onClick={actualizar}>
            Actualizar
          </button>
          {vista !== 'precios' && opera && (
            <button className="boton primario" onClick={() => abrir('venta')}>
              Registrar venta entregada
            </button>
          )}
        </div>
      </div>
      {mensaje && (
        <p className="mensaje exito" role="status">
          {mensaje}
        </p>
      )}
      {vista === 'precios' ? (
        <>
          <section className="panel">
            <div className="catalogo-filtros">
              <div className="campo">
                <label htmlFor="precios-cliente">Consultar precios aplicados a un cliente</label>
                <select
                  id="precios-cliente"
                  value={clienteId}
                  onChange={(e) => {
                    setClienteId(e.target.value)
                    setDetalleCliente(null)
                    setErrorCliente('')
                  }}
                >
                  <option value="">Seleccionar cliente</option>
                  {datos.clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {errorCliente && (
              <p className="mensaje error" role="alert">
                {errorCliente}
              </p>
            )}
            {clienteId && !detalleCliente && !errorCliente && (
              <p className="estado-carga" role="status">
                Consultando condiciones del cliente…
              </p>
            )}
            {detalleCliente && (
              <div className="formulario" id="precios-del-cliente">
                <p>
                  Lista asignada:{' '}
                  <strong>
                    {detalleCliente.condicionComercial?.lista.nombre ?? 'Sin lista asignada'}
                  </strong>
                  {detalleCliente.condicionComercial?.consumidorFinal ? ' · Consumidor final' : ''}
                </p>
                <div
                  className="tabla-scroll"
                  role="region"
                  aria-label="Precios efectivos del cliente"
                  tabIndex="0"
                >
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Producto</th>
                        <th scope="col">Precio aplicado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.productos.map((p) => (
                        <tr key={p.id}>
                          <td>{p.nombre}</td>
                          <td>{moneda(precioCliente(detalleCliente, datos.listas, p.id))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {detalleCliente.preciosParticulares.length > 0 && (
                  <ul>
                    {detalleCliente.preciosParticulares.map((p) => (
                      <li key={p.productoId}>
                        {datos.productos.find((producto) => producto.id === p.productoId)?.nombre ??
                          p.productoId}
                        : {moneda(p.precio)} · Particular{' '}
                        {p.activo ? 'activo' : 'inactivo, no aplica'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
          {admin && (
            <div className="catalogo-acciones">
              {[
                ['lista', 'Nueva lista'],
                ['precio', 'Configurar precio'],
                ['condicion', 'Asignar lista al cliente'],
                ['particular', 'Precio particular'],
                ['inicializar', 'Preparar catálogo inicial']
              ].map(([accion, titulo]) => (
                <button key={accion} className="boton secundario" onClick={() => abrir(accion)}>
                  {titulo}
                </button>
              ))}
            </div>
          )}
          {datos.listas.length ? (
            datos.listas.map((l) => (
              <section className="panel" key={l.id}>
                <div className="panel-cabecera">
                  <h2>{l.nombre}</h2>
                  <span className="badge">{tiposLista[l.tipo]}</span>
                  <span className="badge">{l.activo ? 'Activa' : 'Inactiva'}</span>
                  {admin && (
                    <button className="boton-tabla" onClick={() => abrir('editarLista', l)}>
                      Editar lista
                    </button>
                  )}
                </div>
                <div
                  className="tabla-scroll"
                  role="region"
                  tabIndex="0"
                  aria-label={'Precios de ' + l.nombre}
                >
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Producto</th>
                        <th scope="col">Precio unitario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.productos.map((p) => (
                        <tr key={p.id}>
                          <td>{p.nombre}</td>
                          <td>
                            {moneda(l.precios.find((precio) => precio.productoId === p.id)?.precio)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))
          ) : (
            <p className="panel">
              Todavía no hay listas. El administrador puede crearlas o preparar el catálogo inicial
              sin fijar precios ficticios.
            </p>
          )}
        </>
      ) : (
        <>
          <section className="panel">
            <div className="catalogo-filtros">
              <div className="campo">
                <label htmlFor="comercial-cliente">Cliente</label>
                <select
                  id="comercial-cliente"
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                >
                  <option value="">Todos los clientes</option>
                  {datos.clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <p>
                Deuda de la selección: <strong>{moneda(importeComercial(deuda))}</strong>
              </p>
            </div>
            <p className="ayuda">
              La deuda no es dinero disponible. Los cobros se muestran por su fecha efectiva y no
              vuelven a descontar hielo.
            </p>
            {!ventas.length ? (
              <p className="inventario-vacio">
                {vista === 'deudas'
                  ? 'No hay saldos pendientes ni créditos por anulación en la selección.'
                  : 'No hay ventas registradas en la selección.'}
              </p>
            ) : (
              <div
                className="tabla-scroll"
                role="region"
                tabIndex="0"
                aria-label={vista === 'deudas' ? 'Deudas de clientes' : 'Ventas entregadas'}
              >
                <table className="tabla-ventas">
                  <thead>
                    <tr>
                      {[
                        'Entrega / cliente',
                        'Total',
                        'Cobrado',
                        'Saldo / estado',
                        'Historial y acciones'
                      ].map((c) => (
                        <th scope="col" key={c}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ventas.map((v) => (
                      <tr key={v.id}>
                        <td>
                          {fechaArgentina(v.fechaEntrega)}
                          <strong className="id-registro">{v.cliente.nombre}</strong>
                          <small className="id-registro">
                            Antigüedad: {antiguedadComercial(v.fechaEntrega)} días
                          </small>
                          <small className="id-registro">
                            Seguimiento: {v.responsableCobranza.username}
                          </small>
                        </td>
                        <td className="numero">{moneda(v.total)}</td>
                        <td className="numero">{moneda(v.cobrado)}</td>
                        <td className="numero">
                          {moneda(v.saldo)}
                          <span className="id-registro">
                            {v.estado === 'ANULADA'
                              ? 'Anulada'
                              : v.estadoDeuda === 'SALDADA'
                                ? 'Saldada'
                                : v.estadoDeuda === 'PARCIAL'
                                  ? 'Parcial'
                                  : 'Pendiente'}
                          </span>
                        </td>
                        <td>
                          <DetalleVenta venta={v} />
                          <div className="acciones-fila">
                            {opera &&
                              v.estado === 'CONFIRMADA' &&
                              centavosComerciales(v.saldo) > 0n && (
                                <button className="boton-tabla" onClick={() => abrir('cobrar', v)}>
                                  Cobrar saldo
                                </button>
                              )}
                            {admin && v.estado === 'CONFIRMADA' && (
                              <button
                                className="boton-tabla accion-desactivar"
                                onClick={() => abrir('anular', v)}
                              >
                                Anular con motivo
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      {formulario &&
        (formulario.accion === 'venta' ? (
          <FormVenta {...props} />
        ) : ['cobrar', 'anular'].includes(formulario.accion) ? (
          <FormCobroVenta {...props} accion={formulario.accion} registro={formulario.registro} />
        ) : (
          <FormPrecio {...props} accion={formulario.accion} registro={formulario.registro} />
        ))}
    </div>
  )
}
