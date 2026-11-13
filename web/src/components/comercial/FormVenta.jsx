import { useEffect, useState } from 'react'
import FormularioComercial from './FormularioComercial'
import { Campo } from '../inventario/FormularioOperacion'
import { consultarApi } from '../../api'
import { ahoraArgentina, moneda } from '../../formato'
import { decimalIngresado, fechaOperacion } from '../../inventario'
import { precioCliente, resumenComercial } from '../../comercial'

export function PagosVenta({ pagos, cambiarPagos, datos }) {
  return (
    <>
      {pagos.map((pago, indice) => (
        <fieldset className="inventario-linea" key={indice}>
          <legend>Cobro en cuenta {indice + 1}</legend>
          <div className="form-grid">
            <Campo
              id={'cobro-cuenta-' + indice}
              nombre="cuentaId"
              titulo="Cuenta receptora"
              opciones={datos.cuentas}
              valores={pago}
              cambiar={(e) =>
                cambiarPagos(
                  pagos.map((p, i) => (i === indice ? { ...p, cuentaId: e.target.value } : p))
                )
              }
            />
            <Campo
              id={'cobro-categoria-' + indice}
              nombre="categoriaId"
              titulo="Categoría de ingreso"
              opciones={datos.categorias.filter((c) => c.sentido === 'INGRESO')}
              valores={pago}
              cambiar={(e) =>
                cambiarPagos(
                  pagos.map((p, i) => (i === indice ? { ...p, categoriaId: e.target.value } : p))
                )
              }
            />
            <Campo
              id={'cobro-importe-' + indice}
              nombre="importe"
              titulo="Importe efectivamente recibido"
              type="number"
              min="0.01"
              step="0.01"
              valores={pago}
              cambiar={(e) =>
                cambiarPagos(
                  pagos.map((p, i) => (i === indice ? { ...p, importe: e.target.value } : p))
                )
              }
            />
          </div>
          <button
            type="button"
            className="boton secundario"
            onClick={() => cambiarPagos(pagos.filter((_, i) => i !== indice))}
          >
            Quitar cobro {indice + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="boton secundario"
        disabled={pagos.length >= 10}
        onClick={() => cambiarPagos([...pagos, { cuentaId: '', categoriaId: '', importe: '' }])}
      >
        Agregar cobro real en otra cuenta
      </button>
    </>
  )
}

function PersonasVenta({ tarea, titulo, usuarios, valores, cambiar }) {
  return (
    <fieldset className="inventario-linea">
      <legend>{titulo}</legend>
      <div className="form-grid">
        <Campo
          nombre={tarea + 'Responsable'}
          titulo="Responsable principal"
          opciones={usuarios}
          valores={valores}
          cambiar={cambiar}
        />
        {[1, 2].map((n) => (
          <Campo
            key={n}
            nombre={tarea + 'Ayudante' + n}
            titulo={'Ayudante ' + n + ' (opcional)'}
            opciones={usuarios}
            required={false}
            valores={valores}
            cambiar={cambiar}
          />
        ))}
      </div>
    </fieldset>
  )
}

export default function FormVenta({ datos, ...props }) {
  const { sesion, onExpired } = props
  const [cliente, setCliente] = useState(null)
  const [clienteId, setClienteId] = useState('')
  const [errorCliente, setErrorCliente] = useState('')
  useEffect(() => {
    let vigente = true
    if (clienteId)
      consultarApi('/precios/clientes/' + clienteId, sesion.token)
        .then((c) => {
          if (vigente) setCliente(c)
        })
        .catch((e) => {
          if (vigente) {
            if (e.status === 401) onExpired()
            else setErrorCliente(e.message)
          }
        })
    return () => {
      vigente = false
    }
  }, [clienteId, sesion.token, onExpired])
  const personas = (v, tarea) => ({
    responsableId: v[tarea + 'Responsable'],
    ayudantesIds: [v[tarea + 'Ayudante1'], v[tarea + 'Ayudante2']].filter(Boolean)
  })
  return (
    <FormularioComercial
      {...props}
      titulo="Registrar venta entregada"
      ruta="/ventas"
      confirmar="Confirmar venta y cobros"
      inicial={{
        clienteId: '',
        fechaPedido: ahoraArgentina(),
        fechaEntrega: ahoraArgentina(),
        fechaCobro: ahoraArgentina(),
        envio: '0',
        detalles: [{ productoId: '', cantidad: '1' }],
        pagos: [],
        responsableCobranzaId: props.sesion.id
      }}
      preparar={(v) => {
        const detalles = v.detalles.map((l) => {
          const precio = precioCliente(cliente, datos.listas, l.productoId)
          if (!precio || cliente?.id !== v.clienteId)
            throw new Error('El cliente necesita una lista activa y un precio para cada producto.')
          return { productoId: l.productoId, cantidad: Number(l.cantidad), precioEsperado: precio }
        })
        const pagos = v.pagos.map((p) => ({ ...p, importe: decimalIngresado(p.importe) }))
        resumenComercial(detalles, decimalIngresado(v.envio), pagos)
        return {
          clienteId: v.clienteId,
          fechaPedido: fechaOperacion(v.fechaPedido),
          fechaEntrega: fechaOperacion(v.fechaEntrega),
          envio: decimalIngresado(v.envio),
          responsableCobranzaId: v.responsableCobranzaId,
          detalles,
          preparacion: personas(v, 'preparacion'),
          entrega: personas(v, 'entrega'),
          ...(pagos.length ? { cobro: { fechaEfectiva: fechaOperacion(v.fechaCobro), pagos } } : {})
        }
      }}
    >
      {({ valores, cambiar, setValores }) => {
        let resumen = null
        try {
          resumen = resumenComercial(
            valores.detalles.map((l) => ({
              ...l,
              precioEsperado: precioCliente(cliente, datos.listas, l.productoId)
            })),
            decimalIngresado(valores.envio),
            valores.pagos
          )
        } catch {
          /* El formulario todavía puede estar incompleto. */
        }
        return (
          <>
            <div className="form-grid">
              <Campo
                nombre="clienteId"
                titulo="Cliente o Consumidor final"
                opciones={datos.clientes}
                valores={valores}
                cambiar={(e) => {
                  cambiar(e)
                  setCliente(null)
                  setErrorCliente('')
                  setClienteId(e.target.value)
                }}
              />
              <Campo
                nombre="fechaPedido"
                titulo="Fecha y hora del pedido"
                type="datetime-local"
                max={ahoraArgentina()}
                valores={valores}
                cambiar={cambiar}
              />
              <Campo
                nombre="fechaEntrega"
                titulo="Fecha y hora de entrega"
                type="datetime-local"
                max={ahoraArgentina()}
                valores={valores}
                cambiar={cambiar}
              />
            </div>
            {errorCliente && (
              <p className="mensaje error" role="alert">
                {errorCliente}
              </p>
            )}
            {clienteId && !cliente && !errorCliente && (
              <p role="status">Consultando precios del cliente…</p>
            )}
            {cliente && !cliente.condicionComercial && (
              <p className="aviso">
                Este cliente todavía no tiene una lista asignada. El administrador puede
                configurarla desde Precios.
              </p>
            )}
            {valores.detalles.map((linea, indice) => {
              const actualizar = (e) =>
                setValores((v) => ({
                  ...v,
                  detalles: v.detalles.map((l, i) =>
                    i === indice ? { ...l, [e.target.name]: e.target.value } : l
                  )
                }))
              const precio = precioCliente(cliente, datos.listas, linea.productoId)
              return (
                <fieldset className="inventario-linea" key={indice}>
                  <legend>Producto {indice + 1}</legend>
                  <div className="form-grid">
                    <Campo
                      id={'venta-producto-' + indice}
                      nombre="productoId"
                      titulo="Producto"
                      opciones={datos.productos.map((p) => ({
                        ...p,
                        nombre:
                          p.nombre +
                          ' · ' +
                          (datos.stock.find((s) => s.id === p.id)?.cantidad ?? 0) +
                          ' disponibles'
                      }))}
                      valores={linea}
                      cambiar={actualizar}
                    />
                    <Campo
                      id={'venta-cantidad-' + indice}
                      nombre="cantidad"
                      titulo="Cantidad de bolsas"
                      type="number"
                      min="1"
                      max="1000000"
                      step="1"
                      valores={linea}
                      cambiar={actualizar}
                    />
                  </div>
                  <p>
                    Precio unitario: <strong>{moneda(precio)}</strong>
                    {!precio && linea.productoId ? ' · Falta precio configurado.' : ''}
                  </p>
                  {valores.detalles.length > 1 && (
                    <button
                      type="button"
                      className="boton secundario"
                      onClick={() =>
                        setValores((v) => ({
                          ...v,
                          detalles: v.detalles.filter((_, i) => i !== indice)
                        }))
                      }
                    >
                      Quitar producto {indice + 1}
                    </button>
                  )}
                </fieldset>
              )
            })}
            <button
              type="button"
              className="boton secundario"
              disabled={valores.detalles.length >= 20}
              onClick={() =>
                setValores((v) => ({
                  ...v,
                  detalles: [...v.detalles, { productoId: '', cantidad: '1' }]
                }))
              }
            >
              Agregar producto
            </button>
            <Campo
              nombre="envio"
              titulo="Cargo de envío en ARS"
              type="number"
              min="0"
              step="0.01"
              valores={valores}
              cambiar={cambiar}
            />
            <PersonasVenta
              tarea="preparacion"
              titulo="Preparación o retiro"
              usuarios={datos.usuarios}
              valores={valores}
              cambiar={cambiar}
            />
            <PersonasVenta
              tarea="entrega"
              titulo="Entrega"
              usuarios={datos.usuarios}
              valores={valores}
              cambiar={cambiar}
            />
            <Campo
              nombre="responsableCobranzaId"
              titulo="Responsable de seguimiento del saldo"
              opciones={datos.usuarios}
              valores={valores}
              cambiar={cambiar}
            />
            <h3>Dinero recibido</h3>
            <p className="ayuda">
              Sin cobros, la venta queda fiada. Podés distribuir el importe recibido entre varias
              cuentas; el resto queda pendiente.
            </p>
            <PagosVenta
              pagos={valores.pagos}
              cambiarPagos={(pagos) => setValores((v) => ({ ...v, pagos }))}
              datos={datos}
            />
            {valores.pagos.length > 0 && (
              <Campo
                nombre="fechaCobro"
                titulo="Fecha y hora efectiva del cobro"
                type="datetime-local"
                max={ahoraArgentina()}
                valores={valores}
                cambiar={cambiar}
              />
            )}
            <section className="resumen-operacion" aria-label="Resumen antes de confirmar">
              <h3>Revisá antes de confirmar</h3>
              {resumen ? (
                <dl>
                  <dt>Total con envío</dt>
                  <dd>{moneda(resumen.total)}</dd>
                  <dt>Cobrado realmente</dt>
                  <dd>{moneda(resumen.cobrado)}</dd>
                  <dt>Saldo fiado</dt>
                  <dd>{moneda(resumen.saldo)}</dd>
                </dl>
              ) : (
                <p>Completá productos, cantidades y cobros válidos para calcular el resumen.</p>
              )}
              <p>
                La confirmación descuenta el hielo una sola vez. El saldo pendiente no se registra
                como entrada de dinero.
              </p>
            </section>
          </>
        )
      }}
    </FormularioComercial>
  )
}
