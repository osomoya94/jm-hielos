import { moneda } from '../formato'
import Icono from './Icono'

export default function TarjetasFinancieras({ datos }) {
  return (
    <section className="metricas" aria-label="Resumen del flujo realizado">
      <article className="panel metrica">
        <span className="metrica-icono positivo">
          <Icono nombre="ingreso" />
        </span>
        <span className="metrica-label">Ingresos</span>
        <strong>{moneda(datos.totalIngresos)}</strong>
        <small>Entradas reales del período</small>
      </article>
      <article className="panel metrica">
        <span className="metrica-icono negativo">
          <Icono nombre="egreso" />
        </span>
        <span className="metrica-label">Egresos</span>
        <strong>{moneda(datos.totalEgresos)}</strong>
        <small>Salidas reales del período</small>
      </article>
      <article className="panel metrica metrica-neta">
        <span className="metrica-icono">
          <Icono nombre="flujo" />
        </span>
        <span className="metrica-label">Flujo neto</span>
        <strong>{moneda(datos.flujoNeto)}</strong>
        <small>Ingresos menos egresos</small>
      </article>
    </section>
  )
}
