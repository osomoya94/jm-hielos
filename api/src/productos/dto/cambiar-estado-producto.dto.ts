import { IsBoolean, IsDefined } from 'class-validator';

export class CambiarEstadoDto {
  @IsDefined()
  @IsBoolean()
  activo!: boolean;
}
