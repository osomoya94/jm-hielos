import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Rol } from '../../generated/prisma/enums';

export class UpdateUsuarioDto {
  @ValidateIf((_obj: unknown, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(72, {
    message: 'El username no puede superar los 72 caracteres',
  })
  @Matches(/\S/, {
    message: 'El texto no puede estar vacío ni contener solo espacios',
  })
  username?: string;

  @ValidateIf((_obj: unknown, value: unknown) => value !== undefined)
  @IsEnum(Rol, {
    message: 'El rol debe ser ADMIN, OPERADOR o LECTOR',
  })
  rol?: Rol;
}
