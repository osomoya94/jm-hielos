import Icono from './Icono'

export default function AccesosRapidos({ esAdmin, puedeOperar }) {
  return (
    <section className="accesos-seccion" aria-labelledby="titulo-accesos">
      <h2 id="titulo-accesos">Accesos rápidos</h2>
      <div className="accesos">
        {puedeOperar && <a className="panel acceso" href="#ventas"><span className="acceso-icono"><Icono nombre="productos" /></span><span><strong>Registrar entrega</strong><small>Productos, responsables y cobros</small></span><Icono nombre="flecha" /></a>}
        <a className="panel acceso" href="#deudas"><span className="acceso-icono"><Icono nombre="deudas" /></span><span><strong>Deudas de clientes</strong><small>Saldos e historial de cobros</small></span><Icono nombre="flecha" /></a>
        {esAdmin && (
          <a className="panel acceso" href="#movimientos">
            <span className="acceso-icono">
              <Icono nombre="nuevo" />
            </span>
            <span>
              <strong>Registrar movimiento</strong>
              <small>Cobro o pago manual</small>
            </span>
            <Icono nombre="flecha" />
          </a>
        )}
        <a className="panel acceso" href="#cash-flow">
          <span className="acceso-icono">
            <Icono nombre="flujo" />
          </span>
          <span>
            <strong>Consultar Cash Flow</strong>
            <small>Fechas, cuentas y comprobantes</small>
          </span>
          <Icono nombre="flecha" />
        </a>
        <a className="panel acceso" href="#clientes">
          <span className="acceso-icono">
            <Icono nombre="clientes" />
          </span>
          <span>
            <strong>Clientes</strong>
            <small>Datos y estado de cada cliente</small>
          </span>
          <Icono nombre="flecha" />
        </a>
      </div>
    </section>
  )
}
