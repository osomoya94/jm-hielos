import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import type { CategoriaFlujo, Prisma } from '../generated/prisma/client';
import { GrupoFlujo, TipoMovimiento } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriasFlujoService } from './categorias-flujo.service';

// Se conserva la clase real de errores de Prisma sin conectar una base de datos.
jest.mock('../prisma/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('../generated/prisma/client', () => ({
  Prisma: jest.requireActual<typeof import('@prisma/client/runtime/client')>(
    '@prisma/client/runtime/client',
  ),
}));

describe('CategoriasFlujoService', () => {
  let service: CategoriasFlujoService;
  const categoria: CategoriaFlujo = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    nombre: 'Ventas de hielo',
    grupo: GrupoFlujo.OPERACION,
    sentido: TipoMovimiento.INGRESO,
    activo: true,
  };
  const datosCreacion = {
    nombre: categoria.nombre,
    grupo: categoria.grupo,
    sentido: categoria.sentido,
  };
  const prismaService = {
    categoriaFlujo: {
      findMany: jest.fn<
        Promise<CategoriaFlujo[]>,
        [Prisma.CategoriaFlujoFindManyArgs]
      >(),
      findUnique: jest.fn<
        Promise<CategoriaFlujo | null>,
        [Prisma.CategoriaFlujoFindUniqueArgs]
      >(),
      create: jest.fn<
        Promise<CategoriaFlujo>,
        [Prisma.CategoriaFlujoCreateArgs]
      >(),
      update: jest.fn<
        Promise<CategoriaFlujo>,
        [Prisma.CategoriaFlujoUpdateArgs]
      >(),
    },
    movimientoFinanciero: {
      findFirst: jest.fn<
        Promise<{ id: string } | null>,
        [Prisma.MovimientoFinancieroFindFirstArgs]
      >(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prismaService.categoriaFlujo.findMany.mockResolvedValue([categoria]);
    prismaService.categoriaFlujo.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(where.id === categoria.id ? categoria : null),
    );
    prismaService.categoriaFlujo.create.mockResolvedValue(categoria);
    prismaService.categoriaFlujo.update.mockResolvedValue(categoria);
    prismaService.movimientoFinanciero.findFirst.mockResolvedValue(null);

    const module = await Test.createTestingModule({
      providers: [
        CategoriasFlujoService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();
    service = module.get(CategoriasFlujoService);
  });

  it.each([true, false])(
    'lista por separado categorías con activo=%s',
    async (activo) => {
      const categorias = [{ ...categoria, activo }];
      prismaService.categoriaFlujo.findMany.mockResolvedValueOnce(categorias);

      const resultado = activo
        ? await service.listar()
        : await service.listarInactivas();

      expect(resultado).toEqual(categorias);
      expect(prismaService.categoriaFlujo.findMany).toHaveBeenCalledWith({
        where: { activo },
        orderBy: { nombre: 'asc' },
      });
    },
  );

  it.each([true, false])(
    'consulta por ID una categoría con activo=%s',
    async (activo) => {
      prismaService.categoriaFlujo.findUnique.mockResolvedValueOnce({
        ...categoria,
        activo,
      });

      await expect(service.consultarUno(categoria.id)).resolves.toEqual({
        ...categoria,
        activo,
      });
      expect(prismaService.categoriaFlujo.findUnique).toHaveBeenCalledWith({
        where: { id: categoria.id },
      });
    },
  );

  it('crea usando la combinación única y deja el estado predeterminado de Prisma', async () => {
    await expect(service.crear(datosCreacion)).resolves.toEqual({
      ...categoria,
      message: 'Categoría de flujo creada con éxito',
    });

    expect(prismaService.categoriaFlujo.findUnique).toHaveBeenCalledWith({
      where: { grupo_sentido_nombre: datosCreacion },
      select: { id: true },
    });
    expect(prismaService.categoriaFlujo.create).toHaveBeenCalledWith({
      data: datosCreacion,
    });
  });

  it.each([true, false])(
    'rechaza duplicados aunque la categoría existente tenga activo=%s',
    async (activo) => {
      prismaService.categoriaFlujo.findUnique.mockResolvedValueOnce({
        ...categoria,
        activo,
      });

      await expect(service.crear(datosCreacion)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaService.categoriaFlujo.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    { grupo: GrupoFlujo.OTROS, sentido: TipoMovimiento.INGRESO },
    { grupo: GrupoFlujo.OPERACION, sentido: TipoMovimiento.EGRESO },
  ])(
    'permite repetir el nombre con otra clasificación: %j',
    async (clasificacion) => {
      await service.crear({ ...datosCreacion, ...clasificacion });

      expect(prismaService.categoriaFlujo.findUnique).toHaveBeenCalledWith({
        where: { grupo_sentido_nombre: { ...datosCreacion, ...clasificacion } },
        select: { id: true },
      });
      expect(prismaService.categoriaFlujo.create).toHaveBeenCalledWith({
        data: { ...datosCreacion, ...clasificacion },
      });
    },
  );

  it('renombra una categoría activa sin movimientos y conserva grupo y sentido', async () => {
    const nombre = 'Cobros de ventas';
    prismaService.categoriaFlujo.update.mockResolvedValueOnce({
      ...categoria,
      nombre,
    });

    await expect(service.editar(categoria.id, { nombre })).resolves.toEqual({
      ...categoria,
      nombre,
      message: 'Categoría de flujo editada con éxito',
    });
    expect(prismaService.movimientoFinanciero.findFirst).toHaveBeenCalledWith({
      where: { categoriaId: categoria.id },
      select: { id: true },
    });
    expect(prismaService.categoriaFlujo.findUnique).toHaveBeenLastCalledWith({
      where: { grupo_sentido_nombre: { ...datosCreacion, nombre } },
      select: { id: true },
    });
    expect(prismaService.categoriaFlujo.update).toHaveBeenCalledWith({
      where: { id: categoria.id, activo: true, movimientos: { none: {} } },
      data: { nombre },
    });
  });

  it('conservar el nombre no escribe ni consulta movimientos, aunque tenga historial', async () => {
    prismaService.movimientoFinanciero.findFirst.mockResolvedValueOnce({
      id: 'movimiento',
    });

    await expect(
      service.editar(categoria.id, { nombre: categoria.nombre }),
    ).resolves.toEqual({
      ...categoria,
      message: 'Categoría de flujo editada con éxito',
    });
    expect(prismaService.movimientoFinanciero.findFirst).not.toHaveBeenCalled();
    expect(prismaService.categoriaFlujo.update).not.toHaveBeenCalled();
  });

  it('impide renombrar categorías con movimientos financieros relacionados', async () => {
    prismaService.movimientoFinanciero.findFirst.mockResolvedValueOnce({
      id: 'movimiento',
    });

    await expect(
      service.editar(categoria.id, { nombre: 'Otro nombre' }),
    ).rejects.toThrow(BadRequestException);
    expect(prismaService.categoriaFlujo.update).not.toHaveBeenCalled();
  });

  it('impide editar una categoría inactiva incluso conservando el nombre', async () => {
    prismaService.categoriaFlujo.findUnique.mockResolvedValueOnce({
      ...categoria,
      activo: false,
    });

    await expect(
      service.editar(categoria.id, { nombre: categoria.nombre }),
    ).rejects.toThrow(BadRequestException);
    expect(prismaService.categoriaFlujo.update).not.toHaveBeenCalled();
    expect(prismaService.movimientoFinanciero.findFirst).not.toHaveBeenCalled();
  });

  it('rechaza una edición vacía antes de consultar Prisma', async () => {
    await expect(service.editar(categoria.id, {})).rejects.toThrow(
      BadRequestException,
    );
    expect(prismaService.categoriaFlujo.findUnique).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'impide renombrar con una combinación ocupada por una categoría con activo=%s',
    async (activo) => {
      prismaService.categoriaFlujo.findUnique
        .mockResolvedValueOnce(categoria)
        .mockResolvedValueOnce({ ...categoria, id: 'otra-categoria', activo });

      await expect(
        service.editar(categoria.id, { nombre: 'Otro nombre' }),
      ).rejects.toThrow(ConflictException);
      expect(prismaService.categoriaFlujo.update).not.toHaveBeenCalled();
    },
  );

  it.each(['crear', 'editar'] as const)(
    'convierte P2002 en ConflictException al %s',
    async (operacion) => {
      const error = new PrismaClientKnownRequestError('Combinación duplicada', {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: { target: ['grupo', 'sentido', 'nombre'] },
      });

      if (operacion === 'crear') {
        prismaService.categoriaFlujo.create.mockRejectedValueOnce(error);
        await expect(service.crear(datosCreacion)).rejects.toThrow(
          ConflictException,
        );
      } else {
        prismaService.categoriaFlujo.update.mockRejectedValueOnce(error);
        await expect(
          service.editar(categoria.id, { nombre: 'Otro nombre' }),
        ).rejects.toThrow(ConflictException);
      }
    },
  );

  it('rechaza la edición si al escribir ya no se cumplen las condiciones', async () => {
    prismaService.categoriaFlujo.update.mockRejectedValueOnce(
      new PrismaClientKnownRequestError('Registro no disponible', {
        code: 'P2025',
        clientVersion: '7.10.0',
      }),
    );

    await expect(
      service.editar(categoria.id, { nombre: 'Otro nombre' }),
    ).rejects.toThrow(BadRequestException);
  });

  it.each(['crear', 'editar'] as const)(
    'propaga errores inesperados de Prisma al %s',
    async (operacion) => {
      const error = new Error('Fallo de base de datos');
      if (operacion === 'crear') {
        prismaService.categoriaFlujo.create.mockRejectedValueOnce(error);
        await expect(service.crear(datosCreacion)).rejects.toBe(error);
      } else {
        prismaService.categoriaFlujo.update.mockRejectedValueOnce(error);
        await expect(
          service.editar(categoria.id, { nombre: 'Otro nombre' }),
        ).rejects.toBe(error);
      }
    },
  );

  it.each([true, false])(
    'cambia a activo=%s escribiendo únicamente el estado de la categoría',
    async (activo) => {
      prismaService.categoriaFlujo.findUnique.mockResolvedValueOnce({
        ...categoria,
        activo: !activo,
      });
      prismaService.categoriaFlujo.update.mockResolvedValueOnce({
        ...categoria,
        activo,
      });

      await expect(
        service.cambiarEstado(categoria.id, { activo }),
      ).resolves.toEqual({
        ...categoria,
        activo,
        message: 'Se actualizó estado con éxito',
      });
      expect(prismaService.categoriaFlujo.update).toHaveBeenCalledWith({
        where: { id: categoria.id },
        data: { activo },
      });
      expect(
        prismaService.movimientoFinanciero.findFirst,
      ).not.toHaveBeenCalled();
    },
  );

  it.each([true, false])(
    'rechaza repetir el estado activo=%s',
    async (activo) => {
      prismaService.categoriaFlujo.findUnique.mockResolvedValueOnce({
        ...categoria,
        activo,
      });

      await expect(
        service.cambiarEstado(categoria.id, { activo }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaService.categoriaFlujo.update).not.toHaveBeenCalled();
    },
  );

  it.each(['consultar', 'editar', 'estado'] as const)(
    'devuelve NotFoundException al %s un ID inexistente',
    async (operacion) => {
      prismaService.categoriaFlujo.findUnique.mockResolvedValueOnce(null);
      const resultado =
        operacion === 'consultar'
          ? service.consultarUno(categoria.id)
          : operacion === 'editar'
            ? service.editar(categoria.id, { nombre: 'Otro nombre' })
            : service.cambiarEstado(categoria.id, { activo: false });

      await expect(resultado).rejects.toThrow(NotFoundException);
      expect(prismaService.categoriaFlujo.update).not.toHaveBeenCalled();
    },
  );
});
