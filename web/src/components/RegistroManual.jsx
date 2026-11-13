import { useRef, useState } from 'react'
import { consultarApi } from '../api'
import { ahoraArgentina, moneda } from '../formato'
import { crearClaveIdempotencia } from '../idempotencia'
import Icono from './Icono'

export default function RegistroManual({ sesion, cuentas, categorias, onSaved, onExpired }) {
  const [tipo, setTipo] = useState('COBRO')
  const [valores, setValores] = useState({
    cuentaId: '',
    categoriaId: '',
    importe: '',
    fechaEfectiva: ahoraArgentina(),
    detalle: ''
  })
  const [error, setError] = useState('')
  const [exito, setExito] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const pedido = useRef(null)
  const enviando = useRef(false)
  const sentido = tipo === 'COBRO' ? 'INGRESO' : 'EGRESO'
  const cuentasActivas = cuentas.filter((cuenta) => cuenta.activo)
  const categoriasActivas = categorias.filter(
    (categoria) => categoria.activo && categoria.sentido === sentido
  )
  const faltanDatos = !cuentasActivas.length || !categoriasActivas.length
  const cuentaElegida = cuentasActivas.find((cuenta) => cuenta.id === valores.cuentaId)
  const categoriaElegida = categoriasActivas.find(
    (categoria) => categoria.id === valores.categoriaId
  )

  function cambiar(evento) {
    setValores({ ...valores, [evento.target.name]: evento.target.value })
    setExito(null)
  }

  function cambiarTipo(nuevoTipo) {
    setTipo(nuevoTipo)
    setValores({ ...valores, categoriaId: '' })
    setExito(null)
    setError('')
  }

  async function guardar(evento) {
    evento.preventDefault()
    if (enviando.current) return
    setError('')
    setExito(null)
    const importe = valores.importe.trim().replace(',', '.')
    if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(importe) || !/[1-9]/.test(importe)) {
      setError('Ingresá un importe mayor a cero, con hasta 16 enteros y dos decimales.')
      return
    }
    const fecha =
      valores.fechaEfectiva + (valores.fechaEfectiva.length === 16 ? ':00' : '') + '-03:00'
    if (!Number.isFinite(new Date(fecha).getTime()) || new Date(fecha) > new Date()) {
      setError('Ingresá una fecha efectiva válida, que no sea futura.')
      return
    }
    if (!valores.detalle.trim()) {
      setError('Completá el detalle del movimiento.')
      return
    }
    const datos = { ...valores, importe, detalle: valores.detalle.trim(), fechaEfectiva: fecha }
    const contenido = JSON.stringify({ tipo, ...datos })
    enviando.current = true
    setGuardando(true)
    try {
      // Un reintento conserva exactamente la misma clave y los mismos datos.
      if (pedido.current?.contenido !== contenido)
        pedido.current = { contenido, clave: crearClaveIdempotencia() }
      const ruta = tipo === 'COBRO' ? 'cobros-manuales' : 'pagos-manuales'
      const resultado = await consultarApi('/operaciones-financieras/' + ruta, sesion.token, {
        method: 'POST',
        data: { ...datos, claveIdempotencia: pedido.current.clave }
      })
      setExito({ tipo, importe: resultado.movimiento.importe, id: resultado.operacion.id })
      setValores({
        cuentaId: '',
        categoriaId: '',
        importe: '',
        fechaEfectiva: ahoraArgentina(),
        detalle: ''
      })
      pedido.current = null
      onSaved()
    } catch (fallo) {
      if (fallo.status === 401) onExpired()
      else
        setError(
          fallo.message +
            (!fallo.status
              ? ' Reintentá sin cambiar los datos para conservar la protección contra duplicados.'
              : '')
        )
    } finally {
      enviando.current = false
      setGuardando(false)
    }
  }

  return (
    <div className="registro-layout">
      <section className="panel">
        <div className="panel-cabecera">
          <div>
            <h2>Registrar cobro o pago</h2>
            <p className="muted">Completá los datos del dinero efectivamente recibido o pagado.</p>
          </div>
        </div>
        <form onSubmit={guardar} className="formulario">
          <fieldset className="selector-tipo" disabled={guardando}>
            <legend>Tipo de movimiento</legend>
            <label className={tipo === 'COBRO' ? 'seleccionado' : ''}>
              <input
                type="radio"
                name="tipo"
                value="COBRO"
                checked={tipo === 'COBRO'}
                onChange={() => cambiarTipo('COBRO')}
              />
              <Icono nombre="ingreso" />
              <span>
                Cobro<small>Entrada de dinero</small>
              </span>
            </label>
            <label className={tipo === 'PAGO' ? 'seleccionado' : ''}>
              <input
                type="radio"
                name="tipo"
                value="PAGO"
                checked={tipo === 'PAGO'}
                onChange={() => cambiarTipo('PAGO')}
              />
              <Icono nombre="egreso" />
              <span>
                Pago<small>Salida de dinero</small>
              </span>
            </label>
          </fieldset>
          {error && (
            <p className="mensaje error" role="alert">
              {error}
            </p>
          )}
          {exito && (
            <div className="mensaje exito confirmacion-movimiento" role="status">
              <Icono nombre="check" />
              <div>
                <strong>
                  {exito.tipo === 'COBRO' ? 'Cobro registrado' : 'Pago registrado'} ·{' '}
                  {moneda(exito.importe)}
                </strong>
                <small>Comprobante: {exito.id}</small>
                <a href="#cash-flow" className="enlace">
                  Consultar en Cash Flow
                </a>
              </div>
            </div>
          )}
          {faltanDatos && (
            <div className="aviso">
              <p>
                Se necesita una cuenta activa y una categoría de {sentido.toLowerCase()} para
                continuar.
              </p>
              <div className="enlaces-configuracion">
                <a href="#cuentas">Administrar cuentas</a>
                <a href="#categorias">Administrar categorías</a>
              </div>
            </div>
          )}
          <fieldset disabled={guardando || faltanDatos} className="campos">
            <div className="form-grid">
              <div>
                <label htmlFor="cuentaId">Cuenta financiera</label>
                <select
                  id="cuentaId"
                  name="cuentaId"
                  value={valores.cuentaId}
                  onChange={cambiar}
                  required
                >
                  <option value="">Seleccionar cuenta</option>
                  {cuentasActivas.map((cuenta) => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="categoriaId">Categoría de {sentido.toLowerCase()}</label>
                <select
                  id="categoriaId"
                  name="categoriaId"
                  value={valores.categoriaId}
                  onChange={cambiar}
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  {categoriasActivas.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="importe">Importe en ARS</label>
                <div className="importe-input">
                  <span aria-hidden="true">$</span>
                  <input
                    id="importe"
                    name="importe"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={valores.importe}
                    onChange={cambiar}
                    maxLength={19}
                    required
                    aria-describedby="importe-ayuda"
                  />
                </div>
                <small id="importe-ayuda" className="muted">
                  Mayor a cero. Hasta dos decimales.
                </small>
              </div>
              <div>
                <label htmlFor="fechaEfectiva">Fecha y hora efectiva</label>
                <input
                  id="fechaEfectiva"
                  name="fechaEfectiva"
                  type="datetime-local"
                  value={valores.fechaEfectiva}
                  onChange={cambiar}
                  max={ahoraArgentina()}
                  required
                  aria-describedby="fecha-ayuda"
                />
                <small id="fecha-ayuda" className="muted">
                  Hora de Argentina (UTC−03:00).
                </small>
              </div>
            </div>
            <label htmlFor="detalle">Detalle</label>
            <textarea
              id="detalle"
              name="detalle"
              rows="3"
              maxLength={250}
              value={valores.detalle}
              onChange={cambiar}
              placeholder="Concepto del cobro o pago"
              required
            />
          </fieldset>
          <div className="form-footer">
            <span className="muted">Revisá los datos antes de confirmar.</span>
            <button className="boton primario" disabled={guardando || faltanDatos}>
              {guardando ? 'Guardando…' : tipo === 'COBRO' ? 'Registrar cobro' : 'Registrar pago'}
            </button>
          </div>
        </form>
      </section>
      <aside className="panel resumen-operacion">
        <h2>Resumen</h2>
        <span className={'badge ' + (tipo === 'COBRO' ? 'positivo' : 'negativo')}>
          {tipo === 'COBRO' ? 'Cobro · ingreso' : 'Pago · egreso'}
        </span>
        <strong className="resumen-importe">
          {moneda(valores.importe.replace(',', '.') || null)}
        </strong>
        <dl>
          <dt>Cuenta</dt>
          <dd>{cuentaElegida?.nombre || 'Sin seleccionar'}</dd>
          <dt>Categoría</dt>
          <dd>{categoriaElegida?.nombre || 'Sin seleccionar'}</dd>
          <dt>Registrado por</dt>
          <dd>{sesion.username}</dd>
        </dl>
        <p className="muted">
          Las obligaciones pendientes y las transferencias entre cuentas propias no se registran
          como cobros o pagos manuales.
        </p>
      </aside>
    </div>
  )
}
