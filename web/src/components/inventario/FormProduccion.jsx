import FormularioOperacion, { Campo } from './FormularioOperacion'
import { decimalIngresado, existenciaDe, numeroStock, presentacionesDe } from '../../inventario'

export default function FormProduccion({ datos, ...props }) {
  const presentaciones = presentacionesDe(datos.insumos)
  const otros = presentaciones
    .filter((p) => p.insumo.tipo === 'OTRO')
    .map((p) => ({ id: p.id, nombre: p.insumo.nombre + ' · ' + p.nombre }))
  return (
    <FormularioOperacion
      {...props}
      titulo="Registrar lote de producción"
      ruta="produccion"
      inicial={{ bolsasRotas: '0', hieloDescartadoKg: '0', otrosConsumos: [] }}
      preparar={(v) => ({
        codigo: v.codigo.trim(),
        productoId: v.productoId,
        presentacionBolsaId: v.presentacionBolsaId,
        responsableId: v.responsableId,
        ayudantesIds: [v.ayudante1, v.ayudante2].filter(Boolean),
        bolsasUsadas: Number(v.bolsasUsadas),
        bolsasRotas: Number(v.bolsasRotas),
        cantidadApta: Number(v.cantidadApta),
        ...(v.cantidadEsperada ? { cantidadEsperada: Number(v.cantidadEsperada) } : {}),
        hieloDescartadoKg: decimalIngresado(v.hieloDescartadoKg),
        otrosConsumos: v.otrosConsumos.map((c) => ({
          presentacionId: c.presentacionId,
          cantidad: decimalIngresado(c.cantidad)
        }))
      })}
    >
      {({ valores, cambiar, setValores }) => {
        const bolsas = presentaciones.filter(
          (p) => p.insumo.tipo === 'BOLSA' && p.insumo.productoId === valores.productoId
        )
        const elegida = bolsas.find((p) => p.id === valores.presentacionBolsaId)
        const sobrantes =
          Number(existenciaDe(elegida, 'PRODUCCION')) -
          Number(valores.bolsasUsadas || 0) -
          Number(valores.bolsasRotas || 0)
        return (
          <>
            <div className="form-grid">
              <Campo
                nombre="codigo"
                titulo="Código único del lote"
                maxLength="100"
                valores={valores}
                cambiar={cambiar}
              />
              <Campo
                nombre="productoId"
                titulo="Producto"
                opciones={datos.productos.filter((p) => p.activo)}
                valores={valores}
                cambiar={(e) =>
                  setValores((v) => ({ ...v, productoId: e.target.value, presentacionBolsaId: '' }))
                }
              />
              <Campo
                nombre="presentacionBolsaId"
                titulo="Bolsas disponibles en producción"
                opciones={bolsas.map((p) => ({
                  id: p.id,
                  nombre:
                    p.nombre + ' · ' + numeroStock(existenciaDe(p, 'PRODUCCION')) + ' disponibles'
                }))}
                valores={valores}
                cambiar={cambiar}
              />
              <Campo
                nombre="responsableId"
                titulo="Responsable principal"
                opciones={datos.usuarios}
                valores={valores}
                cambiar={cambiar}
              />
              <Campo
                nombre="ayudante1"
                titulo="Ayudante 1 (opcional)"
                required={false}
                opciones={datos.usuarios}
                valores={valores}
                cambiar={cambiar}
              />
              <Campo
                nombre="ayudante2"
                titulo="Ayudante 2 (opcional)"
                required={false}
                opciones={datos.usuarios}
                valores={valores}
                cambiar={cambiar}
              />
            </div>
            <div className="inventario-subtitulo">
              <h3>Resultado real del lote</h3>
              <p className="muted">Las unidades aptas son las que ingresan al stock terminado.</p>
            </div>
            <div className="form-grid">
              <Campo
                nombre="cantidadEsperada"
                titulo="Bolsas esperadas (opcional)"
                type="number"
                min="0"
                max="1000000"
                step="1"
                required={false}
                valores={valores}
                cambiar={cambiar}
              />
              <Campo
                nombre="cantidadApta"
                titulo="Bolsas terminadas aptas"
                type="number"
                min="0"
                max="1000000"
                step="1"
                valores={valores}
                cambiar={cambiar}
              />
              <Campo
                nombre="bolsasUsadas"
                titulo="Bolsas vacías usadas"
                type="number"
                min="0"
                max="1000000"
                step="1"
                valores={valores}
                cambiar={cambiar}
              />
              <Campo
                nombre="bolsasRotas"
                titulo="Bolsas vacías rotas"
                type="number"
                min="0"
                max="1000000"
                step="1"
                valores={valores}
                cambiar={cambiar}
              />
              <Campo
                nombre="hieloDescartadoKg"
                titulo="Hielo descartado (kg)"
                type="number"
                min="0"
                step="0.001"
                valores={valores}
                cambiar={cambiar}
              />
            </div>
            {elegida && (
              <p className={sobrantes < 0 ? 'mensaje error' : 'aviso'} role="status">
                Bolsas vacías que quedarían disponibles: <strong>{numeroStock(sobrantes)}</strong>.
                La disponibilidad se confirma al guardar.
              </p>
            )}
            {valores.otrosConsumos.map((c, indice) => (
              <fieldset className="inventario-linea" key={indice}>
                <legend>Otro insumo {indice + 1}</legend>
                <div className="form-grid">
                  <Campo
                    nombre="presentacionId"
                    titulo="Insumo"
                    id={'lote-insumo-' + indice}
                    opciones={otros}
                    valores={c}
                    cambiar={(e) =>
                      setValores((v) => ({
                        ...v,
                        otrosConsumos: v.otrosConsumos.map((item, i) =>
                          i === indice ? { ...item, presentacionId: e.target.value } : item
                        )
                      }))
                    }
                  />
                  <Campo
                    nombre="cantidad"
                    titulo="Unidades consumidas"
                    id={'lote-cantidad-' + indice}
                    type="number"
                    min="0.001"
                    step="0.001"
                    valores={c}
                    cambiar={(e) =>
                      setValores((v) => ({
                        ...v,
                        otrosConsumos: v.otrosConsumos.map((item, i) =>
                          i === indice ? { ...item, cantidad: e.target.value } : item
                        )
                      }))
                    }
                  />
                </div>
                <button
                  type="button"
                  className="boton secundario"
                  onClick={() =>
                    setValores((v) => ({
                      ...v,
                      otrosConsumos: v.otrosConsumos.filter((_, i) => i !== indice)
                    }))
                  }
                >
                  Quitar insumo {indice + 1}
                </button>
              </fieldset>
            ))}
            {otros.length > 0 && (
              <button
                className="boton secundario"
                type="button"
                disabled={valores.otrosConsumos.length >= 30}
                onClick={() =>
                  setValores((v) => ({
                    ...v,
                    otrosConsumos: [...v.otrosConsumos, { presentacionId: '', cantidad: '' }]
                  }))
                }
              >
                Agregar otro insumo consumido
              </button>
            )}
            <p className="ayuda">
              Si faltan bolsas abiertas, registrá primero un traslado desde Insumos. Los sobrantes
              se conservan para el próximo lote.
            </p>
          </>
        )
      }}
    </FormularioOperacion>
  )
}
