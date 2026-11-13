import { Campo } from '../inventario/FormularioOperacion'
import FormularioComercial from './FormularioComercial'
import { decimalIngresado } from '../../inventario'
import { tiposLista } from '../../comercial'

export default function FormPrecio({ accion, datos, registro, ...props }) {
  const rutas = {
    lista: '/precios',
    editarLista: '/precios/' + registro?.id + '/configuracion',
    inicializar: '/precios/inicializar',
    precio: (v) => '/precios/' + v.listaId + '/productos',
    condicion: (v) => '/precios/clientes/' + v.clienteId + '/condicion',
    particular: (v) => '/precios/clientes/' + v.clienteId + '/particulares'
  }
  const titulos = {
    lista: 'Nueva lista de precios',
    editarLista: 'Editar lista de precios',
    precio: 'Configurar precio por producto',
    condicion: 'Asignar lista al cliente',
    particular: 'Precio particular del cliente',
    inicializar: 'Preparar catálogo comercial inicial'
  }
  return (
    <FormularioComercial
      {...props}
      titulo={titulos[accion]}
      ruta={rutas[accion]}
      idempotente={false}
      inicial={{
        consumidorFinal: 'false',
        activo: String(registro?.activo ?? true),
        nombre: registro?.nombre ?? ''
      }}
      preparar={(v) => {
        if (accion === 'inicializar') return {}
        if (accion === 'lista') return { nombre: v.nombre.trim(), tipo: v.tipo }
        if (accion === 'editarLista')
          return { nombre: v.nombre.trim(), activo: v.activo === 'true' }
        if (accion === 'condicion')
          return { listaId: v.listaId, consumidorFinal: v.consumidorFinal === 'true' }
        return {
          productoId: v.productoId,
          precio: decimalIngresado(v.precio),
          ...(accion === 'particular' ? { activo: v.activo === 'true' } : {})
        }
      }}
    >
      {({ valores, cambiar }) => (
        <>
          {accion === 'inicializar' ? (
            <p className="aviso">
              Se agregarán los tamaños de 1, 3, 5 y 10 kg que falten, las modalidades de listas que
              falten y un cliente Consumidor final. Los registros existentes se conservan. Los
              precios quedan sin configurar hasta que ingreses sus valores reales.
            </p>
          ) : (
            <div className="form-grid">
              {['lista', 'editarLista'].includes(accion) && (
                <>
                  <Campo
                    nombre="nombre"
                    titulo="Nombre"
                    maxLength="100"
                    valores={valores}
                    cambiar={cambiar}
                  />
                  {accion === 'lista' ? (
                    <Campo
                      nombre="tipo"
                      titulo="Modalidad"
                      opciones={Object.entries(tiposLista).map(([id, nombre]) => ({ id, nombre }))}
                      valores={valores}
                      cambiar={cambiar}
                    />
                  ) : (
                    <Campo
                      nombre="activo"
                      titulo="Estado"
                      opciones={[
                        { id: 'true', nombre: 'Activa para nuevas ventas' },
                        { id: 'false', nombre: 'Inactiva, conservar historial' }
                      ]}
                      valores={valores}
                      cambiar={cambiar}
                    />
                  )}
                </>
              )}
              {['condicion', 'particular'].includes(accion) && (
                <Campo
                  nombre="clienteId"
                  titulo="Cliente"
                  opciones={datos.clientes}
                  valores={valores}
                  cambiar={cambiar}
                />
              )}
              {['condicion', 'precio'].includes(accion) && (
                <Campo
                  nombre="listaId"
                  titulo="Lista"
                  opciones={datos.listas.filter((l) => l.activo)}
                  valores={valores}
                  cambiar={cambiar}
                />
              )}
              {['particular', 'precio'].includes(accion) && (
                <>
                  <Campo
                    nombre="productoId"
                    titulo="Producto"
                    opciones={datos.productos}
                    valores={valores}
                    cambiar={cambiar}
                  />
                  <Campo
                    nombre="precio"
                    titulo="Precio unitario en ARS"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max="999999999999.99"
                    valores={valores}
                    cambiar={cambiar}
                  />
                </>
              )}
              {accion === 'condicion' && (
                <Campo
                  nombre="consumidorFinal"
                  titulo="Cliente genérico de ventas en casa"
                  opciones={[
                    { id: 'false', nombre: 'Cliente habitual' },
                    { id: 'true', nombre: 'Consumidor final (requiere minorista)' }
                  ]}
                  valores={valores}
                  cambiar={cambiar}
                />
              )}
              {accion === 'particular' && (
                <Campo
                  nombre="activo"
                  titulo="Estado del acuerdo particular"
                  opciones={[
                    { id: 'true', nombre: 'Aplicar precio particular' },
                    { id: 'false', nombre: 'Volver al precio de lista' }
                  ]}
                  valores={valores}
                  cambiar={cambiar}
                />
              )}
            </div>
          )}
          <p className="ayuda">
            Los cambios conservan usuario y motivo. Las ventas anteriores mantienen sus precios
            históricos.
          </p>
        </>
      )}
    </FormularioComercial>
  )
}
