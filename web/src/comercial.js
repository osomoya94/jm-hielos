export const tiposLista = {
  MINORISTA: 'Minorista',
  MAYORISTA: 'Mayorista habitual',
  ESPECIAL: 'Especial',
  EVENTOS: 'Eventos'
}
export function antiguedadComercial(fechaVenta, fechaCorte = new Date()) {
  const formato = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Argentina/Catamarca',
    dateStyle: 'short'
  })
  const inicio = Date.parse(formato.format(new Date(fechaVenta)) + 'T00:00:00Z')
  const fin = Date.parse(formato.format(new Date(fechaCorte)) + 'T00:00:00Z')
  return Math.max(0, Math.round((fin - inicio) / 86400000))
}

export function centavosComerciales(valor) {
  const texto = String(valor).trim().replace(',', '.')
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(texto))
    throw new Error('Ingresá un importe no negativo con hasta dos decimales.')
  const [entero, fraccion = ''] = texto.split('.')
  return BigInt(entero) * 100n + BigInt(fraccion.padEnd(2, '0'))
}
export function importeComercial(centavos) {
  const signo = centavos < 0n ? '-' : ''
  const absoluto = centavos < 0n ? -centavos : centavos
  return signo + absoluto / 100n + '.' + String(absoluto % 100n).padStart(2, '0')
}
export function precioCliente(cliente, listas, productoId) {
  const condicion = cliente?.condicionComercial
  const lista = listas.find((l) => l.id === condicion?.listaId && l.activo)
  if (!lista) return null
  const particular =
    !condicion.consumidorFinal &&
    cliente.preciosParticulares.find((p) => p.productoId === productoId && p.activo)
  return (
    particular?.precio ?? lista.precios.find((p) => p.productoId === productoId)?.precio ?? null
  )
}
export function resumenComercial(detalles, envio, pagos) {
  let total = centavosComerciales(envio)
  for (const linea of detalles) {
    if (!Number.isInteger(Number(linea.cantidad)) || Number(linea.cantidad) <= 0)
      throw new Error('Las cantidades deben ser enteras y positivas.')
    total += centavosComerciales(linea.precioEsperado) * BigInt(Number(linea.cantidad))
  }
  const cobrado = pagos.reduce((suma, pago) => suma + centavosComerciales(pago.importe), 0n)
  if (cobrado > total) throw new Error('El cobro no puede superar el total.')
  return {
    total: importeComercial(total),
    cobrado: importeComercial(cobrado),
    saldo: importeComercial(total - cobrado)
  }
}
