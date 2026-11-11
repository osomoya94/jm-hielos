import { IsBoolean, IsDefined } from 'class-validator';

export class CambiarEstadoUsuarioDto {
  @IsDefined()
  @IsBoolean()
  activo!: boolean;
}
