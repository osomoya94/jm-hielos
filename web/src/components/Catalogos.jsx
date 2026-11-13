import { useEffect, useRef, useState } from 'react'
import { consultarApi } from '../api'
import { catalogos, filtrarRegistros, gruposFlujo, tiposCuenta } from '../catalogos'
import { fechaArgentina, moneda } from '../formato'
import FormularioCatalogo from './FormularioCatalogo'
import Dialogo from './Dialogo'
import Icono from './Icono'

function Columnas({ vista }) {
  if (vista === 'productos')
    return (
      <>
        <th>Peso</th>
        <th>Unidad</th>
      </>
    )
  if (vista === 'clientes')
    return (
      <>
        <th>Tipo</th>
        <th>Contacto</th>
        <th>Dirección</th>
      </>
    )
  if (vista === 'proveedores')
    return (
      <>
        <th>CUIT</th>
        <th>Contacto</th>
        <th>Dirección</th>
      </>
    )
  if (vista === 'cuentas')
    return (
      <>
        <th>Tipo / titular</th>
        <th>Apertura</th>
        <th className="numero">Saldo de apertura</th>
      </>
    )
  return (
    <>
      <th>Grupo</th>
      <th>Sentido</th>
    </>
  )
}

function Celdas({ vista, dato }) {
  if (vista === 'productos')
    return (
      <>
        <td>{dato.pesoKg} kg</td>
        <td>{dato.unidad}</td>
      </>
    )
  if (vista === 'clientes' || vista === 'proveedores')
    return (
      <>
        <td>{vista === 'clientes' ? dato.tipoCliente : dato.cuit || '—'}</td>
        <td>{dato.telefono || '—'}</td>
        <td>
          {dato.direccion || '—'}
          {vista === 'clientes' && dato.referencia && (
            <small className="id-registro">{dato.referencia}</small>
          )}
        </td>
      </>
    )
  if (vista === 'cuentas')
    return (
      <>
        <td>
          {tiposCuenta[dato.tipo]}
          <small className="id-registro">{dato.titularInterno}</small>
        </td>
        <td className="fecha-celda">{fechaArgentina(dato.fechaApertura)}</td>
        <td className="numero">{moneda(dato.saldoInicial)}</td>
      </>
    )
  return (
    <>
      <td>{gruposFlujo[dato.grupo]}</td>
      <td>
        <span className={'badge ' + (dato.sentido === 'INGRESO' ? 'positivo' : 'negativo')}>
          {dato.sentido === 'INGRESO' ? 'Ingreso' : 'Egreso'}
        </span>
      </td>
    </>
  )
}

export default function Catalogos({ vista, sesion, onExpired, onActualizado }) {
  const info = catalogos[vista]
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [revision, setRevision] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('activos')
  const [editor, setEditor] = useState(null)
  const [cambioEstado, setCambioEstado] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorEstado, setErrorEstado] = useState('')
  const enviando = useRef(false)
  const esAdmin = sesion.rol === 'ADMIN'

  useEffect(() => {
    let vigente = true
    Promise.all([
      consultarApi(info.ruta, sesion.token),
      consultarApi(info.ruta + '/' + info.inactivos, sesion.token)
    ])
      .then(([activos, inactivos]) => {
        if (!vigente) return
        setRegistros([...activos, ...inactivos])
        setCargando(false)
      })
      .catch((fallo) => {
        if (!vigente) return
        if (fallo.status === 401) onExpired()
        else {
          setError(fallo.message)
          setCargando(false)
        }
      })
    return () => {
      vigente = false
    }
  }, [info.ruta, info.inactivos, sesion.token, onExpired, revision])

  function actualizarRegistro(registro, texto) {
    // Se usa la respuesta de la API, sin adivinar el resultado de la escritura.
    setRegistros((anteriores) => {
      const existe = anteriores.some((dato) => dato.id === registro.id)
      return existe
        ? anteriores.map((dato) => (dato.id === registro.id ? registro : dato))
        : [...anteriores, registro]
    })
    setMensaje(texto)
    setEditor(null)
    setCambioEstado(null)
    onActualizado()
  }

  async function confirmarEstado() {
    if (enviando.current) return
    enviando.current = true
    setGuardando(true)
    setErrorEstado('')
    try {
      const respuesta = await consultarApi(
        info.ruta + '/' + cambioEstado.id + '/estado',
        sesion.token,
        {
          method: 'PATCH',
          data: { activo: !cambioEstado.activo }
        }
      )
      actualizarRegistro(
        respuesta,
        cambioEstado.activo
          ? 'Registro desactivado. Se conserva su historial.'
          : 'Registro activado.'
      )
    } catch (fallo) {
      if (fallo.status === 401) onExpired()
      else setErrorEstado(fallo.message)
    } finally {
      enviando.current = false
      setGuardando(false)
    }
  }

  const visibles = filtrarRegistros(registros, busqueda, estado).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es-AR')
  )
  const activos = registros.filter((dato) => dato.activo).length

  return (
    <div className="catalogos">
      <div className="catalogo-resumen">
        <span>
          <strong>{activos}</strong> activos <span className="separador-texto">/</span>{' '}
          <strong>{registros.length - activos}</strong> inactivos
        </span>
        <div className="catalogo-acciones">
          <button
            className="boton secundario"
            disabled={cargando}
            onClick={() => {
              setCargando(true)
              setError('')
              setRevision(revision + 1)
            }}
          >
            <Icono nombre="actualizar" />
            <span>Actualizar</span>
          </button>
          {esAdmin && (
            <button
              className="boton primario"
              onClick={() => {
                setMensaje('')
                setEditor({ registro: null })
              }}
            >
              <Icono nombre="nuevo" />
              {info.nuevo}
            </button>
          )}
        </div>
      </div>
      {mensaje && (
        <p className="mensaje exito" role="status">
          <Icono nombre="check" />
          {mensaje}
        </p>
      )}
      {error && (
        <p className="mensaje error" role="alert">
          {error}
        </p>
      )}
      <section className="panel">
        <div className="catalogo-filtros">
          <div className="campo-busqueda">
            <label htmlFor="buscar-catalogo" className="sr-only">
              Buscar en {info.nombre.toLowerCase()}
            </label>
            <Icono nombre="buscar" />
            <input
              id="buscar-catalogo"
              type="search"
              placeholder={
                vista === 'clientes'
                  ? 'Buscar por nombre, teléfono o dirección…'
                  : 'Buscar en ' + info.nombre.toLowerCase() + '…'
              }
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
            />
          </div>
          <div className="estado-filtro">
            <label htmlFor="estado-catalogo">Estado</label>
            <select
              id="estado-catalogo"
              value={estado}
              onChange={(evento) => setEstado(evento.target.value)}
            >
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
              <option value="todos">Todos</option>
            </select>
          </div>
        </div>
        {cargando ? (
          <p className="estado-carga" role="status">
            Cargando {info.nombre.toLowerCase()}…
          </p>
        ) : error ? (
          <div className="vacio">
            <h3>No se pudo cargar el listado</h3>
            <p>Usá Actualizar para volver a consultar la API.</p>
          </div>
        ) : visibles.length === 0 ? (
          <div className="vacio">
            <span className="vacio-icono">
              <Icono nombre={vista} />
            </span>
            <h3>
              {registros.length ? 'No se encontraron resultados' : 'Todavía no hay registros'}
            </h3>
            <p>
              {registros.length
                ? 'Probá otra búsqueda o cambiá el filtro de estado.'
                : esAdmin
                  ? 'Creá el primer registro con el botón superior.'
                  : 'Los registros aparecerán cuando un administrador los cargue.'}
            </p>
          </div>
        ) : (
          <div className="tabla-scroll" role="region" aria-label={info.nombre} tabIndex="0">
            <table>
              <caption className="sr-only">
                {info.nombre}, filtro de estado: {estado}
              </caption>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <Columnas vista={vista} />
                  <th>Estado</th>
                  <th>{esAdmin ? 'Acciones' : 'Información'}</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((dato) => (
                  <tr key={dato.id}>
                    <td>
                      <strong>{dato.nombre}</strong>
                      {dato.observaciones && (
                        <small className="id-registro observaciones">{dato.observaciones}</small>
                      )}
                    </td>
                    <Celdas vista={vista} dato={dato} />
                    <td>
                      <span className={'badge ' + (dato.activo ? 'neutral' : 'inactivo')}>
                        {dato.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="acciones-fila">
                        {esAdmin ? (
                          <>
                            {dato.activo && (
                              <button
                                className="boton-tabla"
                                aria-label={'Editar ' + dato.nombre}
                                onClick={() => {
                                  setMensaje('')
                                  setEditor({ registro: dato })
                                }}
                              >
                                <Icono nombre="editar" width="16" height="16" />
                                Editar
                              </button>
                            )}
                            <button
                              className={'boton-tabla ' + (dato.activo ? 'accion-desactivar' : '')}
                              aria-label={(dato.activo ? 'Desactivar ' : 'Activar ') + dato.nombre}
                              onClick={() => {
                                setErrorEstado('')
                                setCambioEstado(dato)
                              }}
                            >
                              {dato.activo ? 'Desactivar' : 'Activar'}
                            </button>
                          </>
                        ) : (
                          <span className="muted">Solo consulta</span>
                        )}
                      </div>
                      <details className="identificador">
                        <summary>Identificador</summary>
                        <small>{dato.id}</small>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!cargando && !error && (
          <p className="nota-tabla">
            {visibles.length} de {registros.length} registros
            {vista === 'cuentas'
              ? ' · El saldo de apertura no es el saldo actual. Consultá el saldo de libro en Cash Flow.'
              : ' · Los registros inactivos conservan su historial.'}
          </p>
        )}
      </section>
      {editor && (
        <FormularioCatalogo
          vista={vista}
          registro={editor.registro}
          sesion={sesion}
          onExpired={onExpired}
          onClose={() => setEditor(null)}
          onSaved={(registro, texto) => {
            if (!editor.registro) {
              setEstado('activos')
              setBusqueda('')
            }
            actualizarRegistro(registro, texto)
          }}
        />
      )}
      {cambioEstado && (
        <Dialogo
          titulo={(cambioEstado.activo ? 'Desactivar ' : 'Activar ') + info.singular}
          onClose={() => setCambioEstado(null)}
          ocupado={guardando}
        >
          <div className="confirmacion-estado">
            <p>
              ¿Querés {cambioEstado.activo ? 'desactivar' : 'activar'}{' '}
              <strong>{cambioEstado.nombre}</strong>?
            </p>
            <p className="muted">
              {cambioEstado.activo
                ? 'El registro dejará de estar disponible para nuevas operaciones. Su historial se conserva.'
                : 'El registro volverá a estar disponible para nuevas operaciones.'}
            </p>
            {errorEstado && (
              <p className="mensaje error" role="alert">
                {errorEstado}
              </p>
            )}
            <div className="dialogo-acciones">
              <button
                className="boton secundario"
                onClick={() => setCambioEstado(null)}
                disabled={guardando}
              >
                Cancelar
              </button>
              <button className="boton primario" onClick={confirmarEstado} disabled={guardando}>
                {guardando ? 'Guardando…' : cambioEstado.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        </Dialogo>
      )}
    </div>
  )
}
