import FormularioOperacion, { Campo } from './FormularioOperacion'
import { accionesStock } from '../../inventario'

export default function FormStock({ datos, sesion, ...props }) {
  const acciones = Object.entries(accionesStock)
    .filter(([id]) => sesion.rol === 'ADMIN' || ['OBSEQUIO', 'CONSUMO_INTERNO'].includes(id))
    .map(([id, nombre]) => ({ id, nombre }))
  return (
    <FormularioOperacion
      {...props}
      sesion={sesion}
      titulo="Movimiento de stock terminado"
      ruta="stock/movimientos"
      inicial={{ accion: acciones[0].id }}
      preparar={(v) => ({
        productoId: v.productoId,
        accion: v.accion,
        cantidad: Number(v.cantidad),
        ...(['OBSEQUIO', 'CONSUMO_INTERNO'].includes(v.accion)
          ? {
              responsableId: v.responsableId,
              ayudantesIds: [v.ayudante1, v.ayudante2].filter(Boolean)
            }
          : {}),
        ...(v.corrigeOperacionId ? { corrigeOperacionId: v.corrigeOperacionId.trim() } : {})
      })}
    >
      {({ valores, cambiar }) => (
        <>
          <div className="form-grid">
            <Campo
              nombre="productoId"
              titulo="Producto"
              opciones={datos.stock
                .filter((p) => p.activo)
                .map((p) => ({ id: p.id, nombre: p.nombre + ' · ' + p.cantidad + ' disponibles' }))}
              valores={valores}
              cambiar={cambiar}
            />
            <Campo
              nombre="accion"
              titulo="Tipo de movimiento"
              opciones={acciones}
              valores={valores}
              cambiar={cambiar}
            />
            <Campo
              nombre="cantidad"
              titulo={
                valores.accion === 'CONTEO'
                  ? 'Bolsas contadas físicamente'
                  : valores.accion === 'AJUSTE'
                    ? 'Diferencia en bolsas (+ / −)'
                    : 'Cantidad de bolsas'
              }
              type="number"
              min={
                valores.accion === 'AJUSTE' ? '-1000000' : valores.accion === 'CONTEO' ? '0' : '1'
              }
              max="1000000"
              step="1"
              valores={valores}
              cambiar={cambiar}
            />
            {['OBSEQUIO', 'CONSUMO_INTERNO'].includes(valores.accion) && (
              <>
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
                  opciones={datos.usuarios}
                  required={false}
                  valores={valores}
                  cambiar={cambiar}
                />
                <Campo
                  nombre="ayudante2"
                  titulo="Ayudante 2 (opcional)"
                  opciones={datos.usuarios}
                  required={false}
                  valores={valores}
                  cambiar={cambiar}
                />
              </>
            )}
            {valores.accion === 'AJUSTE' && (
              <Campo
                nombre="corrigeOperacionId"
                titulo="Operación original a corregir (opcional)"
                required={false}
                valores={valores}
                cambiar={cambiar}
              />
            )}
          </div>
          <p className="ayuda">
            {valores.accion === 'CONTEO'
              ? 'Se conserva el stock teórico anterior y se registra su diferencia con el conteo.'
              : valores.accion === 'DEVOLUCION'
                ? 'Ingresá solamente las bolsas devueltas que estén aptas para volver al stock.'
                : 'El movimiento quedará registrado con fecha, usuario y motivo. No se permiten existencias negativas.'}
          </p>
        </>
      )}
    </FormularioOperacion>
  )
}
