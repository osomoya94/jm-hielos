import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsDefined,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  OperacionInventarioDto,
  PagoDto,
} from '../../inventario/dto/inventario.dto';

const opcional = (_: unknown, v: unknown) => v !== undefined;
export class ParticipantesVentaDto {
  @IsUUID('4') responsableId!: string;
  @ValidateIf(opcional)
  @IsArray()
  @ArrayMaxSize(2)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  ayudantesIds?: string[];
}
export class LineaVentaDto {
  @IsUUID('4') productoId!: string;
  @IsInt() @Min(1) @Max(1000000) cantidad!: number;
  // Precio que se mostró antes de confirmar: el servidor exige que siga vigente.
  @IsString() @Matches(/^\d{1,12}(?:\.\d{1,2})?$/) precioEsperado!: string;
}
export class CobroDto {
  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  fechaEfectiva!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique((p: PagoDto | null) => p?.cuentaId)
  @ValidateNested({ each: true })
  @Type(() => PagoDto)
  pagos!: PagoDto[];
}
export class ConfirmarVentaDto {
  @IsUUID('4') claveIdempotencia!: string;
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Matches(/\S/)
  @MaxLength(500)
  motivo!: string;
  @IsUUID('4') clienteId!: string;
  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  fechaPedido!: string;
  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  fechaEntrega!: string;
  @IsString() @Matches(/^\d{1,12}(?:\.\d{1,2})?$/) envio!: string;
  @IsUUID('4') responsableCobranzaId!: string;
  @IsDefined()
  @ValidateNested()
  @Type(() => ParticipantesVentaDto)
  preparacion!: ParticipantesVentaDto;
  @IsDefined()
  @ValidateNested()
  @Type(() => ParticipantesVentaDto)
  entrega!: ParticipantesVentaDto;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique((l: LineaVentaDto | null) => l?.productoId)
  @ValidateNested({ each: true })
  @Type(() => LineaVentaDto)
  detalles!: LineaVentaDto[];
  @ValidateIf(opcional)
  @ValidateNested()
  @Type(() => CobroDto)
  cobro?: CobroDto;
}
export class CobrarVentaDto extends OperacionInventarioDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique((p: PagoDto | null) => p?.cuentaId)
  @ValidateNested({ each: true })
  @Type(() => PagoDto)
  pagos!: PagoDto[];
}
export class DevolucionVentaDto {
  @IsUUID('4') productoId!: string;
  @IsInt() @Min(1) @Max(1000000) cantidad!: number;
}
export class AnularVentaDto extends OperacionInventarioDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique((l: DevolucionVentaDto | null) => l?.productoId)
  @ValidateNested({ each: true })
  @Type(() => DevolucionVentaDto)
  devoluciones!: DevolucionVentaDto[];
}
