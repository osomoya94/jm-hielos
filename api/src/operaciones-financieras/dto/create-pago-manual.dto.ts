import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreatePagoManualDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(100)
  @Matches(/\S/)
  claveIdempotencia!: string;

  @IsUUID()
  cuentaId!: string;

  @IsUUID()
  categoriaId!: string;

  @IsString()
  @Matches(/^\d{1,16}(?:\.\d{1,2})?$/, {
    message:
      'El importe debe ser un decimal positivo con hasta 16 enteros y 2 decimales',
  })
  importe!: string;

  @IsString()
  @IsDateString(
    { strict: true, strictSeparator: true },
    {
      message:
        'La fecha efectiva debe ser una fecha válida en formato ISO 8601',
    },
  )
  @Matches(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/,
    {
      message:
        'Use fecha y hora con zona explícita, por ejemplo 2026-11-11T10:00:00-03:00',
    },
  )
  fechaEfectiva!: string;

  @IsNotEmpty()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(250)
  @Matches(/\S/, {
    message: 'El detalle no puede estar vacío ni contener solo espacios',
  })
  detalle!: string;
}
