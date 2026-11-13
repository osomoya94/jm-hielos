import 'dotenv/config';
import { Client } from 'pg';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Solo crea/utiliza una base QA local. Nunca borra tablas ni bases.
const nombreQa = 'jm_hielos_qa_ers14';
const directorioApi = fileURLToPath(new URL('../', import.meta.url));
const conexionDesarrollo = process.env.DATABASE_URL;
if (!conexionDesarrollo) throw new Error('Falta configurar la conexión local');
const origen = new Client({ connectionString: conexionDesarrollo });
const destino = origen.connectionParameters;
if (
  destino.host !== '127.0.0.1' ||
  Number(destino.port) !== 5433 ||
  destino.database !== 'jm_hielos'
) {
  throw new Error(
    'QA requiere la configuración local 127.0.0.1:5433/jm_hielos',
  );
}
const conexionQa = new URL(conexionDesarrollo);
conexionQa.pathname = '/' + nombreQa;
const conexionAdministrativa = new URL(conexionDesarrollo);
conexionAdministrativa.pathname = '/postgres';
const parametrosQa = new Client({ connectionString: conexionQa.toString() })
  .connectionParameters;
const parametrosAdministrativos = new Client({
  connectionString: conexionAdministrativa.toString(),
}).connectionParameters;
if (
  parametrosQa.database !== nombreQa ||
  parametrosQa.host !== '127.0.0.1' ||
  Number(parametrosQa.port) !== 5433 ||
  parametrosAdministrativos.database !== 'postgres'
) {
  throw new Error(
    'Se rechaza cualquier conexión QA que no resuelva al destino local aislado',
  );
}

async function huellaDesarrollo() {
  const cliente = new Client({ connectionString: conexionDesarrollo });
  try {
    await cliente.connect();
    await cliente.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await cliente.query("SET LOCAL TIME ZONE 'UTC'");
    const tablas = (
      await cliente.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
      )
    ).rows;
    const huellas = {};
    for (const { tablename } of tablas) {
      const identificador = '"' + tablename.replaceAll('"', '""') + '"';
      huellas[tablename] = (
        await cliente.query(
          "SELECT count(*)::int AS cantidad, encode(sha256(convert_to(COALESCE(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text), ''), 'UTF8')), 'hex') AS huella FROM public." +
            identificador +
            ' t',
        )
      ).rows[0];
    }
    await cliente.query('ROLLBACK');
    return JSON.stringify(huellas);
  } finally {
    await cliente.end();
  }
}

function ejecutar(argumentos) {
  const resultado = spawnSync(process.execPath, argumentos, {
    cwd: directorioApi,
    env: {
      ...process.env,
      DATABASE_URL: conexionQa.toString(),
      JM_QA_DATABASE_NAME: nombreQa,
    },
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  const salida = ((resultado.stdout || '') + (resultado.stderr || '')).replace(
    /postgres(?:ql)?:\/\/[^\s'"<>]+/g,
    '[conexión omitida]',
  );
  process.stdout.write(salida);
  if (resultado.error || resultado.status !== 0)
    throw new Error('La comprobación QA terminó con error; no se continuará');
}

try {
  const antes = await huellaDesarrollo();
  const administrador = new Client({
    connectionString: conexionAdministrativa.toString(),
  });
  try {
    await administrador.connect();
    const existe = await administrador.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [nombreQa],
    );
    if (!existe.rowCount)
      await administrador.query('CREATE DATABASE "' + nombreQa + '"');
  } finally {
    await administrador.end();
  }
  console.log('Destino QA aislado:', nombreQa, 'en 127.0.0.1:5433');
  let errorPrueba;
  try {
    ejecutar([
      'node_modules/prisma/build/index.js',
      'migrate',
      'deploy',
      '--config',
      'prisma7.config.ts',
    ]);
    if (!process.argv.includes('--solo-preparar')) {
      ejecutar([
        '--experimental-vm-modules',
        'node_modules/jest/bin/jest.js',
        '--config',
        'test/jest-postgres.json',
        '--runInBand',
      ]);
    }
  } catch (error) {
    errorPrueba = error;
  }
  const despues = await huellaDesarrollo();
  if (antes !== despues)
    throw new Error(
      'ATENCIÓN: cambió el contenido de desarrollo durante la prueba; detener y revisar',
    );
  console.log(
    'Desarrollo: todas las tablas conservan conteos y hashes SHA-256.',
  );
  if (errorPrueba) throw errorPrueba;
} catch (error) {
  // No imprimir objetos de conexión ni errores del driver que puedan contener secretos.
  console.error(
    error.message?.startsWith('ATENCIÓN:')
      ? error.message
      : 'QA no pudo completarse. Desarrollo no se usa como destino de las pruebas.',
  );
  process.exitCode = 1;
}
