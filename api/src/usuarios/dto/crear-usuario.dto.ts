import { Transform } from 'class-transformer';
import { Matches, MaxLength, MinLength } from 'class-validator';

enum Rol {
  ADMIN,
  OPERADOR,
  LECTOR,
}

export class CreateUsuarioDto {
  @MaxLength(72, {
    message: 'El username no puede superar los 72 caracteres',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
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
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Matches(/\S/, {
    message: 'El texto no puede estar vacío ni contener solo espacios',
  })
  password!: string;

  @Matches(/\S/, {
    message: 'El texto no puede estar vacío ni contener solo espacios',
  })
  rol!: Rol;
}
