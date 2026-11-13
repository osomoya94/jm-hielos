export const numeroStock = (valor) =>
  Number(valor ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 3 })
export const fechaOperacion = (valor) => valor + (valor.length === 16 ? ':00' : '') + '-03:00'
export const decimalIngresado = (valor) => String(valor).trim().replace(',', '.')

export function saldoCompra(compra) {
  const centavos = (valor) => {
    const [entero, fraccion = ''] = String(valor).split('.')
    return BigInt(entero) * 100n + BigInt(fraccion.padEnd(2, '0'))
  }
  const saldo = centavos(compra.total) - centavos(compra.pagado)
  return `${saldo / 100n}.${String(saldo % 100n).padStart(2, '0')}`
}

export function costoInsumo(valor) {
  const [entero, fraccion = ''] = String(valor).split('.')
  const decimales = fraccion.replace(/0+$/, '').padEnd(2, '0')
  return '$ ' + BigInt(entero).toLocaleString('es-AR') + ',' + decimales
}

export function presentacionesDe(insumos) {
  return insumos
    .filter((i) => i.activo)
    .flatMap((i) => i.presentaciones.filter((p) => p.activo).map((p) => ({ ...p, insumo: i })))
}

export function existenciaDe(presentacion, ubicacion) {
  return presentacion?.existencias.find((e) => e.ubicacion === ubicacion)?.unidades ?? '0'
}

export const accionesStock = {
  PERDIDA: 'Pérdida',
  DEVOLUCION: 'Devolución apta',
  OBSEQUIO: 'Obsequio',
  CONSUMO_INTERNO: 'Consumo interno',
  AJUSTE: 'Ajuste justificado',
  CONTEO: 'Conteo físico'
}
export const accionesInsumo = {
  CONSUMO: 'Consumo',
  PERDIDA: 'Pérdida',
  DEVOLUCION_PROVEEDOR: 'Devolución al proveedor',
  AJUSTE: 'Ajuste justificado',
  CONTEO: 'Conteo físico'
}
