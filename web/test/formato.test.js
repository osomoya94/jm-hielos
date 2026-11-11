import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moneda, fechaArgentina } from '../src/formato.js'

test('conserva centavos e importes mayores que el límite seguro de Number', () => {
  assert.equal(moneda('9999999999999999.99'), '$ 9.999.999.999.999.999,99')
  assert.equal(moneda('0.10'), '$ 0,10')
  assert.equal(moneda('0'), '$ 0,00')
})

test('conserva el signo de un flujo negativo menor a un peso', () => {
  assert.equal(moneda('-0.05'), '−$ 0,05')
  assert.equal(moneda('-1000.20'), '−$ 1.000,20')
})

test('presenta fechas UTC en el día efectivo argentino', () => {
  const texto = fechaArgentina('2026-11-11T02:59:00Z')
  assert.match(texto, /10\/11\/26/)
  assert.match(texto, /23:59/)
})
