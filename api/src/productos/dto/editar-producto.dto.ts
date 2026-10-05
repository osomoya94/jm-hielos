import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateProductoDto {
  // Se pueden omitir los campos, pero no enviar null.
  @ValidateIf((_obj: unknown, value: unknown) => value !== undefined)
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(100)
  @Matches(/\S/, {
    message: 'El texto no puede estar vacío ni contener solo espacios',
  })
  nombre?: string;

  @ValidateIf((_obj: unknown, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(20)
  pesoKg?: number;

  @ValidateIf((_obj: unknown, value: unknown) => value !== undefined)
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(30)
  @Matches(/\S/, {
    message: 'El texto no puede estar vacío ni contener solo espacios',
  })
  unidad?: string;
}
