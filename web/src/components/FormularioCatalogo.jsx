import { useRef, useState } from 'react'
import { consultarApi } from '../api'
import { catalogos, gruposFlujo, tiposCuenta, prepararDatosCatalogo } from '../catalogos'
import Dialogo from './Dialogo'

function Campo({ nombre, etiqueta, ayuda, children, ...props }) {
  const id = 'catalogo-' + nombre
  return (
    <div className="campo">
      <label htmlFor={id}>
        {etiqueta}
        {props.required && (
          <span className="requerido" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children ? (
        <select
          id={id}
          name={nombre}
          aria-describedby={ayuda ? id + '-ayuda' : undefined}
          {...props}
        >
          {children}
        </select>
      ) : (
        <input
          id={id}
          name={nombre}
          aria-describedby={ayuda ? id + '-ayuda' : undefined}
          {...props}
        />
      )}
      {ayuda && (
        <small id={id + '-ayuda'} className="muted">
          {ayuda}
        </small>
      )}
    </div>
  )
}

export default function FormularioCatalogo({
  vista,
  registro,
  sesion,
  onExpired,
  onClose,
  onSaved
}) {
  const info = catalogos[vista]
  const editando = Boolean(registro)
  const valores = registro || {}
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const formulario = useRef(null)
  const enviando = useRef(false)

  async function guardar(evento) {
    evento.preventDefault()
    if (enviando.current) return
    setError('')
    let datos
    try {
      datos = prepararDatosCatalogo(
        vista,
        Object.fromEntries(new FormData(evento.currentTarget)),
        editando
      )
    } catch (fallo) {
      setError(fallo.message)
      formulario.current.elements.namedItem(fallo.campo)?.focus()
      return
    }
    enviando.current = true
    setGuardando(true)
    try {
      const respuesta = await consultarApi(
        info.ruta + (editando ? '/' + registro.id : ''),
        sesion.token,
        {
          method: editando ? 'PATCH' : 'POST',
          data: datos
        }
      )
      onSaved(respuesta, editando ? 'Cambios guardados.' : 'Registro creado.')
    } catch (fallo) {
      if (fallo.status === 401) onExpired()
      else setError(fallo.message)
    } finally {
      enviando.current = false
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      titulo={editando ? 'Editar ' + info.singular : info.nuevo}
      ocupado={guardando}
      onClose={onClose}
    >
      <form ref={formulario} className="formulario-catalogo" onSubmit={guardar}>
        <p className="muted ayuda-formulario">Los campos con * son obligatorios.</p>
        {error && (
          <p className="mensaje error" role="alert">
            {error}
          </p>
        )}
        <fieldset disabled={guardando}>
          <Campo
            nombre="nombre"
            etiqueta="Nombre"
            defaultValue={valores.nombre || ''}
            maxLength={100}
            required
            autoFocus
          />
          {vista === 'productos' && (
            <div className="form-grid">
              <Campo
                nombre="pesoKg"
                etiqueta="Peso en kg"
                type="number"
                min={1}
                max={20}
                step={1}
                defaultValue={valores.pesoKg || ''}
                required
                ayuda="Número entero, entre 1 y 20 kg."
              />
              <Campo
                nombre="unidad"
                etiqueta="Unidad"
                defaultValue={valores.unidad || ''}
                maxLength={30}
                placeholder="Ej.: bolsa"
                required
              />
            </div>
          )}
          {(vista === 'clientes' || vista === 'proveedores') && (
            <>
              <div className="form-grid">
                {vista === 'clientes' ? (
                  <Campo
                    nombre="tipoCliente"
                    etiqueta="Tipo de cliente"
                    defaultValue={valores.tipoCliente || ''}
                    maxLength={50}
                    placeholder="Ej.: habitual"
                    required
                    ayuda="Clasificación comercial, sin opciones predefinidas."
                  />
                ) : (
                  <Campo
                    nombre="cuit"
                    etiqueta="CUIT"
                    inputMode="numeric"
                    maxLength={15}
                    defaultValue={valores.cuit || ''}
                    ayuda="Opcional. 11 dígitos; admite guiones."
                  />
                )}
                <Campo
                  nombre="telefono"
                  etiqueta="Teléfono"
                  type="tel"
                  maxLength={30}
                  defaultValue={valores.telefono || ''}
                />
              </div>
              <Campo
                nombre="direccion"
                etiqueta="Dirección"
                maxLength={150}
                defaultValue={valores.direccion || ''}
              />
              {vista === 'clientes' && (
                <Campo
                  nombre="referencia"
                  etiqueta="Referencia de ubicación"
                  maxLength={150}
                  defaultValue={valores.referencia || ''}
                />
              )}
              <div className="campo">
                <label htmlFor="catalogo-observaciones">Observaciones</label>
                <textarea
                  id="catalogo-observaciones"
                  name="observaciones"
                  rows="3"
                  maxLength={500}
                  defaultValue={valores.observaciones || ''}
                />
              </div>
            </>
          )}
          {vista === 'cuentas' && (
            <>
              <Campo
                nombre="titularInterno"
                etiqueta="Titular interno"
                maxLength={100}
                defaultValue={valores.titularInterno || ''}
                required
              />
              {!editando ? (
                <>
                  <Campo nombre="tipo" etiqueta="Tipo de cuenta" defaultValue="" required>
                    <option value="">Seleccionar tipo</option>
                    {Object.entries(tiposCuenta).map(([valor, etiqueta]) => (
                      <option key={valor} value={valor}>
                        {etiqueta}
                      </option>
                    ))}
                  </Campo>
                  <div className="form-grid">
                    <Campo
                      nombre="saldoInicial"
                      etiqueta="Saldo de apertura en ARS"
                      inputMode="decimal"
                      maxLength={19}
                      placeholder="0,00"
                      required
                      ayuda="Saldo real, no negativo. No se cuenta como ingreso."
                    />
                    <Campo
                      nombre="fechaApertura"
                      etiqueta="Fecha de apertura"
                      type="date"
                      required
                      ayuda="Se registra a las 00:00 de Argentina."
                    />
                  </div>
                  <p className="aviso">
                    Usá la misma fecha de apertura para las cuentas iniciales del negocio.
                  </p>
                </>
              ) : (
                <p className="aviso">
                  Solo se modifican el nombre y el titular. El saldo de apertura y el tipo se
                  conservan.
                </p>
              )}
            </>
          )}
          {vista === 'categorias' &&
            (!editando ? (
              <div className="form-grid">
                <Campo nombre="grupo" etiqueta="Grupo" defaultValue="" required>
                  <option value="">Seleccionar grupo</option>
                  {Object.entries(gruposFlujo).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ))}
                </Campo>
                <Campo nombre="sentido" etiqueta="Sentido" defaultValue="" required>
                  <option value="">Seleccionar sentido</option>
                  <option value="INGRESO">Ingreso</option>
                  <option value="EGRESO">Egreso</option>
                </Campo>
              </div>
            ) : (
              <p className="aviso">
                El grupo y el sentido se conservan. La API impide renombrar categorías que ya tienen
                movimientos.
              </p>
            ))}
        </fieldset>
        <div className="dialogo-acciones">
          <button type="button" className="boton secundario" onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button className="boton primario" disabled={guardando}>
            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear ' + info.singular}
          </button>
        </div>
      </form>
    </Dialogo>
  )
}
