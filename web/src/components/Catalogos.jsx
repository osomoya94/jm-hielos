import { fechaArgentina, moneda } from '../formato'

const grupos = { OPERACION: 'Operación', INVERSION_ACTIVOS: 'Inversión en activos', FINANCIACION: 'Financiación', APORTES: 'Aportes', RETIROS: 'Retiros', GARANTIAS: 'Garantías', OTROS: 'Otros' }

export default function Catalogos({ vista, cuentas, categorias }) {
  const esCuenta = vista === 'cuentas'
  const datos = esCuenta ? cuentas : categorias
  return <section className="panel">
    <div className="panel-cabecera"><div><h2>{esCuenta ? 'Cuentas financieras' : 'Categorías de flujo'}</h2><p className="muted">{esCuenta ? 'Cuentas propias en ARS. Se conserva el historial de las cuentas inactivas.' : 'Clasificación de los ingresos y egresos reales del negocio.'}</p></div><span className="badge">{datos.length} registros</span></div>
    {datos.length === 0 ? <div className="vacio"><h3>Todavía no hay registros</h3><p>Un administrador debe configurar los datos reales del negocio antes de registrar movimientos.</p></div> :
      <div className="tabla-scroll"><table><caption className="sr-only">{esCuenta ? 'Cuentas' : 'Categorías'} del negocio</caption>
        <thead><tr><th>Nombre</th><th>{esCuenta ? 'Tipo / titular' : 'Grupo'}</th><th>{esCuenta ? 'Apertura' : 'Sentido'}</th>{esCuenta && <th className="numero">Saldo de apertura</th>}<th>Estado</th></tr></thead>
        <tbody>{datos.map((dato) => <tr key={dato.id}><td><strong>{dato.nombre}</strong><small className="id-registro">{dato.id}</small></td><td>{esCuenta ? <>{dato.tipo.toLowerCase()}<small className="id-registro">{dato.titularInterno}</small></> : grupos[dato.grupo]}</td><td>{esCuenta ? fechaArgentina(dato.fechaApertura) : <span className={'badge ' + (dato.sentido === 'INGRESO' ? 'positivo' : 'negativo')}>{dato.sentido === 'INGRESO' ? 'Ingreso' : 'Egreso'}</span>}</td>{esCuenta && <td className="numero">{moneda(dato.saldoInicial)}</td>}<td><span className={'badge ' + (dato.activo ? 'neutral' : '')}>{dato.activo ? 'Activo' : 'Inactivo'}</span></td></tr>)}</tbody>
      </table></div>}
    {esCuenta && <p className="nota-tabla">El saldo de apertura no es un ingreso ni el saldo actual. Consultá el saldo de libro en Cash Flow.</p>}
  </section>
}
