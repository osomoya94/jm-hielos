import { useEffect, useRef } from 'react'
import Icono from './Icono'

export default function Dialogo({ titulo, onClose, ocupado = false, children }) {
  const dialogo = useRef(null)
  useEffect(() => {
    const elemento = dialogo.current
    elemento.showModal()
    return () => {
      elemento.close()
    }
  }, [])
  return (
    <dialog
      ref={dialogo}
      className="dialogo"
      aria-labelledby="titulo-dialogo"
      onCancel={(evento) => {
        evento.preventDefault()
        if (!ocupado) onClose()
      }}
    >
      <div className="dialogo-cabecera">
        <h2 id="titulo-dialogo">{titulo}</h2>
        <button
          className="boton-icono"
          aria-label="Cerrar formulario"
          onClick={onClose}
          disabled={ocupado}
        >
          <Icono nombre="cerrar" />
        </button>
      </div>
      {children}
    </dialog>
  )
}
