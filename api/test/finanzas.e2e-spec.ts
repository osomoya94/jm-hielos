import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import type {
  CategoriaFlujo,
  CuentaFinanciera,
  MovimientoFinanciero,
  OperacionFinanciera,
  Prisma,
} from '../src/generated/prisma/client';
import { Rol } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

// HTTP, validadores y guards reales; persistencia simulada. No se lee .env ni se usa PostgreSQL.
jest.mock('../src/prisma/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('../src/generated/prisma/client', () => ({
  Prisma: {
    ...jest.requireActual<typeof import('@prisma/client/runtime/client')>(
      '@prisma/client/runtime/client',
    ),
    TransactionIsolationLevel: { RepeatableRead: 'RepeatableRead' },
  },
}));

describe('Finanzas (HTTP con Prisma simulado)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const usuario = {
    id: '123e4567-e89b-42d3-a456-426614174001',
    rol: Rol.ADMIN,
    activo: true,
  };
  const dto = {
    claveIdempotencia: 'manual-http-1',
    cuentaId: '123e4567-e89b-42d3-a456-426614174002',
    categoriaId: '123e4567-e89b-42d3-a456-426614174003',
    importe: '123.45',
    fechaEfectiva: '2026-11-10T10:00:00-03:00',
    detalle: 'Movimiento manual',
  };
  const cuenta: CuentaFinanciera = {
    id: dto.cuentaId,
    nombre: 'Caja',
    tipo: 'EFECTIVO',
    moneda: 'ARS',
    titularInterno: 'JM',
    activo: true,
    saldoInicial: new Decimal('1000'),
    fechaApertura: new Date('2026-11-01T03:00:00Z'),
  };
  const categoria: CategoriaFlujo = {
    id: dto.categoriaId,
    nombre: 'Insumos',
    grupo: 'OPERACION',
    sentido: 'EGRESO',
    activo: true,
  };
  let guardada:
    (OperacionFinanciera & { movimientos: MovimientoFinanciero[] }) | null;
  const prisma = {
    usuario: {
      findUnique: jest.fn<
        Promise<typeof usuario | null>,
        [Prisma.UsuarioFindUniqueArgs]
      >(),
    },
    cuentaFinanciera: {
      findUnique: jest.fn<
        Promise<CuentaFinanciera | null>,
        [Prisma.CuentaFinancieraFindUniqueArgs]
      >(),
      findMany: jest.fn<
        Promise<CuentaFinanciera[]>,
        [Prisma.CuentaFinancieraFindManyArgs]
      >(),
    },
    categoriaFlujo: {
      findUnique: jest.fn<
        Promise<CategoriaFlujo | null>,
        [Prisma.CategoriaFlujoFindUniqueArgs]
      >(),
    },
    operacionFinanciera: {
      findUnique: jest.fn<
        Promise<typeof guardada>,
        [Prisma.OperacionFinancieraFindUniqueArgs]
      >(),
      create: jest.fn<
        Promise<OperacionFinanciera>,
        [Prisma.OperacionFinancieraCreateArgs]
      >(),
    },
    movimientoFinanciero: {
      create: jest.fn<
        Promise<MovimientoFinanciero>,
        [Prisma.MovimientoFinancieroCreateArgs]
      >(),
      findMany: jest.fn<
        Promise<MovimientoFinanciero[]>,
        [Prisma.MovimientoFinancieroFindManyArgs]
      >(),
    },
    $transaction: jest.fn<
      Promise<unknown>,
      [(tx: Prisma.TransactionClient) => Promise<unknown>, unknown?]
    >(),
  };
  const rutas = [
    '/operaciones-financieras/pagos-manuales',
    '/operaciones-financieras/cobros-manuales',
  ];
  const consulta = '/cash-flow?desde=2026-11-10&hasta=2026-11-11';
  const token = () => jwt.sign({ sub: usuario.id, rol: Rol.ADMIN });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    jwt = module.get(JwtService);
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    guardada = null;
    prisma.usuario.findUnique.mockResolvedValue(usuario);
    prisma.cuentaFinanciera.findUnique.mockResolvedValue(cuenta);
    prisma.cuentaFinanciera.findMany.mockResolvedValue([cuenta]);
    prisma.categoriaFlujo.findUnique.mockResolvedValue(categoria);
    prisma.operacionFinanciera.findUnique.mockImplementation(() =>
      Promise.resolve(guardada),
    );
    prisma.operacionFinanciera.create.mockImplementation(({ data }) => {
      const operacion: OperacionFinanciera = {
        id: 'op-1',
        claveIdempotencia: data.claveIdempotencia,
        tipo: data.tipo,
        usuarioId: usuario.id,
        origenTipo: 'MANUAL',
        origenId: null,
        referencia: null,
        motivo: null,
        fechaRegistro: new Date(),
        reversionDeId: null,
      };
      guardada = { ...operacion, movimientos: [] };
      return Promise.resolve(operacion);
    });
    prisma.movimientoFinanciero.create.mockImplementation(({ data }) => {
      const movimiento: MovimientoFinanciero = {
        id: 'mov-1',
        cuentaId: dto.cuentaId,
        categoriaId: dto.categoriaId,
        usuarioId: usuario.id,
        operacionId: 'op-1',
        importe: new Decimal(dto.importe),
        sentido: data.sentido,
        clase: data.clase,
        fechaEfectiva: new Date(dto.fechaEfectiva),
        fechaRegistro: new Date(),
        detalle: dto.detalle,
      };
      guardada!.movimientos.push(movimiento);
      return Promise.resolve(movimiento);
    });
    prisma.movimientoFinanciero.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation((callback) =>
      callback(prisma as unknown as Prisma.TransactionClient),
    );
  });
  afterAll(async () => {
    await app.close();
  });

  it.each(rutas)('exige JWT en POST %s', async (ruta) => {
    await request(app.getHttpServer()).post(ruta).send(dto).expect(401);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('exige JWT en Cash Flow', async () => {
    await request(app.getHttpServer()).get(consulta).expect(401);
  });
  describe.each([Rol.OPERADOR, Rol.LECTOR])('rol %s', (rol) => {
    it.each(rutas)('rechaza POST %s aunque el JWT diga ADMIN', async (ruta) => {
      prisma.usuario.findUnique.mockResolvedValue({ ...usuario, rol });
      await request(app.getHttpServer())
        .post(ruta)
        .set('Authorization', 'Bearer ' + token())
        .send(dto)
        .expect(403);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
  it.each(Object.values(Rol))(
    'permite Cash Flow a %s y devuelve ceros reales',
    async (rol) => {
      prisma.usuario.findUnique.mockResolvedValue({ ...usuario, rol });
      const respuesta = await request(app.getHttpServer())
        .get(consulta)
        .set('Authorization', 'Bearer ' + token())
        .expect(200);
      expect(respuesta.body).toMatchObject({
        totalIngresos: '0.00',
        totalEgresos: '0.00',
        flujoNeto: '0.00',
        saldoInicial: '1000.00',
        movimientos: [],
      });
    },
  );
  it('rechaza usuarios desactivados', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ ...usuario, activo: false });
    await request(app.getHttpServer())
      .get(consulta)
      .set('Authorization', 'Bearer ' + token())
      .expect(401);
  });

  it.each(['PAGO', 'COBRO'] as const)(
    'ADMIN registra %s y reintenta sin duplicar',
    async (tipo) => {
      prisma.categoriaFlujo.findUnique.mockResolvedValue({
        ...categoria,
        sentido: tipo === 'PAGO' ? 'EGRESO' : 'INGRESO',
      });
      const ruta = tipo === 'PAGO' ? rutas[0] : rutas[1];
      const primera = await request(app.getHttpServer())
        .post(ruta)
        .set('Authorization', 'Bearer ' + token())
        .send(dto)
        .expect(201);
      const segunda = await request(app.getHttpServer())
        .post(ruta)
        .set('Authorization', 'Bearer ' + token())
        .send(dto)
        .expect(201);
      expect(segunda.body).toEqual(primera.body);
      expect(primera.body).toMatchObject({
        operacion: { tipo, usuarioId: usuario.id },
        movimiento: {
          sentido: tipo === 'PAGO' ? 'EGRESO' : 'INGRESO',
          clase: 'FLUJO_EXTERNO',
          importe: '123.45',
        },
      });
      expect(prisma.movimientoFinanciero.create).toHaveBeenCalledTimes(1);
    },
  );
  it('devuelve 409 al reutilizar clave con un importe diferente', async () => {
    await request(app.getHttpServer())
      .post(rutas[0])
      .set('Authorization', 'Bearer ' + token())
      .send(dto)
      .expect(201);
    await request(app.getHttpServer())
      .post(rutas[0])
      .set('Authorization', 'Bearer ' + token())
      .send({ ...dto, importe: '200' })
      .expect(409);
    expect(prisma.movimientoFinanciero.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    { usuarioId: '123e4567-e89b-42d3-a456-426614174009' },
    { importe: 100 },
    { importe: null },
    { importe: '0' },
    { importe: '1.001' },
    { fechaEfectiva: '2026-11-10' },
    { fechaEfectiva: '2026-02-30T12:00:00-03:00' },
    { fechaEfectiva: '2026-11-10T10:00:00' },
    { fechaEfectiva: '2099-01-01T10:00:00Z' },
    { detalle: '  ' },
    { claveIdempotencia: '   ' },
    { cuentaId: 'invalida' },
  ])('rechaza body inválido %j', async (cambio) => {
    await request(app.getHttpServer())
      .post(rutas[0])
      .set('Authorization', 'Bearer ' + token())
      .send({ ...dto, ...cambio })
      .expect(400);
    expect(prisma.movimientoFinanciero.create).not.toHaveBeenCalled();
  });

  it.each([
    '/cash-flow',
    '/cash-flow?desde=2026-02-30&hasta=2026-03-01',
    '/cash-flow?desde=2026-11-11&hasta=2026-11-10',
    '/cash-flow?desde=2026-11-10T00:00:00Z&hasta=2026-11-11',
    consulta + '&cuentaId=mal',
  ])('rechaza consulta inválida %s', async (ruta) => {
    await request(app.getHttpServer())
      .get(ruta)
      .set('Authorization', 'Bearer ' + token())
      .expect(400);
  });
});
