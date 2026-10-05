import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../prisma/prisma.service';
import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';

// Las pruebas usan un Prisma simulado y no se conectan a la base de datos.
jest.mock('../prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

describe('ProductosController', () => {
  let app: INestApplication<App>;
  const producto = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    nombre: 'Bolsa de hielo',
    pesoKg: 5,
    unidad: 'bolsa',
    activo: true,
  };
  const prismaService = {
    producto: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const limitesTexto = [
    ['nombre', 100],
    ['unidad', 30],
  ] as const;

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaService.producto.findMany.mockResolvedValue([producto]);
    prismaService.producto.findUnique.mockResolvedValue(producto);
    prismaService.producto.create.mockResolvedValue(producto);
    prismaService.producto.update.mockResolvedValue(producto);

    const module = await Test.createTestingModule({
      controllers: [ProductosController],
      providers: [
        ProductosService,
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

  it('crea un producto valido', async () => {
    const datos = { nombre: 'Bolsa de hielo', pesoKg: 5, unidad: 'bolsa' };

    await request(app.getHttpServer())
      .post('/productos')
      .send(datos)
      .expect(201)
      .expect({ ...producto, message: 'Producto creado con exito' });
    expect(prismaService.producto.create).toHaveBeenCalledWith({ data: datos });
  });

  it('elimina espacios al inicio y al final al crear un producto', async () => {
    await request(app.getHttpServer())
      .post('/productos')
      .send({ nombre: '  Bolsa de hielo  ', pesoKg: 5, unidad: '  bolsa  ' })
      .expect(201);
    expect(prismaService.producto.create).toHaveBeenCalledWith({
      data: { nombre: 'Bolsa de hielo', pesoKg: 5, unidad: 'bolsa' },
    });
  });

  it.each(limitesTexto)(
    'acepta crear un producto con %s de %i caracteres despues del trim',
    async (campo, maximo) => {
      const texto = 'a'.repeat(maximo);
      const datos = {
        nombre: 'Bolsa de hielo',
        pesoKg: 5,
        unidad: 'bolsa',
        [campo]: texto,
      };

      await request(app.getHttpServer())
        .post('/productos')
        .send({ ...datos, [campo]: `  ${texto}  ` })
        .expect(201);
      expect(prismaService.producto.create).toHaveBeenCalledWith({
        data: datos,
      });
    },
  );

  it.each(limitesTexto)(
    'rechaza crear un producto con %s que supera %i caracteres',
    async (campo, maximo) => {
      await request(app.getHttpServer())
        .post('/productos')
        .send({
          nombre: 'Bolsa de hielo',
          pesoKg: 5,
          unidad: 'bolsa',
          [campo]: 'a'.repeat(maximo + 1),
        })
        .expect(400);
      expect(prismaService.producto.create).not.toHaveBeenCalled();
    },
  );

  it('rechaza crear un producto sin un campo obligatorio', async () => {
    await request(app.getHttpServer())
      .post('/productos')
      .send({ nombre: 'Bolsa de hielo', pesoKg: 5 })
      .expect(400);
    expect(prismaService.producto.create).not.toHaveBeenCalled();
  });

  it('rechaza crear un producto con nombre de solo espacios', async () => {
    await request(app.getHttpServer())
      .post('/productos')
      .send({ nombre: '   ', pesoKg: 5, unidad: 'bolsa' })
      .expect(400);
    expect(prismaService.producto.create).not.toHaveBeenCalled();
  });

  it('rechaza crear un producto con una propiedad extra', async () => {
    await request(app.getHttpServer())
      .post('/productos')
      .send({
        nombre: 'Bolsa de hielo',
        pesoKg: 5,
        unidad: 'bolsa',
        precio: 100,
      })
      .expect(400);
    expect(prismaService.producto.create).not.toHaveBeenCalled();
  });

  it('rechaza crear un producto con pesoKg igual a 0', async () => {
    await request(app.getHttpServer())
      .post('/productos')
      .send({ nombre: 'Bolsa de hielo', pesoKg: 0, unidad: 'bolsa' })
      .expect(400);
    expect(prismaService.producto.create).not.toHaveBeenCalled();
  });

  it('rechaza crear un producto con pesoKg igual a 21', async () => {
    await request(app.getHttpServer())
      .post('/productos')
      .send({ nombre: 'Bolsa de hielo', pesoKg: 21, unidad: 'bolsa' })
      .expect(400);
    expect(prismaService.producto.create).not.toHaveBeenCalled();
  });

  it('lista los productos activos', async () => {
    await request(app.getHttpServer())
      .get('/productos')
      .expect(200)
      .expect([producto]);
    expect(prismaService.producto.findMany).toHaveBeenCalledWith({
      where: { activo: true },
    });
  });

  it('lista los productos inactivos', async () => {
    const inactivo = { ...producto, activo: false };
    prismaService.producto.findMany.mockResolvedValue([inactivo]);

    await request(app.getHttpServer())
      .get('/productos/inactivos')
      .expect(200)
      .expect([inactivo]);
    expect(prismaService.producto.findMany).toHaveBeenCalledWith({
      where: { activo: false },
    });
  });

  it('consulta un producto por ID', async () => {
    await request(app.getHttpServer())
      .get(`/productos/${producto.id}`)
      .expect(200)
      .expect(producto);
    expect(prismaService.producto.findUnique).toHaveBeenCalledWith({
      where: { id: producto.id },
    });
  });

  it('consulta por ID un producto inactivo', async () => {
    const inactivo = { ...producto, activo: false };
    prismaService.producto.findUnique.mockResolvedValue(inactivo);

    await request(app.getHttpServer())
      .get(`/productos/${producto.id}`)
      .expect(200)
      .expect(inactivo);
  });

  it('edita solamente los campos enviados', async () => {
    prismaService.producto.update.mockResolvedValue({
      ...producto,
      pesoKg: 10,
    });

    await request(app.getHttpServer())
      .patch(`/productos/${producto.id}`)
      .send({ pesoKg: 10 })
      .expect(200)
      .expect({
        ...producto,
        pesoKg: 10,
        message: 'Producto editado con exito',
      });
    expect(prismaService.producto.update).toHaveBeenCalledWith({
      where: { id: producto.id },
      data: { nombre: undefined, pesoKg: 10, unidad: undefined },
    });
  });

  it('elimina espacios al inicio y al final al editar un producto', async () => {
    await request(app.getHttpServer())
      .patch(`/productos/${producto.id}`)
      .send({ nombre: '  Bolsa de hielo  ', unidad: '  bolsa  ' })
      .expect(200);
    expect(prismaService.producto.update).toHaveBeenCalledWith({
      where: { id: producto.id },
      data: { nombre: 'Bolsa de hielo', pesoKg: undefined, unidad: 'bolsa' },
    });
  });

  it.each(limitesTexto)(
    'acepta editar un producto con %s de %i caracteres despues del trim',
    async (campo, maximo) => {
      const texto = 'a'.repeat(maximo);

      await request(app.getHttpServer())
        .patch(`/productos/${producto.id}`)
        .send({ [campo]: `  ${texto}  ` })
        .expect(200);
      expect(prismaService.producto.update).toHaveBeenCalledWith({
        where: { id: producto.id },
        data: {
          nombre: undefined,
          pesoKg: undefined,
          unidad: undefined,
          [campo]: texto,
        },
      });
    },
  );

  it.each(limitesTexto)(
    'rechaza editar un producto con %s que supera %i caracteres',
    async (campo, maximo) => {
      await request(app.getHttpServer())
        .patch(`/productos/${producto.id}`)
        .send({ [campo]: 'a'.repeat(maximo + 1) })
        .expect(400);
      expect(prismaService.producto.update).not.toHaveBeenCalled();
    },
  );

  it('desactiva el producto actualizando activo a false', async () => {
    prismaService.producto.update.mockResolvedValue({
      ...producto,
      activo: false,
    });

    await request(app.getHttpServer())
      .patch(`/productos/${producto.id}/estado`)
      .send({ activo: false })
      .expect(200)
      .expect({
        ...producto,
        activo: false,
        message: 'Se actualizo estado con exito',
      });
    expect(prismaService.producto.update).toHaveBeenCalledWith({
      where: { id: producto.id },
      data: { activo: false },
    });
  });

  it('reactiva un producto inactivo', async () => {
    prismaService.producto.findUnique.mockResolvedValue({
      ...producto,
      activo: false,
    });

    await request(app.getHttpServer())
      .patch(`/productos/${producto.id}/estado`)
      .send({ activo: true })
      .expect(200)
      .expect({ ...producto, message: 'Se actualizo estado con exito' });
    expect(prismaService.producto.update).toHaveBeenCalledWith({
      where: { id: producto.id },
      data: { activo: true },
    });
  });

  it.each([true, false])('rechaza repetir el estado %s', async (activo) => {
    prismaService.producto.findUnique.mockResolvedValue({
      ...producto,
      activo,
    });

    await request(app.getHttpServer())
      .patch(`/productos/${producto.id}/estado`)
      .send({ activo })
      .expect(400);
    expect(prismaService.producto.update).not.toHaveBeenCalled();
  });

  it.each([{}, { activo: null }, { activo: 'false' }, { activo: 1 }])(
    'rechaza un estado invalido: %j',
    async (datos) => {
      await request(app.getHttpServer())
        .patch(`/productos/${producto.id}/estado`)
        .send(datos)
        .expect(400);
      expect(prismaService.producto.update).not.toHaveBeenCalled();
    },
  );

  it('rechaza una edicion vacia', async () => {
    await request(app.getHttpServer())
      .patch(`/productos/${producto.id}`)
      .send({})
      .expect(400);
    expect(prismaService.producto.update).not.toHaveBeenCalled();
  });

  it('rechaza editar un producto inactivo', async () => {
    prismaService.producto.findUnique.mockResolvedValue({
      ...producto,
      activo: false,
    });

    await request(app.getHttpServer())
      .patch(`/productos/${producto.id}`)
      .send({ nombre: 'Otro producto' })
      .expect(400);
    expect(prismaService.producto.update).not.toHaveBeenCalled();
  });

  it('devuelve 404 al consultar, editar o cambiar el estado de un producto inexistente', async () => {
    prismaService.producto.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get(`/productos/${producto.id}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/productos/${producto.id}`)
      .send({ nombre: 'Otro producto' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/productos/${producto.id}/estado`)
      .send({ activo: false })
      .expect(404);
    expect(prismaService.producto.update).not.toHaveBeenCalled();
  });

  it.each([
    { nombre: '   ' },
    { nombre: null },
    { unidad: '' },
    { unidad: null },
    { pesoKg: 0 },
    { pesoKg: 1.5 },
    { pesoKg: '5' },
    { pesoKg: null },
    { activo: false },
    { precio: 100 },
  ])('rechaza una edición inválida: %j', async (datos) => {
    await request(app.getHttpServer())
      .patch(`/productos/${producto.id}`)
      .send(datos)
      .expect(400);
    expect(prismaService.producto.update).not.toHaveBeenCalled();
  });

  it('rechaza un ID que no es UUID', async () => {
    await request(app.getHttpServer())
      .get('/productos/id-invalido')
      .expect(400);
    expect(prismaService.producto.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza editar un producto con un ID que no es UUID', async () => {
    await request(app.getHttpServer())
      .patch('/productos/id-invalido')
      .send({ nombre: 'Otro producto' })
      .expect(400);
    expect(prismaService.producto.findUnique).not.toHaveBeenCalled();
    expect(prismaService.producto.update).not.toHaveBeenCalled();
  });

  it('rechaza cambiar el estado de un producto con un ID que no es UUID', async () => {
    await request(app.getHttpServer())
      .patch('/productos/id-invalido/estado')
      .send({ activo: false })
      .expect(400);
    expect(prismaService.producto.findUnique).not.toHaveBeenCalled();
    expect(prismaService.producto.update).not.toHaveBeenCalled();
  });
});
