import Icono from './Icono'

// Espacios visuales para módulos futuros. No contienen cifras ni acciones.
export default function ControlesPendientes() {
  const controles = [
    { nombre: 'Reposiciones', detalle: 'Seguimiento de reposiciones.', icono: 'reposiciones' }
  ]

  return (
    <aside className="panel controles-pendientes" aria-labelledby="titulo-controles">
      <div className="controles-cabecera">
        <a href="#stock" className="enlace">
          Consultar stock e insumos <Icono nombre="flecha" width="16" height="16" />
        </a>
        <span className="etiqueta-seccion">SEGUIMIENTO OPERATIVO</span>
        <h2 id="titulo-controles">Próximos controles</h2>
        <p>Estos módulos todavía no están disponibles.</p>
      </div>
      <ul>
        {controles.map((control) => (
          <li key={control.nombre}>
            <span className="control-icono">
              <Icono nombre={control.icono} width="20" height="20" />
            </span>
            <div>
              <strong>{control.nombre}</strong>
              <p>{control.detalle}</p>
              <span className="badge planificado">Planificado</span>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
