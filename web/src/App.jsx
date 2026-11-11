import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { consultarApi } from './api'
import Login from './components/Login'
import Icono from './components/Icono'
import CashFlow from './components/CashFlow'
import RegistroManual from './components/RegistroManual'
import Catalogos from './components/Catalogos'

const vistas = {
  'cash-flow': { titulo: 'Cash Flow', descripcion: 'Una vista clara del dinero que entra y sale de tu negocio.', icono: 'flujo' },
  registro: { titulo: 'Nuevo movimiento', descripcion: 'Registrá un cobro o pago con su cuenta y categoría.', icono: 'nuevo' },
  cuentas: { titulo: 'Cuentas financieras', descripcion: 'Conocé las cuentas que forman parte del negocio.', icono: 'cuentas' },
  categorias: { titulo: 'Categorías de flujo', descripcion: 'Cada ingreso y egreso, con una clasificación clara.', icono: 'categorias' },
}

function vistaInicial() {
  const hash = window.location.hash.slice(1)
  return vistas[hash] ? hash : 'cash-flow'
}

function PanelFinanciero({ sesion, onExpired, onLogout }) {
  const [vista, setVista] = useState(vistaInicial)
  const [catalogos, setCatalogos] = useState(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [registros, setRegistros] = useState(0)
  const esAdmin = sesion.rol === 'ADMIN'

  useEffect(() => {
    const navegar = () => setVista(vistaInicial())
    window.addEventListener('hashchange', navegar)
    return () => window.removeEventListener('hashchange', navegar)
  }, [])

  useEffect(() => {
    let vigente = true
    Promise.all([
      consultarApi('/cuentas-financieras', sesion.token),
      consultarApi('/cuentas-financieras/inactivas', sesion.token),
      consultarApi('/categorias-flujo', sesion.token),
      consultarApi('/categorias-flujo/inactivas', sesion.token),
    ]).then(([activas, inactivas, categoriasActivas, categoriasInactivas]) => {
      if (vigente) setCatalogos({ cuentas: [...activas, ...inactivas], categorias: [...categoriasActivas, ...categoriasInactivas] })
    }).catch((fallo) => {
      if (!vigente) return
      if (fallo.status === 401) onExpired()
      else setError(fallo.message)
    })
    return () => { vigente = false }
  }, [sesion.token, onExpired, revision])

  const actual = vistas[vista]
  return <div className="app-layout">
    <a className="skip-link" href="#contenido">Ir al contenido</a>
    <aside className="sidebar">
      <a className="marca" href="#cash-flow"><span className="monograma">JM</span><span>JM Hielos<small>Gestión del negocio</small></span></a>
      <p className="nav-label">FINANZAS</p>
      <nav aria-label="Navegación principal">{Object.entries(vistas).filter(([clave]) => clave !== 'registro' || esAdmin).map(([clave, item]) => <a href={'#' + clave} key={clave} className={'nav-item ' + (vista === clave ? 'activo' : '')} aria-current={vista === clave ? 'page' : undefined}><Icono nombre={item.icono} />{item.titulo}</a>)}</nav>
      <div className="sidebar-inferior"><div className="usuario"><span className="avatar">{sesion.username.slice(0, 2).toUpperCase()}</span><span><strong>{sesion.username}</strong><small>{sesion.rol === 'ADMIN' ? 'Administrador' : sesion.rol === 'OPERADOR' ? 'Operador · consulta' : 'Lector · consulta'}</small></span></div><button className="boton-salir" onClick={onLogout}><Icono nombre="salir" />Cerrar sesión</button></div>
    </aside>
    <div className="app-principal">
      <header className="topbar"><span>Administración <span className="breadcrumb">/ Finanzas</span></span><span className="badge neutral"><span className="punto" />Sesión iniciada</span></header>
      <main id="contenido" tabIndex="-1">
        <div className="pagina-cabecera"><div><p className="eyebrow">CONTROL FINANCIERO</p><h1>{actual.titulo}</h1><p className="muted">{actual.descripcion}</p></div>{esAdmin && vista === 'cash-flow' && <a className="boton primario" href="#registro"><Icono nombre="nuevo" />Nuevo movimiento</a>}</div>
        {!catalogos && !error && <p className="estado-carga" role="status">Cargando cuentas y categorías…</p>}
        {error && <div className="mensaje error" role="alert"><p>{error}</p><button className="boton secundario" onClick={() => { setError(''); setRevision(revision + 1) }}>Reintentar conexión</button></div>}
        {catalogos && !error && <>
          {vista === 'cash-flow' && <CashFlow sesion={sesion} cuentas={catalogos.cuentas} onExpired={onExpired} revision={registros} />}
          {vista === 'registro' && (esAdmin ? <RegistroManual sesion={sesion} {...catalogos} onExpired={onExpired} onSaved={() => setRegistros(registros + 1)} /> : <p className="aviso">Tu rol permite consultar información. El registro manual está reservado al administrador.</p>)}
          {(vista === 'cuentas' || vista === 'categorias') && <Catalogos vista={vista} {...catalogos} />}
          {(vista === 'cuentas' || vista === 'categorias') && <button className="boton secundario actualizar" onClick={() => { setCatalogos(null); setRevision(revision + 1) }}>Actualizar catálogos</button>}
        </>}
      </main>
      <footer className="app-pie">JM Hielos <span>Gestión clara, decisiones informadas.</span></footer>
    </div>
  </div>
}

export default function App() {
  // El JWT vive en memoria: cerrar o recargar la página requiere iniciar sesión.
  const [sesion, setSesion] = useState(null)
  const [aviso, setAviso] = useState('')
  const cerrarPorVencimiento = useCallback(() => {
    setSesion(null)
    setAviso('Tu sesión venció o el usuario dejó de estar activo. Iniciá sesión nuevamente.')
  }, [])
  if (!sesion) return <Login aviso={aviso} onLogin={(datos) => { setAviso(''); setSesion(datos) }} />
  return <PanelFinanciero sesion={sesion} onExpired={cerrarPorVencimiento} onLogout={() => { setSesion(null); setAviso('Cerraste sesión correctamente.') }} />
}
