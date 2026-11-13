import { useRef, useState } from 'react'
import { consultarApi } from '../api'
import Marca from './Marca'
import Icono from './Icono'

export default function Login({ onLogin, aviso }) {
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [visible, setVisible] = useState(false)
  const enviando = useRef(false)

  async function ingresar(evento) {
    evento.preventDefault()
    if (enviando.current) return
    const datos = new FormData(evento.currentTarget)
    const username = datos.get('username').trim()
    if (!username) {
      setError('Ingresá tu usuario.')
      return
    }
    setError('')
    enviando.current = true
    setCargando(true)
    try {
      const sesion = await consultarApi('/auth/login', null, {
        method: 'POST',
        data: { username, password: datos.get('password') }
      })
      onLogin(sesion)
    } catch (fallo) {
      setError(
        fallo.status === 429
          ? 'Demasiados intentos. Esperá un minuto antes de volver a ingresar.'
          : fallo.message
      )
    } finally {
      enviando.current = false
      setCargando(false)
    }
  }

  return (
    <main className="login-layout">
      <div className="login-contenedor">
        <section className="login-identidad" aria-label="JM Hielos, identidad del sistema">
          <span className="login-identidad-etiqueta">SISTEMA DE GESTIÓN</span>
          <div className="login-logo">
            <img
              src="/logo-jm.jpeg.jpeg"
              alt="Logo de JM Hielos, venta de hielo"
              width="1600"
              height="870"
            />
          </div>
          <div className="login-identidad-pie">
            <strong>JM Hielos</strong>
            <span>Administración del negocio</span>
          </div>
        </section>
        <section className="login-acceso" aria-labelledby="titulo-login">
          <div className="login-marca-movil">
            <Marca />
          </div>
          <form
            onSubmit={ingresar}
            className="panel formulario-acceso"
            aria-labelledby="titulo-login"
          >
            <div className="login-form-encabezado">
              <span className="login-icono">
                <Icono nombre="candado" />
              </span>
              <span className="etiqueta-seccion">ACCESO AL SISTEMA</span>
            </div>
            <h1 id="titulo-login">Iniciar sesión</h1>
            <p className="muted">Ingresá con tu usuario de JM Hielos.</p>
            {aviso && (
              <p className="aviso" role="status">
                {aviso}
              </p>
            )}
            {error && (
              <p className="mensaje error" role="alert">
                {error}
              </p>
            )}
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              maxLength={72}
              required
              autoFocus
              disabled={cargando}
            />
            <label htmlFor="password">Contraseña</label>
            <div className="password-input">
              <input
                id="password"
                name="password"
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                minLength={8}
                maxLength={72}
                required
                disabled={cargando}
              />
              <button
                type="button"
                className="boton-texto"
                onClick={() => setVisible(!visible)}
                aria-pressed={visible}
                aria-controls="password"
              >
                {visible ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <button className="boton primario acceso-submit" disabled={cargando}>
              {cargando ? 'Ingresando…' : 'Ingresar'}
              {!cargando && <Icono nombre="flecha" width="18" height="18" />}
            </button>
            <p className="login-pie">Acceso exclusivo para usuarios autorizados.</p>
          </form>
        </section>
      </div>
    </main>
  )
}
