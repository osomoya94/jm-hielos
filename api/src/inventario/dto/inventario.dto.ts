import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsDefined,
  IsEnum,
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
import { TipoInsumo, UbicacionInsumo } from '../../generated/prisma/enums';

const opcional = (_: unknown, value: unknown) => value !== undefined;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class PresentacionDto {
  @IsString()
  @Transform(trim)
  @Matches(/\S/)
  @MaxLength(100)
  nombre!: string;

  @ValidateIf(opcional)
  @IsString()
  @Matches(/^\d{1,9}(?:\.\d{1,3})?$/)
  factor?: string;
}

export class CrearInsumoDto {
  @IsString()
  @Transform(trim)
  @Matches(/\S/)
  @MaxLength(100)
  nombre!: string;

  @IsEnum(TipoInsumo)
  tipo!: TipoInsumo;

  @IsString()
  @Transform(trim)
  @Matches(/\S/)
  @MaxLength(30)
  unidad!: string;

  @ValidateIf(opcional)
  @IsUUID('4')
  productoId?: string;

  @ValidateIf(opcional)
  @IsString()
  @Matches(/^\d{1,9}(?:\.\d{1,3})?$/)
  stockMinimo?: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => PresentacionDto)
  presentacion!: PresentacionDto;
}

export class EditarInsumoDto {
  @ValidateIf(opcional)
  @IsString()
  @Transform(trim)
  @Matches(/\S/)
  @MaxLength(100)
  nombre?: string;

  @ValidateIf(opcional)
  @IsString()
  @Matches(/^\d{1,9}(?:\.\d{1,3})?$/)
  stockMinimo?: string;

  @ValidateIf(opcional)
  @IsBoolean()
  activo?: boolean;
}

export class OperacionInventarioDto {
  @IsUUID('4')
  claveIdempotencia!: string;

  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  fechaEfectiva!: string;

  @IsString()
  @Transform(trim)
  @Matches(/\S/)
  @MaxLength(500)
  motivo!: string;
}

export class DetalleCompraDto {
  @IsUUID('4')
  presentacionId!: string;

  @IsInt()
  @Min(1)
  @Max(1000000)
  paquetes!: number;

  @IsString()
  @Matches(/^\d{1,12}(?:\.\d{1,2})?$/)
  costoTotal!: string;
}

export class PagoDto {
  @IsUUID('4')
  cuentaId!: string;

  @IsUUID('4')
  categoriaId!: string;

  @IsString()
  @Matches(/^\d{1,12}(?:\.\d{1,2})?$/)
  importe!: string;
}

export class CompraInsumoDto extends OperacionInventarioDto {
  @IsUUID('4')
  proveedorId!: string;

  @IsString()
  @Transform(trim)
  @Matches(/\S/)
  @MaxLength(100)
  comprobante!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ArrayUnique((d: DetalleCompraDto | null) => d?.presentacionId)
  @ValidateNested({ each: true })
  @Type(() => DetalleCompraDto)
  detalles!: DetalleCompraDto[];

  @ValidateIf(opcional)
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  vencimiento?: string;

  @ValidateIf(opcional)
  @ValidateNested()
  @Type(() => PagoDto)
  pago?: PagoDto;
}

export class PagoCompraDto extends OperacionInventarioDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => PagoDto)
  pago!: PagoDto;
}

export class TrasladoDto extends OperacionInventarioDto {
  @IsUUID('4')
  presentacionId!: string;

  @IsInt()
  @Min(1)
  @Max(1000000)
  paquetes!: number;
}

export class ConsumoDto {
  @IsUUID('4')
  presentacionId!: string;

  @IsString()
  @Matches(/^\d{1,9}(?:\.\d{1,3})?$/)
  cantidad!: string;
}

export class LoteDto extends OperacionInventarioDto {
  @IsString()
  @Transform(trim)
  @Matches(/\S/)
  @MaxLength(100)
  codigo!: string;

  @IsUUID('4')
  productoId!: string;

  @IsUUID('4')
  presentacionBolsaId!: string;

  @IsUUID('4')
  responsableId!: string;

  @ValidateIf(opcional)
  @IsArray()
  @ArrayMaxSize(2)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  ayudantesIds?: string[];

  @IsInt()
  @Min(0)
  @Max(1000000)
  bolsasUsadas!: number;

  @IsInt()
  @Min(0)
  @Max(1000000)
  bolsasRotas!: number;

  @IsInt()
  @Min(0)
  @Max(1000000)
  cantidadApta!: number;

  @ValidateIf(opcional)
  @IsInt()
  @Min(0)
  @Max(1000000)
  cantidadEsperada?: number;

  @IsString()
  @Matches(/^\d{1,9}(?:\.\d{1,3})?$/)
  hieloDescartadoKg!: string;

  @ValidateIf(opcional)
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique((d: ConsumoDto | null) => d?.presentacionId)
  @ValidateNested({ each: true })
  @Type(() => ConsumoDto)
  otrosConsumos?: ConsumoDto[];
}

export enum AccionInsumo {
  CONSUMO = 'CONSUMO',
  PERDIDA = 'PERDIDA',
  DEVOLUCION_PROVEEDOR = 'DEVOLUCION_PROVEEDOR',
  AJUSTE = 'AJUSTE',
  CONTEO = 'CONTEO',
}
export class MovimientoInsumoDto extends OperacionInventarioDto {
  @IsUUID('4')
  presentacionId!: string;

  @IsEnum(UbicacionInsumo)
  ubicacion!: UbicacionInsumo;

  @IsEnum(AccionInsumo)
  accion!: AccionInsumo;

  // AJUSTE admite signo. CONTEO representa la existencia física absoluta.
  @IsString()
  @Matches(/^-?\d{1,9}(?:\.\d{1,3})?$/)
  cantidad!: string;

  @ValidateIf(opcional)
  @IsString()
  @Matches(/^\d{1,12}(?:\.\d{1,6})?$/)
  costoUnitario?: string;

  @ValidateIf(opcional)
  @IsUUID('4')
  corrigeOperacionId?: string;
}

export enum AccionStock {
  PERDIDA = 'PERDIDA',
  DEVOLUCION = 'DEVOLUCION',
  OBSEQUIO = 'OBSEQUIO',
  CONSUMO_INTERNO = 'CONSUMO_INTERNO',
  AJUSTE = 'AJUSTE',
  CONTEO = 'CONTEO',
}
export class MovimientoStockDto extends OperacionInventarioDto {
  @IsUUID('4')
  productoId!: string;

  @IsEnum(AccionStock)
  accion!: AccionStock;

  @IsInt()
  @Min(-1000000)
  @Max(1000000)
  cantidad!: number;

  @ValidateIf(opcional)
  @IsUUID('4')
  responsableId?: string;

  @ValidateIf(opcional)
  @IsArray()
  @ArrayMaxSize(2)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  ayudantesIds?: string[];

  @ValidateIf(opcional)
  @IsUUID('4')
  corrigeOperacionId?: string;
}
