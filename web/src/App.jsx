import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import Login from './components/Login'
import Marca from './components/Marca'
import Icono from './components/Icono'
import Inicio from './components/Inicio'
import VistaFinanciera from './components/VistaFinanciera'
import Catalogos from './components/Catalogos'
import VistaInventario from './components/inventario/VistaInventario'
import VistaComercial from './components/comercial/VistaComercial'

const vistas = {
  ventas: {
    titulo: 'Ventas y entregas',
    descripcion: 'Ventas entregadas, participantes y cobros reales.',
    icono: 'productos',
    grupo: 'Gestión'
  },
  deudas: {
    titulo: 'Deudas de clientes',
    descripcion: 'Saldos pendientes, seguimiento y cobros parciales.',
    icono: 'deudas',
    grupo: 'Gestión'
  },
  precios: {
    titulo: 'Precios',
    descripcion: 'Listas y condiciones comerciales por cliente.',
    icono: 'categorias',
    grupo: 'Gestión'
  },
  inicio: {
    titulo: 'Inicio',
    descripcion: 'Resumen financiero del mes y accesos a la gestión.',
    icono: 'inicio',
    grupo: 'General'
  },
  productos: {
    titulo: 'Productos',
    descripcion: 'Catálogo de bolsas de hielo, peso, unidad y estado.',
    icono: 'productos',
    grupo: 'Gestión'
  },
  stock: {
    titulo: 'Stock',
    descripcion: 'Hielo terminado disponible y movimientos justificados.',
    icono: 'productos',
    grupo: 'Inventario'
  },
  insumos: {
    titulo: 'Insumos',
    descripcion: 'Compras, paquetes en depósito y unidades disponibles en producción.',
    icono: 'insumos',
    grupo: 'Inventario'
  },
  produccion: {
    titulo: 'Producción',
    descripcion: 'Lotes, consumo real de bolsas y unidades aptas obtenidas.',
    icono: 'produccion',
    grupo: 'Inventario'
  },
  clientes: {
    titulo: 'Clientes',
    descripcion: 'Datos de contacto y clasificación de clientes.',
    icono: 'clientes',
    grupo: 'Gestión'
  },
  proveedores: {
    titulo: 'Proveedores',
    descripcion: 'Datos de contacto e identificación de proveedores.',
    icono: 'proveedores',
    grupo: 'Gestión'
  },
  'cash-flow': {
    titulo: 'Cash Flow',
    descripcion: 'Flujo realizado por período y cuenta financiera.',
    icono: 'flujo',
    grupo: 'Finanzas'
  },
  movimientos: {
    titulo: 'Movimientos',
    descripcion: 'Registro de cobros y pagos manuales.',
    icono: 'nuevo',
    grupo: 'Finanzas'
  },
  cuentas: {
    titulo: 'Cuentas financieras',
    descripcion: 'Cuentas propias, saldos de apertura y estado.',
    icono: 'cuentas',
    grupo: 'Finanzas'
  },
  categorias: {
    titulo: 'Categorías',
    descripcion: 'Clasificación de los ingresos y egresos del negocio.',
    icono: 'categorias',
    grupo: 'Finanzas'
  }
}

function vistaInicial() {
  const hash = window.location.hash.slice(1)
  if (hash === 'registro') return 'movimientos'
  return vistas[hash] ? hash : 'inicio'
}

function PanelAdministrativo({ sesion, onExpired, onLogout }) {
  const [vista, setVista] = useState(vistaInicial)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [revision, setRevision] = useState(0)
  const contenido = useRef(null)
  const botonMenu = useRef(null)
  const menu = useRef(null)
  const esAdmin = sesion.rol === 'ADMIN'

  useEffect(() => {
    if (menuAbierto) menu.current?.querySelector('[aria-current="page"]')?.focus()
  }, [menuAbierto])

  useEffect(() => {
    function navegar() {
      if (window.location.hash === '#contenido') {
        contenido.current?.focus()
        return
      }
      setVista(vistaInicial())
      setMenuAbierto(false)
      contenido.current?.focus()
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', navegar)
    return () => window.removeEventListener('hashchange', navegar)
  }, [])

  function cerrarMenu() {
    setMenuAbierto(false)
    botonMenu.current?.focus()
  }
  const actual = vistas[vista]
  const rol =
    sesion.rol === 'ADMIN' ? 'Administrador' : sesion.rol === 'OPERADOR' ? 'Operador' : 'Lector'

  return (
    <div className="app-layout">
      <a className="skip-link" href="#contenido">
        Ir al contenido
      </a>
      <aside
        ref={menu}
        className={'sidebar ' + (menuAbierto ? 'menu-abierto' : '')}
        onKeyDown={(evento) => {
          if (evento.key === 'Escape') cerrarMenu()
        }}
      >
        <div className="sidebar-marca">
          <a href="#inicio" aria-label="JM Hielos, inicio">
            <Marca compacta />
          </a>
          <button className="boton-icono cerrar-menu" aria-label="Cerrar menú" onClick={cerrarMenu}>
            <Icono nombre="cerrar" />
          </button>
        </div>
        <nav id="menu-principal" aria-label="Navegación principal">
          {['General', 'Inventario', 'Gestión', 'Finanzas'].map((grupo) => (
            <div className="nav-grupo" key={grupo}>
              <p className="nav-label">{grupo}</p>
              {Object.entries(vistas)
                .filter(
                  ([clave, item]) => item.grupo === grupo && (clave !== 'movimientos' || esAdmin)
                )
                .map(([clave, item]) => (
                  <a
                    key={clave}
                    href={'#' + clave}
                    className={'nav-item ' + (vista === clave ? 'activo' : '')}
                    aria-current={vista === clave ? 'page' : undefined}
                    onClick={() => {
                      setMenuAbierto(false)
                      contenido.current?.focus()
                    }}
                  >
                    <Icono nombre={item.icono} />
                    {item.titulo}
                  </a>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-inferior">
          <div className="usuario">
            <span className="avatar">{sesion.username.slice(0, 2).toUpperCase()}</span>
            <span>
              <strong>{sesion.username}</strong>
              <small>
                {rol}
                {sesion.rol === 'LECTOR' ? ' · Solo consulta' : ''}
              </small>
            </span>
          </div>
          <button className="boton-salir" onClick={onLogout}>
            <Icono nombre="salir" />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="app-principal">
        <header className="topbar">
          <button
            ref={botonMenu}
            className="boton-icono abrir-menu"
            aria-label="Abrir menú"
            aria-controls="menu-principal"
            aria-expanded={menuAbierto}
            onClick={() => setMenuAbierto(!menuAbierto)}
          >
            <Icono nombre="menu" />
          </button>
          <a href="#inicio" className="marca-movil" aria-label="JM Hielos, inicio">
            <Marca compacta />
          </a>
          <nav className="breadcrumb" aria-label="Ubicación actual">
            <span>{actual.grupo}</span>
            <span aria-hidden="true">/</span>
            <strong>{actual.titulo}</strong>
          </nav>
          <div className="topbar-derecha">
            <span className="badge neutral">{rol}</span>
            <span className="sesion-indicador">
              <span className="punto" />
              Sesión activa
            </span>
          </div>
        </header>
        <main id="contenido" ref={contenido} tabIndex="-1">
          <div className="pagina-cabecera">
            <div>
              <h1>{actual.titulo}</h1>
              <p className="muted">{actual.descripcion}</p>
            </div>
            {esAdmin && (vista === 'inicio' || vista === 'cash-flow') && (
              <a href="#movimientos" className="boton primario">
                <Icono nombre="nuevo" />
                Nuevo movimiento
              </a>
            )}
          </div>
          {vista === 'inicio' && (
            <Inicio sesion={sesion} onExpired={onExpired} revision={revision} />
          )}
          {(vista === 'cash-flow' || vista === 'movimientos') && (
            <VistaFinanciera
              key={vista}
              vista={vista}
              sesion={sesion}
              onExpired={onExpired}
              revision={revision}
              onSaved={() => setRevision((valor) => valor + 1)}
            />
          )}
          {['productos', 'clientes', 'proveedores', 'cuentas', 'categorias'].includes(vista) && (
            <Catalogos
              key={vista}
              vista={vista}
              sesion={sesion}
              onExpired={onExpired}
              onActualizado={() => setRevision((valor) => valor + 1)}
            />
          )}
          {['stock', 'insumos', 'produccion'].includes(vista) && (
            <VistaInventario
              key={vista}
              vista={vista}
              sesion={sesion}
              onExpired={onExpired}
              onActualizado={() => setRevision((valor) => valor + 1)}
            />
          )}
          {['precios', 'ventas', 'deudas'].includes(vista) && (
            <VistaComercial key={vista} vista={vista} sesion={sesion} onExpired={onExpired} onActualizado={() => setRevision(valor => valor + 1)} />
          )}
        </main>
        <footer className="app-pie">
          <span>JM Hielos · Administración</span>
          <span>ARS · Hora de Argentina</span>
        </footer>
      </div>
    </div>
  )
}

export default function App() {
  // El JWT queda en memoria. No se guardan credenciales en el navegador.
  const [sesion, setSesion] = useState(null)
  const [aviso, setAviso] = useState('')
  const cerrarPorVencimiento = useCallback(() => {
    setSesion(null)
    setAviso('Tu sesión venció o el usuario dejó de estar activo. Iniciá sesión nuevamente.')
  }, [])
  if (!sesion)
    return (
      <Login
        aviso={aviso}
        onLogin={(datos) => {
          setAviso('')
          setSesion(datos)
        }}
      />
    )
  return (
    <PanelAdministrativo
      sesion={sesion}
      onExpired={cerrarPorVencimiento}
      onLogout={() => {
        setSesion(null)
        setAviso('Cerraste sesión correctamente.')
      }}
    />
  )
}
