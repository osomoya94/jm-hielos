import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  antiguedadComercial,
  centavosComerciales,
  importeComercial,
  precioCliente,
  resumenComercial
} from '../src/comercial.js'

test('venta mixta conserva total, cobrado y fiado con decimales exactos', () => {
  assert.deepEqual(
    resumenComercial([{ cantidad: 45, precioEsperado: '2000' }], '0', [
      { importe: '40000' },
      { importe: '30000' }
    ]),
    { total: '90000.00', cobrado: '70000.00', saldo: '20000.00' }
  )
  assert.deepEqual(resumenComercial([{ cantidad: 3, precioEsperado: '0.10' }], '0.20', []), {
    total: '0.50',
    cobrado: '0.00',
    saldo: '0.50'
  })
})
test('rechaza importes inválidos, cantidades fraccionarias y cobros excesivos', () => {
  for (const importe of ['', '-1', 'NaN', '1.001'])
    assert.throws(() => centavosComerciales(importe))
  assert.throws(() => resumenComercial([{ cantidad: 1.5, precioEsperado: '1' }], '0', []))
  assert.throws(() =>
    resumenComercial([{ cantidad: 1, precioEsperado: '1' }], '0', [{ importe: '2' }])
  )
})
test('un particular activo precede a lista; Consumidor final siempre toma minorista', () => {
  const listas = [{ id: 'lista', activo: true, precios: [{ productoId: 'bolsa', precio: '2000' }] }]
  const cliente = {
    condicionComercial: { listaId: 'lista', consumidorFinal: false },
    preciosParticulares: [{ productoId: 'bolsa', precio: '1500', activo: true }]
  }
  assert.equal(precioCliente(cliente, listas, 'bolsa'), '1500')
  cliente.condicionComercial.consumidorFinal = true
  assert.equal(precioCliente(cliente, listas, 'bolsa'), '2000')
  assert.equal(precioCliente(null, listas, 'bolsa'), null)
  assert.equal(precioCliente(cliente, listas, 'otro'), null)
})
test('mantiene centavos en importes grandes y totales agregados', () => {
  assert.equal(
    importeComercial(centavosComerciales('999999999999.99') * 1000n),
    '999999999999990.00'
  )
  assert.equal(importeComercial(-1n), '-0.01')
})
test('la antigüedad usa días de Argentina, incluso si ambos instantes tienen la misma fecha UTC', () => {
  assert.equal(antiguedadComercial('2026-01-11T02:59:00Z', '2026-01-11T03:01:00Z'), 1)
  assert.equal(antiguedadComercial('2026-01-11T03:00:00Z', '2026-01-11T20:00:00Z'), 0)
})
