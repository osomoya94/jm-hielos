import { useRef, useState } from 'react'
import Dialogo from '../Dialogo'
import { consultarApi } from '../../api'
import { crearClaveIdempotencia } from '../../idempotencia'
import { ahoraArgentina } from '../../formato'
import { fechaOperacion } from '../../inventario'

export function Campo({ nombre, titulo, valores, cambiar, opciones, id: idProp, ...props }) {
  const id = idProp || 'inventario-' + nombre
  return (
    <div>
      <label htmlFor={id}>{titulo}</label>
      {opciones ? (
        <select
          id={id}
          name={nombre}
          value={valores[nombre] ?? ''}
          onChange={cambiar}
          required
          {...props}
        >
          <option value="">Seleccionar</option>
          {opciones.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          name={nombre}
          value={valores[nombre] ?? ''}
          onChange={cambiar}
          required
          {...props}
        />
      )}
    </div>
  )
}

export default function FormularioOperacion({
  titulo,
  ruta,
  metodo = 'POST',
  inicial,
  preparar,
  sesion,
  onExpired,
  onClose,
  onSaved,
  operacion = true,
  children
}) {
  const [valores, setValores] = useState(() => ({
    fechaEfectiva: ahoraArgentina(),
    motivo: '',
    ...inicial
  }))
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const pedido = useRef(null)
  const enviando = useRef(false)
  function cambiar(e) {
    setValores((v) => ({ ...v, [e.target.name]: e.target.value }))
  }
  async function guardar(e) {
    e.preventDefault()
    if (enviando.current) return
    setError('')
    try {
      const datos = preparar(valores)
      if (operacion)
        Object.assign(datos, {
          fechaEfectiva: fechaOperacion(valores.fechaEfectiva),
          motivo: valores.motivo.trim()
        })
      const contenido = JSON.stringify(datos)
      if (operacion) {
        if (pedido.current?.contenido !== contenido)
          pedido.current = { contenido, clave: crearClaveIdempotencia() }
        datos.claveIdempotencia = pedido.current.clave
      }
      enviando.current = true
      setOcupado(true)
      const resultado = await consultarApi('/inventario/' + ruta, sesion.token, {
        method: metodo,
        data: datos
      })
      onSaved(resultado)
    } catch (fallo) {
      if (fallo.status === 401) onExpired()
      else
        setError(
          fallo.message +
            (operacion && !fallo.status
              ? ' Si reintentás, conservá los datos para evitar duplicados.'
              : '')
        )
    } finally {
      enviando.current = false
      setOcupado(false)
    }
  }
  return (
    <Dialogo titulo={titulo} onClose={onClose} ocupado={ocupado}>
      <form className="formulario" onSubmit={guardar}>
        {error && (
          <p className="mensaje error" role="alert">
            {error}
          </p>
        )}
        <fieldset className="campos" disabled={ocupado}>
          {children({ valores, cambiar, setValores })}
          {operacion && (
            <div className="form-grid inventario-fecha">
              <Campo
                nombre="fechaEfectiva"
                titulo="Fecha y hora operativa"
                type="datetime-local"
                valores={valores}
                cambiar={cambiar}
              />
              <Campo
                nombre="motivo"
                titulo="Motivo / referencia"
                maxLength="500"
                valores={valores}
                cambiar={cambiar}
              />
            </div>
          )}
        </fieldset>
        <div className="form-acciones">
          <button type="button" className="boton secundario" onClick={onClose} disabled={ocupado}>
            Cancelar
          </button>
          <button className="boton primario" disabled={ocupado}>
            {ocupado ? 'Guardando…' : 'Confirmar registro'}
          </button>
        </div>
      </form>
    </Dialogo>
  )
}
