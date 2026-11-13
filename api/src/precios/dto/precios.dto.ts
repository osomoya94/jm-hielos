import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { TipoListaPrecio } from '../../generated/prisma/enums';

export class MotivoPrecioDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Matches(/\S/)
  @MaxLength(500)
  motivo!: string;
}
export class CrearListaDto extends MotivoPrecioDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Matches(/\S/)
  @MaxLength(100)
  nombre!: string;
  @IsEnum(TipoListaPrecio) tipo!: TipoListaPrecio;
}
export class EditarListaDto extends MotivoPrecioDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Matches(/\S/)
  @MaxLength(100)
  nombre!: string;
  @IsBoolean()
  activo!: boolean;
}
export class PrecioProductoDto extends MotivoPrecioDto {
  @IsUUID('4') productoId!: string;
  @IsString() @Matches(/^\d{1,12}(?:\.\d{1,2})?$/) precio!: string;
}
export class CondicionClienteDto extends MotivoPrecioDto {
  @IsUUID('4') listaId!: string;
  @ValidateIf((_: unknown, v: unknown) => v !== undefined)
  @IsBoolean()
  consumidorFinal?: boolean;
}
export class PrecioParticularDto extends PrecioProductoDto {
  @ValidateIf((_: unknown, v: unknown) => v !== undefined)
  @IsBoolean()
  activo?: boolean;
}
