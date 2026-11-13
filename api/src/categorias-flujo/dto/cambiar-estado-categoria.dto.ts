import { IsBoolean, IsDefined } from 'class-validator';

export class CambiarEstadoCategoriaDto {
  @IsDefined()
  @IsBoolean()
  activo!: boolean;
}
