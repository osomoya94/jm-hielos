import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateCuentaFinancieraDto {
  // Los campos se pueden omitir, pero no pueden recibir null.
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

  @ValidateIf((_obj: unknown, value: unknown) => value !== undefined)
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(100)
  @Matches(/\S/, {
    message:
      'El titular interno no puede estar vacío ni contener solo espacios',
  })
  titularInterno?: string;
}
