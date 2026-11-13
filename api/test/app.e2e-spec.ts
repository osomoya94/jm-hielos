import {
  Controller,
  Get,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/client';
import { hash } from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import type { Prisma, Usuario } from '../src/generated/prisma/client';
import { Rol, TipoCuentaFinanciera } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { Roles } from '../src/auth/decorators/roles.decorator';

// Se usa la aplicación real con Prisma simulado y JWT reales de prueba.
jest.mock('../src/prisma/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('../src/generated/prisma/client', () => ({
  Prisma: jest.requireActual<typeof import('@prisma/client/runtime/client')>(
    '@prisma/client/runtime/client',
  ),
}));

// Estas rutas existen solo en la aplicación de pruebas.
@Controller('pruebas-seguridad')
class RutasSinPermisosController {
  @Get('sin-roles')
  sinRoles() {
    return 'Ruta de prueba';
  }

  @Roles()
  @Get('roles-vacios')
  rolesVacios() {
    return 'Ruta de prueba';
  }
}

describe('Autenticación y roles (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  const id = '123e4567-e89b-42d3-a456-426614174000';
  const usuario: Usuario = {
    id,
    username: 'admin',
    passwordHash: '',
    rol: Rol.ADMIN,
    activo: true,
    ultimoAcceso: null,
  };
  let usuarioActual: Usuario | null;
  const usuarioPublico = {
    id,
    username: 'admin',
    rol: Rol.ADMIN,
    activo: true,
    ultimoAcceso: null,
  };
  const producto = {
    id,
    nombre: 'Bolsa de hielo',
    pesoKg: 5,
    unidad: 'bolsa',
    activo: true,
  };
  const cliente = {
    id,
    nombre: 'Cliente de prueba',
    telefono: null,
    direccion: null,
    referencia: null,
    tipoCliente: 'Minorista',
    observaciones: null,
    activo: true,
  };
  const cuenta = {
    id,
    nombre: 'Caja principal',
    tipo: TipoCuentaFinanciera.EFECTIVO,
    titularInterno: 'JM Hielos',
    moneda: 'ARS',
    saldoInicial: new Decimal('100.00'),
    fechaApertura: new Date('2026-10-29'),
    activo: true,
  };
  const catalogos = [
    {
      ruta: 'usuarios',
      creacion: {
        username: 'nuevo',
        password: 'ClaveNueva123',
        rol: Rol.LECTOR,
      },
      edicion: { username: 'otro' },
    },
    {
      ruta: 'productos',
      creacion: { nombre: producto.nombre, pesoKg: 5, unidad: 'bolsa' },
      edicion: { nombre: 'Bolsa nueva' },
    },
    {
      ruta: 'clientes',
      creacion: { nombre: cliente.nombre, tipoCliente: 'Minorista' },
      edicion: { nombre: 'Otro cliente' },
    },
    {
      ruta: 'cuentas-financieras',
      creacion: {
        nombre: cuenta.nombre,
        tipo: cuenta.tipo,
        titularInterno: cuenta.titularInterno,
        saldoInicial: '100.00',
        fechaApertura: '2026-10-29',
      },
      edicion: { nombre: 'Caja secundaria' },
    },
  ];
  const rutasConsulta = [
    '/',
    '/health',
    '/usuarios',
    '/usuarios/inactivos',
    `/usuarios/${id}`,
    '/productos',
    '/productos/inactivos',
    `/productos/${id}`,
    '/clientes',
    '/clientes/inactivos',
    `/clientes/${id}`,
    '/cuentas-financieras',
    '/cuentas-financieras/inactivas',
    `/cuentas-financieras/${id}`,
  ];
  const prismaService = {
    usuario: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    producto: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    cliente: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    cuentaFinanciera: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeAll(async () => {
    usuario.passwordHash = await hash('ClavePrueba123', 4);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    usuarioActual = { ...usuario };
    prismaService.usuario.findUnique.mockImplementation(
      ({ where }: Prisma.UsuarioFindUniqueArgs) => {
        if (!usuarioActual) {
          return Promise.resolve(null);
        }

        if (where.username === usuario.username) {
          return Promise.resolve(usuarioActual);
        }

        if (where.id === usuario.id) {
          return Promise.resolve({
            ...usuarioPublico,
            rol: usuarioActual.rol,
            activo: usuarioActual.activo,
          });
        }

        return Promise.resolve(null);
      },
    );
    prismaService.usuario.findMany.mockResolvedValue([usuarioPublico]);
    prismaService.usuario.create.mockResolvedValue(usuarioPublico);
    prismaService.usuario.update.mockResolvedValue(usuarioPublico);
    prismaService.usuario.count.mockResolvedValue(2);
    prismaService.producto.findUnique.mockResolvedValue(producto);
    prismaService.producto.findMany.mockResolvedValue([producto]);
    prismaService.producto.create.mockResolvedValue(producto);
    prismaService.producto.update.mockResolvedValue(producto);
    prismaService.cliente.findUnique.mockResolvedValue(cliente);
    prismaService.cliente.findMany.mockResolvedValue([cliente]);
    prismaService.cliente.create.mockResolvedValue(cliente);
    prismaService.cliente.update.mockResolvedValue(cliente);
    prismaService.cuentaFinanciera.findUnique.mockImplementation(
      ({ where }: Prisma.CuentaFinancieraFindUniqueArgs) =>
        Promise.resolve(where.id === id ? cuenta : null),
    );
    prismaService.cuentaFinanciera.findMany.mockResolvedValue([cuenta]);
    prismaService.cuentaFinanciera.create.mockResolvedValue(cuenta);
    prismaService.cuentaFinanciera.update.mockResolvedValue(cuenta);

    const module = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [RutasSinPermisosController],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .compile();

    jwtService = module.get(JwtService);
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

  afterEach(async () => {
    await app.close();
  });

  it('permite login público sin token y devuelve un JWT verificable sin contraseñas', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'ClavePrueba123' })
      .expect(200);

    const cuerpo = respuesta.body as { token: string };
    const payload = await jwtService.verifyAsync<{
      sub: string;
      rol: Rol;
      exp: number;
    }>(cuerpo.token);
    const jwtCompleto = jwtService.decode<{ sub: string }>(cuerpo.token, {
      complete: true,
    });

    expect(jwtCompleto.header.alg).toBe('HS256');
    expect(payload.sub).toBe(id);
    expect(payload.rol).toBe(Rol.ADMIN);
    expect(payload.exp).toEqual(expect.any(Number));
    expect(respuesta.body).not.toHaveProperty('passwordHash');
    expect(respuesta.body).not.toHaveProperty('password');

    await request(app.getHttpServer())
      .get('/cuentas-financieras')
      .set('Authorization', `Bearer ${cuerpo.token}`)
      .expect(200);
  });

  it('mantiene el login público aunque se envíe un Bearer inválido', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Authorization', 'Bearer token-invalido')
      .send({ username: 'admin', password: 'ClavePrueba123' })
      .expect(200);
  });

  it('responde 429 en la sexta solicitud de login y permite reintentar tras un minuto', async () => {
    for (let intento = 0; intento < 5; intento++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'admin', password: 'ClaveIncorrecta123' })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'ClavePrueba123' })
      .expect(429)
      .expect('Retry-After', /^\d+$/);

    expect(prismaService.usuario.findUnique).toHaveBeenCalledTimes(5);
    expect(prismaService.usuario.update).not.toHaveBeenCalled();

    const reloj = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_001);
    try {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'admin', password: 'ClavePrueba123' })
        .expect(200);
    } finally {
      reloj.mockRestore();
    }
  });

  it('también cuenta los logins exitosos para el límite por IP', async () => {
    for (let intento = 0; intento < 5; intento++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'admin', password: 'ClavePrueba123' })
        .expect(200);
    }

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'ClavePrueba123' })
      .expect(429);

    expect(prismaService.usuario.findUnique).toHaveBeenCalledTimes(5);
  });

  it('también limita solicitudes de login con un DTO inválido', async () => {
    for (let intento = 0; intento < 6; intento++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(intento < 5 ? 400 : 429);
    }

    expect(prismaService.usuario.findUnique).not.toHaveBeenCalled();
  });

  it('no evita el límite cambiando el username o una cabecera X-Forwarded-For sin confianza', async () => {
    for (let intento = 0; intento < 6; intento++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Forwarded-For', `192.0.2.${intento + 1}`)
        .send({
          username: `inexistente-${intento}`,
          password: 'ClavePrueba123',
        })
        .expect(intento < 5 ? 401 : 429);
    }

    expect(prismaService.usuario.findUnique).toHaveBeenCalledTimes(5);
  });

  it('limita solo el login y conserva las consultas después de recibir 429', async () => {
    for (let intento = 0; intento < 6; intento++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'admin', password: 'ClaveIncorrecta123' })
        .expect(intento < 5 ? 401 : 429);
    }

    const token = jwtService.sign({ sub: id, rol: Rol.ADMIN });
    for (let consulta = 0; consulta < 6; consulta++) {
      await request(app.getHttpServer())
        .get('/cuentas-financieras')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    }
  });

  it.each(['sin-roles', 'roles-vacios'])(
    'rechaza con 401 una ruta %s sin token antes de comprobar permisos',
    async (ruta) => {
      await request(app.getHttpServer())
        .get(`/pruebas-seguridad/${ruta}`)
        .expect(401);
    },
  );

  describe.each(Object.values(Rol))('Denegación por defecto para %s', (rol) => {
    it.each(['sin-roles', 'roles-vacios'])(
      'rechaza la ruta %s con 403 incluso con usuario autenticado',
      async (ruta) => {
        usuarioActual = { ...usuario, rol };
        const token = jwtService.sign({ sub: id, rol });

        await request(app.getHttpServer())
          .get(`/pruebas-seguridad/${ruta}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(403);
      },
    );
  });

  it.each(rutasConsulta)('rechaza GET %s sin token con 401', async (ruta) => {
    await request(app.getHttpServer()).get(ruta).expect(401);
    expect(prismaService.usuario.findUnique).not.toHaveBeenCalled();
  });

  it.each(catalogos)(
    'protege todas las escrituras de $ruta sin token',
    async ({ ruta, creacion, edicion }) => {
      await request(app.getHttpServer())
        .post(`/${ruta}`)
        .send(creacion)
        .expect(401);
      await request(app.getHttpServer())
        .patch(`/${ruta}/${id}`)
        .send(edicion)
        .expect(401);
      await request(app.getHttpServer())
        .patch(`/${ruta}/${id}/estado`)
        .send({ activo: false })
        .expect(401);
    },
  );

  it.each(['Basic abc', 'Bearer', 'Bearer token-invalido', 'Bearer abc extra'])(
    'rechaza Authorization inválido: %s',
    async (authorization) => {
      await request(app.getHttpServer())
        .get('/cuentas-financieras')
        .set('Authorization', authorization)
        .expect(401);

      expect(prismaService.usuario.findUnique).not.toHaveBeenCalled();
    },
  );

  it('rechaza un JWT firmado con otra clave', async () => {
    const token = jwtService.sign(
      { sub: id, rol: Rol.ADMIN },
      { secret: 'otra-clave-de-prueba' },
    );

    await request(app.getHttpServer())
      .get('/cuentas-financieras')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    expect(prismaService.usuario.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza un JWT vencido', async () => {
    const token = jwtService.sign(
      { sub: id, rol: Rol.ADMIN },
      { expiresIn: -1 },
    );

    await request(app.getHttpServer())
      .get('/cuentas-financieras')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    expect(prismaService.usuario.findUnique).not.toHaveBeenCalled();
  });

  it.each(['HS384', 'HS512'] as const)(
    'rechaza un JWT firmado con %s aunque use la misma clave',
    async (algorithm) => {
      const token = jwtService.sign({ sub: id, rol: Rol.ADMIN }, { algorithm });

      await request(app.getHttpServer())
        .get('/cuentas-financieras')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(prismaService.usuario.findUnique).not.toHaveBeenCalled();
    },
  );

  it('rechaza un JWT sin expiración', async () => {
    const token = new JwtService({
      secret: 'clave-exclusiva-para-pruebas',
    }).sign({ sub: id });

    await request(app.getHttpServer())
      .get('/cuentas-financieras')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    expect(prismaService.usuario.findUnique).not.toHaveBeenCalled();
  });

  it.each([{}, { sub: '' }])(
    'rechaza un JWT sin ID válido: %j',
    async (payload) => {
      const token = jwtService.sign(payload);

      await request(app.getHttpServer())
        .get('/cuentas-financieras')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      expect(prismaService.usuario.findUnique).not.toHaveBeenCalled();
    },
  );

  it('rechaza un usuario que ya no existe aunque el token sea válido', async () => {
    const token = jwtService.sign({ sub: id, rol: Rol.ADMIN });
    usuarioActual = null;

    await request(app.getHttpServer())
      .get('/cuentas-financieras')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rechaza el mismo token inmediatamente después de desactivar al usuario', async () => {
    const token = jwtService.sign({ sub: id, rol: Rol.ADMIN });

    await request(app.getHttpServer())
      .get('/cuentas-financieras')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    usuarioActual = { ...usuario, activo: false };
    await request(app.getHttpServer())
      .get('/cuentas-financieras')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('consulta solo id, rol y activo para autenticar al usuario', async () => {
    const token = jwtService.sign({ sub: id, rol: Rol.ADMIN });

    await request(app.getHttpServer())
      .get('/cuentas-financieras')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(prismaService.usuario.findUnique).toHaveBeenCalledWith({
      where: { id },
      select: { id: true, rol: true, activo: true },
    });
  });

  describe.each(Object.values(Rol))('Permisos de %s', (rol) => {
    it.each(rutasConsulta)('puede consultar GET %s', async (ruta) => {
      usuarioActual = { ...usuario, rol };
      const token = jwtService.sign({ sub: id, rol });

      const respuesta = await request(app.getHttpServer())
        .get(ruta)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(JSON.stringify(respuesta.body)).not.toContain('passwordHash');
    });
  });

  it.each(catalogos)(
    'ADMIN puede crear, editar y desactivar en $ruta',
    async ({ ruta, creacion, edicion }) => {
      const token = jwtService.sign({ sub: id, rol: Rol.ADMIN });

      await request(app.getHttpServer())
        .post(`/${ruta}`)
        .set('Authorization', `Bearer ${token}`)
        .send(creacion)
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/${ruta}/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(edicion)
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/${ruta}/${id}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false })
        .expect(200);
    },
  );

  describe.each([Rol.OPERADOR, Rol.LECTOR])('Escrituras de %s', (rol) => {
    it.each(catalogos)(
      'rechaza crear, editar o cambiar estado en $ruta con 403',
      async ({ ruta, creacion, edicion }) => {
        usuarioActual = { ...usuario, rol };
        const token = jwtService.sign({ sub: id, rol });

        await request(app.getHttpServer())
          .post(`/${ruta}`)
          .set('Authorization', `Bearer ${token}`)
          .send(creacion)
          .expect(403);
        await request(app.getHttpServer())
          .patch(`/${ruta}/${id}`)
          .set('Authorization', `Bearer ${token}`)
          .send(edicion)
          .expect(403);
        await request(app.getHttpServer())
          .patch(`/${ruta}/${id}/estado`)
          .set('Authorization', `Bearer ${token}`)
          .send({ activo: false })
          .expect(403);

        for (const delegado of Object.values(prismaService)) {
          expect(delegado.create).not.toHaveBeenCalled();
          expect(delegado.update).not.toHaveBeenCalled();
        }
      },
    );
  });

  it('usa el rol vigente de la base al quitar ADMIN sin renovar el token', async () => {
    const token = jwtService.sign({ sub: id, rol: Rol.ADMIN });
    usuarioActual = { ...usuario, rol: Rol.LECTOR };

    await request(app.getHttpServer())
      .post('/cuentas-financieras')
      .set('Authorization', `Bearer ${token}`)
      .send(catalogos[3].creacion)
      .expect(403);
    expect(prismaService.cuentaFinanciera.create).not.toHaveBeenCalled();
  });

  it('usa el rol vigente de la base al otorgar ADMIN sin renovar el token', async () => {
    const token = jwtService.sign({ sub: id, rol: Rol.LECTOR });

    await request(app.getHttpServer())
      .post('/cuentas-financieras')
      .set('Authorization', `Bearer ${token}`)
      .send(catalogos[3].creacion)
      .expect(201);
  });
});
