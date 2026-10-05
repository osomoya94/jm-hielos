import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateClienteDto {
  // Se pueden omitir nombre y tipoCliente, pero no enviar null.
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

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(30)
  @Matches(/\S/, {
    message: 'El texto no puede estar vacío ni contener solo espacios',
  })
  telefono?: string | null;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(150)
  @Matches(/\S/, {
    message: 'El texto no puede estar vacío ni contener solo espacios',
  })
  direccion?: string | null;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(150)
  @Matches(/\S/, {
    message: 'El texto no puede estar vacío ni contener solo espacios',
  })
  referencia?: string | null;

  @ValidateIf((_obj: unknown, value: unknown) => value !== undefined)
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(50)
  @Matches(/\S/, {
    message: 'El texto no puede estar vacío ni contener solo espacios',
  })
  tipoCliente?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(500)
  @Matches(/\S/, {
    message: 'El texto no puede estar vacío ni contener solo espacios',
  })
  observaciones?: string | null;
}
