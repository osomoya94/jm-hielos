// Los nombres y enums corresponden a los DTO actuales de NestJS.
export const tiposCuenta = {
  EFECTIVO: 'Efectivo',
  BANCO: 'Banco',
  BILLETERA: 'Billetera',
  INVERSION: 'Inversión'
}
export const gruposFlujo = {
  OPERACION: 'Operación',
  INVERSION_ACTIVOS: 'Inversión en activos',
  FINANCIACION: 'Financiación',
  APORTES: 'Aportes',
  RETIROS: 'Retiros',
  GARANTIAS: 'Garantías',
  OTROS: 'Otros'
}
export const catalogos = {
  productos: {
    nombre: 'Productos',
    singular: 'producto',
    ruta: '/productos',
    inactivos: 'inactivos',
    nuevo: 'Nuevo producto'
  },
  clientes: {
    nombre: 'Clientes',
    singular: 'cliente',
    ruta: '/clientes',
    inactivos: 'inactivos',
    nuevo: 'Nuevo cliente'
  },
  proveedores: {
    nombre: 'Proveedores',
    singular: 'proveedor',
    ruta: '/proveedores',
    inactivos: 'inactivos',
    nuevo: 'Nuevo proveedor'
  },
  cuentas: {
    nombre: 'Cuentas financieras',
    singular: 'cuenta',
    ruta: '/cuentas-financieras',
    inactivos: 'inactivas',
    nuevo: 'Nueva cuenta'
  },
  categorias: {
    nombre: 'Categorías',
    singular: 'categoría',
    ruta: '/categorias-flujo',
    inactivos: 'inactivas',
    nuevo: 'Nueva categoría'
  }
}

function errorCampo(campo, mensaje) {
  const error = new Error(mensaje)
  error.campo = campo
  throw error
}

function textoObligatorio(valores, campo, maximo, etiqueta) {
  const texto = String(valores[campo] ?? '').trim()
  if (!texto || texto.length > maximo)
    errorCampo(campo, etiqueta + ': completá el campo, hasta ' + maximo + ' caracteres.')
  return texto
}

function textoOpcional(valores, campo, maximo, etiqueta) {
  const texto = String(valores[campo] ?? '').trim()
  if (texto.length > maximo) errorCampo(campo, etiqueta + ': máximo ' + maximo + ' caracteres.')
  // null permite limpiar el valor en los PATCH de clientes y proveedores.
  return texto || null
}

export function prepararDatosCatalogo(tipo, valores, editando = false) {
  const nombre = textoObligatorio(valores, 'nombre', 100, 'Nombre')
  if (tipo === 'productos') {
    const pesoKg = Number(valores.pesoKg)
    if (!Number.isInteger(pesoKg) || pesoKg < 1 || pesoKg > 20)
      errorCampo('pesoKg', 'El peso debe ser un entero entre 1 y 20 kg.')
    return { nombre, pesoKg, unidad: textoObligatorio(valores, 'unidad', 30, 'Unidad') }
  }
  if (tipo === 'clientes' || tipo === 'proveedores') {
    const datos = {
      nombre,
      telefono: textoOpcional(valores, 'telefono', 30, 'Teléfono'),
      direccion: textoOpcional(valores, 'direccion', 150, 'Dirección'),
      observaciones: textoOpcional(valores, 'observaciones', 500, 'Observaciones')
    }
    if (tipo === 'clientes') {
      datos.tipoCliente = textoObligatorio(valores, 'tipoCliente', 50, 'Tipo de cliente')
      datos.referencia = textoOpcional(valores, 'referencia', 150, 'Referencia')
    } else {
      const cuit = String(valores.cuit ?? '').replace(/[-\s]/g, '')
      if (cuit && !/^\d{11}$/.test(cuit))
        errorCampo('cuit', 'El CUIT debe contener exactamente 11 dígitos.')
      datos.cuit = cuit || null
    }
    return datos
  }
  if (tipo === 'cuentas') {
    const titularInterno = textoObligatorio(valores, 'titularInterno', 100, 'Titular interno')
    // El DTO de edición solo admite nombre y titular.
    if (editando) return { nombre, titularInterno }
    if (!Object.hasOwn(tiposCuenta, valores.tipo))
      errorCampo('tipo', 'Seleccioná un tipo de cuenta válido.')
    const saldoInicial = String(valores.saldoInicial ?? '')
      .trim()
      .replace(',', '.')
    if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(saldoInicial))
      errorCampo('saldoInicial', 'Ingresá un saldo de apertura no negativo, hasta dos decimales.')
    const fecha = String(valores.fechaApertura ?? '')
    const instante = new Date(fecha + 'T00:00:00-03:00')
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
      !Number.isFinite(instante.getTime()) ||
      instante.toISOString().slice(0, 10) !== fecha
    ) {
      errorCampo('fechaApertura', 'Ingresá una fecha de apertura válida.')
    }
    return {
      nombre,
      titularInterno,
      tipo: valores.tipo,
      saldoInicial,
      fechaApertura: fecha + 'T00:00:00-03:00'
    }
  }
  if (tipo === 'categorias') {
    if (editando) return { nombre }
    if (!Object.hasOwn(gruposFlujo, valores.grupo))
      errorCampo('grupo', 'Seleccioná un grupo válido.')
    if (!['INGRESO', 'EGRESO'].includes(valores.sentido))
      errorCampo('sentido', 'Seleccioná ingreso o egreso.')
    return { nombre, grupo: valores.grupo, sentido: valores.sentido }
  }
  throw new Error('Catálogo no disponible.')
}

export function filtrarRegistros(registros, busqueda, estado = 'activos') {
  const texto = busqueda
    .trim()
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return registros.filter((registro) => {
    if (estado === 'activos' && !registro.activo) return false
    if (estado === 'inactivos' && registro.activo) return false
    const contenido = [
      registro.nombre,
      registro.telefono,
      registro.direccion,
      registro.cuit,
      registro.tipoCliente,
      registro.titularInterno
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('es-AR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    return contenido.includes(texto)
  })
}
