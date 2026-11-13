import FormularioOperacion, { Campo } from './FormularioOperacion'
import { decimalIngresado, numeroStock, presentacionesDe, saldoCompra } from '../../inventario'
import { moneda } from '../../formato'

export default function FormCompra({ datos, registro, ...props }) {
  const pagoPosterior = Boolean(registro)
  const opciones = presentacionesDe(datos.insumos).map((p) => ({
    id: p.id,
    nombre: `${p.insumo.nombre} · ${p.nombre} × ${numeroStock(p.factor)}`
  }))
  return (
    <FormularioOperacion
      {...props}
      titulo={pagoPosterior ? 'Registrar pago al proveedor' : 'Compra de insumos'}
      ruta={pagoPosterior ? 'compras/' + registro.id + '/pagos' : 'compras'}
      inicial={{
        detalles: [{ presentacionId: '', paquetes: '1', costoTotal: '' }],
        paga: pagoPosterior ? 'si' : 'no'
      }}
      preparar={(v) => {
        const pago =
          v.paga === 'si'
            ? {
                cuentaId: v.cuentaId,
                categoriaId: v.categoriaId,
                importe: decimalIngresado(v.importe)
              }
            : undefined
        return pagoPosterior
          ? { pago }
          : {
              proveedorId: v.proveedorId,
              comprobante: v.comprobante.trim(),
              detalles: v.detalles.map((d) => ({
                presentacionId: d.presentacionId,
                paquetes: Number(d.paquetes),
                costoTotal: decimalIngresado(d.costoTotal)
              })),
              ...(v.vencimiento ? { vencimiento: v.vencimiento } : {}),
              ...(pago ? { pago } : {})
            }
      }}
    >
      {({ valores, cambiar, setValores }) => (
        <>
          {!pagoPosterior && (
            <>
              <div className="form-grid">
                <Campo
                  nombre="proveedorId"
                  titulo="Proveedor"
                  opciones={datos.proveedores}
                  valores={valores}
                  cambiar={cambiar}
                />
                <Campo
                  nombre="comprobante"
                  titulo="Comprobante / referencia única del proveedor"
                  maxLength="100"
                  valores={valores}
                  cambiar={cambiar}
                />
              </div>
              <div className="inventario-lineas">
                {valores.detalles.map((linea, indice) => {
                  const actualizar = (e) =>
                    setValores((v) => ({
                      ...v,
                      detalles: v.detalles.map((d, i) =>
                        i === indice ? { ...d, [e.target.name]: e.target.value } : d
                      )
                    }))
                  return (
                    <fieldset className="inventario-linea" key={indice}>
                      <legend>Insumo {indice + 1}</legend>
                      <div className="form-grid">
                        <Campo
                          nombre={'presentacionId'}
                          titulo="Presentación"
                          id={'compra-presentacion-' + indice}
                          opciones={opciones}
                          valores={linea}
                          cambiar={actualizar}
                        />
                        <Campo
                          nombre="paquetes"
                          titulo="Cantidad de presentaciones"
                          id={'compra-paquetes-' + indice}
                          type="number"
                          min="1"
                          step="1"
                          max="1000000"
                          valores={linea}
                          cambiar={actualizar}
                        />
                        <Campo
                          nombre="costoTotal"
                          titulo="Costo total de esta línea (ARS)"
                          id={'compra-costo-' + indice}
                          type="number"
                          min="0.01"
                          step="0.01"
                          valores={linea}
                          cambiar={actualizar}
                        />
                      </div>
                      {valores.detalles.length > 1 && (
                        <button
                          className="boton secundario"
                          type="button"
                          onClick={() =>
                            setValores((v) => ({
                              ...v,
                              detalles: v.detalles.filter((_, i) => i !== indice)
                            }))
                          }
                        >
                          Quitar insumo {indice + 1}
                        </button>
                      )}
                    </fieldset>
                  )
                })}
                <button
                  className="boton secundario"
                  type="button"
                  disabled={valores.detalles.length >= 30}
                  onClick={() =>
                    setValores((v) => ({
                      ...v,
                      detalles: [
                        ...v.detalles,
                        { presentacionId: '', paquetes: '1', costoTotal: '' }
                      ]
                    }))
                  }
                >
                  Agregar insumo a la compra
                </button>
              </div>
              <div className="form-grid">
                <Campo
                  nombre="paga"
                  titulo="¿Se realizó un pago?"
                  valores={valores}
                  cambiar={cambiar}
                  opciones={[
                    { id: 'no', nombre: 'Sin pago · saldo pendiente' },
                    { id: 'si', nombre: 'Sí · registrar pago real' }
                  ]}
                />
                <Campo
                  nombre="vencimiento"
                  titulo="Vencimiento del saldo (opcional)"
                  type="date"
                  required={false}
                  valores={valores}
                  cambiar={cambiar}
                />
              </div>
            </>
          )}
          {pagoPosterior && (
            <p className="aviso">
              Compra {registro.comprobante} · {registro.proveedor.nombre} · Saldo:{' '}
              {moneda(saldoCompra(registro))}. Este pago no vuelve a ingresar mercadería.
            </p>
          )}
          {valores.paga === 'si' && (
            <div className="form-grid">
              <Campo
                nombre="cuentaId"
                titulo="Cuenta desde la que se pagó"
                opciones={datos.cuentas}
                valores={valores}
                cambiar={cambiar}
              />
              <Campo
                nombre="categoriaId"
                titulo="Categoría de egreso"
                opciones={datos.categorias.filter((c) => c.sentido === 'EGRESO')}
                valores={valores}
                cambiar={cambiar}
              />
              <Campo
                nombre="importe"
                titulo="Importe efectivamente pagado (ARS)"
                type="number"
                min="0.01"
                step="0.01"
                valores={valores}
                cambiar={cambiar}
              />
            </div>
          )}
          <p className="ayuda">
            La compra ingresa stock al depósito. Solo el importe pagado aparece como egreso en Cash
            Flow; el resto queda pendiente al proveedor.
          </p>
        </>
      )}
    </FormularioOperacion>
  )
}
