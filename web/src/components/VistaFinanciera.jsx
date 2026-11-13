import { useEffect, useState } from 'react'
import { consultarApi } from '../api'
import CashFlow from './CashFlow'
import RegistroManual from './RegistroManual'

export default function VistaFinanciera({ vista, sesion, onExpired, onSaved, revision }) {
  const [catalogos, setCatalogos] = useState(null)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let vigente = true
    Promise.all([
      consultarApi('/cuentas-financieras', sesion.token),
      consultarApi('/cuentas-financieras/inactivas', sesion.token),
      consultarApi('/categorias-flujo', sesion.token),
      consultarApi('/categorias-flujo/inactivas', sesion.token)
    ])
      .then(([cuentas, inactivas, categorias, categoriasInactivas]) => {
        if (vigente)
          setCatalogos({
            cuentas: [...cuentas, ...inactivas],
            categorias: [...categorias, ...categoriasInactivas]
          })
      })
      .catch((fallo) => {
        if (!vigente) return
        if (fallo.status === 401) onExpired()
        else setError(fallo.message)
      })
    return () => {
      vigente = false
    }
  }, [sesion.token, onExpired, intento])

  if (error)
    return (
      <div className="mensaje error" role="alert">
        <p>{error}</p>
        <button
          className="boton secundario"
          onClick={() => {
            setError('')
            setIntento(intento + 1)
          }}
        >
          Reintentar
        </button>
      </div>
    )
  if (!catalogos)
    return (
      <p className="panel estado-carga" role="status">
        Cargando cuentas y categorías…
      </p>
    )
  if (vista === 'cash-flow')
    return (
      <CashFlow
        sesion={sesion}
        cuentas={catalogos.cuentas}
        onExpired={onExpired}
        revision={revision}
      />
    )
  if (sesion.rol !== 'ADMIN')
    return (
      <div className="panel solo-consulta">
        <h2>Acceso de consulta</h2>
        <p>El registro de cobros y pagos manuales está reservado al administrador.</p>
        <a href="#cash-flow" className="boton primario">
          Consultar movimientos en Cash Flow
        </a>
      </div>
    )
  return <RegistroManual sesion={sesion} {...catalogos} onSaved={onSaved} onExpired={onExpired} />
}
