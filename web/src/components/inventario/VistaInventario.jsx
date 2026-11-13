import { useEffect, useState } from 'react'
import { consultarApi } from '../../api'
import { fechaArgentina, moneda } from '../../formato'
import { costoInsumo, existenciaDe, numeroStock, saldoCompra } from '../../inventario'
import Icono from '../Icono'
import FormInsumo from './FormInsumo'
import FormCompra from './FormCompra'
import FormProduccion from './FormProduccion'
import FormStock from './FormStock'

function Tabla({ titulo, columnas, children, vacio, cantidad }) {
  return cantidad ? (
    <div className="tabla-scroll" role="region" aria-label={titulo} tabIndex="0">
      <table>
        <thead>
          <tr>
            {columnas.map((c) => (
              <th scope="col" key={c}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  ) : (
    <p className="inventario-vacio">{vacio}</p>
  )
}

export default function VistaInventario({ vista, sesion, onExpired, onActualizado }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [formulario, setFormulario] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [historial, setHistorial] = useState([])
  const [cursor, setCursor] = useState(null)
  const [cargandoMas, setCargandoMas] = useState(false)
  const admin = sesion.rol === 'ADMIN'
  useEffect(() => {
    let vigente = true
    const rutas = {
      insumos: '/inventario/insumos',
      productos: '/productos',
      stock: '/inventario/stock',
      usuarios: '/usuarios',
      movimientos: '/inventario/movimientos',
      ...(vista === 'produccion' ? { lotes: '/inventario/produccion' } : {}),
      ...(vista === 'insumos'
        ? {
            compras: '/inventario/compras',
            ...(admin
              ? {
                  proveedores: '/proveedores',
                  cuentas: '/cuentas-financieras',
                  categorias: '/categorias-flujo'
                }
              : {})
          }
        : {})
    }
    Promise.all(
      Object.entries(rutas).map(async ([clave, ruta]) => [
        clave,
        await consultarApi(ruta, sesion.token)
      ])
    )
      .then((respuestas) => {
        if (!vigente) return
        const nuevos = Object.fromEntries(respuestas)
        nuevos.usuarios = nuevos.usuarios.map((u) => ({ ...u, nombre: u.username }))
        setHistorial(nuevos.movimientos.datos)
        setCursor(nuevos.movimientos.siguienteCursor)
        setDatos(nuevos)
      })
      .catch((fallo) => {
        if (vigente) {
          if (fallo.status === 401) onExpired()
          else setError(fallo.message)
        }
      })
    return () => {
      vigente = false
    }
  }, [vista, sesion.token, admin, revision, onExpired])
  function actualizar() {
    setDatos(null)
    setError('')
    setRevision((v) => v + 1)
  }
  function guardado(resultado) {
    setFormulario(null)
    const sobrantes = resultado.datos?.bolsasSobrantes
    setMensaje(
      'Registro confirmado.' +
        (sobrantes !== undefined
          ? ' Quedan ' + numeroStock(sobrantes) + ' bolsas vacías en producción.'
          : '') +
        (resultado.operacionId ? ' Operación: ' + resultado.operacionId : '')
    )
    actualizar()
    onActualizado()
  }
  async function masMovimientos() {
    setCargandoMas(true)
    try {
      const pagina = await consultarApi('/inventario/movimientos?cursor=' + cursor, sesion.token)
      setHistorial((lista) => [...lista, ...pagina.datos])
      setCursor(pagina.siguienteCursor)
    } catch (fallo) {
      if (fallo.status === 401) onExpired()
      else setError(fallo.message)
    } finally {
      setCargandoMas(false)
    }
  }
  const abrir = (accion, registro) => setFormulario({ accion, registro })
  if (!datos)
    return (
      <section className="panel estado-carga">
        {error ? (
          <>
            <p className="mensaje error" role="alert">
              {error}
            </p>
            <button className="boton secundario" onClick={actualizar}>
              Reintentar carga
            </button>
          </>
        ) : (
          <p role="status">Cargando inventario…</p>
        )}
      </section>
    )
  const alertas = datos.insumos.filter((i) => i.alerta)
  const bolsaTotal = datos.stock.reduce((s, p) => s + p.cantidad, 0)
  const kilos = datos.stock.reduce((s, p) => s + p.cantidad * p.pesoKg, 0)
  const formProps = {
    datos,
    sesion,
    onExpired,
    onClose: () => setFormulario(null),
    onSaved: guardado
  }
  return (
    <div className="inventario">
      <div className="inventario-barra">
        <p className="muted">
          {admin
            ? 'Gestioná el inventario y consultá su trazabilidad.'
            : sesion.rol === 'OPERADOR'
              ? 'Consulta general y registro de obsequios o consumo interno.'
              : 'Consulta de existencias y movimientos.'}
        </p>
        <button className="boton secundario" onClick={actualizar}>
          <Icono nombre="actualizar" />
          Actualizar
        </button>
      </div>
      {mensaje && (
        <p className="mensaje exito" role="status">
          {mensaje}
        </p>
      )}
      {error && (
        <p className="mensaje error" role="alert">
          {error}
        </p>
      )}
      <div className="inventario-indicadores">
        <div className="inventario-indicador">
          <span>Bolsas terminadas</span>
          <strong>{numeroStock(bolsaTotal)}</strong>
          <small>{numeroStock(kilos)} kg disponibles</small>
        </div>
        <div className="inventario-indicador">
          <span>Insumos activos</span>
          <strong>{datos.insumos.filter((i) => i.activo).length}</strong>
          <small>Depósito y producción separados</small>
        </div>
        <a
          className="inventario-indicador"
          href="#alertas-inventario"
          onClick={(e) => {
            e.preventDefault()
            document.getElementById('alertas-inventario')?.scrollIntoView({ block: 'center' })
          }}
        >
          <span>Alertas de depósito</span>
          <strong>{alertas.length}</strong>
          <small>Existencias en el mínimo o por debajo</small>
        </a>
      </div>
      <section
        className="panel inventario-alertas"
        id="alertas-inventario"
        aria-labelledby="titulo-alertas"
      >
        <div className="panel-cabecera">
          <div>
            <h2 id="titulo-alertas">Bolsas vacías e insumos en depósito</h2>
            <p className="muted">
              Las unidades trasladadas a producción quedan fuera de esta alerta.
            </p>
          </div>
          <span className={'badge ' + (alertas.length ? 'negativo' : 'positivo')}>
            {alertas.length ? alertas.length + ' por revisar' : 'Sin alertas'}
          </span>
        </div>
        {alertas.length ? (
          <ul className="inventario-lista-alertas">
            {alertas.map((i) => (
              <li key={i.id}>
                <strong>{i.nombre}</strong>
                <span>
                  {numeroStock(i.deposito)} {i.unidad} en depósito · mínimo{' '}
                  {numeroStock(i.stockMinimo)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="inventario-vacio">
            Los insumos activos están por encima de sus mínimos configurados.
          </p>
        )}
      </section>
      {vista === 'insumos' && (
        <>
          <section className="panel">
            <div className="panel-cabecera">
              <div>
                <h2>Existencias de insumos</h2>
                <p className="muted">Paquetes cerrados, unidades abiertas y costo promedio.</p>
              </div>
              {admin && (
                <button className="boton primario" onClick={() => abrir('crear')}>
                  <Icono nombre="nuevo" />
                  Nuevo insumo
                </button>
              )}
            </div>
            {admin && (
              <div className="inventario-acciones">
                <button className="boton secundario" onClick={() => abrir('compra')}>
                  Registrar compra
                </button>
                <button className="boton secundario" onClick={() => abrir('traslado')}>
                  Trasladar a producción
                </button>
                <button className="boton secundario" onClick={() => abrir('movimiento')}>
                  Consumo / ajuste / conteo
                </button>
              </div>
            )}
            <Tabla
              titulo="Existencias de insumos"
              columnas={[
                'Insumo',
                'Depósito',
                'Producción',
                'Costo promedio',
                'Estado',
                ...(admin ? ['Acciones'] : [])
              ]}
              cantidad={datos.insumos.length}
              vacio="Todavía no hay insumos registrados."
            >
              {datos.insumos.map((i) => (
                <tr key={i.id}>
                  <th scope="row">
                    {i.nombre}
                    <small className="inventario-secundario">
                      {i.tipo === 'BOLSA' ? i.producto?.nombre : 'Otro insumo'} · {i.unidad}
                    </small>
                  </th>
                  <td>
                    <strong>{numeroStock(i.deposito)} unidades</strong>
                    {i.presentaciones.map((p) => (
                      <small className="inventario-secundario" key={p.id}>
                        {numeroStock(Number(existenciaDe(p, 'DEPOSITO')) / Number(p.factor))} ×{' '}
                        {p.nombre} de {numeroStock(p.factor)}
                      </small>
                    ))}
                  </td>
                  <td>{numeroStock(i.produccion)} unidades abiertas</td>
                  <td className="numero">
                    {i.costoPromedio === null ? 'Sin existencias' : costoInsumo(i.costoPromedio)}
                  </td>
                  <td>
                    <span
                      className={
                        'badge ' + (!i.activo ? 'neutral' : i.alerta ? 'negativo' : 'positivo')
                      }
                    >
                      {!i.activo ? 'Inactivo' : i.alerta ? 'Revisar mínimo' : 'Disponible'}
                    </span>
                  </td>
                  {admin && (
                    <td>
                      <div className="acciones-fila">
                        <button className="boton secundario" onClick={() => abrir('editar', i)}>
                          Configurar
                        </button>
                        <button
                          className="boton secundario"
                          onClick={() => abrir('presentacion', i)}
                          disabled={!i.activo}
                        >
                          Presentación
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </Tabla>
          </section>
          <section className="panel">
            <div className="panel-cabecera">
              <div>
                <h2>Compras y pagos a proveedores</h2>
                <p className="muted">
                  El inventario se recibe una vez. Los pagos posteriores solo afectan dinero y
                  saldo.
                </p>
              </div>
            </div>
            <Tabla
              titulo="Compras y pagos a proveedores"
              columnas={[
                'Fecha',
                'Comprobante',
                'Proveedor',
                'Total',
                'Pagado',
                'Saldo pendiente',
                ...(admin ? ['Acción'] : [])
              ]}
              cantidad={datos.compras.length}
              vacio="No hay compras registradas."
            >
              {datos.compras.map((c) => (
                <tr key={c.id}>
                  <td>{fechaArgentina(c.operacion.fechaEfectiva)}</td>
                  <td>
                    {c.comprobante}
                    <small className="inventario-secundario">
                      {c.vencimiento ? 'Vence ' + fechaArgentina(c.vencimiento) : 'Sin vencimiento'}
                    </small>
                  </td>
                  <td>{c.proveedor.nombre}</td>
                  <td className="numero">{moneda(c.total)}</td>
                  <td className="numero">
                    {moneda(c.pagado)}
                    <small className="inventario-secundario">
                      {saldoCompra(c) !== '0.00' ? 'Saldo pendiente al proveedor' : 'Pagada'}
                    </small>
                  </td>
                  <td className="numero">{moneda(saldoCompra(c))}</td>
                  {admin && (
                    <td>
                      <button
                        className="boton secundario"
                        disabled={saldoCompra(c) === '0.00'}
                        onClick={() => abrir('pago', c)}
                      >
                        Registrar pago
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </Tabla>
          </section>
        </>
      )}
      {vista === 'produccion' && (
        <section className="panel">
          <div className="panel-cabecera">
            <div>
              <h2>Lotes de producción</h2>
              <p className="muted">Resultado real, consumo y responsables de cada lote.</p>
            </div>
            {admin && (
              <button className="boton primario" onClick={() => abrir('lote')}>
                <Icono nombre="nuevo" />
                Registrar lote
              </button>
            )}
          </div>
          <Tabla
            titulo="Lotes de producción"
            columnas={[
              'Lote / fecha',
              'Producto',
              'Aptas',
              'Bolsas usadas / rotas',
              'Hielo descartado',
              'Responsable'
            ]}
            cantidad={datos.lotes.length}
            vacio="Todavía no hay lotes registrados."
          >
            {datos.lotes.map((l) => (
              <tr key={l.id}>
                <th scope="row">
                  {l.codigo}
                  <small className="inventario-secundario">
                    {fechaArgentina(l.operacion.fechaEfectiva)}
                  </small>
                </th>
                <td>{l.producto.nombre}</td>
                <td className="numero">
                  <strong>{numeroStock(l.cantidadApta)}</strong>
                  {l.cantidadEsperada !== null && (
                    <small className="inventario-secundario">
                      Esperadas: {numeroStock(l.cantidadEsperada)}
                    </small>
                  )}
                </td>
                <td>
                  {numeroStock(l.bolsasUsadas)} / {numeroStock(l.bolsasRotas)}
                </td>
                <td>{numeroStock(l.hieloDescartadoKg)} kg</td>
                <td>
                  {l.responsable.username}
                  {l.participantes.map((p) => (
                    <small className="inventario-secundario" key={p.id}>
                      Ayudante: {p.usuario.username}
                    </small>
                  ))}
                </td>
              </tr>
            ))}
          </Tabla>
          <p className="inventario-nota">
            Los sobrantes de bolsas vacías permanecen disponibles para futuros lotes.
          </p>
        </section>
      )}
      {vista === 'stock' && (
        <section className="panel">
          <div className="panel-cabecera">
            <div>
              <h2>Hielo terminado disponible</h2>
              <p className="muted">Existencias reales por presentación de producto.</p>
            </div>
            {sesion.rol !== 'LECTOR' && (
              <button className="boton primario" onClick={() => abrir('stock')}>
                <Icono nombre="nuevo" />
                Registrar movimiento
              </button>
            )}
          </div>
          <Tabla
            titulo="Hielo terminado disponible"
            columnas={['Producto', 'Bolsas aptas', 'Peso disponible', 'Estado']}
            cantidad={datos.stock.length}
            vacio="Primero registrá los productos del catálogo."
          >
            {datos.stock.map((p) => (
              <tr key={p.id}>
                <th scope="row">
                  {p.nombre}
                  <small className="inventario-secundario">{p.pesoKg} kg por bolsa</small>
                </th>
                <td className="numero">
                  <strong>{numeroStock(p.cantidad)}</strong>
                </td>
                <td className="numero">{numeroStock(p.cantidad * p.pesoKg)} kg</td>
                <td>
                  <span
                    className={
                      'badge ' + (!p.activo ? 'neutral' : p.cantidad ? 'positivo' : 'neutral')
                    }
                  >
                    {!p.activo
                      ? 'Producto inactivo'
                      : p.cantidad
                        ? 'Disponible'
                        : 'Sin existencias'}
                  </span>
                </td>
              </tr>
            ))}
          </Tabla>
        </section>
      )}
      <section className="panel">
        <div className="panel-cabecera">
          <div>
            <h2>Movimientos de inventario</h2>
            <p className="muted">
              Fechas operativa y de registro, usuario, motivo, origen y diferencias.
            </p>
          </div>
        </div>
        <Tabla
          titulo="Historial de movimientos de inventario"
          columnas={['Fecha operativa', 'Operación', 'Detalle y motivo', 'Usuario']}
          cantidad={historial.length}
          vacio="Todavía no hay movimientos de inventario."
        >
          {historial.map((m) => (
            <tr key={m.id}>
              <td>
                {fechaArgentina(m.fechaEfectiva)}
                <small className="inventario-secundario">
                  Registrado: {fechaArgentina(m.fechaRegistro)}
                </small>
              </td>
              <td>
                {m.tipo.replaceAll('_', ' ')}
                <small className="inventario-secundario inventario-id">{m.id}</small>
              </td>
              <td>
                {m.movimientosStock.map((s) => (
                  <div key={s.id}>
                    {s.producto.nombre}: {s.cantidad > 0 ? '+' : ''}
                    {numeroStock(s.cantidad)} bolsas · {s.saldoAnterior} → {s.saldoPosterior}
                  </div>
                ))}
                {m.movimientosInsumos.map((s) => (
                  <div key={s.id}>
                    {s.presentacion.insumo.nombre} · {s.ubicacion.toLowerCase()}:{' '}
                    {Number(s.unidades) > 0 ? '+' : ''}
                    {numeroStock(s.unidades)} · saldo {numeroStock(s.saldoPosterior)}
                  </div>
                ))}
                <small className="inventario-secundario">{m.motivo}</small>
                <small className="inventario-secundario inventario-id">
                  Origen: {m.origenTipo} / {m.origenId}
                  {m.corrigeOperacionId ? ' · Corrige: ' + m.corrigeOperacionId : ''}
                </small>
              </td>
              <td>{m.usuario.username}</td>
            </tr>
          ))}
        </Tabla>
        {cursor && (
          <div className="inventario-acciones">
            <button className="boton secundario" disabled={cargandoMas} onClick={masMovimientos}>
              {cargandoMas ? 'Cargando…' : 'Ver movimientos anteriores'}
            </button>
          </div>
        )}
      </section>
      {formulario &&
        (formulario.accion === 'compra' || formulario.accion === 'pago' ? (
          <FormCompra {...formProps} registro={formulario.registro} />
        ) : formulario.accion === 'lote' ? (
          <FormProduccion {...formProps} />
        ) : formulario.accion === 'stock' ? (
          <FormStock {...formProps} />
        ) : (
          <FormInsumo {...formProps} accion={formulario.accion} registro={formulario.registro} />
        ))}
    </div>
  )
}
