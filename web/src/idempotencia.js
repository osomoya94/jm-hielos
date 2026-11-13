export function crearClaveIdempotencia(cryptoAPI = globalThis.crypto) {
  if (typeof cryptoAPI?.randomUUID === 'function') return cryptoAPI.randomUUID()
  // getRandomValues funciona también en HTTP local de celulares.
  if (typeof cryptoAPI?.getRandomValues !== 'function') {
    throw new Error(
      'El navegador no permite generar una clave segura. Probá con un navegador actualizado.'
    )
  }
  const bytes = cryptoAPI.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-' +
    hex.slice(12, 16) +
    '-' +
    hex.slice(16, 20) +
    '-' +
    hex.slice(20)
  )
}
