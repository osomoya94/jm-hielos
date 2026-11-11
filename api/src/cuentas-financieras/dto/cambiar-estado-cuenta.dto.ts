import { IsBoolean, IsDefined } from 'class-validator';

export class CambiarEstadoCuentaDto {
  @IsDefined()
  @IsBoolean()
  activo!: boolean;
}
