import { useState } from 'react'
import { consultarApi } from '../api'

export default function Login({ onLogin, aviso }) {
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [visible, setVisible] = useState(false)

  async function ingresar(evento) {
    evento.preventDefault()
    setError('')
    setCargando(true)
    const datos = new FormData(evento.currentTarget)
    try {
      const sesion = await consultarApi('/auth/login', null, {
        method: 'POST', data: { username: datos.get('username').trim(), password: datos.get('password') },
      })
      onLogin(sesion)
    } catch (fallo) {
      setError(fallo.status === 429 ? 'Demasiados intentos. Esperá un minuto antes de volver a ingresar.' : fallo.message)
    } finally {
      setCargando(false)
    }
  }

  return <main className="login-layout">
    <section className="login-presentacion">
      <a className="marca" href="#inicio"><span className="monograma">JM</span><span>JM Hielos<small>Administración financiera</small></span></a>
      <div>
        <p className="eyebrow">CADA MOVIMIENTO, EN SU LUGAR</p>
        <h1>Tu negocio.<br />Tus números claros.</h1>
        <p>Consultá tus cuentas y seguí el dinero que entra y sale, desde un solo lugar.</p>
        <div className="login-nota"><span className="punto" />Información real de tu negocio</div>
      </div>
      <p className="login-pie">Control financiero · JM Hielos</p>
    </section>
    <section className="login-formulario">
      <form onSubmit={ingresar} className="panel formulario-acceso">
        <p className="eyebrow">BIENVENIDO</p>
        <h2>Iniciá sesión</h2>
        <p className="muted">Ingresá con tu usuario del sistema.</p>
        {aviso && <p className="aviso" role="status">{aviso}</p>}
        {error && <p className="mensaje error" role="alert">{error}</p>}
        <label htmlFor="username">Usuario</label>
        <input id="username" name="username" autoComplete="username" required autoFocus disabled={cargando} />
        <label htmlFor="password">Contraseña</label>
        <div className="password-input">
          <input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required disabled={cargando} />
          <button type="button" className="boton-texto" onClick={() => setVisible(!visible)} aria-pressed={visible}>{visible ? 'Ocultar' : 'Mostrar'}</button>
        </div>
        <button className="boton primario acceso-submit" disabled={cargando}>{cargando ? 'Ingresando…' : 'Ingresar al sistema'}</button>
      </form>
    </section>
  </main>
}
