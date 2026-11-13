import test from 'node:test'
import assert from 'node:assert/strict'
import {
  costoInsumo,
  existenciaDe,
  fechaOperacion,
  presentacionesDe,
  saldoCompra
} from '../src/inventario.js'

test('separa ubicaciones y conserva la presentación configurable', () => {
  const insumos = [
    {
      id: 'activo',
      activo: true,
      presentaciones: [
        {
          id: 'a',
          activo: true,
          factor: '80',
          existencias: [
            { ubicacion: 'DEPOSITO', unidades: '240' },
            { ubicacion: 'PRODUCCION', unidades: '70' }
          ]
        },
        { id: 'b', activo: false }
      ]
    },
    { id: 'inactivo', activo: false, presentaciones: [{ id: 'c', activo: true }] }
  ]
  const opciones = presentacionesDe(insumos)
  assert.equal(opciones.length, 1)
  assert.equal(opciones[0].factor, '80')
  assert.equal(existenciaDe(opciones[0], 'DEPOSITO'), '240')
  assert.equal(existenciaDe(opciones[0], 'PRODUCCION'), '70')
  assert.equal(existenciaDe(undefined, 'PRODUCCION'), '0')
})

test('el formulario conserva la fecha operativa argentina con zona explícita', () => {
  assert.equal(fechaOperacion('2026-01-10T10:15'), '2026-01-10T10:15:00-03:00')
  assert.equal(fechaOperacion('2026-01-10T10:15:30'), '2026-01-10T10:15:30-03:00')
})

test('conserva el saldo pendiente exacto y costos inferiores a un centavo', () => {
  assert.equal(saldoCompra({ total: '999999999999.99', pagado: '999999999999.98' }), '0.01')
  assert.equal(saldoCompra({ total: '4000', pagado: '1000.25' }), '2999.75')
  assert.equal(costoInsumo('0.007500'), '$ 0,0075')
})
