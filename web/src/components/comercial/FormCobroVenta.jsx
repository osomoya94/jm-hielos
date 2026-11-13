import FormularioComercial from './FormularioComercial'
import { PagosVenta } from './FormVenta'
import { Campo } from '../inventario/FormularioOperacion'
import { ahoraArgentina, moneda } from '../../formato'
import { decimalIngresado, fechaOperacion } from '../../inventario'

export default function FormCobroVenta({ registro, accion, datos, ...props }) {
  const anular = accion === 'anular'
  return (
    <FormularioComercial
      {...props}
      titulo={anular ? 'Anular venta entregada' : 'Cobrar saldo de la venta'}
      ruta={'/ventas/' + registro.id + (anular ? '/anulacion' : '/cobros')}
      inicial={{
        fechaEfectiva: ahoraArgentina(),
        pagos: [{ cuentaId: '', categoriaId: '', importe: '' }],
        devoluciones: registro.detalles.map((d) => ({ productoId: d.productoId, cantidad: '0' }))
      }}
      preparar={(v) => {
        if (!anular && !v.pagos.length) throw new Error('Agregá al menos un cobro real.')
        return {
          fechaEfectiva: fechaOperacion(v.fechaEfectiva),
          ...(anular
            ? {
                devoluciones: v.devoluciones
                  .filter((d) => Number(d.cantidad) > 0)
                  .map((d) => ({ ...d, cantidad: Number(d.cantidad) }))
              }
            : { pagos: v.pagos.map((p) => ({ ...p, importe: decimalIngresado(p.importe) })) })
        }
      }}
    >
      {({ valores, cambiar, setValores }) => (
        <>
          <p className="aviso">
            {registro.cliente.nombre} · Venta {registro.id} · Saldo pendiente:{' '}
            {moneda(registro.saldo)}.
          </p>
          <Campo
            nombre="fechaEfectiva"
            titulo={
              anular ? 'Fecha y hora de la devolución física' : 'Fecha y hora efectiva del dinero'
            }
            type="datetime-local"
            max={ahoraArgentina()}
            valores={valores}
            cambiar={cambiar}
          />
          {anular ? (
            <>
              <p>
                Ingresá solamente las unidades que efectivamente regresaron aptas. Cero conserva la
                salida física. La anulación cancela la deuda y conserva los cobros como crédito del
                cliente; no registra una devolución de dinero.
              </p>
              {valores.devoluciones.map((d, indice) => (
                <Campo
                  key={d.productoId}
                  id={'anular-cantidad-' + indice}
                  nombre="cantidad"
                  titulo={'Devueltas aptas: ' + registro.detalles[indice].nombreProducto}
                  type="number"
                  min="0"
                  max={registro.detalles[indice].cantidad}
                  step="1"
                  valores={d}
                  cambiar={(e) =>
                    setValores((v) => ({
                      ...v,
                      devoluciones: v.devoluciones.map((item, i) =>
                        i === indice ? { ...item, cantidad: e.target.value } : item
                      )
                    }))
                  }
                />
              ))}
            </>
          ) : (
            <>
              <PagosVenta
                pagos={valores.pagos}
                cambiarPagos={(pagos) => setValores((v) => ({ ...v, pagos }))}
                datos={datos}
              />
              <p className="ayuda">
                Este cobro reduce la deuda. No crea otra venta ni otro descuento de stock.
              </p>
            </>
          )}
        </>
      )}
    </FormularioComercial>
  )
}
