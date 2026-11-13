import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { GrupoFlujo, TipoMovimiento } from '../../generated/prisma/enums';

export class CreateCategoriaFlujoDto {
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

  @IsEnum(GrupoFlujo)
  grupo!: GrupoFlujo;

  @IsEnum(TipoMovimiento)
  sentido!: TipoMovimiento;
}
