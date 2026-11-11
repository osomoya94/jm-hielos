import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Rol } from '../../generated/prisma/enums';
import { CreateUsuarioDto } from './crear-usuario.dto';

describe('CreateUsuarioDto', () => {
  it.each(Object.values(Rol))('acepta el rol %s de Prisma', async (rol) => {
    const dto = plainToInstance(CreateUsuarioDto, {
      username: 'usuarioPrueba',
      password: 'ClaveSegura123',
      rol,
    });

    const errores = await validate(dto);

    expect(errores).toEqual([]);
  });

  it('debe rechazar un rol inválido', async () => {
    const dto = plainToInstance(CreateUsuarioDto, {
      username: 'usuarioPrueba',
      password: 'ClaveSegura123',
      rol: 'SUPERADMIN',
    });

    const errores = await validate(dto);

    expect(errores.some((error) => error.property === 'rol')).toBe(true);
  });
});
