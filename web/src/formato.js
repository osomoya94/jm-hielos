export const ZONA_HORARIA = 'America/Argentina/Catamarca'

export function moneda(importe) {
  // Un dato ausente no representa un importe de cero.
  if (importe === null || importe === undefined) return '—'
  const texto = String(importe).trim()
  if (!/^-?\d+(?:\.\d+)?$/.test(texto)) return '—'
  // Se formatea el decimal como string para no perder centavos con importes grandes.
  const [entero, centavos = ''] = texto.split('.')
  const negativo = entero.startsWith('-')
  const agrupado = BigInt(negativo ? entero.slice(1) : entero).toLocaleString('es-AR')
  return (negativo ? '−$ ' : '$ ') + agrupado + ',' + centavos.padEnd(2, '0').slice(0, 2)
}

export function fechaArgentina(fecha) {
  if (!fecha || !Number.isFinite(new Date(fecha).getTime())) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_HORARIA,
    dateStyle: 'short',
    timeStyle: 'short',
    hourCycle: 'h23'
  }).format(new Date(fecha))
}

export function ahoraArgentina() {
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date())
  const valor = (nombre) => partes.find((parte) => parte.type === nombre).value
  return (
    valor('year') +
    '-' +
    valor('month') +
    '-' +
    valor('day') +
    'T' +
    valor('hour') +
    ':' +
    valor('minute')
  )
}

export function periodoActual() {
  const hoy = ahoraArgentina().slice(0, 10)
  return { desde: hoy.slice(0, 8) + '01', hasta: hoy, cuentaId: '' }
}
