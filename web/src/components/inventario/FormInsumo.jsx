import FormularioOperacion, { Campo } from './FormularioOperacion'
import {
  accionesInsumo,
  decimalIngresado,
  existenciaDe,
  numeroStock,
  presentacionesDe
} from '../../inventario'

export default function FormInsumo({ accion, datos, registro, ...props }) {
  const presentaciones = presentacionesDe(datos.insumos)
  const opciones = presentaciones.map((p) => ({
    id: p.id,
    nombre: `${p.insumo.nombre} · ${p.nombre} (${numeroStock(p.factor)} ${p.insumo.unidad})`
  }))
  if (accion === 'crear' || accion === 'editar') {
    const editar = accion === 'editar'
    return (
      <FormularioOperacion
        {...props}
        operacion={false}
        titulo={editar ? 'Configurar insumo' : 'Nuevo insumo'}
        ruta={'insumos' + (editar ? '/' + registro.id : '')}
        metodo={editar ? 'PATCH' : 'POST'}
        inicial={
          editar
            ? { ...registro, stockMinimo: registro.stockMinimo }
            : { tipo: 'BOLSA', unidad: 'unidad', factor: '100', presentacion: 'Paquete' }
        }
        preparar={(v) =>
          editar
            ? {
                nombre: v.nombre.trim(),
                stockMinimo: decimalIngresado(v.stockMinimo),
                activo: v.activo === true || v.activo === 'true'
              }
            : {
                nombre: v.nombre.trim(),
                tipo: v.tipo,
                unidad: v.unidad.trim(),
                ...(v.tipo === 'BOLSA' ? { productoId: v.productoId } : {}),
                ...(v.stockMinimo !== undefined && v.stockMinimo !== ''
                  ? { stockMinimo: decimalIngresado(v.stockMinimo) }
                  : {}),
                presentacion: { nombre: v.presentacion.trim(), factor: decimalIngresado(v.factor) }
              }
        }
      >
        {({ valores, cambiar }) => (
          <>
            <div className="form-grid">
              <Campo
                nombre="nombre"
                titulo="Nombre del insumo"
                maxLength="100"
                valores={valores}
                cambiar={cambiar}
              />
              {editar ? (
                <Campo
                  nombre="activo"
                  titulo="Estado"
                  valores={valores}
                  cambiar={cambiar}
                  opciones={[
                    { id: 'true', nombre: 'Activo' },
                    { id: 'false', nombre: 'Inactivo' }
                  ]}
                />
              ) : (
                <Campo
                  nombre="tipo"
                  titulo="Tipo"
                  valores={valores}
                  cambiar={cambiar}
                  opciones={[
                    { id: 'BOLSA', nombre: 'Bolsa vacía' },
                    { id: 'OTRO', nombre: 'Otro insumo' }
                  ]}
                />
              )}
              {!editar && valores.tipo === 'BOLSA' && (
                <Campo
                  nombre="productoId"
                  titulo="Producto que envasa"
                  valores={valores}
                  cambiar={cambiar}
                  opciones={datos.productos.filter((p) => p.activo)}
                />
              )}
              {!editar && (
                <Campo
                  nombre="unidad"
                  titulo="Unidad de stock (unidad, kg, litro…)"
                  valores={valores}
                  cambiar={cambiar}
                  maxLength="30"
                />
              )}
              <Campo
                nombre="stockMinimo"
                titulo="Mínimo en depósito (unidades)"
                type="number"
                min="0"
                step="0.001"
                required={editar}
                valores={valores}
                cambiar={cambiar}
              />
              {!editar && (
                <>
                  <Campo
                    nombre="presentacion"
                    titulo="Presentación de compra"
                    valores={valores}
                    cambiar={cambiar}
                    maxLength="100"
                  />
                  <Campo
                    nombre="factor"
                    titulo="Unidades por presentación"
                    type="number"
                    min="0.001"
                    step="0.001"
                    valores={valores}
                    cambiar={cambiar}
                  />
                </>
              )}
            </div>
            <p className="ayuda">
              {editar
                ? 'El cambio de mínimo se aplica a la alerta de depósito. El historial se conserva al desactivar.'
                : 'Si dejás el mínimo vacío, las bolsas toman el umbral inicial según el peso; los demás insumos comienzan en 0.'}
            </p>
          </>
        )}
      </FormularioOperacion>
    )
  }
  if (accion === 'presentacion')
    return (
      <FormularioOperacion
        {...props}
        operacion={false}
        titulo="Agregar presentación"
        ruta={'insumos/' + registro.id + '/presentaciones'}
        inicial={{ nombre: '', factor: registro.tipo === 'BOLSA' ? '100' : '1' }}
        preparar={(v) => ({ nombre: v.nombre.trim(), factor: decimalIngresado(v.factor) })}
      >
        {({ valores, cambiar }) => (
          <>
            <p className="ayuda">
              {registro.nombre}. Una presentación nueva conserva el factor y costo de los paquetes
              anteriores.
            </p>
            <div className="form-grid">
              <Campo
                nombre="nombre"
                titulo="Nombre diferente de la presentación anterior"
                valores={valores}
                cambiar={cambiar}
                maxLength="100"
              />
              <Campo
                nombre="factor"
                titulo="Unidades por presentación"
                type="number"
                step="0.001"
                min="0.001"
                valores={valores}
                cambiar={cambiar}
              />
            </div>
          </>
        )}
      </FormularioOperacion>
    )
  const traslado = accion === 'traslado'
  return (
    <FormularioOperacion
      {...props}
      titulo={traslado ? 'Trasladar paquetes a producción' : 'Movimiento de insumos'}
      ruta={traslado ? 'traslados' : 'insumos/movimientos'}
      inicial={{ ubicacion: 'PRODUCCION', accion: 'CONSUMO' }}
      preparar={(v) =>
        traslado
          ? { presentacionId: v.presentacionId, paquetes: Number(v.paquetes) }
          : {
              presentacionId: v.presentacionId,
              ubicacion: v.ubicacion,
              accion: v.accion,
              cantidad: decimalIngresado(v.cantidad),
              ...(v.costoUnitario ? { costoUnitario: decimalIngresado(v.costoUnitario) } : {}),
              ...(v.corrigeOperacionId ? { corrigeOperacionId: v.corrigeOperacionId.trim() } : {})
            }
      }
    >
      {({ valores, cambiar }) => (
        <>
          <div className="form-grid">
            <Campo
              nombre="presentacionId"
              titulo="Insumo y presentación"
              valores={valores}
              cambiar={cambiar}
              opciones={opciones}
            />
            {traslado ? (
              <Campo
                nombre="paquetes"
                titulo="Paquetes completos que salen del depósito"
                type="number"
                min="1"
                max="1000000"
                step="1"
                valores={valores}
                cambiar={cambiar}
              />
            ) : (
              <>
                <Campo
                  nombre="ubicacion"
                  titulo="Ubicación"
                  valores={valores}
                  cambiar={cambiar}
                  opciones={[
                    { id: 'DEPOSITO', nombre: 'Depósito · paquetes cerrados' },
                    { id: 'PRODUCCION', nombre: 'Producción · unidades disponibles' }
                  ]}
                />
                <Campo
                  nombre="accion"
                  titulo="Tipo de movimiento"
                  valores={valores}
                  cambiar={cambiar}
                  opciones={Object.entries(accionesInsumo).map(([id, nombre]) => ({ id, nombre }))}
                />
                <Campo
                  nombre="cantidad"
                  titulo={
                    valores.accion === 'CONTEO'
                      ? 'Unidades contadas físicamente'
                      : valores.accion === 'AJUSTE'
                        ? 'Diferencia en unidades (+ / −)'
                        : 'Unidades que salen'
                  }
                  type="number"
                  step="0.001"
                  valores={valores}
                  cambiar={cambiar}
                />
                {['AJUSTE', 'CONTEO'].includes(valores.accion) && (
                  <>
                    <Campo
                      nombre="costoUnitario"
                      titulo="Costo unitario ARS (obligatorio si aumenta)"
                      type="number"
                      min="0"
                      step="0.000001"
                      required={false}
                      valores={valores}
                      cambiar={cambiar}
                    />
                    <Campo
                      nombre="corrigeOperacionId"
                      titulo="Operación original a corregir (opcional)"
                      required={false}
                      valores={valores}
                      cambiar={cambiar}
                    />
                  </>
                )}
              </>
            )}
          </div>
          {valores.presentacionId && (
            <p className="aviso">
              Disponible:{' '}
              {numeroStock(
                existenciaDe(
                  presentaciones.find((p) => p.id === valores.presentacionId),
                  traslado ? 'DEPOSITO' : valores.ubicacion
                )
              )}{' '}
              unidades.{' '}
              {traslado
                ? 'El traslado conserva el costo y todavía no consume bolsas.'
                : 'Depósito solo admite presentaciones completas. El conteo registra automáticamente la diferencia.'}
            </p>
          )}
        </>
      )}
    </FormularioOperacion>
  )
}
