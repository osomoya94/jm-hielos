import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Rol } from '../../generated/prisma/enums';

export class CreateUsuarioDto {
  @MaxLength(72, {
    message: 'El username no puede superar los 72 caracteres',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/\S/, {
    message: 'El texto no puede estar vacío ni contener solo espacios',
  })
  username!: string;

  @MinLength(8, {
    message: 'La contraseña debe tener al menos 8 caracteres',
  })
  @MaxLength(72, {
    message: 'La contraseña no puede superar los 72 caracteres',
  })
  @IsString()
  @Matches(/\S/, {
    message: 'El texto no puede estar vacío ni contener solo espacios',
  })
  password!: string;

  @IsEnum(Rol, {
    message: 'El rol debe ser ADMIN, OPERADOR o LECTOR',
  })
  rol!: Rol;
}
