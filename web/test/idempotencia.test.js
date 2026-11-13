import { test } from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { crearClaveIdempotencia } from '../src/idempotencia.js'

test('utiliza randomUUID cuando está disponible', () => {
  assert.equal(crearClaveIdempotencia({ randomUUID: () => 'uuid-seguro' }), 'uuid-seguro')
})

test('en HTTP sin randomUUID usa getRandomValues y produce UUID v4', () => {
  let llamadas = 0
  const cryptoHTTP = {
    getRandomValues: (bytes) => {
      llamadas++
      return bytes.fill(255)
    }
  }
  assert.equal(crearClaveIdempotencia(cryptoHTTP), 'ffffffff-ffff-4fff-bfff-ffffffffffff')
  assert.equal(llamadas, 1)
})

test('las claves criptográficas mantienen formato y no se repiten en las muestras', () => {
  const claves = Array.from({ length: 100 }, () =>
    crearClaveIdempotencia({ getRandomValues: webcrypto.getRandomValues.bind(webcrypto) })
  )
  assert.equal(new Set(claves).size, 100)
  for (const clave of claves)
    assert.match(clave, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

test('si no hay criptografía muestra un error recuperable en lugar de usar Math.random', () => {
  assert.throws(() => crearClaveIdempotencia({}), /clave segura/)
})
