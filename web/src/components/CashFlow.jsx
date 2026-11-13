import { useEffect, useState } from 'react'
import { consultarApi } from '../api'
import { fechaArgentina, moneda, periodoActual } from '../formato'
import TarjetasFinancieras from './TarjetasFinancieras'
import TablaMovimientos from './TablaMovimientos'

export default function CashFlow({ sesion, cuentas, onExpired, revision }) {
  const [filtros, setFiltros] = useState(periodoActual)
  const [consulta, setConsulta] = useState(periodoActual)
  const [intento, setIntento] = useState(0)
  const [resultado, setResultado] = useState({ datos: null, cargando: true, error: '' })
  const [errorFechas, setErrorFechas] = useState('')

  useEffect(() => {
    let vigente = true
    const parametros = new URLSearchParams({ desde: consulta.desde, hasta: consulta.hasta })
    if (consulta.cuentaId) parametros.set('cuentaId', consulta.cuentaId)
    consultarApi('/cash-flow?' + parametros, sesion.token)
      .then((datos) => {
        if (vigente) setResultado({ datos, cargando: false, error: '' })
      })
      .catch((fallo) => {
        if (!vigente) return
        if (fallo.status === 401) onExpired()
        else setResultado({ datos: null, cargando: false, error: fallo.message })
      })
    return () => {
      vigente = false
    }
  }, [consulta, intento, sesion.token, onExpired, revision])

  function consultar(evento) {
    evento.preventDefault()
    if (filtros.desde > filtros.hasta) {
      setErrorFechas('La fecha desde debe ser anterior o igual a hasta.')
      return
    }
    setErrorFechas('')
    setResultado({ datos: null, cargando: true, error: '' })
    setConsulta({ ...filtros })
  }
  function reintentar() {
    setResultado({ datos: null, cargando: true, error: '' })
    setIntento(intento + 1)
  }
  const { datos, cargando, error } = resultado

  return (
    <div className="cash-flow">
      <section className="panel filtros-panel">
        <form className="filtros" onSubmit={consultar}>
          <div>
            <label htmlFor="desde">Desde</label>
            <input
              type="date"
              id="desde"
              value={filtros.desde}
              onChange={(evento) => setFiltros({ ...filtros, desde: evento.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor="hasta">Hasta</label>
            <input
              type="date"
              id="hasta"
              value={filtros.hasta}
              onChange={(evento) => setFiltros({ ...filtros, hasta: evento.target.value })}
              min={filtros.desde}
              required
            />
          </div>
          <div className="filtro-cuenta">
            <label htmlFor="filtroCuenta">Cuenta financiera</label>
            <select
              id="filtroCuenta"
              value={filtros.cuentaId}
              onChange={(evento) => setFiltros({ ...filtros, cuentaId: evento.target.value })}
            >
              <option value="">Todas las cuentas</option>
              {cuentas.map((cuenta) => (
                <option key={cuenta.id} value={cuenta.id}>
                  {cuenta.nombre}
                  {!cuenta.activo ? ' (inactiva)' : ''}
                </option>
              ))}
            </select>
          </div>
          <button className="boton primario" disabled={cargando}>
            {cargando ? 'Consultando…' : 'Consultar período'}
          </button>
        </form>
        {errorFechas && (
          <p className="mensaje error" role="alert">
            {errorFechas}
          </p>
        )}
        <p className="nota-filtros">Fechas inclusivas · Hora de Argentina · Importes en ARS</p>
      </section>

      {error && (
        <div className="mensaje error" role="alert">
          <p>{error}</p>
          <button className="boton secundario" onClick={reintentar}>
            Volver a consultar
          </button>
        </div>
      )}
      {cargando && (
        <p className="estado-carga" role="status">
          Consultando movimientos del libro financiero…
        </p>
      )}
      {datos && !cargando && (
        <>
          {datos.advertencia && (
            <p className="aviso" role="status">
              {datos.advertencia}
            </p>
          )}
          <TarjetasFinancieras datos={datos} />

          <section className="panel movimientos">
            <div className="panel-cabecera">
              <div>
                <h2>Movimientos reales</h2>
                <p className="muted">
                  {consulta.desde.split('-').reverse().join('/')} —{' '}
                  {consulta.hasta.split('-').reverse().join('/')} ·{' '}
                  {consulta.cuentaId
                    ? cuentas.find((cuenta) => cuenta.id === consulta.cuentaId)?.nombre
                    : 'Todas las cuentas'}
                </p>
              </div>
              <span className="badge">{datos.movimientos.length} movimientos</span>
            </div>
            <TablaMovimientos
              movimientos={datos.movimientos}
              coberturaCompleta={datos.coberturaCompleta}
            />
            <p className="nota-tabla">
              Incluye solo flujo externo realizado. Las aperturas, transferencias internas y ajustes
              se muestran por separado.
            </p>
          </section>

          <details className="panel saldos">
            <summary>
              <span>Composición del saldo de libro</span>
              <span className="muted">
                Saldo final de libro: <strong>{moneda(datos.saldoFinalLibro)}</strong>
              </span>
            </summary>
            <dl className="puente-saldos">
              <div>
                <dt>Saldo inicial de libro</dt>
                <dd>{moneda(datos.saldoInicial)}</dd>
              </div>
              <div>
                <dt>Flujo externo neto</dt>
                <dd>{moneda(datos.flujoNeto)}</dd>
              </div>
              <div>
                <dt>Transferencias internas netas</dt>
                <dd>{moneda(datos.transferenciasNetas)}</dd>
              </div>
              <div>
                <dt>Saldo final por flujo</dt>
                <dd>{moneda(datos.saldoFinalPorFlujo)}</dd>
              </div>
              <div>
                <dt>Ajustes sin flujo, incluidas aperturas</dt>
                <dd>{moneda(datos.ajustesSinFlujo)}</dd>
              </div>
              <div className="saldo-total">
                <dt>Saldo final de libro</dt>
                <dd>{moneda(datos.saldoFinalLibro)}</dd>
              </div>
            </dl>
            <p className="muted">
              El saldo de libro incluye inversiones y no implica disponibilidad inmediata. Se
              conservan las cuentas inactivas del período.
            </p>
            {(datos.transferencias.length > 0 || datos.ajustes.length > 0) && (
              <ul className="movimientos-separados">
                {[...datos.transferencias, ...datos.ajustes].map((movimiento) => (
                  <li key={movimiento.id}>
                    {fechaArgentina(movimiento.fechaEfectiva)} · {movimiento.cuenta.nombre} ·{' '}
                    {movimiento.detalle} · {movimiento.sentido.toLowerCase()}:{' '}
                    {moneda(movimiento.importe)}
                  </li>
                ))}
              </ul>
            )}
          </details>
          <p className="fecha-informe">
            Consulta realizada el {fechaArgentina(datos.fechaEmision)} · Fuente: libro financiero de
            JM Hielos
          </p>
        </>
      )}
    </div>
  )
}
