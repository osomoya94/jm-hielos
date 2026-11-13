import { useRef, useState } from 'react'
import Dialogo from '../Dialogo'
import { Campo } from '../inventario/FormularioOperacion'
import { consultarApi } from '../../api'
import { crearClaveIdempotencia } from '../../idempotencia'

export default function FormularioComercial({
  titulo,
  ruta,
  inicial = {},
  preparar,
  idempotente = true,
  sesion,
  onClose,
  onExpired,
  onSaved,
  children,
  confirmar = 'Confirmar registro'
}) {
  const [valores, setValores] = useState(() => ({ motivo: '', ...inicial }))
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const pedido = useRef(null)
  const enviando = useRef(false)
  const cambiar = (e) => setValores((v) => ({ ...v, [e.target.name]: e.target.value }))
  async function guardar(e) {
    e.preventDefault()
    if (enviando.current) return
    setError('')
    try {
      const datos = { ...preparar(valores), motivo: valores.motivo.trim() }
      const destino = typeof ruta === 'function' ? ruta(valores) : ruta
      const contenido = JSON.stringify({ destino, datos })
      if (idempotente) {
        if (pedido.current?.contenido !== contenido)
          pedido.current = { contenido, clave: crearClaveIdempotencia() }
        datos.claveIdempotencia = pedido.current.clave
      }
      enviando.current = true
      setOcupado(true)
      const respuesta = await consultarApi(destino, sesion.token, { method: 'POST', data: datos })
      onSaved(respuesta)
    } catch (fallo) {
      if (fallo.status === 401) onExpired()
      else
        setError(
          fallo.message +
            (idempotente && !fallo.status
              ? ' Reintentá sin cambiar los datos para conservar la misma operación.'
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
          {children?.({ valores, cambiar, setValores })}
          <Campo
            nombre="motivo"
            titulo="Motivo / referencia"
            maxLength="500"
            valores={valores}
            cambiar={cambiar}
          />
        </fieldset>
        <div className="dialogo-acciones">
          <button type="button" className="boton secundario" disabled={ocupado} onClick={onClose}>
            Cancelar
          </button>
          <button className="boton primario" disabled={ocupado}>
            {ocupado ? 'Guardando…' : confirmar}
          </button>
        </div>
      </form>
    </Dialogo>
  )
}
