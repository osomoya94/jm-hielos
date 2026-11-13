import { IsBoolean, IsDefined } from 'class-validator';

export class CambiarEstadoProveedorDto {
  @IsDefined()
  @IsBoolean()
  activo!: boolean;
}
