import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Rol } from '../../generated/prisma/enums';
import { UpdateUsuarioDto } from './editar-usuario.dto';

describe('UpdateUsuarioDto', () => {
  it.each(Object.values(Rol))('acepta el rol %s de Prisma', async (rol) => {
    const dto = plainToInstance(UpdateUsuarioDto, { rol });

    const errores = await validate(dto);

    expect(errores).toEqual([]);
  });

  it('rechaza un rol inválido', async () => {
    const dto = plainToInstance(UpdateUsuarioDto, { rol: 'SUPERADMIN' });

    const errores = await validate(dto);

    expect(errores.some((error) => error.property === 'rol')).toBe(true);
  });
});
