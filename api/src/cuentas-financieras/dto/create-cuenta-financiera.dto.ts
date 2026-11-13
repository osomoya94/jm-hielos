import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { TipoCuentaFinanciera } from '../../generated/prisma/enums';

export class CreateCuentaFinancieraDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(100)
  @Matches(/\S/, {
    message: 'El nombre no puede estar vacío ni contener solo espacios',
  })
  nombre!: string;

  @IsEnum(TipoCuentaFinanciera, {
    message: 'El tipo debe ser EFECTIVO, BANCO, BILLETERA o INVERSION',
  })
  tipo!: TipoCuentaFinanciera;

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
  titularInterno!: string;

  @IsString()
  // Decimal(18, 2) admite hasta 16 dígitos enteros y 2 decimales.
  @Matches(/^\d{1,16}(?:\.\d{1,2})?$/, {
    message:
      'El saldo inicial debe ser un string decimal no negativo, con hasta 16 dígitos enteros y 2 decimales, usando punto decimal',
  })
  saldoInicial!: string;

  @IsString()
  @IsDateString(
    { strict: true, strictSeparator: true },
    {
      message:
        'La fecha de apertura debe ser una fecha válida en formato ISO 8601',
    },
  )
  // Se aceptan fechas o fechas con hora completa y zona horaria que Date pueda convertir.
  @Matches(
    /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/,
    {
      message:
        'Use YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss con zona horaria para la fecha de apertura',
    },
  )
  fechaApertura!: string;
}
