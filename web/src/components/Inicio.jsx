import { useEffect, useState } from 'react'
import { consultarApi } from '../api'
import { fechaArgentina, periodoActual } from '../formato'
import TarjetasFinancieras from './TarjetasFinancieras'
import TablaMovimientos from './TablaMovimientos'
import Icono from './Icono'
import ControlesPendientes from './ControlesPendientes'
import AccesosRapidos from './AccesosRapidos'

export default function Inicio({ sesion, onExpired, revision }) {
  const [periodo] = useState(periodoActual)
  const [resultado, setResultado] = useState({ datos: null, error: '', cargando: true })
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let vigente = true
    const consulta = new URLSearchParams({ desde: periodo.desde, hasta: periodo.hasta })
    consultarApi('/cash-flow?' + consulta, sesion.token)
      .then((datos) => {
        if (vigente) setResultado({ datos, error: '', cargando: false })
      })
      .catch((fallo) => {
        if (!vigente) return
        if (fallo.status === 401) onExpired()
        else setResultado({ datos: null, error: fallo.message, cargando: false })
      })
    return () => {
      vigente = false
    }
  }, [periodo, intento, sesion.token, onExpired, revision])

  return (
    <div className="inicio">
      <div className="resumen-encabezado">
        <div>
          <h2>Actividad del mes</h2>
          <p className="muted">
            {periodo.desde.split('-').reverse().join('/')} —{' '}
            {periodo.hasta.split('-').reverse().join('/')} · Todas las cuentas · ARS
          </p>
        </div>
        <button
          className="boton secundario"
          disabled={resultado.cargando}
          onClick={() => {
            setResultado({ datos: null, error: '', cargando: true })
            setIntento(intento + 1)
          }}
        >
          <Icono nombre="actualizar" />
          Actualizar
        </button>
      </div>
      {resultado.cargando && (
        <div className="panel estado-carga" role="status">
          Cargando resumen financiero…
        </div>
      )}
      {resultado.error && (
        <p className="mensaje error" role="alert">
          {resultado.error}
        </p>
      )}
      {resultado.datos && (
        <>
          {resultado.datos.advertencia && (
            <p className="aviso" role="status">
              {resultado.datos.advertencia}
            </p>
          )}
          <TarjetasFinancieras datos={resultado.datos} />
          <div className="inicio-cuerpo">
            <div className="inicio-principal">
              <section className="panel movimientos">
                <div className="panel-cabecera">
                  <div>
                    <h2>Movimientos recientes</h2>
                    <p className="muted">Últimos registros de flujo externo del período</p>
                  </div>
                  <a className="enlace" href="#cash-flow">
                    Ver Cash Flow <Icono nombre="flecha" width="16" height="16" />
                  </a>
                </div>
                <TablaMovimientos
                  movimientos={resultado.datos.movimientos.slice(0, 6)}
                  coberturaCompleta={resultado.datos.coberturaCompleta}
                  compacto
                />
                <p className="nota-tabla">
                  El flujo de caja informa dinero recibido y pagado. No representa ganancias.
                </p>
              </section>
              <p className="fecha-informe">
                Actualizado el {fechaArgentina(resultado.datos.fechaEmision)} · Hora de Argentina
              </p>
              <AccesosRapidos esAdmin={sesion.rol === 'ADMIN'} puedeOperar={sesion.rol !== 'LECTOR'} />
            </div>
            <ControlesPendientes />
          </div>
        </>
      )}
      {!resultado.datos && <AccesosRapidos esAdmin={sesion.rol === 'ADMIN'} puedeOperar={sesion.rol !== 'LECTOR'} />}
    </div>
  )
}
