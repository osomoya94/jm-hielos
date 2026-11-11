import { useRef, useState } from 'react'
import { consultarApi } from '../api'
import { ahoraArgentina, moneda } from '../formato'

export default function RegistroManual({ sesion, cuentas, categorias, onSaved, onExpired }) {
  const [tipo, setTipo] = useState('COBRO')
  const [valores, setValores] = useState({ cuentaId: '', categoriaId: '', importe: '', fechaEfectiva: ahoraArgentina(), detalle: '' })
  const [error, setError] = useState('')
  const [exito, setExito] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const pedido = useRef(null)
  const enviando = useRef(false)
  const sentido = tipo === 'COBRO' ? 'INGRESO' : 'EGRESO'
  const cuentasActivas = cuentas.filter((cuenta) => cuenta.activo)
  const categoriasActivas = categorias.filter((categoria) => categoria.activo && categoria.sentido === sentido)
  const faltanDatos = !cuentasActivas.length || !categoriasActivas.length

  function cambiar(evento) {
    setValores({ ...valores, [evento.target.name]: evento.target.value })
    setExito(null)
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
    const fecha = valores.fechaEfectiva + (valores.fechaEfectiva.length === 16 ? ':00' : '') + '-03:00'
    if (new Date(fecha) > new Date()) {
      setError('La fecha efectiva no puede ser futura.')
      return
    }
    const datos = { ...valores, importe, detalle: valores.detalle.trim(), fechaEfectiva: fecha }
    const contenido = JSON.stringify({ tipo, ...datos })
    // Un reintento conserva exactamente la misma clave y datos, incluso ante timeout.
    if (pedido.current?.contenido !== contenido) pedido.current = { contenido, clave: crypto.randomUUID() }
    enviando.current = true
    setGuardando(true)
    try {
      const ruta = tipo === 'COBRO' ? 'cobros-manuales' : 'pagos-manuales'
      const resultado = await consultarApi('/operaciones-financieras/' + ruta, sesion.token, {
        method: 'POST', data: { ...datos, claveIdempotencia: pedido.current.clave },
      })
      setExito({ tipo, importe: resultado.movimiento.importe, id: resultado.operacion.id })
      setValores({ cuentaId: '', categoriaId: '', importe: '', fechaEfectiva: ahoraArgentina(), detalle: '' })
      pedido.current = null
      onSaved()
    } catch (fallo) {
      if (fallo.status === 401) onExpired()
      else setError(fallo.message + (!fallo.status ? ' Podés reintentar sin cambiar los datos: se conserva la clave para evitar duplicados.' : ''))
    } finally {
      enviando.current = false
      setGuardando(false)
    }
  }

  return <div className="registro-layout">
    <section className="panel">
      <div className="panel-cabecera"><div><h2>Registrar movimiento</h2><p className="muted">Dinero efectivamente cobrado o pagado.</p></div><span className="badge">Solo ADMIN</span></div>
      <form onSubmit={guardar} className="formulario">
        <fieldset className="selector-tipo" disabled={guardando}>
          <legend>Tipo de operación</legend>
          <label className={tipo === 'COBRO' ? 'seleccionado' : ''}><input type="radio" name="tipo" value="COBRO" checked={tipo === 'COBRO'} onChange={() => { setTipo('COBRO'); setValores({ ...valores, categoriaId: '' }); setExito(null) }} />Cobro · ingreso</label>
          <label className={tipo === 'PAGO' ? 'seleccionado' : ''}><input type="radio" name="tipo" value="PAGO" checked={tipo === 'PAGO'} onChange={() => { setTipo('PAGO'); setValores({ ...valores, categoriaId: '' }); setExito(null) }} />Pago · egreso</label>
        </fieldset>
        {error && <p className="mensaje error" role="alert">{error}</p>}
        {exito && <div className="mensaje exito" role="status"><strong>{exito.tipo === 'COBRO' ? 'Cobro registrado' : 'Pago registrado'}: {moneda(exito.importe)}</strong><br /><small>Comprobante: {exito.id}</small></div>}
        {faltanDatos && <p className="aviso">Se necesita al menos una cuenta activa y una categoría de {sentido.toLowerCase()}. Configurá los datos reales del negocio antes de continuar.</p>}
        <fieldset disabled={guardando || faltanDatos} className="campos">
          <div className="form-grid">
            <div><label htmlFor="cuentaId">Cuenta financiera</label><select id="cuentaId" name="cuentaId" value={valores.cuentaId} onChange={cambiar} required><option value="">Seleccionar cuenta</option>{cuentasActivas.map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>)}</select></div>
            <div><label htmlFor="categoriaId">Categoría de {sentido.toLowerCase()}</label><select id="categoriaId" name="categoriaId" value={valores.categoriaId} onChange={cambiar} required><option value="">Seleccionar categoría</option>{categoriasActivas.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}</select></div>
            <div><label htmlFor="importe">Importe en ARS</label><input id="importe" name="importe" inputMode="decimal" placeholder="0,00" value={valores.importe} onChange={cambiar} maxLength={19} required aria-describedby="importe-ayuda" /><small id="importe-ayuda" className="muted">Mayor a cero, hasta dos decimales.</small></div>
            <div><label htmlFor="fechaEfectiva">Fecha y hora efectiva</label><input id="fechaEfectiva" name="fechaEfectiva" type="datetime-local" value={valores.fechaEfectiva} onChange={cambiar} max={ahoraArgentina()} required aria-describedby="fecha-ayuda" /><small id="fecha-ayuda" className="muted">Hora de Argentina (UTC−03:00).</small></div>
          </div>
          <label htmlFor="detalle">Detalle</label><textarea id="detalle" name="detalle" rows="3" maxLength={250} value={valores.detalle} onChange={cambiar} placeholder="¿A qué corresponde este movimiento?" required />
        </fieldset>
        <div className="form-footer"><span className="muted">Se registra en el libro financiero.</span><button className="boton primario" disabled={guardando || faltanDatos}>{guardando ? 'Guardando…' : tipo === 'COBRO' ? 'Registrar cobro' : 'Registrar pago'}</button></div>
      </form>
    </section>
    <aside className="panel ayuda">
      <span className="eyebrow">ANTES DE CONFIRMAR</span><h2>Un registro claro</h2>
      <p>Elegí la cuenta por la que pasó el dinero y la categoría que explica el movimiento.</p>
      <p>Usá la fecha en que se cobró o pagó. Las obligaciones pendientes se mantienen fuera del flujo de caja.</p>
      <div className="separador" /><p className="muted">Cada operación conserva su usuario, fecha de carga y comprobante.</p>
    </aside>
  </div>
}
