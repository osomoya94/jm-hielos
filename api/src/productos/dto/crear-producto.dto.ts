import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductoDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(100)
  @Matches(/\S/, {
    message: 'El texto no puede estar vacío ni contener solo espacios',
  })
  nombre!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  pesoKg!: number;

  @IsNotEmpty()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(30)
  @Matches(/\S/, {
    message: 'El texto no puede estar vacío ni contener solo espacios',
  })
  unidad!: string;
}
