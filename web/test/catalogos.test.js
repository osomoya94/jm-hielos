import { test } from 'node:test'
import assert from 'node:assert/strict'
import { catalogos, filtrarRegistros, prepararDatosCatalogo } from '../src/catalogos.js'

test('distingue las rutas reales de inactivos e inactivas', () => {
  assert.equal(
    catalogos.cuentas.ruta + '/' + catalogos.cuentas.inactivos,
    '/cuentas-financieras/inactivas'
  )
  assert.equal(catalogos.clientes.ruta + '/' + catalogos.clientes.inactivos, '/clientes/inactivos')
})

test('producto envía peso numérico y únicamente los campos permitidos', () => {
  assert.deepEqual(
    prepararDatosCatalogo('productos', {
      nombre: ' Bolsa 3 kg ',
      pesoKg: '3',
      unidad: ' bolsa ',
      id: 'ajeno',
      activo: false,
      precio: '500'
    }),
    { nombre: 'Bolsa 3 kg', pesoKg: 3, unidad: 'bolsa' }
  )
  for (const pesoKg of ['0', '21', '1.5', 'abc', '']) {
    assert.throws(
      () => prepararDatosCatalogo('productos', { nombre: 'Bolsa', pesoKg, unidad: 'bolsa' }),
      /entero entre 1 y 20/
    )
  }
})

test('rechaza nombres vacíos y textos fuera del límite del DTO', () => {
  for (const nombre of ['   ', 'a'.repeat(101)]) {
    assert.throws(
      () => prepararDatosCatalogo('productos', { nombre, pesoKg: 3, unidad: 'bolsa' }),
      /Nombre/
    )
  }
})

test('cliente conserva texto libre de tipo y limpia campos opcionales con null', () => {
  assert.deepEqual(
    prepararDatosCatalogo(
      'clientes',
      {
        nombre: ' Comercio ',
        tipoCliente: ' habitual ',
        telefono: '',
        direccion: ' Calle 10 ',
        referencia: ' ',
        observaciones: '',
        cuit: '999'
      },
      true
    ),
    {
      nombre: 'Comercio',
      tipoCliente: 'habitual',
      telefono: null,
      direccion: 'Calle 10',
      referencia: null,
      observaciones: null
    }
  )
})

test('proveedor normaliza CUIT sin inventar validación de dígito verificador', () => {
  const resultado = prepararDatosCatalogo('proveedores', {
    nombre: 'Proveedor',
    cuit: '20-12345678-9'
  })
  assert.equal(resultado.cuit, '20123456789')
  assert.equal(resultado.telefono, null)
  assert.equal('tipoCliente' in resultado, false)
  assert.throws(
    () => prepararDatosCatalogo('proveedores', { nombre: 'Proveedor', cuit: '123' }),
    /11 dígitos/
  )
})

test('permite eliminar CUIT opcional en una edición mediante null', () => {
  assert.equal(
    prepararDatosCatalogo('proveedores', { nombre: 'Proveedor', cuit: '' }, true).cuit,
    null
  )
})

test('cuenta preserva decimal como string y agrega zona de Argentina a la apertura', () => {
  const resultado = prepararDatosCatalogo('cuentas', {
    nombre: 'Caja',
    titularInterno: 'JM',
    tipo: 'EFECTIVO',
    saldoInicial: '9999999999999999,99',
    fechaApertura: '2026-11-01'
  })
  assert.deepEqual(resultado, {
    nombre: 'Caja',
    titularInterno: 'JM',
    tipo: 'EFECTIVO',
    saldoInicial: '9999999999999999.99',
    fechaApertura: '2026-11-01T00:00:00-03:00'
  })
})

test('cuenta admite saldo cero pero rechaza negativos, exceso de precisión y fechas inexistentes', () => {
  const datos = {
    nombre: 'Caja',
    titularInterno: 'JM',
    tipo: 'EFECTIVO',
    saldoInicial: '0',
    fechaApertura: '2026-11-01'
  }
  assert.equal(prepararDatosCatalogo('cuentas', datos).saldoInicial, '0')
  for (const saldoInicial of ['-1', '1.001', '1e3', '10000000000000000']) {
    assert.throws(() => prepararDatosCatalogo('cuentas', { ...datos, saldoInicial }))
  }
  assert.throws(
    () => prepararDatosCatalogo('cuentas', { ...datos, fechaApertura: '2026-02-30' }),
    /fecha de apertura válida/
  )
})

test('edición de cuenta no modifica saldo, moneda, fecha ni tipo', () => {
  assert.deepEqual(
    prepararDatosCatalogo(
      'cuentas',
      {
        nombre: 'Cuenta renombrada',
        titularInterno: 'JM',
        tipo: 'BANCO',
        saldoInicial: '999',
        moneda: 'USD',
        fechaApertura: '2026-11-01'
      },
      true
    ),
    { nombre: 'Cuenta renombrada', titularInterno: 'JM' }
  )
})

test('categoría solo admite enums del DTO y en edición envía únicamente nombre', () => {
  const datos = { nombre: 'Aportes', grupo: 'APORTES', sentido: 'INGRESO' }
  assert.deepEqual(prepararDatosCatalogo('categorias', datos), datos)
  assert.deepEqual(prepararDatosCatalogo('categorias', datos, true), { nombre: 'Aportes' })
  assert.throws(() => prepararDatosCatalogo('categorias', { ...datos, grupo: 'VENTAS' }))
  assert.throws(() => prepararDatosCatalogo('categorias', { ...datos, sentido: 'COBRO' }))
})

test('busca por nombre, teléfono y dirección sin distinguir acentos; respeta estado', () => {
  const registros = [
    { nombre: 'José', telefono: '383456789', direccion: 'Calle Norte', activo: true },
    { nombre: 'Ana', telefono: '111', direccion: 'Sur', activo: false }
  ]
  assert.equal(filtrarRegistros(registros, 'jose').length, 1)
  assert.equal(filtrarRegistros(registros, '38345').length, 1)
  assert.equal(filtrarRegistros(registros, 'norte').length, 1)
  assert.equal(filtrarRegistros(registros, 'ana').length, 0)
  assert.equal(filtrarRegistros(registros, 'ana', 'inactivos').length, 1)
  assert.equal(filtrarRegistros(registros, '', 'todos').length, 2)
})
