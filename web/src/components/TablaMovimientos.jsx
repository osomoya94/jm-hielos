import { fechaArgentina, moneda } from '../formato'
import Icono from './Icono'

export default function TablaMovimientos({
  movimientos,
  coberturaCompleta = true,
  compacto = false
}) {
  if (movimientos.length === 0)
    return (
      <div className="vacio">
        <span className="vacio-icono">
          <Icono nombre="flujo" width="28" height="28" />
        </span>
        <h3>Sin movimientos en este período</h3>
        <p>
          {coberturaCompleta
            ? 'No hay ingresos ni egresos registrados para las fechas seleccionadas.'
            : 'No hay movimientos disponibles. Revisá las fechas y la cobertura del informe.'}
        </p>
      </div>
    )

  return (
    <div className="tabla-scroll" role="region" aria-label="Movimientos financieros" tabIndex="0">
      <table>
        <caption className="sr-only">Movimientos de flujo externo por fecha efectiva</caption>
        <thead>
          <tr>
            <th>Fecha efectiva</th>
            <th>Detalle y categoría</th>
            <th>Cuenta</th>
            <th>Tipo</th>
            <th className="numero">Importe</th>
            {!compacto && <th>Comprobante</th>}
          </tr>
        </thead>
        <tbody>
          {movimientos.map((movimiento) => (
            <tr key={movimiento.id}>
              <td className="fecha-celda">{fechaArgentina(movimiento.fechaEfectiva)}</td>
              <td>
                <strong>{movimiento.detalle}</strong>
                <small className="id-registro">
                  {movimiento.categoria?.nombre || 'Sin categoría histórica'}
                </small>
              </td>
              <td>{movimiento.cuenta.nombre}</td>
              <td>
                <span
                  className={
                    'badge ' + (movimiento.sentido === 'INGRESO' ? 'positivo' : 'negativo')
                  }
                >
                  {movimiento.sentido === 'INGRESO' ? 'Ingreso' : 'Egreso'}
                </span>
                {!compacto && (
                  <small className="id-registro">{movimiento.operacion.tipo.toLowerCase()}</small>
                )}
              </td>
              <td className="numero importe">{moneda(movimiento.importe)}</td>
              {!compacto && (
                <td>
                  <details className="comprobante">
                    <summary>Ver detalle</summary>
                    <dl>
                      <dt>Operación</dt>
                      <dd>{movimiento.operacion.id}</dd>
                      <dt>Registrado por</dt>
                      <dd>{movimiento.usuario.username}</dd>
                      <dt>Fecha de carga</dt>
                      <dd>{fechaArgentina(movimiento.fechaRegistro)}</dd>
                      <dt>Origen</dt>
                      <dd>
                        {movimiento.operacion.origenTipo || movimiento.operacion.tipo}
                        {movimiento.operacion.origenId ? ' · ' + movimiento.operacion.origenId : ''}
                      </dd>
                      {movimiento.operacion.referencia && (
                        <>
                          <dt>Referencia</dt>
                          <dd>{movimiento.operacion.referencia}</dd>
                        </>
                      )}
                      {movimiento.operacion.tipo === 'REVERSION' && (
                        <>
                          <dt>Corrección</dt>
                          <dd>Resta del componente original.</dd>
                        </>
                      )}
                    </dl>
                  </details>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
