import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateCategoriaFlujoDto {
  // Se puede omitir el campo, pero no enviar null.
  @ValidateIf((_obj: unknown, value: unknown) => value !== undefined)
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(100)
  @Matches(/\S/, {
    message: 'El nombre no puede estar vacío ni contener solo espacios',
  })
  nombre?: string;
}
