import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../prisma/prisma.service';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';

// Las pruebas usan un Prisma simulado y no se conectan a la base de datos.
jest.mock('../prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

describe('ClientesController', () => {
  let app: INestApplication<App>;
  const cliente = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    nombre: 'Juan',
    telefono: '12345678',
    direccion: null,
    referencia: null,
    tipoCliente: 'Comercio',
    observaciones: null,
    activo: true,
  };
  const prismaService = {
    cliente: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const limitesTexto = [
    ['nombre', 100],
    ['telefono', 30],
    ['direccion', 150],
    ['referencia', 150],
    ['tipoCliente', 50],
    ['observaciones', 500],
  ] as const;

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaService.cliente.findMany.mockResolvedValue([cliente]);
    prismaService.cliente.findUnique.mockResolvedValue(cliente);
    prismaService.cliente.create.mockResolvedValue(cliente);
    prismaService.cliente.update.mockResolvedValue(cliente);

    const module = await Test.createTestingModule({
      controllers: [ClientesController],
      providers: [
        ClientesService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

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

  it('crea un cliente valido con todos los campos', async () => {
    const datos = {
      nombre: 'Juan',
      telefono: '12345678',
      direccion: 'San Martin 123',
      referencia: 'Frente a la plaza',
      tipoCliente: 'Comercio',
      observaciones: 'Entregar por la tarde',
    };
    const clienteCreado = { ...cliente, ...datos };
    prismaService.cliente.create.mockResolvedValue(clienteCreado);

    await request(app.getHttpServer())
      .post('/clientes')
      .send(datos)
      .expect(201)
      .expect({ ...clienteCreado, message: 'Cliente creado con exito' });
    expect(prismaService.cliente.create).toHaveBeenCalledWith({ data: datos });
  });

  it('elimina espacios al inicio y al final al crear un cliente', async () => {
    const datos = {
      nombre: 'Juan Perez',
      telefono: '1234 5678',
      direccion: 'San Martin 123',
      referencia: 'Frente a la plaza',
      tipoCliente: 'Comercio minorista',
      observaciones: 'Entregar por la tarde',
    };

    await request(app.getHttpServer())
      .post('/clientes')
      .send({
        nombre: '  Juan Perez  ',
        telefono: '  1234 5678  ',
        direccion: '  San Martin 123  ',
        referencia: '  Frente a la plaza  ',
        tipoCliente: '  Comercio minorista  ',
        observaciones: '  Entregar por la tarde  ',
      })
      .expect(201);
    expect(prismaService.cliente.create).toHaveBeenCalledWith({ data: datos });
  });

  it.each(limitesTexto)(
    'acepta crear un cliente con %s de %i caracteres despues del trim',
    async (campo, maximo) => {
      const texto = 'a'.repeat(maximo);
      const datos = { nombre: 'Juan', tipoCliente: 'Comercio', [campo]: texto };

      await request(app.getHttpServer())
        .post('/clientes')
        .send({ ...datos, [campo]: `  ${texto}  ` })
        .expect(201);
      expect(prismaService.cliente.create).toHaveBeenCalledWith({
        data: {
          telefono: undefined,
          direccion: undefined,
          referencia: undefined,
          observaciones: undefined,
          ...datos,
        },
      });
    },
  );

  it.each(limitesTexto)(
    'rechaza crear un cliente con %s que supera %i caracteres',
    async (campo, maximo) => {
      await request(app.getHttpServer())
        .post('/clientes')
        .send({
          nombre: 'Juan',
          tipoCliente: 'Comercio',
          [campo]: 'a'.repeat(maximo + 1),
        })
        .expect(400);
      expect(prismaService.cliente.create).not.toHaveBeenCalled();
    },
  );

  it('rechaza crear un cliente sin nombre', async () => {
    await request(app.getHttpServer())
      .post('/clientes')
      .send({ tipoCliente: 'Comercio' })
      .expect(400);
    expect(prismaService.cliente.create).not.toHaveBeenCalled();
  });

  it('rechaza crear un cliente con nombre de solo espacios', async () => {
    await request(app.getHttpServer())
      .post('/clientes')
      .send({ nombre: '   ', tipoCliente: 'Comercio' })
      .expect(400);
    expect(prismaService.cliente.create).not.toHaveBeenCalled();
  });

  it('rechaza crear un cliente con una propiedad extra', async () => {
    await request(app.getHttpServer())
      .post('/clientes')
      .send({ nombre: 'Juan', tipoCliente: 'Comercio', rol: 'admin' })
      .expect(400);
    expect(prismaService.cliente.create).not.toHaveBeenCalled();
  });

  it('rechaza crear un cliente con telefono de solo espacios', async () => {
    await request(app.getHttpServer())
      .post('/clientes')
      .send({ nombre: 'Juan', tipoCliente: 'Comercio', telefono: '   ' })
      .expect(400);
    expect(prismaService.cliente.create).not.toHaveBeenCalled();
  });

  it('crea un cliente con solamente nombre y tipoCliente', async () => {
    const clienteCreado = { ...cliente, telefono: null };
    prismaService.cliente.create.mockResolvedValue(clienteCreado);

    await request(app.getHttpServer())
      .post('/clientes')
      .send({ nombre: 'Juan', tipoCliente: 'Comercio' })
      .expect(201)
      .expect({ ...clienteCreado, message: 'Cliente creado con exito' });
    expect(prismaService.cliente.create).toHaveBeenCalledWith({
      data: {
        nombre: 'Juan',
        telefono: undefined,
        direccion: undefined,
        referencia: undefined,
        tipoCliente: 'Comercio',
        observaciones: undefined,
      },
    });
  });

  it('lista los clientes activos', async () => {
    await request(app.getHttpServer())
      .get('/clientes')
      .expect(200)
      .expect([cliente]);
    expect(prismaService.cliente.findMany).toHaveBeenCalledWith({
      where: { activo: true },
    });
  });

  it('lista los clientes inactivos', async () => {
    const inactivo = { ...cliente, activo: false };
    prismaService.cliente.findMany.mockResolvedValue([inactivo]);

    await request(app.getHttpServer())
      .get('/clientes/inactivos')
      .expect(200)
      .expect([inactivo]);
    expect(prismaService.cliente.findMany).toHaveBeenCalledWith({
      where: { activo: false },
    });
  });

  it('consulta un cliente por ID', async () => {
    await request(app.getHttpServer())
      .get(`/clientes/${cliente.id}`)
      .expect(200)
      .expect(cliente);
    expect(prismaService.cliente.findUnique).toHaveBeenCalledWith({
      where: { id: cliente.id },
    });
  });

  it('consulta por ID un cliente inactivo', async () => {
    const inactivo = { ...cliente, activo: false };
    prismaService.cliente.findUnique.mockResolvedValue(inactivo);

    await request(app.getHttpServer())
      .get(`/clientes/${cliente.id}`)
      .expect(200)
      .expect(inactivo);
  });

  it('edita un campo y permite limpiar un dato opcional con null', async () => {
    prismaService.cliente.update.mockResolvedValue({
      ...cliente,
      nombre: 'Pedro',
      telefono: null,
    });

    await request(app.getHttpServer())
      .patch(`/clientes/${cliente.id}`)
      .send({ nombre: 'Pedro', telefono: null })
      .expect(200)
      .expect({
        ...cliente,
        nombre: 'Pedro',
        telefono: null,
        message: 'Cliente editado con exito',
      });
    expect(prismaService.cliente.update).toHaveBeenCalledWith({
      where: { id: cliente.id },
      data: {
        nombre: 'Pedro',
        telefono: null,
        direccion: undefined,
        referencia: undefined,
        tipoCliente: undefined,
        observaciones: undefined,
      },
    });
  });

  it('elimina espacios al inicio y al final al editar un cliente', async () => {
    const datos = {
      nombre: 'Juan Perez',
      telefono: '1234 5678',
      direccion: 'San Martin 123',
      referencia: 'Frente a la plaza',
      tipoCliente: 'Comercio minorista',
      observaciones: 'Entregar por la tarde',
    };

    await request(app.getHttpServer())
      .patch(`/clientes/${cliente.id}`)
      .send({
        nombre: '  Juan Perez  ',
        telefono: '  1234 5678  ',
        direccion: '  San Martin 123  ',
        referencia: '  Frente a la plaza  ',
        tipoCliente: '  Comercio minorista  ',
        observaciones: '  Entregar por la tarde  ',
      })
      .expect(200);
    expect(prismaService.cliente.update).toHaveBeenCalledWith({
      where: { id: cliente.id },
      data: datos,
    });
  });

  it.each(limitesTexto)(
    'acepta editar un cliente con %s de %i caracteres despues del trim',
    async (campo, maximo) => {
      const texto = 'a'.repeat(maximo);

      await request(app.getHttpServer())
        .patch(`/clientes/${cliente.id}`)
        .send({ [campo]: `  ${texto}  ` })
        .expect(200);
      expect(prismaService.cliente.update).toHaveBeenCalledWith({
        where: { id: cliente.id },
        data: {
          nombre: undefined,
          telefono: undefined,
          direccion: undefined,
          referencia: undefined,
          tipoCliente: undefined,
          observaciones: undefined,
          [campo]: texto,
        },
      });
    },
  );

  it.each(limitesTexto)(
    'rechaza editar un cliente con %s que supera %i caracteres',
    async (campo, maximo) => {
      await request(app.getHttpServer())
        .patch(`/clientes/${cliente.id}`)
        .send({ [campo]: 'a'.repeat(maximo + 1) })
        .expect(400);
      expect(prismaService.cliente.update).not.toHaveBeenCalled();
    },
  );

  it('desactiva el cliente actualizando activo a false', async () => {
    prismaService.cliente.update.mockResolvedValue({
      ...cliente,
      activo: false,
    });

    await request(app.getHttpServer())
      .patch(`/clientes/${cliente.id}/estado`)
      .send({ activo: false })
      .expect(200)
      .expect({
        ...cliente,
        activo: false,
        message: 'Se actualizo estado con exito',
      });
    expect(prismaService.cliente.update).toHaveBeenCalledWith({
      where: { id: cliente.id },
      data: { activo: false },
    });
  });

  it('reactiva un cliente inactivo', async () => {
    prismaService.cliente.findUnique.mockResolvedValue({
      ...cliente,
      activo: false,
    });

    await request(app.getHttpServer())
      .patch(`/clientes/${cliente.id}/estado`)
      .send({ activo: true })
      .expect(200)
      .expect({ ...cliente, message: 'Se actualizo estado con exito' });
    expect(prismaService.cliente.update).toHaveBeenCalledWith({
      where: { id: cliente.id },
      data: { activo: true },
    });
  });

  it.each([true, false])('rechaza repetir el estado %s', async (activo) => {
    prismaService.cliente.findUnique.mockResolvedValue({
      ...cliente,
      activo,
    });

    await request(app.getHttpServer())
      .patch(`/clientes/${cliente.id}/estado`)
      .send({ activo })
      .expect(400);
    expect(prismaService.cliente.update).not.toHaveBeenCalled();
  });

  it.each([{}, { activo: null }, { activo: 'false' }, { activo: 1 }])(
    'rechaza un estado invalido: %j',
    async (datos) => {
      await request(app.getHttpServer())
        .patch(`/clientes/${cliente.id}/estado`)
        .send(datos)
        .expect(400);
      expect(prismaService.cliente.update).not.toHaveBeenCalled();
    },
  );

  it('rechaza una edicion vacia', async () => {
    await request(app.getHttpServer())
      .patch(`/clientes/${cliente.id}`)
      .send({})
      .expect(400);
    expect(prismaService.cliente.update).not.toHaveBeenCalled();
  });

  it('rechaza editar un cliente inactivo', async () => {
    prismaService.cliente.findUnique.mockResolvedValue({
      ...cliente,
      activo: false,
    });

    await request(app.getHttpServer())
      .patch(`/clientes/${cliente.id}`)
      .send({ nombre: 'Otro cliente' })
      .expect(400);
    expect(prismaService.cliente.update).not.toHaveBeenCalled();
  });

  it('devuelve 404 al consultar, editar o cambiar el estado de un cliente inexistente', async () => {
    prismaService.cliente.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get(`/clientes/${cliente.id}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/clientes/${cliente.id}`)
      .send({ nombre: 'Otro cliente' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/clientes/${cliente.id}/estado`)
      .send({ activo: false })
      .expect(404);
    expect(prismaService.cliente.update).not.toHaveBeenCalled();
  });

  it.each([
    { nombre: '   ' },
    { nombre: null },
    { tipoCliente: '' },
    { tipoCliente: null },
    { telefono: 123 },
    { direccion: 123 },
    { referencia: 123 },
    { observaciones: 123 },
    { activo: false },
    { rol: 'admin' },
  ])('rechaza una edición inválida: %j', async (datos) => {
    await request(app.getHttpServer())
      .patch(`/clientes/${cliente.id}`)
      .send(datos)
      .expect(400);
    expect(prismaService.cliente.update).not.toHaveBeenCalled();
  });

  it('rechaza un ID que no es UUID', async () => {
    await request(app.getHttpServer()).get('/clientes/id-invalido').expect(400);
    expect(prismaService.cliente.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza editar un cliente con un ID que no es UUID', async () => {
    await request(app.getHttpServer())
      .patch('/clientes/id-invalido')
      .send({ nombre: 'Otro cliente' })
      .expect(400);
    expect(prismaService.cliente.findUnique).not.toHaveBeenCalled();
    expect(prismaService.cliente.update).not.toHaveBeenCalled();
  });

  it('rechaza cambiar el estado de un cliente con un ID que no es UUID', async () => {
    await request(app.getHttpServer())
      .patch('/clientes/id-invalido/estado')
      .send({ activo: false })
      .expect(400);
    expect(prismaService.cliente.findUnique).not.toHaveBeenCalled();
    expect(prismaService.cliente.update).not.toHaveBeenCalled();
  });
});
